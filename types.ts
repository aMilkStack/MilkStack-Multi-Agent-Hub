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
  thinkingBudget?: number;
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
  isError?: boolean; // Indicates if this message represents an error state
}

// Agency V2 Workflow Types (Multi-Stage Task Map)
export interface StageAgent {
  agent: string; // Kebab-case agent identifier
  model: GeminiModel;
}

export interface TaskStage {
  stageName: string; // IMPLEMENTATION, CODE_REVIEW, SYNTHESIZE, PLAN_REVIEW
  objective: string;
  agents: StageAgent[];
}

export interface AgencyTask {
  id: string;
  objective: string;
  dependencies: string[];
  stages: TaskStage[];
}

export interface TaskMap {
  title: string;
  description: string;
  tasks: AgencyTask[];
}

export interface ActiveTaskState {
  version: number; // For future schema migrations
  taskMap: TaskMap;
  currentTaskIndex: number;
  currentStageIndex: number;
  collectedFeedback: { agentName: string; content: string }[];
  status: 'in_progress' | 'paused' | 'failed' | 'completed';
  failedStages: { taskIndex: number; stageIndex: number; error: string }[];
}

// Rusty Chat Types
export interface RustyMessage {
  id: string;
  role: 'user' | 'rusty';
  content: string;
  timestamp: Date;
}

export interface RustyChat {
  id: string;
  name: string; // Chat name/title
  messages: RustyMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebaseContext: string;
  apiKey?: string; // API key stored per-project (falls back to global settings)
  rustyChats: RustyChat[]; // Persistent Rusty chat history
  activeRustyChatId?: string; // Currently active Rusty chat
  createdAt: Date;
  updatedAt: Date;
  activeTaskState?: ActiveTaskState; // V2 Agency workflow state
}

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-3-pro-preview';

export interface Settings {
  apiKey: string;
  rustyApiKey: string; // Separate API key for Rusty meta-agent
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}

// Agency Workflow Types
export enum AgentRole {
  Planner = 'planner',
  Developer = 'developer',
  Reviewer = 'reviewer',
  Architect = 'architect',
}

export interface SubTask {
  id: string;
  title: string;
  description: string;
  assignedRole: AgentRole;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[]; // IDs of tasks that must be completed first
  output?: string; // The result of the task execution
}

export interface WorkflowState {
  id: string;
  projectId: string;
  status: 'planning' | 'executing' | 'reviewing' | 'completed';
  tasks: SubTask[];
  currentTaskIndex: number;
  results: string[];
  error?: string;
}