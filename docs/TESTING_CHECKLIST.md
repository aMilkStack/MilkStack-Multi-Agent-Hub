# Phase 1 Testing Checklist

**Tester:** _______________
**Date:** _______________
**Start Time:** _____  **End Time:** _____

---

## Pre-Testing Setup

- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install`
- [ ] Run typecheck: `npm run typecheck` → Expect: ✅ 0 errors
- [ ] Run tests: `npm test` → Expect: ✅ 43 passing
- [ ] Configure API keys in `.env`:
  - [ ] `VITE_GEMINI_API_KEY=...`
  - [ ] `VITE_ANTHROPIC_API_KEY=...`
- [ ] Start dev server: `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Open browser console (F12)
- [ ] **Optional:** Clear data: `localStorage.clear()` in console

---

## Orchestrator Routing Tests (10 min)

**Goal:** Verify correct agent selection

- [ ] **Test 1:** "Build a login form" → Expect: **Builder**
- [ ] **Test 2:** "Explain how closures work" → Expect: **Fact Checker & Explainer**
- [ ] **Test 3:** "Review the dashboard UX" → Expect: **UX Evaluator**
- [ ] **Test 4:** "Design the system architecture" → Expect: **System Architect**
- [ ] **Test 5:** "Debug this error: TypeError..." → Expect: **Debug Specialist**
- [ ] **Test 6:** "@builder create a navbar" → Expect: **Direct to Builder** (no orchestrator)

**Routing Accuracy:** ___/6 tests passed (___%)

**Issues found:** _______________________________________________

---

## Enhanced Agent Quality Tests (20 min)

### UX Evaluator Test (10 min)

**Input:** "Evaluate the project creation flow"

- [ ] Response includes **Executive Summary**
- [ ] Response includes **User Flow Analysis** with metrics (steps, clicks, time)
- [ ] Response includes **Usability Heuristic Evaluation** (Critical/Important/Suggestions)
- [ ] Response includes **WCAG 2.1 AA Violations** with code examples
- [ ] Response includes **Cognitive Load Assessment**
- [ ] Response includes **Recommendations** prioritized by impact
- [ ] Overall quality: ⬜ Excellent ⬜ Good ⬜ Fair ⬜ Poor

**Quality Rating:** ___/10

**Notes:** _______________________________________________

### Fact Checker & Explainer Test (10 min)

**Choose one:**
- [ ] **Option A:** "Explain how the event loop works"
- [ ] **Option B:** "Fact check: React components always re-render when props change"

**For Explanation (Option A):**
- [ ] Includes **One-Sentence Summary** (ELI5)
- [ ] Includes **Conceptual Overview** (non-technical)
- [ ] Includes **Technical Mechanism** (detailed)
- [ ] Includes **Application Context** (project-specific code reference)
- [ ] Includes working **Code Example**
- [ ] Addresses **Common Misconceptions**

**For Fact-Check (Option B):**
- [ ] Clear **Verdict** (✅ True / ⚠️ Partially True / ❌ False / 🔍 Context-Dependent)
- [ ] Explicit **Confidence Level** (e.g., "High (95%)")
- [ ] **Evidence** from authoritative sources
- [ ] **Nuances** clearly explained
- [ ] **Application to Project** with code reference

**Quality Rating:** ___/10

**Notes:** _______________________________________________

---

## Task Map Execution Test (15 min)

**Input:** "Add dark mode support to the application. The toggle should be in settings and persist user preference."

- [ ] **Product Planner** creates Task Map
- [ ] Task Map is valid JSON
- [ ] Task Map follows 3-stage structure:
  - [ ] IMPLEMENTATION stage
  - [ ] CODE_REVIEW stage
  - [ ] SYNTHESIZE stage
- [ ] Tasks have clear **dependencies**
- [ ] Tasks have **realistic time estimates**
- [ ] **Builder** executes IMPLEMENTATION tasks in correct order
- [ ] **No orchestrator loops** between tasks
- [ ] **UX Evaluator** or other agent does CODE_REVIEW
- [ ] **Knowledge Curator** does SYNTHESIZE

**Quality Rating:** ___/10

**Issues found:** _______________________________________________

---

## Discovery Mode Test (10 min)

**Input:** "Build a dashboard for tracking user activity"

**Expected:** Orchestrator or agent asks clarifying questions

- [ ] **Turn 1:** System asks clarifying questions
- [ ] **Turn 2:** Provide answer (e.g., "Show daily active users, session duration")
- [ ] Agent refines design based on answer
- [ ] **Turn 3:** Add new requirement (e.g., "Can we add CSV export?")
- [ ] Agent incorporates new requirement without restarting
- [ ] Context maintained across all 3+ turns

