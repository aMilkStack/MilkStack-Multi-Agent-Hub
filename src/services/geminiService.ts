import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER } from '../../constants';
import { loadSettings } from './indexedDbService';
import { rustyLogger, LogLevel } from './rustyPortableService';

/**
 * Extracts a JSON object from text that may contain conversational preamble or markdown formatting.
 * Handles common cases like:
 * - "Here's my decision: {...}"
 * - "```json\n{...}\n```"
 * - Pure JSON: "{...}"
 * @param text The raw text that may contain JSON
 * @returns The extracted JSON string or null if not found
 */
const extractJsonFromText = (text: string): string | null => {
  // First, try to find JSON in markdown code blocks
  const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const markdownMatch = text.match(markdownJsonRegex);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // Second, try to find a JSON object or array anywhere in the text
  // This regex looks for { ... } or [ ... ] and captures the content
  const jsonObjectRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/;
  const objectMatch = text.match(jsonObjectRegex);
  if (objectMatch) {
    return objectMatch[1].trim();
  }

  return null;
};

/**
 * Parses the raw text response from the Orchestrator to extract agent and model recommendation.
 * Supports both sequential and parallel execution formats.
 * Robust to conversational text, markdown formatting, and minor JSON issues.
 * @param responseText The raw text from the Gemini model.
 * @returns Object with agent/model OR parallel execution details.
 */
const parseOrchestratorResponse = (responseText: string):
  | { agent: string; model: GeminiModel; parallel?: false }
  | { parallel: true; agents: Array<{ agent: string; model: GeminiModel }> } => {

  // Extract JSON from the response text (handles conversational preamble and markdown)
  const jsonString = extractJsonFromText(responseText.trim());

  if (!jsonString) {
    console.error(`[Orchestrator] No JSON found in response: "${responseText}"`);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-flash', parallel: false };
  }

  try {
    // Parse the extracted JSON
    const parsed = JSON.parse(jsonString);

    // Check for parallel execution format
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

    // Sequential execution format (backward compatible)
    if (parsed.agent && parsed.model) {
      console.log(`[Orchestrator] Parsed sequential format: ${parsed.agent} (${parsed.model})`);
      return {
        agent: parsed.agent.toLowerCase(),
        model: parsed.model as GeminiModel,
        parallel: false
      };
    }

    // JSON was valid but didn't match expected format
    console.error(`[Orchestrator] JSON was valid but missing required fields (agent/model or execution):`, parsed);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-flash', parallel: false };

  } catch (e) {
    console.error(`[Orchestrator] Failed to parse extracted JSON: "${jsonString}"`, e);
    console.error(`[Orchestrator] Original response text: "${responseText}"`);
    return { agent: 'orchestrator-parse-error', model: 'gemini-2.5-flash', parallel: false };
  }
};

/**
 * Detects if a message contains an @mention of another agent.
 * Returns the agent identifier if found, or null if no mention.
 */
const detectAgentMention = (content: string): string | null => {
  // Match @agent-name patterns
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

/**
 * Parses agent response to detect and extract proposed code changes in JSON format.
 * If changes are found, returns them along with the cleaned response text.
 * @param responseText The raw agent response text
 * @returns Object with proposedChanges (if found) and cleanedText
 */
const parseProposedChanges = (responseText: string): {
  proposedChanges: AgentProposedChanges | null;
  cleanedText: string;
} => {
  // Look for JSON code blocks containing proposed_changes
  const jsonBlockPattern = /```json\s*\n?([\s\S]*?)\n?```/g;
  const matches = [...responseText.matchAll(jsonBlockPattern)];

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]);

      // Check if this is a proposed_changes structure
      if (parsed.type === 'proposed_changes' && Array.isArray(parsed.changes)) {
        // Found it! Remove this JSON block from the response text
        const cleanedText = responseText.replace(match[0], '').trim();

        return {
          proposedChanges: parsed as AgentProposedChanges,
          cleanedText
        };
      }
    } catch (e) {
      // Not valid JSON or not the right structure, continue
      continue;
    }
  }

  // No proposed changes found
  return {
    proposedChanges: null,
    cleanedText: responseText
  };
};

