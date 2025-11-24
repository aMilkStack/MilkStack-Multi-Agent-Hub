# MilkStack Multi-Agent Hub

## Project Overview

MilkStack Multi-Agent Hub is a web-based multi-agent AI orchestration platform that allows users to manage, coordinate, and interact with multiple AI agents for software development tasks.

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript
- **Build**: Vite 6
- **State**: React Context API
- **Persistence**: IndexedDB via Dexie
- **AI**: Anthropic Claude API, Google Gemini API
- **Testing**: Vitest + Testing Library

### Key Components

#### Rusty - The Meta Code Guardian
Rusty is the primary code analysis agent, powered by Claude. It provides:
- Code review and analysis
- Architecture recommendations  
- Bug detection
- Performance suggestions

Rusty uses the Claude Agent SDK for full agentic capabilities including:
- File reading and searching
- Code execution (bash)
- Web search for documentation
- Subagent delegation

#### Agent System
The hub supports multiple AI agents that can:
- Communicate with each other
- Execute tasks autonomously
- Follow workflow definitions
- Request human approval for sensitive operations

### Directory Structure

```
src/
├── agents/        # Agent definitions
├── components/    # React components
├── config/        # Configuration
├── context/       # React Context providers
├── hooks/         # Custom hooks
├── services/      # API integrations
├── types/         # TypeScript types
└── utils/         # Utilities
```

## Coding Conventions

### TypeScript
- Strict mode enabled
- No `any` types - use proper typing
- Interfaces for object shapes, types for unions/primitives
- Generic types for reusable components

### React
- Functional components with hooks
- PascalCase for components
- Custom hooks prefixed with `use`
- Context for global state only
- Local state with useState/useReducer

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services: `camelCaseService.ts`
- Types: `camelCase.ts`

### Code Style
- ESLint + Prettier for formatting
- 2-space indentation
- Single quotes for strings
- No semicolons (Prettier default)

## Common Issues

### API Rate Limiting
Both Claude and Gemini have rate limits. The services implement:
- Exponential backoff retry
- Request queuing
- Rate limit tracking

### IndexedDB Transactions
- Transactions are auto-committed when idle
- Avoid async gaps during transactions
- Use Dexie's transaction API

### React State
- Context updates cause re-renders for all consumers
- Split contexts by update frequency
- Use selectors for partial state

## Environment Variables

Required:
- `VITE_ANTHROPIC_API_KEY` - Claude API key

Optional:
- `GEMINI_API_KEY` - Google Gemini API key

## Testing

Run tests: `npm run test:run`
Watch mode: `npm test`
Coverage: `npm run test:coverage`

### Test Patterns
- Unit tests for utilities
- Component tests with Testing Library
- Integration tests for services

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```
