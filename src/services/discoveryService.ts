/**
 * Discovery Service
 * Handles conversational agent routing in Discovery Mode
 * Agents debate and explore options before committing to execution
 */

import { GoogleGenAI } from "@google/genai";
import { Message, GeminiModel, WorkflowPhase } from '../types';
import { AGENT_PROFILES, WAIT_FOR_USER } from '../agents';
import { buildConversationContents } from './geminiService';
import { buildOrchestratorContext } from '../utils/smartContext';
import { createAgentExecutor } from './AgentExecutor';
import { sharedRateLimiter } from './rateLimiter';
import { SAFETY_SETTINGS, DEFAULT_MODEL } from '../config/ai';
import {
  findAgentByIdentifier,
  getOrchestratorAgentList,
  isSpecialIdentifier,
  SPECIAL_IDENTIFIERS,
} from '../utils/agentIdentifiers';

/**
 * Generate agent list for discovery prompt from canonical AGENT_PROFILES
 * Uses simple identifiers that orchestrator can return
 */
const getDiscoveryAgentsList = (): string => {
  // Exclude agents not suitable for discovery mode
  const excludedAgents = [
    'agent-orchestrator-001',           // Used internally for routing
    'agent-product-planner-001',        // Execution mode only per spec
    'agent-orchestrator-parse-error-handler-001' // Internal error handling
  ];

  const availableAgents = getOrchestratorAgentList(excludedAgents);

  const agentList = availableAgents
    .map(
      (agent) =>
        `- **${agent.identifier}** (${agent.name}): ${agent.description}`
    )
    .join('\n');

  return `
${agentList}

**Total Available Agents:** ${availableAgents.length}

**IMPORTANT:** Return simple identifiers (e.g., "product-planner", "builder") NOT full IDs.
`;
};

/**
 * Orchestrator prompt for Discovery Mode
 * Focuses on routing for exploration, debate, and consensus-building
 */
const DISCOVERY_ORCHESTRATOR_PROMPT = `
You are the Orchestrator for a collaborative software team in DISCOVERY MODE.

**Your Role:**
Analyze the conversation history and route to the most appropriate specialist agent for exploration, debate, and consensus-building.

**⚠️ CRITICAL: OUTPUT FORMAT**
You MUST return ONLY valid JSON. NO markdown, NO explanation, NO wrapper text.

CORRECT FORMAT:
{"agent": "system-architect", "model": "gemini-2.5-pro", "reasoning": "User asked about architecture"}

WRONG - Do NOT do this:
\`\`\`json
{"agent": "system-architect", ...}
\`\`\`

WRONG - Do NOT do this:
I think we should route to system architect: {"agent": ...}

**📋 Available Agents:**
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
      → system-architect
      → Follow up with adversarial-thinker for critique

   b) **Bugs, Errors, "Not Working"**
      → debug-specialist
      → Consider issue-scope-analyzer if bug scope unclear

   c) **Security, Vulnerabilities, Edge Cases**
      → adversarial-thinker

   d) **Implementation (Simple & Clear)**
      → builder

   e) **Implementation (Complex/Performance)**
      → advanced-coding-specialist

   f) **UX & Usability Questions**
      → ux-evaluator

   g) **Visual Design (UI/Layout/Colors)**
      → visual-design-specialist

   h) **Infrastructure (CI/CD/Docker/Deploy)**
      → infrastructure-guardian

   i) **Documentation Requests**
      → knowledge-curator

   j) **Concept Explanations**
      → fact-checker-explainer

   k) **Deep Technical Research**
      → deep-research-specialist

   l) **Market/Business Analysis**
      → market-research-specialist

   m) **Change Impact Analysis**
      → issue-scope-analyzer

**3. AGENT @MENTIONS:**
   - If an agent mentions another agent (e.g., "@adversarial-thinker"), route to that agent next
   - Example: "I'd like @ux-evaluator to review this design" → route to ux-evaluator
   - Parse mentions flexibly: "@builder", "call Builder", "ask the UX person"

**4. CONSENSUS DETECTION:**
   - If conversation shows clear agreement AND user signals readiness:
     * Phrases: "that sounds good", "let's do that", "implement this", "go ahead", "yes", "approve"
     * Return: {"agent": "CONSENSUS_REACHED", "model": "gemini-2.5-pro"}
   - This transitions from Discovery → Execution Mode

**5. WAIT_FOR_USER:**
   Return this when:
   - All relevant agents have weighed in
   - Current agent fully addressed the question
   - User input is needed to continue
   - You're uncertain what to do next
   - Format: {"agent": "WAIT_FOR_USER", "model": "gemini-2.5-pro"}

**EXAMPLES:**

Example 1: Architecture Question
User: "How should I design a caching system?"
Turn 1: {"agent": "system-architect", "model": "gemini-2.5-pro", "reasoning": "Architecture design question"}
Turn 2: {"agent": "adversarial-thinker", "model": "gemini-2.5-pro", "reasoning": "Critique Redis design"}
Turn 3: {"agent": "system-architect", "model": "gemini-2.5-pro", "reasoning": "Address failure scenarios"}
Turn 4: {"agent": "ux-evaluator", "model": "gemini-2.5-pro", "reasoning": "Verify UX impact"}
Final: {"agent": "WAIT_FOR_USER", "model": "gemini-2.5-pro", "reasoning": "All perspectives covered"}

Example 2: Bug Report
User: "The app crashes when I click submit"
Turn 1: {"agent": "debug-specialist", "model": "gemini-2.5-pro", "reasoning": "Investigate crash"}
Turn 2: {"agent": "issue-scope-analyzer", "model": "gemini-2.5-pro", "reasoning": "Assess impact"}
Turn 3: {"agent": "builder", "model": "gemini-2.5-pro", "reasoning": "Propose fix"}
Final: {"agent": "WAIT_FOR_USER", "model": "gemini-2.5-pro", "reasoning": "Solution ready for user"}

Example 3: Agent Mention
System Architect: "I've designed the API. I'd like @adversarial-thinker to review for security"
→ {"agent": "adversarial-thinker", "model": "gemini-2.5-pro", "reasoning": "Security review requested"}

Example 4: User Ready for Implementation
User: "That looks great, let's go ahead and implement it"
→ {"agent": "CONSENSUS_REACHED", "model": "gemini-2.5-pro", "reasoning": "User approved plan"}

**IMPORTANT RULES:**
- ✅ ALWAYS return simple identifiers (e.g., "system-architect", "builder")
- ❌ NEVER use full IDs (e.g., "agent-system-architect-001")
- ❌ NEVER route to "product-planner" in Discovery Mode (execution only)
- Use gemini-2.5-pro for most agents (best quality)
- Use gemini-2.5-flash for simple queries (faster, cheaper)
- When uncertain → return WAIT_FOR_USER (user maintains control)
`;

