import { ActiveTaskState, TaskMap, TaskStage, Message, Agent } from '../types';

/**
 * Pure state machine for Agency V2 workflow execution.
 * This class handles workflow state transitions without knowing about API calls or React callbacks.
 *
 * Responsibilities:
 * - Determine the current stage to execute
 * - Validate state transitions
 * - Manage feedback collection
 * - Handle error states and recovery
 *
 * Does NOT:
 * - Make API calls (delegated to AgentExecutor)
 * - Manage UI state (handled by React components)
 * - Persist state (handled by App.tsx)
 */
export class WorkflowEngine {
    private state: ActiveTaskState;

    constructor(initialState: ActiveTaskState) {
        this.state = { ...initialState };
    }

    /**
     * Returns the current workflow state (immutable copy)
     */
    getState(): Readonly<ActiveTaskState> {
        return { ...this.state };
    }

    /**
     * Returns the current task being executed
     */
    getCurrentTask() {
        if (this.state.currentTaskIndex >= this.state.taskMap.tasks.length) {
            return null;
        }
        return this.state.taskMap.tasks[this.state.currentTaskIndex];
    }

    /**
     * Returns the current stage being executed
     */
    getCurrentStage(): TaskStage | null {
        const task = this.getCurrentTask();
        if (!task || this.state.currentStageIndex >= task.stages.length) {
            return null;
        }
        return task.stages[this.state.currentStageIndex];
    }

    /**
     * Checks if the workflow is complete
     */
    isComplete(): boolean {
        return (
            this.state.status === 'completed' ||
            this.state.currentTaskIndex >= this.state.taskMap.tasks.length
        );
    }

    /**
     * Checks if the workflow is in a failed state
     */
    isFailed(): boolean {
        return this.state.status === 'failed';
    }

    /**
     * Checks if the workflow is paused and waiting for user approval
     */
    isPaused(): boolean {
        return this.state.status === 'paused';
    }

    /**
     * Checks if the current stage requires parallel execution (multiple agents)
     */
    isParallelStage(): boolean {
        const stage = this.getCurrentStage();
        return stage ? stage.agents.length > 1 : false;
    }

    /**
     * Checks if the current stage is a SYNTHESIZE stage that needs feedback
     */
    isSynthesizeStage(): boolean {
        const stage = this.getCurrentStage();
        return stage?.stageName === 'SYNTHESIZE';
    }

    /**
     * Returns feedback collected from previous stages (for SYNTHESIZE)
     */
    getCollectedFeedback() {
        return [...this.state.collectedFeedback];
    }

    /**
     * Records feedback from an agent (used in CODE_REVIEW/PLAN_REVIEW stages)
     */
    addFeedback(agentName: string, content: string): void {
        this.state.collectedFeedback.push({ agentName, content });
    }

    /**
     * Clears feedback after SYNTHESIZE stage consumes it
     */
    clearFeedback(): void {
        this.state.collectedFeedback = [];
    }

    /**
     * Records a stage failure
     */
    recordFailure(error: string): void {
        this.state.status = 'failed';
        this.state.failedStages.push({
            taskIndex: this.state.currentTaskIndex,
            stageIndex: this.state.currentStageIndex,
            error
        });
    }

    /**
     * Advances to the next stage in the workflow.
     * Handles stage transitions, task transitions, and completion detection.
     * Returns true if there's more work to do, false if workflow is complete.
     */
    advanceToNextStage(): boolean {
        const currentTask = this.getCurrentTask();
        if (!currentTask) {
            this.state.status = 'completed';
            return false;
        }

        // Move to next stage
        this.state.currentStageIndex++;

        // Check if current task is complete
        if (this.state.currentStageIndex >= currentTask.stages.length) {
            this.state.currentTaskIndex++;
            this.state.currentStageIndex = 0;

            // Check if all tasks are complete
            if (this.state.currentTaskIndex >= this.state.taskMap.tasks.length) {
                this.state.status = 'completed';
                return false;
            }
        }

        // Check if we should pause for approval after SYNTHESIZE
        const nextStage = this.getCurrentStage();
        if (nextStage?.stageName === 'IMPLEMENTATION' && this.shouldPauseForApproval()) {
            this.state.status = 'paused';
            return false;
        }

        return true;
    }

    /**
     * Resumes a paused workflow after user approval
     */
    resume(): void {
        if (this.state.status === 'paused') {
            this.state.status = 'in_progress';
        }
    }

    /**
     * Pauses the workflow for user review
     */
    pause(): void {
        this.state.status = 'paused';
    }

    /**
     * Determines if the workflow should pause for user approval.
     * Currently pauses before IMPLEMENTATION if there was a SYNTHESIZE stage.
     */
    private shouldPauseForApproval(): boolean {
        // Check if previous stage was SYNTHESIZE
        const currentTask = this.getCurrentTask();
        if (!currentTask || this.state.currentStageIndex === 0) {
            return false;
        }

        const previousStage = currentTask.stages[this.state.currentStageIndex - 1];
        return previousStage?.stageName === 'SYNTHESIZE';
    }

    /**
     * Validates that the workflow state is consistent
     * @throws Error if state is invalid
     */
    validate(): void {
        if (!this.state.taskMap || !this.state.taskMap.tasks) {
            throw new Error('Invalid workflow state: missing task map');
        }

        if (this.state.currentTaskIndex < 0) {
            throw new Error('Invalid workflow state: negative task index');
        }

        if (this.state.currentStageIndex < 0) {
            throw new Error('Invalid workflow state: negative stage index');
        }

        if (this.state.currentTaskIndex >= this.state.taskMap.tasks.length && this.state.status !== 'completed') {
            throw new Error('Invalid workflow state: task index out of bounds but not completed');
        }
    }

    /**
     * Creates a progress summary for UI display
     */
    getProgressSummary(): {
        currentTask: number;
        totalTasks: number;
        currentStage: number;
        totalStages: number;
        currentStageName: string;
        percentComplete: number;
    } {
        const task = this.getCurrentTask();
        const stage = this.getCurrentStage();

        const totalStages = this.state.taskMap.tasks.reduce((sum, t) => sum + t.stages.length, 0);
        const completedStages = this.state.taskMap.tasks
            .slice(0, this.state.currentTaskIndex)
            .reduce((sum, t) => sum + t.stages.length, 0) + this.state.currentStageIndex;

        return {
            currentTask: this.state.currentTaskIndex + 1,
            totalTasks: this.state.taskMap.tasks.length,
            currentStage: this.state.currentStageIndex + 1,
            totalStages: task ? task.stages.length : 0,
            currentStageName: stage?.stageName || 'Unknown',
            percentComplete: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
        };
    }
}

/**
 * Factory function to create a WorkflowEngine from a task map
 */
export function createWorkflowEngine(taskMap: TaskMap): WorkflowEngine {
    const initialState: ActiveTaskState = {
        version: 1,
        taskMap,
        currentTaskIndex: 0,
        currentStageIndex: 0,
        collectedFeedback: [],
        status: 'paused',
        failedStages: []
    };

    return new WorkflowEngine(initialState);
}

/**
 * Factory function to restore a WorkflowEngine from persisted state
 */
export function restoreWorkflowEngine(state: ActiveTaskState): WorkflowEngine {
    const engine = new WorkflowEngine(state);
    engine.validate(); // Ensure state is valid
    return engine;
}
