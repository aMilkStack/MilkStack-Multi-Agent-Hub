Transform MilkStack from a "jump straight to execution" system into a true collaborative team experience with two distinct phases:

Phase 1: Discovery Mode (NEW)
User converses directly with specialized agents
Agents debate, critique, and propose alternatives
Orchestrator routes between agents based on conversation needs
No TaskMap generation - purely conversational
Living Team UX: see which agents are thinking/speaking
Exit Condition: User explicitly triggers execution ("Go ahead", "Implement this", or clicks button)
Phase 2: Execution Mode (EXISTING - Agency V2)
Product Planner creates TaskMap
Deterministic state machine execution
User approves plan, then system executes
Current workflow unchanged
Architecture Changes
1. New Type Definitions
File: src/types/workflow.ts (new file)

/**
 * Workflow phase tracking for two-phase system
 */
export enum WorkflowPhase {
  Discovery = 'discovery',      // Conversational debate phase
  ExecutionReady = 'execution-ready', // User can trigger execution
  Execution = 'execution'        // Agency V2 running
}

/**
 * Extended project state to track workflow phase
 */
export interface WorkflowPhaseState {
  phase: WorkflowPhase;
  readyToExecute: boolean;       // True when Orchestrator signals consensus
  consensusMessageId?: string;   // Message where consensus was reached
}
File: src/types/project.ts (update existing)

// Add to Project interface:
export interface Project {
  // ... existing fields ...
  workflowPhase?: WorkflowPhaseState;  // Track current phase
}
2. Discovery Mode Service
File: src/services/discoveryService.ts (new file)

This handles the conversational routing logic - simpler than Agency V2.

import { GoogleGenAI } from "@google/genai";
import { Agent, Message, GeminiModel } from '../../types';
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
      safetySettings: SAFETY_SETTINGS,
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
      safetySettings: SAFETY_SETTINGS,
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
3. Execution Trigger Detection
File: src/services/executionTriggerDetector.ts (new file)

import { Message } from '../../types';

/**
 * Keywords that signal user wants to start execution
 */
const EXECUTION_TRIGGER_KEYWORDS = [
  'go ahead',
  'implement',
  'execute',
  'start building',
  'build it',
  'make it',
  'create it',
  'do it',
  'proceed',
  'continue with implementation',
  'let\'s build',
];

/**
 * Detects if the user's message signals readiness for execution
 */
export const detectExecutionTrigger = (message: string): boolean => {
  const normalized = message.toLowerCase().trim();
  
  return EXECUTION_TRIGGER_KEYWORDS.some(keyword => 
    normalized.includes(keyword)
  );
};

/**
 * Checks conversation history for execution readiness
 * Returns true if recent messages show consensus + user approval
 */
export const isReadyForExecution = (messages: Message[]): boolean => {
  // Check last 3 messages for execution signals
  const recentMessages = messages.slice(-3);
  
  return recentMessages.some(msg => {
    if (typeof msg.author === 'string') { // User message
      return detectExecutionTrigger(msg.content);
    }
    return false;
  });
};
4. Modified Main Service
File: src/services/geminiService.ts (update existing)

Add imports at the top:

import { executeDiscoveryWorkflow } from './discoveryService';
import { isReadyForExecution, detectExecutionTrigger } from './executionTriggerDetector';
import { WorkflowPhase } from '../../types/workflow';
Replace the getAgentResponse function (line ~775):

