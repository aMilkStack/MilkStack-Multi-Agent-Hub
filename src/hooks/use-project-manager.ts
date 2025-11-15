'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import type { Agent, AgentStatus, Message, Project, Settings, Command, ProjectType, CodebaseFile } from '@/lib/types';
import { AGENTS as DEFAULT_AGENTS, getOrchestratorPrompt, MAX_AGENT_TURNS, MAX_ADVERSARY_REVIEWS, GITHUB_API_FILE_SIZE_LIMIT, IGNORE_PATTERNS } from '@/lib/agents';
import { COMMANDS } from '@/lib/commands';
import { getFromDb, saveToDb, deleteFromDb } from '@/lib/idb-storage';
import { analyzeCodebase, orchestrateConversation, generateResponse, enhancePrompt, getRepoTree } from '@/services/ai-service';

const SETTINGS_STORAGE_KEY = 'milkhub.settings';
const AGENTS_STORAGE_KEY = 'milkhub.agents';
const PROJECTS_STORAGE_KEY = 'milkhub.projects';
const ACTIVE_PROJECT_ID_STORAGE_KEY = 'milkhub.activeProjectId';
const CODEBASE_FILE_PREFIX = 'codefile:';

export function useProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    githubPat: '',
    aiModel: 'gemini-1.5-flash',
    globalRules: 'Always write code in TypeScript. Use functional components.',
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);


  // Load initial data from IndexedDB
  useEffect(() => {
    async function loadInitialData() {
      const savedSettings = await getFromDb<Settings>(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        setSettings(savedSettings);
      }

      const savedAgents = await getFromDb<Agent[]>(AGENTS_STORAGE_KEY);
      if (savedAgents) {
        const orchestratorPrompt = getOrchestratorPrompt(savedAgents);
        const mergedAgents = DEFAULT_AGENTS.map(defaultAgent => {
          const savedAgent = savedAgents.find(a => a.id === defaultAgent.id);
          return savedAgent ? { ...defaultAgent, ...savedAgent } : defaultAgent;
        });
        const finalAgents = mergedAgents.map(a => a.id === 'Orchestrator' ? {...a, prompt: orchestratorPrompt} : a);
        setAgents(finalAgents);
      } else {
        const initialAgents = DEFAULT_AGENTS.map(a => a.id === 'Orchestrator' ? {...a, prompt: getOrchestratorPrompt(DEFAULT_AGENTS)} : a);
        setAgents(initialAgents);
      }

      const savedProjects = await getFromDb<Project[]>(PROJECTS_STORAGE_KEY);
      const savedActiveProjectId = await getFromDb<string>(ACTIVE_PROJECT_ID_STORAGE_KEY);

      if (savedProjects && savedProjects.length > 0) {
        setProjects(savedProjects);
        if (savedActiveProjectId && savedProjects.some(p => p.id === savedActiveProjectId)) {
          setActiveProjectId(savedActiveProjectId);
        } else {
          setActiveProjectId(savedProjects[0].id);
        }
      } else {
         const orchestratorAgent = agents.find(a => a.name === 'Orchestrator') ?? DEFAULT_AGENTS.find(a => a.name === 'Orchestrator')!;
         const initialProject: Project = {
            id: `proj-${uuidv4()}`,
            name: `Welcome`,
            messages: [{
              id: uuidv4(),
              author: orchestratorAgent,
              content: 'Welcome to the MilkStack Multi-Agent Hub! Create a new project or type "/" to see available commands.',
              timestamp: new Date(),
            }],
            codebaseFilePaths: null,
          };
        setProjects([initialProject]);
        setActiveProjectId(initialProject.id);
      }
      setIsInitialized(true);
    }
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Save data to IndexedDB whenever it changes
  useEffect(() => {
    if (isInitialized) saveToDb(SETTINGS_STORAGE_KEY, settings);
  }, [settings, isInitialized]);

  useEffect(() => {
    if (isInitialized && agents.length > 0) {
        const orchestratorPrompt = getOrchestratorPrompt(agents);
        const updatedAgents = agents.map(a => a.id === 'Orchestrator' ? {...a, prompt: orchestratorPrompt} : a);
        saveToDb(AGENTS_STORAGE_KEY, updatedAgents);
    }
  }, [agents, isInitialized]);

  useEffect(() => {
    if (isInitialized) saveToDb(PROJECTS_STORAGE_KEY, projects);
  }, [projects, isInitialized]);

  useEffect(() => {
    if (isInitialized) saveToDb(ACTIVE_PROJECT_ID_STORAGE_KEY, activeProjectId);
  }, [activeProjectId, isInitialized]);


  const activeProject = projects.find(p => p.id === activeProjectId);
  const agentStatuses = Object.fromEntries(agents.map(agent => [agent.name, agent.status])) as Record<string, AgentStatus>;

  const updateMessages = useCallback((updater: (messages: Message[]) => Message[]) => {
    if (!activeProjectId) return;
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId ? { ...p, messages: updater(p.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))) } : p
      )
    );
  }, [activeProjectId]);
  
  const updateProjectState = useCallback((projectId: string, updates: Partial<Project>) => {
      setProjects(prevProjects =>
          prevProjects.map(p =>
              p.id === projectId ? { ...p, ...updates } : p
          )
      );
  }, []);

  const getCodebaseContext = useCallback(async (projectId: string): Promise<string | undefined> => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.codebaseFilePaths) {
        return undefined;
    }

    let context = 'VIRTUAL FILE TREE:\n\n';

    for (const path of project.codebaseFilePaths) {
        const content = await getFromDb<string>(`${CODEBASE_FILE_PREFIX}${path}`);
        if (content) {
            context += `--- FILE: ${path} ---\n`;
            context += `${content}\n\n`;
        }
    }
    return context;
  }, [projects]);


  const runAgentConversation = useCallback(async (initialMessages: Message[], signal: AbortSignal) => {
    let currentMessages = initialMessages;
    let turns = 0;
    
    // Check if the last user message is affirmative to reset the counter
    const lastUserMessage = [...initialMessages].reverse().find(m => m.author === 'user');
    if (activeProject && lastUserMessage && ['yes', 'y', 'continue'].includes(lastUserMessage.content.toLowerCase().trim())) {
         if (activeProject.adversaryReviewCount && activeProject.adversaryReviewCount >= MAX_ADVERSARY_REVIEWS) {
            updateProjectState(activeProject.id, { adversaryReviewCount: 0 });
        }
    }
    
    let adversaryReviewCount = activeProject?.adversaryReviewCount ?? 0;

    setIsTyping(true);
    while (turns < MAX_AGENT_TURNS) {
        if (signal.aborted) {
          console.log('Conversation aborted.');
          break;
        }

        turns++;
        try {
            const orchestrationResult = await orchestrateConversation({
                messages: currentMessages,
                globalRules: settings.globalRules,
                agents,
            });

            if (orchestrationResult.reasoning) {
                const reasoningMessage: Message = {
                    id: uuidv4(),
                    author: agents.find(a => a.name === 'Orchestrator')!,
                    content: `*Reasoning: ${orchestrationResult.reasoning}*`,
                    timestamp: new Date(),
                };
                currentMessages = [...currentMessages, reasoningMessage];
                updateMessages(() => currentMessages);
            }

            const nextAgentName = orchestrationResult.nextAgent;

            if (nextAgentName === 'WAIT_FOR_USER') {
                break;
            }
            
            if (nextAgentName === 'Adversary') {
                adversaryReviewCount++;
                if(activeProject) {
                    updateProjectState(activeProject.id, { adversaryReviewCount });
                }
                
                if (adversaryReviewCount >= MAX_ADVERSARY_REVIEWS) {
                    console.warn('Adversary review limit trigger. Prompting user.');
                    const promptMessage: Message = {
                        id: uuidv4(),
                        author: agents.find(a => a.name === 'Orchestrator')!,
                        content: `The Adversary has reviewed this ${adversaryReviewCount} times. The team may be stuck in a loop. Would you like to continue the review cycle? (yes/no)`,
                        timestamp: new Date(),
                    };
                    updateMessages(prev => [...prev, promptMessage]);
                    break; 
                }
            }


            const agent = agents.find(a => a.name === nextAgentName);
            if (!agent) {
                console.error(`Orchestrator selected an invalid agent: ${nextAgentName}`);
                toast({ variant: "destructive", title: "Orchestration Error", description: `An invalid agent ("${nextAgentName}") was selected.` });
                break;
            }

            const codebaseContext = activeProject ? await getCodebaseContext(activeProject.id) : undefined;
            
            const agentMessageId = uuidv4();
            const placeholderMessage: Message = {
                id: agentMessageId,
                author: agent,
                content: '',
                timestamp: new Date(),
                isTyping: true,
            };
            currentMessages = [...currentMessages, placeholderMessage];
            updateMessages(() => currentMessages);

            const { stream } = await generateResponse({
                agentId: agent.id,
                messages: currentMessages.slice(0, -1),
                codebaseContext,
                globalRules: settings.globalRules,
                agents,
                signal,
            });
            
            let finalResponse = '';
            for await (const chunk of stream) {
                 if (signal.aborted) {
                    finalResponse += '... (Stopped by user)';
                    break;
                }
                finalResponse += chunk;
                updateMessages(prevMessages =>
                    prevMessages.map(msg =>
                        msg.id === agentMessageId
                            ? { ...msg, content: finalResponse, isTyping: true }
                            : msg
                    )
                );
            }

            const finalMessage: Message = {
                id: agentMessageId,
                author: agent,
                content: finalResponse,
                timestamp: new Date(),
                isTyping: false
            };
            
            currentMessages = currentMessages.map(msg => msg.id === agentMessageId ? finalMessage : msg);
            updateMessages(() => currentMessages);


        } catch (error: any) {
            if (error.name !== 'AbortError') {
              console.error("Error during agent conversation:", error);
              const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
              toast({ variant: "destructive", title: "Conversation Error", description: errorMessage });
            }
            break;
        }
    }
    if (turns === MAX_AGENT_TURNS) {
        console.warn("Reached max agent turns.");
    }
    setIsTyping(false);
    abortControllerRef.current = null;
  }, [agents, settings.globalRules, activeProject, updateMessages, toast, updateProjectState, getCodebaseContext]);

  const handleCommand = useCallback(async (command: Command, commandContent: string) => {
    if (!activeProject) return;
    if (abortControllerRef.current) return;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const fullCommand = `/${command.name} ${commandContent}`;
    const userMessage: Message = { id: uuidv4(), author: 'user', content: fullCommand, timestamp: new Date() };

    const currentMessages = [...activeProject.messages, userMessage];
    updateMessages(() => currentMessages);
    await runAgentConversation(currentMessages, signal);
}, [activeProject, runAgentConversation, updateMessages]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeProject) return;
    if (abortControllerRef.current) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const commandMatch = content.match(/^\/(\w+)\s*(.*)/);
    if (commandMatch) {
        const [, commandName, commandContent] = commandMatch;
        const command = COMMANDS.find(c => c.name === commandName);
        if (command) {
            await handleCommand(command, commandContent);
            return;
        }
    }
    
    const userMessage: Message = { id: uuidv4(), author: 'user', content, timestamp: new Date() };
    
    try {
        setIsTyping(true);
        const enhancedPlan = await enhancePrompt({ raw_user_prompt: content });
        setIsTyping(false);
        console.log("Enhanced Prompt Plan:", enhancedPlan);

        const currentMessages = [...activeProject.messages, userMessage];
        updateMessages(() => currentMessages);
        await runAgentConversation(currentMessages, signal);

    } catch (error: any) {
        setIsTyping(false);
        if (error.name !== 'AbortError') {
          console.error("Error enhancing prompt:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ variant: "destructive", title: "Planning Error", description: `Could not generate execution plan: ${errorMessage}` });
        }
        
        const currentMessages = [...activeProject.messages, userMessage];
        updateMessages(() => currentMessages);
        await runAgentConversation(currentMessages, signal);
    }
    
  }, [activeProject, agents, runAgentConversation, toast, updateMessages, handleCommand]);

  const handleNewProject = useCallback(async (name: string, type: ProjectType, githubUrl?: string) => {
    const newProject: Project = { id: `proj-${uuidv4()}`, name, messages: [], codebaseFilePaths: null, githubUrl, adversaryReviewCount: 0 };
    
    let initialMessages: Message[] = [];
    const codebaseFilePaths: string[] = [];
    let shouldStartConversation = false;

    setIsTyping(true);

    if (githubUrl) {
      const analysisMessage: Message = {
        id: uuidv4(),
        author: agents.find(a => a.name === 'Orchestrator')!,
        content: `Analyzing the repository at ${githubUrl}...`,
        timestamp: new Date(),
      };
      initialMessages.push(analysisMessage);
      
      try {
        const repoTree = await getRepoTree(githubUrl, settings);

        // getRepoTree already filters to blob files only
        for (const file of repoTree) {
            await saveToDb(`${CODEBASE_FILE_PREFIX}${file.path}`, file.content);
            codebaseFilePaths.push(file.path);
        }
        
        newProject.codebaseFilePaths = codebaseFilePaths;
        
        setProjects(prev => [...prev, newProject]);
        const codebaseContext = await getCodebaseContext(newProject.id);
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
          content: `I'm starting a new project called "${name}". Let's begin the full development cycle.`,
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
    };
    
    setProjects(prev => prev.map(p => p.id === finalProject.id ? finalProject : p));
    setActiveProjectId(finalProject.id);

    setIsTyping(false);

    if (shouldStartConversation) {
        abortControllerRef.current = new AbortController();
        await runAgentConversation(initialMessages, abortControllerRef.current.signal);
    }

  }, [agents, settings, runAgentConversation, getCodebaseContext]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) return;

    if (projectToDelete.codebaseFilePaths) {
      for (const path of projectToDelete.codebaseFilePaths) {
        await deleteFromDb(`${CODEBASE_FILE_PREFIX}${path}`);
      }
    }

    const remainingProjects = projects.filter(p => p.id !== projectId);
    setProjects(remainingProjects);

    if (activeProjectId === projectId) {
      const newActiveId = remainingProjects.length > 0 ? remainingProjects[0].id : null;
      setActiveProjectId(newActiveId);
    }

    toast({ title: 'Project Deleted', description: `Project "${projectToDelete.name}" has been deleted.` });
  }, [projects, activeProjectId, toast]);

  const handleExportProject = useCallback(async () => {
    if (!activeProject) {
        toast({ variant: 'destructive', title: 'Export Failed', description: 'No active project selected.' });
        return;
    }
    try {
        const projectToExport = { ...activeProject };
        const codebaseFiles: { [path: string]: string } = {};

        if (projectToExport.codebaseFilePaths) {
            for (const path of projectToExport.codebaseFilePaths) {
                const content = await getFromDb<string>(`${CODEBASE_FILE_PREFIX}${path}`);
                if (content) {
                    codebaseFiles[path] = content;
                }
            }
        }

        const exportData = {
            project: projectToExport,
            codebase: codebaseFiles,
            settings,
            agents
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `milkhub_project_${projectToExport.name.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Export Successful', description: `Project "${projectToExport.name}" has been exported.` });
    } catch (error) {
        console.error("Failed to export project:", error);
        toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not export project data.' });
    }
}, [activeProject, agents, settings, toast]);

const handleImportProject = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                throw new Error("File content is not valid.");
            }
            const data = JSON.parse(result);
            
            if (!data.project || !data.codebase || !data.settings || !data.agents) {
                throw new Error("Invalid project file format.");
            }

            const importedProject: Project = data.project;

            for (const path in data.codebase) {
                await saveToDb(`${CODEBASE_FILE_PREFIX}${path}`, data.codebase[path]);
            }
            
            setSettings(data.settings);
            setAgents(data.agents);
            setProjects(prev => [...prev, importedProject]);
            setActiveProjectId(importedProject.id);

            toast({ title: 'Import Successful', description: `Project "${importedProject.name}" has been imported.` });

        } catch (error) {
            console.error("Failed to import project:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Import Failed', description: `Could not parse project file: ${message}` });
        }
    };
    reader.readAsText(file);
}, [toast]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('Stop generation requested.');
    }
  }, []);

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
    handleExportProject,
    handleImportProject,
    handleDeleteProject,
    handleStopGeneration,
  };
}
