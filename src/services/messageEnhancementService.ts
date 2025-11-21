/**
 * BHEMPE - Background Hidden Enhanced Message to Prompt Engine for MSMAH
 *
 * Transforms raw user messages into detailed, orchestrator-friendly specifications.
 * This is a preprocessing layer that runs BEFORE the orchestrator sees the message.
 *
 * Key Principles:
 * - File-system agnostic (no codebase inspection, no tool calls)
 * - Relies solely on user's raw message text
 * - Produces deterministic, structured output
 * - Compatible with constants.ts agent profiles
 * - Ready for orchestrator assignment
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_MODEL } from '../config/ai';
import { sharedRateLimiter } from './rateLimiter';

/**
 * System prompt for BHEMPE
 * This prompt transforms user messages into detailed specifications
 */
const BHEMPE_SYSTEM_PROMPT = `You are the Background Hidden Enhanced Message to Prompt Engine for MSMAH (MilkStack Multi-Agent Hub).

Your ONLY job is to transform raw user messages into detailed, structured task specifications that the orchestrator can easily understand and route to the right agents.

**Rules:**
1. You DO NOT execute tasks or read files
2. You DO NOT make assumptions about the codebase structure
3. You ONLY enhance the user's message with:
   - Clear task breakdown
   - Explicit requirements
   - Expected deliverables
   - Technical considerations (if applicable)
   - Quality criteria

**Transform simple messages into detailed specifications:**

Example 1:
Input: "make a login page"
Output: "Create a login page component with the following requirements:
- User authentication form with email and password input fields
- Client-side validation (email format, password requirements)
- Form submission handling with loading states
- Error handling and user feedback (toast notifications)
- Responsive design matching existing UI patterns
- Integration with authentication service/API
- Accessibility considerations (ARIA labels, keyboard navigation)
- Security best practices (password masking, secure form submission)"

Example 2:
Input: "fix the bug in the header"
Output: "Debug and fix the issue in the header component:
- Identify the specific bug (layout issue, functionality problem, or styling error)
- Review the header component code for potential issues
- Check for console errors or warnings related to the header
- Test the fix across different screen sizes and browsers
- Ensure no regression in existing header functionality
- Document the root cause and solution"

Example 3:
Input: "add dark mode"
Output: "Implement dark mode theme support:
- Create theme toggle UI component (button/switch)
- Define dark mode color palette and variables
- Implement theme switching logic with state management
- Persist theme preference (localStorage/user settings)
- Update all components to support theme switching
- Ensure proper contrast ratios for accessibility
- Test theme switching across all pages/components
- Handle system preference detection (prefers-color-scheme)"

**Guidelines:**
- Keep the enhanced message concise but comprehensive
- Focus on WHAT needs to be done, not HOW to implement it
- Include quality criteria and edge cases
- Make it easy for the orchestrator to route to the right agents
- Preserve the user's original intent
- Don't add unnecessary fluff or over-specify

**Output Format:**
Return ONLY the enhanced message text. No preamble, no explanation, no markdown formatting unless it enhances clarity.`;

/**
 * Enhance a user message into a detailed specification
 *
 * @param userMessage - Raw user message text
 * @param apiKey - Gemini API key
 * @param model - Model to use (defaults to DEFAULT_MODEL)
 * @returns Enhanced message specification
 */
export async function enhanceUserMessage(
  userMessage: string,
  apiKey: string,
  model: typeof DEFAULT_MODEL = DEFAULT_MODEL
): Promise<string> {
  if (!userMessage.trim()) {
    throw new Error('Cannot enhance empty message');
  }

  if (!apiKey) {
    throw new Error('API key required for message enhancement');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messageEnhancementService.ts:104',message:'enhanceUserMessage starting (WITHOUT rate limiter!)',data:{messageLength:userMessage.length,model,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // CRITICAL: This was bypassing rate limiter! Wrap in rate limiter
    const estimatedTokens = Math.ceil(userMessage.length / 4) + 500; // Rough estimate
    const result = await sharedRateLimiter.execute(async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'messageEnhancementService.ts:109',message:'enhanceUserMessage inside rate limiter',data:{messageLength:userMessage.length,model,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        config: {
          systemInstruction: BHEMPE_SYSTEM_PROMPT,
        },
      });
    }, estimatedTokens);

    // FIX: Robust text extraction for new SDK
    let enhanced = '';
    if (typeof result.text === 'function') {
      enhanced = result.text();
    } else if (typeof result.text === 'string') {
      enhanced = result.text;
    } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      enhanced = result.candidates[0].content.parts[0].text;
    }

    enhanced = enhanced?.trim();

    if (!enhanced) {
      throw new Error('Enhancement produced empty result');
    }

    return enhanced;
  } catch (error) {
    console.error('Error enhancing message:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to enhance message: ${error.message}`
        : 'Failed to enhance message'
    );
  }
}

/**
 * Check if a message would benefit from enhancement
 * Returns true if the message is short and likely needs expansion
 */
export function shouldSuggestEnhancement(message: string): boolean {
  const trimmed = message.trim();

  // Suggest enhancement for short messages (< 50 chars)
  if (trimmed.length < 50) {
    return true;
  }

  // Suggest enhancement for messages without much detail
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 1 && trimmed.length < 100) {
    return true;
  }

  return false;
}