export const getAgentResponse = async (
    apiKey: string,
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null,
    currentPhase?: WorkflowPhase  // NEW: Track current phase
): Promise<{ 
    updatedTaskState: ActiveTaskState | null;
    phaseChanged?: boolean;        // NEW: Signal phase transition
    newPhase?: WorkflowPhase;      // NEW: New phase if changed
}> => {
    if (!apiKey || !apiKey.trim()) {
        throw new Error("Gemini API key is missing. Please check your Settings or Project Settings.");
    }

    const trimmedKey = apiKey.trim();
    const ai = new GoogleGenAI({ apiKey: trimmedKey });

    // ========================================================================
    // PHASE DETECTION: Discovery vs Execution
    // ========================================================================
    
    // If we're already in execution mode or have an active task, continue with Agency V2
    if (currentPhase === WorkflowPhase.Execution || activeTaskState) {
        console.log('[Routing] Using Agency V2 Workflow (Execution Mode)');
        
        try {
            const result = await executeAgencyV2Workflow(
                ai,
                messages,
                codebaseContext,
                onNewMessage,
                onMessageUpdate,
                onAgentChange,
                abortSignal,
                activeTaskState
            );
            return { ...result, newPhase: WorkflowPhase.Execution };
        } catch (error) {
            console.error('[Execution] Error:', error);
            throw error;
        }
    }

    // ========================================================================
    // EXECUTION TRIGGER DETECTION
    // ========================================================================
    
    const lastMessage = messages[messages.length - 1];
    const userTriggeredExecution = lastMessage && 
        typeof lastMessage.author === 'string' && 
        detectExecutionTrigger(lastMessage.content);

    if (userTriggeredExecution || currentPhase === WorkflowPhase.ExecutionReady) {
        console.log('[Routing] User triggered execution - switching to Agency V2');
        
        // Signal phase change to UI
        const transitionMsg = {
            id: crypto.randomUUID(),
            author: 'Ethan',
            content: '**🚀 Switching to Execution Mode**\n\nCalling Product Planner to create implementation plan...',
            timestamp: new Date(),
        };
        onNewMessage(transitionMsg);

        try {
            const result = await executeAgencyV2Workflow(
                ai,
                messages,
                codebaseContext,
                onNewMessage,
                onMessageUpdate,
                onAgentChange,
                abortSignal,
                null // No active task yet
            );
            return { 
                ...result, 
                phaseChanged: true,
                newPhase: WorkflowPhase.Execution 
            };
        } catch (error) {
            console.error('[Execution] Error:', error);
            throw error;
        }
    }

    // ========================================================================
    // DISCOVERY MODE (Default)
    // ========================================================================
    
    console.log('[Routing] Using Discovery Mode (Conversational)');
    
    try {
        const result = await executeDiscoveryWorkflow(
            ai,
            messages,
            codebaseContext,
            onNewMessage,
            onMessageUpdate,
            onAgentChange,
            abortSignal
        );

        // If consensus reached, signal UI to show "Ready to Execute" button
        if (result.consensusReached) {
            const consensusMsg = {
                id: crypto.randomUUID(),
                author: 'Ethan',
                content: '**✅ Ready for Implementation**\n\nThe team has reached consensus. Click "Start Implementation" below or type "go ahead" when ready.',
                timestamp: new Date(),
            };
            onNewMessage(consensusMsg);

            return {
                updatedTaskState: null,
                phaseChanged: true,
                newPhase: WorkflowPhase.ExecutionReady
            };
        }

        return {
            updatedTaskState: null,
            newPhase: WorkflowPhase.Discovery
        };

    } catch (error) {
        console.error('[Discovery] Error:', error);
        throw error;
    }
};
5. UI Components
Component: ExecutionReadyPrompt
File: src/components/ExecutionReadyPrompt.tsx (new file)

import React from 'react';

interface ExecutionReadyPromptProps {
  onStartExecution: () => void;
  onContinueDiscussion: () => void;
}

