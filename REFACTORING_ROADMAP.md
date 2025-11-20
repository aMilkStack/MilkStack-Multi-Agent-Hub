# Agency V2 Refactoring Roadmap

**Status:** Phase 3 Complete + V1 Code Removed (V2-only architecture)

## Recent Progress Summary

**Latest Commit:** `ea31d82` - "refactor: Extract AgentExecutor service (Phase 3 complete)"

### MAJOR CLEANUP (2025-11-20):
**V1 Code Removal** - Eliminated all legacy orchestration code:
- **Deleted** `executeV1Orchestration()` function (616 lines removed from geminiService.ts)
- **Deleted** `agencyService.ts` (254 lines - unused experimental code)
- **Deleted** `promptEnhancerService.ts` (~100 lines - duplicate with old gemini-2.0-flash-exp model)
- **Removed** model fallback logic from AgentExecutor (gemini-2.5-pro → flash)
- **Removed** V1 routing logic (if/else branch in getAgentResponse)
- **Consolidated** all model references to **gemini-2.5-pro ONLY**
- **Updated** MessageInput.tsx to use only messageEnhancementService
- **Total cleanup:** ~1,070 lines of dead/duplicate code removed

**Result:** Pure V2 architecture with exclusive gemini-2.5-pro usage. No backward compatibility with V1.

### What Changed (Previous):
1. **AgentExecutor Service** - Extracted ~300 lines of API logic into dedicated service:
   - `AgentExecutor` class with methods: `executeStreaming()`, `executeNonStreaming()`, `executeParallel()`
   - Built-in model fallback (gemini-2.5-pro → gemini-2.5-flash)
   - Abort signal support throughout
   - Removed `callGeminiWithFallback()` function (60 lines deleted)

2. **Rusty's Critical Fixes** - Addressed agent diversity and context preservation:
   - **Context Pruning Fix**: Preserves first 3 messages (user intent + planner response) in long V2 workflows
   - **Agent Diversity Fix**: Added Critical Rule #7 "AGENT DIVERSITY" to Product Planner prompt
   - **Example Task Maps**: Added UX/design-focused workflow examples to prompt diverse agent selection

3. **Bug Fix** - Orchestrator empty response crash:
   - Removed faulty empty response check that threw premature errors
   - Now allows graceful "Orchestrator Uncertainty" handling
   - System is more resilient to valid-but-empty API responses

4. **Architectural Benefits:**
   - AgentExecutor is independently testable
   - geminiService.ts reduced complexity (now pure orchestration)
   - Clear separation: geminiService = orchestration, AgentExecutor = API calls
   - More robust error handling for edge cases

---

## Phase 1: Service Layer Extraction ✅ COMPLETE

### Completed:
- [x] Created `WorkflowEngine` class (pure state machine)
- [x] Created `TaskParser` service (JSON extraction/validation)
- [x] Updated `geminiService.ts` imports
- [x] Simplified `extractAndParseTaskMap` and `extractJsonFromText`
- [x] Build verification passed
- [x] Committed changes

---

## Phase 2: Refactor Agency V2 Execution ✅ COMPLETE

### Problem (Resolved):
The Agency V2 execution block in `geminiService.ts` (lines 355-658) directly manipulated `workingTaskState`:
- Manually incremented `currentStageIndex` and `currentTaskIndex`
- Directly modified `collectedFeedback` array
- Inline `status` checks and transitions
- Tightly coupled to API call logic

### Completed Implementation:
- [x] **Step 1:** Initialize WorkflowEngine (replaced `workingTaskState` with `engine`)
- [x] **Step 2:** Replace stage execution checks (use `engine.getCurrentStage()`)
- [x] **Step 3:** Replace parallel/sequential logic (use `engine.isParallelStage()`)
- [x] **Step 4:** Replace feedback management (use `engine.addFeedback()`, `engine.clearFeedback()`)
- [x] **Step 5:** Replace state advancement (use `engine.advanceToNextStage()`)
- [x] **Step 6:** Replace error handling (use `engine.recordFailure()`)
- [x] **Step 7:** Replace return statements (use `engine.getState()`)
- [x] **BONUS:** Created `executeAgencyV2Workflow()` function (lines 339-642)
- [x] **BONUS:** Created `executeV1Orchestration()` function (lines 660-1301)
- [x] **BONUS:** Modified `getAgentResponse()` to cleanly route between V1/V2 (lines 1307-1366)
- [x] Build verification passed
- [x] Committed and pushed changes

