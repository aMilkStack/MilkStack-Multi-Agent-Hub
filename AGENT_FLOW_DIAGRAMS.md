# Agent Response Flow Diagrams

## Current Architecture vs. Intended Architecture

### Current Discovery Mode Flow (Single-Turn)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISCOVERY MODE (Current)                     │
└─────────────────────────────────────────────────────────────────┘

    User Types Message
            │
            ▼
    ┌──────────────────┐
    │   App.tsx        │
    │ handleSendMessage│
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────────────┐
    │  triggerAgentResponse()  │
    │  (App.tsx line 308)      │
    └────────┬─────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │  getAgentResponse()         │
    │  (geminiService.ts line 803)│
    │                             │
    │  Phase: Discovery Mode      │
    └────────┬────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ executeDiscoveryWorkflow()       │
    │ (discoveryService.ts line 123)  │
    └────────┬───────────────────────┘
             │
             ├─────────────────────────────────┐
             │                                 │
             ▼                                 ▼
    ┌──────────────────────┐    ┌─────────────────────────┐
    │ Call Orchestrator    │    │ Parse Orchestrator JSON │
    │ (Lines 145-166)      │    │ (Line 168)              │
    │                      │    │                         │
    │ Orchestrator Output: │    │ Result: { agent: "X",   │
    │ {"agent": "...", ... │    │ model: "..." }          │
    │  }                   │    │                         │
    └──────────┬───────────┘    └────────┬────────────────┘
               │                         │
               └────────────┬────────────┘
                            │
                            ▼
                ┌─────────────────────────────┐
                │ Check result               │
                │ - CONSENSUS_REACHED?       │
                │ - WAIT_FOR_USER?           │
                │ - Valid Agent?             │
                └────────┬────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    CONSENSUS        WAIT_FOR_USER  VALID AGENT
    REACHED          (DEFAULT)      (Line 188)
         │               │               │
         ▼               ▼               ▼
    Return          Return        ┌──────────────────────┐
    Immediately     Immediately   │ Execute Agent        │
                                  │ (Lines 199-211)      │
                                  │                      │
                                  │ await executor       │
                                  │  .executeStreaming() │
                                  └──────┬───────────────┘
                                         │
                                         ▼
                                  ┌──────────────────────┐
                                  │ Add message to       │
                                  │ history              │
                                  │ (Lines 214-220)      │
                                  │                      │
                                  │ onNewMessage()       │
                                  │ (App.tsx line 195)   │
                                  └──────┬───────────────┘
                                         │
                                         ▼
                                  ┌──────────────────────┐
                                  │ Return from function │
                                  │ (Line 225)           │
                                  │                      │
                                  │ { consensusReached:  │
                                  │   false,             │
                                  │   agentTurns: 1 }    │
                                  └──────────────────────┘
                                         │
                                         ▼
                                  Control Returns to
                                  App.tsx - Waiting
                                  for Next User Input

        ⚠️ PROBLEM: System stops after ONE agent response!
```

---

### What Should Happen (Multi-Turn)

```
┌─────────────────────────────────────────────────────────────────┐
│              DISCOVERY MODE (What Should Happen)                │
└─────────────────────────────────────────────────────────────────┘

    User Types Message
            │
            ▼
    ┌────────────────────┐
    │ Add to History     │
    └────────┬───────────┘
             │
             ▼
    ┌───────────────────────────────┐
    │ LOOP: While More Turns Needed │ ← MISSING IN CURRENT CODE
    │ (MAX_AGENT_TURNS = 10)        │
    └────────┬───────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Call Orchestrator           │
    │ With Current Message History│
    └────────┬────────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ Parse Orchestrator Route │
    └────────┬─────────────────┘
             │
        ┌────┼───────┬─────────┐
        │    │       │         │
   CONSENSUS WAIT  VALID  ERROR
   REACHED  USER   AGENT
        │    │       │         │
        ▼    ▼       ▼         ▼
      EXIT  EXIT   Execute   Handle
                    Agent     Error
                      │
                      ▼
              ┌────────────────────┐
              │ Add to History     │
              │ (Agent Response)   │
              └────────┬───────────┘
                       │
                       ▼
              ┌────────────────────────────┐
              │ Check if Other Agents      │
              │ Should Respond             │
              │                            │
              │ Logic Needed:              │
              │ 1. Detect @mentions       │
              │ 2. Check consensus        │
              │ 3. Re-route if needed     │
              └────────┬───────────────────┘
                       │
           ┌───────────┼────────────┐
           │           │            │
          YES          NO         TIMEOUT
           │           │            │
           ▼           ▼            ▼
      Continue      Return       Return
      Loop         Results       Results
           │           │            │
           └───────────┴────────────┘
                       │
                       ▼
            Control Returns to User

    ✅ Multi-turn debate possible!
    ✅ Agents can respond to each other!
    ✅ System manages turn sequence!
