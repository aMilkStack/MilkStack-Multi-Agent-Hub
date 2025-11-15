'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import type { Agent, AgentStatus, Message, Project, Settings, Command, ProjectType } from '@/lib/types';
import { AGENTS as DEFAULT_AGENTS, MAX_AGENT_TURNS } from '@/lib/agents';
import { COMMANDS } from '@/lib/commands';
import { loadFromLocalStorage, saveToLocalStorage } from '@/lib/local-storage';
import { analyzeCodebase, getRepoTree, orchestrateConversation, generateResponse } from '@/services/ai-service';

const SETTINGS_STORAGE_KEY = 'milkhub.settings';
const AGENTS_STORAGE_KEY = 'milkhub.agents';

export function useProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    githubPat: '',
    aiModel: 'gemini-2.5-flash',
    globalRules: 'Always write code in TypeScript. Use functional components.',
  });
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const { toast } = useToast();

  useEffect(() => {
    const savedSettings = loadFromLocalStorage<Settings>(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      setSettings(savedSettings);
    }
    
    const savedAgents = loadFromLocalStorage<Agent[]>(AGENTS_STORAGE_KEY);
    if (savedAgents) {
      // Merge saved agents with defaults, but keep default prompts to ensure they are up-to-date.
      const mergedAgents = DEFAULT_AGENTS.map(defaultAgent => {
        const savedAgent = savedAgents.find(a => a.id === defaultAgent.id);
        if (savedAgent) {
          // Return the saved agent, but overwrite its prompt with the default one.
          return { ...savedAgent, prompt: defaultAgent.prompt };
        }
        return defaultAgent;
      });
      setAgents(mergedAgents);
    } else {
      setAgents(DEFAULT_AGENTS);
    }
  }, []);

  useEffect(() => {
    saveToLocalStorage(SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  useEffect(() => {
    saveToLocalStorage(AGENTS_STORAGE_KEY, agents);
  }, [agents]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const agentStatuses = Object.fromEntries(agents.map(agent => [agent.name, agent.status])) as Record<string, AgentStatus>;

  const updateMessages = useCallback((updater: (messages: Message[]) => Message[]) => {
    if (!activeProjectId) return;
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId ? { ...p, messages: updater(p.messages) } : p
      )
    );
  }, [activeProjectId]);

  const runAgentConversation = useCallback(async (initialMessages: Message[]) => {
    let currentMessages = initialMessages;
    let turns = 0;
    
    setIsTyping(true);
    // The orchestration loop starts here
    while (turns < MAX_AGENT_TURNS) {
        turns++;
        try {
            // Step 1: Call the Orchestrator
            const orchestrationResult = await orchestrateConversation({
                messages: currentMessages,
                globalRules: settings.globalRules,
                agents,
            });

            const nextAgentName = orchestrationResult.nextAgent;

            // Step 2: Parse the Decision
            if (nextAgentName === 'WAIT_FOR_USER') {
                break; // Exit the loop
            }

            const agent = agents.find(a => a.name === nextAgentName);
            if (!agent) {
                console.error(`Orchestrator selected an invalid agent: ${nextAgentName}`);
                toast({ variant: "destructive", title: "Orchestration Error", description: `An invalid agent ("${nextAgentName}") was selected.` });
                break;
            }

            // Step 3: Execute the Action
            const codebaseContext = activeProject?.codebase ? JSON.stringify(activeProject.codebase, null, 2).slice(0, 100000) : undefined;
            
            const responseResult = await generateResponse({
                agentId: agent.id,
                messages: currentMessages,
                codebaseContext,
                globalRules: settings.globalRules,
                agents,
            });

            const agentMessage: Message = {
                id: uuidv4(),
                author: agent,
                content: responseResult.response,
                timestamp: new Date(),
            };
            
            // Add the specialist's response to the history and update UI
            currentMessages = [...currentMessages, agentMessage];
            updateMessages(() => currentMessages);

        } catch (error) {
            console.error("Error during agent conversation:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Conversation Error", description: errorMessage });
            break; // Exit loop on error
        }
    }
    if (turns === MAX_AGENT_TURNS) {
        console.warn("Reached max agent turns.");
    }
    setIsTyping(false);
  }, [agents, settings.globalRules, activeProject?.codebase, updateMessages, toast]);

  const handleCommand = useCallback(async (command: Command, commandContent: string, currentMessages: Message[]) => {
    const prompt = command.prompt
      .replace('{{task}}', commandContent)
      .replace('{{issue}}', commandContent)
      .replace('{{feature}}', commandContent)
      .replace('{{target}}', commandContent);

    const agent = agents.find(a => a.name === command.agent);
    if (!agent) {
      toast({ variant: 'destructive', title: 'Command Error', description: `Agent "${command.agent}" not found.` });
      return;
    }

    const commandMessage: Message = { id: uuidv4(), author: agent, content: prompt, timestamp: new Date() };
    const updatedMessages = [...currentMessages, commandMessage];
    updateMessages(() => updatedMessages);
    
    // After issuing a direct command to an agent, start the orchestration loop
    await runAgentConversation(updatedMessages);

  }, [agents, runAgentConversation, toast, updateMessages]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeProject) return;

    const userMessage: Message = { id: uuidv4(), author: 'user', content, timestamp: new Date() };
    let currentMessages = [...activeProject.messages, userMessage];
    updateMessages(() => currentMessages);
    
    if (content.startsWith('/')) {
      const parts = content.split(' ');
      const commandName = parts[0].substring(1);
      const command = COMMANDS.find(c => c.name === commandName);
      
      if (command) {
        const commandContent = parts.slice(1).join(' ');
        await handleCommand(command, commandContent, currentMessages);
      } else {
        toast({ variant: 'destructive', title: 'Unknown Command', description: `Command "/${commandName}" not found.` });
      }
    } else {
      // For regular messages, just start the orchestration loop
      await runAgentConversation(currentMessages);
    }
  }, [activeProject, handleCommand, runAgentConversation, toast, updateMessages]);

  const handleNewProject = useCallback(async (name: string, type: ProjectType, githubUrl?: string) => {
    const newProject: Project = { id: `proj-${uuidv4()}`, name, messages: [], codebase: null, githubUrl };
    
    let initialMessages: Message[] = [];
    let initialCodebase: any = null;
    let shouldStartConversation = false;

    if (githubUrl) {
      const analysisMessage: Message = {
        id: uuidv4(),
        author: agents.find(a => a.name === 'Orchestrator')!,
        content: `Analyzing the repository at ${githubUrl}...`,
        timestamp: new Date(),
      };
      initialMessages.push(analysisMessage);
      
      try {
        initialCodebase = await getRepoTree(githubUrl, settings);
        const codebaseContext = JSON.stringify(initialCodebase, null, 2).slice(0, 100000);
        const result = await analyzeCodebase({ codebaseContext, globalRules: settings.globalRules });

        const reportMessage: Message = {
          id: uuidv4(),
          author: agents.find(a => a.name === 'Guardian')!,
          content: `Initial analysis complete for ${githubUrl}:\n\n${result.analysisReport}`,
          timestamp: new Date(),
        };
        initialMessages.push(reportMessage);
      } catch (error) {
        console.error("Failed to analyze codebase:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorToast: Message = {
          id: uuidv4(),
          author: agents.find(a => a.name === 'Orchestrator')!,
          content: `Sorry, I was unable to analyze the repository: ${errorMessage}`,
          timestamp: new Date(),
        };
        initialMessages.push(errorToast);
      }
    }
    
    if (type === 'new_cycle') {
        const cycleStartMessage: Message = {
          id: uuidv4(),
          author: 'user',
          content: `Let's start the development cycle for the new project: "${name}". Begin with Phase 1: Discovery & Requirements, starting with the Market agent.`,
          timestamp: new Date()
        };
        initialMessages.push(cycleStartMessage);
        shouldStartConversation = true;
    } else {
        const welcomeMessage: Message = {
            id: uuidv4(),
            author: agents.find(a => a.name === 'Orchestrator')!,
            content: `Codebase for "${name}" has been loaded. What would you like to work on? You can ask a question, request a feature, or use a command.`,
            timestamp: new Date()
        };
        initialMessages.push(welcomeMessage);
    }
    
    const finalProject: Project = {
      ...newProject,
      messages: initialMessages,
      codebase: initialCodebase,
    };
    
    setProjects(prev => [...prev, finalProject]);
    setActiveProjectId(finalProject.id);

    if (shouldStartConversation) {
        runAgentConversation(finalProject.messages);
    }

  }, [agents, settings, runAgentConversation]);
  
  useEffect(() => {
    if (projects.length === 0 && agents.length > 0) {
      const orchestrator = agents.find(a => a.name === 'Orchestrator');
      const initialProject: Project = {
        id: `proj-${uuidv4()}`,
        name: `Welcome`,
        messages: orchestrator ? [{
          id: uuidv4(),
          author: orchestrator,
          content: 'Welcome to the MilkStack Multi-Agent Hub! Create a new project or type "/" to see available commands.',
          timestamp: new Date(),
        }] : [],
        codebase: null,
      };
      setProjects([initialProject]);
      setActiveProjectId(initialProject.id);
    }
  }, [projects.length, agents]);

  return {
    projects,
    activeProjectId,
    agents,
    settings,
    isTyping,
    activeProject,
    agentStatuses,
    handleNewProject,
    handleSendMessage,
    setActiveProjectId,
    setAgents: (newAgents: Agent[] | ((prev: Agent[]) => Agent[])) => setAgents(newAgents),
    setSettings: (newSettings: Settings | ((prev: Settings) => Settings)) => setSettings(newSettings),
  };
}
