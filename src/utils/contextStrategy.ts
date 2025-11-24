/**
 * Context Strategy Utility
 * Determines when to include full codebase context vs lightweight summaries
 * Optimizes token usage and API costs
 */

import { WorkflowPhase } from '../types';

export interface ContextDecision {
  includeFullCodebase: boolean;
  reason: string;
}

/**
 * Determines whether to include full codebase based on message content and workflow phase
 *
 * @param userMessage - The latest user message content
 * @param phase - Current workflow phase (discovery or execution)
 * @param isFirstMessage - Whether this is the first message in the conversation
 * @returns Decision object with boolean flag and reasoning
 */
export function shouldIncludeFullCodebase(
  userMessage: string,
  phase: WorkflowPhase,
  isFirstMessage: boolean
): ContextDecision {
  // Always include on first message (agent needs to understand the project)
  if (isFirstMessage) {
    return { includeFullCodebase: true, reason: 'first_message' };
  }

  // Always include in execution phase (agents need code to implement)
  if (phase === 'execution') {
    return { includeFullCodebase: true, reason: 'execution_phase' };
  }

  // Include if message mentions files, paths, or code-related terms
  const codePatterns = [
    /\.(ts|tsx|js|jsx|py|java|go|rs|md|json|yaml|yml|css|scss|html)/i, // File extensions
    /file|path|code|function|class|component|import|export/i, // Code-related keywords
    /src\/|app\/|components?\//i, // Common path patterns
    /implement|refactor|debug|fix|bug|error/i, // Implementation keywords
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(userMessage)) {
      return { includeFullCodebase: true, reason: 'mentions_code_or_implementation' };
    }
  }

  // Discovery mode - conversational only (architecture discussion, planning, etc.)
  // Use lightweight context (file tree only) to save tokens
  return { includeFullCodebase: false, reason: 'discovery_conversation' };
}

/**
 * Estimate token savings from using lightweight context
 * Rough estimation: ~4 chars per token
 */
export function estimateTokenSavings(fullCodebaseLength: number, fileTreeLength: number): {
  fullTokens: number;
  lightTokens: number;
  savedTokens: number;
  savingsPercent: number;
} {
  const fullTokens = Math.ceil(fullCodebaseLength / 4);
  const lightTokens = Math.ceil(fileTreeLength / 4);
  const savedTokens = fullTokens - lightTokens;
  const savingsPercent = fullTokens > 0 ? (savedTokens / fullTokens) * 100 : 0;

  return {
    fullTokens,
    lightTokens,
    savedTokens,
    savingsPercent,
  };
}
