/**
 * Agent Profiles - Individual agent definitions
 * Extracted from constants.ts for better modularity
 */

import { orchestratorAgent } from './orchestrator';
import { debugspecialistAgent } from './debug-specialist';
import { advancedcodingspecialistAgent } from './advanced-coding-specialist';
import { infrastructureguardianAgent } from './infrastructure-guardian';
import { knowledgecuratorAgent } from './knowledge-curator';
import { factcheckerexplainerAgent } from './fact-checker-explainer';
import { uxevaluatorAgent } from './ux-evaluator';
import { visualdesignspecialistAgent } from './visual-design-specialist';
import { marketresearchspecialistAgent } from './market-research-specialist';
import { systemarchitectAgent } from './system-architect';
import { productplannerAgent } from './product-planner';
import { deepresearchspecialistAgent } from './deep-research-specialist';
import { builderAgent } from './builder';
import { issuescopeanalyzerAgent } from './issue-scope-analyzer';
import { adversarialthinkerAgent } from './adversarial-thinker';
import { orchestratorparseerrorhandlerAgent } from './orchestrator-parse-error-handler';

export const AGENT_PROFILES = [
  orchestratorAgent,
  debugspecialistAgent,
  advancedcodingspecialistAgent,
  infrastructureguardianAgent,
  knowledgecuratorAgent,
  factcheckerexplainerAgent,
  uxevaluatorAgent,
  visualdesignspecialistAgent,
  marketresearchspecialistAgent,
  systemarchitectAgent,
  productplannerAgent,
  deepresearchspecialistAgent,
  builderAgent,
  issuescopeanalyzerAgent,
  adversarialthinkerAgent,
  orchestratorparseerrorhandlerAgent,
];

// Re-export individual agents
export { orchestratorAgent };
export { debugspecialistAgent };
export { advancedcodingspecialistAgent };
export { infrastructureguardianAgent };
export { knowledgecuratorAgent };
export { factcheckerexplainerAgent };
export { uxevaluatorAgent };
export { visualdesignspecialistAgent };
export { marketresearchspecialistAgent };
export { systemarchitectAgent };
export { productplannerAgent };
export { deepresearchspecialistAgent };
export { builderAgent };
export { issuescopeanalyzerAgent };
export { adversarialthinkerAgent };
export { orchestratorparseerrorhandlerAgent };

// Export constants from original constants.ts
export { WAIT_FOR_USER, MAX_AGENT_TURNS, MAX_RETRIES, INITIAL_BACKOFF_MS } from '../../constants';
