# Troubleshooting Guide

**Quick diagnosis and solutions for common issues in MilkStack Multi-Agent Hub**

This guide helps you diagnose and fix issues quickly. Each section starts with **symptoms** (what you see) and provides **diagnosis** and **solutions**.

---

## Table of Contents

1. [Setup & Installation Issues](#setup--installation-issues)
2. [API Key & Authentication Issues](#api-key--authentication-issues)
3. [Agent Routing Issues](#agent-routing-issues)
4. [Message & Response Issues](#message--response-issues)
5. [Performance Issues](#performance-issues)
6. [Data Persistence Issues](#data-persistence-issues)
7. [GitHub Integration Issues](#github-integration-issues)
8. [Build & Development Issues](#build--development-issues)
9. [Browser Compatibility Issues](#browser-compatibility-issues)

---

## Setup & Installation Issues

### Issue: `npm install` Fails with Dependency Errors

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Diagnosis:** Package version conflicts or corrupted package-lock.json

**Solutions:**

**Solution 1: Clean Install**
```bash
# Delete existing installations
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

**Solution 2: Update npm**
```bash
# Check npm version
npm --version  # Should be 9.x or higher

# Update npm
npm install -g npm@latest

# Retry installation
npm install
```

**Solution 3: Use specific Node version**
```bash
# Install nvm (if not already installed)
# https://github.com/nvm-sh/nvm

# Use Node 18 LTS
nvm install 18
nvm use 18

# Retry installation
npm install
```

---

### Issue: `npm run dev` Shows "Port Already in Use"

**Symptoms:**
```
Error: Port 5173 is already in use
```

**Diagnosis:** Another process is using port 5173 (default Vite port)

**Solutions:**

**Solution 1: Kill the process using port 5173**
```bash
# macOS/Linux
lsof -ti:5173 | xargs kill -9

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Solution 2: Use a different port**
```bash
# Start with custom port
npm run dev -- --port 3000
```

**Solution 3: Change default port in vite.config.ts**
```typescript
export default defineConfig({
  server: {
    port: 3000, // Change to any available port
  },
});
```

---

### Issue: Blank Page After Starting Dev Server

**Symptoms:**
- Browser shows blank white page
- No errors in terminal
- Console may show errors

**Diagnosis:** JavaScript error preventing app from rendering

**Solutions:**

**Step 1: Check browser console**
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Look for error messages

**Step 2: Common fixes based on console errors**

**If you see "Cannot read property of undefined":**
```bash
# Likely missing .env file
cp .env.example .env
# Add your API keys
```

**If you see "Failed to fetch":**
```bash
# Browser blocking localhost
# Check browser console for CORS errors
# Restart dev server
npm run dev
```

**If you see no errors:**
```bash
# Clear cache and restart
# Ctrl+Shift+R (hard reload)
# or
# Close browser, clear cache, reopen
```

---

## API Key & Authentication Issues

### Issue: "No API key found" Error

**Symptoms:**
- Error message: "Gemini API key is required" or "No API key found"
- Agents don't respond
- Error appears immediately when sending message

**Diagnosis:** Missing or incorrect API key configuration

**Solutions:**

**Solution 1: Verify .env file exists**
```bash
# Check if .env exists
ls -la .env

# If not, create it
cp .env.example .env
```

**Solution 2: Verify API keys in .env**
```env
# For Gemini agents (REQUIRED)
GEMINI_API_KEY=AIzaSy...  # Should start with AIzaSy

# For Claude/Rusty (OPTIONAL)
VITE_ANTHROPIC_API_KEY=sk-ant-...  # Should start with sk-ant-

# For GitHub features (OPTIONAL)
VITE_GITHUB_TOKEN=ghp_...  # Should start with ghp_ or github_pat_
```

**Solution 3: Restart development server**
```bash
# .env changes require restart
# Stop server (Ctrl+C)
npm run dev
# Refresh browser
```

**Solution 4: Check for typos**
```env
# ❌ WRONG - Missing VITE_ prefix for client-side variables
ANTHROPIC_API_KEY=sk-ant-...

# ✅ CORRECT
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

**Note:** Variables used in client-side code (browser) MUST have `VITE_` prefix. Server-side variables do not need the prefix.

---

### Issue: API Key Valid But Still Getting Auth Errors

**Symptoms:**
- API key is correct
- Still seeing 401 Unauthorized or 403 Forbidden errors

**Diagnosis:** API key lacks permissions or has been revoked

**Solutions:**

**For Gemini API:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Check if key is still active
3. Generate new key if needed
4. Update `.env` with new key
5. Restart dev server

**For Claude API:**
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Check API key status
3. Verify account has credits
4. Generate new key if needed
5. Update `.env` with new key

**For GitHub API:**
1. Visit [GitHub Tokens](https://github.com/settings/tokens)
2. Check token hasn't expired
3. Verify scopes: `repo`, `read:org`
4. Regenerate if needed

---

### Issue: Rate Limit Errors (429 Too Many Requests)

**Symptoms:**
```
Error: 429 Resource has been exhausted (e.g. check quota)
```
or
```
Error: Rate limit exceeded
```

**Diagnosis:** Hitting API rate limits

**Understanding Rate Limits:**

**Gemini Free Tier:**
- 2 requests per minute (RPM) for gemini-2.5-pro
- 15 RPM for gemini-2.5-flash
- 1 million tokens per day

**Gemini Paid Tier:**
- 1000 RPM for gemini-2.5-pro
- 4000 RPM for gemini-2.5-flash

**Claude API:**
- Varies by tier (check Anthropic Console)

**Solutions:**

**Solution 1: Wait before retrying**
```
Wait 30-60 seconds before sending another message
```

**Solution 2: Use flash model for non-critical tasks**
```typescript
// In src/config/ai.ts
export const DEFAULT_MODEL = MODELS.FLASH; // Instead of PRO
```

**Solution 3: Reduce orchestrator turns**
```typescript
// In src/services/discoveryService.ts
const MAX_DISCOVERY_TURNS = 5; // Reduce from 10
```

**Solution 4: Upgrade to paid tier**
- Gemini: [Upgrade in Google Cloud Console](https://console.cloud.google.com/)
- Claude: [Add credits in Anthropic Console](https://console.anthropic.com/)

**Solution 5: Implement caching** (Advanced)
Consider caching orchestrator decisions for similar messages.

---

## Agent Routing Issues

### Issue: Orchestrator Returns "Unknown Agent" Error

**Symptoms:**
```
[Discovery] Orchestrator routed to unknown agent: "system architect"
```

**Diagnosis:** Agent identifier not being normalized correctly

**Solutions:**

**Solution 1: Check browser console for full error**
Look for:
```
[Discovery] Available identifiers: ["builder", "system-architect", ...]
```

**Solution 2: Verify agent exists**
```typescript
// Check src/agents/index.ts
import { systemarchitectAgent } from './system-architect';

export const AGENT_PROFILES = [
  orchestratorAgent,
  systemarchitectAgent, // Make sure agent is exported here
  // ...
];
```

**Solution 3: Check agent ID format**
```typescript
// Agent file should have:
export const systemarchitectAgent: Agent = {
  id: 'agent-system-architect-001',  // Full ID
  name: 'System Architect',          // Display name
  // ...
};
```

**Solution 4: If issue persists, restart dev server**
```bash
# Stop and restart
npm run dev
```

---

### Issue: Agent Responds But Message Seems Off-Topic

**Symptoms:**
- Wrong agent responds to message
- Response doesn't match the question
- Example: Asked for UX review, got code implementation

**Diagnosis:** Orchestrator routing heuristics need context

**Solutions:**

**Solution 1: Be more explicit in your message**
```
❌ "Review this"
✅ "I need a UX evaluation of the dashboard component focusing on accessibility"

❌ "Fix the bug"
✅ "Debug the authentication error occurring in src/services/authService.ts line 45"
```

**Solution 2: Use agent mentions**
```
"@ux-evaluator please review the dashboard for WCAG 2.1 AA compliance"
```

**Solution 3: Provide codebase context**
When creating project, add:
- GitHub repository URL
- Code snippets
- File structure

**Solution 4: Check orchestrator prompt**
If routing is consistently wrong, the orchestrator heuristics may need adjustment.
See `src/services/discoveryService.ts` line 79-132 (ROUTING INTELLIGENCE section).

---

### Issue: Orchestrator Loops Between Same Agents

**Symptoms:**
- Agent A responds → Orchestrator routes to Agent B → Agent B responds → Orchestrator routes back to Agent A
- Reaches MAX_DISCOVERY_TURNS (10) without useful progress
- Console shows: "Max turns reached"

**Diagnosis:** Agents not reaching consensus or providing unclear signals

**Solutions:**

**Solution 1: Interrupt the loop**
Send a decisive message:
```
"That sounds good, let's proceed with Agent B's approach"
```

This triggers consensus detection.

**Solution 2: Be explicit about readiness**
```
"Implement this plan" → Triggers CONSENSUS_REACHED
"Let's execute this" → Triggers CONSENSUS_REACHED
```

**Solution 3: Ask orchestrator to stop**
```
"Stop debating and give me a recommendation"
```

**Solution 4: Start new conversation**
If stuck in loop, create new project or continue with different approach.

---

### Issue: Agent Doesn't Stream Response (Shows All at Once)

**Symptoms:**
- Agent response appears all at once instead of word-by-word
- No "thinking" or streaming effect

**Diagnosis:** Streaming not properly configured or network buffering

**Solutions:**

**Solution 1: Check network**
Slow networks may buffer chunks. This is expected behavior.

**Solution 2: Verify streaming is enabled**
Check browser console for:
```
[Agent] Starting streaming for agent-builder-001
```

If not present, streaming may not be enabled for that agent.

**Solution 3: Check API response**
Some API errors return full text instead of streaming. Check console for errors.

**Solution 4: Not a bug for short responses**
Short responses (< 100 chars) may appear instantly. This is normal.

---

## Message & Response Issues

### Issue: Agent Stops Responding Mid-Message

**Symptoms:**
- Agent starts responding
- Message cuts off mid-sentence
- No error message
- "Agent Thinking" indicator may stay visible

**Diagnosis:** API error, network issue, or safety filter triggered

**Solutions:**

**Solution 1: Check browser console**
Look for:
```
[Gemini] API error: ...
[Gemini] Safety block: ...
```

**Solution 2: Safety filter triggered**
If message was cut off due to safety filter:
- Rephrase your message to avoid sensitive topics
- Check Gemini safety settings in `src/config/ai.ts`

**Solution 3: Network timeout**
```bash
# Check internet connection
ping google.com

# Restart dev server
npm run dev
```

**Solution 4: Retry the message**
Delete the incomplete message and resend.

---

### Issue: Agent Responses Are Generic/Low Quality

**Symptoms:**
- Responses don't reference codebase
- Generic advice not specific to project
- Agent doesn't seem to understand context

**Diagnosis:** Missing codebase context or insufficient prompt clarity

**Solutions:**

**Solution 1: Add codebase context**
When creating project:
1. Click "New Project"
2. Add GitHub URL or paste code in "Codebase Context"
3. Be specific about what you're building

**Solution 2: Provide more context in messages**
```
❌ "Make the UI better"
✅ "Improve the dashboard UI in src/components/Dashboard.tsx:
   - Add loading states
   - Improve color contrast for accessibility
   - Add error boundaries
   Current code: [paste relevant code]"
```

**Solution 3: Reference specific files**
```
"Review src/services/geminiService.ts for potential bugs in the executeStreaming function"
```

**Solution 4: Use better agents**
- For deep analysis: @deep-research-specialist
- For architecture: @system-architect
- For code quality: @advanced-coding-specialist

---

### Issue: Long Response Gets Cut Off

**Symptoms:**
- Agent response is very long
- Suddenly stops mid-response
- No error in console

**Diagnosis:** Token limit reached

**Understanding Token Limits:**
- Gemini 2.5 Pro: 1 million token context, 8192 token output
- Gemini 2.5 Flash: 1 million token context, 8192 token output

**Solutions:**

**Solution 1: Break into smaller requests**
```
Instead of: "Implement the entire authentication system"
Try: "First, design the authentication architecture"
Then: "Implement the login endpoint"
Then: "Implement the session management"
```

**Solution 2: Request summaries**
```
"Provide a high-level summary first, then we'll drill into details"
```

**Solution 3: Use Product Planner for large features**
Product Planner creates Task Maps that break work into manageable chunks.

---

### Issue: JSON Parse Error in Console

**Symptoms:**
```
[Discovery] Orchestrator JSON parse failed
[Discovery] Response text: ```json {"agent": ...} ```
```

**Diagnosis:** LLM wrapped JSON in markdown despite `responseMimeType: 'application/json'`

**Solutions:**

**Solution 1: This is handled automatically**
The system has 3-layer fallback parsing (see `src/services/discoveryService.ts`):
1. Direct JSON.parse()
2. Extract from markdown code blocks
3. Find JSON object in text

If you see this error but agent still responds, it's working as intended.

**Solution 2: If routing fails completely**
```bash
# Check orchestrator improvements were applied
git log --oneline | grep -i "orchestrator"

# If missing, pull latest changes
git pull origin main
npm install
npm run dev
```

**Solution 3: Report persistent issues**
If JSON parsing consistently fails, create GitHub issue with:
- Full console error
- Message that triggered error
- Orchestrator response text

---

## Performance Issues

### Issue: Application Feels Slow/Laggy

**Symptoms:**
- UI updates slowly
- Typing feels delayed
- Clicking buttons has lag

**Diagnosis:** Performance bottleneck in React rendering or state updates

**Solutions:**

**Solution 1: Check browser DevTools Performance**
1. Open DevTools (F12)
2. Go to "Performance" tab
3. Click Record
4. Interact with app
5. Stop recording
6. Look for long tasks (yellow/red bars)

**Solution 2: Disable React DevTools in production**
React DevTools can slow down the app. Disable it when not debugging:
1. Open React DevTools
2. Click gear icon
3. Uncheck "Highlight updates"

**Solution 3: Reduce message history**
If project has 1000+ messages:
```typescript
// In ProjectContext, add message limit
const MAX_MESSAGES = 100;
const recentMessages = messages.slice(-MAX_MESSAGES);
```

**Solution 4: Close unused projects**
Having 20+ projects open may slow IndexedDB queries.
Archive or delete old projects.

**Solution 5: Use browser with better performance**
Chrome/Edge typically perform better than Firefox for React apps.

---

### Issue: Agent Responses Take Very Long

**Symptoms:**
- Waiting 30+ seconds for first response
- "Agent Thinking" indicator shows for long time
- Eventually times out

**Diagnosis:** Large codebase context, complex message, or API latency

**Solutions:**

**Solution 1: Reduce codebase context**
Large context (100k+ chars) slows processing:
- Remove unnecessary files from context
- Use summaries instead of full code
- Focus on relevant modules only

**Solution 2: Simplify message**
```
Instead of: "Analyze the entire codebase for potential security vulnerabilities, performance bottlenecks, and architectural issues"
Try: "Identify security vulnerabilities in src/services/authService.ts"
```

**Solution 3: Use flash model for simple queries**
Flash is 10x faster than Pro for simple tasks:
```typescript
// Orchestrator will automatically use flash for simple queries
// Or explicitly request it:
"@builder using flash model, add a button component"
```

**Solution 4: Check API status**
```bash
# Test Gemini API directly
curl https://generativelanguage.googleapis.com/v1beta/models \
  -H "x-goog-api-key: YOUR_API_KEY"
```

If slow, it's an API issue. Wait or check [Google Cloud Status](https://status.cloud.google.com/).

---

### Issue: Browser Tab Freezes

**Symptoms:**
- Tab becomes unresponsive
- Browser shows "Page Unresponsive" dialog
- CPU usage spikes to 100%

**Diagnosis:** Infinite loop or heavy computation blocking event loop

**Solutions:**

**Solution 1: Reload the tab**
Click "Wait" or force reload (Cmd+R / Ctrl+R)

**Solution 2: Check console before freezing**
If you can reproduce the freeze:
1. Open DevTools
2. Interact with app
3. Watch for errors before freeze

**Solution 3: Report issue**
If reproducible, create GitHub issue with:
- Steps to reproduce
- Browser version
- Message that triggered freeze
- Console errors

**Solution 4: Workaround**
Restart browser and avoid the action that caused freeze.

---

## Data Persistence Issues

### Issue: Projects Disappear After Refresh

**Symptoms:**
- Create project
- Refresh page
- Project is gone

**Diagnosis:** IndexedDB not persisting or browser storage disabled

**Solutions:**

**Solution 1: Check IndexedDB is enabled**
1. Open DevTools (F12)
2. Go to "Application" tab
3. Expand "IndexedDB"
4. Look for "milkstack-multi-agent-hub"

If missing, IndexedDB is blocked.

**Solution 2: Enable cookies and storage**
- Chrome: Settings → Privacy → Cookies → Allow
- Firefox: Settings → Privacy → Custom → Cookies → Allow
- Safari: Settings → Privacy → Uncheck "Block all cookies"

**Solution 3: Check incognito mode**
Incognito/Private mode may block IndexedDB. Use regular window.

**Solution 4: Clear storage and try again**
```
DevTools → Application → Storage → Clear Site Data
Refresh page, create project, verify it persists
```

---

### Issue: Lost All Projects After Update

**Symptoms:**
- Updated application (npm install, git pull)
- All projects gone

**Diagnosis:** Database schema changed without migration

**Solutions:**

**Solution 1: Check IndexedDB for backup**
```
DevTools → Application → IndexedDB → milkstack-multi-agent-hub
Check if data is still there
```

**Solution 2: Export projects before updating**
(Feature may not exist yet - future enhancement)

**Solution 3: Check git for schema changes**
```bash
git log --oneline -- src/services/indexedDbService.ts
```

**Solution 4: Recovery not possible**
If schema changed incompatibly, data may be unrecoverable.
Going forward: Export projects regularly as JSON backups.

---

### Issue: Can't Delete Project

**Symptoms:**
- Click delete project
- Error message or nothing happens
- Project still appears in sidebar

**Diagnosis:** Database lock or referential integrity issue

**Solutions:**

**Solution 1: Refresh page and try again**
```
Ctrl+R or Cmd+R
Try deleting again
```

**Solution 2: Check browser console**
Look for:
```
[IndexedDB] Failed to delete project
```

**Solution 3: Manually delete from IndexedDB**
```
DevTools → Application → IndexedDB → projects
Find project row, right-click → Delete
Refresh page
```

**Solution 4: Clear all data**
**WARNING: This deletes ALL projects**
```
DevTools → Application → Storage → Clear Site Data
```

---

## GitHub Integration Issues

### Issue: Can't Connect GitHub Repository

**Symptoms:**
- Enter GitHub URL
- Error: "Failed to fetch repository"
- Or: No error but codebase context empty

**Diagnosis:** Missing GitHub token, invalid URL, or API rate limit

**Solutions:**

**Solution 1: Verify GitHub token is set**
```env
# .env file
VITE_GITHUB_TOKEN=ghp_...
```

Token must:
- Start with `ghp_` or `github_pat_`
- Have `repo` scope
- Be active (not expired)

**Solution 2: Verify URL format**
```
✅ CORRECT:
https://github.com/username/repo
https://github.com/username/repo.git

❌ WRONG:
github.com/username/repo
username/repo
```

**Solution 3: Check token scopes**
1. Visit [GitHub Tokens](https://github.com/settings/tokens)
2. Find your token
3. Verify scopes include: `repo`, `read:org`
4. Regenerate with correct scopes if needed

**Solution 4: Check repository access**
- Public repos: Should work with any valid token
- Private repos: Token must have access to that specific repo

**Solution 5: Rate limit**
GitHub API: 60 requests/hour (unauthenticated) or 5000/hour (authenticated)

Check rate limit:
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/rate_limit
```

---

### Issue: Can't Commit Changes to GitHub

**Symptoms:**
- Generate code changes
- Click "Commit to GitHub"
- Error: "Push failed" or "Authentication required"

**Diagnosis:** Insufficient GitHub token permissions or authentication issue

**Solutions:**

**Solution 1: Check token scopes**
Committing requires `repo` scope (full control).

**Solution 2: Verify branch permissions**
- Protected branches (like `main`) may block direct pushes
- Use feature branches instead

**Solution 3: Check repository permissions**
- You must have write access to the repository
- Fork the repo if you don't have write access

**Solution 4: Not implemented yet**
Note: GitHub commit functionality may be in development.
Check `src/services/githubService.ts` for implementation status.

---

## Build & Development Issues

### Issue: TypeScript Errors After Git Pull

**Symptoms:**
```
npm run typecheck
Found 47 errors
```

**Diagnosis:** Types changed in update but local files not updated

**Solutions:**

**Solution 1: Reinstall dependencies**
```bash
npm install
npm run typecheck
```

**Solution 2: Check for breaking changes**
```bash
git log --oneline -10
# Look for commits mentioning "breaking change"
```

**Solution 3: Clear TypeScript cache**
```bash
# Remove TypeScript build info
rm -rf node_modules/.cache
npm run typecheck
```

**Solution 4: Check your local changes**
```bash
git status
# If you have uncommitted changes that conflict
git stash
npm run typecheck
git stash pop
```

---

### Issue: ESLint Shows Hundreds of Warnings

**Symptoms:**
```
npm run lint
258 problems (21 errors, 237 warnings)
```

**Diagnosis:** This is expected during gradual migration

**Solutions:**

**Solution 1: Warnings are OK during development**
The project is configured to allow warnings. Focus on fixing errors.

**Solution 2: Fix errors only**
```bash
npm run lint:fix  # Auto-fixes many issues
```

**Solution 3: Ignore warnings in CI**
Warnings don't block commits. Only errors must be fixed.

**Solution 4: Fix warnings gradually**
When editing a file, fix warnings in that file.

---

### Issue: Build Fails with "Out of Memory"

**Symptoms:**
```
npm run build
JavaScript heap out of memory
```

**Diagnosis:** Large codebase or insufficient memory

**Solutions:**

**Solution 1: Increase Node memory limit**
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

**Solution 2: Close other applications**
Free up RAM by closing unused applications.

**Solution 3: Build on more powerful machine**
CI/CD environments typically have more resources.

**Solution 4: Check for memory leaks**
```bash
npm run build -- --debug
# Look for patterns causing memory issues
```

---

## Browser Compatibility Issues

### Issue: App Doesn't Work in Safari

**Symptoms:**
- Blank page in Safari
- Features work in Chrome but not Safari

**Diagnosis:** Safari's stricter IndexedDB or WebAPI implementation

**Solutions:**

**Solution 1: Check Safari version**
Safari 14+ required for proper IndexedDB support.

**Solution 2: Enable IndexedDB in Safari**
Safari → Preferences → Privacy → uncheck "Prevent cross-site tracking" (for localhost)

**Solution 3: Check console for specific errors**
Safari DevTools may show different errors than Chrome.

**Solution 4: Use Chrome/Edge for development**
Better React DevTools and debugging experience.

---

### Issue: App Doesn't Work in Firefox

**Symptoms:**
- Some features broken in Firefox
- Works fine in Chrome

**Diagnosis:** Browser API differences

**Solutions:**

**Solution 1: Check Firefox version**
Firefox 90+ recommended.

**Solution 2: Check console for errors**
Firefox may show more strict warnings.

**Solution 3: Disable strict tracking protection**
Firefox → Settings → Privacy → Standard mode (for localhost)

**Solution 4: Known Firefox issues**
Some streaming APIs behave differently. Report specific issues to GitHub.

---

## Emergency Procedures

### Nuclear Option: Complete Reset

**When nothing else works:**

```bash
# 1. Backup projects (if possible)
# Go to DevTools → Application → IndexedDB → Export

# 2. Stop dev server
# Ctrl+C

# 3. Remove all dependencies and caches
rm -rf node_modules package-lock.json
rm -rf .vite dist

# 4. Clear npm cache
npm cache clean --force

# 5. Clear browser data
# DevTools → Application → Clear Storage → Clear Site Data

# 6. Reinstall
npm install

# 7. Restart
npm run dev

# 8. Create test project
# Verify everything works
```

---

## Getting Additional Help

### Before Reporting an Issue

Collect this information:

1. **Error message** (full text from console)
2. **Steps to reproduce** (detailed)
3. **Environment**:
   ```bash
   node --version
   npm --version
   # Browser name and version
   # Operating system
   ```
4. **What you've tried** (solutions from this guide)

### Where to Get Help

1. **Check existing documentation**:
   - `/docs/DEVELOPER_ONBOARDING.md` - Development guide
   - `/docs/orchestrator-improvements.md` - Routing system
   - `/docs/agent-prompt-enhancements.md` - Agent system
   - `/docs/routing-analysis.md` - Known routing issues

2. **Search GitHub issues**:
   - [GitHub Issues](https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub/issues)
   - Search for your error message

3. **Create new GitHub issue**:
   - Use issue template (if exists)
   - Include all info from "Before Reporting" section
   - Label appropriately: `bug`, `question`, `help-wanted`

4. **Community**:
   - GitHub Discussions (if enabled)
   - Discord/Slack (if exists)

---

## Quick Reference

### Common Commands

```bash
# Fix most development issues
npm install && npm run typecheck && npm run dev

# Reset everything
rm -rf node_modules package-lock.json && npm install

# Clear browser storage
DevTools → Application → Clear Storage

# Check logs
Browser Console (F12)
```

### Common Error Patterns

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| "No API key found" | Missing .env file | `cp .env.example .env` |
| "429 Rate limit" | Too many requests | Wait 60 seconds |
| "Unknown agent" | Agent not registered | Check `src/agents/index.ts` |
| "Cannot find module" | Import path wrong | Check file actually exists |
| "Implicit any" | Missing type | Add explicit type annotation |
| "Port in use" | Port 5173 occupied | `lsof -ti:5173 \| xargs kill -9` |

### Environment Check

```bash
# Verify your environment is correct
node --version     # 18.x or higher
npm --version      # 9.x or higher
cat .env | head -3 # Should show API keys (first 10 chars)
npm run typecheck  # Should show "0 errors"
npm run test:run   # Should show "43 tests passed"
```

---

*Last Updated*: 2025-11-24
*Author*: MilkStack Team
*Version*: 1.0
