import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel } from '../../types';
import { AGENT_PROFILES, MAX_AGENT_TURNS, WAIT_FOR_USER } from '../../constants';
import { loadSettings } from './projectService';

/**
 * Parses the raw text response from the Orchestrator to extract the agent identifier or WAIT_FOR_USER.
 * It's designed to be robust against common formatting variations from the model.
 * @param responseText The raw text from the Gemini model.
 * @returns The clean agent identifier (e.g., "builder") or "WAIT_FOR_USER".
 */
const parseOrchestratorResponse = (responseText: string): string => {
  let cleanText = responseText.trim().toLowerCase();

  // Remove markdown code blocks, quotes, and asterisks
  cleanText = cleanText.replace(/```/g, '').replace(/["'*]/g, '').trim();

  // Create identifiers from agent names (e.g., "Debug Specialist" -> "debug-specialist")
  const allAgentIdentifiers = AGENT_PROFILES.map(p =>
    p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
  );

  // Check for CONTINUE command (new for multi-agent conversations)
  if (cleanText === 'continue') {
    return 'continue';
  }

  // Check for exact match first
  if (allAgentIdentifiers.includes(cleanText) || cleanText === WAIT_FOR_USER.toLowerCase()) {
      return cleanText;
  }

  // Find the decision that is present in the response text
  // This helps if the model is verbose (e.g., "The next agent should be: builder")
  for (const decision of [...allAgentIdentifiers, WAIT_FOR_USER.toLowerCase(), 'continue']) {
    if (cleanText.includes(decision)) {
      return decision;
    }
  }

  // Fallback to the cleaned text if no specific known agent is found.
  // This might happen if the orchestrator returns a malformed response.
  return cleanText;
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
 * Constructs a single string prompt containing the full conversation history and codebase context.
 * @param messages The array of Message objects representing the conversation.
 * @param codebaseContext A string containing the codebase context.
 * @returns A formatted string ready to be sent to the AI model.
 */
const buildFullPrompt = (messages: Message[], codebaseContext: string): string => {
    const historyString = messages.map(msg => {
        const author = (typeof msg.author === 'string') ? msg.author : msg.author.name;
        return `${author}:\n${msg.content}`;
    }).join('\n\n---\n\n');
    
    return `# Codebase Context
\`\`\`
${codebaseContext || 'No codebase provided.'}
\`\`\`

# Full Conversation History
${historyString}
    `;
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
 * @returns A promise that resolves when the orchestration loop is complete.
 */
export const getAgentResponse = async (
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void
): Promise<void> => {
    const settings = loadSettings();
    const model: GeminiModel = settings?.model || 'gemini-2.5-flash';

    if (!process.env.API_KEY) {
      throw new Error("API key is not configured. Please ensure process.env.API_KEY is set.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let currentHistory = [...messages];

    const orchestrator = AGENT_PROFILES.find(p => p.name === 'Orchestrator');
    if (!orchestrator) {
        throw new Error("Critical: Orchestrator agent profile not found.");
    }

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        const fullPrompt = buildFullPrompt(currentHistory, codebaseContext);

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

        // If no direct mention, consult the orchestrator
        if (!nextAgent) {
            // 1. Call Orchestrator to get the next agent
            onAgentChange(orchestrator.id);
            const orchestratorResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Orchestrator always uses the fast model for speed and cost-efficiency
                contents: fullPrompt,
                config: {
                    systemInstruction: orchestrator.prompt,
                    temperature: 0.0, // Orchestrator should be deterministic
                }
            });

            const decision = parseOrchestratorResponse(orchestratorResponse.text);

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

        const stream = await ai.models.generateContentStream({
            model: model, // Use the user's selected model for the specialist
            contents: fullPrompt,
            config: {
                systemInstruction: nextAgent.prompt,
            }
        });

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                onMessageUpdate(chunkText);
                // Update the content in our history copy as well
                newSpecialistMessage.content += chunkText;
            }
        }
    }
    
    // Reset active agent after the loop finishes
    onAgentChange(null);
};