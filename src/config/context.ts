/**
 * Context Configuration
 *
 * Configuration for context management and conversation history filtering.
 */

/**
 * Agent IDs whose messages should be filtered from Orchestrator context.
 * These agents produce diagnostic/error messages that confuse the Orchestrator.
 *
 * Add agent IDs here if their messages should NOT be included in the
 * orchestrator's conversation history for decision-making.
 */
export const ORCHESTRATOR_CONTEXT_BLOCKLIST = [
    'agent-debug-specialist-001', // Debug Specialist diagnostic messages
    'system-error', // System error messages
    'orchestrator-parse-error', // Orchestrator parse error messages
] as const;

/**
 * Maximum characters for conversation context (roughly ~800k tokens)
 * This is a safe buffer below the 1M token limit
 */
export const MAX_CONTEXT_CHARS = 3200000;

/**
 * Token estimation ratio (1 token ~= 4 characters)
 */
export const CHARS_PER_TOKEN = 4;
