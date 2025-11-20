import { z } from 'zod';
import { MODELS } from '../../config/ai';

/**
 * Zod schema for agent item validation
 */
export const AgentItemSchema = z.object({
  agent: z.string().min(1, 'Agent name is required'),
  model: z.enum([MODELS.PRO, MODELS.FLASH], {
    errorMap: () => ({ message: `Model must be either ${MODELS.PRO} or ${MODELS.FLASH}` })
  }),
});

/**
 * Zod schema for stage validation
 */
export const StageSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required'),
  objective: z.string().min(1, 'Stage objective is required'),
  agents: z.array(AgentItemSchema).min(1, 'At least one agent is required per stage'),
});

/**
 * Zod schema for task validation
 */
export const TaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  objective: z.string().min(1, 'Task objective is required'),
  stages: z.array(StageSchema).min(1, 'At least one stage is required per task'),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Zod schema for task map validation
 */
export const TaskMapSchema = z.object({
  title: z.string().min(1, 'Task map title is required'),
  tasks: z.array(TaskSchema).min(1, 'At least one task is required'),
});

// Export inferred types
export type TaskMap = z.infer<typeof TaskMapSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type AgentItem = z.infer<typeof AgentItemSchema>;