const ExecutionReadyPrompt: React.FC<ExecutionReadyPromptProps> = ({
  onStartExecution,
  onContinueDiscussion
}) => {
  return (
    <div className="bg-milk-dark-light border-2 border-green-500/30 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-milk-lightest mb-2">
            Ready for Implementation
          </h3>
          <p className="text-milk-slate-light text-sm mb-4">
            The team has reached consensus on the approach. Start implementation to create a detailed plan and begin building.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onStartExecution}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Implementation
            </button>
            
            <button
              onClick={onContinueDiscussion}
              className="px-4 py-2 bg-milk-dark hover:bg-milk-dark-light text-milk-light font-medium rounded-lg transition-colors border border-milk-slate"
            >
              Continue Discussion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionReadyPrompt;
Update ChatView Component
File: src/components/ChatView.tsx (update existing)

Add import:

import ExecutionReadyPrompt from './ExecutionReadyPrompt';
import { WorkflowPhase } from '../../types/workflow';
Add props:

interface ChatViewProps {
  // ... existing props ...
  workflowPhase?: WorkflowPhase;
  onStartExecution?: () => void;
}
Add in component body (after WorkflowApprovalPrompt, around line 96):

{/* Execution Ready Prompt - Shows when consensus reached */}
{workflowPhase === WorkflowPhase.ExecutionReady && onStartExecution && (
  <div className="px-4 pb-4">
    <ExecutionReadyPrompt
      onStartExecution={onStartExecution}
      onContinueDiscussion={() => {
        // User wants to keep discussing - stays in discovery mode
        // No action needed, just close the prompt
      }}
    />
  </div>
)}
6. App.tsx Integration
File: src/App.tsx (update existing)

Add state tracking:

import { WorkflowPhase, WorkflowPhaseState } from './types/workflow';

// Inside App component:
const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>(WorkflowPhase.Discovery);
Update handleSendMessage to track phase:

const handleSendMessage = async (content: string) => {
  // ... existing code ...

  const result = await getAgentResponse(
    apiKey,
    updatedMessages,
    project.codebaseContext,
    handleNewMessage,
    handleMessageUpdate,
    handleAgentChange,
    abortControllerRef.current?.signal,
    project.activeTaskState,
    workflowPhase  // Pass current phase
  );

  // Handle phase changes
  if (result.phaseChanged && result.newPhase) {
    setWorkflowPhase(result.newPhase);
    
    // Update project with new phase
    await updateProject(project.id, {
      workflowPhase: {
        phase: result.newPhase,
        readyToExecute: result.newPhase === WorkflowPhase.ExecutionReady
      }
    });
  }

  // ... rest of existing code ...
};
Add handler for manual execution trigger:

const handleStartExecution = async () => {
  if (!activeProject) return;

  // Simulate user saying "go ahead"
  await handleSendMessage("go ahead");
};
Pass to ChatView:

<ChatView
  // ... existing props ...
  workflowPhase={workflowPhase}
  onStartExecution={handleStartExecution}
/>
Implementation Checklist
Phase 1: Foundation (Types & Detection)
 Create src/types/workflow.ts with WorkflowPhase enum
 Update src/types/project.ts to add workflowPhase field
 Create src/services/executionTriggerDetector.ts with keyword detection
 Test trigger detection with sample phrases
 Verify TypeScript compiles without errors
Phase 2: Discovery Service
 Create src/services/discoveryService.ts
 Implement DISCOVERY_ORCHESTRATOR_PROMPT
 Implement parseDiscoveryOrchestrator function
 Implement executeDiscoveryWorkflow function
 Test discovery workflow in isolation (unit test or manual)
 Verify Orchestrator can route to Director, Architect, Adversary
Phase 3: Main Service Integration
 Update src/services/geminiService.ts imports
 Modify getAgentResponse function signature (add currentPhase param)
 Add phase detection logic at function start
 Add execution trigger detection
 Add phase transition logging
 Test switching from Discovery → Execution
 Verify Agency V2 still works when triggered
Phase 4: UI Components
 Create src/components/ExecutionReadyPrompt.tsx
 Style component to match existing design system
 Add "Start Implementation" button
 Add "Continue Discussion" button
 Test button click handlers
 Update src/components/ChatView.tsx to show prompt
 Position prompt between messages and input (like WorkflowApprovalPrompt)
Phase 5: App Integration
 Update src/App.tsx imports
 Add workflowPhase state
 Update handleSendMessage to pass phase to getAgentResponse
 Handle phase change results from service
 Update project storage with new phase
 Create handleStartExecution function
 Pass new props to ChatView
 Test phase persistence across page reloads
Phase 6: Testing & Refinement
 Test Flow 1: User asks question → Director responds → User continues discussion
 Test Flow 2: User asks about architecture → Architect proposes → Adversary critiques
 Test Flow 3: Consensus reached → "Ready to Execute" shows → User clicks button → Agency V2 starts
 Test Flow 4: User types "go ahead" → System switches to execution immediately
 Test Flow 5: User in discovery mode → types "implement this" → Planner creates TaskMap
 Edge Case: Orchestrator fails to parse → Fallback behavior
 Edge Case: User clicks "Continue Discussion" → Prompt dismisses, stays in discovery
 Edge Case: Page reload during discovery → Phase persists correctly
User Experience Flow
Example Conversation
User: "I need to build a login system for my SaaS app"

[DISCOVERY MODE STARTS]

Orchestrator: [routes to Director]

Product Planner: "Before we architect this, let's establish requirements. 
What's the user scale? Are we talking B2B with SSO requirements, 
or B2C with social logins? What's the security sensitivity?"

User: "B2C, social logins preferred, moderate security (no payments yet)"

Orchestrator: [routes to Architect]

Architect: "Given B2C + social logins, I recommend:

Option A: OAuth 2.0 with Google/GitHub + JWT sessions
- Pros: Fast implementation, users trust these providers
- Cons: Dependency on third parties

Option B: Passwordless (magic links) + Optional social
- Pros: Better UX, no password management
- Cons: Email delivery dependency

Which aligns better with your product vision?"

User: "Option A sounds good, but what about security?"

Orchestrator: [routes to Adversary]

Adversary: "Option A reduces attack surface but introduces risks:
1. Token hijacking if not using httpOnly cookies
2. CSRF if not using state parameter correctly
3. No fallback if OAuth provider is down

Mitigations:
- Store tokens in httpOnly cookies (not localStorage)
- Implement CSRF tokens
- Add rate limiting on auth endpoints
- Consider email magic link as backup

These must be in the implementation plan."

User: "Good points. Let's do OAuth with those security measures. Go ahead."

[EXECUTION TRIGGER DETECTED - SYSTEM SWITCHES TO AGENCY V2]

System: "🚀 Switching to Execution Mode
Calling Product Planner to create implementation plan..."

Product Planner: [Creates TaskMap with:
- Task 1: Setup OAuth providers (Google, GitHub)
- Task 2: Implement JWT with httpOnly cookies
- Task 3: Add CSRF protection
- Task 4: Rate limiting
- Task 5: Testing & security audit
]

[WorkflowApprovalPrompt shows - user approves plan]

[Agency V2 executes: Builder → Reviewer → Synthesis → Complete]
Benefits of This Approach
Preserves Initial Spec Vision: Brings back the "Living Team" conversation
Keeps Current Robustness: Agency V2 execution engine unchanged
User Control: Explicit trigger for when to stop debating and start building
Progressive Enhancement: Adds discovery mode without breaking existing functionality
Natural Workflow: Mirrors real team dynamics (debate → consensus → execution)
Flexible Exit: User can trigger execution anytime by typing "go ahead"
Alternative Enhancements (Optional, Post-MVP)
Smart Consensus Detection: Train Orchestrator to detect when debate naturally concludes
Debate Summaries: Auto-generate summary of decisions before switching to execution
Phase History: Track how long spent in each phase for analytics
Agent Voting: Show which agents "agree" with proposed solution
Return to Discovery: Add "Pause & Revise" button during execution to return to debate
