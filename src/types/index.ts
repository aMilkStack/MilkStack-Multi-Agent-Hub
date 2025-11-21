/**
 * Types Index
 * Re-exports all types for convenience and backward compatibility
 */

// Agent types
export type { Agent } from './agent';
export { AgentStatus, AgentRole } from './agent';

// GitHub types
export type { ProposedChange, AgentProposedChanges } from './github';

// Message types
export type { Message } from './message';

// Workflow types
export type {
  GeminiModel,
  StageAgent,
  TaskStage,
  AgencyTask,
  TaskMap,
  ActiveTaskState,
  SubTask,
  WorkflowState,
  WorkflowPhaseState,
} from './workflow';

// Workflow enum (must be value export, not type export)
export { WorkflowPhase } from './workflow';

// Rusty types
export type { RustyMessage, RustyChat } from './rusty';

// Project and Settings types
export type { Project, Settings } from './project';
