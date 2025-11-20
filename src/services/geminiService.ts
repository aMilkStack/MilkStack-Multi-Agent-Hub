import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges, TaskMap, ActiveTaskState } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER, MAX_RETRIES, INITIAL_BACKOFF_MS } from '../../constants';
import { loadSettings } from './indexedDbService';
import { rustyLogger, LogLevel } from './rustyPortableService';
import { TaskParser } from './taskParser';
import { WorkflowEngine, createWorkflowEngine, restoreWorkflowEngine } from './workflowEngine';
import { createAgentExecutor } from './AgentExecutor';
import { createPaidTierRateLimiter } from './rateLimiter';
import { buildSmartContext } from '../utils/smartContext';
import { SAFETY_SETTINGS, DEFAULT_MODEL } from '../config/ai';

/**
 * Shared rate limiter for all Gemini API calls
 *
 * Current Configuration (Paid Tier - default):
 * - Rate: 2.0 calls/sec (120 RPM) - safe for gemini-2.5-pro paid tier (150 RPM limit)
 * - Parallelism: 10 concurrent executions
 *
 * This ensures we never exceed API rate limits even with parallel agent execution.
 */
const rateLimiter = createPaidTierRateLimiter();

/**
 * Maximum consecutive agent turns without user intervention
 * Prevents infinite loops and API cost overruns
 */
const MAX_CONSECUTIVE_AUTO_TURNS = 5;

/**
 * Agent IDs whose messages should be filtered from Orchestrator context.
 * These agents produce diagnostic/error messages that confuse the Orchestrator.
 */
const ORCHESTRATOR_CONTEXT_BLOCKLIST = [
    'agent-debug-specialist-001', // Debug Specialist diagnostic messages
    'system-error', // System error messages
    'orchestrator-parse-error', // Orchestrator parse error messages
];

/**
 * Creates a sanitized conversation history for the Orchestrator.
 * Filters out messages from diagnostic/error agents to prevent context pollution.
 */
function buildSanitizedHistoryForOrchestrator(history: Message[]): Message[] {
    return history.filter(message => {
        // Filter out string authors that are in the blocklist (e.g., 'system-error')
        if (typeof message.author === 'string') {
            return !ORCHESTRATOR_CONTEXT_BLOCKLIST.includes(message.author);
        }
        // Keep agent messages ONLY if the agent is NOT in the blocklist
        return !ORCHESTRATOR_CONTEXT_BLOCKLIST.includes(message.author.id);
    });
}

/**
 * Extracts a JSON object from text that may contain conversational preamble or markdown formatting.
 * IMPROVED: Stricter extraction to prevent false positives from conversational text
 */
const extractJsonFromText = (text: string): string | null => {
    return TaskParser.extractJsonFromText(text);
};