```

---

## Execution Mode Flow (Working Parallel Execution)

```
┌────────────────────────────────────────────────────────────┐
│           EXECUTION MODE - Parallel Stages (Works!)        │
└────────────────────────────────────────────────────────────┘

    User Types "go ahead" / "start implementation"
            │
            ▼
    ┌─────────────────────────────────┐
    │ executeAgencyV2Workflow()       │
    │ (geminiService.ts line 332)     │
    └────────┬────────────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ 1. Check if Task Map     │
    │    exists                │
    │                          │
    │ If not: Call Product     │
    │ Planner to create one    │
    └────────┬─────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ 2. Get Current Stage     │
    │    from Task Map         │
    │                          │
    │ engine.getCurrentStage() │
    └────────┬─────────────────┘
             │
             ▼
    ┌────────────────────────────────┐
    │ 3. Check: Single or Multiple   │
    │    Agents? (isParallelStage)   │
    └────────┬───────────────────────┘
             │
        ┌────┴──────┐
        │           │
   SINGLE      MULTIPLE
   AGENT      AGENTS
        │           │
        ▼           ▼
    ┌──────┐   ┌──────────────────────┐
    │      │   │ Parallel Execution   │
    │      │   │ (Lines 590-769)      │
    │      │   │                      │
    │      │   │ stageAgents.map()    │
    │      │   │ Promise.all()        │
    │      │   │                      │
    │      │   │ All agents:          │
    │      │   │ - Get same context   │
    │      │   │ - Execute in parallel│
    │      │   │ - Return results     │
    │      │   │                      │
    │      │   │ Results:             │
    │      │   │ - Collect feedback   │
    │      │   │ - Display messages   │
    │      │   │ - Add to history     │
    │      │   └──────┬───────────────┘
    │      │          │
    │      │          ▼
    │      │   ┌─────────────────────┐
    │      │   │ Move to SYNTHESIZE  │
    │      │   │ stage (if exists)   │
    │      │   │                     │
    │      │   │ Synthesizer reads   │
    │      │   │ collected feedback  │
    │      │   │ and creates summary │
    │      │   └──────┬──────────────┘
    │      │          │
    └──┬───┴──────────┘
       │
       ▼
    ┌────────────────────────┐
    │ Advance to Next Stage  │
    │ (Line 775)             │
    │                        │
    │ engine.advanceToNext() │
    └────────┬───────────────┘
             │
       ┌─────┴─────┐
       │           │
    MORE       COMPLETE
    STAGES     WORKFLOW
       │           │
       ▼           ▼
    LOOP       RETURN
             RESULTS

    ✅ Multiple agents execute in parallel
    ✅ Feedback is collected
    ✅ Synthesizer combines feedback
    
    ❌ BUT: Agents don't see each other's feedback during their own execution
    ❌ No inter-agent debate happening
```

---

## Message Flow in Parallel Execution

```
Same Code Input Provided to All Agents Simultaneously:

CODE:
  function calculate(x) {
    return x * 2;
  }

    │
    ├────────────────────────────────────┐
    │                                    │
    ▼                                    ▼
