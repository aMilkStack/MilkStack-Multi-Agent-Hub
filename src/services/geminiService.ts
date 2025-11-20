import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER, MAX_RETRIES, INITIAL_BACKOFF_MS } from '../../constants';
import { loadSettings } from './indexedDbService';
import { rustyLogger, LogLevel } from './rustyPortableService';

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
  // Priority 1: Markdown code blocks (most explicit)
  const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const markdownMatch = text.match(markdownJsonRegex);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // Priority 2: Standalone JSON on its own line (prevents capturing "{...} extra text")
  const standaloneJsonRegex = /^\s*(\{[\s\S]*?\})\s*$/m;
  const standaloneMatch = text.match(standaloneJsonRegex);
  if (standaloneMatch) {
    // Validate it's actually valid JSON before returning
    try {
      JSON.parse(standaloneMatch[1]);
      return standaloneMatch[1].trim();
    } catch {
      // Not valid JSON, fall through to next attempt
    }
  }

  // Priority 3: Extract first complete JSON object and validate
  // Use a more conservative regex that matches balanced braces
  const conservativeJsonRegex = /\{(?:[^{}]|\{[^{}]*\})*\}/;
  const conservativeMatch = text.match(conservativeJsonRegex);
  if (conservativeMatch) {
    try {
      JSON.parse(conservativeMatch[0]);
      return conservativeMatch[0].trim();
    } catch {
      // Not valid JSON
    }
  }

  return null;
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

    for (const msg of messages) {
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

export const getAgentResponse = async (
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    apiKey?: string,
    abortSignal?: AbortSignal
): Promise<void> => {
    const settings = await loadSettings();
    const model: GeminiModel = settings?.model || 'gemini-3-pro-preview';
    const key = apiKey || settings?.apiKey;

    if (!key) {
      throw new Error("Gemini API key is not configured. Please add your API key in Settings (Cmd/Ctrl+S).");
    }

    const ai = new GoogleGenAI({ apiKey: key });

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
            const sanitizedContents = buildConversationContents(sanitizedHistory, codebaseContext);
            console.log(`[Orchestrator] Sanitized: ${currentHistory.length} → ${sanitizedHistory.length} messages`);

            let orchestratorResponse;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const orchestratorConfig: any = {
                        systemInstruction: orchestrator.prompt,
                        temperature: 0.0,
                    };

                    // Add thinking config if agent has thinking budget
                    if (orchestrator.thinkingBudget) {
                        orchestratorConfig.thinking_config = {
                            include_thoughts: true,
                            budget_tokens: orchestrator.thinkingBudget
                        };
                    }

                    orchestratorResponse = await ai.models.generateContent({
                        model: orchestratorModel,
                        contents: sanitizedContents,
                        config: orchestratorConfig
                    });

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
                };
                onNewMessage(uncertaintyMessage);
                break;
            }

            // DEBUG: Log the ACTUAL orchestrator response
            console.log('🔍 [DEBUG] ORCHESTRATOR RAW RESPONSE:', responseText);
            console.log('🔍 [DEBUG] Response length:', responseText.length);

            const orchestratorDecision = parseOrchestratorResponse(responseText);

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
                                };

                                // Add thinking config if agent has thinking budget
                                if (agent.thinkingBudget) {
                                    parallelConfig.thinking_config = {
                                        include_thoughts: true,
                                        budget_tokens: agent.thinkingBudget
                                    };
                                }

                                const response = await ai.models.generateContent({
                                    model: 'gemini-3-pro-preview', // Always use pro for specialists
                                    contents: conversationContents,
                                    config: parallelConfig
                                });

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

            if (decision === 'orchestrator-parse-error') {
                console.error('[Orchestrator] Failed to extract valid JSON even after robust parsing.');
                console.error('[Orchestrator] Raw response:', responseText);

                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Parse Error

The orchestrator returned a response that couldn't be parsed as valid JSON.

**Raw Response:**
\`\`\`
${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}
\`\`\`

**Root Cause**: The orchestrator violated its directive to return ONLY JSON. This is a model hallucination issue.

**Action**: This is logged for debugging. The system will wait for your next instruction.`,
                    timestamp: new Date(),
                };
                onNewMessage(errorMessage);
                break;
            }

            if (decision === 'orchestrator-uncertain') {
                console.warn('[Orchestrator] Orchestrator reported uncertainty. Waiting for user clarification.');
                const uncertaintyMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Uncertainty\n\nThe orchestrator could not confidently determine the next step from the conversation history.\n\n**This usually means:**\n- The conversation is ambiguous or contradictory\n- The context is too complex for a clear routing decision\n- The orchestrator needs more information\n\n**Action**: Please clarify your request or provide more context.`,
                    timestamp: new Date(),
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
                };
                onNewMessage(errorMessage);
                break;
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
                };

                // Add thinking config if agent has thinking budget
                if (nextAgent.thinkingBudget) {
                    streamConfig.thinking_config = {
                        include_thoughts: true,
                        budget_tokens: nextAgent.thinkingBudget
                    };
                }

                const stream = await ai.models.generateContentStream({
                    model: recommendedModel,
                    contents: conversationContents,
                    config: streamConfig
                });

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
};