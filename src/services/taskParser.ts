import { TaskMap } from '../../types';

/**
 * Service for parsing and validating task maps from agent messages.
 * Handles JSON extraction from markdown code blocks and schema validation.
 */
export class TaskParser {
    /**
     * Extracts a task map from a message containing a ```json_task_map code block.
     * Returns null if no task map is found, or throws an error if the JSON is invalid.
     */
    static extractTaskMap(messageContent: string): TaskMap | null {
        const taskMapRegex = /```json_task_map\s*([\s\S]*?)```/;
        const match = messageContent.match(taskMapRegex);

        if (!match) {
            return null;
        }

        const jsonString = match[1].trim();

        try {
            const parsed = JSON.parse(jsonString);
            return this.validateTaskMap(parsed);
        } catch (error: any) {
            throw new Error(`Task map JSON parse error: ${error.message}`);
        }
    }

    /**
     * Validates that a parsed object conforms to the TaskMap schema.
     * Throws descriptive errors if validation fails.
     */
    static validateTaskMap(parsed: any): TaskMap {
        // Validate top-level fields
        if (!parsed.title || typeof parsed.title !== 'string') {
            throw new Error('Invalid task map: missing or invalid "title" field');
        }

        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
            throw new Error('Invalid task map: missing or invalid "tasks" array');
        }

        if (parsed.tasks.length === 0) {
            throw new Error('Invalid task map: tasks array is empty');
        }

        // Validate each task
        for (let i = 0; i < parsed.tasks.length; i++) {
            const task = parsed.tasks[i];

            if (!task.id || typeof task.id !== 'string') {
                throw new Error(`Invalid task ${i}: missing or invalid "id" field`);
            }

            if (!task.objective || typeof task.objective !== 'string') {
                throw new Error(`Invalid task ${task.id}: missing or invalid "objective" field`);
            }

            if (!task.stages || !Array.isArray(task.stages)) {
                throw new Error(`Invalid task ${task.id}: missing or invalid "stages" array`);
            }

            if (task.stages.length === 0) {
                throw new Error(`Invalid task ${task.id}: stages array is empty`);
            }

            // Validate each stage
            for (let j = 0; j < task.stages.length; j++) {
                const stage = task.stages[j];

                if (!stage.stageName || typeof stage.stageName !== 'string') {
                    throw new Error(`Invalid stage ${j} in task ${task.id}: missing or invalid "stageName" field`);
                }

                if (!stage.objective || typeof stage.objective !== 'string') {
                    throw new Error(`Invalid stage "${stage.stageName}" in task ${task.id}: missing or invalid "objective" field`);
                }

                if (!stage.agents || !Array.isArray(stage.agents)) {
                    throw new Error(`Invalid stage "${stage.stageName}" in task ${task.id}: missing or invalid "agents" array`);
                }

                if (stage.agents.length === 0) {
                    throw new Error(`Invalid stage "${stage.stageName}" in task ${task.id}: agents array is empty`);
                }

                // Validate each agent in the stage
                for (let k = 0; k < stage.agents.length; k++) {
                    const agent = stage.agents[k];

                    if (!agent.agent || typeof agent.agent !== 'string') {
                        throw new Error(`Invalid agent ${k} in stage "${stage.stageName}", task ${task.id}: missing or invalid "agent" field`);
                    }

                    if (!agent.model || typeof agent.model !== 'string') {
                        throw new Error(`Invalid agent ${k} in stage "${stage.stageName}", task ${task.id}: missing or invalid "model" field`);
                    }

                    // Validate model is one of the allowed values
                    const validModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview'];
                    if (!validModels.includes(agent.model)) {
                        throw new Error(`Invalid agent ${k} in stage "${stage.stageName}", task ${task.id}: invalid model "${agent.model}". Must be one of: ${validModels.join(', ')}`);
                    }
                }
            }

            // Validate dependencies (optional field)
            if (task.dependencies && !Array.isArray(task.dependencies)) {
                throw new Error(`Invalid task ${task.id}: "dependencies" must be an array`);
            }
        }

        return parsed as TaskMap;
    }

    /**
     * Extracts a JSON object from text that may contain conversational preamble or markdown formatting.
     * Used for parsing orchestrator responses.
     */
    static extractJsonFromText(text: string): string | null {
        // Priority 1: Markdown code blocks (most explicit)
        const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const markdownMatch = text.match(markdownJsonRegex);
        if (markdownMatch) {
            return markdownMatch[1].trim();
        }

        // Priority 2: Standalone JSON on its own line (prevents capturing "{...} extra text")
        const standaloneJsonRegex = /^\s*(\{[\s\S]*?\})\s*$/m;
        const standaloneMatch = text.match(standaloneJsonRegex);
        if (standaloneMatch) {
            // Validate it's actually valid JSON before returning
            try {
                JSON.parse(standaloneMatch[1]);
                return standaloneMatch[1].trim();
            } catch {
                // Not valid JSON, fall through to next attempt
            }
        }

        // Priority 3: Extract first complete JSON object and validate
        const conservativeJsonRegex = /\{(?:[^{}]|\{[^{}]*\})*\}/;
        const conservativeMatch = text.match(conservativeJsonRegex);
        if (conservativeMatch) {
            try {
                JSON.parse(conservativeMatch[0]);
                return conservativeMatch[0].trim();
            } catch {
                // Not valid JSON
            }
        }

        return null;
    }

    /**
     * Validates that a stage name is one of the allowed values
     */
    static isValidStageName(stageName: string): boolean {
        const validStageNames = ['IMPLEMENTATION', 'CODE_REVIEW', 'SYNTHESIZE', 'PLAN_REVIEW'];
        return validStageNames.includes(stageName);
    }
}
