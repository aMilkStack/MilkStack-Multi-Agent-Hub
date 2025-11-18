# 🤖↔️🤖 AI-to-AI Collaboration Workflow

This document explains how **Claude Code (Real Claude)** and **Rusty (Gemini-Claude clone)** work together through GitHub to build and test the MilkStack Multi-Agent Hub.

## The Players

1. **You (The Orchestrator)** - Coordinates both AIs
2. **Claude Code (me)** - Works in your GitHub Codespace/Claude Code Web, writes code
3. **Rusty** - Runs inside MilkStack app, tests code and reviews architecture
4. **GitHub** - The communication channel (via rusty.md)

## The Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Claude Code (You're talking to me right now!)          │
│     - Edit files directly                                   │
│     - Commit & push to GitHub                              │
│     - Ask: "What should I work on next?"                   │
└─────────────────────────────────────────────────────────────┘
                        ↓ (git push)
┌─────────────────────────────────────────────────────────────┐
│  2. GitHub Repository                                        │
│     - Stores the latest code                                │
│     - Contains rusty.md (Rusty's feedback file)            │
└─────────────────────────────────────────────────────────────┘
                        ↓ (Rusty pulls via API)
┌─────────────────────────────────────────────────────────────┐
│  3. Rusty (In MilkStack App)                                │
│     - Click "🔄 Refresh" to pull latest code                │
│     - Runs the app with new code                           │
│     - Tests features:                                        │
│       • Create test projects                                │
│       • Send messages to agents                             │
│       • Check UI rendering                                  │
│       • Monitor console errors                              │
│     - Analyzes code architecture                            │
│     - Click "📝 Write to rusty.md"                         │
└─────────────────────────────────────────────────────────────┘
                        ↓ (commits rusty.md)
┌─────────────────────────────────────────────────────────────┐
│  4. GitHub Repository (Updated)                             │
│     - Now contains rusty.md with Rusty's analysis          │
└─────────────────────────────────────────────────────────────┘
                        ↓ (Claude Code reads it)
┌─────────────────────────────────────────────────────────────┐
│  5. Claude Code (Back to me!)                               │
│     - Run: node check-rusty-feedback.cjs <branch>          │
│     - See Rusty's findings                                  │
│     - Fix issues                                            │
│     - Commit & push                                         │
│     - Loop back to step 1!                                  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Commands

### For Claude Code (in Claude Code Web):

```bash
# After making changes
git add .
git commit -m "fix: your changes here"
git push

# Check what Rusty found
node check-rusty-feedback.cjs <your-branch-name>

# Example:
node check-rusty-feedback.cjs claude/add-permalink-copy-button-01QubpEPPkp5i9wuEJxLAT3p
```

### For Rusty (in MilkStack App):

1. **Open Rusty Chat** - Click the 🔧 button
2. **Refresh Codebase** - Click "🔄 Refresh" button to pull latest from GitHub
3. **Test the app** - Create projects, send messages, check for bugs
4. **Ask Rusty to analyze** - Type: "Analyze the latest changes and report any issues"
5. **Write feedback** - Click "📝 Write to rusty.md" to commit analysis to GitHub

## What Rusty Tests

- ✅ Creating new projects
- ✅ Sending messages to agents
- ✅ Agent responses (quality, speed, errors)
- ✅ UI rendering and responsiveness
- ✅ Console errors and warnings
- ✅ Code architecture and patterns
- ✅ Performance issues
- ✅ IndexedDB operations
- ✅ GitHub integration features

## What Goes in rusty.md

```markdown
# 🔧 Rusty's Analysis Report

**Generated:** 2025-01-18T12:00:00Z
**Commit:** abc123def
**Branch:** claude/feature-branch

---

## 📊 Code Quality Grade: A-

[Detailed analysis here...]

## 🚨 Critical Issues Found: 2

1. **Issue Title**
   - File: src/path/to/file.ts:123
   - What broke: Description
   - Expected vs Actual behavior
   - Console errors

2. **Another Issue**
   [Details...]

---

## 📝 Recommendations

[Suggestions for improvements...]
```

## Communication Protocol

### When I (Claude Code) should check rusty.md:
- After Rusty says "Analysis committed!"
- When you ask me to check Rusty's feedback
- Before starting new features
- When fixing bugs

### When Rusty should write to rusty.md:
- After analyzing new code changes
- After running tests and finding issues
- When discovering architectural concerns
- When requested by you

## Tips for Success

1. **Small iterations** - Make small changes, get quick feedback
2. **Clear commits** - Write descriptive commit messages so Rusty knows what to test
3. **Branch names** - Use descriptive branch names that start with `claude/`
4. **Test coverage** - Ask Rusty to test specific features you changed
5. **Read carefully** - Rusty's reports are detailed - read them thoroughly!

## Troubleshooting

**"No rusty.md found"**
- Rusty hasn't written his analysis yet
- Ask Rusty to analyze and click "Write to rusty.md"

**"GitHub token required"**
- Set your GitHub PAT in MilkStack Settings
- Needed for Rusty to commit rusty.md

**"Network error"**
- Check internet connection
- Verify GitHub PAT is valid
- Check repo permissions

## The Magic ✨

This is **async AI-to-AI collaboration** - two AIs working together on the same codebase:
- No direct connection needed
- GitHub is the message bus
- You orchestrate both
- Both AIs speak "code review language" fluently

Welcome to the future of software development! 🚀
