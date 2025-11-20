import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, SubTask, AgentRole, WorkflowState } from '../../types';
import { loadSettings } from './indexedDbService';
import { AGENT_PROFILES } from '../../constants';

export class AgencyService {
    private ai: GoogleGenAI | null = null;
    private model: GeminiModel = 'gemini-2.5-pro';

    constructor() {
        this.initialize();
    }

    private async initialize() {
        const settings = await loadSettings();
        if (settings?.apiKey) {
            this.ai = new GoogleGenAI({ apiKey: settings.apiKey });
            this.model = settings.model || 'gemini-2.5-pro';
        }
    }

    /**
     * Decomposes a high-level user request into granular sub-tasks.
     */
    async decomposeTask(userRequest: string): Promise<SubTask[]> {
        if (!this.ai) await this.initialize();
        if (!this.ai) throw new Error("Gemini API key not found");

        const prompt = `
      You are a Senior Technical Project Manager.
      Your goal is to break down a complex software development request into granular, actionable sub-tasks.
      
      User Request: "${userRequest}"
      
      Available Roles:
      - ${AgentRole.Planner}: Requirements analysis, architecture design.
      - ${AgentRole.Developer}: Writing code, implementing features.
      - ${AgentRole.Reviewer}: Code review, testing, verification.
      - ${AgentRole.Architect}: High-level system design, technology choices.
      
      Output a JSON array of sub-tasks. Each sub-task must have:
      - id: string (unique)
      - title: string
      - description: string (detailed instructions)
      - assignedRole: AgentRole
      - dependencies: string[] (ids of tasks that must finish first)
      
      Example Output:
      [
        {
          "id": "task-1",
          "title": "Design Database Schema",
          "description": "Define the tables and relationships for the user module.",
          "assignedRole": "architect",
          "dependencies": []
        },
        {
          "id": "task-2",
          "title": "Implement API Endpoints",
          "description": "Create Express routes for user CRUD operations.",
          "assignedRole": "developer",
          "dependencies": ["task-1"]
        }
      ]
      
      Return ONLY the JSON array.
    `;

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: 'application/json',
                }
            });

            let responseText = response.response?.text?.();
            if (!responseText) {
                responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            }
            const tasks = JSON.parse(responseText) as SubTask[];

            // Add initial status
            return tasks.map(t => ({ ...t, status: 'pending' }));
        } catch (error) {
            console.error("Failed to decompose task:", error);
            throw error;
        }
    }

    /**
     * Assigns specific agents to roles based on the sub-task requirements.
     * (Placeholder for now, simple mapping)
     */
    async assignAgents(tasks: SubTask[]): Promise<Map<string, Agent>> {
        const assignment = new Map<string, Agent>();

        // Simple heuristic mapping for now
        const roleMapping: Record<AgentRole, string> = {
            [AgentRole.Planner]: 'Product Planner',
            [AgentRole.Developer]: 'Full Stack Developer',
            [AgentRole.Reviewer]: 'QA Engineer', // Or Rusty
            [AgentRole.Architect]: 'System Architect',
        };

        for (const task of tasks) {
            const agentName = roleMapping[task.assignedRole];
            const agent = AGENT_PROFILES.find(a => a.name === agentName);
            if (agent) {
                assignment.set(task.id, agent);
            }
        }

        return assignment;
    }
    /**
     * Executes a sub-task using the assigned agent.
     */
    private async runAgentTask(task: SubTask, agent: Agent, context: string): Promise<string> {
        if (!this.ai) throw new Error("AI not initialized");

        const prompt = `
      You are ${agent.name}.
      ${agent.prompt}
      
      Your Task:
      ${task.title}
      ${task.description}
      
      Context:
      ${context}
      
      Perform the task and provide the output.
    `;

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            let text = response.response?.text?.();
            if (!text) {
                text = response.candidates?.[0]?.content?.parts?.[0]?.text;
            }
            return text || '';
        } catch (error) {
            console.error(`Agent ${agent.name} failed task ${task.id}:`, error);
            throw error;
        }
    }

    /**
     * Synthesizes the results from multiple agents into a final response.
     */
    async synthesizeResults(userRequest: string, tasks: SubTask[]): Promise<string> {
        if (!this.ai) throw new Error("AI not initialized");

        const taskSummaries = tasks.map(t => `
      Task: ${t.title}
      Status: ${t.status}
      Output: ${t.output}
    `).join('\n---\n');

        const prompt = `
      You are the Project Lead.
      User Request: "${userRequest}"
      
      Here are the results from your team:
      ${taskSummaries}
      
      Synthesize these results into a coherent final response for the user.
      Explain what was done and provide the final deliverables.
    `;

        const response = await this.ai.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let text = response.response?.text?.();
        if (!text) {
            text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        }
        return text || '';
    }

    /**
     * Main entry point: Orchestrates the entire workflow.
     */
    async executeWorkflow(userRequest: string, onProgress?: (state: WorkflowState) => void): Promise<string> {
        // 1. Decompose
        const tasks = await this.decomposeTask(userRequest);
        const assignments = await this.assignAgents(tasks);

        const workflowState: WorkflowState = {
            id: crypto.randomUUID(),
            projectId: 'temp', // TODO: Pass actual project ID
            status: 'planning',
            tasks,
            currentTaskIndex: 0,
            results: [],
        };

        onProgress?.(workflowState);

        // 2. Execute (Sequential for now, TODO: Parallel based on dependencies)
        workflowState.status = 'executing';
        onProgress?.(workflowState);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const agent = assignments.get(task.id);

            if (!agent) {
                task.status = 'failed';
                task.output = "No agent assigned";
                continue;
            }

            task.status = 'in_progress';
            workflowState.currentTaskIndex = i;
            onProgress?.(workflowState);

            try {
                // Context includes previous outputs
                const context = tasks.filter(t => t.status === 'completed').map(t => t.output).join('\n\n');
                const output = await this.runAgentTask(task, agent, context);

                task.output = output;
                task.status = 'completed';
            } catch (e) {
                task.status = 'failed';
                task.output = `Error: ${e}`;
            }

            onProgress?.(workflowState);
        }

        // 3. Synthesize
        workflowState.status = 'reviewing';
        onProgress?.(workflowState);

        const finalResult = await this.synthesizeResults(userRequest, tasks);

        workflowState.status = 'completed';
        onProgress?.(workflowState);

        return finalResult;
    }
}

export const agencyService = new AgencyService();
