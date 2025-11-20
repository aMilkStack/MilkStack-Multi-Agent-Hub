/**
 * Workflow Types
 * Defines multi-stage workflow and task management structures
 */

import { AgentRole } from './agent';

/**
 * Model type for AI operations
 */
export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash';

/**
 * Agency V2 Workflow Types (Multi-Stage Task Map)
 */
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

/**
 * Legacy Agency Workflow Types (V1)
 */
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
