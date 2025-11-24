# MilkStack Multi-Agent Hub

A sophisticated multi-agent development system powered by Google Gemini and Anthropic Claude, designed to orchestrate specialized AI agents for code analysis, planning, building, debugging, and code review.

## Overview

MilkStack Multi-Agent Hub is a React-based application that coordinates 15+ specialized AI agents to help with software development tasks. Each agent has a specific role (e.g., Builder, Debug Specialist, System Architect) and works together through an Orchestrator that routes tasks intelligently.

### Key Features

- **Multi-Agent System**: 15+ specialized agents for different development tasks
- **Intelligent Orchestration**: Automatic task routing based on context
- **Workflow Management**: Discovery → Planning → Execution → Review phases
- **Code Analysis**: Deep codebase understanding with Rusty (Claude-powered meta-agent)
- **Project Management**: Multiple projects with persistent storage (IndexedDB)
- **GitHub Integration**: Direct code commits and repository management
- **Real-time Streaming**: Live agent responses with streaming support

## Tech Stack

- **Frontend**: React 19.2.0, TypeScript 5.8.2, Vite 6.2.0
- **AI Services**:
  - Google Gemini API (multi-agent system)
  - Anthropic Claude API (Rusty meta-agent)
- **Storage**: IndexedDB via Dexie.js
- **UI**: Custom components with Tailwind CSS
- **Build Tool**: Vite

## Prerequisites

- Node.js 18+ and npm
- Google Gemini API key (for multi-agent system)
- Anthropic Claude API key (for Rusty agent) - optional but recommended

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub.git
cd MilkStack-Multi-Agent-Hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Google Gemini API Key (for multi-agent system)
GEMINI_API_KEY=your_gemini_api_key_here

# Anthropic Claude API Key (for Rusty/Claude agent)
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here

# GitHub Token (optional - for repository features)
GITHUB_TOKEN=your_github_token_here
```

**Getting API Keys:**

- **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Claude API Key**: Get from [Anthropic Console](https://console.anthropic.com/)
- **GitHub Token**: Create at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in terminal).

### 5. Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Project Structure

```text
MilkStack-Multi-Agent-Hub/
├── src/
│   ├── agents/              # Agent definitions (15+ specialized agents)
│   │   ├── orchestrator.ts  # Routes tasks to appropriate agents
│   │   ├── builder.ts       # Implements code changes
│   │   ├── debug-specialist.ts
│   │   ├── system-architect.ts
│   │   ├── product-planner.ts
│   │   └── ...              # More specialized agents
│   ├── components/          # React UI components
│   │   ├── ChatView.tsx     # Main chat interface
│   │   ├── Sidebar.tsx      # Project navigation
│   │   ├── modals/          # Modal dialogs
│   │   └── rusty/           # Rusty chat components
│   ├── config/              # Configuration files
│   │   ├── ai.ts            # AI service configuration
│   │   ├── claudeConfig.ts  # Claude-specific config
│   │   └── rustyConfig.ts  # Rusty configuration
│   ├── context/            # React Context providers
│   │   ├── AppContext.tsx
│   │   ├── ProjectContext.tsx
│   │   ├── RustyContext.tsx
│   │   └── ClaudeContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useRustyChat.ts
│   │   └── useClaudeChat.ts
│   ├── services/           # Core business logic
│   │   ├── geminiService.ts      # Gemini API integration
│   │   ├── claudeCodeService.ts  # Claude API integration
│   │   ├── githubService.ts      # GitHub API integration
│   │   ├── workflowEngine.ts    # Workflow orchestration
│   │   └── indexedDbService.ts  # Database operations
│   ├── types/              # TypeScript type definitions
│   │   ├── agent.ts
│   │   ├── message.ts
│   │   ├── workflow.ts
│   │   └── index.ts
│   └── utils/              # Utility functions
├── docs/                   # Documentation
│   ├── rusty_claude_migration.md
│   ├── discovery_mode.md
│   └── claude.md
├── App.tsx                 # Root component
├── constants.ts            # Agent profiles and constants
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Agent Architecture

