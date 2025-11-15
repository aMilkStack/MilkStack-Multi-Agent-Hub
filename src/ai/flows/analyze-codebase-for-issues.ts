'use server';
/**
 * @fileOverview Analyzes a codebase for potential issues like bugs and security vulnerabilities.
 *
 * - analyzeCodebaseForPotentialIssues - A function that triggers the analysis process.
 * - AnalyzeCodebaseForPotentialIssuesInput - The input type for the analyzeCodebaseForPotentialIssues function.
 * - AnalyzeCodebaseForPotentialIssuesOutput - The return type for the analyzeCodebaseForPotentialIssues function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCodebaseForPotentialIssuesInputSchema = z.object({
  codebaseContext: z.string().optional().describe('The codebase context, represented as a virtual file tree.'),
  globalRules: z.string().optional().describe('Global rules set by the user to customize the AI agent\'s behavior.'),
});
export type AnalyzeCodebaseForPotentialIssuesInput = z.infer<typeof AnalyzeCodebaseForPotentialIssuesInputSchema>;

const AnalyzeCodebaseForPotentialIssuesOutputSchema = z.object({
  analysisReport: z.string().describe('A detailed report of potential issues identified in the codebase, including bugs and security vulnerabilities.'),
});
export type AnalyzeCodebaseForPotentialIssuesOutput = z.infer<typeof AnalyzeCodebaseForPotentialIssuesOutputSchema>;

export async function analyzeCodebaseForPotentialIssues(input: AnalyzeCodebaseForPotentialIssuesInput): Promise<AnalyzeCodebaseForPotentialIssuesOutput> {
  return analyzeCodebaseForPotentialIssuesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCodebaseForPotentialIssuesPrompt',
  input: {schema: AnalyzeCodebaseForPotentialIssuesInputSchema},
  output: {schema: AnalyzeCodebaseForPotentialIssuesOutputSchema},
  prompt: `You are a security expert that identifies potential security vulnerabilities and bugs in the given codebase.

  Analyze the following codebase context, represented as a virtual file tree, for potential issues like bugs and security vulnerabilities. Provide a detailed report of your findings.
  
  {{#if codebaseContext}}
  Codebase Context:
  {{codebaseContext}}
  {{else}}
  No codebase context was provided.
  {{/if}}

  {{#if globalRules}}
  Global Rules:
  {{globalRules}}
  {{/if}}`,
});

const analyzeCodebaseForPotentialIssuesFlow = ai.defineFlow(
  {
    name: 'analyzeCodebaseForPotentialIssuesFlow',
    inputSchema: AnalyzeCodebaseForPotentialIssuesInputSchema,
    outputSchema: AnalyzeCodebaseForPotentialIssuesOutputSchema,
  },
  async input => {
    if (!input.codebaseContext) {
      return { analysisReport: 'No codebase provided to analyze.' };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
