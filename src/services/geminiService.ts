import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges, TaskMap, ActiveTaskState } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER, MAX_RETRIES, INITIAL_BACKOFF_MS } from '../../constants';
import { loadSettings } from './indexedDbService';
import { rustyLogger, LogLevel } from './rustyPortableService';
import { TaskParser } from './taskParser';
import { WorkflowEngine, createWorkflowEngine, restoreWorkflowEngine } from './workflowEngine';

/**
 * Safety settings to disable Gemini's content filters.
 * Required because agents like "Adversarial Thinker" use security terminology
 * that triggers DANGEROUS_CONTENT blocks.
 */
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Helper function to call Gemini API with automatic fallback from gemini-3-pro-preview to gemini-2.5-pro
 * if the preview model fails with model-not-found errors.
 */
const callGeminiWithFallback = async (
    ai: GoogleGenAI,
    model: GeminiModel,
    contents: any,
    config: any,
    streaming: boolean = false
): Promise<any> => {
    let currentModel = model;

    try {
        if (streaming) {
            return await ai.models.generateContentStream({
                model: currentModel,
                contents,
                config
            });
        } else {
            return await ai.models.generateContent({
                model: currentModel,
                contents,
                config
            });
        }
    } catch (error: any) {
        // Check if error is model-not-found or model-not-available
        const isModelUnavailable =
            error.message?.includes('model') &&
            (error.message?.includes('not found') ||
             error.message?.includes('not available') ||
             error.message?.includes('does not exist') ||
             error.status === 404);

        // If gemini-3-pro-preview fails and we haven't already fallen back, try gemini-2.5-pro
        if (isModelUnavailable && currentModel === 'gemini-3-pro-preview') {
            console.warn(`[Model Fallback] gemini-3-pro-preview not available, falling back to gemini-2.5-pro`);
            rustyLogger.log(LogLevel.WARN, 'Model Fallback', 'Falling back from gemini-3-pro-preview to gemini-2.5-pro', {
                originalError: error.message
            });

            currentModel = 'gemini-2.5-pro';

            if (streaming) {
                return await ai.models.generateContentStream({
                    model: currentModel,
                    contents,
                    config
                });
            } else {
                return await ai.models.generateContent({
                    model: currentModel,
                    contents,
                    config
                });
            }
        }

        // If it's not a model unavailable error, or we're already on fallback, rethrow
        throw error;
    }
};

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
    return { agent: 'WAIT_FOR_USER', model: 'gemini-3-pro-preview', parallel: false };
  }

  // Check for orchestrator-uncertain
  if (/orchestrator-uncertain/i.test(responseText)) {
    return { agent: 'orchestrator-uncertain', model: 'gemini-3-pro-preview', parallel: false };
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
    // Default to flash model for resilient parsing
    return { agent: lastMatch.identifier, model: 'gemini-3-pro-preview', parallel: false };
  }

  // FALLBACK: No agent found
  console.error(`[Orchestrator] No valid agent identifier found in response: "${responseText}"`);
  return { agent: 'orchestrator-parse-error', model: 'gemini-3-pro-preview', parallel: false };
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

