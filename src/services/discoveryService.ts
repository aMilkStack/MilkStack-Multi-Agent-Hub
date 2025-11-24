/**
 * Discovery Service
 * Handles conversational agent routing in Discovery Mode
 * Agents debate and explore options before committing to execution
 */

import { GoogleGenAI } from "@google/genai";
import { Agent, Message, GeminiModel } from '../types';
import { AGENT_PROFILES, WAIT_FOR_USER } from '../agents';
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

  const availableAgents = AGENT_PROFILES
    .filter(agent => !excludedAgents.includes(agent.id))
    .map(agent => `- **${agent.id}**: ${agent.description}`)
    .join('\n');

  return `
${availableAgents}

**Total Available Agents:** ${AGENT_PROFILES.length - excludedAgents.length}
`;
};

/**
 * Orchestrator prompt for Discovery Mode
 * Focuses on routing for exploration, debate, and consensus-building
 */
const DISCOVERY_ORCHESTRATOR_PROMPT = `
You are the Orchestrator for a collaborative software team in DISCOVERY MODE.

**Your Role:**
Analyze the conversation history and route to the most appropriate specialist agent(s) for exploration, debate, and consensus-building.

**CRITICAL OUTPUT FORMAT:**
You MUST return ONLY valid JSON (no markdown, no explanation):
{
  "agent": "<full-agent-id>",
  "model": "<model-name>",
  "reasoning": "<brief explanation>"
}

**Available Agents:**
${getDiscoveryAgentsList()}

**🎯 ROUTING INTELLIGENCE:**

**1. MULTI-TURN CONVERSATIONS:**
   - After an agent responds, ask yourself: "Should another agent weigh in?"
   - Examples:
     * System Architect proposes design → Route to Adversarial Thinker for critique
     * Debug Specialist finds bug → Route to Issue Scope Analyzer to assess impact
     * Builder implements code → Route to UX Evaluator to check user experience
     * Market Research Specialist suggests feature → Route to System Architect for feasibility
   - Continue routing until all relevant perspectives are covered
   - Then return WAIT_FOR_USER

**2. ROUTING HEURISTICS (Priority Order):**

   a) **Architecture & Design Questions**
      → agent-system-architect-001
      → Follow up with agent-adversarial-thinker-001 for critique

   b) **Bugs, Errors, "Not Working"**
      → agent-debug-specialist-001
      → Consider agent-issue-scope-analyzer-001 if bug scope unclear

   c) **Security, Vulnerabilities, Edge Cases**
      → agent-adversarial-thinker-001

   d) **Implementation (Simple & Clear)**
      → agent-builder-001

   e) **Implementation (Complex/Performance)**
      → agent-advanced-coding-specialist-001

   f) **UX & Usability Questions**
      → agent-ux-evaluator-001

   g) **Visual Design (UI/Layout/Colors)**
      → agent-visual-design-specialist-001

   h) **Infrastructure (CI/CD/Docker/Deploy)**
      → agent-infrastructure-guardian-001

   i) **Documentation Requests**
      → agent-knowledge-curator-001

   j) **Concept Explanations**
      → agent-fact-checker-explainer-001

   k) **Deep Technical Research**
      → agent-deep-research-specialist-001

   l) **Market/Business Analysis**
      → agent-market-research-specialist-001

   m) **Change Impact Analysis**
      → agent-issue-scope-analyzer-001

**3. AGENT @MENTIONS:**
   - If an agent mentions another agent (e.g., "@adversarial-thinker"), route to that agent next
   - Example: "I'd like @ux-evaluator to review this design" → route to agent-ux-evaluator-001

**4. CONSENSUS DETECTION:**
   - If conversation shows clear agreement AND user signals readiness:
     * Phrases: "that sounds good", "let's do that", "implement this", "go ahead"
     * Return: {"agent": "CONSENSUS_REACHED", "model": "gemini-2.0-flash-exp"}
   - This transitions from Discovery → Execution Mode

**5. WAIT_FOR_USER:**
   Return this when:
   - All relevant agents have weighed in
   - Current agent fully addressed the question
   - User input is needed to continue
   - You're uncertain what to do next

**EXAMPLES:**

Example 1: Architecture Question
User: "How should I design a caching system?"
Turn 1: Route to agent-system-architect-001 (proposes Redis design)
Turn 2: Route to agent-adversarial-thinker-001 (critiques: "What about Redis failure?")
Turn 3: Route to agent-system-architect-001 (updates design with fallback)
Turn 4: Route to agent-ux-evaluator-001 (confirms design meets user needs)
Final: WAIT_FOR_USER (all perspectives covered)

Example 2: Bug Report
User: "The app crashes when I click submit"
Turn 1: Route to agent-debug-specialist-001 (investigates root cause)
Turn 2: Route to agent-issue-scope-analyzer-001 (analyzes impact: "Affects 3 components")
Turn 3: Route to agent-builder-001 (proposes fix)
Final: WAIT_FOR_USER (issue fully analyzed)

Example 3: Agent Mention
System Architect: "I've designed the API. I'd like @adversarial-thinker to review for security"
→ Route to agent-adversarial-thinker-001

**IMPORTANT RULES:**
- ALWAYS return FULL agent IDs (e.g., "agent-adversarial-thinker-001")
- NEVER route to "agent-product-planner-001" in Discovery Mode
- Use gemini-2.0-flash-exp for most agents (fast, cost-effective)
- Use gemini-2.5-pro for complex reasoning (System Architect, Adversarial Thinker)
- If you're unsure → return WAIT_FOR_USER (user maintains control)
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

  console.log('[Discovery] Starting multi-turn conversational workflow');

  const executor = createAgentExecutor(ai, sharedRateLimiter, abortSignal);
  let agentTurns = 0;
  const MAX_DISCOVERY_TURNS = 10; // Prevent infinite loops

  // 🔁 START MULTI-TURN LOOP
  while (agentTurns < MAX_DISCOVERY_TURNS) {

    // ✅ REBUILD CONTEXT ON EACH ITERATION (so orchestrator sees latest messages)
    const orchestratorContext = buildOrchestratorContext(messages, codebaseContext);
    const isFirstMessage = messages.length === 1;
    const conversationContents = buildConversationContents(
      messages,
      codebaseContext,
      'discovery',
      isFirstMessage
    );

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
      onAgentChange(null);
      return { consensusReached: false, agentTurns };
    }

    // ✅ CHECK FOR EXIT CONDITIONS

    // Exit 1: Consensus reached
    if (routing.agent === 'CONSENSUS_REACHED') {
      console.log('[Discovery] Consensus reached - ready for execution');
      onAgentChange(null);
      return { consensusReached: true, agentTurns };
    }

    // Exit 2: Wait for user
    if (routing.agent === WAIT_FOR_USER) {
      console.log('[Discovery] Orchestrator returned WAIT_FOR_USER - conversation complete');
      onAgentChange(null);
      return { consensusReached: false, agentTurns };
    }

    // ✅ ROUTE TO SPECIALIST AGENT
    const targetAgent = AGENT_PROFILES.find(a => a.id === routing.agent);

    if (!targetAgent) {
      throw new Error(`[Discovery] Orchestrator routed to unknown agent: ${routing.agent}. Valid agents: ${AGENT_PROFILES.map(a => a.id).join(', ')}`);
    }

    console.log(`[Discovery] Turn ${agentTurns + 1}: Routing to ${targetAgent.name}`);
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

    // ✅ ADD AGENT'S RESPONSE TO MESSAGES (so next orchestrator call sees it)
    const agentMessage: Message = {
      id: crypto.randomUUID(),
      author: targetAgent,
      content: agentResponse,
      timestamp: new Date(),
    };

    onNewMessage(agentMessage);
    messages.push(agentMessage); // ← KEY: Add to messages array for next iteration

    onAgentChange(null);
    agentTurns++;

    console.log(`[Discovery] Turn ${agentTurns} complete. Checking if more agents should respond...`);

    // 🔄 LOOP BACK - Orchestrator will analyze updated messages and decide next agent
  }

  // ✅ MAX TURNS REACHED
  console.log(`[Discovery] Max turns (${MAX_DISCOVERY_TURNS}) reached. Returning to user.`);
  onAgentChange(null);
  return { consensusReached: false, agentTurns };
};
