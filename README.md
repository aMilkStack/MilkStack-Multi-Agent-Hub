# MilkStack-Multi-Agent-Hub

MSMAH is a browser-based multi-agent AI hub.

MSMAH (MilkStack Multi-Agent Hub)
 
Complete Build Guide
A comprehensive guide to building your multi-agent AI collaboration platform from scratch.
Table of Contents
1. Project Overview
2. Prerequisites
3. Project Setup
4. Core Files Structure
5. Step-by-Step Implementation
6. Testing & Running
7. Troubleshooting

Project Overview
MSMAH is a browser-based multi-agent AI hub where specialized agents collaborate on your tasks. The application features:
* 14 specialized AI agents with unique roles
* Project-based workflows with codebase context
* Orchestrated multi-turn conversations
* GitHub repository integration
* Local file/folder upload support
* No backend required - runs entirely in the browser
Tech Stack:
* React 18+ with TypeScript
* Tailwind CSS for styling
* Google Gemini API (2.5 Pro/Flash)
* ES modules (no build tools)
* localStorage for persistence

Prerequisites
Required:
* A modern web browser (Chrome, Firefox, Edge)
* A local web server (VS Code Live Server, Python's http.server, or similar)
* Google AI Studio API key (free tier available)
Optional:
* GitHub Personal Access Token (for private repo access)
* Code editor (VS Code recommended)

Project Setup
1. Create Folder Structure
src/components
src/services
src/utils

Your structure should look like:
MSMAH/
├── index.html
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── constants.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ChatView.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── NewProjectModal.tsx
│   │   └── LoadingDots.tsx
│   ├── services/
│   │   ├── geminiService.ts
│   │   ├── githubService.ts
│   │   ├── projectService.ts
│   │   └── codebaseService.ts
│   └── utils/
│       └── helpers.ts

Core Files Structure
Let's build each file systematically.

Step-by-Step Implementation
Phase 1: Foundation Files
1. index.html - Entry Point
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MilkStack - Multi-Agent Hub</title>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Import Map for ES Modules -->
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "@google/generative-ai": "https://esm.sh/@google/generative-ai@0.21.0"
      }
    }
  </script>
  
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/index.tsx"></script>
</body>
</html>
2. src/types.ts - Type Definitions
export type AgentStatus = 'active' | 'idle';

export type AgentName =
  | 'Orchestrator'
  | 'Architect'
  | 'Planner'
  | 'Deep Research'
  | 'Deep Scope'
  | 'Builder'
  | 'Code'
  | 'Debug'
  | 'Guardian'
  | 'Memory'
  | 'Ask'
  | 'UX'
  | 'Vision'
  | 'Market';

export interface Agent {
  id: AgentName;
  name: AgentName;
  description: string;
  status: AgentStatus;
  color: string;
  avatar: string;
  prompt: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'Ethan' | AgentName;
  timestamp: string;
}

export type ModelName = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'claude-3-opus';

export interface Model {
  id: ModelName;
  name: string;
  disabled: boolean;
  tooltip?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  codebaseContext: string | null;
  messages: Message[];
}

export interface Settings {
  githubToken: string;
  globalRules: string;
}

export interface CodebaseFile {
  path: string;
  content: string;
}
3. src/constants.ts - Configuration & Agent Definitions
import { Agent, Model, AgentName } from './types';

const getOrchestratorPrompt = (agents: Agent[]): string => `
You are an orchestrator for a team of AI agents inside a group chat. Your name is Alan Johnson.
Your role is to analyze the LATEST message in the conversation and decide which agent should speak next.
The user's name is "Ethan". Your goal is to facilitate the conversation between Ethan and the AI "Staff" to solve Ethan's request.

- Analyze the last message in the chat.
- If the last message requires a response from a specialist agent to continue the task or conversation, return ONLY the name of that agent.
- If the last message from an agent seems to complete the current sub-task or fully answer Ethan's latest request, and the conversation should wait for Ethan's next input, return "WAIT_FOR_USER".
- Do NOT respond to Ethan or any agent directly. Your ONLY output should be either an agent name or "WAIT_FOR_USER".

Here is the list of available agents (Staff) and their specializations:
${agents
  .filter((a) => a.name !== 'Orchestrator')
  .map((a) => `- ${a.name}: ${a.description}`)
  .join('\n')}

Analyze the last message in the conversation history and respond with either the name of the most appropriate agent or "WAIT_FOR_USER".
`;