const parseOrchestratorResponse = (responseText: string):
    | { agent: string; model: GeminiModel; parallel?: false }
    | { parallel: true; agents: Array<{ agent: string; model: GeminiModel }> } => {

    // STRATEGY 1: Try JSON parsing first (preferred format)
    const jsonString = extractJsonFromText(responseText.trim());

    if (jsonString) {
        try {
            const parsed = JSON.parse(jsonString);

            if (parsed.execution === 'parallel' && Array.isArray(parsed.agents)) {
                console.log('[Orchestrator] Parsed parallel execution format successfully');
                return {
                    parallel: true,
                    agents: parsed.agents.map((a: any) => ({
                        agent: a.agent.toLowerCase(),
                        model: a.model as GeminiModel
                    }))
                };
            }

            if (parsed.agent && parsed.model) {
                console.log(`[Orchestrator] Parsed sequential format: ${parsed.agent} (${parsed.model})`);
                return {
                    agent: parsed.agent.toLowerCase(),
                    model: parsed.model as GeminiModel,
                    parallel: false
                };
            }
        } catch (e) {
            // JSON parsing failed, fall through to resilient parsing
            console.warn(`[Orchestrator] JSON parsing failed, trying resilient text parsing...`);
        }
    }

    // STRATEGY 2: TEMPLATE LOGIC - Resilient text parsing (looks for LAST occurrence)
    // This makes the system resilient to conversational filler
    console.log('[Orchestrator] Using resilient text parsing (looking for last agent mention)...');

    // Check for WAIT_FOR_USER (case-insensitive, find LAST occurrence)
    const waitMatches = [...responseText.matchAll(/WAIT_FOR_USER/gi)];
    if (waitMatches.length > 0) {
        console.log(`[Orchestrator] Found WAIT_FOR_USER (last occurrence)`);
        return { agent: 'WAIT_FOR_USER', model: DEFAULT_MODEL, parallel: false };
    }

    // Check for orchestrator-uncertain
    if (/orchestrator-uncertain/i.test(responseText)) {
        return { agent: 'orchestrator-uncertain', model: DEFAULT_MODEL, parallel: false };
    }

    // Build list of all valid agent identifiers
    const allAgentIdentifiers = AGENT_PROFILES.map(p =>
        p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
    );

    // Find ALL agent mentions in the response (case-insensitive)
    const agentMatches: Array<{ identifier: string; index: number }> = [];
    for (const identifier of allAgentIdentifiers) {
        // Use word boundary to avoid partial matches
        const regex = new RegExp(`\\b${identifier}\\b`, 'gi');
        let match;
        while ((match = regex.exec(responseText)) !== null) {
            agentMatches.push({ identifier: identifier.toLowerCase(), index: match.index });
        }
    }

    // Take the LAST match (most resilient to conversational filler at the start)
    if (agentMatches.length > 0) {
        agentMatches.sort((a, b) => b.index - a.index); // Sort by index descending
        const lastMatch = agentMatches[0];
        console.log(`[Orchestrator] Found ${agentMatches.length} agent mentions, using LAST: ${lastMatch.identifier}`);
        // Default to pro model for resilient parsing
        return { agent: lastMatch.identifier, model: DEFAULT_MODEL, parallel: false };
    }

    // FALLBACK: No agent found
    console.error(`[Orchestrator] No valid agent identifier found in response: "${responseText}"`);
    return { agent: 'orchestrator-parse-error', model: DEFAULT_MODEL, parallel: false };
};

const detectAgentMention = (content: string): string | null => {
    const mentionPattern = /@([a-z-]+)/i;
    const match = content.match(mentionPattern);

    if (match) {
        const mentionedIdentifier = match[1].toLowerCase();
        const allAgentIdentifiers = AGENT_PROFILES.map(p =>
            p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
        );

        if (allAgentIdentifiers.includes(mentionedIdentifier)) {
            return mentionedIdentifier;
        }
    }

    return null;
};

const parseProposedChanges = (responseText: string): {
    proposedChanges: AgentProposedChanges | null;
    cleanedText: string;
} => {
    const jsonBlockPattern = /```json\s*\n?([\s\S]*?)\n?```/g;
    const matches = [...responseText.matchAll(jsonBlockPattern)];

    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]);

            if (parsed.type === 'proposed_changes' && Array.isArray(parsed.changes)) {
                const cleanedText = responseText.replace(match[0], '').trim();

                return {
                    proposedChanges: parsed as AgentProposedChanges,
                    cleanedText
                };
            }
        } catch (e) {
            continue;
        }
    }

    return {
        proposedChanges: null,
        cleanedText: responseText
    };
};

const findAgentByIdentifier = (identifier: string): Agent | undefined => {
    return AGENT_PROFILES.find(agent => {
        const agentIdentifier = agent.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
        return agentIdentifier === identifier;
    });
};

/**
 * Type for Gemini API conversation contents array
 * Exported for use in smart context pruning
 */
export type ConversationContents = Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;

/**
 * Builds conversation contents from message history and codebase context.
 * Exported for use in smart context pruning utilities.
 */
