import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './src/components/Sidebar';
import ChatView from './src/components/ChatView';
import NewProjectModal from './src/components/modals/NewProjectModal';
import SettingsModal from './src/components/modals/SettingsModal';
import { Project, Settings, Message, Agent } from './types';
import * as projectService from './src/services/projectService';
import { getAgentResponse } from './src/services/geminiService';
import { processCodebase } from './src/utils/codebaseProcessor';
import { AGENT_PROFILES } from './constants';
import { MessageInputHandle } from './src/components/MessageInput';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const [settings, setSettings] = useState<Settings>({
    githubPat: '',
    globalRules: '',
    model: 'gemini-2.5-flash',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Load initial data from localStorage
  useEffect(() => {
    const loadedProjects = projectService.loadProjects();
    const loadedSettings = projectService.loadSettings();
    setProjects(loadedProjects);
    if (loadedSettings) {
      setSettings(loadedSettings);
    }
    if (loadedProjects.length > 0 && !activeProjectId) {
      setActiveProjectId(loadedProjects[0].id);
    }
  }, []);

  // Save projects whenever they change
  useEffect(() => {
    projectService.saveProjects(projects);
  }, [projects]);

  // Save settings whenever they change
  useEffect(() => {
    projectService.saveSettings(settings);
  }, [settings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K: New project
      if (modKey && e.key === 'k') {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
      }

      // Cmd/Ctrl + /: Focus message input
      if (modKey && e.key === '/') {
        e.preventDefault();
        messageInputRef.current?.focus();
      }

      // Escape: Close modals or cancel loading
      if (e.key === 'Escape') {
        if (isNewProjectModalOpen) {
          setIsNewProjectModalOpen(false);
        } else if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
        }
        // Note: We can't cancel an ongoing API request without more infrastructure
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewProjectModalOpen, isSettingsModalOpen]);

  const handleCreateProject = useCallback((projectName: string, codebaseContext: string) => {
    const newProject = projectService.createProject({
      name: projectName,
      messages: [],
      codebaseContext: codebaseContext,
    });
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setIsNewProjectModalOpen(false);
    toast.success(`Project "${projectName}" created successfully!`);
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
  }, []);
  
  const handleAddContext = useCallback(async (files: File[]) => {
    if (!activeProjectId) return;
    
    // You could add a loading indicator here specifically for context processing
    const context = await processCodebase(files);
    
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId ? { ...p, codebaseContext: context } : p
      )
    );
    // Optionally, you can add a system message to the chat indicating context was updated
  }, [activeProjectId]);


  const handleSaveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    setIsSettingsModalOpen(false);
  }, []);

  const handleUpdateMessage = useCallback((chunk: string) => {
    setProjects(prevProjects =>
      prevProjects.map(p => {
        if (p.id === activeProjectId) {
          const lastMessage = p.messages[p.messages.length - 1];
          if (lastMessage && typeof lastMessage.author !== 'string') {
            const updatedLastMessage = { ...lastMessage, content: lastMessage.content + chunk };
            return { ...p, messages: [...p.messages.slice(0, -1), updatedLastMessage] };
          }
        }
        return p;
      })
    );
  }, [activeProjectId]);

  const handleNewMessage = useCallback((message: Message) => {
      setProjects(prev => prev.map(p => 
        p.id === activeProjectId 
        ? { ...p, messages: [...p.messages, message] } 
        : p
      ));
  }, [activeProjectId]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeProjectId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      author: 'Ethan',
      content,
      timestamp: new Date(),
    };

    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId
          ? { ...p, messages: [...p.messages, userMessage] }
          : p
      )
    );
    setIsLoading(true);
    setActiveAgentId(null);

    try {
      const activeProject = projects.find(p => p.id === activeProjectId);
      if (activeProject) {
        // The message history for the service call should include the new user message
        const fullHistory = [...activeProject.messages, userMessage];
        
        const onAgentChange = (agentId: string | null) => {
          setActiveAgentId(agentId);
        };

        await getAgentResponse(
          fullHistory,
          activeProject.codebaseContext,
          handleNewMessage,
          handleUpdateMessage,
          onAgentChange
        );
      }
    } catch (error) {
      console.error("Error getting agent response:", error);
      toast.error(error instanceof Error ? error.message : 'Failed to get agent response');
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        author: { name: 'System', avatar: '!', color: '#ef4444', id: 'system-error', description: '', prompt: '', status: 'active' } as Agent,
        content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
      setProjects(prevProjects =>
        prevProjects.map(p =>
          p.id === activeProjectId
            ? { ...p, messages: [...p.messages, errorMessage] }
            : p
        )
      );
    } finally {
      setIsLoading(false);
      setActiveAgentId(null);
    }
  }, [activeProjectId, projects, handleNewMessage, handleUpdateMessage]);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const activeAgent = AGENT_PROFILES.find(a => a.id === activeAgentId) || null;

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <div className="flex h-screen bg-milk-darkest text-milk-lightest font-sans antialiased">
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onNewProjectClick={() => setIsNewProjectModalOpen(true)}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
          activeAgentId={activeAgentId}
        />
        <ChatView
          ref={messageInputRef}
          activeProject={activeProject}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onAddContext={handleAddContext}
          activeAgent={activeAgent}
        />
      </div>

      {isNewProjectModalOpen && (
        <NewProjectModal
          onClose={() => setIsNewProjectModalOpen(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleSaveSettings}
          initialSettings={settings}
        />
      )}
    </>
  );
};

export default App;