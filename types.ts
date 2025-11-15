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

export interface Message {
  id: string;
  author: 'Ethan' | Agent;
  content: string;
  timestamp: Date;
}

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebaseContext: string;
}

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash';

export interface Settings {
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}