/**
 * Finds a specialist agent profile based on its identifier string (e.g., "debug-specialist").
 * @param identifier The kebab-case identifier for the agent.
 * @returns The corresponding Agent object or undefined if not found.
 */
const findAgentByIdentifier = (identifier: string): Agent | undefined => {
    return AGENT_PROFILES.find(agent => {
        const agentIdentifier = agent.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
        return agentIdentifier === identifier;
    });
};

/**
 * Constructs properly formatted Content objects for the Gemini API.
 * This prevents prompt injection and agent identity confusion.
 * @param messages The array of Message objects representing the conversation.
 * @param codebaseContext A string containing the codebase context.
 * @returns Array of Content objects with proper role assignments.
 */
const buildConversationContents = (messages: Message[], codebaseContext: string): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> => {
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add codebase context as the first user message
    if (codebaseContext) {
        contents.push({
            role: 'user',
            parts: [{ text: `# Codebase Context\n\`\`\`\n${codebaseContext}\n\`\`\`` }]
        });
        // Add a model acknowledgment to maintain conversation flow
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand the codebase context. Ready to assist!' }]
        });
    }

    // Convert messages to proper Content objects
    for (const msg of messages) {
        const isUser = typeof msg.author === 'string';
        const role = isUser ? 'user' : 'model';

        contents.push({
            role,
            parts: [{ text: msg.content }]
        });
    }

    return contents;
};