export const buildConversationContents = (messages: Message[], codebaseContext: string): ConversationContents => {
    const contents: ConversationContents = [];

    // FIX: Character Budgeting (Rough Token Estimation)
    // 1 Token ~= 4 chars.
    // Limit: ~800k tokens (safe buffer for 1M limit) -> ~3.2M chars
    const MAX_CHARS = 3200000;
    let currentChars = codebaseContext.length;

    // Always keep the codebase
    if (codebaseContext) {
        contents.push({
            role: 'user',
            parts: [{ text: `# Codebase Context\n\`\`\`\n${codebaseContext}\n\`\`\`` }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand the codebase context. Ready to assist!' }]
        });
    }

    // Process messages in REVERSE to keep the most recent ones
    const reversedMessages = [...messages].reverse();
    const messagesToKeep: Message[] = [];

    // Always keep the very first message (User Intent) + Planner response if available
    // (We handle this by just ensuring we don't prune the head if possible,
    // but for strict safety, we prioritize recency + head).

    for (const msg of reversedMessages) {
        const msgLen = msg.content.length;
        if (currentChars + msgLen < MAX_CHARS) {
            messagesToKeep.unshift(msg); // Add to front (restoring order)
            currentChars += msgLen;
        } else {
            console.warn(`[Context] Pruning message ${msg.id} (length ${msgLen}) to stay within token limit.`);
            // Once we hit the limit, we stop adding older messages
            // Exception: We might want to force-keep the first message, but let's keep it simple for now.
            break;
        }
    }

    // Convert messages to conversation contents
    for (const msg of messagesToKeep) {
        const isUser = typeof msg.author === 'string';
        const role = isUser ? 'user' : 'model';
        const authorName = isUser ? msg.author : (msg.author as Agent).name;
        const messageText = `**${authorName}:**\n${msg.content}`;

        const lastContent = contents[contents.length - 1];

        // CRITICAL FIX: Only merge consecutive USER messages, NEVER merge agent messages
        // Each agent must have its own distinct turn to preserve identity and context
        if (lastContent && lastContent.role === role && role === 'user') {
            lastContent.parts[0].text += `\n\n---\n\n${messageText}`;
        } else {
            contents.push({
                role,
                parts: [{ text: messageText }]
            });
        }
    }

    return contents;
};

/**
 * Extracts and parses a Multi-Stage Task Map from a message.
 * Looks for ```json_task_map code blocks and validates the structure.
 */
export const extractAndParseTaskMap = (messageContent: string): { status: 'success' | 'not_found' | 'parse_error'; taskMap?: TaskMap; error?: string } => {
    try {
        const taskMap = TaskParser.extractTaskMap(messageContent);

        if (!taskMap) {
            return { status: 'not_found' };
        }

        return { status: 'success', taskMap };
    } catch (error: any) {
        return {
            status: 'parse_error',
            error: error.message
        };
    }
};

/**
 * Creates a system message for UI display
 */
const createSystemMessage = (content: string, isError: boolean = false): Message => {
    return {
        id: crypto.randomUUID(),
        author: 'Ethan', // System messages appear as user for simplicity
        content,
        timestamp: new Date(),
        isError,
    };
};

/**
 * Execute Agency V2 Multi-Stage Workflow
 * Handles stateful, multi-stage task execution with parallel/sequential agent coordination
 */
const executeAgencyV2Workflow = async (
    ai: GoogleGenAI,
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    console.log('[Agency V2] executeAgencyV2Workflow started');
    console.log('[Agency V2] messages:', messages.length);
    console.log('[Agency V2] activeTaskState:', activeTaskState);

    let currentHistory = [...messages];
    let engine: WorkflowEngine | null = null;

    // Create AgentExecutor for all API calls in this workflow
    // Rate limiter is now injected into the executor for service-level control
    const executor = createAgentExecutor(ai, rateLimiter, abortSignal);

    // Initialize or restore workflow engine
    if (activeTaskState) {
        // Restore existing workflow
        engine = restoreWorkflowEngine(activeTaskState);
        console.log(`[Agency V2] Resuming workflow: "${engine.getState().taskMap.title}"`);
    } else {
        // Check if last message from product-planner contains a new task map
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage.author !== 'string' && lastMessage.author.id === 'agent-product-planner-001') {
            const parseResult = extractAndParseTaskMap(lastMessage.content);
            if (parseResult.status === 'success' && parseResult.taskMap) {
                // Initialize new workflow engine
                engine = createWorkflowEngine(parseResult.taskMap);
                console.log(`[Agency V2] New task map detected: "${parseResult.taskMap.title}"`);
                const startMsg = createSystemMessage(`**🎯 New Plan: "${parseResult.taskMap.title}"**\n\nStarting multi-stage execution...`);
                onNewMessage(startMsg);
            } else if (parseResult.status === 'parse_error') {
                console.error(`[Agency V2] Task map parse error: ${parseResult.error}`);
                const errorMsg = createSystemMessage(`**❌ Planning Error**: ${parseResult.error}`, true);
                onNewMessage(errorMsg);
                return { updatedTaskState: null };
            }
        }
    }

    // No active workflow - need to start one by calling Product Planner
    if (!engine) {
        console.log('[Agency V2] No active workflow, invoking Product Planner...');

        // Find Product Planner agent
        const productPlanner = AGENT_PROFILES.find(a => a.id === 'agent-product-planner-001');
        if (!productPlanner) {
            console.error('[Agency V2] Product Planner not found!');
            const errorMsg = createSystemMessage('**❌ Error**: Product Planner agent not found', true);
            onNewMessage(errorMsg);
            return { updatedTaskState: null };
        }

        // Build conversation contents for planner
        const conversationContents = buildConversationContents(messages, codebaseContext);

        // Invoke Product Planner
        try {
            onAgentChange(productPlanner.id);

            let plannerResponse = '';

            // Rate limiting now handled internally by AgentExecutor
            await executor.executeStreaming(
                productPlanner,
                DEFAULT_MODEL,
                conversationContents,
                {
                    systemInstruction: productPlanner.prompt,
                    safetySettings: SAFETY_SETTINGS,
                },
                (chunk) => {
                    onMessageUpdate(chunk);
                    plannerResponse += chunk;
                }
            );

            // Add planner's response to messages
            const plannerMessage: Message = {
                id: crypto.randomUUID(),
                author: productPlanner,
                content: plannerResponse,
                timestamp: new Date(),
            };
            onNewMessage(plannerMessage);
            currentHistory.push(plannerMessage);

            // Try to extract task map from planner response
            const parseResult = extractAndParseTaskMap(plannerResponse);
            if (parseResult.status === 'success' && parseResult.taskMap) {
                engine = createWorkflowEngine(parseResult.taskMap);
                console.log(`[Agency V2] Product Planner created task map: "${parseResult.taskMap.title}"`);
                const startMsg = createSystemMessage(`**🎯 Plan Created: "${parseResult.taskMap.title}"**\n\nStarting execution...`);
                onNewMessage(startMsg);
            } else {
                console.error('[Agency V2] Product Planner did not create a valid task map');
                onAgentChange(null);
                return { updatedTaskState: null };
            }
        } catch (error: any) {
            console.error('[Agency V2] Product Planner failed:', error);
            const errorMsg = createSystemMessage(`**❌ Planning Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            onAgentChange(null);
            return { updatedTaskState: null };
        }
    }

    // FIX: Check for infinite loop - too many consecutive agent turns without user input
    // Check the last N messages. If they are ALL from agents, STOP.
    const lastMessages = messages.slice(-MAX_CONSECUTIVE_AUTO_TURNS);
    const allAgents = lastMessages.every(m => typeof m.author !== 'string');

    if (lastMessages.length >= MAX_CONSECUTIVE_AUTO_TURNS && allAgents) {
        const stopMsg = createSystemMessage(`🛑 **Safety Stop**: Maximum consecutive agent turns (${MAX_CONSECUTIVE_AUTO_TURNS}) reached. Pausing for user input.`);
        onNewMessage(stopMsg);
        return { updatedTaskState: engine.getState() }; // Return without advancing
    }

    // Check if workflow is complete or paused
    if (engine.isComplete() || engine.isPaused()) {
        return { updatedTaskState: engine.getState() };
    }

    // Get current task and stage from engine
    const currentTask = engine.getCurrentTask();
    const currentStage = engine.getCurrentStage();

    if (!currentTask || !currentStage) {
        console.error('[Agency V2] Invalid workflow state');
        engine.recordFailure('No current task or stage');
        return { updatedTaskState: engine.getState() };
    }

    const progress = engine.getProgressSummary();
    console.log(`[Agency V2] Executing task ${progress.currentTask}, stage ${progress.currentStage}`);

    // Build agent names for progress message
    const stageAgentNames = currentStage.agents.map(a => {
        const agent = AGENT_PROFILES.find(p => {
            const identifier = p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            return identifier === a.agent;
        });
        return agent?.name || a.agent;
    }).join(', ');

    // Create improved progress message using engine's progress summary
    const stageMsg = createSystemMessage(
        `**Task ${progress.currentTask}/${progress.totalTasks} • Stage ${progress.currentStage}/${progress.totalStages}** (${stageAgentNames}): ${currentStage.objective}`
    );
    onNewMessage(stageMsg);

    // Execute stage based on number of agents (sequential vs parallel)
    if (currentStage.agents.length === 1) {
        // Sequential: Single agent execution
        const stageAgentDef = currentStage.agents[0];

        // FIX: Robust lookup with fallback
        let stageAgent = AGENT_PROFILES.find(a => {
            const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            return identifier === stageAgentDef.agent;
        });

        if (!stageAgent) {
            console.error(`[Agency V2] Critical: Agent '${stageAgentDef.agent}' not found in registry.`);

            // Fallback to Builder if specific agent is missing
            const fallbackAgent = AGENT_PROFILES.find(a => a.id === 'agent-builder-001');

            if (fallbackAgent) {
                const warningMsg = createSystemMessage(`⚠️ **Warning**: Agent '${stageAgentDef.agent}' not found. Falling back to Builder.`);
                onNewMessage(warningMsg);
                stageAgent = fallbackAgent;
            } else {
                const errorMsg = createSystemMessage(`**❌ Error**: Agent "${stageAgentDef.agent}" not found and no fallback available`, true);
                onNewMessage(errorMsg);
                engine.recordFailure(`Agent not found: ${stageAgentDef.agent}`);
                return { updatedTaskState: engine.getState() };
            }
        }

        // Build smart context for this stage (automatically optimized based on stage type)
        // This reduces token usage by 40-60% per stage by filtering irrelevant conversation history
        const conversationContents = buildSmartContext(engine, currentHistory, codebaseContext);

        // Log token savings (dev mode only)
        if (process.env.NODE_ENV === 'development') {
            const fullContext = buildConversationContents(currentHistory, codebaseContext);
            const fullTokens = fullContext.reduce((sum, c) => sum + c.parts[0].text.length / 4, 0);
            const smartTokens = conversationContents.reduce((sum, c) => sum + c.parts[0].text.length / 4, 0);
            const savings = fullTokens - smartTokens;
            const savingsPercent = fullTokens > 0 ? (savings / fullTokens) * 100 : 0;
            console.log(`[SmartContext] Stage: ${currentStage.stageName} | Tokens: ${Math.round(smartTokens)} (saved ${Math.round(savings)} / ${savingsPercent.toFixed(1)}%)`);
        }

        // Execute agent with streaming
        const streamConfig: any = {
            systemInstruction: stageAgent.prompt,
            safetySettings: SAFETY_SETTINGS,
        };

        if (stageAgent.thinkingBudget) {
            streamConfig.thinking_config = {
                include_thoughts: true,
                budget_tokens: stageAgent.thinkingBudget
            };
        }

        try {
            onAgentChange(stageAgent.id);

            let agentResponse = '';

            // Rate limiting now handled internally by AgentExecutor
            await executor.executeStreaming(
                stageAgent,
                currentStage.agents[0].model,
                conversationContents,
                streamConfig,
                (chunk) => {
                    onMessageUpdate(chunk);
                    agentResponse += chunk;
                }
            );

            // Parse proposed changes if any
            const { proposedChanges, cleanedText } = parseProposedChanges(agentResponse);

            const agentMessage: Message = {
                id: crypto.randomUUID(),
                author: stageAgent,
                content: cleanedText,
                timestamp: new Date(),
                proposedChanges: proposedChanges || undefined,
            };
            onNewMessage(agentMessage);
            currentHistory.push(agentMessage);

            // Clear feedback after SYNTHESIZE stage
            if (engine.isSynthesizeStage()) {
                engine.clearFeedback();
            }

        } catch (error: any) {
            console.error(`[Agency V2] Stage execution failed:`, error);
            engine.recordFailure(error.message);
            const errorMsg = createSystemMessage(`**❌ Stage Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            return { updatedTaskState: engine.getState() };
        }

    } else {
        // Parallel: Multiple agents in CODE_REVIEW or PLAN_REVIEW
        console.log(`[Agency V2] Executing ${currentStage.agents.length} agents in parallel`);

        // Check abort signal before starting parallel execution
        if (abortSignal?.aborted) {
            const error = new Error('Operation aborted by user');
            error.name = 'AbortError';
            throw error;
        }

        // Announce parallel execution start
        const agentNames = currentStage.agents.map(a => {
            const agent = AGENT_PROFILES.find(p => {
                const identifier = p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                return identifier === a.agent;
            });
            return agent?.name || a.agent;
        }).join(', ');
        const startMsg = createSystemMessage(`🚀 **Starting Parallel Review** with ${currentStage.agents.length} agents: ${agentNames}`);
        onNewMessage(startMsg);

        // Build smart context for parallel review (optimized for CODE_REVIEW stage)
        const conversationContents = buildSmartContext(engine, currentHistory, codebaseContext);

        // Log token savings (dev mode only)
        if (process.env.NODE_ENV === 'development') {
            const fullContext = buildConversationContents(currentHistory, codebaseContext);
            const fullTokens = fullContext.reduce((sum, c) => sum + c.parts[0].text.length / 4, 0);
            const smartTokens = conversationContents.reduce((sum, c) => sum + c.parts[0].text.length / 4, 0);
            const savings = fullTokens - smartTokens;
            const savingsPercent = fullTokens > 0 ? (savings / fullTokens) * 100 : 0;
            console.log(`[SmartContext] Stage: ${currentStage.stageName} | Tokens: ${Math.round(smartTokens)} (saved ${Math.round(savings)} / ${savingsPercent.toFixed(1)}%)`);
        }

        // FIX: Find all agents for parallel execution with validation
        const stageAgents: Agent[] = [];
        const missingAgents: string[] = [];

        for (const stageAgentDef of currentStage.agents) {
            const agent = AGENT_PROFILES.find(a => {
                const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                return identifier === stageAgentDef.agent;
            });

            if (!agent) {
                console.error(`[Agency V2] Agent not found in parallel stage: ${stageAgentDef.agent}`);
                missingAgents.push(stageAgentDef.agent);
            } else {
                stageAgents.push(agent);
            }
        }

        // If some agents are missing, warn but continue with available agents
        if (missingAgents.length > 0) {
            const warningMsg = createSystemMessage(`⚠️ **Warning**: Some agents not found: ${missingAgents.join(', ')}. Continuing with ${stageAgents.length} available agents.`);
            onNewMessage(warningMsg);
        }

        // If ALL agents are missing, fail the stage
        if (stageAgents.length === 0) {
            const errorMsg = createSystemMessage(`**❌ Error**: No valid agents found for parallel stage`, true);
            onNewMessage(errorMsg);
            engine.recordFailure('No valid agents found for parallel stage');
            return { updatedTaskState: engine.getState() };
        }

        // Build config for parallel execution
        const parallelConfig: any = {
            systemInstruction: stageAgents[0].prompt, // Will be overridden per agent
            safetySettings: SAFETY_SETTINGS,
        };

        try {
            // Execute all agents in parallel
            // Rate limiter (now internal to AgentExecutor) handles both rate limiting AND concurrency control
            const parallelPromises = stageAgents.map(async (agent, index) => {
                const stageAgentDef = currentStage.agents[index];

                // Rate limiting now handled internally by AgentExecutor
                try {
                    const agentConfig: any = {
                        systemInstruction: agent.prompt,
                        safetySettings: SAFETY_SETTINGS,
                    };

                    if (agent.thinkingBudget) {
                        agentConfig.thinking_config = {
                            include_thoughts: true,
                            budget_tokens: agent.thinkingBudget
                        };
                    }

                    console.log(`[Agency V2] Executing ${agent.name}...`);
                    const result = await executor.executeNonStreaming(
                        agent,
                        stageAgentDef.model,
                        conversationContents,
                        agentConfig
                    );

                    return {
                        success: true,
                        agentName: agent.name,
                        content: result.content,
                        agent
                    };
                } catch (innerError: any) {
                    console.error(`[Agency V2] Agent ${agent.name} failed:`, innerError);
                    return {
                        success: false,
                        agentName: agent.name,
                        error: innerError.message,
                        agent
                    };
                }
            });

            const rawResults = await Promise.all(parallelPromises);

            // Filter out failures but keep successes
            const successfulResults = rawResults.filter(r => r.success) as Array<{
                success: true;
                agentName: string;
                content: string;
                agent: Agent;
            }>;

            const failedResults = rawResults.filter(r => !r.success);

            // If EVERYONE failed, then throw
            if (successfulResults.length === 0 && failedResults.length > 0) {
                throw new Error(`All agents failed. Last error: ${failedResults[0].error}`);
            }

            // Report partial failures if any
            if (failedResults.length > 0) {
                const failedNames = failedResults.map(r => r.agentName).join(', ');
                const warningMsg = createSystemMessage(`⚠️ **Partial Failure**: Agents failed: ${failedNames}. Continuing with available results.`);
                onNewMessage(warningMsg);
            }

            const results = successfulResults;

            // Collect feedback using engine
            results.forEach(r => {
                engine.addFeedback(r.agentName, r.content);
            });

            // Display each agent's feedback as a message
            for (const result of results) {
                // Parse proposed changes if any
                const { proposedChanges, cleanedText } = parseProposedChanges(result.content);

                const agentMessage: Message = {
                    id: crypto.randomUUID(),
                    author: result.agent,
                    content: cleanedText,
                    timestamp: new Date(),
                    proposedChanges: proposedChanges || undefined,
                };
                onNewMessage(agentMessage);
                currentHistory.push(agentMessage);
            }

            console.log(`[Agency V2] Collected ${engine.getCollectedFeedback().length} reviews`);

            // Add completion summary with attribution
            const contributors = results.map(r => r.agentName).join(', ');
            const summaryMsg = createSystemMessage(`✅ **Parallel Review Complete**: ${contributors} provided feedback`);
            onNewMessage(summaryMsg);

        } catch (error: any) {
            console.error(`[Agency V2] Parallel stage failed:`, error);
            engine.recordFailure(error.message);
            const errorMsg = createSystemMessage(`**❌ Parallel Stage Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            return { updatedTaskState: engine.getState() };
        }
    }

    // Rate limiter automatically handles pacing between stages
    // No manual delays needed - the limiter queues requests intelligently

    // Advance to next stage using engine
    const hasMoreWork = engine.advanceToNextStage();

    // Check if workflow is complete
    if (engine.isComplete()) {
        const completeMsg = createSystemMessage(`**✅ Plan Complete**: "${engine.getState().taskMap.title}" finished successfully!`);
        onNewMessage(completeMsg);
        onAgentChange(null);
        return { updatedTaskState: engine.getState() };
    }

    // Check if workflow is paused for approval
    if (engine.isPaused()) {
        const pauseMsg = createSystemMessage(`**⏸️ Paused for Approval**: Review the plan before proceeding to implementation.`);
        onNewMessage(pauseMsg);
        onAgentChange(null);
        return { updatedTaskState: engine.getState() };
    }

    // Return updated state for persistence
    onAgentChange(null);
    return { updatedTaskState: engine.getState() };
};


/**
 * Main entry point for agent responses
 * Routes between Agency V2 (multi-stage workflow) and V1 (turn-based orchestration)
 */
export const getAgentResponse = async (
    apiKey: string,
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    if (!apiKey || !apiKey.trim()) {
        throw new Error("Gemini API key is missing. Please check your Settings or Project Settings.");
    }

    // Trim the key in case there's whitespace
    const trimmedKey = apiKey.trim();
    console.log('[DEBUG] Creating GoogleGenAI instance with key length:', trimmedKey.length);

    const ai = new GoogleGenAI({ apiKey: trimmedKey });

    // ========================================================================
    // AGENCY V2 WORKFLOW (Multi-stage, stateful task execution)
    // ========================================================================
    console.log('[Routing] Using Agency V2 Workflow');
    console.log('[DEBUG] About to call executeAgencyV2Workflow');
    console.log('[DEBUG] messages length:', messages.length);
    console.log('[DEBUG] codebaseContext length:', codebaseContext.length);
    console.log('[DEBUG] activeTaskState:', activeTaskState);

    try {
        const result = await executeAgencyV2Workflow(
            ai,
            messages,
            codebaseContext,
            onNewMessage,
            onMessageUpdate,
            onAgentChange,
            abortSignal,
            activeTaskState
        );
        console.log('[DEBUG] executeAgencyV2Workflow returned:', result);
        return result;
    } catch (error) {
        console.error('[DEBUG] executeAgencyV2Workflow threw error:', error);
        throw error;
    }
};