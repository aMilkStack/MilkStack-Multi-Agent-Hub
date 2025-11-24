# Multi-Agent System Response Architecture Analysis

## Executive Summary

The multi-agent system has a **fundamental architectural limitation** that prevents agents from responding to each other in a turn-based fashion. When one agent (like Systems Architect) responds, the system immediately returns control to the user rather than allowing other agents to respond to that agent's output. This is by design in Discovery Mode, but it prevents the collaborative debate and iterative improvement that the system claims to support.

---

## Architecture Overview

### Two Execution Modes

The system operates in two distinct modes:

#### 1. **Discovery Mode** (Conversational/Default)
- **Purpose**: User-driven exploration and debate
- **Flow**: User → Orchestrator → Single Agent → Stop (wait for user)
- **File**: `/src/services/discoveryService.ts`
- **Current Limitation**: Agents cannot respond to each other automatically

#### 2. **Execution Mode** (Agency V2 Workflow)
- **Purpose**: Multi-stage task execution with parallel reviews
- **Flow**: Product Planner → Sequential/Parallel stages → Synthesis
- **File**: `/src/services/geminiService.ts` (executeAgencyV2Workflow)
- **Current State**: Agents in same stage execute in parallel, but don't respond to each other

---

## Discovery Mode: Where the Problem Lives

### Current Flow (Discovery Mode)

```
User Message
    ↓
[App.tsx] triggerAgentResponse()
    ↓
[discoveryService.ts] executeDiscoveryWorkflow()
    ↓
    1. Call Orchestrator to route
    ↓
    2. Execute single specialist agent
    ↓
    3. Add agent response to messages
    ↓
    Return { consensusReached: false, agentTurns: 1 }
    ↓
[App.tsx] Waiting for user input...
```

### Key Code Section

**File**: `/src/services/discoveryService.ts` (Lines 123-226)

```typescript
export const executeDiscoveryWorkflow = async (
  ai: GoogleGenAI,
  messages: Message[],
  codebaseContext: string,
  onNewMessage: (message: Message) => void,
  onMessageUpdate: (chunk: string) => void,
  onAgentChange: (agentId: string | null) => void,
  abortSignal?: AbortSignal
): Promise<{ consensusReached: boolean; agentTurns: number }> => {
  
  const executor = createAgentExecutor(ai, sharedRateLimiter, abortSignal);
  
  let agentTurns = 0;
  const MAX_DISCOVERY_TURNS = 10; // Unused - never incremented!

  // Step 1: Call Orchestrator (Lines 145-166)
  // Orchestrator is called but its JSON output is consumed to route to one agent
  
  // Step 2: Execute single agent (Lines 197-211)
  let agentResponse = '';
  await executor.executeStreaming(
    targetAgent,
    routing.model,
    conversationContents,
    { systemInstruction: targetAgent.prompt, ... },
    (chunk) => {
      onMessageUpdate(chunk);
      agentResponse += chunk;
    }
  );

  // Step 3: Add to message history (Lines 214-220)
  const agentMessage: Message = {
    id: crypto.randomUUID(),
    author: targetAgent,
    content: agentResponse,
    timestamp: new Date(),
  };
  onNewMessage(agentMessage);

  // Step 4: Return immediately
  onAgentChange(null);
  agentTurns++;
  return { consensusReached: false, agentTurns }; // Line 225 - STOP HERE
};
```

### Why It Stops Here

The function **returns immediately** after executing one agent. There's no loop to:
- Check if other agents should respond
- Allow agents to build on each other's responses
- Manage turn-based debates

---

## The @mention Feature: A Workaround That Doesn't Work

### What the Code Says It Does

Each agent's prompt includes:
```
I can @mention other agents when I need help: @builder, @debug-specialist, ...
```

**Example from System Architect prompt** (`/src/agents/system-architect.ts`, Line 9):
```
I can @mention other agents when I need help: @builder, @debug-specialist, 
@advanced-coding-specialist, @ux-evaluator, @visual-design-specialist, 
@adversarial-thinker, @product-planner, @infrastructure-guardian, 
@knowledge-curator, @fact-checker-explainer, @deep-research-specialist, 
@market-research-specialist, @issue-scope-analyzer.
```

### What Actually Happens

The @mention feature exists **only in agent prompts** as a suggestion. There's **no mechanism** to:
1. Detect @mentions in agent responses
2. Route to the mentioned agent automatically
3. Continue the conversation with the mentioned agent

**Code Evidence**: 
- The `detectAgentMention()` function exists in `/src/services/geminiService.ts` (Lines 132-148) but is **only used in Execution Mode**, not in Discovery Mode
- It's called nowhere in the discoveryService.ts

