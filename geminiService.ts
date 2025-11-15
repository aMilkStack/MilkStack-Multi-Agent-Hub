
import { GoogleGenAI } from "@google/genai";
import { Message, Model, AgentName } from './types';
import { AGENTS, ALL_AGENT_NAMES } from './constants';

const END_OF_TURN_TOKEN = 'WAIT_FOR_USER';
const MAX_AGENT_TURNS = 5; // Prevents infinite loops

const formatHistoryForGemini = (messages: Message[]) => {
    return messages.map(msg => ({
        role: msg.sender === 'Ethan' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
};

/**
 * Parses the orchestrator's raw text response to find the next action.
 * It looks for the last mentioned agent name in the string to be robust
 * against conversational boilerplate from the model.
 */
const parseOrchestratorResponse = (responseText: string): string => {
    const trimmedText = responseText.trim();

    // Prioritize the end-of-turn token. If it's present, the turn is over.
    if (trimmedText.includes(END_OF_TURN_TOKEN)) {
        return END_OF_TURN_TOKEN;
    }

    let lastMatch: { name: string; index: number } | null = null;

    // Find the last mentioned agent in the response string
    for (const agentName of ALL_AGENT_NAMES) {
        const lastIndex = trimmedText.lastIndexOf(agentName);
        if (lastIndex !== -1) {
            if (!lastMatch || lastIndex > lastMatch.index) {
                lastMatch = { name: agentName, index: lastIndex };
            }
        }
    }

    if (lastMatch) {
        return lastMatch.name;
    }

    // Fallback to the original response if no agent name is found.
    return trimmedText;
};


export async function getAgentResponse(initialMessages: Message[], model: Model): Promise<Message[]> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const orchestrator = AGENTS.find(a => a.name === 'Orchestrator');
    if (!orchestrator) {
        throw new Error("Orchestrator agent not found.");
    }

    let currentMessages = [...initialMessages];
    const newAgentMessages: Message[] = [];

    try {
        for (let i = 0; i < MAX_AGENT_TURNS; i++) {
            const conversationHistory = formatHistoryForGemini(currentMessages);

            // 1. Call Orchestrator to decide the next action
            const orchestratorResponse = await ai.models.generateContent({
                model: model.id,
                contents: conversationHistory,
                config: {
                    systemInstruction: orchestrator.prompt,
                },
            });
            
            const nextAction = parseOrchestratorResponse(orchestratorResponse.text);

            // 2. Check if the turn is over
            if (nextAction === END_OF_TURN_TOKEN) {
                break;
            }

            const nextAgentName = nextAction as AgentName;
            const isValidAgent = ALL_AGENT_NAMES.includes(nextAgentName);

            if (!isValidAgent) {
                console.error(`Orchestrator returned an invalid action: "${nextAction}"`);
                const errorMessage: Message = {
                    id: `err-${Date.now()}-${i}`,
                    sender: 'Orchestrator',
                    text: `My apologies, the team is having a coordination issue. Ethan, could you please rephrase or clarify your request?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                newAgentMessages.push(errorMessage);
                break;
            }
            
            const specialistAgent = AGENTS.find(a => a.name === nextAgentName);
            if (!specialistAgent) {
                throw new Error(`Specialist agent "${nextAgentName}" not found.`);
            }
            
            // --- NEW: Prepend global rules to the agent's prompt ---
            let finalPrompt = specialistAgent.prompt;
            try {
                const globalRulesText = localStorage.getItem('global_rules');
                if (globalRulesText && globalRulesText.trim().length > 0) {
                    const rulesHeader = "--- GLOBAL RULES TO FOLLOW ---";
                    finalPrompt = `${rulesHeader}\n${globalRulesText}\n\n--- YOUR ORIGINAL INSTRUCTIONS ---\n${specialistAgent.prompt}`;
                }
            } catch (e) {
                console.error("Could not apply global rules:", e);
            }
            // --- END NEW ---

            // 3. Call the chosen specialist agent to get the actual response.
            const specialistResponse = await ai.models.generateContent({
                model: model.id,
                contents: conversationHistory,
                config: {
                    systemInstruction: finalPrompt, // Use the combined prompt
                },
            });

            const agentMessage: Message = {
                id: `msg-${Date.now()}-${i}`,
                sender: specialistAgent.name,
                text: specialistResponse.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            newAgentMessages.push(agentMessage);
            currentMessages.push(agentMessage);
        }
    } catch (error) {
        console.error("Error in getAgentResponse:", error);
        const errorMessage: Message = {
            id: `err-${Date.now()}`,
            sender: 'Orchestrator',
            text: 'An unexpected error occurred while processing your request. Please try again later.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        newAgentMessages.push(errorMessage);
    }
    
    return newAgentMessages;
}