export const AGENTS: Agent[] = [
  {
    id: 'Orchestrator',
    name: 'Orchestrator',
    description: 'Project Coordination Specialist',
    status: 'active',
    color: 'bg-blue-400',
    avatar: 'AJ',
    prompt: '',
  },
  {
    id: 'Architect',
    name: 'Architect',
    description: 'System Design Specialist',
    status: 'active',
    color: 'bg-indigo-400',
    avatar: 'A',
    prompt: 'You are the Architect, a System Design Specialist. Your purpose is to design and document system architectures. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, your design should be based on the existing structure.'
  },
  {
    id: 'Planner',
    name: 'Planner',
    description: 'Product Planning Specialist',
    status: 'active',
    color: 'bg-purple-400',
    avatar: 'P',
    prompt: 'You are the Planner, a Product Planning Specialist. Your role is to turn goals into clear requirements and user stories. Respond to the latest message from this perspective, considering the full conversation history.'
  },
  {
    id: 'Deep Research',
    name: 'Deep Research',
    description: 'Comprehensive Analysis Specialist',
    status: 'active',
    color: 'bg-pink-400',
    avatar: 'DR',
    prompt: 'You are the Deep Research agent, a Comprehensive Analysis Specialist. You conduct deep, multi-source research. Respond to the latest message from this perspective, considering the full conversation history.'
  },
  {
    id: 'Deep Scope',
    name: 'Deep Scope',
    description: 'Issue Analysis Specialist',
    status: 'active',
    color: 'bg-red-400',
    avatar: 'DS',
    prompt: 'You are the Deep Scope agent, an Issue Analysis Specialist. You perform structured scoping and impact analysis. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, your analysis must reference the provided files.'
  },
  {
    id: 'Builder',
    name: 'Builder',
    description: 'Software Development Specialist',
    status: 'idle',
    color: 'bg-orange-400',
    avatar: 'B',
    prompt: 'You are the Builder, a Software Development Specialist named Yanko. You implement well-scoped features and fixes. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, you MUST use it to understand the project and implement the request. If asked to write code, provide it in markdown format.'
  },
  {
    id: 'Code',
    name: 'Code',
    description: 'Advanced Coding Specialist',
    status: 'idle',
    color: 'bg-yellow-400',
    avatar: 'C',
    prompt: 'You are the Code agent, an Advanced Coding Specialist. You handle complex implementation, refactoring, and optimization. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, analyze it carefully to inform your complex implementations or refactoring. Provide code in markdown format.'
  },
  {
    id: 'Debug',
    name: 'Debug',
    description: 'Technical Diagnostics Specialist',
    status: 'idle',
    color: 'bg-lime-400',
    avatar: 'D',
    prompt: 'You are the Debug agent, a Technical Diagnostics Specialist. You specialize in diagnosing and resolving defects. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, use it to trace the issue and find the root cause.'
  },
  {
    id: 'Guardian',
    name: 'Guardian',
    description: 'Infrastructure & CI/CD Specialist',
    status: 'idle',
    color: 'bg-green-400',
    avatar: 'G',
    prompt: 'You are the Guardian, an Infrastructure & CI/CD Specialist. You manage infrastructure, CI/CD, and automation. Respond to the latest message from this perspective, considering the full conversation history. If a codebase context is provided, your infrastructure and CI/CD suggestions should be tailored to it.'
  },
  {
    id: 'Memory',
    name: 'Memory',
    description: 'Knowledge Management Specialist',
    status: 'idle',
    color: 'bg-teal-400',
    avatar: 'M',
    prompt: 'You are the Memory agent, a Knowledge Management Specialist. You curate, structure, and maintain project knowledge. Respond to the latest message from this perspective, considering the full conversation history.'
  },
  {
    id: 'Ask',
    name: 'Ask',
    description: 'Information Discovery Specialist',
    status: 'idle',
    color: 'bg-cyan-400',
    avatar: 'ASK',
    prompt: 'You are the Ask agent, an Information Discovery Specialist. You provide factual lookups and clear explanations. Respond to the latest message from this perspective, considering the full conversation history.'
  },
  {
    id: 'UX',
    name: 'UX',
    description: 'User Experience Specialist',
    status: 'idle',
    color: 'bg-sky-400',
    avatar: 'UX',
    prompt: `You are the UX agent, a User Experience Specialist. You are a UX analysis expert that:
1. Evaluates user flows and interaction patterns
2. Identifies usability issues and opportunities
3. Suggests UX improvements based on best practices
4. Analyzes accessibility and inclusive design
Focus on user-centric insights and practical improvements.
Respond to the latest message from this perspective, considering the full conversation history.`
  },
  {
    id: 'Vision',
    name: 'Vision',
    description: 'Visual Design Specialist',
    status: 'idle',
    color: 'bg-fuchsia-400',
    avatar: 'V',
    prompt: `You are the Vision agent, a Visual Design Specialist. You are a visual analysis expert that:
1. Identifies design elements, patterns, and visual hierarchy
2. Analyzes color schemes, typography, and layouts
3. Detects UI components and their relationships
4. Evaluates visual consistency and branding
Be specific and technical in your analysis.
Respond to the latest message from this perspective, considering the full conversation history.`
  },
  {
    id: 'Market',
    name: 'Market',
    description: 'Market Research Specialist',
    status: 'idle',
    color: 'bg-rose-400',
    avatar: 'MA',
    prompt: `You are the Market agent, a Market Research Specialist. You are a market research expert that:
1. Identifies market trends and competitor patterns
2. Analyzes similar products and features
3. Suggests market positioning and opportunities
4. Provides industry-specific insights
Focus on actionable market intelligence.
Respond to the latest message from this perspective, considering the full conversation history.`
  },
];

