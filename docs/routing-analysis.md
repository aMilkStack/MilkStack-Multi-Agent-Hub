# Routing Failure Analysis

## Executive Summary

After analyzing the orchestrator implementation, I've identified several architectural issues and failure patterns in the current agent routing system. The system operates in two distinct modes (Discovery and Execution), each with different routing mechanisms.

## System Architecture

### Routing Modes

1. **Discovery Mode** (`src/services/discoveryService.ts`)
   - Multi-turn conversational routing
   - Orchestrator decides which agent speaks next
   - Agents can @mention each other
   - Supports consensus detection to transition to Execution

2. **Execution Mode** (Agency V2 Workflow in `src/services/geminiService.ts`)
   - Task Map-driven execution
   - Product Planner creates structured plans
   - Workflow Engine manages sequential execution
   - Predefined agent assignments per stage

### Entry Points

- `getAgentResponse()` in `src/services/geminiService.ts` (line 675)
  - Phase detection logic (lines 704-769)
  - Discovery routing (lines 771-816)
  - Execution trigger detection (lines 732-768)

## Identified Issues

### 1. **Orchestrator Agent ID Mismatch** (CRITICAL)

**Location**: `src/agents/orchestrator.ts` vs usage in services

**Issue**: The orchestrator prompt (lines 7-54) references agent IDs differently than how they're actually stored:

```typescript
// Prompt says:
"product-planner"   // kebab-case without prefix
"builder"
"debug-specialist"

// Actual IDs in AGENT_PROFILES:
"agent-product-planner-001"   // prefixed with "agent-" and suffixed with "-001"
"agent-builder-001"
"agent-debug-specialist-001"
```

**Impact**:
- Orchestrator returns simplified IDs that don't match actual agent IDs
- Routing logic in `discoveryService.ts:279-283` fails to find agents:
  ```typescript
  const targetAgent = AGENT_PROFILES.find(a => a.id === routing.agent);
  if (!targetAgent) {
    throw new Error(`Orchestrator routed to unknown agent: ${routing.agent}`);
  }
  ```
- Line 188 attempts to fix this with `.toLowerCase()` but doesn't add prefixes/suffixes

**Fix Required**: Update orchestrator prompt to use actual full agent IDs or implement proper ID normalization.

---

### 2. **JSON Parsing Reliability Issues**

**Location**: `src/services/discoveryService.ts:165-197`

**Issue**: While `responseMimeType: 'application/json'` is set (line 247), the parsing still fails occasionally:

```typescript
const parseDiscoveryOrchestrator = (responseText: string) => {
  try {
    const parsed = JSON.parse(responseText.trim());
    // ...
  } catch (error) {
    console.error('[Discovery] Orchestrator JSON parse failed:', error);
    return null;  // Silent failure - conversation stops
  }
};
```

**Impact**:
- Parse failures cause orchestrator to return `null`
- Discovery workflow exits silently (line 259)
- No fallback or retry mechanism
- User sees conversation stop without explanation

**Contributing Factors**:
- LLM occasionally adds markdown despite JSON mode
- No validation of JSON structure before parsing
- No error recovery mechanism

---

### 3. **Agent Name Normalization Inconsistency**

**Location**: `src/services/geminiService.ts:350-353`

**Issue**: Multiple name normalization strategies exist:

```typescript
// In Agency V2:
const identifier = p.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

// In Discovery:
return { agent: parsed.agent.toLowerCase(), ... }  // Line 188
```

**Impact**:
- Inconsistent matching across modes
- "Builder" vs "builder" vs "agent-builder-001" confusion
- Special characters (& , , etc.) handled differently
- Task Map agent assignments may not match actual agent profiles

---

### 4. **Orchestrator Prompt Conflicts**

**Location**: Multiple orchestrator prompts exist

**Files**:
- `src/agents/orchestrator.ts` (original, simpler prompt)
- `src/services/discoveryService.ts` (DISCOVERY_ORCHESTRATOR_PROMPT, lines 44-160)

**Conflicts**:
1. Different available agent lists
2. Different routing rules
3. Different output formats expected
4. Original prompt excludes Product Planner (correct)
5. Discovery prompt excludes Product Planner + Parse Error Handler (correct for Discovery)

**Impact**:
- Confusing which prompt is actually used
- Discovery mode uses DISCOVERY_ORCHESTRATOR_PROMPT (overrides original)
- Original orchestrator prompt in `orchestrator.ts` is only documentation
- Documentation drift - original prompt outdated

---

### 5. **Context Size Management Issues**

**Location**: `src/services/geminiService.ts:71-159`

**Issue**: `buildConversationContents()` attempts character budgeting (3.2M chars ≈ 800k tokens):

```typescript
const MAX_CHARS = 3200000;
let currentChars = 0;

// But then doesn't actually enforce limits:
contents.push({
  role: 'user',
  parts: [{ text: `# Codebase Context\n\`\`\`\n${codebaseContext}\n\`\`\`` }]
});
// No check if adding codebase exceeds MAX_CHARS!
```

**Impact**:
- No actual context truncation implementation
- Messages included without size checking
- Risk of hitting API limits
- Slow/expensive API calls with full context

---

### 6. **Rate Limiting Coordination**

**Location**: `src/services/rateLimiter.ts` + multiple services

**Issue**: Shared rate limiter is used but coordination is unclear:

```typescript
// discoveryService.ts
import { sharedRateLimiter } from './rateLimiter';

