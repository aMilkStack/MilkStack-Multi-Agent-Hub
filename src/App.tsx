import React, { useState, useEffect, useCallback } from 'react';
import { Message, Agent, Model, AgentStatus, AgentName, Project } from './types';
import { AGENTS, MODELS } from './constants';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import SettingsModal from './components/SettingsModal';
import NewProjectModal from './components/NewProjectModal';
import { getAgentResponse } from './services/geminiService';
import { loadProjects, saveProjects } from './services/projectService';


const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  useEffect(() => {
    const savedProjects = loadProjects();
    if (savedProjects.length > 0) {
      setProjects(savedProjects);
      setActiveProjectId(savedProjects[0].id);
    } else {
      const defaultProject: Project = {
        id: `proj-${Date.now()}`,
        title: 'Welcome to MilkStack',
        description: 'Your collaborative AI hub. Create a new project to get started!',
        codebaseContext: null,
        messages: [
          {
            id: 'init-1',
            sender: 'Orchestrator',
            text: "Initializing multi-agent workflow. I'll coordinate the task distribution across all staff. How can I help you today, Ethan?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]
      };
      setProjects([defaultProject]);
      setActiveProjectId(defaultProject.id);
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      saveProjects(projects);
    }
  }, [projects]);


  const updateAgentStatus = useCallback((agentName: AgentName, status: AgentStatus) => {
    setAgents(prevAgents =>
      prevAgents.map(agent =>
        agent.name === agentName ? { ...agent, status } : agent
      )
    );
  }, []);
  
  const handleCreateProject = (newProject: Omit<Project, 'id' | 'messages'>) => {
    const project: Project = {
      ...newProject,
      id: `proj-${Date.now()}`,
      messages: [
         {
            id: 'init-1',
            sender: 'Orchestrator',
            text: `Project "${newProject.title}" initialized. The codebase context has been loaded. I'm ready to assist.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
      ]
    };
    const newProjects = [...projects, project];
    setProjects(newProjects);
    setActiveProjectId(project.id);
    setIsNewProjectModalOpen(false);
  };
  
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    setIsLoading(true);

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: 'Ethan',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedProject = { ...activeProject, messages: [...activeProject.messages, userMessage] };
    const updatedProjects = projects.map(p => p.id === activeProjectId ? updatedProject : p);
    setProjects(updatedProjects);
    
    const messageForApi = activeProject.codebaseContext 
        ? `CODEBASE CONTEXT:\n---\n${activeProject.codebaseContext}\n---\n\nMY PROMPT: ${text}` 
        : text;

    const messagesForApi = [
        ...activeProject.messages,
        { ...userMessage, text: messageForApi }
    ];

    try {
      const agentResponses = await getAgentResponse(messagesForApi, selectedModel);
      
      const addMessagesSequentially = (messagesToAdd: Message[]) => {
          if (messagesToAdd.length === 0) {
              setIsLoading(false);
              return;
          }
          
          const [nextMessage, ...rest] = messagesToAdd;
          const agentName = nextMessage.sender as AgentName;

          updateAgentStatus(agentName, 'active');
          
          setTimeout(() => {
            setProjects(prevProjects => prevProjects.map(p => {
              if (p.id === activeProjectId) {
                return { ...p, messages: [...p.messages, nextMessage] };
              }
              return p;
            }));
            
            setTimeout(() => {
                updateAgentStatus(agentName, 'idle');
                setTimeout(() => addMessagesSequentially(rest), 700);
            }, 1500);

          }, 1000);
      };

      addMessagesSequentially(agentResponses);

    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        sender: 'Orchestrator',
        text: 'Sorry, there was an error connecting to the AI service. Please check your API key and network connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return { ...p, messages: [...p.messages, errorMessage] };
        }
        return p;
      }));
      setIsLoading(false);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex h-screen w-screen bg-brand-bg text-brand-text font-sans">
      <Sidebar 
        agents={agents} 
        onSettingsClick={() => setIsSettingsOpen(true)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateNewProject={() => setIsNewProjectModalOpen(true)}
      />
      {activeProject ? (
          <ChatView
            key={activeProject.id} // Re-mounts chat view on project change
            project={activeProject}
            messages={activeProject.messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
      ) : (
        <div className="w-3/4 h-full flex items-center justify-center bg-brand-bg-dark">
            <p>Select or create a project to begin.</p>
        </div>
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <NewProjectModal 
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onSave={handleCreateProject}
      />
    </div>
  );
};

export default App;