/**
 * The main orchestration function that communicates with the Gemini API.
 * It uses an Orchestrator agent to decide which specialist agent should respond,
 * then gets the response from the specialist in a loop, streaming results via callbacks.
 * @param messages The full conversation history.
 * @param codebaseContext The codebase context string.
 * @param onNewMessage Callback function to create a new, empty agent message in the UI.
 * @param onMessageUpdate Callback function to stream text chunks to the last message.
 * @param onAgentChange Callback function to update the active agent status in the UI.
 * @param apiKey Optional API key to use (defaults to settings).
 * @param abortSignal Optional AbortSignal to cancel the request.
 * @returns A promise that resolves when the orchestration loop is complete.
 */
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
    const model: GeminiModel = settings?.model || 'gemini-2.5-flash';
    const key = apiKey || settings?.apiKey;

    if (!key) {
      throw new Error("Gemini API key is not configured. Please add your API key in Settings (Cmd/Ctrl+S).");
    }

    const ai = new GoogleGenAI({ apiKey: key });

    let currentHistory = [...messages];

    const orchestrator = AGENT_PROFILES.find(p => p.name === 'Orchestrator');
    if (!orchestrator) {
        throw new Error("Critical: Orchestrator agent profile not found.");
    }

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        // Check if operation was aborted
        if (abortSignal?.aborted) {
            const error = new Error('Operation aborted by user');
            error.name = 'AbortError';
            throw error;
        }

        const conversationContents = buildConversationContents(currentHistory, codebaseContext);

        // Check if the last message was from an agent who @mentioned another agent
        const lastMessage = currentHistory[currentHistory.length - 1];
        let nextAgent: Agent | undefined;

        if (lastMessage && typeof lastMessage.author !== 'string') {
            const mentionedAgentId = detectAgentMention(lastMessage.content);
            if (mentionedAgentId) {
                // Direct agent-to-agent conversation! Skip orchestrator
                nextAgent = findAgentByIdentifier(mentionedAgentId);
                console.log(`Direct mention detected: ${lastMessage.author.name} → ${nextAgent?.name}`);
            }
        }

        // Track the recommended model for this agent turn
        let recommendedModel: GeminiModel = 'gemini-2.5-flash';

        // If no direct mention, consult the orchestrator
        if (!nextAgent) {
            // 1. Call Orchestrator to get the next agent and model recommendation
            onAgentChange(orchestrator.id);
            rustyLogger.trackApiRequest('gemini-2.5-flash'); // Track Orchestrator call

            // Retry logic for transient errors (503, 429)
            let orchestratorResponse;
            const maxRetries = 3;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    orchestratorResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash', // Orchestrator always uses the fast model for speed and cost-efficiency
                        contents: conversationContents,
                        config: {
                            systemInstruction: orchestrator.prompt,
                            temperature: 0.0, // Orchestrator should be deterministic
                        }
                    });

                    // Success - break out of retry loop
                    break;
                } catch (error: any) {
                    lastError = error;
                    const isTransientError =
                        error.message?.includes('503') ||
                        error.message?.includes('overloaded') ||
                        error.message?.includes('429') ||
                        error.message?.includes('rate limit');

                    if (isTransientError && attempt < maxRetries) {
                        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
                        console.warn(`[Orchestrator] Transient error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delayMs}ms...`, error.message);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        // Not transient or out of retries - throw it
                        throw error;
                    }
                }
            }

            if (!orchestratorResponse) {
                throw new Error(`Orchestrator failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
            }

            const orchestratorDecision = parseOrchestratorResponse((orchestratorResponse as any).response.text());

            // Log orchestrator decision for debugging routing bias
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
                // TypeScript narrowing: if not parallel, must be sequential
                const sequential = orchestratorDecision as { agent: string; model: GeminiModel; parallel?: false };
                console.log(`[Orchestrator Decision] SEQUENTIAL: ${sequential.agent} (${sequential.model})`);
                rustyLogger.log(
                    LogLevel.INFO,
                    'Orchestrator',
                    `Sequential execution: ${sequential.agent}`,
                    { agent: sequential.agent, model: sequential.model }
                );
            }

            // Check if parallel execution was requested
            if (orchestratorDecision.parallel) {
                console.log(`[Parallel Execution] Running ${orchestratorDecision.agents.length} agents simultaneously`);

                // Execute all agents in parallel
                const parallelMessages = await Promise.all(
                    orchestratorDecision.agents.map(async ({ agent: agentId, model }) => {
                        const agent = findAgentByIdentifier(agentId);
                        if (!agent) {
                            console.error(`Unknown agent in parallel execution: ${agentId}`);
                            return null;
                        }

                        // Create message for this agent
                        const message: Message = {
                            id: crypto.randomUUID(),
                            author: agent,
                            content: '',
                            timestamp: new Date(),
                        };

                        // Track API call
                        rustyLogger.trackApiRequest(model);

                        // Call agent (non-streaming for parallel execution)
                        const response = await ai.models.generateContent({
                            model,
                            contents: conversationContents,
                            config: {
                                systemInstruction: agent.prompt,
                            }
                        });

                        // Parse for proposed changes
                        const { proposedChanges, cleanedText } = parseProposedChanges((response as any).response.text());
                        message.content = cleanedText;
                        if (proposedChanges) {
                            console.log(`[GitHub Integration] ${agent.name} proposed code changes in parallel execution`);
                            message.proposedChanges = proposedChanges;
                        }

                        console.log(`[Parallel] ${agent.name} completed (${model})`);
                        return message;
                    })
                );

                // Add all parallel responses to history and UI
                for (const message of parallelMessages) {
                    if (message) {
                        onNewMessage(message);
                        currentHistory.push(message);
                    }
                }

                // Add delay before next turn to prevent burst traffic (5-10s random)
                const parallelDelayMs = 5000 + Math.random() * 5000; // 5-10 seconds
                console.log(`[Rate Limiting] Waiting ${(parallelDelayMs / 1000).toFixed(1)}s before next turn...`);
                await new Promise(resolve => setTimeout(resolve, parallelDelayMs));

                // Continue to next turn (orchestrator will decide next agent)
                continue;
            }

            // Sequential execution (existing logic)
            // TypeScript narrowing: we know it's sequential here because parallel branch continues
            const sequentialDecision = orchestratorDecision as { agent: string; model: GeminiModel; parallel?: false };
            const { agent: decision, model: suggestedModel } = sequentialDecision;
            recommendedModel = suggestedModel;

            // Handle orchestrator parse errors (fallback - should be rare with improved JSON extraction)
            if (decision === 'orchestrator-parse-error') {
                console.error('[Orchestrator] Failed to extract valid JSON even after robust parsing. Stopping.');
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `## Orchestrator Parse Error

The orchestrator returned a response that couldn't be parsed, even after attempting to extract JSON from conversational text and markdown.

**This is a critical error that requires attention.**

**Possible causes:**
- The orchestrator is receiving an unclear or contradictory request
- There's a transient issue with the Gemini API
- The orchestrator's output format has changed unexpectedly

**What to try:**
1. Check the browser console for the raw orchestrator output
2. Rephrase your request more clearly
3. Try again - this might be a one-time API issue

If this error persists, please report it as it indicates a systemic problem.`,
                    timestamp: new Date(),
                };
                onNewMessage(errorMessage);
                break;
            }

            // 2. Decide whether to stop or continue
            if (decision.toUpperCase() === WAIT_FOR_USER) {
                break; // End the agent loop
            }

            if (decision === 'continue') {
                // Agents are having a productive conversation, keep going without intervention
                continue;
            }

            nextAgent = findAgentByIdentifier(decision);

            if (!nextAgent) {
                console.error(`Orchestrator decided on an unknown agent: '${decision}'. Waiting for user.`);
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    author: AGENT_PROFILES.find(a => a.name === 'Debug Specialist')!,
                    content: `Orchestrator Error: Could not find an agent with the identifier "${decision}". Please check the orchestrator prompt and agent definitions.`,
                    timestamp: new Date(),
                };
                onNewMessage(errorMessage);
                break;
            }
        }

        // 3. Call the chosen specialist agent and stream the response
        onAgentChange(nextAgent.id);

        // Create an empty message first
        const newSpecialistMessage: Message = {
            id: crypto.randomUUID(),
            author: nextAgent,
            content: '',
            timestamp: new Date(),
        };
        onNewMessage(newSpecialistMessage);
        currentHistory.push(newSpecialistMessage); // Add to history immediately

        // Track specialist agent API call
        rustyLogger.trackApiRequest(recommendedModel);

        const stream = await ai.models.generateContentStream({
            model: recommendedModel, // Use orchestrator's cost-aware model recommendation
            contents: conversationContents,
            config: {
                systemInstruction: nextAgent.prompt,
            }
        });

        // Log model selection for debugging quota usage
        console.log(`[Cost-Aware Routing] ${nextAgent.name} using ${recommendedModel}`);

        for await (const chunk of stream) {
            // Check if operation was aborted during streaming
            if (abortSignal?.aborted) {
                const error = new Error('Operation aborted by user');
                error.name = 'AbortError';
                throw error;
            }

            const chunkText = chunk.text;
            if (chunkText) {
                onMessageUpdate(chunkText);
                // Update the content in our history copy as well
                newSpecialistMessage.content += chunkText;
            }
        }

        // After streaming completes, parse for proposed changes
        const { proposedChanges, cleanedText } = parseProposedChanges(newSpecialistMessage.content);
        if (proposedChanges) {
            console.log('[GitHub Integration] Agent proposed code changes:', proposedChanges);
            // Store in message
            newSpecialistMessage.proposedChanges = proposedChanges;
            // Update displayed content to show cleaned text without the JSON block
            newSpecialistMessage.content = cleanedText;
        }

        // Add delay before next turn to prevent burst traffic (5-10s random)
        // This gives natural rate limiting while allowing agents to collaborate
        const delayMs = 5000 + Math.random() * 5000; // 5-10 seconds
        console.log(`[Rate Limiting] Waiting ${(delayMs / 1000).toFixed(1)}s before next turn...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Continue to next turn (orchestrator will decide next agent or WAIT_FOR_USER)
    }
    
    // Reset active agent after the loop finishes
    onAgentChange(null);
};