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
  signal: z.custom<AbortSignal>().optional().describe('An optional AbortSignal to cancel the request.'),
});
export type GenerateAgentResponseInput = z.infer<typeof GenerateAgentResponseInputSchema>;

const GenerateAgentResponseOutputSchema = z.object({
  response: z.string().describe("The agent's generated response."),
});
export type GenerateAgentResponseOutput = z.infer<typeof GenerateAgentResponseOutputSchema>;


export async function generateResponse(input: GenerateAgentResponseInput) {
  return generateAgentResponseFlow.stream(input);
}


const prompt = ai.definePrompt({
  name: 'generateAgentResponsePrompt',
  input: { schema: z.object({
    agentPrompt: z.string(),
    formattedMessages: z.string(),
    globalRules: z.string().optional(),
    codebaseContext: z.string().optional(),
  }) },
  output: { schema: GenerateAgentResponseOutputSchema },
  prompt: `{{#if globalRules}}
Global Rules for all agents:
{{globalRules}}
---
{{/if}}

{{agentPrompt}}

{{#if codebaseContext}}
You have been provided with the following codebase context to inform your response. Use it to understand the project structure, existing patterns, and file contents.

CODEBASE CONTEXT:
---
{{codebaseContext}}
---
{{/if}}

You are responding within a group chat. Here is the conversation history so far:
---
{{formattedMessages}}
---

Based on your persona and the conversation history, provide a concise and relevant response to the LATEST message. Address the user, "Ethan," or other agents directly if appropriate.

Format your responses using Markdown for clarity, especially for code blocks, lists, and emphasis.
`,
});

const generateAgentResponseFlow = ai.defineFlow(
  {
    name: 'generateAgentResponseFlow',
    inputSchema: GenerateAgentResponseInputSchema,
    outputSchema: z.string(), // Streaming flows output chunks (string)
  },
  async function* (input) {
    const agent = input.agents.find(a => a.id === input.agentId);
    if (!agent) {
      throw new Error(`Agent with id ${input.agentId} not found.`);
    }

    const agentPrompt = agent.prompt;
    const formattedMessages = formatMessages(input.messages);
    
    try {
      const { stream } = await prompt.stream({ 
        agentPrompt, 
        formattedMessages, 
        globalRules: input.globalRules,
        codebaseContext: input.codebaseContext,
      }, { signal: input.signal });

      for await (const chunk of stream) {
        if (input.signal?.aborted) {
          console.log('Stream generation aborted.');
          return;
        }
        const text = chunk.output?.response ?? '';
        if (text) {
          yield text;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Flow aborted by user.');
        return; // Gracefully exit if aborted
      }
      // Re-throw other errors
      throw error;
    }
  }
);