---

## The Orchestrator's Role: Limited to Routing

### Orchestrator Prompt in Discovery Mode

**File**: `/src/services/discoveryService.ts` (Lines 38-81)

```typescript
const DISCOVERY_ORCHESTRATOR_PROMPT = `
You are the Orchestrator for a collaborative software team in DISCOVERY MODE.

**Your Role:**
Route user questions to the most appropriate specialist agent for exploration and debate.
DO NOT create plans or task maps yet - focus on helping the user explore options and make decisions.

**Consensus Detection:**
If the conversation shows clear agreement on approach AND the user seems ready to implement:
- Return: {"agent": "CONSENSUS_REACHED", "model": "gemini-2.0-flash-exp"}

...

**Output Format:**
Return ONLY valid JSON (no markdown, no explanation):
{
  "agent": "<full-agent-id>",
  "model": "<model-name>",
  "reasoning": "<brief explanation>"
}
```

### What the Orchestrator Actually Does

The Orchestrator is called **once per user message** to:
1. Decide which agent to call
2. Not to manage multi-agent discussions

The Orchestrator's response is **parsed and consumed** - it routes to ONE agent, then that's it.

---

## Turn Management Constants

### Current Constants

**File**: `/constants.ts` (Lines 4-7)

```typescript
export const MAX_AGENT_TURNS = 10;          // Defined but NEVER USED
export const WAIT_FOR_USER = 'WAIT_FOR_USER';  // Used to stop conversations
export const MAX_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 2000;
```

**Problem**: `MAX_AGENT_TURNS = 10` is **never actually used** in the Discovery Mode workflow. It's imported but not referenced in discoveryService.ts.

### Execution Mode Safety Limit

**File**: `/src/services/geminiService.ts` (Line 25)

```typescript
const MAX_CONSECUTIVE_AUTO_TURNS = 5;

// Line 449-456
const lastMessages = messages.slice(-MAX_CONSECUTIVE_AUTO_TURNS);
const allAgents = lastMessages.every(m => typeof m.author !== 'string');

if (lastMessages.length >= MAX_CONSECUTIVE_AUTO_TURNS && allAgents) {
    const stopMsg = createSystemMessage(`🛑 **Safety Stop**: Maximum consecutive...`);
    onNewMessage(stopMsg);
    return { updatedTaskState: engine.getState() }; // Exit without advancing
}
```

This limit **only applies to Execution Mode**, not Discovery Mode.

---

## Response Architecture in Detail

### How Messages Flow to Agents

**File**: `/src/services/geminiService.ts` (Lines 200-292)

```typescript
export const buildConversationContents = (
    messages: Message[],
    codebaseContext: string,
    phase: WorkflowPhase = 'discovery',
    isFirstMessage: boolean = false
): ConversationContents => {
    // Build conversation history...
    
    // CRITICAL FIX: Only merge consecutive USER messages
    // Each agent must have its own distinct turn (Line 281)
    if (lastContent && lastContent.role === role && role === 'user') {
        lastContent.parts[0].text += `\n\n---\n\n${messageText}`;
    } else {
        contents.push({
            role,
            parts: [{ text: messageText }]
        });
    }
    
    return contents;
};
```

**Key Points**:
- Agent messages are **never merged** together
- Each agent response gets its own conversation turn
- But there's **no mechanism** to automatically route to the next agent

### Agent Execution in Discovery Mode

**File**: `/src/services/discoveryService.ts` (Lines 197-211)

```typescript
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
```

**Execution is streaming** but **non-iterative** - once the agent completes, the function returns.

---

## App-Level Message Handling

### How Messages Are Added

**File**: `/App.tsx` (Lines 195-220)

```typescript
const onNewMessage = (message: Message) => {
    const currentProject = projects.find(p => p.id === projectId);
    if (!currentProject) return;
    updateMessages(projectId, [...currentProject.messages, message]);
};

const result = await getAgentResponse(
    undefined,
    history,
    project.codebaseContext,
    onNewMessage,
    onMessageUpdate,
    onAgentChange,
    controller.signal,
    project.activeTaskState || null,
    workflowPhase
);