const buildConversationContents = (messages: Message[], codebaseContext: string): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> => {
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // RUSTY'S FIX V2: Preserve original context while pruning middle messages
    // In V2 workflows, the first messages contain the user's intent and Product Planner's task map
    // We must preserve these even in long conversations to maintain workflow coherence
    const MAX_HISTORY_MESSAGES = 30;
    const HEAD_MESSAGES_TO_KEEP = 3; // Keep first 3 messages (user intent + planner response)

    let prunedMessages: Message[];
    if (messages.length > MAX_HISTORY_MESSAGES) {
        // Keep head (original context) + tail (recent messages)
        const head = messages.slice(0, HEAD_MESSAGES_TO_KEEP);
        const tail = messages.slice(-(MAX_HISTORY_MESSAGES - HEAD_MESSAGES_TO_KEEP));
        prunedMessages = [...head, ...tail];
    } else {
        prunedMessages = messages;
    }

    // Use full codebase context without truncation (Pro model supports 1M tokens)
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

    for (const msg of prunedMessages) {
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
    let currentHistory = [...messages];
    let engine: WorkflowEngine | null = null;

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

    // No active workflow
    if (!engine) {
        return { updatedTaskState: null };
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
            const stageAgent = AGENT_PROFILES.find(a => {
                const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                return identifier === currentStage.agents[0].agent;
            });

            if (!stageAgent) {
                const errorMsg = createSystemMessage(`**❌ Error**: Agent "${currentStage.agents[0].agent}" not found`, true);
                onNewMessage(errorMsg);
                engine.recordFailure(`Agent not found: ${currentStage.agents[0].agent}`);
                return { updatedTaskState: engine.getState() };
            }

            // Build context for this stage (include collected feedback if this is a SYNTHESIZE stage)
            const conversationContents = buildConversationContents(currentHistory, codebaseContext);

            if (engine.isSynthesizeStage() && engine.getCollectedFeedback().length > 0) {
                // Inject feedback into context
                const feedbackText = engine.getCollectedFeedback()
                    .map(f => `**${f.agentName} Review:**\n${f.content}`)
                    .join('\n\n---\n\n');
                conversationContents.push({
                    role: 'user',
                    parts: [{ text: `**Collected Feedback from Previous Stage:**\n\n${feedbackText}\n\nPlease synthesize this feedback and provide your analysis.` }]
                });
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
                const stream = await callGeminiWithFallback(
                    ai,
                    currentStage.agents[0].model,
                    conversationContents,
                    streamConfig,
                    true
                );

                let agentResponse = '';
                for await (const chunk of stream) {
                    if (abortSignal?.aborted) {
                        const error = new Error('Operation aborted by user');
                        error.name = 'AbortError';
                        throw error;
                    }
                    const chunkText = chunk.text;
                    if (chunkText) {
                        onMessageUpdate(chunkText);
                        agentResponse += chunkText;
                    }
                }

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

            const conversationContents = buildConversationContents(currentHistory, codebaseContext);
            const parallelPromises = currentStage.agents.map(async (stageAgentDef) => {
                // Check abort signal at start of each agent
                if (abortSignal?.aborted) {
                    throw new Error('Operation aborted by user');
                }

                const agent = AGENT_PROFILES.find(a => {
                    const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                    return identifier === stageAgentDef.agent;
                });

                if (!agent) {
                    throw new Error(`Agent not found: ${stageAgentDef.agent}`);
                }

                const parallelConfig: any = {
                    systemInstruction: agent.prompt,
                    safetySettings: SAFETY_SETTINGS,
                };

                if (agent.thinkingBudget) {
                    parallelConfig.thinking_config = {
                        include_thoughts: true,
                        budget_tokens: agent.thinkingBudget
                    };
                }

                const response = await callGeminiWithFallback(
                    ai,
                    stageAgentDef.model,
                    conversationContents,
                    parallelConfig,
                    false
                );

                // Check abort signal after API call
                if (abortSignal?.aborted) {
                    throw new Error('Operation aborted by user');
                }

                let responseText = response.response?.text?.() || response.candidates?.[0]?.content?.parts?.[0]?.text || '';

                return {
                    agentName: agent.name,
                    content: responseText,
                    agent
                };
            });

            try {
                const results = await Promise.all(parallelPromises);

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
 * Execute V1 Orchestration (Original single-turn delegation)
 * Legacy orchestration system using turn-based agent delegation
 */
const executeV1Orchestration = async (
    ai: GoogleGenAI,
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    // CIRCUIT BREAKER: Stop if we hit too many 503s in a row
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    let currentHistory = [...messages];

    const orchestrator = AGENT_PROFILES.find(p => p.name === 'Orchestrator');
    if (!orchestrator) {
        throw new Error("Critical: Orchestrator agent profile not found.");
    }

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        // Check circuit breaker
        if (consecutiveErrors >= maxConsecutiveErrors) {
            const circuitBreakerMessage: Message = {
                id: crypto.randomUUID(),
                author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                content: `## Circuit Breaker Triggered\n\nHit ${maxConsecutiveErrors} consecutive API errors. Stopping to prevent quota burn.\n\n**Possible causes:**\n- API quota exceeded\n- Server overload\n- Network issues\n\n**Action**: Wait 60 seconds and try again.`,
                timestamp: new Date(),
                isError: true,
            };
            onNewMessage(circuitBreakerMessage);
            break;
        }

        if (abortSignal?.aborted) {
            const error = new Error('Operation aborted by user');
            error.name = 'AbortError';
            throw error;
        }

        const conversationContents = buildConversationContents(currentHistory, codebaseContext);

        const roleSequence = conversationContents.map(c => c.role).join(' → ');
        const totalChars = conversationContents.reduce((sum, c) => sum + c.parts[0].text.length, 0);
        const estimatedTokens = Math.round(totalChars / 4);
        console.log(`[Gemini API] Turn ${turn}: Sending ${conversationContents.length} messages (${roleSequence})`);
        console.log(`[Gemini API] Size: ${totalChars} chars ≈ ${estimatedTokens} tokens`);

        const lastMessage = currentHistory[currentHistory.length - 1];
        let nextAgent: Agent | undefined;

        if (lastMessage && typeof lastMessage.author !== 'string') {
            const mentionedAgentId = detectAgentMention(lastMessage.content);
            if (mentionedAgentId) {
                nextAgent = findAgentByIdentifier(mentionedAgentId);
                console.log(`Direct mention detected: ${lastMessage.author.name} → ${nextAgent?.name}`);

                // Prevent orchestrator from being selected as a regular agent
                if (nextAgent?.name === 'Orchestrator') {
                    console.warn('[Orchestrator] Direct mention of Orchestrator detected. Ignoring and using orchestrator routing instead.');
                    nextAgent = undefined;
                }
            }
        }

        let recommendedModel: GeminiModel = 'gemini-3-pro-preview';

        if (!nextAgent) {
            // Always use gemini-3-pro-preview (higher limits)
            const orchestratorModel: GeminiModel = 'gemini-3-pro-preview';

            onAgentChange(orchestrator.id);
            console.log(`[Orchestrator] Using ${orchestratorModel} for routing decision`);
            rustyLogger.trackApiRequest(orchestratorModel);

            // CRITICAL: Sanitize history to prevent context pollution from diagnostic agents
            console.log('[Orchestrator] Building sanitized context (removing diagnostic messages)...');
            const sanitizedHistory = buildSanitizedHistoryForOrchestrator(currentHistory);
            // Pass empty codebase context to orchestrator to prevent 169k token bloat
            const sanitizedContents = buildConversationContents(sanitizedHistory, '');
            console.log(`[Orchestrator] Sanitized: ${currentHistory.length} → ${sanitizedHistory.length} messages`);

            let orchestratorResponse;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const orchestratorConfig: any = {
                        systemInstruction: orchestrator.prompt,
                        temperature: 0.0,
                        safetySettings: SAFETY_SETTINGS,
                    };

                    // Add thinking config if agent has thinking budget
                    if (orchestrator.thinkingBudget) {
                        orchestratorConfig.thinking_config = {
                            include_thoughts: true,
                            budget_tokens: orchestrator.thinkingBudget
                        };
                    }

                    orchestratorResponse = await callGeminiWithFallback(
                        ai,
                        orchestratorModel,
                        sanitizedContents,
                        orchestratorConfig,
                        false
                    );

                    let testText = (orchestratorResponse as any)?.response?.text?.();
                    if (!testText) {
                        testText = orchestratorResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
                    }

                    if (!testText) {
                        console.error('[Orchestrator] Empty response object:', JSON.stringify(orchestratorResponse, null, 2));
                        throw new Error('API returned empty response (no text content)');
                    }

                    // Success - reset error counter and break
                    consecutiveErrors = 0;
                    break;
                } catch (error: any) {
                    consecutiveErrors++;
                    lastError = error;
                    const isTransientError =
                        error.message?.includes('503') ||
                        error.message?.includes('overloaded') ||
                        error.message?.includes('429') ||
                        error.message?.includes('rate limit');

                    if (isTransientError && attempt < MAX_RETRIES) {
                        // Exponential backoff with jitter to prevent thundering herd
                        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                        const jitter = (Math.random() - 0.5) * 1000; // ±500ms jitter
                        const delayMs = Math.max(0, backoffTime + jitter);
                        console.warn(`[Orchestrator] Transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${Math.round(delayMs / 1000)}s...`, error.message);
                        rustyLogger.log(LogLevel.WARN, 'Orchestrator', `Retrying after transient error`, { attempt: attempt + 1, delayMs, error: error.message });
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        throw error;
                    }
                }
            }

            if (!orchestratorResponse) {
                throw new Error(`Orchestrator failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}`);
            }

            let responseText = (orchestratorResponse as any)?.response?.text?.();
            if (!responseText) {
                responseText = orchestratorResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
            }

            if (!responseText || responseText.trim().length === 0) {
                console.warn('[Orchestrator] API returned empty response. Treating as uncertainty.');
                const uncertaintyMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Uncertainty\n\nThe orchestrator returned an empty response, indicating it could not determine the next step.\n\n**This usually means:**\n- The conversation context is too ambiguous\n- The orchestrator needs more information\n- The context window may be too large or complex\n\n**Action**: Please clarify your request or try breaking it into smaller steps.`,
                    timestamp: new Date(),
                    isError: true,
                };
                onNewMessage(uncertaintyMessage);
                break;
            }

            // DEBUG: Log the ACTUAL orchestrator response
            console.log('🔍 [DEBUG] ORCHESTRATOR RAW RESPONSE:', responseText);
            console.log('🔍 [DEBUG] Response length:', responseText.length);

            let orchestratorDecision = parseOrchestratorResponse(responseText);

            // SELF-HEALING: If parse failed, attempt recovery with Parse Error Handler
            if ('agent' in orchestratorDecision && orchestratorDecision.agent === 'orchestrator-parse-error') {
                console.error('[Orchestrator] Parse error detected. Attempting recovery with Parse Error Handler...');
                rustyLogger.log(LogLevel.WARN, 'Orchestrator', 'Parse error, invoking recovery agent', {
                    rawResponse: responseText.substring(0, 500)
                });

                const recoveryAgent = AGENT_PROFILES.find(a => a.id === 'agent-orchestrator-parse-error-handler-001');

                if (recoveryAgent) {
                    try {
                        const recoveryContents = [{
                            role: 'user' as const,
                            parts: [{ text: responseText }]
                        }];

                        const recoveryConfig: any = {
                            systemInstruction: recoveryAgent.prompt,
                            temperature: 0.0,
                            safetySettings: SAFETY_SETTINGS,
                        };

                        const recoveryResponse = await callGeminiWithFallback(
                            ai,
                            'gemini-3-pro-preview',
                            recoveryContents,
                            recoveryConfig,
                            false
                        );

                        const recoveredText = recoveryResponse.response?.text?.() ||
                                            recoveryResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

                        console.log('[Orchestrator] Recovery agent returned:', recoveredText);
                        rustyLogger.log(LogLevel.INFO, 'Orchestrator', 'Recovery attempt completed', {
                            recoveredText: recoveredText.substring(0, 200)
                        });

                        // Re-parse the recovered text
                        const recoveredDecision = parseOrchestratorResponse(recoveredText);

                        if ('agent' in recoveredDecision && recoveredDecision.agent === 'orchestrator-parse-error') {
                            // Recovery failed
                            console.error('[Orchestrator] ❌ Recovery failed. Parse Error Handler could not repair the response.');
                            rustyLogger.log(LogLevel.ERROR, 'Orchestrator', 'Self-healing failed', {
                                originalResponse: responseText.substring(0, 200),
                                recoveredResponse: recoveredText.substring(0, 200)
                            });

                            const errorMessage: Message = {
                                id: crypto.randomUUID(),
                                author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                                content: `## Orchestrator Critical Failure

The orchestrator returned unparseable output, and the automatic recovery system failed to repair it.

**Original Response:**
\`\`\`
${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}
\`\`\`

**Recovery Attempt:**
\`\`\`
${recoveredText.substring(0, 300)}${recoveredText.length > 300 ? '...' : ''}
\`\`\`

**Root Cause**: The orchestrator violated its directive to return ONLY JSON, and the Parse Error Handler could not extract valid routing instructions.

**Action**: This is a critical system error. Please try rephrasing your request or breaking it into smaller steps.`,
                                timestamp: new Date(),
                                isError: true,
                            };
                            onNewMessage(errorMessage);
                            break;
                        }

                        // Recovery succeeded!
                        console.log('[Orchestrator] ✅ Recovery successful! Continuing with:', recoveredDecision);
                        rustyLogger.log(LogLevel.INFO, 'Orchestrator', 'Self-healing successful', {
                            recoveredAgent: recoveredDecision.parallel ? 'parallel' : recoveredDecision.agent
                        });

                        orchestratorDecision = recoveredDecision;
                    } catch (error: any) {
                        console.error('[Orchestrator] Recovery agent execution failed:', error);
                        rustyLogger.log(LogLevel.ERROR, 'Orchestrator', 'Recovery agent crashed', {
                            error: error.message
                        });

                        const errorMessage: Message = {
                            id: crypto.randomUUID(),
                            author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                            content: `## Orchestrator Parse Error

The orchestrator returned unparseable output and the recovery system crashed.

**Raw Response:**
\`\`\`
${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}
\`\`\`

**Error:** ${error.message}

**Action**: This is logged for debugging. The system will wait for your next instruction.`,
                            timestamp: new Date(),
                            isError: true,
                        };
                        onNewMessage(errorMessage);
                        break;
                    }
                } else {
                    // Recovery agent not found
                    console.error('[Orchestrator] Recovery agent not found in AGENT_PROFILES!');
                    const errorMessage: Message = {
                        id: crypto.randomUUID(),
                        author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                        content: `## Orchestrator Parse Error

The orchestrator returned unparseable output.

**Raw Response:**
\`\`\`
${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}
\`\`\`

**Root Cause**: The orchestrator violated its directive to return ONLY JSON.

**Action**: This is logged for debugging. The system will wait for your next instruction.`,
                        timestamp: new Date(),
                        isError: true,
                    };
                    onNewMessage(errorMessage);
                    break;
                }
            }

            // VALIDATION: Warn if orchestrator violated the "JSON only" directive
            const extractedJson = extractJsonFromText(responseText);
            if (extractedJson && responseText.trim() !== extractedJson.trim()) {
                console.warn('[Orchestrator] ⚠️ WARNING: Response contained non-JSON text. Orchestrator violated directive.');
                console.warn('[Orchestrator] Extra text detected:', responseText.replace(extractedJson, '[JSON_REMOVED]'));
                rustyLogger.log(LogLevel.WARN, 'Orchestrator', 'Non-JSON text in response', {
                    fullResponsePreview: responseText.substring(0, 200)
                });
            }

            // PARALLEL EXECUTION BRANCH
            if (orchestratorDecision.parallel) {
                console.log(`[Orchestrator] 🚀 PARALLEL EXECUTION: ${orchestratorDecision.agents.length} agents simultaneously`);
                rustyLogger.log(
                    LogLevel.INFO,
                    'Orchestrator',
                    `Parallel execution: ${orchestratorDecision.agents.length} agents`,
                    { agents: orchestratorDecision.agents.map(a => a.agent) }
                );

                // Add mandatory 5s delay after orchestrator to prevent rate limiting
                const postOrchestratorDelayMs = 5000;
                console.log(`[Rate Limiting] Waiting 5s after orchestrator before calling agents...`);
                await new Promise(resolve => setTimeout(resolve, postOrchestratorDelayMs));

                const parallelAgents = orchestratorDecision.agents.map(a => {
                    const agent = findAgentByIdentifier(a.agent);
                    if (!agent) {
                        console.error(`[Parallel] Unknown agent: ${a.agent}`);
                        return null;
                    }
                    return { agent, model: a.model };
                }).filter(Boolean) as Array<{ agent: Agent; model: GeminiModel }>;

                if (parallelAgents.length === 0) {
                    console.error('[Parallel] No valid agents found for parallel execution');
                    const errorMessage: Message = {
                        id: crypto.randomUUID(),
                        author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                        content: `## Parallel Execution Error\n\nOrchestrator requested parallel execution but no valid agents were found.`,
                        timestamp: new Date(),
                    };
                    onNewMessage(errorMessage);
                    break;
                }

                console.log(`[Parallel] Executing ${parallelAgents.length} agents: ${parallelAgents.map(p => p.agent.name).join(', ')}`);

                // Execute all agents in parallel with Promise.all
                // 100ms stagger to avoid thundering herd (150 RPM = 2.5 req/sec, plenty of headroom)
                const parallelResults = await Promise.all(
                    parallelAgents.map(async ({ agent, model }, index) => {
                        const agentMessage: Message = {
                            id: crypto.randomUUID(),
                            author: agent,
                            content: '',
                            timestamp: new Date(),
                        };

                        // Stagger requests by 100ms each to avoid thundering herd (150 RPM = plenty of headroom)
                        // First agent: 0ms, second: 100ms, third: 200ms, etc.
                        const staggerDelay = index * 100;
                        if (staggerDelay > 0) {
                            await new Promise(resolve => setTimeout(resolve, staggerDelay));
                        }

                        // Retry loop with exponential backoff (same as sequential)
                        let lastError: Error | null = null;
                        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                            try {
                                console.log(`[Parallel] Starting ${agent.name} (${model}, attempt ${attempt + 1})...`);

                                // Use non-streaming API for parallel execution
                                const parallelConfig: any = {
                                    systemInstruction: agent.prompt,
                                    safetySettings: SAFETY_SETTINGS,
                                };

                                // Add thinking config if agent has thinking budget
                                if (agent.thinkingBudget) {
                                    parallelConfig.thinking_config = {
                                        include_thoughts: true,
                                        budget_tokens: agent.thinkingBudget
                                    };
                                }

                                const response = await callGeminiWithFallback(
                                    ai,
                                    'gemini-3-pro-preview', // Always use pro for specialists
                                    conversationContents,
                                    parallelConfig,
                                    false
                                );

                                let responseText = (response as any)?.response?.text?.();
                                if (!responseText) {
                                    responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
                                }

                                agentMessage.content = responseText || '';
                                console.log(`[Parallel] ✅ ${agent.name} completed (${agentMessage.content.length} chars)`);

                                return agentMessage;
                            } catch (error: any) {
                                lastError = error;
                                const isTransientError =
                                    error.message?.includes('503') ||
                                    error.message?.includes('overloaded') ||
                                    error.message?.includes('429') ||
                                    error.message?.includes('rate limit');

                                if (isTransientError && attempt < MAX_RETRIES) {
                                    const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                                    const jitter = (Math.random() - 0.5) * 1000;
                                    const delayMs = Math.max(0, backoffTime + jitter);
                                    console.warn(`[Parallel] ${agent.name} transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${Math.round(delayMs / 1000)}s...`, error.message);
                                    rustyLogger.log(LogLevel.WARN, 'Parallel', `${agent.name} retrying after transient error`, { attempt: attempt + 1, delayMs, error: error.message });
                                    await new Promise(resolve => setTimeout(resolve, delayMs));
                                } else {
                                    console.error(`[Parallel] ❌ ${agent.name} failed after ${attempt + 1} attempts:`, error.message);
                                    agentMessage.content = `## Error\n\n${agent.name} encountered an error after ${MAX_RETRIES + 1} attempts: ${error.message}`;
                                    return agentMessage;
                                }
                            }
                        }

                        // If we get here, all retries failed
                        agentMessage.content = `## Error\n\n${agent.name} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}`;
                        return agentMessage;
                    })
                );

                // Add all parallel results to conversation history
                for (const message of parallelResults) {
                    onNewMessage(message);
                    currentHistory.push(message);
                }

                console.log(`[Parallel] All ${parallelResults.length} agents completed`);

                // Add delay before next turn
                const delayMs = 5000;
                console.log(`[Rate Limiting] Waiting 5s before next turn...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Continue to next orchestrator turn
                continue;
            }

            // SEQUENTIAL EXECUTION BRANCH (existing code)
            let decision: string;
            let suggestedModel: GeminiModel;

            const sequential = orchestratorDecision as { agent: string; model: GeminiModel; parallel?: false };
            decision = sequential.agent;
            suggestedModel = sequential.model;
            console.log(`[Orchestrator Decision] SEQUENTIAL: ${decision} (${suggestedModel})`);

            rustyLogger.log(
                LogLevel.INFO,
                'Orchestrator',
                `Sequential execution: ${decision}`,
                { agent: decision, model: suggestedModel }
            );

            // Add mandatory 5s delay after orchestrator to prevent rate limiting
            const postOrchestratorDelayMs = 5000;
            console.log(`[Rate Limiting] Waiting 5s after orchestrator before calling next agent...`);
            await new Promise(resolve => setTimeout(resolve, postOrchestratorDelayMs));

            // Always use gemini-3-pro-preview for all specialists (higher limits)
            recommendedModel = 'gemini-3-pro-preview';

            // Note: Parse error recovery now happens before parallel/sequential split (line 829)
            // This ensures recovered decisions can route to either path correctly

            if (decision === 'orchestrator-uncertain') {
                console.warn('[Orchestrator] Orchestrator reported uncertainty. Waiting for user clarification.');
                const uncertaintyMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Uncertainty\n\nThe orchestrator could not confidently determine the next step from the conversation history.\n\n**This usually means:**\n- The conversation is ambiguous or contradictory\n- The context is too complex for a clear routing decision\n- The orchestrator needs more information\n\n**Action**: Please clarify your request or provide more context.`,
                    timestamp: new Date(),
                    isError: true,
                };
                onNewMessage(uncertaintyMessage);
                break;
            }

            if (decision.toUpperCase() === WAIT_FOR_USER) {
                break;
            }

            if (decision === 'continue') {
                continue;
            }

            nextAgent = findAgentByIdentifier(decision);

            if (!nextAgent) {
                console.error(`Orchestrator decided on an unknown agent: '${decision}'. Waiting for user.`);
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `Orchestrator Error: Could not find an agent with the identifier "${decision}".`,
                    timestamp: new Date(),
                    isError: true,
                };
                onNewMessage(errorMessage);
                break;
            }

            // Prevent orchestrator from being selected as a regular agent
            if (nextAgent.name === 'Orchestrator') {
                console.warn('[Orchestrator] Attempted to select Orchestrator as regular agent. Skipping turn.');
                const warningMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Invalid Agent Selection\n\nAn agent attempted to @mention the Orchestrator, but the Orchestrator is an internal routing component and cannot be directly invoked.\n\n**Action**: The conversation will continue with the next appropriate agent.`,
                    timestamp: new Date(),
                    isError: true,
                };
                onNewMessage(warningMessage);
                continue;
            }
        }

        onAgentChange(nextAgent.id);

        const newSpecialistMessage: Message = {
            id: crypto.randomUUID(),
            author: nextAgent,
            content: '',
            timestamp: new Date(),
        };
        onNewMessage(newSpecialistMessage);
        currentHistory.push(newSpecialistMessage);

        rustyLogger.trackApiRequest(recommendedModel);
        console.log(`[Model Selection] ${nextAgent.name} using ${recommendedModel} (higher limits)`);

        // Retry logic for specialist agents with exponential backoff and jitter
        let lastError: Error | null = null;
        let streamCompleted = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const streamConfig: any = {
                    systemInstruction: nextAgent.prompt,
                    safetySettings: SAFETY_SETTINGS,
                };

                // Add thinking config if agent has thinking budget
                if (nextAgent.thinkingBudget) {
                    streamConfig.thinking_config = {
                        include_thoughts: true,
                        budget_tokens: nextAgent.thinkingBudget
                    };
                }

                const stream = await callGeminiWithFallback(
                    ai,
                    recommendedModel,
                    conversationContents,
                    streamConfig,
                    true
                );

                for await (const chunk of stream) {
                    if (abortSignal?.aborted) {
                        const error = new Error('Operation aborted by user');
                        error.name = 'AbortError';
                        throw error;
                    }

                    const chunkText = chunk.text;
                    if (chunkText) {
                        onMessageUpdate(chunkText);
                        newSpecialistMessage.content += chunkText;
                    }
                }

                // Success - reset error counter and break
                consecutiveErrors = 0;
                streamCompleted = true;
                break;
            } catch (error: any) {
                consecutiveErrors++;
                lastError = error;
                const isTransientError =
                    error.message?.includes('503') ||
                    error.message?.includes('overloaded') ||
                    error.message?.includes('429') ||
                    error.message?.includes('rate limit');

                if (isTransientError && attempt < MAX_RETRIES) {
                    // Exponential backoff with jitter to prevent thundering herd
                    const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                    const jitter = (Math.random() - 0.5) * 1000; // ±500ms jitter
                    const delayMs = Math.max(0, backoffTime + jitter);
                    console.warn(`[Specialist] ${nextAgent.name} transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${Math.round(delayMs / 1000)}s...`, error.message);
                    rustyLogger.log(LogLevel.WARN, 'Specialist', `${nextAgent.name} retrying after transient error`, { attempt: attempt + 1, delayMs, error: error.message });
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    // Clear any partial content before retry
                    newSpecialistMessage.content = '';
                } else {
                    console.error(`[Specialist] ${nextAgent.name} failed:`, error);
                    throw error;
                }
            }
        }

        if (!streamCompleted && lastError) {
            throw new Error(`${nextAgent.name} failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
        }

        const { proposedChanges, cleanedText } = parseProposedChanges(newSpecialistMessage.content);
        if (proposedChanges) {
            console.log('[GitHub Integration] Agent proposed code changes:', proposedChanges);
            newSpecialistMessage.proposedChanges = proposedChanges;
            newSpecialistMessage.content = cleanedText;
        }

        const delayMs = 5000;
        console.log(`[Rate Limiting] Waiting 5s before next turn...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    onAgentChange(null);

    // V1 orchestration doesn't use task state, so return null
    return { updatedTaskState: null };
};

/**
 * Main entry point for agent responses
 * Routes between Agency V2 (multi-stage workflow) and V1 (turn-based orchestration)
 */
export const getAgentResponse = async (
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    apiKey?: string,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    const settings = await loadSettings();
    const key = apiKey || settings?.apiKey;

    if (!key) {
        throw new Error("Gemini API key is not configured. Please add your API key in Settings (Cmd/Ctrl+S).");
    }

    const ai = new GoogleGenAI({ apiKey: key });

    // ========================================================================
    // ROUTING LOGIC: Choose between V2 (multi-stage) or V1 (turn-based)
    // ========================================================================

    // Check if we have an active V2 workflow OR if a new task map is present
    const hasActiveV2Workflow = activeTaskState && activeTaskState.status === 'in_progress';
    const lastMessage = messages[messages.length - 1];
    const hasNewTaskMap = lastMessage &&
                         typeof lastMessage.author !== 'string' &&
                         lastMessage.author.id === 'agent-product-planner-001' &&
                         lastMessage.content.includes('```json_task_map');

    if (hasActiveV2Workflow || hasNewTaskMap) {
        // === AGENCY V2 WORKFLOW ===
        // Multi-stage, stateful task execution with parallel/sequential coordination
        console.log('[Routing] Using Agency V2 Workflow');
        return await executeAgencyV2Workflow(
            ai,
            messages,
            codebaseContext,
            onNewMessage,
            onMessageUpdate,
            onAgentChange,
            abortSignal,
            activeTaskState
        );
    } else {
        // === V1 ORCHESTRATION ===
        // Original turn-based agent delegation system
        console.log('[Routing] Using V1 Orchestration');
        return await executeV1Orchestration(
            ai,
            messages,
            codebaseContext,
            onNewMessage,
            onMessageUpdate,
            onAgentChange,
            abortSignal
        );
    }
};