### Original Implementation Plan (for reference):

#### Step 1: Initialize WorkflowEngine
```typescript
// Replace:
let workingTaskState = activeTaskState ? { ...activeTaskState } : null;

// With:
let workflowEngine: WorkflowEngine | null = null;
if (activeTaskState) {
    workflowEngine = restoreWorkflowEngine(activeTaskState);
} else {
    // Check for new task map in last message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && isProductPlannerMessage(lastMessage)) {
        const parseResult = extractAndParseTaskMap(lastMessage.content);
        if (parseResult.status === 'success') {
            workflowEngine = createWorkflowEngine(parseResult.taskMap!);
            // Show UI message
        }
    }
}
```

#### Step 2: Replace Stage Execution Checks
```typescript
// Replace:
if (workingTaskState && workingTaskState.status === 'in_progress') {
    const currentTask = workingTaskState.taskMap.tasks[workingTaskState.currentTaskIndex];
    const currentStage = currentTask.stages[workingTaskState.currentStageIndex];

// With:
if (workflowEngine && !workflowEngine.isComplete() && !workflowEngine.isPaused()) {
    const currentStage = workflowEngine.getCurrentStage();
    if (!currentStage) {
        // Workflow complete
        return { updatedTaskState: workflowEngine.getState() };
    }
```

#### Step 3: Replace Parallel/Sequential Logic
```typescript
// Replace:
if (currentStage.agents.length === 1) {
    // Sequential
} else {
    // Parallel
}

// With:
if (workflowEngine.isParallelStage()) {
    // Parallel execution
} else {
    // Sequential execution
}
```

#### Step 4: Replace Feedback Management
```typescript
// Replace:
if (currentStage.stageName === 'SYNTHESIZE' && workingTaskState.collectedFeedback.length > 0) {
    const feedbackText = workingTaskState.collectedFeedback.map(...).join(...);
    workingTaskState.collectedFeedback = [];
}

// With:
if (workflowEngine.isSynthesizeStage() && workflowEngine.getCollectedFeedback().length > 0) {
    const feedbackText = workflowEngine.getCollectedFeedback().map(...).join(...);
    // After synthesis complete:
    workflowEngine.clearFeedback();
}
```

#### Step 5: Replace State Advancement
```typescript
// Replace:
workingTaskState.currentStageIndex++;
if (workingTaskState.currentStageIndex >= currentTask.stages.length) {
    workingTaskState.currentTaskIndex++;
    workingTaskState.currentStageIndex = 0;
    if (workingTaskState.currentTaskIndex >= workingTaskState.taskMap.tasks.length) {
        workingTaskState.status = 'completed';
        // ...
    }
}

// With:
const hasMore = workflowEngine.advanceToNextStage();
if (!hasMore) {
    if (workflowEngine.isComplete()) {
        const completeMsg = createSystemMessage(`✅ Plan Complete!`);
        onNewMessage(completeMsg);
    } else if (workflowEngine.isPaused()) {
        const pauseMsg = createSystemMessage(`⏸️ Paused for approval`);
        onNewMessage(pauseMsg);
    }
    return { updatedTaskState: workflowEngine.getState() };
}
```

#### Step 6: Replace Error Handling
```typescript
// Replace:
workingTaskState.status = 'failed';
workingTaskState.failedStages.push({
    taskIndex: workingTaskState.currentTaskIndex,
    stageIndex: workingTaskState.currentStageIndex,
    error: error.message
});

// With:
workflowEngine.recordFailure(error.message);
return { updatedTaskState: workflowEngine.getState() };
```

#### Step 7: Replace Return Statements
```typescript
// Replace:
return { updatedTaskState: workingTaskState };

// With:
return { updatedTaskState: workflowEngine.getState() };
```

---

## Phase 3: Create AgentExecutor Service ✅ COMPLETE

### Goal (Achieved):
Extracted API call logic from geminiService into a dedicated, testable service.

