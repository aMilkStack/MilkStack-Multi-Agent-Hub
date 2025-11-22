/**
 * Discovery Service
 * Handles conversational agent routing in Discovery Mode
 * Agents debate and explore options before committing to execution
 */

import { GoogleGenAI } from "@google/genai";
import { Agent, Message, GeminiModel } from '../types';
import { AGENT_PROFILES, WAIT_FOR_USER } from '../../constants';
import { buildConversationContents } from './geminiService';
import { buildOrchestratorContext } from '../utils/smartContext';
import { createAgentExecutor } from './AgentExecutor';
import { sharedRateLimiter } from './rateLimiter';
import { SAFETY_SETTINGS, DEFAULT_MODEL } from '../config/ai';

/**
 * Generate agent list for discovery prompt from canonical AGENT_PROFILES
 * Ensures prompt stays in sync with actual available agents
 */
const getDiscoveryAgentsList = (): string => {
  // Exclude agents not suitable for discovery mode
  const excludedAgents = [
    'agent-orchestrator-001',           // Used internally for routing
    'agent-product-planner-001',        // Execution mode only per spec
    'agent-orchestrator-parse-error-handler-001' // Internal error handling
  ];

  return AGENT_PROFILES
    .filter(agent => !excludedAgents.includes(agent.id))
    .map(agent => `- ${agent.id}: ${agent.description}`)
    .join('\n');
};

/**
 * Orchestrator prompt for Discovery Mode
 * Focuses on routing for exploration, debate, and consensus-building
 */
const DISCOVERY_ORCHESTRATOR_PROMPT = `
You are the Orchestrator for a collaborative software team in DISCOVERY MODE.

**Your Role:**
Route user questions to the most appropriate specialist agent for exploration and debate.
DO NOT create plans or task maps yet - focus on helping the user explore options and make decisions.

**CRITICAL: You MUST return the FULL agent ID (e.g., "agent-adversarial-thinker-001").**

**Available Agents:**
${getDiscoveryAgentsList()}

**Decision Logic:**
1. **Strategic Questions** → agent-system-architect-001
2. **Architecture/Design** → agent-system-architect-001 (possibly followed by agent-adversarial-thinker-001 for critique)
3. **Security/Flaw Analysis** → agent-adversarial-thinker-001
4. **Business Context** → agent-market-research-specialist-001
5. **Technical Research** → agent-deep-research-specialist-001 or agent-fact-checker-explainer-001 (quick facts)
6. **UX/Design** → agent-ux-evaluator-001 or agent-visual-design-specialist-001
7. **Errors/Bugs** → agent-debug-specialist-001
8. **Code Implementation** → agent-builder-001
9. **Complex Refactoring** → agent-advanced-coding-specialist-001

**Consensus Detection:**
If the conversation shows clear agreement on approach AND the user seems ready to implement:
- Look for phrases like "that sounds good", "let's do that", "I agree"
- Look for completion of decision-making (architecture chosen, approach decided)
- Return: {"agent": "CONSENSUS_REACHED", "model": "gemini-2.0-flash-exp"}

**Output Format:**
Return ONLY valid JSON (no markdown, no explanation):
{
  "agent": "<full-agent-id>",
  "model": "<model-name>",
  "reasoning": "<brief explanation>"
}

**IMPORTANT:**
- Return FULL agent IDs exactly as listed above (e.g., "agent-adversarial-thinker-001")
- NEVER route to "agent-product-planner-001" in Discovery Mode
- If user explicitly says "implement", "execute", or "go ahead" → return "CONSENSUS_REACHED"
- If conversation is just exploration → return agent for next discussion
- If you're unsure → return WAIT_FOR_USER
`;

/**
 * Parse orchestrator response (expects JSON due to responseMimeType enforcement)
 */
