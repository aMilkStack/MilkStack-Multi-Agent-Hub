import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './src/components/Sidebar';
import ChatView from './src/components/ChatView';
import NewProjectModal from './src/components/modals/NewProjectModal';
import SettingsModal from './src/components/modals/SettingsModal';
import KeyboardShortcutsModal from './src/components/modals/KeyboardShortcutsModal';
import { Project, Settings, Message, Agent } from './types';
import * as indexedDbService from './src/services/indexedDbService';
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
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ? key - Show keyboard shortcuts
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        // Only trigger if not in an input/textarea
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsKeyboardShortcutsOpen(true);
        }
      }

      // Cmd/Ctrl + K - Focus message input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        messageInputRef.current?.focus();
      }

      // Cmd/Ctrl + N - New project
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
      }

      // Cmd/Ctrl + S - Settings
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Load initial data from IndexedDB and migrate from localStorage if needed
  useEffect(() => {
    const loadData = async () => {
      // First, attempt migration from localStorage
      await indexedDbService.migrateFromLocalStorage();

      // Load projects and settings
      const loadedProjects = await indexedDbService.loadProjects();
      const loadedSettings = await indexedDbService.loadSettings();

      setProjects(loadedProjects);
      if (loadedSettings) {
        setSettings(loadedSettings);
      }
      if (loadedProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(loadedProjects[0].id);
      }
    };

    loadData().catch(error => {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load projects from storage');
    });
  }, []);

  // Save projects whenever they change
  useEffect(() => {
    if (projects.length > 0) {
      indexedDbService.saveProjects(projects).catch(error => {
        console.error('Failed to save projects:', error);
        toast.error('Failed to save projects to storage');
      });
    }
  }, [projects]);

  // Save settings whenever they change
  useEffect(() => {
    indexedDbService.saveSettings(settings).catch(error => {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    });
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
    const newProject = indexedDbService.createProject({
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

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message content and truncate everything after it
    const updatedMessages = activeProject.messages.slice(0, messageIndex);
    const editedMessage: Message = {
      ...activeProject.messages[messageIndex],
      content: newContent,
      timestamp: new Date(),
    };
    const newHistory = [...updatedMessages, editedMessage];

    // Update the project with the new message history
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId
          ? { ...p, messages: newHistory }
          : p
      )
    );

    // Trigger a new agent response
    setIsLoading(true);
    setActiveAgentId(null);

    try {
      const onAgentChange = (agentId: string | null) => {
        setActiveAgentId(agentId);
      };

      await getAgentResponse(
        newHistory,
        activeProject.codebaseContext,
        handleNewMessage,
        handleUpdateMessage,
        onAgentChange
      );
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

  const handleResendFromMessage = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Truncate messages after this one (inclusive of responses)
    const truncatedMessages = activeProject.messages.slice(0, messageIndex + 1);

    // Update the project with the truncated history
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId
          ? { ...p, messages: truncatedMessages }
          : p
      )
    );

    // Trigger a new agent response
    setIsLoading(true);
    setActiveAgentId(null);

    try {
      const onAgentChange = (agentId: string | null) => {
        setActiveAgentId(agentId);
      };

      await getAgentResponse(
        truncatedMessages,
        activeProject.codebaseContext,
        handleNewMessage,
        handleUpdateMessage,
        onAgentChange
      );
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

  const handleRegenerateResponse = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove this message (the last agent response) and regenerate
    const truncatedMessages = activeProject.messages.slice(0, messageIndex);

    // Update the project
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === activeProjectId
          ? { ...p, messages: truncatedMessages }
          : p
      )
    );

    // Trigger a new agent response
    setIsLoading(true);
    setActiveAgentId(null);

    try {
      const onAgentChange = (agentId: string | null) => {
        setActiveAgentId(agentId);
      };

      await getAgentResponse(
        truncatedMessages,
        activeProject.codebaseContext,
        handleNewMessage,
        handleUpdateMessage,
        onAgentChange
      );
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

  const handleExportProjects = useCallback(async () => {
    try {
      const jsonData = await indexedDbService.exportProjects();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `milkstack-projects-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Projects exported successfully!');
    } catch (error) {
      console.error('Failed to export projects:', error);
      toast.error('Failed to export projects');
    }
  }, []);

  const handleImportProjects = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      await indexedDbService.importProjects(text);

      // Reload projects from IndexedDB
      const loadedProjects = await indexedDbService.loadProjects();
      setProjects(loadedProjects);

      toast.success('Projects imported successfully!');
    } catch (error) {
      console.error('Failed to import projects:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import projects');
    }
  }, []);

  const handleRenameProject = useCallback(async (id: string, newName: string) => {
    try {
      setProjects(prevProjects =>
        prevProjects.map(p =>
          p.id === id ? { ...p, name: newName, updatedAt: new Date() } : p
        )
      );
      toast.success('Project renamed!');
    } catch (error) {
      console.error('Failed to rename project:', error);
      toast.error('Failed to rename project');
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await indexedDbService.deleteProject(id);
      setProjects(prevProjects => prevProjects.filter(p => p.id !== id));

      // If we deleted the active project, switch to another one
      if (activeProjectId === id) {
        const remainingProjects = projects.filter(p => p.id !== id);
        setActiveProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
      }

      toast.success('Project deleted');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  }, [activeProjectId, projects]);

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
          onExportProjects={handleExportProjects}
          onImportProjects={handleImportProjects}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
        />
        <ChatView
          ref={messageInputRef}
          activeProject={activeProject}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onAddContext={handleAddContext}
          activeAgent={activeAgent}
          onEditMessage={handleEditMessage}
          onResendFromMessage={handleResendFromMessage}
          onRegenerateResponse={handleRegenerateResponse}
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

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />
    </>
  );
};

export default App;