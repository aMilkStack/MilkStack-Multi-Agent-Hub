import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './src/components/Sidebar';
import ChatView from './src/components/ChatView';
import NewProjectModal from './src/components/modals/NewProjectModal';
import SettingsModal from './src/components/modals/SettingsModal';
import KeyboardShortcutsModal from './src/components/modals/KeyboardShortcutsModal';
import RustyChatModal from './src/components/modals/RustyChatModal';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Message, Agent, AgentProposedChanges, ActiveTaskState, WorkflowPhase, AgentStatus } from './src/types';
import { RustyMessage } from './src/types/rusty';
import * as indexedDbService from './src/services/indexedDbService';
import { getAgentResponse } from './src/services/geminiService';
import { getGeminiApiKey } from './src/config/ai';
import { commitToGitHub, extractRepoInfo, fetchGitHubRepository, getGitHubToken } from './src/services/githubService';
import { processCodebase } from './src/utils/codebaseProcessor';
import { AGENT_PROFILES } from './src/agents';
import { MessageInputHandle } from './src/components/MessageInput';
import { initializeRustyPortable, rustyLogger, LogLevel } from './src/services/rustyPortableService';
import { RUSTY_CONFIG, getRustyGitHubToken, getRustyRepoUrl } from './src/config/rustyConfig';
import { AppProvider } from './src/context/AppContext';
import { useProjects } from './src/context/ProjectContext';
import { useSettings } from './src/context/SettingsContext';
import { useRusty } from './src/context/RustyContext';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';

