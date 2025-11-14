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
