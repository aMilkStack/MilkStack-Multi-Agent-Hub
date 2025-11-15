'use server';

/**
 * @fileOverview Summarizes recent Git history for quick project onboarding.
 *
 * - summarizeGitHistory - A function that takes a git repo URL and returns a summary of recent commits.
 * - SummarizeGitHistoryInput - The input type for the summarizeGitHistory function.
 * - SummarizeGitHistoryOutput - The return type for the summarizeGitHistory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getGitLog } from '@/services/git-service';
import { Settings } from '@/lib/types';

const SummarizeGitHistoryInputSchema = z.object({
  repoUrl: z.string().describe('The URL of the Git repository.'),
  numCommits: z.number().default(10).describe('The number of recent commits to summarize.'),
  settings: z.custom<Settings>()
});
export type SummarizeGitHistoryInput = z.infer<typeof SummarizeGitHistoryInputSchema>;

const SummarizeGitHistoryOutputSchema = z.object({
  summary: z.string().describe('A summary of the recent Git history.'),
});
export type SummarizeGitHistoryOutput = z.infer<typeof SummarizeGitHistoryOutputSchema>;

export async function summarizeGitHistory(input: SummarizeGitHistoryInput): Promise<SummarizeGitHistoryOutput> {
  return summarizeGitHistoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeGitHistoryPrompt',
  input: {schema: z.object({ gitHistory: z.string() })},
  output: {schema: SummarizeGitHistoryOutputSchema},
  prompt: `You are a software development expert, skilled at summarizing git commit history.

  Summarize the following git commit history of a project, highlighting the key changes and activities.  Limit the summary to 200 words.

  Git History:
  {{gitHistory}}
  `,
});

const summarizeGitHistoryFlow = ai.defineFlow(
  {
    name: 'summarizeGitHistoryFlow',
    inputSchema: SummarizeGitHistoryInputSchema,
    outputSchema: SummarizeGitHistoryOutputSchema,
  },
  async input => {
    const gitHistory = await getGitLog(input.repoUrl, input.numCommits, input.settings);
    const {output} = await prompt({ gitHistory });
    return output!;
  }
);