const parseDiscoveryOrchestrator = (responseText: string):
  { agent: string; model: GeminiModel; reasoning?: string } | null => {

  try {
    const parsed = JSON.parse(responseText.trim());

    // Validate required fields
    if (!parsed.agent || !parsed.model) {
      console.error('[Discovery] Invalid orchestrator response: missing agent or model');
      return null;
    }

    // Check for consensus signal
    if (parsed.agent === 'CONSENSUS_REACHED') {
      return { agent: 'CONSENSUS_REACHED', model: DEFAULT_MODEL };
    }

    // Check for wait signal
    if (parsed.agent === WAIT_FOR_USER) {
      return { agent: WAIT_FOR_USER, model: DEFAULT_MODEL };
    }

    return {
      agent: parsed.agent.toLowerCase(),
      model: parsed.model as GeminiModel,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    console.error('[Discovery] Orchestrator JSON parse failed:', error);
    console.error('[Discovery] Response:', responseText);
    return null;
  }
};

/**
 * Executes Discovery Mode workflow - conversational agent routing
 */
export const executeDiscoveryWorkflow = async (
  ai: GoogleGenAI,
  messages: Message[],
  codebaseContext: string,
  onNewMessage: (message: Message) => void,
  onMessageUpdate: (chunk: string) => void,
  onAgentChange: (agentId: string | null) => void,
  abortSignal?: AbortSignal
): Promise<{ consensusReached: boolean; agentTurns: number }> => {
  
  console.log('[Discovery] Starting conversational workflow');

  const executor = createAgentExecutor(ai, sharedRateLimiter, abortSignal);
  // Lightweight context for orchestrator (file tree only)
  const orchestratorContext = buildOrchestratorContext(messages, codebaseContext);
  // Full context for specialist agents
  const isFirstMessage = messages.length === 1;
  const conversationContents = buildConversationContents(messages, codebaseContext, 'discovery', isFirstMessage);
  
  let agentTurns = 0;
  const MAX_DISCOVERY_TURNS = 10; // Prevent infinite loops

  // Call Orchestrator to route
  const orchestrator = AGENT_PROFILES.find(a => a.id === 'agent-orchestrator-001');
  if (!orchestrator) {
    throw new Error('Orchestrator not found');
  }

  onAgentChange(orchestrator.id);

  let orchestratorResponse = '';
  await executor.executeStreaming(
    orchestrator,
    DEFAULT_MODEL,
    orchestratorContext, // Lightweight context for routing decisions
    {
      systemInstruction: DISCOVERY_ORCHESTRATOR_PROMPT,
      safetySettings: SAFETY_SETTINGS as any,
      responseMimeType: 'application/json', // Force JSON output for reliable parsing
    },
    (chunk) => {
      orchestratorResponse += chunk;
    }
  );

  const routing = parseDiscoveryOrchestrator(orchestratorResponse);
  
  if (!routing) {
    console.error('[Discovery] Failed to parse orchestrator response');
    return { consensusReached: false, agentTurns };
  }

  // Check for special signals
  if (routing.agent === 'CONSENSUS_REACHED') {
    console.log('[Discovery] Consensus reached - ready for execution');
    return { consensusReached: true, agentTurns };
  }

  if (routing.agent === WAIT_FOR_USER) {
    console.log('[Discovery] Orchestrator returned WAIT_FOR_USER');
    onAgentChange(null);
    return { consensusReached: false, agentTurns };
  }

  // Route to specialist agent
  const targetAgent = AGENT_PROFILES.find(a => a.id === routing.agent);

  if (!targetAgent) {
    throw new Error(`[Discovery] Orchestrator routed to unknown agent: ${routing.agent}. Valid agents: ${AGENT_PROFILES.map(a => a.id).join(', ')}`);
  }

  console.log(`[Discovery] Routing to ${targetAgent.name}`);
  onAgentChange(targetAgent.id);

  // Execute specialist agent
  let agentResponse = '';
  await executor.executeStreaming(
    targetAgent,
    routing.model,
    conversationContents,
    {
      systemInstruction: targetAgent.prompt,
      safetySettings: SAFETY_SETTINGS as any,
    },
    (chunk) => {
      onMessageUpdate(chunk);
      agentResponse += chunk;
    }
  );

  // Add agent's response to messages
  const agentMessage: Message = {
    id: crypto.randomUUID(),
    author: targetAgent,
    content: agentResponse,
    timestamp: new Date(),
  };
  onNewMessage(agentMessage);

  onAgentChange(null);
  agentTurns++;

  return { consensusReached: false, agentTurns };
};
