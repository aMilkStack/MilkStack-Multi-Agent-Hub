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