// Update project with returned task state (if any)
if (result.updatedTaskState !== undefined) {
    updateProject(projectId, { activeTaskState: result.updatedTaskState || undefined });
}
```

**Key Flow**:
1. `getAgentResponse()` is called once per user message
2. During execution, `onNewMessage()` is called whenever an agent responds
3. After the function returns, the system waits for user input

### Message Sending

**File**: `/App.tsx` (Lines 278-310)

```typescript
const handleSendMessage = useCallback(async (content: string) => {
    // Build message
    const userMessage: Message = {
        id: crypto.randomUUID(),
        author: 'Ethan',
        content,
        timestamp: new Date(),
        queuedUntil,
    };

    const fullHistory = [...activeProject.messages, userMessage];
    updateMessages(activeProjectId, fullHistory);

    // If not queued, send immediately
    if (!queuedUntil) {
        await triggerAgentResponse(fullHistory, activeProjectId);
    }
}, []);
```

**Key Points**:
- User messages are added to history
- `triggerAgentResponse()` is called **once** per user message
- Returns **once agent responds** - no multi-agent turns

---

## Execution Mode: Parallel but Not Conversational

### Multi-Stage Task Execution

**File**: `/src/services/geminiService.ts` (Lines 332-796)

The `executeAgencyV2Workflow` function handles:
1. Product Planner creates a Task Map
2. Sequential execution of single-agent stages
3. Parallel execution of CODE_REVIEW stages (multiple agents review same code)
4. SYNTHESIZE stages (combine feedback)

### Parallel Execution Example

**File**: `/src/services/geminiService.ts` (Lines 590-769)

```typescript
} else {
    // Parallel: Multiple agents in CODE_REVIEW or PLAN_REVIEW (Line 591)
    console.log(`[Agency V2] Executing ${currentStage.agents.length} agents in parallel`);

    // Map agents to parallel promises (Line 666)
    const parallelPromises = stageAgents.map(async (agent, index) => {
        const result = await executor.executeNonStreaming(
            agent,
            stageAgentDef.model,
            conversationContents,
            agentConfig
        );
        return { success: true, agentName: agent.name, content: result.content, agent };
    });

    const rawResults = await Promise.all(parallelPromises);

    // Collect feedback using engine (Line 735-737)
    results.forEach(r => {
        engine.addFeedback(r.agentName, r.content);
    });

    // Display each agent's feedback as a message (Line 740-753)
    for (const result of results) {
        const agentMessage: Message = { ... };
        onNewMessage(agentMessage);
        currentHistory.push(agentMessage);
    }
}
```

**Key Limitation**: Agents in parallel stages all respond to the **same context** - the original code. They don't respond to each other's feedback.

---

## Why Agents Can't Respond to Each Other

### Root Cause #1: Single-Turn Function Design

The `executeDiscoveryWorkflow()` function is designed to:
1. Get routed agent from Orchestrator
2. Execute that agent once
3. Return

**There's no loop** to:
- Check if other agents should respond
- Rerun the Orchestrator with updated context
- Allow for multiple agent turns

### Root Cause #2: WAIT_FOR_USER Default Behavior

**File**: `/src/services/discoveryService.ts` (Lines 181-185)

```typescript
if (routing.agent === WAIT_FOR_USER) {
    console.log('[Discovery] Orchestrator returned WAIT_FOR_USER');
    onAgentChange(null);
    return { consensusReached: false, agentTurns };
}
```

When Orchestrator returns `WAIT_FOR_USER` (which it defaults to after any agent responds), the system **immediately stops** and waits for user input.

**Orchestrator Prompt** says:
```
**DEFAULT** → WAIT_FOR_USER
- After any agent completes their task
- When uncertain what to do next
- When workflow is complete
```

This is the **explicit design** - agents don't automatically continue conversations.

### Root Cause #3: No Agent-to-Agent Routing

The system has three routing mechanisms:

1. **User triggers agent** (Discovery Mode)
   - Orchestrator decides which agent to call
   - That agent executes
   - System returns to user

2. **Task map drives agents** (Execution Mode)
   - Product Planner creates stages
   - Each stage executes agents in sequence or parallel
   - Agents don't respond to each other's output; they all respond to the original task

3. **Parallel reviews** (Execution Mode only)
   - Multiple agents review same artifact
   - They don't see each other's feedback during their own execution
   - Feedback is collected and synthesized later

**There is no mechanism for**: Agent A's output → triggers Orchestrator → routes to Agent B → Agent B responds to A's output → routing continues

---

## @mention Detection Code (Unused in Discovery)

### Function Definition

**File**: `/src/services/geminiService.ts` (Lines 132-148)

```typescript
const detectAgentMention = (content: string): string | null => {
    const mentionPattern = /@([a-z-]+)/i;
    const match = content.match(mentionPattern);

    if (match) {
        const mentionedIdentifier = match[1].toLowerCase();
        const allAgentIdentifiers = AGENT_PROFILES.map(p =>
            p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
        );

        if (allAgentIdentifiers.includes(mentionedIdentifier)) {
            return mentionedIdentifier;
        }
    }

    return null;
};
```

### Where It's Actually Used

**File**: `/src/services/geminiService.ts` (Line 16)

Imported into geminiService but **grep shows it's never called in the file**. It exists but is dead code.

### Never Used For:
- Routing in Discovery Mode
- Triggering automated agent-to-agent communication
- Validating agent @mentions in responses

---

## The Design Intent vs. Reality

### What the Code Suggests Agents Should Do

**From System Architect prompt** (`/src/agents/system-architect.ts`):
```
I can @mention other agents when I need help: @builder, @debug-specialist, ...
```

**From Adversarial Thinker prompt** (`/src/agents/adversarial-thinker.ts`):
```
I can @mention other agents: @builder, @system-architect, @infrastructure-guardian, ...
```

### What Actually Happens

1. Agent writes response with @mention
2. Orchestrator returns `WAIT_FOR_USER`
3. System waits for user input
4. @mention is **never processed or acted upon**

---

## Summary of Control Flow Issues

### Discovery Mode Turn Sequence

```
TURN 1:
  User: "What should the architecture look like?"
  Orchestrator: route → system-architect
  System Architect: (responds with architectural design)
  [System Architect might @mention builder or adversarial-thinker]
  Orchestrator: WAIT_FOR_USER
  [System waits for user]

