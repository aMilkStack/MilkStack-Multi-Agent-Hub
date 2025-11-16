import { GoogleGenerativeAI } from '@google/genai';

let genAI: GoogleGenerativeAI | null = null;

export const initializePromptEnhancer = (apiKey: string) => {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
};

export const enhancePrompt = async (userMessage: string, codebaseContext?: string): Promise<string> => {
  if (!genAI) {
    throw new Error('Prompt enhancer not initialized. Please set your API key in settings.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const enhancementPrompt = `You are a prompt enhancement assistant. Your job is to take a user's message and improve it to be clearer, more specific, and more effective for getting good responses from AI coding agents.

${codebaseContext ? `CODEBASE CONTEXT:\n${codebaseContext.slice(0, 2000)}\n\n` : ''}

USER'S ORIGINAL MESSAGE:
${userMessage}

Your task:
1. Keep the user's original intent and tone
2. Add clarity and specificity where needed
3. If it's vague, add reasonable assumptions based on common patterns
4. If it mentions code, add specific file paths or function names if you can infer them from context
5. Keep it concise - don't make it way longer unless necessary
6. Don't be overly formal - match the user's vibe

Return ONLY the enhanced prompt, nothing else. No explanations, no "Here's the enhanced version:", just the improved prompt itself.`;

  const result = await model.generateContent(enhancementPrompt);
  const enhanced = result.response.text().trim();

  return enhanced;
};