**Quality Rating:** ___/10

**Notes:** _______________________________________________

---

## Error Handling Tests (10 min)

### Test 1: API Key Missing
- [ ] Remove API key from `.env`
- [ ] Restart dev server
- [ ] Send message
- [ ] **Expect:** Clear error message (not crash)
- [ ] Add API key back, reload
- [ ] **Expect:** Works correctly

**Result:** ⬜ Pass ⬜ Fail

### Test 2: Rate Limit (if possible)
- [ ] Send multiple rapid requests (Gemini: 2 RPM pro, 15 RPM flash)
- [ ] **Expect:** Clear rate limit error with suggestions

**Result:** ⬜ Pass ⬜ Fail ⬜ N/A

### Test 3: Network Interruption (if possible)
- [ ] Start request
- [ ] Disconnect internet mid-request
- [ ] **Expect:** Graceful timeout with error message
- [ ] Reconnect
- [ ] **Expect:** Can retry without losing context

**Result:** ⬜ Pass ⬜ Fail ⬜ N/A

**Error Handling Rating:** ___/10

---

## Documentation Tests (15 min)

### Developer Onboarding Guide

- [ ] Open `docs/DEVELOPER_ONBOARDING.md`
- [ ] Follow "First Day Setup" section
- [ ] **Timing:** Could you complete setup in 30 minutes? ⬜ Yes ⬜ No
- [ ] **Clarity:** Were instructions clear? ⬜ Yes ⬜ No
- [ ] **Accuracy:** Were code examples correct? ⬜ Yes ⬜ No

**Rating:** ___/5

**Notes:** _______________________________________________

### Troubleshooting Guide

- [ ] Open `docs/TROUBLESHOOTING.md`
- [ ] Intentionally cause an issue (e.g., remove API key)
- [ ] Use guide to resolve it
- [ ] **Timing:** Resolved in <5 minutes? ⬜ Yes ⬜ No
- [ ] **Effectiveness:** Guide helped solve issue? ⬜ Yes ⬜ No

**Rating:** ___/5

**Notes:** _______________________________________________

---

## Known Issues Verification (10 min)

**These 7 issues were supposedly fixed. Verify they no longer occur:**

- [ ] **Issue 1:** Simple identifiers work (e.g., `builder` not `agent-builder-001`)
- [ ] **Issue 2:** @mention syntax recognized correctly
- [ ] **Issue 3:** No unnecessary orchestrator loops
- [ ] **Issue 4:** Orchestrator handles ambiguous requests (asks for clarification)
- [ ] **Issue 5:** Minimal JSON parse failures (<5%)
- [ ] **Issue 6:** Orchestrator can ask follow-up questions
- [ ] **Issue 7:** Task Maps are valid and structured correctly

**Issues Fixed:** ___/7

**Issues Still Present:** _______________________________________________

---

## General Usage (10 min)

**Freestyle testing - use the app naturally**

- [ ] Create a new project
- [ ] Ask a variety of questions
- [ ] Test different agents
- [ ] Try edge cases

**Overall Experience:** ___/10

**Positive observations:**
1. _______________________________________________
2. _______________________________________________

**Negative observations:**
1. _______________________________________________
2. _______________________________________________

---

## Bug Reports

**Did you find any bugs?** ⬜ Yes ⬜ No

**If yes, briefly describe (use full bug report template for details):**

| Severity | Description | Steps to Reproduce |
|----------|-------------|-------------------|
| ⬜ Critical ⬜ High ⬜ Medium ⬜ Low | _______________ | _______________ |
| ⬜ Critical ⬜ High ⬜ Medium ⬜ Low | _______________ | _______________ |
| ⬜ Critical ⬜ High ⬜ Medium ⬜ Low | _______________ | _______________ |

---

## Final Ratings

| Area | Rating (1-10) |
|------|---------------|
| Orchestrator Routing | ___/10 |
| Agent Response Quality | ___/10 |
| Task Map Execution | ___/10 |
| Error Handling | ___/10 |
| Documentation | ___/10 |
| **Overall Satisfaction** | **___/10** |

---

## Recommendation

**Would you recommend Phase 1 for production?**

⬜ Yes, ready now
⬜ Yes, after fixing critical bugs
⬜ No, needs more work
⬜ Not sure

**Reason:** _______________________________________________

---

## Post-Testing

- [ ] Fill out detailed feedback form (`docs/TESTING_FEEDBACK_TEMPLATE.md`)
- [ ] Report bugs using bug report template
- [ ] Share findings with team
- [ ] Save console logs if any errors occurred

---

**Testing Complete!** Total time: ___ hours ___ minutes

**Thank you for testing Phase 1!**
