import { GoogleGenAI } from '@google/genai';

let genAI: GoogleGenAI | null = null;

export const initializePromptEnhancer = (apiKey: string) => {
  if (apiKey) {
    genAI = new GoogleGenAI({ apiKey });
  }
};

/**
 * Determines if a user message is vague and should trigger the "Improve Prompt" suggestion.
 * Uses heuristics to detect short, ambiguous, or underspecified prompts.
 */
export const shouldSuggestEnhancement = (message: string): boolean => {
  if (!message || message.trim().length === 0) {
    return false;
  }

  const trimmedMessage = message.trim();
  const wordCount = trimmedMessage.split(/\s+/).length;

  // Very short messages (1-3 words) are likely vague
  if (wordCount <= 3) {
    return true;
  }

  // Check for vague keywords that indicate underspecified requests
  const vagueKeywords = [
    /^make\s/i,
    /^fix\s/i,
    /^create\s/i,
    /^add\s/i,
    /^update\s/i,
    /^change\s/i,
    /^build\s/i,
    /^do\s/i,
    /^help\s/i,
  ];

  const hasVagueStart = vagueKeywords.some(pattern => pattern.test(trimmedMessage));

  // If it starts vague AND is short (< 10 words), suggest enhancement
  if (hasVagueStart && wordCount < 10) {
    return true;
  }

  // Check for extremely vague standalone phrases
  const extremelyVague = [
    /^(make|fix|do|help)(\s+it)?$/i,
    /^(a|an|the)\s+\w+$/i, // "a button", "the form"
    /^button$/i,
    /^form$/i,
    /^page$/i,
    /^component$/i,
  ];

  if (extremelyVague.some(pattern => pattern.test(trimmedMessage))) {
    return true;
  }

  return false;
};

export const enhancePrompt = async (userMessage: string, codebaseContext?: string): Promise<string> => {
  if (!genAI) {
    throw new Error('Prompt enhancer not initialized. Please set your API key in settings.');
  }

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

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: enhancementPrompt }] }],
  });

  const enhanced = result.text?.trim();

  return enhanced || userMessage;
};