┌─────────────────┐           ┌──────────────────┐
│ Adversarial     │           │ Infrastructure   │
│ Thinker:        │           │ Guardian:        │
│                 │           │                  │
│ "This function  │           │ "No error        │
│ has no input    │           │ handling. What   │
│ validation.     │           │ if x is null?"   │
│ Security risk." │           │                  │
└────────┬────────┘           └──────┬───────────┘
         │                           │
         └──────────────┬────────────┘
                        │
                        ▼
            ┌──────────────────────┐
            │ Both feedback items  │
            │ collected in engine  │
            │                      │
            │ Synthesizer reads:   │
            │ - Validation risk    │
            │ - Error handling     │
            │                      │
            │ Creates combined     │
            │ response             │
            └──────────────────────┘

    ❌ Problem: The agents didn't debate these points with each other.
       If one agent's feedback should trigger the other to elaborate,
       that doesn't happen automatically.
```

---

## Turn Sequence Comparison

### Current (Single-Turn Per User Message)

```
User: "What should the architecture be?"
  │
  └─> Orchestrator Routes to: System Architect
      └─> System Architect Responds:
          "Architecture should use MVC pattern with..."
          [Mentions @adversarial-thinker]
          [System returns to user]

User: (must explicitly ask) "Adversarial Thinker, what are the risks?"
  │
  └─> Orchestrator Routes to: Adversarial Thinker
      └─> Adversarial Thinker Responds:
          "The MVC pattern has these security risks..."
          [System returns to user]

