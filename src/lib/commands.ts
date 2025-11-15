import { Command, AgentName } from './types';

export const COMMANDS: Command[] = [
    // Project Management
    {
        name: 'plan',
        description: 'Generate a project plan or roadmap.',
        category: 'Project Management',
        agent: 'Planner',
        prompt: `Create a detailed plan for the following task: "{{task}}". Break it down into phases, identify dependencies, and suggest owners.`
    },
    {
        name: 'scope',
        description: 'Perform a deep analysis of an issue.',
        category: 'Project Management',
        agent: 'Deep Scope',
        prompt: `Perform a deep scope analysis for the following issue: "{{issue}}". Analyze the problem, its impact, and recommend an implementation path.`
    },
    {
        name: 'assign',
        description: 'Assign a task to a specific agent.',
        category: 'Project Management',
        agent: 'Orchestrator',
        prompt: `Assign the task "{{task}}" to the {{agent}} agent.`
    },
    {
        name: 'status',
        description: 'Get a status overview of the project.',
        category: 'Project Management',
        agent: 'Orchestrator',
        prompt: `Provide a status update on the current project.`
    },
    {
        name: 'review',
        description: 'Initiate a code review workflow.',
        category: 'Project Management',
        agent: 'Code',
        prompt: `Initiate a code review for "{{target}}". Focus on best practices and potential bugs.`
    },
    
    // Development
    {
        name: 'build',
        description: 'Implement a feature or fix.',
        category: 'Development',
        agent: 'Builder',
        prompt: `Build the following feature: "{{feature}}"`,
    },
    {
        name: 'test',
        description: 'Create and orchestrate tests for a feature.',
        category: 'Development',
        agent: 'Debug',
        prompt: `Create a test plan for the feature: "{{feature}}".`,
    },
    {
        name: 'refactor',
        description: 'Initiate a code refactoring workflow.',
        category: 'Development',
        agent: 'Code',
        prompt: `Refactor the following code or component: "{{target}}".`,
    },
    {
        name: 'debug',
        description: 'Start a debugging session for an issue.',
        category: 'Development',
        agent: 'Debug',
        prompt: `Debug the following issue: "{{issue}}".`,
    },

    // Utility
    {
        name: 'help',
        description: 'Discover available commands.',
        category: 'Utility',
        agent: 'Orchestrator',
        prompt: 'List all available slash commands with their descriptions.'
    },
];
