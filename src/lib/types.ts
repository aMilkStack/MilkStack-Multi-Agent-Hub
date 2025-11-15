export type AgentName = 'Orchestrator' | 'Architect' | 'Planner' | 'Code' | 'Debug' | 'UX' | 'Deep Research' | 'Deep Scope' | 'Builder' | 'Guardian' | 'Memory' | 'Ask' | 'Vision' | 'Market';
export type AgentStatus = 'idle' | 'active' | 'booting';

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
  author: Agent | 'user';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export type ProjectType = 'new_cycle' | 'existing_codebase';

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebase: any; // Simplified for now
  githubUrl?: string;
}

export interface Settings {
  githubPat: string;
  aiModel: string;
  globalRules: string;
}

export interface Model {
    id: string;
    name: string;
    disabled?: boolean;
    tooltip?: string;
}

export type CommandCategory = 'Project Management' | 'Architecture' | 'Development' | 'Research' | 'Framework' | 'Utility';

export interface Command {
    name: string;
    description: string;
    category: CommandCategory;
    prompt: string; // A template for what to send to the orchestrator for this command
    agent: AgentName; // The primary agent responsible for this command
}
