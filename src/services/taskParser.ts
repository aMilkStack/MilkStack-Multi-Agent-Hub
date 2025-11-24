import { TaskMap } from '../types';
import { MODELS } from '../config/ai';
import { TaskMapSchema } from '../types/schemas/taskMap.schema';

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
     * Validates that a parsed object conforms to the TaskMap schema using Zod.
     * Throws descriptive errors if validation fails.
     */
    static validateTaskMap(parsed: any): TaskMap {
        const result = TaskMapSchema.safeParse(parsed);

        if (!result.success) {
            // Format Zod errors into a human-readable message
            const errors = result.error.errors.map(e => {
                const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
                return `${path}${e.message}`;
            }).join('; ');

            throw new Error(`Task map validation failed: ${errors}`);
        }

        return result.data;
    }

    /**
     * Cleans common LLM JSON errors before parsing
     */
    private static cleanJson(str: string): string {
        return str
            .replace(/,\s*}/g, '}') // Remove trailing commas in objects
            .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
            .replace(/\/\/.*$/gm, '') // Remove JS-style comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
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
            const cleaned = this.cleanJson(markdownMatch[1].trim());
            try {
                JSON.parse(cleaned); // Validate
                return cleaned;
            } catch (e) {
                // Continue to other methods if cleaning didn't help
            }
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
