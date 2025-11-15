'use server';
/**
 * @fileOverview Generates a response from a specific AI agent's perspective.
 *
 * - generateAgentResponse - A function that generates an agent's response.
 * - GenerateAgentResponseInput - The input type for the generateAgentResponse function.
 * - GenerateAgentResponseOutput - The return type for the generateAgentResponse function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Message, Agent } from '@/lib/types';

// Helper to format messages for the prompt
const formatMessages = (messages: Message[]): string => {
  return messages
    .map(m => {
      const authorName = m.author === 'user' ? 'Ethan (User)' : m.author.name;
      return `${authorName}: ${m.content}`;
    })
    .join('\n');
};

const GenerateAgentResponseInputSchema = z.object({
  agentId: z.string().describe('The ID of the agent that should respond.'),
  messages: z.custom<Message[]>().describe('The full conversation history.'),
  codebaseContext: z.string().optional().describe('The codebase context, if available.'),
  globalRules: z.string().optional().describe('Global rules for the AI agent.'),
  agents: z.custom<Agent[]>().describe('List of all available agents.'),
});
export type GenerateAgentResponseInput = z.infer<typeof GenerateAgentResponseInputSchema>;

const GenerateAgentResponseOutputSchema = z.object({
  response: z.string().describe("The agent's generated response."),
});
export type GenerateAgentResponseOutput = z.infer<typeof GenerateAgentResponseOutputSchema>;

export async function generateAgentResponse(input: GenerateAgentResponseInput): Promise<GenerateAgentResponseOutput> {
  return generateAgentResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAgentResponsePrompt',
  input: { schema: z.object({
    agentPrompt: z.string(),
    formattedMessages: z.string(),
    globalRules: z.string().optional(),
  }) },
  output: { schema: GenerateAgentResponseOutputSchema },
  prompt: `{{#if globalRules}}
Global Rules for all agents:
{{globalRules}}
---
{{/if}}

{{agentPrompt}}

You are responding within a group chat. Here is the conversation history so far:
---
{{formattedMessages}}
---

Based on your persona and the conversation history, provide a concise and relevant response to the LATEST message. Address the user, "Ethan," or other agents directly if appropriate.

Your response should be in plain text, not markdown.
`,
});

const generateAgentResponseFlow = ai.defineFlow(
  {
    name: 'generateAgentResponseFlow',
    inputSchema: GenerateAgentResponseInputSchema,
    outputSchema: GenerateAgentResponseOutputSchema,
  },
  async (input) => {
    const agent = input.agents.find(a => a.id === input.agentId);
    if (!agent) {
      throw new Error(`Agent with id ${input.agentId} not found.`);
    }

    let agentPrompt = agent.prompt;
    if (input.codebaseContext) {
      agentPrompt += `\n\nHere is the relevant codebase context:\n\`\`\`\n${input.codebaseContext}\n\`\`\``;
    }
    
    const formattedMessages = formatMessages(input.messages);
    
    const { output } = await prompt({ agentPrompt, formattedMessages, globalRules: input.globalRules });
    return output!;
  }
);
