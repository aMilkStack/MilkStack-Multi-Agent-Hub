import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './src/components/Sidebar';
import ChatView from './src/components/ChatView';
import NewProjectModal from './src/components/modals/NewProjectModal';
import SettingsModal from './src/components/modals/SettingsModal';
import ProjectSettingsModal from './src/components/modals/ProjectSettingsModal';
import KeyboardShortcutsModal from './src/components/modals/KeyboardShortcutsModal';
import RustyChatModal from './src/components/modals/RustyChatModal';
import { Project, Settings, Message, Agent, AgentProposedChanges } from './types';
import * as indexedDbService from './src/services/indexedDbService';
import { getAgentResponse } from './src/services/geminiService';
import { commitToGitHub, extractRepoInfo, fetchGitHubRepository } from './src/services/githubService';
import { processCodebase } from './src/utils/codebaseProcessor';
import { AGENT_PROFILES } from './constants';
import { MessageInputHandle } from './src/components/MessageInput';
import { initializeRustyPortable, invokeRustyPortable, rustyLogger, LogLevel } from './src/services/rustyPortableService';
import { RUSTY_GLOBAL_CONFIG, getRustyGitHubToken, getRustyRepoUrl } from './src/config/rustyConfig';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    rustyApiKey: '',
    githubPat: '',
    globalRules: '',
    model: 'gemini-2.5-flash',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isRustyChatOpen, setIsRustyChatOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [initialMessageToSend, setInitialMessageToSend] = useState<{ projectId: string; content: string } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [lastAgentResponseTime, setLastAgentResponseTime] = useState<number | null>(null);

  // Global Rusty state - always connected to this repo
  const [rustyCodebaseContext, setRustyCodebaseContext] = useState<string>('');
  const [isRustyConnected, setIsRustyConnected] = useState(false);

  // Consolidated keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const modKey = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K - Focus message input
      if (modKey && e.key === 'k') {
        e.preventDefault();
        messageInputRef.current?.focus();
      }

      // Cmd/Ctrl + N - New project
      if (modKey && e.key === 'n') {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
      }

      // Cmd/Ctrl + S - Settings
      if (modKey && e.key === 's') {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (isNewProjectModalOpen) setIsNewProjectModalOpen(false);
        if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        if (isKeyboardShortcutsOpen) setIsKeyboardShortcutsOpen(false);
      }

      // ? - Show keyboard shortcuts (only when not typing)
      if (e.key === '?' && !modKey && !isInputFocused) {
        e.preventDefault();
        setIsKeyboardShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewProjectModalOpen, isSettingsModalOpen, isKeyboardShortcutsOpen]);

  // Handle sending initial message after project creation
  useEffect(() => {
    if (initialMessageToSend && initialMessageToSend.projectId === activeProjectId) {
      handleSendMessage(initialMessageToSend.content);
      setInitialMessageToSend(null);
    }
  }, [initialMessageToSend, activeProjectId]);

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

  // Initialize Rusty Portable - Meta Code Guardian (Global, Always Connected)
  useEffect(() => {
    const initializeGlobalRusty = async () => {
      initializeRustyPortable();
      rustyLogger.log(
        LogLevel.INFO,
        'App',
        '🔧 MilkStack Multi-Agent Hub started with Rusty Portable monitoring'
      );

      // Automatically connect Rusty to the hardcoded repo
      try {
        const token = getRustyGitHubToken();
        const repoUrl = getRustyRepoUrl();

        rustyLogger.log(
          LogLevel.INFO,
          'App',
          `🔗 Connecting Rusty to ${repoUrl}...`
        );

        // Construct full GitHub URL with branch
        const fullRepoUrl = `https://github.com/${repoUrl}/tree/${RUSTY_GLOBAL_CONFIG.repo.branch}`;
        const codebase = await fetchGitHubRepository(fullRepoUrl, token);

        setRustyCodebaseContext(codebase);
        setIsRustyConnected(true);

        rustyLogger.log(
          LogLevel.INFO,
          'App',
          `✅ Rusty connected to ${repoUrl} and ready to monitor`
        );

        toast.success(`🔧 Rusty is connected to ${repoUrl}`);
      } catch (error) {
        console.error('Failed to connect Rusty to repo:', error);
        rustyLogger.log(
          LogLevel.ERROR,
          'App',
          'Failed to connect Rusty to repo',
          { error }
        );
        toast.warning('Rusty started but could not fetch latest codebase. He will use cached data.');
      }
    };

    initializeGlobalRusty();
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

  const handleCreateProject = useCallback((projectName: string, codebaseContext: string, initialMessage?: string, apiKey?: string) => {
    const newProject = indexedDbService.createProject({
      name: projectName,
      messages: [],
      codebaseContext: codebaseContext,
      apiKey: apiKey,
    });
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setIsNewProjectModalOpen(false);
    toast.success(`Project "${projectName}" created successfully!`);

    // Queue initial message to be sent via useEffect
    if (initialMessage) {
      setInitialMessageToSend({ projectId: newProject.id, content: initialMessage });
    }
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

  // DRY helper for triggering agent responses
  const triggerAgentResponse = useCallback(async (history: Message[], projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    setIsLoading(true);
    setActiveAgentId(null);

    try {
      const onAgentChange = (agentId: string | null) => setActiveAgentId(agentId);

      const result = await getAgentResponse(
        history,
        project.codebaseContext,
        handleNewMessage,
        handleUpdateMessage,
        onAgentChange,
        project.apiKey,
        controller.signal,
        project.activeTaskState || null // Pass active task state for Agency V2
      );

      // Update project with returned task state (if any)
      if (result.updatedTaskState !== undefined) {
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, activeTaskState: result.updatedTaskState || undefined } : p
        ));
      }
    } catch (error) {
      // Don't show error if it was aborted by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Agent response aborted by user');
        toast.info('Response stopped by user');
        return;
      }

      console.error("Error getting agent response:", error);
      toast.error(error instanceof Error ? error.message : 'Failed to get agent response');
      const errorContent = `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        author: { name: 'System', avatar: '!', color: '#ef4444', id: 'system-error', description: '', prompt: '', status: 'active' } as Agent,
        content: errorContent,
        timestamp: new Date(),
        isError: true, // Mark as error for visual distinction
      };
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, messages: [...p.messages, errorMessage] } : p
      ));

      // Auto-invoke Rusty to analyze the error
      handleAutoInvokeRusty(errorContent, projectId);
    } finally {
      setIsLoading(false);
      setActiveAgentId(null);
      setAbortController(null);
      // Record response completion time for rate limiting
      setLastAgentResponseTime(Date.now());
    }
  }, [projects, settings.apiKey, handleNewMessage, handleUpdateMessage]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Enforce 1-minute cooldown after agent responses to prevent rate limit exhaustion
    // The 150 RPM limit is shared across ALL agents, so user messages must be throttled
    const COOLDOWN_MS = 60 * 1000; // 1 minute
    if (lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastResponse) / 1000);
        toast.warning(
          `⏳ Please wait ${remainingSeconds} seconds before sending another message.\n\nThis cooldown prevents API rate limit exhaustion (150 RPM shared across all agents).`,
          {
            autoClose: 5000,
            className: 'bg-milk-dark border border-yellow-500/30',
          }
        );
        return;
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      author: 'Ethan',
      content,
      timestamp: new Date(),
    };

    const fullHistory = [...activeProject.messages, userMessage];

    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, messages: fullHistory } : p
    ));

    await triggerAgentResponse(fullHistory, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, lastAgentResponseTime]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Enforce 1-minute cooldown
    const COOLDOWN_MS = 60 * 1000;
    if (lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastResponse) / 1000);
        toast.warning(
          `⏳ Please wait ${remainingSeconds} seconds before editing messages.\n\nThis cooldown prevents API rate limit exhaustion.`,
          { autoClose: 5000 }
        );
        return;
      }
    }

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
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, messages: newHistory } : p
    ));

    await triggerAgentResponse(newHistory, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, lastAgentResponseTime]);

  const handleResendFromMessage = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Enforce 1-minute cooldown
    const COOLDOWN_MS = 60 * 1000;
    if (lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastResponse) / 1000);
        toast.warning(
          `⏳ Please wait ${remainingSeconds} seconds before resending messages.\n\nThis cooldown prevents API rate limit exhaustion.`,
          { autoClose: 5000 }
        );
        return;
      }
    }

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Truncate messages after this one (inclusive of responses)
    const truncatedMessages = activeProject.messages.slice(0, messageIndex + 1);

    // Update the project with the truncated history
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, messages: truncatedMessages } : p
    ));

    await triggerAgentResponse(truncatedMessages, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, lastAgentResponseTime]);

  const handleRegenerateResponse = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Enforce 1-minute cooldown
    const COOLDOWN_MS = 60 * 1000;
    if (lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastResponse) / 1000);
        toast.warning(
          `⏳ Please wait ${remainingSeconds} seconds before regenerating responses.\n\nThis cooldown prevents API rate limit exhaustion.`,
          { autoClose: 5000 }
        );
        return;
      }
    }

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove this message (the last agent response) and regenerate
    const truncatedMessages = activeProject.messages.slice(0, messageIndex);

    // Update the project
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, messages: truncatedMessages } : p
    ));

    await triggerAgentResponse(truncatedMessages, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, lastAgentResponseTime]);

  const handleStopGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      setActiveAgentId(null);
    }
  }, [abortController]);

  const handleApproveChanges = useCallback(async (messageId: string, changes: AgentProposedChanges) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    try {
      // Extract repo info from codebase context
      const repoInfo = extractRepoInfo(activeProject.codebaseContext);
      if (!repoInfo) {
        toast.error('Could not determine repository from codebase context. Please include GitHub URL in project.');
        return;
      }

      // Get GitHub PAT from settings
      if (!settings.githubPat) {
        toast.error('GitHub Personal Access Token not configured. Please add it in Settings.');
        return;
      }

      toast.info('Pushing changes to GitHub...');

      // Commit to GitHub using the API
      const result = await commitToGitHub(
        changes,
        settings.githubPat,
        repoInfo.owner,
        repoInfo.repo,
        'main' // TODO: make base branch configurable
      );

      console.log(`[GitHub Integration] Committed to ${repoInfo.owner}/${repoInfo.repo}@${result.branchName}`);

      // Update codebase context to reflect the changes
      let updatedContext = activeProject.codebaseContext;

      for (const change of changes.changes) {
        const filePath = change.filePath;

        if (change.action === 'add') {
          if (change.content) {
            updatedContext += `\n\n## File: ${filePath}\n\`\`\`\n${change.content}\n\`\`\`\n`;
          }
        } else if (change.action === 'modify') {
          if (change.content) {
            const fileHeaderRegex = new RegExp(`## File: ${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\`\`\`[\\s\\S]*?\n\`\`\``, 'g');
            if (updatedContext.match(fileHeaderRegex)) {
              updatedContext = updatedContext.replace(fileHeaderRegex, `## File: ${filePath}\n\`\`\`\n${change.content}\n\`\`\``);
            } else {
              updatedContext += `\n\n## File: ${filePath}\n\`\`\`\n${change.content}\n\`\`\`\n`;
            }
          }
        } else if (change.action === 'delete') {
          const fileHeaderRegex = new RegExp(`## File: ${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\`\`\`[\\s\\S]*?\n\`\`\`\n?`, 'g');
          updatedContext = updatedContext.replace(fileHeaderRegex, '');
        }
      }

      // Update project with modified codebase context
      setProjects(prev => prev.map(p =>
        p.id === activeProjectId ? { ...p, codebaseContext: updatedContext } : p
      ));

      // Remove proposedChanges from the message since they've been applied
      setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        return {
          ...p,
          messages: p.messages.map(m =>
            m.id === messageId ? { ...m, proposedChanges: undefined } : m
          )
        };
      }));

      toast.success(
        `✅ Pushed ${changes.changes.length} file(s) to ${repoInfo.owner}/${repoInfo.repo}@${result.branchName}`,
        { autoClose: 5000 }
      );
    } catch (error) {
      console.error('Failed to apply changes:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to push changes: ${errorMsg}`);
    }
  }, [activeProjectId, projects, settings]);

  const handleRejectChanges = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    // Simply remove proposedChanges from the message
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        messages: p.messages.map(m =>
          m.id === messageId ? { ...m, proposedChanges: undefined } : m
        )
      };
    }));

    toast.info('Proposed changes rejected');
  }, [activeProjectId]);

  // Global Rusty refresh handler
  const handleRefreshRustyCodebase = useCallback(async () => {
    try {
      const token = getRustyGitHubToken();
      const repoUrl = getRustyRepoUrl();

      rustyLogger.log(
        LogLevel.INFO,
        'App',
        `🔄 Refreshing Rusty's connection to ${repoUrl}...`
      );

      toast.info(`🔄 Syncing Rusty with ${repoUrl}...`);

      // Construct full GitHub URL with branch
      const fullRepoUrl = `https://github.com/${repoUrl}/tree/${RUSTY_GLOBAL_CONFIG.repo.branch}`;
      const codebase = await fetchGitHubRepository(fullRepoUrl, token);

      setRustyCodebaseContext(codebase);
      setIsRustyConnected(true);

      rustyLogger.log(
        LogLevel.INFO,
        'App',
        `✅ Rusty codebase refreshed successfully`
      );

      toast.success(`✅ Rusty synced with latest code from ${repoUrl}`);
    } catch (error) {
      console.error('Failed to refresh Rusty codebase:', error);
      rustyLogger.log(
        LogLevel.ERROR,
        'App',
        'Failed to refresh Rusty codebase',
        { error }
      );
      toast.error(error instanceof Error ? error.message : 'Failed to refresh Rusty codebase');
    }
  }, []);

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

  const handleExportChat = useCallback(async () => {
    if (!activeProjectId) {
      toast.error('No active project to export');
      return;
    }

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) {
      toast.error('Active project not found');
      return;
    }

    try {
      // Build markdown conversation
      let markdown = `# ${activeProject.name}\n\n`;
      markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;

      if (activeProject.codebaseContext) {
        markdown += `## Codebase Context\n\n\`\`\`\n${activeProject.codebaseContext.slice(0, 500)}...\n\`\`\`\n\n`;
      }

      markdown += `## Conversation\n\n`;
      markdown += `---\n\n`;

      activeProject.messages.forEach((message) => {
        const authorName = typeof message.author === 'string'
          ? message.author
          : message.author.name;

        const timestamp = message.timestamp instanceof Date
          ? message.timestamp.toLocaleTimeString()
          : new Date(message.timestamp).toLocaleTimeString();

        markdown += `### ${authorName} (${timestamp})\n\n`;
        markdown += `${message.content}\n\n`;
        markdown += `---\n\n`;
      });

      // Create and download file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-chat-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Chat exported successfully!');
    } catch (error) {
      console.error('Failed to export chat:', error);
      toast.error('Failed to export chat');
    }
  }, [activeProjectId, projects]);

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

      setProjects(prevProjects => {
        const updatedProjects = prevProjects.filter(p => p.id !== id);

        // If we deleted the active project, switch to another one using fresh state
        if (activeProjectId === id) {
          setActiveProjectId(updatedProjects.length > 0 ? updatedProjects[0].id : null);
        }

        return updatedProjects;
      });

      toast.success('Project deleted');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  }, [activeProjectId]);

  const handleUpdateProjectSettings = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      setProjects(prev => {
        const newProjects = prev.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
        );

        // Persist to IndexedDB using fresh state (not stale closure)
        const updatedProject = newProjects.find(p => p.id === id);
        if (updatedProject) {
          indexedDbService.updateProject(updatedProject).catch(error => {
            console.error('Failed to update project settings in DB:', error);
            toast.error('Failed to save project settings');
          });
        }

        return newProjects;
      });
    } catch (error) {
      console.error('Failed to update project settings:', error);
      toast.error('Failed to update project settings');
    }
  }, []); // Empty deps - no longer depends on stale projects

  // Rusty Chat Management Handlers
  const handleNewRustyChat = useCallback(async () => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const newChat = {
      id: crypto.randomUUID(),
      name: `Chat ${project.rustyChats.length + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, rustyChats: [...p.rustyChats, newChat], activeRustyChatId: newChat.id }
        : p
    ));

    await indexedDbService.updateProject({
      ...project,
      rustyChats: [...project.rustyChats, newChat],
      activeRustyChatId: newChat.id
    });

    toast.success('New Rusty chat created');
  }, [activeProjectId, projects]);

  const handleSwitchRustyChat = useCallback(async (chatId: string) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, activeRustyChatId: chatId }
        : p
    ));

    await indexedDbService.updateProject({ ...project, activeRustyChatId: chatId });
  }, [activeProjectId, projects]);

  const handleDeleteRustyChat = useCallback(async (chatId: string) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const updatedChats = project.rustyChats.filter(c => c.id !== chatId);

    // If deleting the active chat, switch to the first remaining chat
    const newActiveChatId = project.activeRustyChatId === chatId
      ? updatedChats[0]?.id
      : project.activeRustyChatId;

    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, rustyChats: updatedChats, activeRustyChatId: newActiveChatId }
        : p
    ));

    await indexedDbService.updateProject({
      ...project,
      rustyChats: updatedChats,
      activeRustyChatId: newActiveChatId
    });

    toast.success('Chat deleted');
  }, [activeProjectId, projects]);

  const handleUpdateRustyChat = useCallback(async (chatId: string, messages: any[]) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const updatedChats = project.rustyChats.map(c =>
      c.id === chatId ? { ...c, messages, updatedAt: new Date() } : c
    );

    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, rustyChats: updatedChats }
        : p
    ));

    await indexedDbService.updateProject({ ...project, rustyChats: updatedChats });
  }, [activeProjectId, projects]);

  // Auto-invoke Rusty when errors occur
  const handleAutoInvokeRusty = useCallback(async (errorMessage: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.activeRustyChatId) return;

    try {
      // Create Rusty auto-analysis message
      const rustyAutoMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: `Auto-analysis requested: An error occurred in the project.\n\nError: ${errorMessage}\n\nPlease analyze what might have caused this error and suggest fixes.`,
        timestamp: new Date(),
      };

      const currentChat = project.rustyChats.find(c => c.id === project.activeRustyChatId);
      if (!currentChat) return;

      const updatedMessages = [...currentChat.messages, rustyAutoMessage];
      await handleUpdateRustyChat(project.activeRustyChatId, updatedMessages);

      // Call Rusty to analyze the error
      const response = await invokeRustyPortable({
        userQuery: rustyAutoMessage.content,
        sourceFiles: rustyCodebaseContext,
      }, settings.rustyApiKey);

      const rustyResponseMessage = {
        id: crypto.randomUUID(),
        role: 'rusty' as const,
        content: response.review,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, rustyResponseMessage];
      await handleUpdateRustyChat(project.activeRustyChatId, finalMessages);

      // Show toast notification with preview and link to Rusty chat
      const analysisPreview = response.review.slice(0, 150) + (response.review.length > 150 ? '...' : '');
      toast.info(
        <div className="flex flex-col gap-2">
          <div className="font-bold flex items-center gap-2">
            <span>🔧</span>
            <span>Rusty analyzed the error:</span>
          </div>
          <div className="text-sm text-milk-slate-light">{analysisPreview}</div>
          <button
            onClick={() => setIsRustyChatOpen(true)}
            className="mt-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-sm transition-colors"
          >
            Open Rusty Chat →
          </button>
        </div>,
        {
          autoClose: 10000,
          closeButton: true,
          className: 'bg-milk-dark border border-orange-500/30',
        }
      );
    } catch (error) {
      console.error('Failed to auto-invoke Rusty:', error);
      toast.error('Rusty failed to analyze the error - check console for details');
    }
  }, [projects, rustyCodebaseContext, settings.rustyApiKey, handleUpdateRustyChat]);

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
          onExportChat={handleExportChat}
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
          apiKey={activeProject?.apiKey || settings.apiKey}
          onEditMessage={handleEditMessage}
          onResendFromMessage={handleResendFromMessage}
          onRegenerateResponse={handleRegenerateResponse}
          onStopGeneration={handleStopGeneration}
          onOpenRusty={() => setIsRustyChatOpen(true)}
          onOpenProjectSettings={() => setIsProjectSettingsModalOpen(true)}
          onApproveChanges={handleApproveChanges}
          onRejectChanges={handleRejectChanges}
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

      {isProjectSettingsModalOpen && activeProject && (
        <ProjectSettingsModal
          onClose={() => setIsProjectSettingsModalOpen(false)}
          onSave={(updates) => handleUpdateProjectSettings(activeProject.id, updates)}
          project={activeProject}
        />
      )}

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />

      {isRustyChatOpen && activeProject && (
        <RustyChatModal
          onClose={() => setIsRustyChatOpen(false)}
          apiKey={settings.rustyApiKey}
          codebaseContext={rustyCodebaseContext}
          isConnected={isRustyConnected}
          onRefreshCodebase={handleRefreshRustyCodebase}
          rustyChats={activeProject.rustyChats}
          activeRustyChatId={activeProject.activeRustyChatId}
          onNewChat={handleNewRustyChat}
          onSwitchChat={handleSwitchRustyChat}
          onDeleteChat={handleDeleteRustyChat}
          onUpdateChat={handleUpdateRustyChat}
        />
      )}
    </>
  );
};

export default App;