// Set orchestrator prompt dynamically
const orchestrator = AGENTS.find(a => a.name === 'Orchestrator');
if (orchestrator) {
  orchestrator.prompt = getOrchestratorPrompt(AGENTS);
}

export const MODELS: Model[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', disabled: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', disabled: false },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', disabled: true, tooltip: 'Claude API key not configured. This is a placeholder.' },
];

export const MAX_AGENT_TURNS = 5;
export const GITHUB_API_FILE_SIZE_LIMIT = 200000;
export const MAX_CONTEXT_FILE_SIZE_BYTES = 100000;
export const IGNORE_PATTERNS = ['.git/', '__MACOSX', '.DS_Store', 'node_modules/', 'dist/', 'build/'];

export const WAIT_FOR_USER = 'WAIT_FOR_USER';

Phase 2: Service Layer
4. src/utils/helpers.ts - Utility Functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.html', '.css', '.scss', '.sass', '.py', '.java',
    '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.yml', '.yaml', '.xml', '.svg',
    '.toml', '.ini', '.env', '.gitignore', '.dockerignore'
  ];
  
  return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

export function shouldIgnoreFile(path: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some(pattern => path.includes(pattern));
}
5. src/services/projectService.ts - Local Storage Management
import { Project, Settings } from '../types';
import { generateId } from '../utils/helpers';

const PROJECTS_KEY = 'milkstack_projects';
const SETTINGS_KEY = 'milkstack_settings';
const CURRENT_PROJECT_KEY = 'milkstack_current_project';

