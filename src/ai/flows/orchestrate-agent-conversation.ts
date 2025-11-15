'use server';
/**
 * @fileOverview Orchestrates the conversation by deciding which agent speaks next.
 *
 * - orchestrateAgentConversation - A function that determines the next agent to speak.
 * - OrchestrateAgentConversationInput - The input type for the orchestrateAgentConversation function.
 * - OrchestrateAgentConversationOutput - The return type for the orchestrateAgentConversation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Agent, Message } from '@/lib/types';

// Helper to format messages for the prompt
const formatMessages = (messages: Message[]): string => {
  return messages
    .map(m => {
      const authorName = m.author === 'user' ? 'Ethan (User)' : m.author.name;
      return `${authorName}: ${m.content}`;
    })
    .join('\n');
};

const OrchestrateAgentConversationInputSchema = z.object({
  messages: z.custom<Message[]>().describe('The full conversation history.'),
  globalRules: z.string().optional().describe('Global rules for the AI agent.'),
  agents: z.custom<Agent[]>().describe('The available agents.'),
});
export type OrchestrateAgentConversationInput = z.infer<typeof OrchestrateAgentConversationInputSchema>;

const OrchestrateAgentConversationOutputSchema = z.object({
  nextAgent: z.string().describe(`The name of the next agent to speak, or "WAIT_FOR_USER".`),
  reasoning: z.string().optional().describe('The reasoning for choosing the next agent.'),
});
export type OrchestrateAgentConversationOutput = z.infer<typeof OrchestrateAgentConversationOutputSchema>;


export async function orchestrateAgentConversation(input: OrchestrateAgentConversationInput): Promise<OrchestrateAgentConversationOutput> {
    return orchestrateAgentConversationFlow(input);
}

const prompt = ai.definePrompt({
    name: 'orchestrateAgentConversationPrompt',
    input: { schema: z.object({
        agentPrompt: z.string(),
        formattedMessages: z.string(),
        globalRules: z.string().optional(),
        agentList: z.string(),
    }) },
    output: { schema: OrchestrateAgentConversationOutputSchema, format: 'json' },
    prompt: `
{{#if globalRules}}
Global Rules for all agents:
{{globalRules}}
---
{{/if}}

{{agentPrompt}}

AVAILABLE AGENTS:
{{agentList}}

Conversation History:
---
{{formattedMessages}}
---

Analyze the last message in the conversation history and respond with ONLY a JSON object containing the name of the most appropriate agent in the "nextAgent" field and your reasoning in the "reasoning" field.
Your response MUST be a valid JSON object.
`,
});

const orchestrateAgentConversationFlow = ai.defineFlow(
  {
    name: 'orchestrateAgentConversationFlow',
    inputSchema: OrchestrateAgentConversationInputSchema,
    outputSchema: OrchestrateAgentConversationOutputSchema,
  },
  async (input) => {
    const orchestrator = input.agents.find(a => a.name === 'Orchestrator');
    if (!orchestrator) {
        throw new Error('Orchestrator agent not found');
    }

    const formattedMessages = formatMessages(input.messages);
    const agentList = input.agents
        .filter((a) => a.name !== 'Orchestrator')
        .map((a) => `- ${a.name}: ${a.description}`)
        .join('\n');
    
    // Construct the full prompt for the orchestrator
    const agentPrompt = orchestrator.prompt.replace(
      '${agents.filter(a => a.name !== \'Orchestrator\').map(a => `- ${a.name}: ${a.description}`).join(\'\\n\')}',
      agentList
    );

    const { output } = await prompt({ ...input, formattedMessages, agentList, agentPrompt });
    
    if (!output) {
      console.warn('Orchestrator did not return an output. Waiting for user.');
      return { nextAgent: 'WAIT_FOR_USER', reasoning: 'Orchestrator failed to provide an output.' };
    }
    
    const validAgents = input.agents.map(a => a.name);
    if (![...validAgents, 'WAIT_FOR_USER'].includes(output.nextAgent)) {
        console.warn(`Orchestrator returned invalid agent: "${output.nextAgent}". Waiting for user instead.`);
        return { nextAgent: 'WAIT_FOR_USER', reasoning: `Invalid agent "${output.nextAgent}" was returned.` };
    }

    console.log(`Orchestrator choice: ${output.nextAgent}, Reason: ${output.reasoning}`);
    return output;
  }
);
