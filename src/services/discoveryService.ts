/**
 * Discovery Service
 * Handles conversational agent routing in Discovery Mode
 * Agents debate and explore options before committing to execution
 */

import { GoogleGenAI } from "@google/genai";
import { Agent, Message, GeminiModel } from '../types';
import { AGENT_PROFILES, WAIT_FOR_USER } from '../../constants';
import { buildConversationContents } from './geminiService';
import { createAgentExecutor } from './AgentExecutor';
import { createPaidTierRateLimiter } from './rateLimiter';
import { SAFETY_SETTINGS, DEFAULT_MODEL } from '../config/ai';

const rateLimiter = createPaidTierRateLimiter();

/**
 * Orchestrator prompt for Discovery Mode
 * Focuses on routing for exploration, debate, and consensus-building
 */
const DISCOVERY_ORCHESTRATOR_PROMPT = `
You are the Orchestrator for a collaborative software team in DISCOVERY MODE.

**Your Role:**
Route user questions to the most appropriate specialist agent for exploration and debate.
DO NOT create plans or task maps yet - focus on helping the user explore options and make decisions.

**Available Agents:**
- director: Strategic authority - validates business value and operational impact
- adversary: Red team critique - challenges assumptions, finds flaws
- architect: System design and technical architecture proposals
- planner: Requirements analysis and user story breakdown (NOT task execution planning)
- market: Business trends and competitive analysis
- deep-research: Comprehensive technical research
- ask: Quick factual lookups
- ux: User experience and design patterns
- debug: Technical diagnostics (if user mentions errors)

**Decision Logic:**
1. **Strategic Questions** → director
2. **Architecture/Design** → architect (possibly followed by adversary for critique)
3. **Security/Flaw Analysis** → adversary
4. **Business Context** → market
5. **Technical Research** → deep-research or ask (quick facts)
6. **UX/Design** → ux
7. **Errors/Bugs** → debug

**Consensus Detection:**
If the conversation shows clear agreement on approach AND the user seems ready to implement:
- Look for phrases like "that sounds good", "let's do that", "I agree"
- Look for completion of decision-making (architecture chosen, approach decided)
- Return: {"agent": "CONSENSUS_REACHED", "model": "gemini-2.0-flash-exp"}

**Output Format:**
Return ONLY valid JSON (no markdown, no explanation):
{
  "agent": "<agent-id>",
  "model": "<model-name>",
  "reasoning": "<brief explanation>"
}

**IMPORTANT:**
- Return agent IDs in lowercase with hyphens (e.g., "architect", NOT "Architect")
- NEVER route to "product-planner" in Discovery Mode
- If user explicitly says "implement", "execute", or "go ahead" → return "CONSENSUS_REACHED"
- If conversation is just exploration → return agent for next discussion
- If you're unsure → return WAIT_FOR_USER
`;

/**
 * Parses Orchestrator response in Discovery Mode
 */
const parseDiscoveryOrchestrator = (responseText: string): 
  { agent: string; model: GeminiModel; reasoning?: string } | null => {
  
  // Check for consensus signal
  if (responseText.includes('CONSENSUS_REACHED')) {
    return { agent: 'CONSENSUS_REACHED', model: DEFAULT_MODEL };
  }

  // Check for wait signal
  if (responseText.includes(WAIT_FOR_USER)) {
    return { agent: WAIT_FOR_USER, model: DEFAULT_MODEL };
  }

  // Try JSON parsing
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agent: parsed.agent.toLowerCase(),
        model: parsed.model as GeminiModel,
        reasoning: parsed.reasoning
      };
    }
  } catch (e) {
    console.warn('[Discovery] Orchestrator JSON parse failed');
  }

  return null;
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
  
  const executor = createAgentExecutor(ai, rateLimiter, abortSignal);
  const conversationContents = buildConversationContents(messages, codebaseContext);
  
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
    conversationContents,
    {
      systemInstruction: DISCOVERY_ORCHESTRATOR_PROMPT,
      safetySettings: SAFETY_SETTINGS as any,
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
  const targetAgent = AGENT_PROFILES.find(a => 
    a.id.includes(routing.agent) || a.name.toLowerCase() === routing.agent
  );

  if (!targetAgent) {
    console.error(`[Discovery] Agent not found: ${routing.agent}`);
    return { consensusReached: false, agentTurns };
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
