# Phase 1 Testing Guide

**Purpose:** Validate the Phase 1 enhancements to the MilkStack Multi-Agent Hub, focusing on orchestrator routing accuracy, agent prompt quality, and overall system reliability.

**Testing Duration:** 4-6 hours (split across multiple sessions)

**Participants:** Development team members, QA testers, potential end users

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Pre-Testing Setup](#pre-testing-setup)
3. [Test Scenarios](#test-scenarios)
4. [Feedback Collection](#feedback-collection)
5. [Success Criteria](#success-criteria)
6. [Known Issues to Verify](#known-issues-to-verify)
7. [Reporting Bugs](#reporting-bugs)

---

## Testing Overview

### What We're Testing

**Phase 1 Enhancements:**
- ✅ TypeScript Strict Mode (Task 1)
- ✅ ESLint + Prettier (Task 2)
- ✅ Testing Framework (Task 3)
- ✅ Orchestrator Routing Fixes (Tasks 4-5)
- ✅ Agent Prompt Enhancements (Task 6)
- ✅ Documentation (Tasks 7-8)

### Key Areas to Validate

1. **Orchestrator Routing Accuracy**
   - Does the orchestrator select the correct agent for each request?
   - Are simple identifiers (e.g., `builder`, `system-architect`) recognized correctly?
   - Does the orchestrator avoid unnecessary loops between agents?

2. **Agent Response Quality**
   - Do agents provide structured, comprehensive responses?
   - Are responses contextually appropriate?
   - Do enhanced agents (UX Evaluator, Fact Checker) show improved depth?

3. **Discovery Mode vs Execution Mode**
   - Does Discovery Mode enable multi-turn refinement?
   - Does Execution Mode follow Task Maps correctly?
   - Are transitions between modes smooth?

4. **Error Handling**
   - Are parse failures handled gracefully?
   - Do API errors provide clear feedback?
   - Can users recover from errors without losing context?

5. **Documentation Quality**
   - Is the Developer Onboarding Guide clear and complete?
   - Does the Troubleshooting Guide resolve common issues?
   - Are code examples accurate and runnable?

---

## Pre-Testing Setup

### 1. Environment Setup (5 minutes)

**Prerequisites:**
- Node.js 18+
- npm or pnpm
- Git

**Setup Steps:**

```bash
# Clone/pull latest code
cd /path/to/MilkStack-Multi-Agent-Hub
git pull origin main

# Install dependencies
npm install

# Verify build
npm run build

# Verify type checking
npm run typecheck

# Expected output: ✅ 0 errors

# Run tests
npm test

# Expected output: ✅ All 43 tests passing
```

### 2. API Key Configuration (2 minutes)

**Required API Keys:**
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))
- Anthropic Claude API Key ([Get one here](https://console.anthropic.com/))

**Configuration:**

Create `.env` file in project root:

```env
VITE_GEMINI_API_KEY=your_gemini_key_here
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Verification:**

```bash
# Start dev server
npm run dev

# Open http://localhost:5173
# Check console for errors
# Should see: "AI services initialized successfully"
```

### 3. Clear Previous Data (Optional)

To test with a clean slate:

```javascript
// Open browser console on http://localhost:5173
// Run:
localStorage.clear();
indexedDB.deleteDatabase('milkstack-db');
// Refresh page
```

---

## Test Scenarios

### Scenario 1: Orchestrator Routing Accuracy

**Objective:** Verify the orchestrator selects the correct agent for various request types.

**Test Cases:**

#### TC1.1: Simple Identifier Recognition

| User Input | Expected Agent | Simple Identifier | Pass/Fail |
|------------|----------------|-------------------|-----------|
| "Help me build a login form" | Builder | `builder` | ⬜ |
| "Explain how closures work" | Fact Checker & Explainer | `fact-checker-explainer` | ⬜ |
| "Review the UX of the dashboard" | UX Evaluator | `ux-evaluator` | ⬜ |
| "Design the system architecture" | System Architect | `system-architect` | ⬜ |
| "Debug this error: TypeError..." | Debug Specialist | `debug-specialist` | ⬜ |

**Steps:**
1. Create a new project: "Routing Test Project"
2. Send each user input above
3. Check console logs for orchestrator decision
4. Verify correct agent responds
5. Mark Pass/Fail in table

**Expected Orchestrator Output Format:**

```json
{
  "thinking": "The user wants to build a login form. This is a coding task requiring implementation guidance...",
  "agent_identifier": "builder",
  "clarification": "I'll help you build a login form...",
  "followup_questions": []
}
```

#### TC1.2: Agent Mention Parsing

| User Input | Expected Routing | Pass/Fail |
|------------|------------------|-----------|
| "@builder create a navbar" | Direct to Builder | ⬜ |
| "@system-architect design the API" | Direct to System Architect | ⬜ |
| "@ux-evaluator review this flow" | Direct to UX Evaluator | ⬜ |
| "Ask @fact-checker-explainer about React hooks" | Direct to Fact Checker | ⬜ |

**Steps:**
1. Send user input with @mention
2. Verify orchestrator bypasses routing and goes directly to mentioned agent
3. Check console logs for: `[Orchestrator] Direct @mention detected: builder`

#### TC1.3: Avoiding Unnecessary Loops

**Previous Issue (Task 4):** Orchestrator would loop between agents unnecessarily.

**Test Input:**
```
"Create a user authentication system with JWT tokens, secure password hashing, and email verification."
```

**Expected Behavior:**
1. Orchestrator routes to Product Planner first (complex feature)
2. Product Planner creates Task Map
3. Builder executes implementation tasks
4. **No loops back to orchestrator between tasks**

**What to Check:**
- Count orchestrator invocations (should be 1-2 max)
- Verify Task Map is followed sequentially
- No "Agent switching" messages mid-task

**Pass Criteria:** ✅ Orchestrator called ≤2 times, no loops

#### TC1.4: Discovery Mode Multi-Turn Refinement

**Objective:** Verify Discovery Mode allows iterative refinement before execution.

**Test Input Sequence:**

**Turn 1:**
```
"Build a dashboard for tracking user activity"
```

**Expected:** Orchestrator asks clarifying questions (Product Planner or System Architect)

**Turn 2:** (Answer clarifying questions)
```
"Show daily active users, session duration, and feature usage. Real-time updates preferred."
```

**Expected:** Agent refines design based on answers

**Turn 3:**
```
"Can we add export to CSV functionality?"
```

**Expected:** Agent incorporates new requirement without starting from scratch

**Pass Criteria:**
- ✅ Orchestrator enables 3+ turns of refinement
- ✅ Agent maintains context across turns
- ✅ Final design incorporates all requirements

---

### Scenario 2: Enhanced Agent Quality

**Objective:** Verify Task 6 enhancements improved agent response depth and structure.

#### TC2.1: UX Evaluator Enhancement (13 → 296 lines)

**Before Enhancement Issues:**
- Only 13 lines of guidance
- Generic responses
- No structured evaluation framework

**Test Input:**
```
"Evaluate the UX of the project creation flow in the app. The flow is:
1. Click 'New Project' button in sidebar
2. Modal opens with title input and description textarea
3. Click 'Create' button
4. Project appears in list"
```

**Expected Response Structure:**

```markdown
## UX Evaluation: Project Creation Flow

### Executive Summary
[Brief 2-3 sentence overview]

### User Flow Analysis
**Current Flow:**
[Step-by-step breakdown]

**Metrics:**
- Total Steps: X
- Total Clicks: X
- Estimated Time: X seconds
- Cognitive Load: Low/Medium/High

### Usability Heuristic Evaluation

#### ✅ Strengths:
1. **Visibility of System Status**: [Specific example]
2. **User Control and Freedom**: [Specific example]

#### ⚠️ Issues:

**Critical (Fix Immediately):**
1. **[Heuristic Name]**: [Specific issue with code reference]
   - **Impact**: [User impact]
   - **Recommendation**: [Actionable fix]

**Important (Fix Soon):**
[...]

**Suggestions (Consider):**
[...]

### WCAG 2.1 AA Violations

**Critical:**
1. **[Guideline]**: [Issue]
   - **Code**: `<button onclick="...">Create</button>` (missing aria-label)
   - **Fix**: `<button aria-label="Create new project" onclick="...">Create</button>`

### Cognitive Load Assessment
[Analysis of mental effort required]

### Recommendations (Prioritized)
1. **High Impact, Low Effort**: [...]
2. **High Impact, Medium Effort**: [...]
```

**Pass Criteria:**
- ✅ Response includes all sections above
- ✅ Specific code examples with file references
- ✅ WCAG violations clearly identified
- ✅ Recommendations prioritized by impact/effort
- ✅ Professional depth comparable to Nielsen Norman Group

**Comparison Test:**
1. Save the response
2. Ask same question again in a new session
3. Compare consistency and depth
4. Both should be equally comprehensive

#### TC2.2: Fact Checker & Explainer Enhancement (88 → 370 lines)

**Before Enhancement Issues:**
- No layered explanation approach
- No worked examples
- No confidence levels for fact-checking

**Test Input 1: Concept Explanation**
```
"Explain how the event loop works in JavaScript"
```

**Expected Response Structure:**

```markdown
# Explaining: JavaScript Event Loop

## One-Sentence Summary
[Simple ELI5 explanation with analogy]

## The Problem It Solves
[Why event loop exists]

## How It Works

### Conceptual Overview
[Non-technical explanation]

### Technical Mechanism
[Specific implementation: call stack, microtask queue, macrotask queue]

### Example
```typescript
[Complete working code example]
```

## Common Misconceptions
- **Misconception**: [Wrong belief]
  - **Reality**: [Correction]

## Related Concepts
- **[Concept]**: [Brief explanation]

## In This Project
- **File**: `src/services/geminiService.ts:45`
- **Usage**: [How event loop matters here]

## Further Reading
- [Resource 1]
- [Resource 2]
```

**Pass Criteria:**
- ✅ Includes all 4 levels (ELI5 → Technical → Application Context)
- ✅ Complete code example that runs
- ✅ Addresses common misconceptions
- ✅ Connects to actual project code

**Test Input 2: Fact-Checking**
```
"Fact check: React components always re-render when props change"
```

**Expected Response Structure:**

```markdown
## Fact Check: "React components always re-render when props change"

**Claim**: "React components always re-render when props change"

**Verdict**: ⚠️ Partially True

**Confidence**: High (95%)

**Evidence**:
1. **React Official Docs**:
   - [Quote with source]

2. **React.memo Documentation**:
   - [Supporting information]

**Nuances**:
- **Referential Equality**: [Caveat]
- **Memoization**: [Caveat]

**Application to Our Project**:
[Specific example from codebase]

**Bottom Line**: [1-2 sentence summary]
```

**Pass Criteria:**
- ✅ Clear verdict (✅ True | ⚠️ Partially True | ❌ False | 🔍 Context-Dependent)
- ✅ Explicit confidence level
- ✅ Evidence from authoritative sources
- ✅ Nuances clearly explained
- ✅ Application to project code

---

### Scenario 3: Execution Mode Task Maps

**Objective:** Verify Product Planner creates proper Task Maps and Builder follows them correctly.

#### TC3.1: Task Map Creation

**Test Input:**
```
"I want to add dark mode support to the application. The toggle should be in the settings menu, and it should persist the user's preference."
```

**Expected Output from Product Planner:**

```json
{
  "feature_name": "Dark Mode Support",
  "stages": [
    {
      "stage_name": "IMPLEMENTATION",
      "description": "Implement core dark mode functionality",
      "tasks": [
        {
          "task_id": "dark-mode-001",
          "description": "Create dark mode color palette in Tailwind config",
          "assigned_to": "builder",
          "estimated_time": "15 minutes",
          "dependencies": []
        },
        {
          "task_id": "dark-mode-002",
          "description": "Implement theme context and provider",
          "assigned_to": "builder",
          "estimated_time": "20 minutes",
          "dependencies": ["dark-mode-001"]
        },
        {
          "task_id": "dark-mode-003",
          "description": "Add dark mode toggle component in settings",
          "assigned_to": "builder",
          "estimated_time": "15 minutes",
          "dependencies": ["dark-mode-002"]
        },
        {
          "task_id": "dark-mode-004",
          "description": "Persist theme preference to localStorage",
          "assigned_to": "builder",
          "estimated_time": "10 minutes",
          "dependencies": ["dark-mode-002"]
        }
      ]
    },
    {
      "stage_name": "CODE_REVIEW",
      "description": "Review implementation for quality and accessibility",
      "tasks": [
        {
          "task_id": "dark-mode-review-001",
          "description": "Review dark mode implementation",
          "assigned_to": "ux-evaluator",
          "focus_areas": ["contrast ratios", "accessibility", "user preference persistence"]
        }
      ]
    },
    {
      "stage_name": "SYNTHESIZE",
      "description": "Create summary of dark mode implementation",
      "tasks": [
        {
          "task_id": "dark-mode-summary-001",
          "description": "Summarize dark mode feature",
          "assigned_to": "knowledge-curator"
        }
      ]
    }
  ]
}
```

**Pass Criteria:**
- ✅ Task Map follows 3-stage structure (IMPLEMENTATION → CODE_REVIEW → SYNTHESIZE)
- ✅ Tasks have clear dependencies
- ✅ Realistic time estimates
- ✅ Appropriate agent assignments

#### TC3.2: Task Map Execution

**Objective:** Verify Builder follows Task Map sequentially without orchestrator loops.

**What to Monitor:**
1. Builder starts with `dark-mode-001`
2. Builder completes tasks in dependency order
3. No orchestrator routing between tasks
4. UX Evaluator called for CODE_REVIEW stage
5. Knowledge Curator called for SYNTHESIZE stage

**Pass Criteria:**
- ✅ All tasks completed in correct order
- ✅ Orchestrator called only at stage transitions (not between tasks)
- ✅ Final summary includes all implemented features

---

### Scenario 4: Error Handling

**Objective:** Verify graceful error handling for common failure modes.

#### TC4.1: API Key Missing/Invalid

**Test Steps:**
1. Remove API key from `.env`
2. Restart dev server
3. Send message to agent

**Expected Behavior:**
- ❌ Should NOT crash
- ✅ Should show clear error message: "No API key found. Please configure your API key in the settings."
- ✅ Error should be recoverable (add key → reload → works)

#### TC4.2: Parse Failure (Malformed JSON)

**Objective:** Verify graceful handling when orchestrator returns invalid JSON.

**Simulation:**
This is harder to simulate directly, but can occur naturally. Monitor console for:

```
[Orchestrator] Parse failed, attempting to extract agent identifier...
```

**Expected Recovery:**
- Orchestrator uses regex fallback to extract `agent_identifier`
- Request is routed to correct agent despite parse failure
- User sees response (not error)

**Pass Criteria:**
- ✅ Parse failures are logged but don't break functionality
- ✅ Fallback mechanisms work correctly

#### TC4.3: Rate Limit Error (429)

**Test Steps:**
1. Use Gemini Free Tier (2 RPM for pro, 15 RPM for flash)
2. Send multiple rapid requests
3. Trigger rate limit

**Expected Behavior:**
- ✅ Clear error message: "Rate limit exceeded. Please wait 30 seconds before retrying."
- ✅ Suggestion to switch models or upgrade
- ✅ No crash or infinite retry loop

#### TC4.4: Network Timeout

**Simulation:**
1. Start request
2. Disconnect internet mid-request
3. Reconnect after 30 seconds

**Expected Behavior:**
- ✅ Request times out gracefully
- ✅ Error message: "Network error. Please check your connection and retry."
- ✅ User can retry without losing context

---

### Scenario 5: Documentation Quality

**Objective:** Verify the new documentation guides are accurate and helpful.

#### TC5.1: Developer Onboarding Guide

**Test:** Have a new developer (or someone unfamiliar with the project) follow the guide.

**Evaluation Questions:**

| Question | Rating (1-5) | Notes |
|----------|--------------|-------|
| Were setup instructions clear? | ⬜ | |
| Could you complete setup in 30 minutes? | ⬜ | |
| Was the architecture diagram helpful? | ⬜ | |
| Did "Adding New Agent" guide work? | ⬜ | |
| Were code examples accurate and runnable? | ⬜ | |

**Pass Criteria:**
- ✅ Average rating ≥4.0
- ✅ New developer productive within 2-4 hours

#### TC5.2: Troubleshooting Guide

**Test:** Intentionally cause common issues and attempt to resolve using the guide.

| Issue | Resolved Using Guide? | Time to Resolution | Pass/Fail |
|-------|----------------------|-------------------|-----------|
| API key error | ⬜ Yes / ⬜ No | ___ minutes | ⬜ |
| Port already in use | ⬜ Yes / ⬜ No | ___ minutes | ⬜ |
| TypeScript errors after pull | ⬜ Yes / ⬜ No | ___ minutes | ⬜ |
| Agent routing issue | ⬜ Yes / ⬜ No | ___ minutes | ⬜ |
| Rate limit error | ⬜ Yes / ⬜ No | ___ minutes | ⬜ |

**Pass Criteria:**
- ✅ 100% of issues resolvable using guide
- ✅ Average resolution time <5 minutes

---

## Feedback Collection

### Feedback Form Template

**Tester Information:**
- Name: _______________
- Role: ⬜ Developer ⬜ QA ⬜ Designer ⬜ Other: ___________
- Familiarity with project: ⬜ First time ⬜ Some experience ⬜ Very familiar
- Testing date: _______________

### Section 1: Orchestrator Routing

**1.1 How often did the orchestrator select the correct agent?**
- ⬜ Always (100%)
- ⬜ Usually (80-99%)
- ⬜ Sometimes (50-79%)
- ⬜ Rarely (<50%)

**1.2 Did you encounter unnecessary loops between agents?**
- ⬜ No
- ⬜ Yes, occasionally (1-2 times)
- ⬜ Yes, frequently (3+ times)

**1.3 Were simple identifiers recognized correctly?**
Examples: `builder`, `system-architect`, `ux-evaluator`
- ⬜ Yes, always
- ⬜ Yes, usually
- ⬜ No, often failed

### Section 2: Agent Response Quality

**2.1 Rate the quality of agent responses (1-5):**

| Agent | Quality (1-5) | Notes |
|-------|---------------|-------|
| Builder | ⬜ | |
| UX Evaluator | ⬜ | |
| Fact Checker & Explainer | ⬜ | |
| System Architect | ⬜ | |
| Product Planner | ⬜ | |
| Debug Specialist | ⬜ | |

**2.2 Did enhanced agents (UX Evaluator, Fact Checker) show noticeable improvement?**
- ⬜ Yes, significantly better
- ⬜ Yes, somewhat better
- ⬜ No noticeable difference
- ⬜ Not sure / didn't test

**2.3 Were agent responses structured and easy to follow?**
- ⬜ Always
- ⬜ Usually
- ⬜ Sometimes
- ⬜ Rarely

### Section 3: Workflow Effectiveness

**3.1 Did Discovery Mode enable useful multi-turn refinement?**
- ⬜ Yes, very helpful
- ⬜ Somewhat helpful
- ⬜ Not helpful
- ⬜ Didn't try Discovery Mode

**3.2 Did Execution Mode (Task Maps) work smoothly?**
- ⬜ Yes, tasks completed in correct order
- ⬜ Mostly, with minor issues
- ⬜ No, tasks were out of order
- ⬜ Didn't try Execution Mode

### Section 4: Error Handling

**4.1 Did you encounter any errors during testing?**
- ⬜ No
- ⬜ Yes (describe below)

**4.2 If yes, were errors handled gracefully?**
- ⬜ Yes, clear error messages and recovery
- ⬜ Somewhat, error messages could be clearer
- ⬜ No, errors caused crashes or confusion

### Section 5: Documentation

**5.1 Rate the documentation quality (1-5):**

| Document | Quality (1-5) | Notes |
|----------|---------------|-------|
| Developer Onboarding Guide | ⬜ | |
| Troubleshooting Guide | ⬜ | |
| Agent Prompt Enhancements Doc | ⬜ | |

**5.2 Did the documentation help you resolve issues?**
- ⬜ Yes, very helpful
- ⬜ Somewhat helpful
- ⬜ Not helpful

### Section 6: Overall Feedback

**6.1 Overall satisfaction with Phase 1 enhancements (1-10):**
⬜ 1 ⬜ 2 ⬜ 3 ⬜ 4 ⬜ 5 ⬜ 6 ⬜ 7 ⬜ 8 ⬜ 9 ⬜ 10

**6.2 What worked well?**
_______________________________________________
_______________________________________________
_______________________________________________

**6.3 What needs improvement?**
_______________________________________________
_______________________________________________
_______________________________________________

**6.4 Any bugs or issues encountered?**
_______________________________________________
_______________________________________________
_______________________________________________

**6.5 Additional comments:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Success Criteria

### Quantitative Metrics

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Orchestrator routing accuracy | ≥90% | ___% | ⬜ |
| Parse failure rate | ≤5% | ___% | ⬜ |
| Agent response completeness | ≥85% | ___% | ⬜ |
| Average tester satisfaction | ≥8/10 | ___/10 | ⬜ |
| Documentation helpfulness | ≥4/5 | ___/5 | ⬜ |
| Critical bugs found | 0 | ___ | ⬜ |
| TypeScript errors | 0 | ___ | ⬜ |
| Test suite pass rate | 100% | ___% | ⬜ |

### Qualitative Goals

- ✅ Orchestrator consistently routes to correct agent
- ✅ Agent responses are structured and comprehensive
- ✅ Enhanced agents (UX Evaluator, Fact Checker) show clear improvement
- ✅ Task Maps are followed correctly without loops
- ✅ Errors are handled gracefully with clear recovery paths
- ✅ Documentation enables self-service problem solving
- ✅ New developers can onboard in 2-4 hours

### Definition of "Phase 1 Complete"

Phase 1 is considered **complete** when:
1. All quantitative targets are met
2. At least 3 team members have completed testing
3. All critical bugs are fixed
4. Documentation is validated as accurate and helpful
5. Success metrics are documented for baseline comparison

---

## Known Issues to Verify

### From Task 4: Routing Analysis

The following 7 issues were identified and fixed. **Verify they no longer occur:**

#### Issue 1: Simple Identifier Parse Failures
**Previous Problem:** Orchestrator returned full IDs like `agent-builder-001` instead of simple identifiers like `builder`.

**Test:** Send "Build a navbar" → Check console log
**Expected:** `agent_identifier: "builder"` (NOT `"agent-builder-001"`)
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 2: Agent Mention Not Recognized
**Previous Problem:** `@mention` syntax not parsed correctly.

**Test:** Send "@builder create a button"
**Expected:** Direct routing to Builder without orchestrator
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 3: Unnecessary Orchestrator Loops
**Previous Problem:** Orchestrator called repeatedly between tasks.

**Test:** Request complex feature with Task Map
**Expected:** Orchestrator called once, then Builder executes all tasks
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 4: Ambiguous Agent Selection
**Previous Problem:** Orchestrator couldn't decide between similar agents.

**Test:** Send "Analyze the performance of the API"
**Expected:** Infrastructure Guardian (performance = infrastructure concern)
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 5: Invalid JSON from Orchestrator
**Previous Problem:** Orchestrator returned malformed JSON.

**Test:** Monitor console during normal usage for parse errors
**Expected:** Zero or minimal parse failures (<5%)
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 6: Missing Clarification Mechanism
**Previous Problem:** Orchestrator couldn't ask follow-up questions.

**Test:** Send ambiguous request like "Build something cool"
**Expected:** Orchestrator asks clarifying questions
**Status:** ⬜ Fixed ⬜ Still broken

#### Issue 7: No Task Map Validation
**Previous Problem:** Product Planner created invalid Task Maps.

**Test:** Request complex feature requiring Task Map
**Expected:** Valid JSON with IMPLEMENTATION → CODE_REVIEW → SYNTHESIZE stages
**Status:** ⬜ Fixed ⬜ Still broken

---

## Reporting Bugs

### Bug Report Template

**Title:** [Short description]

**Severity:**
- ⬜ Critical (blocks testing, crashes app)
- ⬜ High (major functionality broken)
- ⬜ Medium (functionality impaired but workaround exists)
- ⬜ Low (minor issue, cosmetic)

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Environment:**
- Browser: _______________
- OS: _______________
- Node version: _______________
- Commit hash: _______________

**Console Errors:**
```
[Paste console errors here]
```

**Screenshots:**
[Attach if applicable]

**Additional Context:**
[Any other relevant information]

---

## Next Steps After Testing

### 1. Compile Results (1 hour)
- Aggregate all tester feedback forms
- Calculate quantitative metrics
- Identify common issues across testers
- Create summary report

### 2. Prioritize Bugs (30 minutes)
- Categorize bugs by severity
- Identify blockers for Phase 1 completion
- Create GitHub issues for each bug

### 3. Fix Critical Issues (time varies)
- Address all critical and high severity bugs
- Re-test after fixes
- Update documentation if needed

### 4. Update Documentation (30 minutes)
- Add newly discovered issues to Troubleshooting Guide
- Update Developer Onboarding Guide with tester feedback
- Clarify any confusing sections

### 5. Measure Success Metrics (Task 11)
- Document baseline metrics
- Compare against targets
- Prepare for Phase 2 planning

### 6. Plan Phase 2 (Task 12)
- Review Phase 1 results
- Identify areas for further improvement
- Define Phase 2 objectives

---

## Appendix: Quick Reference

### Test Execution Checklist

**Before Each Testing Session:**
- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install`
- [ ] Run typecheck: `npm run typecheck` (expect 0 errors)
- [ ] Run tests: `npm test` (expect 43 passing)
- [ ] Start dev server: `npm run dev`
- [ ] Clear browser data (optional): `localStorage.clear()`

**During Testing:**
- [ ] Keep browser console open for errors
- [ ] Take notes of any issues immediately
- [ ] Save examples of good/bad agent responses
- [ ] Monitor orchestrator routing decisions
- [ ] Test both Discovery and Execution modes

**After Testing:**
- [ ] Fill out feedback form
- [ ] Report bugs using template
- [ ] Share feedback with team
- [ ] Save any relevant screenshots/logs

### Key Files for Reference

**Orchestrator:**
- `src/agents/orchestrator.ts` - Routing logic

**Enhanced Agents:**
- `src/agents/ux-evaluator.ts` - UX evaluation framework
- `src/agents/fact-checker-explainer.ts` - Layered explanations

**Services:**
- `src/services/geminiService.ts` - Gemini API integration
- `src/services/anthropicService.ts` - Claude API integration

**Documentation:**
- `docs/DEVELOPER_ONBOARDING.md` - Setup and architecture
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/agent-prompt-enhancements.md` - Enhancement details

### Contact for Testing Support

**Issues with Setup:**
- Check: `docs/DEVELOPER_ONBOARDING.md`
- Check: `docs/TROUBLESHOOTING.md`
- Ask: [Team Slack channel or email]

**Reporting Bugs:**
- Use bug report template above
- Create GitHub issue
- Tag with `phase-1-testing`

**Questions about Testing:**
- Refer to this guide
- Ask team lead
- Check `docs/agent-prompt-enhancements.md` for context

---

**Thank you for testing Phase 1! Your feedback is critical to improving the MilkStack Multi-Agent Hub.**