User: (must continue manually asking each agent)
```

### Desired (Multi-Turn Per User Message)

```
User: "What should the architecture be?"
  │
  ├─> Orchestrator Routes to: System Architect
  │   └─> System Architect: "MVC pattern with..."
  │
  ├─> Orchestrator Routes to: Adversarial Thinker
  │   (sees System Architect's response)
  │   └─> Adversarial Thinker: "Security risks: ..."
  │
  ├─> Orchestrator Routes to: System Architect
  │   (sees Adversarial Thinker's critique)
  │   └─> System Architect: "To address those risks..."
  │
  ├─> Orchestrator Routes to: Deep Research Specialist
  │   (sees full debate so far)
  │   └─> Deep Research: "Similar patterns in industry..."
  │
  └─> Orchestrator: CONSENSUS_REACHED or WAIT_FOR_USER
      [System returns to user]

User: Gets richer conversation with agents debating
```

---

## Orchestrator Role Comparison

### Current Role

```
Orchestrator Decision Tree:
  ├─ Is it CONSENSUS_REACHED?
  │  └─ YES: Return immediately
  ├─ Is it WAIT_FOR_USER?
  │  └─ YES: Return immediately (DEFAULT)
  └─ Is it a valid agent?
     └─ YES: Return that agent ID
     └─ NO: Return error

Called: Once per user message
Scope: Makes binary routing decision
Responsibility: "Which one agent should I call?"

Result: System executes that agent, then stops
```

### Desired Role

```
Orchestrator Decision Tree:
  ├─ Turn 1: Route to best agent
  │  └─ Agent responds
  ├─ Turn 2: Should another agent respond?
  │  └─ YES: Route to next agent
  │  └─ NO: Next check
  ├─ Turn 3: Should agent 1 respond again?
  │  └─ YES: Route back to agent 1
  │  └─ NO: Next check
  ├─ ...
  ├─ Turn N: Have we reached consensus?
  │  └─ YES: Return results
  │  └─ NO: Do we need more turns?
  │     └─ YES: Continue loop
  │     └─ NO: Return WAIT_FOR_USER

Called: Multiple times per user message (in loop)
Scope: Makes iterative routing decisions with full context
Responsibility: "Who should speak next given everything said so far?"

Result: Rich multi-agent discussion before returning to user
```

---

## Code Execution Points

### Current Discovery Workflow Call Stack

```
App.tsx::handleSendMessage() [Line 278]
  │
  └─> App.tsx::triggerAgentResponse() [Line 180]
      │
      └─> geminiService.ts::getAgentResponse() [Line 803]
          │
          └─> discoveryService.ts::executeDiscoveryWorkflow() [Line 123]
              │
              ├─> AgentExecutor::executeStreaming() [Line 154]
              │   └─> Orchestrator executes, returns JSON
              │
              ├─> AgentExecutor::executeStreaming() [Line 199]
              │   └─> Specialist Agent executes
              │
              └─> RETURN [Line 225]
                  └─> Control returns to App.tsx
                      └─> Waiting for next user message
```

### Where Multi-Turn Loop Should Be

```
executeDiscoveryWorkflow() [Line 123]
  │
  ├─> LOOP: while (turnCount < MAX_DISCOVERY_TURNS) ← MISSING
  │   │
  │   ├─> Call Orchestrator with current history
  │   │
  │   ├─> Parse result
  │   │
  │   ├─> Check: CONSENSUS? WAIT? AGENT?
  │   │
  │   ├─> If AGENT: Execute & add to history, then continue loop
  │   ├─ If WAIT: Break loop
  │   ├─ If CONSENSUS: Break loop
  │   │
  │   └─> turnCount++
  │
  └─> Return after loop complete

     ↑ This entire LOOP structure is MISSING from current code
```

---

## File Structure and Missing Loop

### Current discoveryService.ts Structure

```typescript
export const executeDiscoveryWorkflow = async (...) => {
    // Setup (Lines 132-150)
    let agentTurns = 0;                    // Declared but never incremented properly
    const MAX_DISCOVERY_TURNS = 10;       // Unused
    
    // Single Orchestrator Call (Lines 151-168)
    const routing = parseDiscoveryOrchestrator(...);
    
    // Single Agent Execution (Lines 187-220)
    if (routing.agent === targetAgent) {
        await executor.executeStreaming(...);
        onNewMessage(agentMessage);
    }
    
    // Return Immediately (Line 225)
    return { consensusReached: false, agentTurns };  // ← STOPS HERE
};
```

### What Should Be There

```typescript
export const executeDiscoveryWorkflow = async (...) => {
    // Setup
    let agentTurns = 0;
    const MAX_DISCOVERY_TURNS = 10;
    let currentHistory = [...messages];    // Track evolving history
    
    // LOOP FOR MULTIPLE TURNS
    while (agentTurns < MAX_DISCOVERY_TURNS) {
        agentTurns++;
        
        // Call Orchestrator with current history
        const routing = parseDiscoveryOrchestrator(...);
        
        // Check for exit conditions
        if (routing.agent === 'CONSENSUS_REACHED') break;
        if (routing.agent === WAIT_FOR_USER) break;
        
        // Execute agent with current history
        const response = await executor.executeStreaming(...);
        
        // Add to history for next iteration
        currentHistory.push({
            id: crypto.randomUUID(),
            author: targetAgent,
            content: response,
            timestamp: new Date(),
        });
        onNewMessage(newMessage);
        
        // Continue loop if more agents should respond
    }
    
    return { consensusReached: ..., agentTurns };
};
```

---

## Summary Visual

```
┌─────────────────────────────────────────────────────────────┐
│          WHAT'S MISSING FOR AGENT-TO-AGENT RESPONSES        │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Current   │────▶│   Needed     │────▶│     Impact     │
└─────────────┘     └──────────────┘     └────────────────┘

1. Single Call          Multi-Call Loop     Agents respond
   to Orchestrator      (while turn < max)  to each other

2. No History Update    Add Agent Messages  Each agent sees
   between calls        to history each     previous agents'
                        turn                responses

3. WAIT_FOR_USER        Loop Exit Decision  System knows when
   on every response    (consensus, max,    to stop vs continue
                        timeout)

4. No @mention          Process @mentions   Explicit requests
   processing           after agent         from agents to
                        responses           specific agents

5. Single Agent         Check if multiple   Natural flow of
   per loop             agents should       debate vs
                        respond             single response

Every item in "Current" is present in the codebase.
Every item in "Needed" is absent or unused.
```
