'use server';
/**
 * @fileOverview The Enhance Prompt Engine for the Advanced-Multi-Agent-AI-Framework.
 * This invisible agent transforms raw user prompts into a precise, machine-usable JSON specification
 * for the Orchestrator and other agents to execute.
 *
 * - enhanceUserPrompt - A function that triggers the prompt enhancement process.
 * - EnhanceUserPromptInput - The input type for the enhanceUserPrompt function.
 * - EnhancedPrompt - The structured JSON output from the enhancement process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ALL_AGENT_NAMES } from '@/lib/agents';

const EnhanceUserPromptInputSchema = z.object({
  raw_user_prompt: z.string().describe('The verbatim user request text.'),
  // Optional metadata fields can be added here if needed in the future
});
export type EnhanceUserPromptInput = z.infer<typeof EnhanceUserPromptInputSchema>;


const SubtaskSchema = z.object({
    task_id: z.string(),
    title: z.string().describe("Atomic subtask title"),
    mode: z.enum(ALL_AGENT_NAMES),
    objective: z.string().describe("Single clear outcome for this subtask"),
    scope: z.object({
        in_scope: z.array(z.string()).describe("Specific actions this subtask will perform, grounded in provided info"),
        out_of_scope: z.array(z.string()).describe("Reading or modifying files not explicitly identified by the caller"),
    }),
    workspace_path: z.string().nullable().describe("If caller provided a path and it is clearly relevant, echo it; else null"),
    file_patterns: z.array(z.string()).describe("If caller provided explicit patterns, echo them; else empty"),
    dependencies: z.array(z.string()),
    parallelizable: z.boolean(),
    acceptance_criteria: z.array(z.string()).describe("Subtask-level checks based on described behavior"),
    tests_required: z.array(z.string()).describe("If applicable and explicitly implied, otherwise []"),
    expected_outputs: z.array(z.string()).describe("Files, docs, or decisions described at a high level, without inventing paths"),
});

const EnhancedPromptSchema = z.object({
    run: z.object({
        run_id: z.string().describe("A unique ID for this run, e.g., enhance-{timestamp}"),
        title: z.string().describe("Short, clear title derived from user intent"),
        summary: z.string().describe("1-3 sentences describing what the user wants"),
        primary_mode: z.enum(["orchestrator"]),
        priority: z.enum(["low", "medium", "high", "critical"]),
    }),
    context: z.object({
        raw_user_prompt: z.string().describe("Verbatim user prompt"),
        assumptions: z.array(z.string()).describe("Assumptions that are strictly necessary and clearly supportable"),
        project_root: z.string().nullable().describe("If explicitly provided, echo it; else null"),
        related_paths: z.array(z.string()).describe("Only include paths that appear explicitly in the prompt or metadata"),
        known_inputs: z.object({
            from_caller: z.boolean(),
            description: z.string().describe("Summarize any file/path lists or metadata provided by the caller"),
            examples_only: z.string().describe("If none provided, leave this empty or minimal"),
        }),
        task_map: z.object({
            path: z.string().nullable().describe("If caller explicitly references one, set it; else null"),
            exists: z.boolean(),
        }),
    }),
    task_spec: z.object({
        objective: z.string().describe("Single precise statement of what must be achieved"),
        in_scope: z.array(z.string()).describe("Concrete, testable responsibilities inferred strictly from the prompt"),
        out_of_scope: z.array(z.string()).describe("Any behavior that requires hidden file access or unspecified tools"),
        acceptance_criteria: z.array(z.string()).describe("Each is a clear, verifiable condition based only on known context"),
    }),
    subtasks: z.array(SubtaskSchema),
    parallelization: z.object({
        strategy: z.enum(["max-parallel", "critical-path", "none"]),
        rationale: z.string().describe("Explain based on dependencies and explicit scopes, not assumed file scans"),
    }),
    payload_schema: z.object({
        type: z.enum(["task-completed", "escalation", "review-approved", "review-rejected"]),
        task_id: z.string(),
        run_id: z.string(),
        from: z.string().describe("mode-slug"),
        to: z.enum(["orchestrator", "requester"]),
        status: z.enum(["success", "failed", "blocked"]),
        files_changed: z.array(z.string()).describe("relative/path (only those actually touched by downstream agents)"),
        tests_run: z.array(z.string()).describe("commands or descriptions"),
        summary: z.string().describe("Concise description"),
        notes: z.string().describe("Details, caveats, or follow-ups"),
    })
});

export type EnhancedPrompt = z.infer<typeof EnhancedPromptSchema>;

export async function enhanceUserPrompt(input: EnhanceUserPromptInput): Promise<EnhancedPrompt> {
    return enhanceUserPromptFlow(input);
}


const prompt = ai.definePrompt({
  name: 'enhanceUserPrompt',
  input: { schema: EnhanceUserPromptInputSchema },
  output: { schema: EnhancedPromptSchema, format: 'json' },
  prompt: `PERSONA:
You are the Enhance Prompt Engine for the Advanced-Multi-Agent-AI-Framework.
You DO NOT execute tasks. You DO NOT read or inspect repository files. You ONLY transform provided inputs into a precise, machine-usable specification.
Your behavior MUST be:
* File-system agnostic:
    * You cannot call tools or scan the codebase.
    * You rely solely on:
        * The raw user prompt text.
        * Any explicit metadata the user passes to you.
Ready for:
        * Orchestrator to use.
        * Agents to implement tasks and ideas
        * Reviewer to validate.
Your output is and consumed by orchestrator/agent templates, so it MUST be deterministic, strictly structured, and free of fluff.

1. Inputs You Can Use

You may assume the caller provides one or more of:
* raw_user_prompt (required): the original user request.
* Optional metadata (only if explicitly given by the user):
    * project_root: textual description or path.
    * known_files or known_paths: a list of file/directory hints.
    * task_map_path: if an existing Task Map location is explicitly provided.
    * run_id: if continuing an existing run.
    * Any other structured hints (issue URLs, PR URLs, etc.).
You MUST treat all file path and repo information as:
* Hints supplied by the user, NOT discovered by you.
* Never assume existence beyond what is explicitly stated.
You MUST NOT:
* Invent file paths or directories.
* Imply you have scanned or inspected files.
* Use tools to read files as part of this prompt.

2. Output Format (Single JSON Object)

You MUST output exactly ONE JSON object matching the provided output schema.
  `,
});


const enhanceUserPromptFlow = ai.defineFlow(
  {
    name: 'enhanceUserPromptFlow',
    inputSchema: EnhanceUserPromptInputSchema,
    outputSchema: EnhancedPromptSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Enhance Prompt Engine failed to produce an output.');
    }
    return output;
  }
);
