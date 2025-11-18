import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER } from '../../constants';
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
 */
const extractJsonFromText = (text: string): string | null => {
  const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const markdownMatch = text.match(markdownJsonRegex);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  const jsonObjectRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/;
  const objectMatch = text.match(jsonObjectRegex);
  if (objectMatch) {
    return objectMatch[1].trim();
  }

  return null;
};

const parseOrchestratorResponse = (responseText: string):
  | { agent: string; model: GeminiModel; parallel?: false }
  | { parallel: true; agents: Array<{ agent: string; model: GeminiModel }> } => {

  const jsonString = extractJsonFromText(responseText.trim());

  if (!jsonString) {
    console.error(`[Orchestrator] No JSON found in response: "${responseText}"`);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-pro', parallel: false };
  }

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

    console.error(`[Orchestrator] JSON was valid but missing required fields:`, parsed);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-pro', parallel: false };

  } catch (e) {
    console.error(`[Orchestrator] Failed to parse extracted JSON: "${jsonString}"`, e);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-pro', parallel: false };
  }
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

    // LIMIT: Max 50K chars (~12K tokens) to prevent 503s
    if (codebaseContext) {
        const MAX_CONTEXT_CHARS = 50000;
        let contextToUse = codebaseContext;

        if (codebaseContext.length > MAX_CONTEXT_CHARS) {
            console.warn(`[Context] Codebase context too large (${codebaseContext.length} chars), truncating to ${MAX_CONTEXT_CHARS}`);
            contextToUse = codebaseContext.substring(0, MAX_CONTEXT_CHARS) + '\n\n... [Context truncated due to size limits]';
        }

        contents.push({
            role: 'user',
            parts: [{ text: `# Codebase Context\n\`\`\`\n${contextToUse}\n\`\`\`` }]
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

        if (lastContent && lastContent.role === role) {
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
    const model: GeminiModel = settings?.model || 'gemini-2.5-pro';
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

        let recommendedModel: GeminiModel = 'gemini-2.5-pro';

        if (!nextAgent) {
            // Use flash 90% of the time for orchestrator (quota management)
            const orchestratorModel: GeminiModel = Math.random() < 0.9 ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
            
            onAgentChange(orchestrator.id);
            console.log(`[Orchestrator] Using ${orchestratorModel} for routing decision`);
            rustyLogger.trackApiRequest(orchestratorModel);

            // CRITICAL: Sanitize history to prevent context pollution from diagnostic agents
            console.log('[Orchestrator] Building sanitized context (removing diagnostic messages)...');
            const sanitizedHistory = buildSanitizedHistoryForOrchestrator(currentHistory);
            const sanitizedContents = buildConversationContents(sanitizedHistory, codebaseContext);
            console.log(`[Orchestrator] Sanitized: ${currentHistory.length} → ${sanitizedHistory.length} messages`);

            let orchestratorResponse;
            const maxRetries = 3;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    orchestratorResponse = await ai.models.generateContent({
                        model: orchestratorModel,
                        contents: sanitizedContents,
                        config: {
                            systemInstruction: orchestrator.prompt,
                            temperature: 0.0,
                        }
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

                    if (isTransientError && attempt < maxRetries) {
                        const delayMs = Math.pow(2, attempt) * 1000;
                        console.warn(`[Orchestrator] Transient error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delayMs}ms...`, error.message);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        throw error;
                    }
                }
            }

            if (!orchestratorResponse) {
                throw new Error(`Orchestrator failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
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

            if (orchestratorDecision.parallel) {
                const agentNames = orchestratorDecision.agents.map(a => a.agent).join(', ');
                console.log(`[Orchestrator Decision] PARALLEL: [${agentNames}]`);
                rustyLogger.log(
                    LogLevel.INFO,
                    'Orchestrator',
                    `Parallel execution: ${agentNames}`,
                    { agents: orchestratorDecision.agents }
                );
            } else {
                const sequential = orchestratorDecision as { agent: string; model: GeminiModel; parallel?: false };
                console.log(`[Orchestrator Decision] SEQUENTIAL: ${sequential.agent} (${sequential.model})`);
                rustyLogger.log(
                    LogLevel.INFO,
                    'Orchestrator',
                    `Sequential execution: ${sequential.agent}`,
                    { agent: sequential.agent, model: sequential.model }
                );
            }

            // FIXED: Sequential parallel execution with delays
            if (orchestratorDecision.parallel) {
                console.log(`[Parallel Execution] Running ${orchestratorDecision.agents.length} agents with staggered requests`);

                const parallelMessages: (Message | null)[] = [];

                for (let i = 0; i < orchestratorDecision.agents.length; i++) {
                    const { agent: agentId, model } = orchestratorDecision.agents[i];
                    
                    // Add delay between requests (except first)
                    if (i > 0) {
                        const staggerDelayMs = 2000 + Math.random() * 1000;
                        console.log(`[Parallel Rate Limiting] Waiting ${(staggerDelayMs / 1000).toFixed(1)}s before next agent...`);
                        await new Promise(resolve => setTimeout(resolve, staggerDelayMs));
                    }

                    const agent = findAgentByIdentifier(agentId);
                    if (!agent) {
                        console.error(`Unknown agent in parallel execution: ${agentId}`);
                        parallelMessages.push(null);
                        continue;
                    }

                    const message: Message = {
                        id: crypto.randomUUID(),
                        author: agent,
                        content: '',
                        timestamp: new Date(),
                    };

                    try {
                        rustyLogger.trackApiRequest(model);
                        console.log(`[Parallel] Calling ${agent.name} (${model})...`);

                        const response = await ai.models.generateContent({
                            model,
                            contents: conversationContents,
                            config: {
                                systemInstruction: agent.prompt,
                            }
                        });

                        let agentResponseText = (response as any)?.response?.text?.();
                        if (!agentResponseText) {
                            agentResponseText = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
                        }

                        if (!agentResponseText) {
                            console.error(`[Parallel] ${agent.name} returned malformed response:`, response);
                            parallelMessages.push(null);
                            continue;
                        }

                        const { proposedChanges, cleanedText } = parseProposedChanges(agentResponseText);
                        message.content = cleanedText;
                        if (proposedChanges) {
                            console.log(`[GitHub Integration] ${agent.name} proposed code changes in parallel execution`);
                            message.proposedChanges = proposedChanges;
                        }

                        console.log(`[Parallel] ${agent.name} completed (${model})`);
                        consecutiveErrors = 0; // Reset on success
                        parallelMessages.push(message);
                    } catch (error: any) {
                        consecutiveErrors++;
                        console.error(`[Parallel] ${agent.name} failed:`, error);
                        rustyLogger.log(LogLevel.ERROR, 'ParallelExecution', `Agent ${agent.name} failed`, { error: error.message });
                        
                        const errorMsg: Message = {
                            id: crypto.randomUUID(),
                            author: agent,
                            content: `I encountered an error: ${error.message}`,
                            timestamp: new Date(),
                        };
                        parallelMessages.push(errorMsg);
                    }
                }

                for (const message of parallelMessages) {
                    if (message) {
                        onNewMessage(message);
                        currentHistory.push(message);
                    }
                }

                const parallelDelayMs = 5000 + Math.random() * 5000;
                console.log(`[Rate Limiting] Waiting ${(parallelDelayMs / 1000).toFixed(1)}s before next turn...`);
                await new Promise(resolve => setTimeout(resolve, parallelDelayMs));

                continue;
            }

            // Sequential execution
            const sequentialDecision = orchestratorDecision as { agent: string; model: GeminiModel; parallel?: false };
            const { agent: decision, model: suggestedModel } = sequentialDecision;
            recommendedModel = suggestedModel;

            if (decision === 'orchestrator-parse-error') {
                console.error('[Orchestrator] Failed to extract valid JSON even after robust parsing. Stopping.');
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Parse Error\n\nThe orchestrator returned a response that couldn't be parsed.\n\n**Action**: Check console for raw output.`,
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
        console.log(`[Cost-Aware Routing] ${nextAgent.name} using ${recommendedModel} (recommended by orchestrator)`);

        try {
            const stream = await ai.models.generateContentStream({
                model: recommendedModel,
                contents: conversationContents,
                config: {
                    systemInstruction: nextAgent.prompt,
                }
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

            consecutiveErrors = 0; // Reset on success

            const { proposedChanges, cleanedText } = parseProposedChanges(newSpecialistMessage.content);
            if (proposedChanges) {
                console.log('[GitHub Integration] Agent proposed code changes:', proposedChanges);
                newSpecialistMessage.proposedChanges = proposedChanges;
                newSpecialistMessage.content = cleanedText;
            }
        } catch (error: any) {
            consecutiveErrors++;
            console.error(`[Specialist] ${nextAgent.name} failed:`, error);
            throw error;
        }

        const delayMs = 5000 + Math.random() * 5000;
        console.log(`[Rate Limiting] Waiting ${(delayMs / 1000).toFixed(1)}s before next turn...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    onAgentChange(null);
};