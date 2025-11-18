export enum AgentStatus {
  Idle = 'idle',
  Active = 'active',
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  color: string;
  avatar: string;
  status: AgentStatus;
}

// GitHub Integration Types (defined before Message to avoid forward reference)
export interface ProposedChange {
  filePath: string;
  action: 'add' | 'modify' | 'delete';
  content?: string; // Full new content for 'add' or 'modify'
  diff?: string;    // Git-style diff format for 'modify'
}

export interface AgentProposedChanges {
  type: 'proposed_changes';
  changes: ProposedChange[];
  commitMessageHint?: string;
  branchNameHint?: string;
}

export interface Message {
  id: string;
  author: 'Ethan' | Agent;
  content: string;
  timestamp: Date;
  proposedChanges?: AgentProposedChanges; // Optional proposed code changes from agents
}

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebaseContext: string;
  apiKey?: string; // API key stored per-project
  createdAt: Date;
  updatedAt: Date;
}

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash';

export interface Settings {
  apiKey: string;
  rustyApiKey: string; // Separate API key for Rusty meta-agent
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}