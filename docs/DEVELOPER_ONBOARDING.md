# Developer Onboarding Guide

**Welcome to MilkStack Multi-Agent Hub!**

This guide will help you get productive quickly, understand the architecture, and contribute effectively to the project.

**Estimated Time**: 2-4 hours for initial setup and understanding

---

## Table of Contents

1. [First Day Setup](#first-day-setup)
2. [Architecture Overview](#architecture-overview)
3. [Development Workflow](#development-workflow)
4. [Agent System Deep Dive](#agent-system-deep-dive)
5. [Code Patterns & Conventions](#code-patterns--conventions)
6. [Testing & Quality](#testing--quality)
7. [Debugging Guide](#debugging-guide)
8. [Contributing Guidelines](#contributing-guidelines)

---

## First Day Setup

### Prerequisites Check

Before starting, verify you have:

```bash
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
git --version   # Any recent version
```

### Step-by-Step Setup (30 minutes)

#### 1. Clone and Install (5 minutes)

```bash
# Clone the repository
git clone https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub.git
cd MilkStack-Multi-Agent-Hub

# Install dependencies
npm install

# Verify installation
npm run typecheck  # Should complete with 0 errors
```

#### 2. Configure API Keys (10 minutes)

Create `.env` file:

```bash
cp .env.example .env
```

Add your API keys to `.env`:

```env
# Required: Google Gemini API Key
# Get from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Optional but recommended: Anthropic Claude API Key
# Get from: https://console.anthropic.com/
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: GitHub Personal Access Token
# Get from: https://github.com/settings/tokens
# Scopes needed: repo, read:org
VITE_GITHUB_TOKEN=your_github_token_here
```

**Getting API Keys:**

1. **Gemini API Key** (Required):
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Click "Get API Key" → "Create API key"
   - Copy the key and paste into `.env`
   - Free tier: 60 requests/minute

2. **Claude API Key** (Optional - for Rusty):
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create an account and add credits
   - Go to "API Keys" → "Create Key"
   - Copy and paste into `.env`

3. **GitHub Token** (Optional - for repo features):
   - Visit [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `read:org`
   - Copy and paste into `.env`

#### 3. First Run (5 minutes)

```bash
# Start development server
npm run dev

# Open browser to http://localhost:5173
```

**Expected Behavior:**
- Application loads without errors
- Sidebar shows "New Project" button
- No console errors in browser DevTools

#### 4. Verify Everything Works (10 minutes)

Test the core functionality:

**Test 1: Create a Project**
1. Click "New Project"
2. Name: "Test Project"
3. Codebase Context: Leave empty
4. Initial Message: "Help me create a TypeScript utility function that validates email addresses"
5. Click "Create Project"

**Expected**: Orchestrator analyzes the message and routes to an appropriate agent (likely Builder or System Architect)

**Test 2: Run Tests**
```bash
npm run test:run  # Should show 43 tests passing
```

**Test 3: Check Type Safety**
```bash
npm run typecheck  # Should complete with 0 errors
```

**Test 4: Verify Linting**
```bash
npm run lint  # Should show issues (warnings allowed)
```

If all tests pass, **you're ready to code!** 🎉

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│          React Application (Vite)            │
│  ┌────────────┐  ┌────────────────────────┐ │
│  │  Sidebar   │  │     Main Chat View     │ │
│  │  Projects  │  │  ┌──────────────────┐  │ │
│  │            │  │  │ Message History  │  │ │
│  │            │  │  │  - User          │  │ │
│  │            │  │  │  - Agent         │  │ │
│  │            │  │  └──────────────────┘  │ │
│  └────────────┘  └────────────────────────┘ │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│       React Context Layer                     │
│  - AppContext (global state)                 │
│  - ProjectContext (project management)       │
│  - ClaudeContext (Claude chat state)         │
│  - RustyContext (Rusty chat state)           │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│          Services Layer                       │
│  ┌────────────┐  ┌──────────────────────┐   │
│  │   Gemini   │  │    Claude/Rusty      │   │
│  │  Service   │  │      Service         │   │
│  └─────┬──────┘  └──────┬───────────────┘   │
│        │                 │                    │
│        ▼                 ▼                    │
│  ┌────────────────────────────────────┐     │
│  │     Orchestrator + 15 Agents       │     │
│  │  - Routes messages to agents       │     │
│  │  - Manages workflow phases         │     │
│  │  - Handles multi-turn conversations│     │
│  └────────────────────────────────────┘     │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│          External APIs                        │
│  - Google Gemini API                         │
│  - Anthropic Claude API                      │
│  - GitHub API                                │
└──────────────────────────────────────────────┘
```

### Key Directories

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/agents/` | Agent definitions (15+ specialized agents) | `orchestrator.ts`, `builder.ts`, `product-planner.ts` |
| `src/services/` | Core business logic | `geminiService.ts`, `discoveryService.ts`, `workflowEngine.ts` |
| `src/components/` | React UI components | `ChatView.tsx`, `Sidebar.tsx`, `MessageBubble.tsx` |
| `src/context/` | React Context providers | `ProjectContext.tsx`, `AppContext.tsx` |
| `src/hooks/` | Custom React hooks | `useClaudeChat.ts`, `useRustyChat.ts` |
| `src/types/` | TypeScript type definitions | `index.ts`, `schemas/` |
| `src/utils/` | Utility functions | `agentIdentifiers.ts`, `smartContext.ts` |
| `src/config/` | Configuration | `ai.ts`, `featureFlags.ts` |

### Data Flow: User Message to Agent Response

```
1. User types message → ChatView.tsx
2. Message saved to project → ProjectContext
3. geminiService.ts: getAgentResponse()
4. Phase detection: Discovery | ExecutionReady | Execution
5. If Discovery: discoveryService.ts routes to agents
6. Orchestrator analyzes message history
7. Routes to appropriate agent (e.g., "builder")
8. agentIdentifiers.ts normalizes identifier
9. Agent executes with streaming
10. Response chunks → onMessageUpdate()
11. UI updates in real-time
12. Message saved to IndexedDB
```

### State Management

**Global State** (`AppContext`):
- Currently active project ID
- Modal visibility state
- Settings

**Project State** (`ProjectContext`):
- All projects (from IndexedDB)
- CRUD operations for projects
- Message history per project

**Chat State** (`ClaudeContext`, `RustyContext`):
- Separate chat interfaces for Claude/Rusty
- Message history
- Loading states

### Storage Architecture

**IndexedDB** (via Dexie.js):
- **`projects` table**: Project metadata, codebase context
- **`messages` table**: Chat history (linked to projects)
- **`claudeChats` table**: Claude-specific conversations
- **Persistence**: All data saved locally, no cloud storage

---

## Development Workflow

### Daily Development Routine

#### 1. Start Your Day

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Start dev server
npm run dev

# In another terminal, run type checking in watch mode
npm run typecheck:watch
```

#### 2. Create a Feature Branch

```bash
# Branch naming convention: feature/description or fix/description
git checkout -b feature/add-new-agent
```

#### 3. Make Changes

Follow this cycle:
1. **Write code**
2. **Check types**: `npm run typecheck` (or watch mode catches it)
3. **Test manually**: Interact with the UI
4. **Write tests**: If adding new logic (services, utilities)
5. **Run tests**: `npm run test`

#### 4. Before Committing

```bash
# Run type checking
npm run typecheck  # Must pass with 0 errors

# Run tests
npm run test:run  # All tests should pass

# Optional: Fix linting issues
npm run lint:fix

# Optional: Format code
npm run format
```

#### 5. Commit

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat(agents): Add DeepResearcher agent for complex analysis

- Implements comprehensive research methodology
- Adds 20 tests for research patterns
- Updates orchestrator routing heuristics"

# Push to your branch
git push origin feature/add-new-agent
```

**Commit Message Format:**
```
type(scope): Short description

Longer description if needed:
- Bullet point 1
- Bullet point 2

Closes #123
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
**Scopes**: `agents`, `services`, `ui`, `types`, `tests`, `config`

#### 6. Create Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your branch
4. Fill in PR template (if exists)
5. Request review from team members

### Hot Reload & Fast Refresh

Vite provides instant updates:
- **Component changes**: Hot Module Replacement (HMR) - no page reload
- **Context changes**: Reloads affected components
- **Service changes**: May require manual page refresh
- **Type changes**: Requires `npm run typecheck` (watch mode shows immediately)

### Testing Changes

**Manual Testing Checklist:**
- [ ] Create a new project
- [ ] Send a message
- [ ] Verify orchestrator routing works
- [ ] Check agent response appears correctly
- [ ] Test with different message types
- [ ] Verify no console errors
- [ ] Test on different screen sizes (if UI change)

**Automated Testing:**
```bash
# Run all tests
npm run test

# Run specific test file
npm run test src/utils/agentIdentifiers.test.ts

# Run tests in watch mode
npm run test

# Run with coverage
npm run test:coverage
```

---

## Agent System Deep Dive

### The 16 Agents

| Agent | Identifier | Purpose | Prompt Length | Quality |
|-------|-----------|---------|--------------|---------|
| **Orchestrator** | `orchestrator` | Routes messages to appropriate agents | 300+ lines | Excellent |
| **Product Planner** | `product-planner` | Creates Task Maps, user stories, requirements | 517 lines | Excellent |
| **Builder** | `builder` | Implements features, writes code | 295 lines | Excellent |
| **Debug Specialist** | `debug-specialist` | Diagnoses bugs and errors | 172 lines | Good |
| **System Architect** | `system-architect` | Designs architecture and systems | 132 lines | Good |
| **UX Evaluator** | `ux-evaluator` | Evaluates user experience (Nielsen + WCAG) | 296 lines | Excellent |
| **Visual Design Specialist** | `visual-design-specialist` | Analyzes visual design and UI | 169 lines | Good |
| **Adversarial Thinker** | `adversarial-thinker` | Critiques and finds flaws | 86 lines | Good |
| **Advanced Coding Specialist** | `advanced-coding-specialist` | Complex algorithms and refactoring | 142 lines | Good |
| **Infrastructure Guardian** | `infrastructure-guardian` | DevOps, CI/CD, deployment | 223 lines | Excellent |
| **Knowledge Curator** | `knowledge-curator` | Documents decisions and patterns | 208 lines | Good |
| **Fact Checker & Explainer** | `fact-checker-explainer` | Verifies facts, explains concepts | 370 lines | Excellent |
| **Deep Research Specialist** | `deep-research-specialist` | In-depth research and analysis | 170 lines | Good |
| **Market Research Specialist** | `market-research-specialist` | Market analysis and competitive intelligence | 163 lines | Good |
| **Issue Scope Analyzer** | `issue-scope-analyzer` | Analyzes impact of changes | 274 lines | Excellent |
| **Parse Error Handler** | `orchestrator-parse-error-handler` | Handles orchestrator errors | Minimal | Utility |

### Agent Identifier System

All agents use **simple identifiers** (kebab-case) for routing:

```typescript
// CORRECT - Simple identifiers (what orchestrator returns)
@builder
@system-architect
@ux-evaluator
@debug-specialist

// WRONG - Full IDs (internal use only)
agent-builder-001
agent-system-architect-001
```

**Why?** The orchestrator LLM returns simplified names. The `agentIdentifiers.ts` utility normalizes all formats:

```typescript
// All of these resolve to the same agent:
findAgentByIdentifier('builder')              // ✅
findAgentByIdentifier('Builder')              // ✅
findAgentByIdentifier('agent-builder-001')   // ✅
findAgentByIdentifier('BUILDER')             // ✅
```

See `/src/utils/agentIdentifiers.ts` and `/docs/orchestrator-improvements.md` for details.

### Workflow Phases

#### 1. Discovery Mode

**Purpose**: Explore, debate, and reach consensus before executing

**Flow**:
```
User message
  ↓
Orchestrator analyzes context
  ↓
Routes to specialist agent (e.g., system-architect)
  ↓
Agent responds with analysis
  ↓
Orchestrator decides: more debate needed?
  ↓ Yes
Routes to another agent (e.g., adversarial-thinker)
  ↓
Agent critiques the design
  ↓
Orchestrator: consensus reached?
  ↓ Yes
Returns CONSENSUS_REACHED
  ↓
Transitions to Execution
```

**Max Turns**: 10 (prevents infinite loops)

**Exit Conditions**:
- `WAIT_FOR_USER` - User input needed
- `CONSENSUS_REACHED` - Ready for execution

**Implementation**: `src/services/discoveryService.ts`

#### 2. Execution Mode (Agency V2)

**Purpose**: Execute planned tasks with Product Planner's Task Map

**Flow**:
```
Product Planner creates Task Map (JSON)
  ↓
Workflow Engine parses tasks
  ↓
For each task:
  ┌──────────────────────────────┐
  │ IMPLEMENTATION stage         │
  │  - Single agent executes     │
  └──────────────┬───────────────┘
                 ↓
  ┌──────────────────────────────┐
  │ CODE_REVIEW stage (parallel) │
  │  - Multiple agents review    │
  │  - adversarial-thinker       │
  │  - ux-evaluator              │
  └──────────────┬───────────────┘
                 ↓
  ┌──────────────────────────────┐
  │ SYNTHESIZE stage             │
  │  - Single agent processes    │
  │    all feedback              │
  └──────────────────────────────┘
  ↓
Next task (respects dependencies)
```

**Task Map Format**:
```json
{
  "title": "Feature Name",
  "description": "Brief description",
  "tasks": [
    {
      "id": "1.1",
      "objective": "Design authentication system",
      "dependencies": [],
      "stages": [
        {
          "stageName": "IMPLEMENTATION",
          "objective": "Create architecture doc",
          "agents": [{"agent": "system-architect", "model": "gemini-2.5-pro"}]
        },
        {
          "stageName": "PLAN_REVIEW",
          "objective": "Review architecture",
          "agents": [
            {"agent": "adversarial-thinker", "model": "gemini-2.5-pro"},
            {"agent": "infrastructure-guardian", "model": "gemini-2.5-pro"}
          ]
        }
      ]
    }
  ]
}
```

**Implementation**: `src/services/workflowEngine.ts`

### Adding a New Agent

**Step 1: Create Agent File**

Create `src/agents/my-new-agent.ts`:

```typescript
import { Agent, AgentStatus } from '../types';

export const mynewagentAgent: Agent = {
  id: 'agent-my-new-agent-001',
  name: 'My New Agent',
  description: 'Use this agent when...',
  prompt: `As a specialist in X, I do Y.

I can @mention other agents when I need help: @builder, @system-architect, ...

## Core Responsibilities

1. Responsibility 1
2. Responsibility 2

## Methodology

[Detailed methodology here]

## Output Format

[Expected output structure]

## Quality Standards

[What good looks like]`,
  color: '#3b82f6', // Tailwind color
  avatar: 'MNA',
  status: AgentStatus.Idle,
  thinkingBudget: 2048, // Extended thinking tokens
};
```

**Step 2: Register Agent**

Add to `src/agents/index.ts`:

```typescript
import { mynewagentAgent } from './my-new-agent';

export const AGENT_PROFILES = [
  orchestratorAgent,
  // ... existing agents ...
  mynewagentAgent, // Add here
];

export { mynewagentAgent };
```

**Step 3: Update Orchestrator**

If the agent should be routable by the orchestrator, it's automatically included (orchestrator uses `AGENT_PROFILES`).

**Step 4: Write Tests**

Create `src/agents/my-new-agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mynewagentAgent } from './my-new-agent';

describe('My New Agent', () => {
  it('should have correct identifier', () => {
    expect(mynewagentAgent.id).toBe('agent-my-new-agent-001');
  });

  it('should have comprehensive prompt', () => {
    expect(mynewagentAgent.prompt.length).toBeGreaterThan(100);
  });
});
```

**Step 5: Update Documentation**

Add agent to this onboarding guide's agent table.

---

## Code Patterns & Conventions

### TypeScript Patterns

#### Strict Mode Compliance

The project uses **TypeScript strict mode**. All code must:

```typescript
// ✅ GOOD: Explicit types
function processMessage(message: Message): void {
  // Implementation
}

// ❌ BAD: Implicit any
function processMessage(message) {
  // TypeScript error: Parameter 'message' implicitly has an 'any' type
}

// ✅ GOOD: Proper null checking
if (project && project.name) {
  console.log(project.name);
}

// ❌ BAD: Unsafe access
console.log(project.name); // Error if project might be undefined
```

#### Type Definitions

All types are in `src/types/`:

```typescript
// Use existing types
import { Message, Agent, WorkflowPhase } from './types';

// Define new types in types/index.ts or create new file in types/
export interface MyNewType {
  id: string;
  name: string;
  optional?: string; // Optional properties use ?
}
```

### React Patterns

#### Functional Components Only

```typescript
// ✅ GOOD: Functional component with TypeScript
interface Props {
  message: Message;
  onDelete: (id: string) => void;
}

export const MessageBubble = ({ message, onDelete }: Props) => {
  // Implementation
};

// ❌ BAD: Class components (not used in this project)
class MessageBubble extends React.Component {
  // Don't use
}
```

#### Hooks Usage

```typescript
// ✅ GOOD: Memoize callbacks passed as props
const handleDelete = useCallback((id: string) => {
  deleteMessage(id);
}, [deleteMessage]);

<MessageBubble onDelete={handleDelete} />

// ❌ BAD: Inline function (creates new reference on every render)
<MessageBubble onDelete={(id) => deleteMessage(id)} />

// ✅ GOOD: Memoize expensive computations
const filteredMessages = useMemo(() => {
  return messages.filter(m => m.author.id !== 'system');
}, [messages]);

// ❌ BAD: Recompute on every render
const filteredMessages = messages.filter(m => m.author.id !== 'system');
```

#### Context Usage

```typescript
// ✅ GOOD: Use context for global state
const { projects, addProject } = useProjects();

// ❌ BAD: Prop drilling through 5+ components
<Parent>
  <Child1 projects={projects}>
    <Child2 projects={projects}>
      <Child3 projects={projects}>
        {/* Use context instead! */}
      </Child3>
    </Child2>
  </Child1>
</Parent>
```

### Service Patterns

#### Async/Await

```typescript
// ✅ GOOD: Async/await with error handling
async function fetchAgentResponse(message: string): Promise<string> {
  try {
    const response = await geminiService.generate(message);
    return response.text;
  } catch (error) {
    console.error('Failed to fetch response:', error);
    throw new Error('Agent response failed');
  }
}

// ❌ BAD: Unhandled promise rejection
async function fetchAgentResponse(message: string): Promise<string> {
  const response = await geminiService.generate(message);
  return response.text; // No error handling!
}
```

#### Streaming Responses

```typescript
// ✅ GOOD: Streaming with callbacks
async function streamResponse(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const stream = await api.generateStream(prompt);

  for await (const chunk of stream) {
    onChunk(chunk.text);
  }
}

// Usage:
let fullResponse = '';
await streamResponse(prompt, (chunk) => {
  fullResponse += chunk;
  setDisplayText(fullResponse); // Update UI
});
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files (components) | PascalCase.tsx | `MessageBubble.tsx` |
| Files (utilities) | camelCase.ts | `agentIdentifiers.ts` |
| Files (tests) | *.test.ts | `agentIdentifiers.test.ts` |
| Components | PascalCase | `const MessageBubble = () => {}` |
| Functions | camelCase | `function processMessage() {}` |
| Constants | SCREAMING_SNAKE_CASE | `const MAX_RETRIES = 3;` |
| Types/Interfaces | PascalCase | `interface Message {}` |
| Agent IDs | kebab-case | `agent-builder-001` |
| Agent identifiers | kebab-case | `builder`, `system-architect` |

---

## Testing & Quality

### Test Structure

All tests use **Vitest** with **React Testing Library**:

```typescript
// src/utils/example.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './example';

describe('myFunction', () => {
  it('should return correct result for valid input', () => {
    const result = myFunction('test');
    expect(result).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test:run agentIdentifiers.test.ts

# Run with UI (opens browser)
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Test Coverage Goals

| Area | Current Coverage | Target |
|------|-----------------|--------|
| Utilities (`src/utils/`) | 65% | 80% |
| Services (`src/services/`) | Low | 60% |
| Components (`src/components/`) | Low | 50% |
| Agent prompts | N/A | N/A (prompts are configuration) |

### Writing Good Tests

**✅ DO:**
- Test public API, not implementation details
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies (APIs, storage)

**❌ DON'T:**
- Test private functions directly
- Test React component internals
- Rely on specific DOM structure
- Test across multiple units (use integration tests for that)

**Example:**

```typescript
// ✅ GOOD: Tests behavior
it('should normalize agent name to simple identifier', () => {
  expect(normalizeToIdentifier('System Architect')).toBe('system-architect');
  expect(normalizeToIdentifier('UX & UI Specialist')).toBe('ux-ui-specialist');
});

// ❌ BAD: Tests implementation
it('should call toLowerCase and replace', () => {
  const spy = jest.spyOn(String.prototype, 'toLowerCase');
  normalizeToIdentifier('Test');
  expect(spy).toHaveBeenCalled(); // Don't do this
});
```

### Quality Checks Before Commit

```bash
# 1. Type checking (MUST PASS)
npm run typecheck  # 0 errors required

# 2. Tests (MUST PASS)
npm run test:run   # All tests must pass

# 3. Linting (warnings OK, errors should be fixed)
npm run lint

# 4. Formatting (optional but recommended)
npm run format
```

---

## Debugging Guide

### Common Issues & Solutions

#### Issue: "Cannot find module" Error

**Symptoms**:
```
Error: Cannot find module '../context/ProjectsContext'
```

**Solution**:
```typescript
// ❌ Wrong import path
import { useProjects } from '../context/ProjectsContext';

// ✅ Correct import path
import { useProjects } from '../context/ProjectContext';
```

**How to Fix**:
1. Check actual filename in `src/context/`
2. Update import statement
3. Run `npm run typecheck` to verify

#### Issue: TypeScript Errors About "Implicit Any"

**Symptoms**:
```
Parameter 'x' implicitly has an 'any' type.
```

**Solution**:
```typescript
// ❌ Implicit any
const handleClick = (event) => {
  console.log(event.target);
};

// ✅ Explicit type
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  console.log(event.currentTarget);
};
```

#### Issue: React Component Not Re-rendering

**Symptoms**: State changes but UI doesn't update

**Common Causes**:
1. **Mutating state directly**:
   ```typescript
   // ❌ BAD: Mutates array
   messages.push(newMessage);
   setMessages(messages);

   // ✅ GOOD: Creates new array
   setMessages([...messages, newMessage]);
   ```

2. **Missing dependencies in useEffect/useMemo**:
   ```typescript
   // ❌ BAD: Missing dependency
   useEffect(() => {
     processMessages(messages);
   }, []); // messages should be in dependency array!

   // ✅ GOOD: Complete dependencies
   useEffect(() => {
     processMessages(messages);
   }, [messages]);
   ```

3. **Incorrect memo comparison**:
   ```typescript
   // ❌ BAD: Passes new object every render
   <Component config={{setting: true}} />

   // ✅ GOOD: Memoize object
   const config = useMemo(() => ({setting: true}), []);
   <Component config={config} />
   ```

#### Issue: Agent Routing Not Working

**Symptoms**: Orchestrator returns agent name but nothing happens

**Debugging Steps**:

1. **Check browser console for errors**:
   ```
   [Discovery] Orchestrator routed to unknown agent: "system architect"
   ```

2. **Verify agent identifier normalization**:
   ```typescript
   // Test in browser console:
   import { findAgentByIdentifier } from './src/utils/agentIdentifiers';
   findAgentByIdentifier('system architect'); // Should return agent
   ```

3. **Check orchestrator response format**:
   ```json
   // ✅ GOOD
   {"agent": "system-architect", "model": "gemini-2.5-pro"}

   // ❌ BAD (wrapped in markdown)
   ```json
   {"agent": "system-architect"}
   ```
   ```

4. **Verify agent exists in AGENT_PROFILES**:
   ```typescript
   // Check src/agents/index.ts
   export const AGENT_PROFILES = [
     orchestratorAgent,
     systemarchitectAgent, // Make sure it's here!
     // ...
   ];
   ```

### Browser DevTools Tips

#### React Developer Tools

Install: [React DevTools Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)

**Useful features**:
- Inspect component props and state
- View Context values
- Identify unnecessary re-renders (Profiler)

#### Console Debugging

```typescript
// Use strategic console logs
console.log('[Discovery] Routing to:', routing.agent);
console.log('[Discovery] Available identifiers:', getOrchestratorAgentList());

// Use console.table for arrays/objects
console.table(messages.map(m => ({ author: m.author.name, content: m.content.slice(0, 50) })));

// Use debugger statement
function criticalFunction() {
  debugger; // Execution pauses here when DevTools open
  // Your code
}
```

#### Network Tab

- View Gemini API requests/responses
- Check for 429 rate limit errors
- Verify API keys are being sent

### Performance Debugging

#### Identify Re-render Issues

Use React DevTools Profiler:
1. Open React DevTools
2. Go to "Profiler" tab
3. Click record
4. Interact with the app
5. Stop recording
6. Identify components that render frequently

**Fix excessive re-renders**:
```typescript
// Wrap expensive components in React.memo
export const MessageBubble = React.memo(({ message }: Props) => {
  // Component
});

// Memoize callbacks
const handleClick = useCallback(() => {
  // Handler
}, [dependencies]);
```

---

## Contributing Guidelines

### Pull Request Process

1. **Before Creating PR**:
   - [ ] `npm run typecheck` passes (0 errors)
   - [ ] `npm run test:run` passes (all tests)
   - [ ] Manual testing complete
   - [ ] Code follows project patterns
   - [ ] New code has tests (if applicable)

2. **PR Title Format**:
   ```
   feat(agents): Add DeepResearcher agent
   fix(routing): Fix agent ID mismatch for UX Evaluator
   docs(onboarding): Add debugging section
   test(services): Add tests for discoveryService
   refactor(utils): Simplify agent normalization logic
   chore(deps): Update React to 19.2.0
   ```

3. **PR Description Template**:
   ```markdown
   ## Summary
   Brief description of changes

   ## Changes Made
   - Change 1
   - Change 2

   ## Testing
   - [ ] Manual testing completed
   - [ ] Unit tests added/updated
   - [ ] Type checking passes

   ## Screenshots (if UI changes)
   [Add screenshots]

   ## Related Issues
   Closes #123
   ```

4. **Code Review**:
   - Address all review comments
   - Update PR based on feedback
   - Request re-review when ready

5. **Merge**:
   - Squash commits before merging
   - Update CHANGELOG.md (if applicable)
   - Delete branch after merge

### Code Review Checklist

**As a Reviewer, Check:**
- [ ] Code follows TypeScript strict mode
- [ ] Code follows existing patterns
- [ ] Tests cover new functionality
- [ ] No console.log statements in production code (use proper logging)
- [ ] Error handling is proper
- [ ] Performance considerations addressed
- [ ] Security considerations addressed
- [ ] Documentation updated if needed

**As a Author, Verify:**
- [ ] PR is focused (one feature/fix)
- [ ] Commit messages are clear
- [ ] Code is self-documenting (clear variable/function names)
- [ ] Complex logic has comments
- [ ] No commented-out code
- [ ] No debug code left in

### Getting Help

**Resources:**
- **Documentation**: `/docs` folder
- **Agent Architecture**: `/docs/orchestrator-improvements.md`, `/docs/agent-prompt-enhancements.md`
- **Routing Analysis**: `/docs/routing-analysis.md`
- **Discovery Mode**: `/docs/discovery_mode.md`

**Ask Questions:**
- Create GitHub issue with `question` label
- Reach out to team members
- Check existing issues/discussions

---

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev                # Start dev server
npm run typecheck:watch    # Watch mode type checking

# Quality Checks
npm run typecheck          # Type check (must pass)
npm run test:run           # Run tests (must pass)
npm run lint               # Check linting
npm run lint:fix           # Fix linting issues
npm run format             # Format code

# Testing
npm run test               # Run tests in watch mode
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
```

### File Paths

| What | Where |
|------|-------|
| Agent definitions | `src/agents/*.ts` |
| Agent identifier utility | `src/utils/agentIdentifiers.ts` |
| Orchestrator logic | `src/services/discoveryService.ts` |
| Workflow engine | `src/services/workflowEngine.ts` |
| Type definitions | `src/types/` |
| Tests | `*.test.ts` files |
| Documentation | `docs/` |
| Config | `src/config/` |

### Useful Imports

```typescript
// Types
import { Message, Agent, WorkflowPhase, GeminiModel } from './types';

// Agent utilities
import { findAgentByIdentifier, normalizeToIdentifier } from './utils/agentIdentifiers';

// Context
import { useProjects } from './context/ProjectContext';
import { useApp } from './context/AppContext';

// Services
import { getAgentResponse } from './services/geminiService';
import { executeDiscoveryWorkflow } from './services/discoveryService';

// Agent profiles
import { AGENT_PROFILES } from './agents';
```

---

## Conclusion

You now have everything you need to contribute effectively to MilkStack Multi-Agent Hub!

**Next Steps:**
1. Complete the First Day Setup
2. Explore the codebase
3. Run the application and create a test project
4. Pick a good first issue from GitHub Issues
5. Make your first contribution!

**Remember:**
- Type checking must pass (0 errors)
- Tests must pass
- Follow existing patterns
- Ask questions when unsure
- Have fun building the future of AI-assisted development! 🚀

---

*Last Updated*: 2025-11-24
*Author*: MilkStack Team
*Version*: 1.0