### Completed Implementation:
- [x] Created `AgentExecutor` class in `src/services/AgentExecutor.ts`
- [x] Implemented `executeStreaming()` for interactive chat with real-time chunks
- [x] Implemented `executeNonStreaming()` for parallel execution
- [x] Implemented `executeParallel()` for concurrent agent execution with staggered starts
- [x] Built-in model fallback (gemini-2.5-pro → gemini-2.5-flash)
- [x] Abort signal support throughout all methods
- [x] Refactored `executeAgencyV2Workflow()` to use AgentExecutor (6 call sites)
- [x] Refactored `executeV1Orchestration()` to use AgentExecutor (6 call sites)
- [x] Removed `callGeminiWithFallback()` function (~60 lines deleted)
- [x] **BONUS:** Fixed orchestrator empty response crash bug
- [x] Build verification passed
- [x] Committed and pushed changes

### Original Interface (for reference):
```typescript
class AgentExecutor {
    constructor(ai: GoogleGenAI, abortSignal?: AbortSignal);

    /**
     * Execute a single agent with streaming
     */
    async executeStreaming(
        agent: Agent,
        model: GeminiModel,
        conversationContents: any,
        onChunk: (chunk: string) => void
    ): Promise<string>;

    /**
     * Execute a single agent without streaming (for parallel execution)
     */
    async executeNonStreaming(
        agent: Agent,
        model: GeminiModel,
        conversationContents: any
    ): Promise<string>;

    /**
     * Execute multiple agents in parallel with staggered start times
     */
    async executeParallel(
        agents: Array<{ agent: Agent; model: GeminiModel }>,
        conversationContents: any
    ): Promise<Array<{ agent: Agent; content: string }>>;
}
```

---

## Phase 4: Refactor App.tsx to useReducer

### Current Problem:
Multiple `useState` hooks with ad-hoc state updates:
```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
// Updates scattered across event handlers
```

### Goal:
Centralized state management with atomic updates.

### Implementation:
```typescript
type AppState = {
    projects: Project[];
    activeProjectId: string | null;
    settings: Settings | null;
    // ... other state
};

type AppAction =
    | { type: 'PROJECT_CREATED'; payload: Project }
    | { type: 'PROJECT_UPDATED'; payload: { id: string; updates: Partial<Project> } }
    | { type: 'WORKFLOW_STAGE_COMPLETED'; payload: { projectId: string; state: ActiveTaskState } }
    | { type: 'WORKFLOW_PAUSED'; payload: { projectId: string; state: ActiveTaskState } }
    | { type: 'WORKFLOW_FAILED'; payload: { projectId: string; state: ActiveTaskState } }
    | { type: 'MESSAGE_ADDED'; payload: { projectId: string; message: Message } }
    // ... other actions

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'WORKFLOW_STAGE_COMPLETED':
            return {
                ...state,
                projects: state.projects.map(p =>
                    p.id === action.payload.projectId
                        ? { ...p, activeTaskState: action.payload.state }
                        : p
                )
            };
        // ... other cases
    }
}

const [state, dispatch] = useReducer(appReducer, initialState);
```

---

## Phase 5: UI Improvements

### 5.1: Collapsible Workflow Blocks
**File:** `src/components/WorkflowBlock.tsx` (new)

**Features:**
- Accordion-style display for stages
- Progress bar (current stage / total stages)
- Expandable agent feedback
- Visual state indicators (⏳ running, ✅ complete, ❌ failed, ⏸️ paused)

**Usage:**
```tsx
{message.workflowBlock && (
    <WorkflowBlock
        block={message.workflowBlock}
        onExpand={() => setExpanded(!expanded)}
    />
)}
```

### 5.2: Human-in-the-Loop Approval UI
**File:** `src/components/WorkflowApprovalPrompt.tsx` (new)

**Features:**
- Shows synthesized plan
- "Approve" button (resumes workflow)
- "Edit Plan" button (opens editor)
- "Cancel" button (aborts workflow)

**Integration:**
```tsx
{workflowEngine?.isPaused() && (
    <WorkflowApprovalPrompt
        plan={workflowEngine.getState()}
        onApprove={() => dispatch({ type: 'WORKFLOW_RESUMED' })}
        onEdit={(editedPlan) => dispatch({ type: 'WORKFLOW_PLAN_UPDATED', payload: editedPlan })}
        onCancel={() => dispatch({ type: 'WORKFLOW_CANCELLED' })}
    />
)}
```

