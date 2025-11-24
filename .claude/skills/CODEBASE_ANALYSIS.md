# Codebase Analysis Skill

This skill provides guidance on how to analyze the MilkStack Multi-Agent Hub codebase.

## Directory Structure

```
/
├── App.tsx                 # Main application component
├── index.tsx              # Application entry point
├── constants.ts           # Global constants
├── src/
│   ├── agents/           # Agent definitions and configurations
│   ├── components/       # React UI components
│   │   ├── modals/      # Modal dialogs
│   │   └── rusty/       # Rusty chat components
│   ├── config/          # Configuration files
│   ├── context/         # React Context providers
│   ├── hooks/           # Custom React hooks
│   ├── reducers/        # State reducers
│   ├── services/        # API clients and business logic
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── .claude/             # Claude configuration
│   ├── agents/          # Subagent definitions
│   ├── skills/          # Skill definitions
│   └── docs/            # Documentation
└── docs/                # Project documentation
```

## Key Files to Analyze

### Entry Points
- `App.tsx` - Main application logic, routing, global state
- `index.tsx` - React DOM rendering

### State Management
- `src/context/AppContext.tsx` - Main application context
- `src/context/ClaudeContext.tsx` - Claude service context
- `src/context/RustyContext.tsx` - Rusty service context
- `src/context/ProjectContext.tsx` - Project management context

### Services
- `src/services/claudeCodeService.ts` - Claude API integration
- `src/services/claudeAgentService.ts` - Claude Agent SDK integration
- `src/services/geminiService.ts` - Google Gemini integration
- `src/services/githubService.ts` - GitHub API integration
- `src/services/indexedDbService.ts` - Local data persistence

### Types
- `src/types/claude.ts` - Claude-related types
- `src/types/agent.ts` - Agent definitions
- `src/types/message.ts` - Message types
- `src/types/project.ts` - Project types

## Analysis Patterns

### Finding Dependencies
```bash
# Find all imports of a module
grep -r "from.*moduleName" --include="*.ts" --include="*.tsx"

# Find component usage
grep -r "<ComponentName" --include="*.tsx"
```

### Finding State Usage
```bash
# Find React Context usage
grep -r "useContext" --include="*.ts" --include="*.tsx"

# Find custom hook usage
grep -r "use[A-Z]" --include="*.ts" --include="*.tsx"
```

### Finding API Calls
```bash
# Find Anthropic API calls
grep -r "client.messages" --include="*.ts"

# Find fetch/axios calls
grep -r "fetch\(" --include="*.ts" --include="*.tsx"
```

## Common Analysis Tasks

1. **Impact Analysis**: Before changing a file, find all its dependents
2. **Dead Code Detection**: Find exports that aren't imported anywhere
3. **Type Coverage**: Check for `any` types that should be properly typed
4. **Test Coverage**: Find files without corresponding test files