// geminiService.ts
const rateLimiter = sharedRateLimiter;
```

**Concerns**:
- Discovery mode loops (max 10 turns) * orchestrator + agent calls = 20+ API calls
- Each call goes through rate limiter
- No clear documentation of expected throughput
- Free tier: 12 RPM limit (0.2 calls/sec)
- Discovery workflow could take 100+ seconds just from rate limiting

---

### 7. **Workflow State Management Complexity**

**Location**: `src/services/workflowEngine.ts` + `src/services/geminiService.ts`

**Issue**: Agency V2 has complex state restoration logic:

```typescript
if (activeTaskState) {
  engine = restoreWorkflowEngine(activeTaskState);
} else {
  // Check last message for task map
  // Parse task map
  // Create new engine
}
```

**Failure Scenarios**:
- Task map parse error → workflow stops (line 245)
- Invalid workflow state → records failure, no recovery (line 341)
- Product Planner doesn't create task map → stops (line 307)
- Max consecutive turns → pauses without explanation (line 325)

**Impact**:
- Workflow can enter unrecoverable states
- User has no visibility into why workflow stopped
- No retry or recovery mechanisms

---

## Failure Patterns

### Pattern 1: Silent Failures
**Symptoms**: Conversation stops without agent response

**Root Causes**:
- Orchestrator JSON parse failure (discoveryService.ts:193)
- Agent ID mismatch (discoveryService.ts:282)
- Task map parse error (geminiService.ts:306)

**User Experience**: Confusing - appears broken

---

### Pattern 2: Agent Routing Loops
**Symptoms**: Same agent called repeatedly or routing ping-pongs

**Root Causes**:
- Orchestrator doesn't track conversation history effectively
- WAIT_FOR_USER logic unclear to LLM
- No explicit loop detection beyond MAX_DISCOVERY_TURNS

**Example Flow**:
```
Turn 1: User asks question
Turn 2: Routes to System Architect
Turn 3: Routes to Adversarial Thinker
Turn 4: Routes to System Architect (again)
Turn 5: Routes to Adversarial Thinker (again)
...
Turn 10: MAX_DISCOVERY_TURNS - stops
```

---

### Pattern 3: Incorrect Agent Selection
**Symptoms**: Wrong agent responds to user query

**Root Causes**:
- Orchestrator prompt routing heuristics too rigid (discoveryService.ts:73-114)
- No context about agent specializations beyond brief descriptions
- Priority order doesn't account for query nuance
- Agent capabilities overlap (Builder vs Advanced Coding Specialist)

**Example**:
```
User: "Fix the rendering bug in the UI"
Expected: Debug Specialist → UX Evaluator
Actual: Builder (matches "fix" → simple implementation heuristic)
```

---

### Pattern 4: Consensus Detection Failures
**Symptoms**: Workflow doesn't transition to Execution when it should

**Root Causes**:
- Consensus detection relies on exact phrase matching (discoveryService.ts:121-123)
- Requires user to say specific phrases: "that sounds good", "let's do that"
- Doesn't detect implicit agreement or context
- Orchestrator must return exact JSON: `{"agent": "CONSENSUS_REACHED"}`

**Missed Scenarios**:
- User says "yes" or "ok" or "sounds good"
- User approves plan implicitly
- Agents agree but orchestrator doesn't recognize consensus

---

## Recommendations (Priority Order)

### High Priority

1. **Fix Agent ID Mismatch**
   - Create ID normalization utility
   - Update orchestrator prompt to use consistent IDs
   - Add validation layer

2. **Improve JSON Parsing Robustness**
   - Add retry with error correction
   - Implement fallback parsing strategies
   - Better error messages to user

3. **Add Failure Recovery**
   - Retry failed orchestrator calls
   - Fallback to WAIT_FOR_USER on repeated failures
   - Show user-friendly error messages

### Medium Priority

4. **Consolidate Orchestrator Prompts**
   - Single source of truth for routing logic
   - Mode-specific sections within one prompt
   - Keep original orchestrator.ts as documentation

5. **Enhance Routing Intelligence**
   - Use embeddings/semantic similarity for agent selection
   - Track conversation context more effectively
   - Learn from routing patterns

6. **Implement Context Size Limits**
   - Actually enforce MAX_CHARS budget
   - Intelligently truncate old messages
   - Summarize conversation history

### Low Priority

7. **Improve Consensus Detection**
   - Semantic similarity for approval phrases
   - Multi-signal consensus (user + multiple agents agree)
   - Explicit "ready to execute" UI button

8. **Better State Visibility**
   - Show users why workflow paused
   - Explain routing decisions
   - Debug mode for developers

---

## Testing Recommendations

### Unit Tests Needed

1. Agent ID normalization
2. JSON parsing with malformed input
3. Orchestrator response validation
4. Consensus detection phrase matching

### Integration Tests Needed

1. Discovery mode multi-turn conversations
2. Phase transitions (Discovery → ExecutionReady → Execution)
3. Workflow engine state restoration
4. Error recovery paths

### E2E Scenarios

1. User asks question → correct agent responds → follow-up works
2. User requests implementation → consensus → execution starts
3. Error occurs → retry succeeds → workflow continues
4. Max turns reached → user prompted → can continue

---

## Metrics to Track

1. **Orchestrator Accuracy**: % of correct first-agent selections
2. **Parse Failure Rate**: % of JSON parse errors
3. **Consensus Detection Rate**: % of successful transitions
4. **Average Turns to Resolution**: Discovery mode conversation length
5. **Silent Failure Rate**: % of conversations that stop without user message
6. **API Call Efficiency**: Average calls per user query

---

## Next Steps

1. Implement agent ID normalization (Task 5)
2. Enhance orchestrator prompt with better examples (Task 5)
3. Add error recovery mechanisms (Task 5)
4. Write tests for routing logic (Task 3 - expand)
5. Create monitoring dashboard for metrics
6. Document failure modes for team (Task 8)

---

*Analysis Date: 2025-11-24*
*Analyzed By: Claude (Automated Analysis)*
*Files Analyzed: 8 core routing files*