const AppContent: React.FC = () => {
  // Get state from contexts
  const { projects, activeProjectId, selectProject, createProject, updateProject, renameProject, deleteProject, updateMessages, updateCodebase } = useProjects();
  const { settings, updateSettings } = useSettings();
  const { rustyCodebaseContext, isRustyConnected, updateCodebase: updateRustyCodebase, setConnectionStatus } = useRusty();

  // Local UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isRustyChatOpen, setIsRustyChatOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [initialMessageToSend, setInitialMessageToSend] = useState<{ projectId: string; content: string } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [lastAgentResponseTime, setLastAgentResponseTime] = useState<number | null>(null);
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>(WorkflowPhase.Discovery);

  const messageInputRef = useRef<MessageInputHandle | null>(null);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts(
    messageInputRef,
    {
      openNewProject: () => setIsNewProjectModalOpen(true),
      openSettings: () => setIsSettingsModalOpen(true),
      openKeyboardShortcuts: () => setIsKeyboardShortcutsOpen(true),
      closeNewProject: () => setIsNewProjectModalOpen(false),
      closeSettings: () => setIsSettingsModalOpen(false),
      closeKeyboardShortcuts: () => setIsKeyboardShortcutsOpen(false),
    },
    {
      isNewProjectModalOpen,
      isSettingsModalOpen,
      isKeyboardShortcutsOpen,
    }
  );

  // Handle sending initial message after project creation
  useEffect(() => {
    if (initialMessageToSend && initialMessageToSend.projectId === activeProjectId) {
      handleSendMessage(initialMessageToSend.content);
      setInitialMessageToSend(null);
    }
  }, [initialMessageToSend, activeProjectId]);

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
        const fullRepoUrl = `https://github.com/${repoUrl}/tree/${RUSTY_CONFIG.repo.branch}`;
        const codebase = await fetchGitHubRepository(fullRepoUrl, token);

        updateRustyCodebase(codebase);
        setConnectionStatus(true);

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

  const handleCreateProject = useCallback((projectName: string, codebaseContext: string, initialMessage?: string) => {
    const result = createProject(projectName, codebaseContext, initialMessage);

    // Queue initial message to be sent via useEffect
    if (result.initialMessage) {
      setInitialMessageToSend({ projectId: result.project.id, content: result.initialMessage });
    }
  }, [createProject]);

  const handleSelectProject = useCallback((projectId: string) => {
    // Abort any running generation before switching
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      toast.info('Previous generation stopped');
    }

    selectProject(projectId);
  }, [abortController, selectProject]);

  const handleAddContext = useCallback(async (files: File[]) => {
    if (!activeProjectId) return;

    const context = await processCodebase(files);

    updateCodebase(activeProjectId, context);
  }, [activeProjectId, updateCodebase]);

  const handleSaveSettings = useCallback((newSettings: typeof settings) => {
    updateSettings(newSettings);
    setIsSettingsModalOpen(false);
  }, [updateSettings]);

  // DRY helper for triggering agent responses
  const triggerAgentResponse = useCallback(async (history: Message[], projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      console.error('[DEBUG] Project not found in triggerAgentResponse!');
      return;
    }

    // RESOLVE API KEY: From environment variable only
    const effectiveApiKey = getGeminiApiKey();

    if (!effectiveApiKey) {
      toast.error('⚠️ No API key found! Please set GEMINI_API_KEY in your .env file. See .env.example for details.');
      return;
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);
    setIsLoading(true);

    try {
      // FIX: Create stable callbacks bound to this specific projectId
      const onMessageUpdate = (chunk: string) => {
        const currentProject = projects.find(p => p.id === projectId);
        if (!currentProject) return;

        const lastMessage = currentProject.messages[currentProject.messages.length - 1];
        if (lastMessage && typeof lastMessage.author !== 'string') {
          const updatedLastMessage = {
            ...lastMessage,
            content: lastMessage.content + chunk,
          };
          updateMessages(projectId, [...currentProject.messages.slice(0, -1), updatedLastMessage]);
        }
      };

      const onNewMessage = (message: Message) => {
        const currentProject = projects.find(p => p.id === projectId);
        if (!currentProject) return;
        updateMessages(projectId, [...currentProject.messages, message]);
      };

      const onAgentChange = (agentId: string | null) => {
        setActiveAgentId(agentId);
      };

      const result = await getAgentResponse(
        undefined, // API key now comes from env var
        history,
        project.codebaseContext,
        onNewMessage,
        onMessageUpdate,
        onAgentChange,
        controller.signal,
        project.activeTaskState || null,
        workflowPhase
      );

      // Update project with returned task state (if any)
      if (result.updatedTaskState !== undefined) {
        updateProject(projectId, { activeTaskState: result.updatedTaskState || undefined });
      }

      // Handle workflow phase transitions
      if (result.phaseChanged && result.newPhase) {
        console.log(`[Workflow] Phase changed: ${workflowPhase} -> ${result.newPhase}`);
        setWorkflowPhase(result.newPhase);
      }
    } catch (error) {
      // Don't show error if it was aborted by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Agent response aborted by user');
        toast.info('Response stopped by user');
        return;
      }

      console.error("Error getting agent response:", error);

      // Provide helpful error messages based on error type
      const errorMsg = error instanceof Error ? error.message : 'Failed to get agent response';
      if (errorMsg.includes('valid response stream') || errorMsg.includes('API key')) {
        toast.error('⚠️ API Error: Please check your API key, billing status, and quota limits in Google AI Studio');
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        toast.error('⏱️ Rate limit reached. Please wait a moment before trying again.');
      } else if (errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('Service Unavailable')) {
        toast.error('⚠️ Service Overloaded (503). The AI provider is temporarily busy. Please try again in a few seconds.');
      } else {
        toast.error(errorMsg);
      }

      const errorContent = `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        author: {
          id: 'system-error',
          name: 'System',
          avatar: '!',
          color: '#ef4444',
          description: 'System error handler',
          prompt: '',
          status: AgentStatus.Active
        } satisfies Agent,
        content: errorContent,
        timestamp: new Date(),
        isError: true,
      };

      const currentProject = projects.find(p => p.id === projectId);
      if (currentProject) {
        updateMessages(projectId, [...currentProject.messages, errorMessage]);
      }


    } finally {
      setIsLoading(false);
      setLastAgentResponseTime(Date.now());
    }
  }, [projects, updateMessages, updateProject, workflowPhase]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Check if message needs to be queued (1-minute cooldown after agent responses)
    const COOLDOWN_MS = 60 * 1000;
    let queuedUntil: Date | undefined;

    if (lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        queuedUntil = new Date(lastAgentResponseTime + COOLDOWN_MS);
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      author: 'Ethan',
      content,
      timestamp: new Date(),
      queuedUntil,
    };

    const fullHistory = [...activeProject.messages, userMessage];
    updateMessages(activeProjectId, fullHistory);

    // If not queued, send immediately
    if (!queuedUntil) {
      await triggerAgentResponse(fullHistory, activeProjectId);
    }
  }, [activeProjectId, projects, lastAgentResponseTime, triggerAgentResponse, updateMessages]);

  // Process queued messages - check every second for messages ready to send
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeProjectId) return;

      const activeProject = projects.find(p => p.id === activeProjectId);
      if (!activeProject) return;

      // Find queued messages that are ready to send
      const now = new Date();
      const queuedMessages = activeProject.messages.filter(m => m.queuedUntil && m.queuedUntil <= now);

      if (queuedMessages.length > 0) {
        // Process the first queued message
        const messageToSend = queuedMessages[0];
        console.log(`[Message Queue] Processing queued message: ${messageToSend.id}`);

        // Remove queuedUntil from the message
        const updatedMessages = activeProject.messages.map(m =>
          m.id === messageToSend.id ? { ...m, queuedUntil: undefined } : m
        );
        updateMessages(activeProjectId, updatedMessages);

        // Trigger agent response
        triggerAgentResponse(activeProject.messages, activeProjectId);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeProjectId, projects, triggerAgentResponse, updateMessages]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const updatedMessages = activeProject.messages.slice(0, messageIndex);
    const editedMessage: Message = {
      ...activeProject.messages[messageIndex],
      content: newContent,
      timestamp: new Date(),
    };
    const newHistory = [...updatedMessages, editedMessage];

    updateMessages(activeProjectId, newHistory);
    await triggerAgentResponse(newHistory, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, updateMessages]);

  const handleResendFromMessage = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const truncatedMessages = activeProject.messages.slice(0, messageIndex + 1);
    updateMessages(activeProjectId, truncatedMessages);
    await triggerAgentResponse(truncatedMessages, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, updateMessages]);

  const handleRegenerateResponse = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const truncatedMessages = activeProject.messages.slice(0, messageIndex);
    updateMessages(activeProjectId, truncatedMessages);
    await triggerAgentResponse(truncatedMessages, activeProjectId);
  }, [activeProjectId, projects, triggerAgentResponse, updateMessages]);

  const handleStopGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
    }
  }, [abortController]);

  const handleApproveChanges = useCallback(async (messageId: string, changes: AgentProposedChanges) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    try {
      const repoInfo = extractRepoInfo(activeProject.codebaseContext);
      if (!repoInfo) {
        toast.error('Could not determine repository from codebase context. Please include GitHub URL in project.');
        return;
      }

      const githubToken = getGitHubToken();
      if (!githubToken) {
        toast.error('GitHub Personal Access Token not configured. Please set VITE_GITHUB_TOKEN in your .env file.');
        return;
      }

      toast.info('Pushing changes to GitHub...');

      const result = await commitToGitHub(
        changes,
        repoInfo.owner,
        repoInfo.repo,
        'main'
      );

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

      updateCodebase(activeProjectId, updatedContext);

      // Remove proposedChanges from the message
      const updatedMessages = activeProject.messages.map(m =>
        m.id === messageId ? { ...m, proposedChanges: undefined } : m
      );
      updateMessages(activeProjectId, updatedMessages);

      toast.success(
        `✅ Pushed ${changes.changes.length} file(s) to ${repoInfo.owner}/${repoInfo.repo}@${result.branchName}`,
        { autoClose: 5000 }
      );
    } catch (error) {
      console.error('Failed to apply changes:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to push changes: ${errorMsg}`);
    }
  }, [activeProjectId, projects, settings, updateCodebase, updateMessages]);

  const handleRejectChanges = useCallback(async (messageId: string) => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    const updatedMessages = activeProject.messages.map(m =>
      m.id === messageId ? { ...m, proposedChanges: undefined } : m
    );
    updateMessages(activeProjectId, updatedMessages);

    toast.info('Proposed changes rejected');
  }, [activeProjectId, projects, updateMessages]);

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

      const fullRepoUrl = `https://github.com/${repoUrl}/tree/${RUSTY_CONFIG.repo.branch}`;
      const codebase = await fetchGitHubRepository(fullRepoUrl, token);

      updateRustyCodebase(codebase);
      setConnectionStatus(true);

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
  }, [updateRustyCodebase, setConnectionStatus]);

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

      // Note: Projects are now managed by ProjectContext, which will auto-reload
      toast.success('Projects imported successfully! Please refresh the page.');
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
      renameProject(id, newName);
    } catch (error) {
      console.error('Failed to rename project:', error);
      toast.error('Failed to rename project');
    }
  }, [renameProject]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  }, [deleteProject]);

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

    updateProject(activeProjectId, {
      rustyChats: [...project.rustyChats, newChat],
      activeRustyChatId: newChat.id,
    });

    toast.success('New Rusty chat created');
  }, [activeProjectId, projects, updateProject]);

  const handleSwitchRustyChat = useCallback(async (chatId: string) => {
    if (!activeProjectId) return;

    updateProject(activeProjectId, { activeRustyChatId: chatId });
  }, [activeProjectId, updateProject]);

  const handleDeleteRustyChat = useCallback(async (chatId: string) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const updatedChats = project.rustyChats.filter(c => c.id !== chatId);
    const newActiveChatId = project.activeRustyChatId === chatId
      ? updatedChats[0]?.id
      : project.activeRustyChatId;

    updateProject(activeProjectId, {
      rustyChats: updatedChats,
      activeRustyChatId: newActiveChatId,
    });

    toast.success('Chat deleted');
  }, [activeProjectId, projects, updateProject]);

  const handleUpdateRustyChat = useCallback(async (chatId: string, messages: RustyMessage[]) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const updatedChats = project.rustyChats.map(c =>
      c.id === chatId ? { ...c, messages, updatedAt: new Date() } : c
    );

    updateProject(activeProjectId, { rustyChats: updatedChats });
  }, [activeProjectId, projects, updateProject]);

  // Workflow approval handlers
  const handleWorkflowApprove = useCallback(() => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject?.activeTaskState) return;

    updateProject(activeProjectId, {
      activeTaskState: {
        ...activeProject.activeTaskState,
        status: 'in_progress',
      },
    });

    toast.success('Workflow approved! Continuing execution...');

    // Re-trigger agent response to continue from where we paused
    triggerAgentResponse(activeProject.messages, activeProjectId);
  }, [activeProjectId, projects, updateProject, triggerAgentResponse]);

  const handleWorkflowEdit = useCallback((editedPlan: ActiveTaskState) => {
    if (!activeProjectId) return;

    updateProject(activeProjectId, {
      activeTaskState: { ...editedPlan, status: 'in_progress' },
    });

    toast.success('Workflow plan updated! Continuing with modified plan...');

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (activeProject) {
      triggerAgentResponse(activeProject.messages, activeProjectId);
    }
  }, [activeProjectId, projects, updateProject, triggerAgentResponse]);

  const handleWorkflowCancel = useCallback(() => {
    if (!activeProjectId) return;

    updateProject(activeProjectId, { activeTaskState: undefined });
    toast.info('Workflow cancelled');
  }, [activeProjectId, updateProject]);

  // Discovery Mode: Start execution when user clicks the button
  const handleStartExecution = useCallback(() => {
    if (!activeProjectId) return;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return;

    // Switch to execution mode and trigger Product Planner
    setWorkflowPhase(WorkflowPhase.Execution);

    // Add a "go ahead" message to trigger the execution
    const goAheadMessage: Message = {
      id: crypto.randomUUID(),
      author: 'Ethan',
      content: 'Go ahead with implementation',
      timestamp: new Date(),
    };
    const updatedMessages = [...activeProject.messages, goAheadMessage];
    updateMessages(activeProjectId, updatedMessages);

    // Trigger the agent response
    triggerAgentResponse(updatedMessages, activeProjectId);
  }, [activeProjectId, projects, updateMessages, triggerAgentResponse]);

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
        <ErrorBoundary componentName="Sidebar">
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
        </ErrorBoundary>
        <ErrorBoundary componentName="ChatView">
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
            onStopGeneration={handleStopGeneration}
            onOpenRusty={() => setIsRustyChatOpen(true)}
            onApproveChanges={handleApproveChanges}
            onRejectChanges={handleRejectChanges}
            onWorkflowApprove={handleWorkflowApprove}
            onWorkflowEdit={handleWorkflowEdit}
            onWorkflowCancel={handleWorkflowCancel}
            workflowPhase={workflowPhase}
            onStartExecution={handleStartExecution}
          />
        </ErrorBoundary>
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

      {isRustyChatOpen && activeProject && (
        <RustyChatModal
          onClose={() => setIsRustyChatOpen(false)}
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

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
