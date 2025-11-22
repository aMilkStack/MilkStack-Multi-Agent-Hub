/**
 * Agent Profiles - Individual agent definitions
 * Extracted from constants.ts for better modularity
 *
 * NOTE: Currently only orchestrator is extracted.
 * All other agents still imported from constants.ts
 * TODO: Extract remaining 14 agents to individual files
 */

import { orchestratorAgent } from './orchestrator';
import { AGENT_PROFILES as ALL_AGENTS, WAIT_FOR_USER, MAX_AGENT_TURNS, MAX_RETRIES, INITIAL_BACKOFF_MS } from '../../constants';

// Use orchestrator from extracted file, rest from constants
export const AGENT_PROFILES = ALL_AGENTS.map(agent =>
  agent.id === 'agent-orchestrator-001' ? orchestratorAgent : agent
);

// Re-export individual agents
export { orchestratorAgent };

// Export constants
export { WAIT_FOR_USER, MAX_AGENT_TURNS, MAX_RETRIES, INITIAL_BACKOFF_MS };