TURN 2 (User explicitly asks for System Architect's suggestion to be reviewed):
  User: "What do you think, adversarial thinker?"
  Orchestrator: route → adversarial-thinker
  Adversarial Thinker: (responds, might @mention system-architect for clarification)
  Orchestrator: WAIT_FOR_USER
  [System waits for user]

PROBLEM: The conversation between System Architect and Adversarial Thinker doesn't happen automatically.
```

### What Would Be Needed for Agent-to-Agent Responses

```
TURN 1: User → Orchestrator → System Architect → RESPOND
[Orchestrator checks if anyone should respond]
TURN 1.5: Orchestrator → determine if another agent should respond
TURN 2: If yes → route to responsive agent → RESPOND
[Orchestrator checks again]
TURN 3: If consensus, exit. Otherwise continue...
```

---

## Summary of Limitations

| Feature | Claimed | Actual | Evidence |
|---------|---------|--------|----------|
| Agent-to-agent responses | Agents can @mention each other | No automatic routing on @mentions | detectAgentMention() unused |
| Turn management | MAX_AGENT_TURNS = 10 | Hardcoded to 1 agent per user message | No loop in executeDiscoveryWorkflow() |
| Multi-agent debate | Agents should discuss options | Agents only respond to user or task map | No inter-agent communication |
| Continuous discourse | System routes next agent automatically | System returns after each agent | WAIT_FOR_USER default behavior |

---

## Files and Line Numbers

### Discovery Mode (Single-Turn Problem)
- `/src/services/discoveryService.ts` - Lines 123-226 (executeDiscoveryWorkflow)
  - Line 143: MAX_DISCOVERY_TURNS = 10 (defined but never used)
  - Line 168: parseDiscoveryOrchestrator - parses to single agent
  - Line 181: WAIT_FOR_USER check - returns immediately
  - Line 225: return statement - exits after one agent

### Turn Management
- `/constants.ts` - Lines 4-7 (MAX_AGENT_TURNS unused)
- `/src/services/geminiService.ts` - Line 25 (MAX_CONSECUTIVE_AUTO_TURNS for execution only)

### Unused @mention Detection
- `/src/services/geminiService.ts` - Lines 132-148 (detectAgentMention defined but never called)

### Orchestrator Prompt
- `/src/services/discoveryService.ts` - Lines 38-81 (DISCOVERY_ORCHESTRATOR_PROMPT)
- `/constants.ts` - Lines 10-58 (Orchestrator agent definition)

### Agent Prompts (Claiming @mention Ability)
- `/src/agents/system-architect.ts` - Line 9
- `/src/agents/adversarial-thinker.ts` - Similar @mention list
- (All other agents have similar @mention claims)

### App-Level Message Handling
- `/App.tsx` - Lines 195-220 (getAgentResponse callback)
- `/App.tsx` - Lines 278-310 (handleSendMessage - one agent per user message)
- `/App.tsx` - Lines 205-215 (triggerAgentResponse - single execution)

---

## Conclusion

The system is **architecturally designed** to handle one agent response per user message. While agent prompts suggest they can @mention other agents for collaboration, this is purely a **prompt-level suggestion** with **no system support** for actually routing to mentioned agents.

For the system to support agents responding to each other:

1. **Discovery Mode** needs a loop to allow multiple agent turns
2. **Orchestrator** needs to be called iteratively with updated context
3. **@mention detection** needs to be implemented in agent response processing
4. **Return mechanism** needs to check if another agent should respond before returning to user

Currently, these features are either absent or unused.
