/**
 * Agent Types
 * Defines agent structure and status
 */

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

export enum AgentRole {
  Planner = 'planner',
  Developer = 'developer',
  Reviewer = 'reviewer',
  Architect = 'architect',
}
