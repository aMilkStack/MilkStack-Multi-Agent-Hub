# Development Guide

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub.git
   cd MilkStack-Multi-Agent-Hub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

5. **(Optional) Configure GitHub Personal Access Token:**
   - Click the Settings icon in the application
   - Add your GitHub PAT to access private repositories
   - [Create a token here](https://github.com/settings/tokens/new?scopes=repo)

## Build Commands

- **Development server:** `npm run dev` - Start dev server with HMR
- **Production build:** `npm run build` - Build optimized bundle to `dist/`
- **Preview build:** `npm run preview` - Preview production build locally

## Project Structure

```
MilkStack-Multi-Agent-Hub/
├── index.html              # Entry point with Tailwind config and import maps
├── index.tsx               # React root
├── App.tsx                 # Main application component
├── types.ts                # TypeScript type definitions
├── constants.ts            # Agent definitions and configuration
├── index.css               # Custom styles and animations
│
├── Components (in root)
│   ├── AgentCard.tsx
│   ├── ChatView.tsx
│   ├── MessageBubble.tsx
│   ├── ModelSelector.tsx
│   ├── NewProjectModal.tsx
│   ├── ProjectSelector.tsx
│   ├── Sidebar.tsx
│   └── SettingsModal.tsx
│
├── Services (in root)
│   ├── geminiService.ts    # AI orchestration logic
│   ├── githubService.ts    # GitHub API integration
│   └── projectService.ts   # localStorage management
│
├── Configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── .gitignore
│
└── Documentation
    ├── README.md           # Comprehensive build guide
    ├── BUILD_GUIDANCE.md   # Best practices
    ├── CLAUDE.md           # AI assistant guide
    └── DEVELOPMENT.md      # This file
```

**Note:** All files are in the root directory for simplicity with Vite. Import paths use `./` notation (e.g., `import { Agent } from './types'`).

## Key Technologies

- **React 19.2.0** - UI framework
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling (via CDN)
- **Google Gemini API** - AI model provider
- **JSZip 3.10.1** - ZIP file processing

## Development Workflow

### Adding a New Agent

1. Update `types.ts` to add the agent name to `AgentName` type
2. Add agent definition to `AGENTS` array in `constants.ts`
3. Define the agent's system prompt and color
4. Test by sending a message that should trigger the new agent

### Modifying Agent Behavior

- Agent prompts are in `constants.ts`
- Global rules can be configured in Settings modal (stored in localStorage)
- Orchestrator logic is in `geminiService.ts`

### Styling Changes

- Use Tailwind utility classes where possible
- Custom styles go in `index.css`
- Brand colors defined in `index.html`:
  - `brand-sidebar`: #233F54
  - `brand-bg`: #284252
  - `brand-bg-light`: #4A6C82
  - `brand-text`: #F9FAFB
  - `brand-text-light`: #BDC4BB
  - `brand-secondary`: #C5D1CE

## Testing

### Manual Testing Checklist

- [ ] Create a new project without codebase
- [ ] Create a project with GitHub repo URL
- [ ] Upload a local folder
- [ ] Upload a ZIP file
- [ ] Send messages and verify agent orchestration
- [ ] Switch between Gemini 2.5 Pro and Flash models
- [ ] Configure global rules in settings
- [ ] Switch between projects
- [ ] Refresh browser and verify localStorage persistence

### Browser Compatibility

- **Chrome/Edge:** ✅ Full support (includes folder upload)
- **Firefox:** ⚠️ Limited (no folder upload, GitHub/ZIP only)
- **Safari:** ⚠️ Limited (no folder upload, GitHub/ZIP only)

**Note:** Folder upload requires the File System Access API, only available in Chromium-based browsers.

## Common Issues

### Build Errors

**Problem:** Import path errors
**Solution:** All files are in root directory. Use `./` imports, not `../`

**Problem:** TypeScript errors
**Solution:** Run `npm install` to ensure types are installed

### Runtime Errors

**Problem:** "API_KEY environment variable not set"
**Solution:** Check that `.env` file exists with valid `GEMINI_API_KEY`

**Problem:** GitHub API rate limiting
**Solution:** Add a GitHub Personal Access Token in Settings

**Problem:** localStorage full
**Solution:** Clear old projects or reduce codebase context size

## Code Conventions

Following BUILD_GUIDANCE.md best practices:

- **TypeScript:** Strict typing, prefer `interface` for objects
- **React:** Functional components with hooks only
- **Naming:**
  - Components: PascalCase (e.g., `ChatView.tsx`)
  - Services: camelCase (e.g., `geminiService.ts`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_AGENT_TURNS`)
- **State:** Keep flat, avoid deep nesting
- **Errors:** User-friendly messages, graceful degradation

## Performance Notes

- Maximum 5 agent turns per user message (prevents infinite loops)
- File size limits:
  - Local files: 100KB per file
  - GitHub API: 200KB per file
- localStorage limit: ~5-10MB total
- Consider IndexedDB for larger codebases (future enhancement)

## Contributing

1. Create a feature branch from `main`
2. Follow existing code patterns and conventions
3. Test changes thoroughly
4. Update documentation if needed
5. Submit a pull request

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React 19 Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Gemini API](https://ai.google.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

For detailed architecture and AI assistant guidance, see [CLAUDE.md](./CLAUDE.md).
