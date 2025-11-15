# CLAUDE.md - AI Assistant Guide for MilkStack Multi-Agent Hub

**Last Updated:** 2025-11-14
**Version:** 1.0.0

This document provides a comprehensive guide for AI assistants (like Claude) working on the MilkStack Multi-Agent Hub (MSMAH) codebase. It covers architecture, conventions, workflows, and best practices.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [File Structure](#file-structure)
4. [Core Components](#core-components)
5. [Key Services](#key-services)
6. [Development Workflow](#development-workflow)
7. [Code Conventions](#code-conventions)
8. [Common Development Tasks](#common-development-tasks)
9. [Testing & Building](#testing--building)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Future Enhancements](#future-enhancements)

---

## Project Overview

### What is MSMAH?

MSMAH (MilkStack Multi-Agent Hub) is a browser-based multi-agent AI collaboration platform where specialized AI agents work together to solve complex tasks. The application orchestrates conversations between 14 specialized agents, each with unique expertise.

### Tech Stack

- **Frontend Framework:** React 19.2.0 with TypeScript
- **Build Tool:** Vite 6.2.0
- **Styling:** Tailwind CSS (via CDN with custom brand colors)
- **AI Provider:** Google Gemini API (@google/genai 1.29.1)
- **State Management:** React useState/useEffect hooks + localStorage
- **File Processing:** JSZip 3.10.1 (for ZIP file handling)
- **Module System:** ES Modules with import maps (supports both CDN and local dev)

### Key Features

1. **Multi-Agent Orchestration:** An Orchestrator agent coordinates 13 specialist agents
2. **Project-Based Workflows:** Each project can have its own codebase context
3. **GitHub Integration:** Fetch repository contents as context
4. **Local File Upload:** Upload folders/ZIP files for codebase context
5. **Persistent Storage:** Projects and settings stored in localStorage
6. **Model Selection:** Switch between Gemini 2.5 Pro and Flash models
7. **Global Rules:** Apply custom rules to all agents

### The 14 Specialized Agents

| Agent | Avatar | Role | Status |
|-------|--------|------|--------|
| Orchestrator (Alan Johnson) | AJ | Project Coordination | Always Active |
| Architect | A | System Design | Active |
| Planner | P | Product Planning | Active |
| Deep Research | DR | Comprehensive Analysis | Active |
| Deep Scope | DS | Issue Analysis | Active |
| Builder (Yanko) | B | Software Development | Idle (activated on demand) |
| Code | C | Advanced Coding | Idle |
| Debug | D | Technical Diagnostics | Idle |
| Guardian | G | Infrastructure & CI/CD | Idle |
| Memory | M | Knowledge Management | Idle |
| Ask | ASK | Information Discovery | Idle |
| UX | UX | User Experience | Idle |
| Vision | V | Visual Design | Idle |
| Market | MA | Market Research | Idle |

---

## Architecture & Design Patterns

### Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User (Ethan)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      React App (App.tsx)                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Sidebar   │  │  ChatView    │  │  Modals (New     │    │
│  │            │  │              │  │  Project/Settings)│    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ geminiService  │  │ projectService   │  │ githubService│ │
│  │ (AI calls)     │  │ (localStorage)   │  │ (API calls) │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services & Browser APIs                │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Gemini API │  │ GitHub API │  │ localStorage/       │    │
│  │            │  │            │  │ File System API     │    │
│  └────────────┘  └────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

1. **Orchestrator Pattern:** The Orchestrator agent acts as a coordinator, deciding which specialist agent should respond next
2. **Service Layer Pattern:** Business logic separated into service modules (geminiService, projectService, githubService)
3. **Component Composition:** React components are small, focused, and reusable
4. **Unidirectional Data Flow:** Props down, callbacks up
5. **Centralized State:** Main state in App.tsx, passed down via props
6. **Configuration as Code:** Agents and models defined in constants.ts

### Multi-Agent Workflow

```
User sends message
       ↓
Message added to conversation history
       ↓
geminiService.getAgentResponse() called
       ↓
┌──────────────────────────────────────┐
│  Loop (max 5 turns):                 │
│  1. Call Orchestrator                │
│  2. Orchestrator analyzes history    │
│  3. Returns: AgentName or WAIT_FOR_USER│
│  4. If WAIT_FOR_USER → break         │
│  5. Call specialist agent            │
│  6. Add agent response to history    │
│  7. Repeat                           │
└──────────────────────────────────────┘
       ↓
Return all agent responses
       ↓
Display messages sequentially with animation
```

---

## File Structure

### Current Structure (Flat - Root Directory)

```
MilkStack-Multi-Agent-Hub/
├── .git/                      # Git repository
├── index.html                 # Entry point (import maps, Tailwind config)
├── index.tsx                  # React root render
├── App.tsx                    # Main application component
├── types.ts                   # TypeScript type definitions
├── constants.ts               # Agent definitions, models, config
│
├── Components (React)
│   ├── AgentCard.tsx          # Agent display in sidebar
│   ├── Sidebar.tsx            # Left panel (agents, projects)
│   ├── ChatView.tsx           # Main chat interface
│   ├── MessageBubble.tsx      # Individual message display
│   ├── ModelSelector.tsx      # Model selection dropdown
│   ├── ProjectSelector.tsx    # Project selection dropdown
│   ├── NewProjectModal.tsx    # Project creation modal
│   └── SettingsModal.tsx      # Settings modal
│
├── Services
│   ├── geminiService.ts       # AI API orchestration
│   ├── projectService.ts      # localStorage management
│   └── githubService.ts       # GitHub API integration
│
├── Configuration
│   ├── package.json           # Dependencies & scripts
│   ├── tsconfig.json          # TypeScript configuration
│   ├── vite.config.ts         # Vite build configuration
│   └── index.css              # Custom styles (if present)
│
└── Documentation
    ├── README.md              # Comprehensive build guide
    ├── BUILD_GUIDANCE.md      # Best practices
    └── CLAUDE.md              # This file
```

**Note:** Unlike the README suggests, files are currently in the root directory, NOT organized in `src/` folders. This is intentional for simplicity with Vite.

---

## Core Components

### App.tsx (Main Component)

**Responsibilities:**
- Root application state management
- Project lifecycle (create, load, save)
- Message handling and agent response coordination
- Modal state management

**Key State:**
```typescript
projects: Project[]          // All user projects
activeProjectId: string      // Currently selected project
agents: Agent[]              // Agent status (active/idle)
selectedModel: Model         // Currently selected AI model
isLoading: boolean           // Loading state during AI calls
```

**Important Functions:**
- `handleSendMessage(text: string)` - Processes user input, calls Gemini API
- `handleCreateProject(newProject)` - Creates new project with optional codebase
- `updateAgentStatus(agentName, status)` - Updates agent active/idle status
- `addMessagesSequentially(messages)` - Animates agent responses sequentially

### Sidebar.tsx

**Responsibilities:**
- Display agent list with status indicators
- Project selector dropdown
- Settings button

**Props:**
```typescript
agents: Agent[]
projects: Project[]
activeProjectId: string | null
onSelectProject: (id: string) => void
onCreateNewProject: () => void
onSettingsClick: () => void
```

### ChatView.tsx

**Responsibilities:**
- Display conversation history
- Handle user input
- Show loading states
- Model selection

**Features:**
- Auto-scroll to latest message
- Message grouping by sender
- Timestamp display

### NewProjectModal.tsx

**Responsibilities:**
- Collect project details (title, description)
- Handle codebase context loading:
  - GitHub repository URL
  - Local folder upload (File System Access API)
  - ZIP file upload (JSZip)

**Important:** This component integrates with both `githubService` and handles browser File System APIs.

### SettingsModal.tsx

**Responsibilities:**
- Manage API keys (stored in localStorage)
- Configure global rules (applied to all agents)

**localStorage keys:**
- `api_key` - Gemini API key
- `global_rules` - Custom rules for all agents

---

## Key Services

### geminiService.ts

**Core Function:** `getAgentResponse(initialMessages, model)`

**Workflow:**
1. Validates API key exists in `process.env.API_KEY`
2. Initializes Google GenAI client
3. Loops up to `MAX_AGENT_TURNS` (5):
   - Calls Orchestrator with conversation history
   - Parses response to get next agent name or `WAIT_FOR_USER`
   - If `WAIT_FOR_USER`, breaks loop
   - Calls specialist agent with conversation history + global rules
   - Appends agent response to messages
4. Returns array of new agent messages

**Key Functions:**
- `formatHistoryForGemini(messages)` - Converts Message[] to Gemini format
- `parseOrchestratorResponse(text)` - Extracts agent name or WAIT_FOR_USER

**Important Details:**
- Global rules are prepended to each specialist agent's prompt
- Codebase context is included in the user message when available
- Error handling returns user-friendly error messages

### projectService.ts

**localStorage Schema:**
```typescript
'milkstack_projects' → Project[]  // All projects
```

**Functions:**
- `loadProjects()` - Retrieves all projects from localStorage
- `saveProjects(projects)` - Persists projects to localStorage

**Size Limitations:** localStorage has ~5-10MB limit. Large codebases may exceed this.

### githubService.ts

**Core Function:** `fetchRepository(url: string, token?: string)`

**Features:**
- Parses GitHub URLs (owner/repo/branch)
- Fetches repository tree via GitHub API
- Downloads text files (respects file size limits)
- Formats as structured codebase context

**API Endpoints Used:**
- `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`

**File Filtering:**
- Only text files (see `isTextFile()` logic)
- Skips common ignore patterns (node_modules, .git, dist, etc.)
- Size limit: 200KB per file (GitHub API limit)

---

## Development Workflow

### Environment Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Runs on `http://localhost:3000`

4. **Build for Production:**
   ```bash
   npm run build
   ```
   Output: `dist/` folder

### Git Workflow

**Current Branch:** `claude/claude-md-mhzhfjhwvccebant-01Ko2skqqVwhcZWfaz6GzCPG`

**Commit Guidelines:**
- Use descriptive commit messages
- Reference the task/issue being addressed
- Test changes locally before committing

**Push Changes:**
```bash
git add .
git commit -m "Description of changes"
git push -u origin claude/claude-md-mhzhfjhwvccebant-01Ko2skqqVwhcZWfaz6GzCPG
```

---

## Code Conventions

### TypeScript

- **Strict Type Safety:** All components and functions should have explicit types
- **Interface vs Type:** Use `interface` for object shapes, `type` for unions/aliases
- **Type Imports:** Import types separately when needed:
  ```typescript
  import { Message, Agent } from './types';
  ```

### React

- **Functional Components Only:** No class components
- **Hooks:** Use `useState`, `useEffect`, `useCallback` appropriately
- **Component Props:** Always define prop interfaces:
  ```typescript
  interface ChatViewProps {
    project: Project;
    onSendMessage: (text: string) => void;
  }
  ```

### Naming Conventions

- **Components:** PascalCase (e.g., `ChatView.tsx`, `MessageBubble.tsx`)
- **Services:** camelCase (e.g., `geminiService.ts`, `projectService.ts`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_AGENT_TURNS`, `WAIT_FOR_USER`)
- **Functions:** camelCase (e.g., `handleSendMessage`, `updateAgentStatus`)
- **Types/Interfaces:** PascalCase (e.g., `Message`, `Project`, `AgentName`)

### Styling

- **Tailwind CSS:** Use utility-first classes
- **Brand Colors:** Defined in `index.html` tailwind.config:
  - `brand-sidebar`: #233F54
  - `brand-bg`: #284252
  - `brand-bg-light`: #4A6C82
  - `brand-text`: #F9FAFB
  - `brand-text-light`: #BDC4BB

- **Responsive Design:** Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`)
- **Custom Classes:** Minimal custom CSS, prefer Tailwind utilities

### File Organization

- **Exports:** Use default export for main component/service, named exports for helpers
  ```typescript
  export default App;  // Main component
  export { formatMessages, parseResponse };  // Helper functions
  ```

### Error Handling

- **User-Facing Errors:** Always provide clear, actionable error messages
- **Console Logging:** Use `console.error()` for debugging, never `console.log()` in production
- **Graceful Degradation:** Handle API failures, network errors, and missing data gracefully

---

## Common Development Tasks

### Adding a New Agent

1. **Update `types.ts`:**
   ```typescript
   export type AgentName =
     | 'Orchestrator'
     | 'NewAgent'  // Add here
     | ...;
   ```

2. **Add to `constants.ts`:**
   ```typescript
   export const AGENTS: Agent[] = [
     // ...existing agents
     {
       id: 'NewAgent',
       name: 'NewAgent',
       description: 'Description of role',
       status: 'idle',
       color: 'bg-purple-400',
       avatar: 'NA',
       prompt: 'System prompt for this agent...'
     }
   ];
   ```

3. **Update `AGENT_NAMES` array** in `constants.ts`

4. **Test:** Create a project, send a message that should trigger the new agent

### Modifying Agent Prompts

**Location:** `constants.ts` - Each agent has a `prompt` field

**Best Practices:**
- Be specific about the agent's role and expertise
- Mention conversation history awareness
- Include instructions about codebase context handling
- Keep prompts focused and concise

**Example:**
```typescript
{
  id: 'Builder',
  prompt: 'You are the Builder, a Software Development Specialist named Yanko. ' +
          'You implement well-scoped features and fixes. Respond to the latest message ' +
          'from this perspective, considering the full conversation history. If a codebase ' +
          'context is provided, you MUST use it to understand the project and implement ' +
          'the request. If asked to write code, provide it in markdown format.'
}
```

### Adding a New Model

1. **Update `types.ts`:**
   ```typescript
   export type ModelName = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'new-model';
   ```

2. **Update `constants.ts`:**
   ```typescript
   export const MODELS: Model[] = [
     // ...existing models
     {
       id: 'new-model',
       name: 'Display Name',
       disabled: false
     }
   ];
   ```

3. **Update `geminiService.ts`** if the model requires different API calls

### Implementing Global Rules

Global rules are already implemented. They're stored in `localStorage` under the key `global_rules` and automatically prepended to each specialist agent's system prompt in `geminiService.ts`.

**Location:** `geminiService.ts` lines 106-114

### Handling Codebase Context

**GitHub Repository:**
- `githubService.ts` handles fetching
- Uses GitHub Contents API
- Formats as structured text with file tree + file contents

**Local Folder:**
- Uses File System Access API (`window.showDirectoryPicker()`)
- Only works in Chrome/Edge on HTTPS or localhost
- Recursively reads directory structure

**ZIP Files:**
- Uses JSZip library
- Extract and process like local folder

**Format:** All codebase contexts are converted to a standardized format:
```
=== PROJECT FILE TREE ===
📁 src/
  📁 components/
    📄 App.tsx
  📁 services/
    📄 geminiService.ts

=== FILE CONTENTS ===
--- src/components/App.tsx ---
[file content]

--- src/services/geminiService.ts ---
[file content]
```

### Debugging Agent Responses

**Common Issues:**

1. **Orchestrator returns invalid agent name:**
   - Check `parseOrchestratorResponse()` logic in `geminiService.ts`
   - Verify agent names in `constants.ts` match exactly

2. **Agent enters infinite loop:**
   - Check `MAX_AGENT_TURNS` constant (default: 5)
   - Verify Orchestrator is returning `WAIT_FOR_USER` appropriately

3. **Agent doesn't see codebase context:**
   - Verify context is stored in `project.codebaseContext`
   - Check `App.tsx` line 101-103 for context injection

**Debug Tools:**
- Browser DevTools Console for API errors
- React DevTools for component state
- localStorage inspector for persisted data

---

## Testing & Building

### Development Server

```bash
npm run dev
```

**Features:**
- Hot Module Replacement (HMR)
- TypeScript type checking
- Runs on port 3000

### Production Build

```bash
npm run build
```

**Output:** `dist/` folder ready for deployment

**Preview Production Build:**
```bash
npm run preview
```

### Manual Testing Checklist

- [ ] Create new project without codebase context
- [ ] Create project with GitHub repository URL
- [ ] Create project with local folder upload
- [ ] Send message and verify agent orchestration
- [ ] Test model switching (Pro vs Flash)
- [ ] Configure global rules and verify they're applied
- [ ] Test project switching
- [ ] Verify localStorage persistence (refresh page)
- [ ] Test error handling (invalid API key, network error)

### Browser Compatibility

- **Chrome/Edge:** Full support (File System Access API)
- **Firefox:** Limited (no local folder upload, GitHub/ZIP only)
- **Safari:** Limited (no local folder upload, GitHub/ZIP only)

---

## Troubleshooting Guide

### API Key Issues

**Symptom:** Error messages about missing API key

**Solutions:**
1. Check `.env` file has `GEMINI_API_KEY=your_key`
2. Restart dev server after changing `.env`
3. Verify API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

### localStorage Full

**Symptom:** Cannot save new projects, data loss

**Solutions:**
1. Clear old projects from localStorage
2. Reduce codebase context size
3. Future: Migrate to IndexedDB (see Future Enhancements)

### GitHub API Rate Limiting

**Symptom:** 403 errors when fetching repositories

**Solutions:**
1. Add GitHub Personal Access Token in Settings
2. Wait for rate limit reset (check response headers)
3. Reduce repository size or fetch frequency

### CORS Errors

**Symptom:** Network errors when calling APIs

**Solutions:**
1. Ensure running on localhost or HTTPS (File System API requirement)
2. For GitHub API: Verify token is valid and has correct scopes
3. Check browser console for specific CORS error details

### Vite Build Errors

**Symptom:** Build fails with TypeScript or module errors

**Solutions:**
1. Run `npm install` to ensure dependencies are up to date
2. Delete `node_modules` and reinstall
3. Check `tsconfig.json` for correct settings
4. Verify all imports use correct paths

### Agent Not Responding

**Symptom:** Message sent but no agent response

**Solutions:**
1. Check browser console for errors
2. Verify `geminiService.ts` is correctly calling API
3. Check network tab for failed API requests
4. Ensure `MAX_AGENT_TURNS` isn't being hit prematurely

---

## Future Enhancements

### Planned Features (from README.md)

1. **IndexedDB Integration**
   - Purpose: Overcome localStorage 5-10MB limit
   - Files to modify: `projectService.ts`, new `indexedDbService.ts`

2. **ZIP Upload Support**
   - Purpose: Upload codebase as ZIP file
   - Dependencies: JSZip (already added)
   - Files to modify: `NewProjectModal.tsx`, new `codebaseService.ts`

3. **Markdown Rendering**
   - Purpose: Render code blocks with syntax highlighting
   - Dependencies: `react-markdown`, `prism.js`
   - Files to modify: `MessageBubble.tsx`

4. **Toast Notifications**
   - Purpose: Better error/success feedback
   - Dependencies: `react-toastify`
   - Files to modify: `App.tsx`, all components

5. **Export/Import Projects**
   - Purpose: Share projects, backup data
   - Files to modify: `projectService.ts`, new export/import UI

6. **Conversation Branching**
   - Purpose: Explore different conversation paths
   - Files to modify: `types.ts` (new data structure), `ChatView.tsx`

7. **Agent Memory Persistence**
   - Purpose: Agents remember context across projects
   - Files to modify: New `memoryService.ts`, `geminiService.ts`

### Architecture Improvements

1. **State Management Library**
   - Consider Redux/Zustand for complex state
   - Current: React hooks (sufficient for now)

2. **API Abstraction Layer**
   - Create unified interface for multiple AI providers
   - Support Claude, GPT-4, etc.

3. **Testing Framework**
   - Add Jest + React Testing Library
   - Unit tests for services
   - Integration tests for components

4. **CI/CD Pipeline**
   - GitHub Actions for build/test
   - Automated deployment

---

## Best Practices from BUILD_GUIDANCE.md

### Core Development Principles

1. **Modular Design:** Keep components small and focused
2. **Type Safety:** Use TypeScript strictly, avoid `any`
3. **Error Handling:** Always handle errors gracefully
4. **Performance:** Minimize re-renders, use `React.memo` and `useCallback`
5. **Code Reusability:** Extract common logic into services/utils

### React Best Practices

- Functional components with hooks
- Single responsibility per component
- Context API for global state (if needed)
- Optimize with `React.memo`, `useCallback`, `useMemo`
- PropTypes or TypeScript for type checking ✓ (using TypeScript)

### State Management

- Keep state flat (avoid deep nesting)
- Use selectors for derived data
- Middleware for side effects (if using Redux)

### API Integration

- Centralize API calls in service layer ✓
- Handle errors with user feedback
- Use environment variables for endpoints ✓
- Implement caching strategies

### Performance Optimization

- Code splitting and lazy loading (consider for routes)
- Optimize images and assets
- Minimize bundle size
- Monitor with Lighthouse and Web Vitals
- Service workers for offline capabilities (future)

---

## Quick Reference

### Important File Locations

| What | Where |
|------|-------|
| Agent definitions | `constants.ts` |
| TypeScript types | `types.ts` |
| AI orchestration logic | `geminiService.ts` |
| localStorage operations | `projectService.ts` |
| GitHub integration | `githubService.ts` |
| Main app state | `App.tsx` |
| Environment variables | `.env` (create if not exists) |
| Build config | `vite.config.ts` |

### localStorage Keys

- `milkstack_projects` - Project[] array
- `api_key` - Gemini API key
- `global_rules` - Custom rules for agents

### Environment Variables

- `GEMINI_API_KEY` - Google Gemini API key (required)

### API Endpoints

- **Gemini API:** Handled by `@google/genai` SDK
- **GitHub API:** `https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}`

### Useful Commands

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

---

## Contributing Guidelines

When modifying this codebase:

1. **Understand the Context:** Read this CLAUDE.md and README.md
2. **Follow Conventions:** Match existing code style and patterns
3. **Test Thoroughly:** Manual testing before committing
4. **Update Documentation:** Keep CLAUDE.md in sync with code changes
5. **Commit Thoughtfully:** Clear, descriptive commit messages
6. **Ask Questions:** If unclear, ask the user for clarification

---

## Contact & Resources

- **Repository:** https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub
- **Google Gemini API:** https://ai.google.dev/
- **React Documentation:** https://react.dev/
- **Vite Documentation:** https://vitejs.dev/
- **Tailwind CSS:** https://tailwindcss.com/

---

**End of CLAUDE.md**

*This document should be updated whenever significant changes are made to the architecture, file structure, or development workflow.*
