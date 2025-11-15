'use server';

/**
 * @fileOverview Flow to generate a basic README file for a new project.
 *
 * - generateProjectReadme - A function that generates a basic README file.
 * - GenerateProjectReadmeInput - The input type for the generateProjectReadme function.
 * - GenerateProjectReadmeOutput - The return type for the generateProjectReadme function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProjectReadmeInputSchema = z.object({
  projectDescription: z
    .string()
    .describe('A short description of the project.'),
});
export type GenerateProjectReadmeInput = z.infer<
  typeof GenerateProjectReadmeInputSchema
>;

const GenerateProjectReadmeOutputSchema = z.object({
  readmeContent: z
    .string()
    .describe('The content of the generated README file.'),
});
export type GenerateProjectReadmeOutput = z.infer<
  typeof GenerateProjectReadmeOutputSchema
>;

export async function generateProjectReadme(
  input: GenerateProjectReadmeInput
): Promise<GenerateProjectReadmeOutput> {
  return generateProjectReadmeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProjectReadmePrompt',
  input: {schema: GenerateProjectReadmeInputSchema},
  output: {schema: GenerateProjectReadmeOutputSchema},
  prompt: `You are an expert technical writer specializing in generating README files for new projects.

  Based on the following project description, generate a basic README file. Include a title, a brief description, installation instructions, usage instructions, and contribution guidelines.

  Project Description: {{{projectDescription}}}
  `,
});

const generateProjectReadmeFlow = ai.defineFlow(
  {
    name: 'generateProjectReadmeFlow',
    inputSchema: GenerateProjectReadmeInputSchema,
    outputSchema: GenerateProjectReadmeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