### Orchestrator Agent

The Orchestrator is the central routing agent that determines which specialist agent should handle each task. It analyzes user messages and routes to:

- **Product Planner**: First message in new projects, creates Task Maps
- **Builder**: Quick code changes and implementations
- **Debug Specialist**: Errors, bugs, and technical issues
- **System Architect**: Architecture and design decisions
- **UX Evaluator**: User experience review
- **Visual Design Specialist**: UI/visual design
- **Adversarial Thinker**: Security and quality review
- **Advanced Coding Specialist**: Complex algorithms and refactoring
- And more...

### Workflow Phases

1. **Discovery**: Initial exploration and understanding
2. **Planning**: Task Map creation and planning
3. **Execution**: Implementation phase
4. **Review**: Code review and quality checks

### Rusty - Meta Code Guardian

Rusty is a Claude-powered meta-agent that:

- Analyzes the codebase from an architectural perspective
- Reports findings optimized for Claude-to-Claude communication
- Performs both static analysis and runtime testing
- Acts as a bridge between Gemini agents and external Claude assistance

See [docs/rusty_claude_migration.md](./docs/rusty_claude_migration.md) for details.

## Usage

### Creating a Project

1. Click "New Project" in the sidebar
2. Enter project name
3. Optionally add codebase context (GitHub URL or code snippets)
4. Add an initial message describing what you want to build

### Working with Agents

1. **Send a message** describing your task
2. The **Orchestrator** routes to the appropriate agent
3. **Agents respond** with analysis, code, or questions
4. **Approve or edit** proposed changes
5. **Commit to GitHub** when ready (if configured)

### Keyboard Shortcuts

- `Cmd/Ctrl + K`: Open new project modal
- `Cmd/Ctrl + ,`: Open settings
- `Cmd/Ctrl + /`: Show keyboard shortcuts
- `Esc`: Close modals

### Project Settings

Each project can have:

- Custom API keys (overrides global settings)
- Codebase context (GitHub repo or code snippets)
- Multiple Rusty chats for code analysis
- Workflow state tracking

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for multi-agent system |
| `VITE_ANTHROPIC_API_KEY` | No* | Anthropic Claude API key for Rusty agent |
| `GITHUB_TOKEN` | No | GitHub Personal Access Token for repo features |

*Required if using Rusty/Claude features

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### TypeScript

The project uses strict TypeScript. All types are defined in `src/types/`. Run `npm run build` to check for type errors.

### Code Style

- Use functional React components with hooks
- Prefer `useCallback` and `useMemo` for performance
- Follow existing patterns in the codebase
- Use TypeScript types strictly (avoid `any`)

## Troubleshooting

### Build Errors

**TypeScript errors about missing types:**

```bash
npm install
```

**Module not found errors:**

- Check import paths - ensure they use `./src/` prefix when importing from src directory
- Verify file exists at the path

### Runtime Errors

**"No API key found" error:**

- Set API key in Settings (Cmd/Ctrl+,) or Project Settings
- Verify `.env` file exists and contains valid keys
- Check browser console for localStorage errors

**429 Rate Limit errors:**

- Gemini free tier has rate limits (2 RPM for pro models)
- Use cost-aware model switching (flash for most tasks)
- Wait a minute between requests

**Rusty not connecting:**

- Verify `VITE_ANTHROPIC_API_KEY` is set in `.env`
- Check Rusty configuration in `src/config/rustyConfig.ts`
- Ensure GitHub token is set if using GitHub integration

## Documentation

- [Rusty Claude Migration](./docs/rusty_claude_migration.md) - Migration from Gemini to Claude
- [Discovery Mode](./docs/discovery_mode.md) - Discovery phase documentation
- [Claude Integration](./docs/claude.md) - Claude API integration details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]

## Support

- GitHub Issues: Report bugs or request features
- Documentation: Check the `docs/` folder for detailed guides

---

### Built with ❤️ by the MilkStack team