---

## Phase 6: Context Pruning (Smart Context)

### Goal:
Reduce token usage by filtering conversation history based on stage requirements.

### Implementation:
```typescript
function buildSmartContext(
    engine: WorkflowEngine,
    fullHistory: Message[],
    codebaseContext: string
): ConversationContents {
    const stage = engine.getCurrentStage();

    switch (stage?.stageName) {
        case 'IMPLEMENTATION':
            // Builder only needs synthesized plan, not raw feedback
            return buildContextWithFilter(fullHistory, ['product-planner', 'system'], codebaseContext);

        case 'CODE_REVIEW':
            // Reviewers need to see implementation, but not planning debate
            return buildContextWithFilter(fullHistory, ['builder', 'system'], codebaseContext);

        case 'SYNTHESIZE':
            // Synthesizer needs feedback + original plan
            return buildContextWithFeedback(engine.getCollectedFeedback(), fullHistory, codebaseContext);

        default:
            return buildConversationContents(fullHistory, codebaseContext);
    }
}
```

---

## Phase 7: File System Access API (Future)

### Goal:
Allow agents to read/write directly to local filesystem (with user permission).

### Implementation:
1. Request file system handle via File System Access API
2. Store handle in IndexedDB (persists across sessions)
3. Pass file paths to agents in codebase context
4. Agents return file modification instructions
5. Apply changes directly to local files (no copy-paste)

### Security:
- User grants permission once per directory
- Read-only by default
- Write operations require explicit confirmation
- Sandboxed to selected directory

---

## Testing Strategy

### Unit Tests:
- `WorkflowEngine.test.ts`: Test state transitions, validation
- `TaskParser.test.ts`: Test JSON extraction edge cases
- `AgentExecutor.test.ts`: Mock API calls, test retry logic

### Integration Tests:
- Test complete workflow execution (PLAN → REVIEW → SYNTHESIZE → IMPLEMENT)
- Test pause/resume functionality
- Test parallel vs sequential execution
- Test error recovery

### E2E Tests:
- Test full user journey with real Gemini API calls
- Test UI interactions (expand/collapse, approve/reject)
- Test project state persistence across page reloads

---

## Rollout Plan

### Week 1: Core Refactoring ✅ COMPLETE
- [x] Phase 1: Extract services ✅
- [x] Phase 2: Refactor Agency V2 execution ✅
- [x] **BONUS:** Separate V1/V2 orchestration paths ✅
- [x] Commit: "refactor: Separate V1/V2 orchestration and extract WorkflowEngine"

### Week 2: AgentExecutor + State Management
- [x] Phase 3: Create AgentExecutor service ✅
- [ ] Phase 4: Implement useReducer in App.tsx (NEXT)
- [ ] Add unit tests for WorkflowEngine
- [ ] Commit: "refactor: Extract AgentExecutor and centralize state"

### Week 3: UI Polish
- [ ] Phase 5.1: Collapsible workflow blocks
- [ ] Phase 5.2: Approval UI
- [ ] Commit: "feat: Add collapsible workflow UI and approval prompts"

### Week 4: Optimization
- [ ] Phase 6: Context pruning
- [ ] Performance profiling
- [ ] Commit: "perf: Implement smart context filtering"

---

## Success Metrics

### Code Quality:
- `geminiService.ts` under 500 lines (currently 1000+)
- 80%+ test coverage for new services
- Zero TypeScript errors
- Zero console errors in production build

### Performance:
- 30% reduction in token usage (context pruning)
- <100ms state update latency (useReducer)
- Parallel execution maintains 2-3x speedup

### User Experience:
- Zero "stale state" bugs
- Clean chat UI (no flood of intermediate messages)
- Clear progress indicators
- Smooth pause/resume workflow

---

## Notes

- V1 orchestration code has been completely removed (V2-only architecture)
- Focus on V2 improvements and optimizations going forward
- Exclusive use of gemini-2.5-pro model (no fallbacks)
- Commit frequently with descriptive messages
- Update CLAUDE.md session summary after each phase