export const projectService = {
  // Projects
  getAllProjects(): Project[] {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveProject(project: Project): void {
    const projects = this.getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },

  deleteProject(projectId: string): void {
    const projects = this.getAllProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
  },

  createNewProject(title: string, description: string = ''): Project {
    return {
      id: generateId(),
      title,
      description,
      codebaseContext: null,
      messages: []
    };
  },

  // Current Project
  getCurrentProjectId(): string | null {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  },

  setCurrentProjectId(projectId: string): void {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  },

  // Settings
  getSettings(): Settings {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { githubToken: '', globalRules: '' };
  },

  saveSettings(settings: Settings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
6. src/services/codebaseService.ts - File Processing
import { CodebaseFile } from '../types';
import { isTextFile, shouldIgnoreFile } from '../utils/helpers';
import { IGNORE_PATTERNS, MAX_CONTEXT_FILE_SIZE_BYTES } from '../constants';

export const codebaseService = {
  async processFolder(folderHandle: FileSystemDirectoryHandle): Promise<string> {
    const files: CodebaseFile[] = [];
    
    async function readDirectory(dirHandle: FileSystemDirectoryHandle, currentPath: string = '') {
      for await (const entry of dirHandle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        
        if (shouldIgnoreFile(entryPath, IGNORE_PATTERNS)) {
          continue;
        }
        
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          
          if (isTextFile(file.name) && file.size < MAX_CONTEXT_FILE_SIZE_BYTES) {
            const content = await file.text();
            files.push({ path: entryPath, content });
          }
        } else if (entry.kind === 'directory') {
          await readDirectory(entry as FileSystemDirectoryHandle, entryPath);
        }
      }
    }
    
    await readDirectory(folderHandle);
    return this.formatCodebaseContext(files);
  },

  async processZipFile(file: File): Promise<string> {
    // Note: For zip processing, you'll need to add JSZip library to importmap
    // For now, this is a placeholder
    throw new Error('Zip file processing requires JSZip library');
  },

  formatCodebaseContext(files: CodebaseFile[]): string {
    if (files.length === 0) return '';
    
    // Create file tree
    const tree = this.buildFileTree(files);
    
    // Format as context string
    let context = '=== PROJECT FILE TREE ===\n\n';
    context += tree + '\n\n';
    context += '=== FILE CONTENTS ===\n\n';
    
    files.forEach(file => {
      context += `--- ${file.path} ---\n`;
      context += file.content;
      context += '\n\n';
    });
    
    return context;
  },

  buildFileTree(files: CodebaseFile[]): string {
    const tree: any = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          if (!current._files) current._files = [];
          current._files.push(part);
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    
    function renderTree(node: any, indent: string = ''): string {
      let result = '';
      
      // Render directories
      Object.keys(node).filter(k => k !== '_files').forEach(key => {
        result += `${indent}📁 ${key}/\n`;
        result += renderTree(node[key], indent + '  ');
      });
      
      // Render files
      if (node._files) {
        node._files.forEach((file: string) => {
          result += `${indent}📄 ${file}\n`;
        });
      }
      
      return result;
    }
    
    return renderTree(tree);
  }
};
7. src/services/githubService.ts - GitHub Integration
import { CodebaseFile } from '../types';
import { isTextFile, shouldIgnoreFile } from '../utils/helpers';
import { IGNORE_PATTERNS, GITHUB_API_FILE_SIZE_LIMIT } from '../constants';
import { codebaseService } from './codebaseService';

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

export const githubService = {
  async fetchRepositoryContext(repoUrl: string, token?: string): Promise<string> {
    const { owner, repo, branch } = this.parseGitHubUrl(repoUrl);
    const files: CodebaseFile[] = [];
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    
    async function fetchDirectory(path: string = '') {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      
      try {
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const contents: GitHubContent[] = await response.json();
        
        for (const item of contents) {
          if (shouldIgnoreFile(item.path, IGNORE_PATTERNS)) {
            continue;
          }
          
          if (item.type === 'file' && isTextFile(item.name)) {
            if (item.size < GITHUB_API_FILE_SIZE_LIMIT && item.download_url) {
              const fileContent = await fetch(item.download_url).then(r => r.text());
              files.push({ path: item.path, content: fileContent });
            }
          } else if (item.type === 'dir') {
            await fetchDirectory(item.path);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        throw error;
      }
    }
    
    await fetchDirectory();
    return codebaseService.formatCodebaseContext(files);
  },

  parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
    // Handles: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/);
    
    if (!match) {
      throw new Error('Invalid GitHub URL');
    }
    
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
      branch: match[3] || 'main'
    };
  }
};
8. src/services/geminiService.ts - AI Orchestration (Critical File)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, AgentName, ModelName } from '../types';
import { AGENTS, MAX_AGENT_TURNS, WAIT_FOR_USER } from '../constants';
import { generateId, formatTimestamp } from '../utils/helpers';

// Initialize Gemini
const API_KEY = import.meta.env?.VITE_API_KEY || (window as any).API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const geminiService = {
  async getAgentResponse(
    messages: Message[],
    codebaseContext: string | null,
    modelName: ModelName,
    globalRules: string,
    onAgentUpdate?: (agentName: AgentName, status: 'active' | 'idle') => void
  ): Promise<Message[]> {
    const newMessages: Message[] = [];
    let turnCount = 0;
    
    while (turnCount < MAX_AGENT_TURNS) {
      turnCount++;
      
      // Step 1: Call Orchestrator
      onAgentUpdate?.('Orchestrator', 'active');
      
      const orchestratorDecision = await this.callOrchestrator(
        [...messages, ...newMessages],
        codebaseContext,
        modelName
      );
      
      onAgentUpdate?.('Orchestrator', 'idle');
      
      // Step 2: Parse decision
      const nextAction = this.parseOrchestratorResponse(orchestratorDecision);
      
      // Step 3: Execute action
      if (nextAction === WAIT_FOR_USER) {
        break;
      }
      
      // Get the specialist agent
      const agent = AGENTS.find(a => a.name === nextAction);
      
      if (!agent) {
        console.error(`Unknown agent: ${nextAction}`);
        break;
      }
      
      // Call the specialist
      onAgentUpdate?.(agent.name as AgentName, 'active');
      
      const specialistResponse = await this.callSpecialist(
        agent,
        [...messages, ...newMessages],
        codebaseContext,
        modelName,
        globalRules
      );
      
      onAgentUpdate?.(agent.name as AgentName, 'idle');
      
      // Add specialist's message
      const newMessage: Message = {
        id: generateId(),
        text: specialistResponse,
        sender: agent.name as AgentName,
        timestamp: formatTimestamp()
      };
      
      newMessages.push(newMessage);
    }
    
    return newMessages;
  },

  async callOrchestrator(
    messages: Message[],
    codebaseContext: string | null,
    modelName: ModelName
  ): Promise<string> {
    const model = genAI.getGenerativeModel({ model: modelName });
    const orchestrator = AGENTS.find(a => a.name === 'Orchestrator')!;
    
    // Build conversation history
    const conversationHistory = this.buildConversationHistory(messages);
    
    // Prepare prompt
    let fullPrompt = orchestrator.prompt + '\n\n';
    fullPrompt += '=== CONVERSATION HISTORY ===\n\n';
    fullPrompt += conversationHistory;
    
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  },

  async callSpecialist(
    agent: any,
    messages: Message[],
    codebaseContext: string | null,
    modelName: ModelName,
    globalRules: string
  ): Promise<string> {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Build conversation history
    const conversationHistory = this.buildConversationHistory(messages);
    
    // Prepare prompt
    let fullPrompt = agent.prompt + '\n\n';
    
    if (globalRules) {
      fullPrompt += '=== GLOBAL RULES ===\n';
      fullPrompt += globalRules + '\n\n';
    }
    
    if (codebaseContext) {
      fullPrompt += '=== CODEBASE CONTEXT ===\n';
      fullPrompt += codebaseContext + '\n\n';
    }
    
    fullPrompt += '=== CONVERSATION HISTORY ===\n\n';
    fullPrompt += conversationHistory;
    fullPrompt += '\n\nRespond to the latest message as ' + agent.name + ':';
    
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  },

  buildConversationHistory(messages: Message[]): string {
    return messages
      .map(msg => `[${msg.sender}]: ${msg.text}`)
      .join('\n\n');
  },

  parseOrchestratorResponse(response: string): string {
    // Look for the last occurrence of an agent name or WAIT_FOR_USER
    const allPossibleOutputs = [...AGENTS.map(a => a.name), WAIT_FOR_USER];
    
    let lastMatch: string | null = null;
    let lastMatchIndex = -1;
    
    for (const option of allPossibleOutputs) {
      const index = response.lastIndexOf(option);
      if (index > lastMatchIndex) {
        lastMatchIndex = index;
        lastMatch = option;
      }
    }
    
    return lastMatch || WAIT_FOR_USER;
  }
};

Phase 3: UI Components
9. src/components/LoadingDots.tsx - Loading Indicator
import React from 'react';

export function LoadingDots() {
  return (
    <div className="flex space-x-2 p-4">
      <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
}
10. src/components/MessageBubble.tsx - Chat Message
import React from 'react';
import { Message, AgentName } from '../types';
import { AGENTS } from '../constants';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'Ethan';
  
  const agent = AGENTS.find(a => a.name === message.sender);
  const bgColor = isUser ? 'bg-blue-500' : 'bg-gray-200';
  const textColor = isUser ? 'text-white' : 'text-gray-900';
  const alignment = isUser ? 'justify-end' : 'justify-start';
  
  return (
    <div className={`flex ${alignment} mb-4`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && agent && (
          <div className="flex items-center mb-1">
            <div className={`w-8 h-8 rounded-full ${agent.color} flex items-center justify-center text-white text-xs font-bold mr-2`}>
              {agent.avatar}
            </div>
            <span className="text-sm font-semibold text-gray-700">{message.sender}</span>
          </div>
        )}
        
        <div className={`${bgColor} ${textColor} rounded-lg px-4 py-2 shadow`}>
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
          <div className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
11. src/components/Sidebar.tsx - Left Panel
import React from 'react';
import { Agent, Project } from '../types';
import { AGENTS } from '../constants';

interface SidebarProps {
  agents: Agent[];
  projects: Project[];
  currentProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onNewProject: () => void;
  onSettingsClick: () => void;
}

export function Sidebar({
  agents,
  projects,
  currentProjectId,
  onProjectSelect,
  onNewProject,
  onSettingsClick
}: SidebarProps) {
  return (
    <div className="w-80 bg-gray-100 border-r border-gray-300 flex flex-col h-screen">
      {/* Project Selector */}
      <div className="p-4 border-b border-gray-300">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800">Projects</h2>
          <button
            onClick={onNewProject}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            New
          </button>
        </div>
        
        <select
          value={currentProjectId || ''}
          onChange={(e) => onProjectSelect(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          <option value="">Select a project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>
      
      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">ACTIVE STAFF</h3>
        <div className="space-y-2">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="flex items-center p-2 rounded hover:bg-gray-200 transition"
            >
              <div className={`w-10 h-10 rounded-full ${agent.color} flex items-center justify-center text-white font-bold mr-3`}>
                {agent.avatar}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{agent.name}</div>
                <div className="text-xs text-gray-600">{agent.description}</div>
              </div>
              <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Settings Button */}
      <div className="p-4 border-t border-gray-300">
        <button
          onClick={onSettingsClick}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}
12. src/components/ChatView.tsx - Main Chat Area
import React, { useState, useRef, useEffect } from 'react';
import { Message, Project, Model, ModelName } from '../types';
import { MessageBubble } from './MessageBubble';
import { LoadingDots } from './LoadingDots';

interface ChatViewProps {
  project: Project | null;
  models: Model[];
  selectedModel: ModelName;
  onModelChange: (model: ModelName) => void;
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

export function ChatView({
  project,
  models,
  selectedModel,
  onModelChange,
  onSendMessage,
  isLoading
}: ChatViewProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [project?.messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText);
      setInputText('');
    }
  };
  
  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-400 mb-2">No Project Selected</h2>
          <p className="text-gray-500">Create or select a project to get started</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-300 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">{project.title}</h1>
        
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value as ModelName)}
          className="p-2 border border-gray-300 rounded"
        >
          {models.map(model => (
            <option key={model.id} value={model.id} disabled={model.disabled}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {project.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-lg">Start a conversation with your AI staff...</p>
          </div>
        ) : (
          <>
            {project.messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <LoadingDots />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t border-gray-300 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-3 rounded font-medium"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
13. src/components/SettingsModal.tsx - Settings Dialog
import React, { useState, useEffect } from 'react';
import { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export function SettingsModal({ isOpen, settings, onClose, onSave }: SettingsModalProps) {
  const [githubToken, setGithubToken] = useState(settings.githubToken);
  const [globalRules, setGlobalRules] = useState(settings.globalRules);
  
  useEffect(() => {
    if (isOpen) {
      setGithubToken(settings.githubToken);
      setGlobalRules(settings.globalRules);
    }
  }, [isOpen, settings]);
  
  if (!isOpen) return null;
  
  const handleSave = () => {
    onSave({ githubToken, globalRules });
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used to access private repositories. Leave empty for public repos only.
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Global Rules
            </label>
            <textarea
              value={globalRules}
              onChange={(e) => setGlobalRules(e.target.value)}
              placeholder="e.g., 'Always write code in TypeScript', 'Maintain a formal tone'"
              rows={6}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              These rules will be applied to all specialist agents.
            </p>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
14. src/components/NewProjectModal.tsx - Project Creation
import React, { useState } from 'react';
import { githubService } from '../services/githubService';
import { codebaseService } from '../services/codebaseService';

interface NewProjectModalProps {
  isOpen: boolean;
  githubToken: string;
  onClose: () => void;
  onCreate: (title: string, description: string, codebaseContext: string | null) => void;
}

export function NewProjectModal({ isOpen, githubToken, onClose, onCreate }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [codebaseMethod, setCodebaseMethod] = useState<'none' | 'github' | 'folder'>('none');
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Project title is required');
      return;
    }
    
    setIsLoading(true);
    setError('');
    let codebaseContext: string | null = null;
    
    try {
      if (codebaseMethod === 'github' && githubUrl) {
        codebaseContext = await githubService.fetchRepositoryContext(githubUrl, githubToken);
      } else if (codebaseMethod === 'folder') {
        // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
        const dirHandle = await window.showDirectoryPicker();
        codebaseContext = await codebaseService.processFolder(dirHandle);
      }
      
      onCreate(title, description, codebaseContext);
      
      // Reset form
      setTitle('');
      setDescription('');
      setCodebaseMethod('none');
      setGithubUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Create New Project</h2>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Project Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your project..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Codebase Context
            </label>
            
            <div className="space-y-2 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="none"
                  checked={codebaseMethod === 'none'}
                  onChange={() => setCodebaseMethod('none')}
                  className="mr-2"
                />
                No codebase context
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  value="github"
                  checked={codebaseMethod === 'github'}
                  onChange={() => setCodebaseMethod('github')}
                  className="mr-2"
                />
                Connect GitHub Repository
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  value="folder"
                  checked={codebaseMethod === 'folder'}
                  onChange={() => setCodebaseMethod('folder')}
                  className="mr-2"
                />
                Upload Local Folder
              </label>
            </div>
            
            {codebaseMethod === 'github' && (
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

Phase 4: Main Application
15. src/App.tsx - Root Component
import React, { useState, useEffect } from 'react';
import { Project, Message, AgentName, ModelName, Agent } from './types';
import { AGENTS, MODELS } from './constants';
import { projectService } from './services/projectService';
import { geminiService } from './services/geminiService';
import { generateId, formatTimestamp } from './utils/helpers';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { SettingsModal } from './components/SettingsModal';
import { NewProjectModal } from './components/NewProjectModal';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedModel, setSelectedModel] = useState<ModelName>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  
  const settings = projectService.getSettings();
  
  // Load projects on mount
  useEffect(() => {
    const loadedProjects = projectService.getAllProjects();
    setProjects(loadedProjects);
    
    const savedProjectId = projectService.getCurrentProjectId();
    if (savedProjectId && loadedProjects.find(p => p.id === savedProjectId)) {
      setCurrentProjectId(savedProjectId);
    }
  }, []);
  
  const currentProject = projects.find(p => p.id === currentProjectId) || null;
  
  const handleProjectSelect = (projectId: string) => {
    setCurrentProjectId(projectId);
    projectService.setCurrentProjectId(projectId);
  };
  
  const handleNewProject = (title: string, description: string, codebaseContext: string | null) => {
    const newProject = projectService.createNewProject(title, description);
    newProject.codebaseContext = codebaseContext;
    
    projectService.saveProject(newProject);
    
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    projectService.setCurrentProjectId(newProject.id);
    setIsNewProjectOpen(false);
  };
  
  const handleSendMessage = async (text: string) => {
    if (!currentProject) return;
    
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      text,
      sender: 'Ethan',
      timestamp: formatTimestamp()
    };
    
    const updatedProject = {
      ...currentProject,
      messages: [...currentProject.messages, userMessage]
    };
    
    setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProject : p));
    projectService.saveProject(updatedProject);
    
    // Get agent responses
    setIsLoading(true);
    
    try {
      const newMessages = await geminiService.getAgentResponse(
        updatedProject.messages,
        currentProject.codebaseContext,
        selectedModel,
        settings.globalRules,
        (agentName, status) => {
          setAgents(prev => prev.map(a => 
            a.name === agentName ? { ...a, status } : a
          ));
        }
      );
      
      const finalProject = {
        ...updatedProject,
        messages: [...updatedProject.messages, ...newMessages]
      };
      
      setProjects(prev => prev.map(p => p.id === currentProject.id ? finalProject : p));
      projectService.saveProject(finalProject);
    } catch (error) {
      console.error('Error getting agent response:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
      setAgents(AGENTS); // Reset all to idle
    }
  };
  
  const handleSaveSettings = (newSettings: typeof settings) => {
    projectService.saveSettings(newSettings);
  };
  
  return (
    <div className="flex h-screen">
      <Sidebar
        agents={agents}
        projects={projects}
        currentProjectId={currentProjectId}
        onProjectSelect={handleProjectSelect}
        onNewProject={() => setIsNewProjectOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
      <ChatView
        project={currentProject}
        models={MODELS}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
      
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
      
      <NewProjectModal
        isOpen={isNewProjectOpen}
        githubToken={settings.githubToken}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={handleNewProject}
      />
    </div>
  );
}
16. src/index.tsx - Entry Point
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

Testing & Running
1. Set Up API Key
Create a simple way to provide your API key. Add this to index.html before the module script:
<script>
  // Set your Gemini API key here
  window.API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
</script>
2. Serve Locally
Use any static file server:
Option A: VS Code Live Server
* Install "Live Server" extension
* Right-click index.html → "Open with Live Server"
Option B: Python
python -m http.server 8000
Option C: Node.js http-server
npx http-server -p 8000
3. Test Features
1. Create a project without codebase context
2. Send a message - watch agents orchestrate
3. Add GitHub repo to a project
4. Test global rules in settings
5. Switch models between Pro and Flash

Troubleshooting
CORS Errors with GitHub API:
* Make sure you're using a valid GitHub token for private repos
* Public repos should work without a token
API Key Issues:
* Verify your Gemini API key is correct
* Check browser console for specific error messages
File System Access:
* showDirectoryPicker() only works in Chrome/Edge
* Requires HTTPS or localhost
Storage Issues:
* localStorage has ~5-10MB limit
* Large codebases may exceed this
* Consider implementing IndexedDB for production

Next Steps
1. Add IndexedDB for larger storage
2. Implement ZIP upload (add JSZip to importmap)
3. Add export/import functionality
4. Improve error handling with toast notifications
5. Add markdown rendering for code blocks in messages
6. Implement conversation branching
7. Add agent memory persistence across projects
Your MilkStack is now ready to orchestrate! 🚀