/**
 * Parse orchestrator response with robust error handling
 * Returns the agent identifier, or null if parsing fails
 */
const parseDiscoveryOrchestrator = (
  responseText: string,
  retryCount: number = 0
): { agent: string; model: GeminiModel; reasoning?: string } | null => {
  try {
    const parsed = JSON.parse(responseText.trim());

    // Validate required fields
    if (!parsed.agent || !parsed.model) {
      console.error('[Discovery] Invalid orchestrator response: missing agent or model');
      console.error('[Discovery] Parsed object:', parsed);
      return null;
    }

    const agentIdentifier = parsed.agent.trim();

    // Check for special identifiers first (case-sensitive)
    if (isSpecialIdentifier(agentIdentifier)) {
      return {
        agent: agentIdentifier,
        model: parsed.model as GeminiModel,
        reasoning: parsed.reasoning,
      };
    }

    // Return the identifier as-is (will be normalized by findAgentByIdentifier)
    return {
      agent: agentIdentifier,
      model: parsed.model as GeminiModel,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error(`[Discovery] Orchestrator JSON parse failed (attempt ${retryCount + 1}):`, error);
    console.error('[Discovery] Response text:', responseText);

    // Attempt to extract JSON from markdown if it's wrapped
    const jsonMatch = responseText.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch && retryCount === 0) {
      console.log('[Discovery] Attempting to extract JSON from markdown wrapper...');
      return parseDiscoveryOrchestrator(jsonMatch[1], retryCount + 1);
    }

    // Attempt to find any JSON object in the text
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch && retryCount === 0) {
      console.log('[Discovery] Attempting to extract JSON object from text...');
      return parseDiscoveryOrchestrator(objectMatch[0], retryCount + 1);
    }

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
      WorkflowPhase.Discovery,
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
    if (routing.agent === SPECIAL_IDENTIFIERS.CONSENSUS_REACHED) {
      console.log('[Discovery] Consensus reached - ready for execution');
      onAgentChange(null);
      return { consensusReached: true, agentTurns };
    }

    // Exit 2: Wait for user
    if (routing.agent === SPECIAL_IDENTIFIERS.WAIT_FOR_USER || routing.agent === WAIT_FOR_USER) {
      console.log('[Discovery] Orchestrator returned WAIT_FOR_USER - conversation complete');
      onAgentChange(null);
      return { consensusReached: false, agentTurns };
    }

    // ✅ ROUTE TO SPECIALIST AGENT using normalization utility
    const targetAgent = findAgentByIdentifier(routing.agent);

    if (!targetAgent) {
      console.error(
        `[Discovery] Orchestrator routed to unknown agent: "${routing.agent}"`
      );
      console.error('[Discovery] Available identifiers:', getOrchestratorAgentList().map(a => a.identifier));

      // Fallback: return WAIT_FOR_USER instead of throwing
      console.log('[Discovery] Falling back to WAIT_FOR_USER due to unknown agent');
      onAgentChange(null);
      return { consensusReached: false, agentTurns };
    }

    console.log(`[Discovery] Turn ${agentTurns + 1}: Routing to ${targetAgent.name}`);
    onAgentChange(targetAgent.id);

    // ✅ CREATE PLACEHOLDER MESSAGE FIRST (so streaming has a target)
    const agentMessage: Message = {
      id: crypto.randomUUID(),
      author: targetAgent,
      content: '', // Start empty, updates will append via onMessageUpdate
      timestamp: new Date(),
    };
    onNewMessage(agentMessage);
    messages.push(agentMessage); // Track locally for next iteration

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
        // Update local message content so orchestrator sees it next turn
        agentMessage.content += chunk;
      }
    );

    onAgentChange(null);
    agentTurns++;

    // ⏳ RATE LIMITING: Add delay between turns to prevent API overload
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`[Discovery] Turn ${agentTurns} complete. Checking if more agents should respond...`);

    // 🔄 LOOP BACK - Orchestrator will analyze updated messages and decide next agent
  }

  // ✅ MAX TURNS REACHED
  console.log(`[Discovery] Max turns (${MAX_DISCOVERY_TURNS}) reached. Returning to user.`);
  onAgentChange(null);
  return { consensusReached: false, agentTurns };
};
