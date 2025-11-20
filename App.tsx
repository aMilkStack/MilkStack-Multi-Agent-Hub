import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './src/components/Sidebar';
import ChatView from './src/components/ChatView';
import NewProjectModal from './src/components/modals/NewProjectModal';
import SettingsModal from './src/components/modals/SettingsModal';
import ProjectSettingsModal from './src/components/modals/ProjectSettingsModal';
import KeyboardShortcutsModal from './src/components/modals/KeyboardShortcutsModal';
import RustyChatModal from './src/components/modals/RustyChatModal';
import { Project, Settings, Message, Agent, AgentProposedChanges, ActiveTaskState } from './types';
import * as indexedDbService from './src/services/indexedDbService';
import { getAgentResponse } from './src/services/geminiService';
import { commitToGitHub, extractRepoInfo, fetchGitHubRepository } from './src/services/githubService';
import { processCodebase } from './src/utils/codebaseProcessor';
import { AGENT_PROFILES } from './constants';
import { MessageInputHandle } from './src/components/MessageInput';
import { initializeRustyPortable, invokeRustyPortable, rustyLogger, LogLevel } from './src/services/rustyPortableService';
import { RUSTY_GLOBAL_CONFIG, getRustyGitHubToken, getRustyRepoUrl } from './src/config/rustyConfig';
import { appReducer, initialAppState } from './src/reducers/appReducer';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const messageInputRef = useRef<MessageInputHandle>(null);

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
        dispatch({ type: 'MODAL_OPENED', payload: 'newProject' });
      }

      // Cmd/Ctrl + S - Settings
      if (modKey && e.key === 's') {
        e.preventDefault();
        dispatch({ type: 'MODAL_OPENED', payload: 'settings' });
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (state.isNewProjectModalOpen) dispatch({ type: 'MODAL_CLOSED', payload: 'newProject' });
        if (state.isSettingsModalOpen) dispatch({ type: 'MODAL_CLOSED', payload: 'settings' });
        if (state.isKeyboardShortcutsOpen) dispatch({ type: 'MODAL_CLOSED', payload: 'keyboardShortcuts' });
      }

      // ? - Show keyboard shortcuts (only when not typing)
      if (e.key === '?' && !modKey && !isInputFocused) {
        e.preventDefault();
        dispatch({ type: 'MODAL_OPENED', payload: 'keyboardShortcuts' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isNewProjectModalOpen, state.isSettingsModalOpen, state.isKeyboardShortcutsOpen]);

  // Handle sending initial message after project creation
  useEffect(() => {
    if (state.initialMessageToSend && state.initialMessageToSend.projectId === state.activeProjectId) {
      handleSendMessage(state.initialMessageToSend.content);
      dispatch({ type: 'INITIAL_MESSAGE_CLEARED' });
    }
  }, [state.initialMessageToSend, state.activeProjectId]);

  // Load initial data from IndexedDB and migrate from localStorage if needed
  useEffect(() => {
    const loadData = async () => {
      // First, attempt migration from localStorage
      await indexedDbService.migrateFromLocalStorage();

      // Load projects and settings
      const loadedProjects = await indexedDbService.loadProjects();
      const loadedSettings = await indexedDbService.loadSettings();

      dispatch({ type: 'PROJECTS_LOADED', payload: loadedProjects });
      if (loadedSettings) {
        dispatch({ type: 'SETTINGS_LOADED', payload: loadedSettings });
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

        dispatch({ type: 'RUSTY_CODEBASE_UPDATED', payload: codebase });
        dispatch({ type: 'RUSTY_CONNECTION_STATUS', payload: true });

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
    if (state.projects.length > 0) {
      indexedDbService.saveProjects(state.projects).catch(error => {
        console.error('Failed to save projects:', error);
        toast.error('Failed to save projects to storage');
      });
    }
  }, [state.projects]);

  // Save settings whenever they change
  useEffect(() => {
    indexedDbService.saveSettings(state.settings).catch(error => {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    });
  }, [state.settings]);

  const handleCreateProject = useCallback((projectName: string, codebaseContext: string, initialMessage?: string, apiKey?: string) => {
    const newProject = indexedDbService.createProject({
      name: projectName,
      messages: [],
      codebaseContext: codebaseContext,
      apiKey: apiKey,
    });
    dispatch({ type: 'PROJECT_CREATED', payload: newProject });
    toast.success(`Project "${projectName}" created successfully!`);

    // Queue initial message to be sent via useEffect
    if (initialMessage) {
      dispatch({
        type: 'INITIAL_MESSAGE_QUEUED',
        payload: { projectId: newProject.id, content: initialMessage }
      });
    }
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    dispatch({ type: 'PROJECT_SELECTED', payload: projectId });
  }, []);
  
  const handleAddContext = useCallback(async (files: File[]) => {
    if (!state.activeProjectId) return;

    // You could add a loading indicator here specifically for context processing
    const context = await processCodebase(files);

    dispatch({
      type: 'PROJECT_CODEBASE_UPDATED',
      payload: { id: state.activeProjectId, codebaseContext: context }
    });
    // Optionally, you can add a system message to the chat indicating context was updated
  }, [state.activeProjectId]);


  const handleSaveSettings = useCallback((newSettings: Settings) => {
    dispatch({ type: 'SETTINGS_SAVED', payload: newSettings });
  }, []);

  const handleUpdateMessage = useCallback((chunk: string) => {
    if (!state.activeProjectId) return;
    dispatch({
      type: 'MESSAGE_UPDATED',
      payload: { projectId: state.activeProjectId, chunk }
    });
  }, [state.activeProjectId]);

  const handleNewMessage = useCallback((message: Message) => {
    if (!state.activeProjectId) return;
    dispatch({
      type: 'MESSAGE_ADDED',
      payload: { projectId: state.activeProjectId, message }
    });
  }, [state.activeProjectId]);

  // DRY helper for triggering agent responses
  const triggerAgentResponse = useCallback(async (history: Message[], projectId: string) => {
    console.log('[DEBUG] triggerAgentResponse called');
    console.log('[DEBUG] history length:', history.length);
    console.log('[DEBUG] projectId:', projectId);

    const project = state.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('[DEBUG] Project not found in triggerAgentResponse!');
      return;
    }

    console.log('[DEBUG] Project API key:', project.apiKey ? 'SET' : 'NOT SET');
    console.log('[DEBUG] Settings API key:', state.settings.apiKey ? 'SET' : 'NOT SET');

    // Create abort controller for this request
    const controller = new AbortController();
    dispatch({ type: 'ABORT_CONTROLLER_SET', payload: controller });
    dispatch({ type: 'LOADING_STARTED' });

    try {
      console.log('[DEBUG] Calling getAgentResponse...');
      const onAgentChange = (agentId: string | null) => {
        dispatch({ type: 'AGENT_CHANGED', payload: agentId });
      };

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
        dispatch({
          type: 'WORKFLOW_STATE_UPDATED',
          payload: { projectId, state: result.updatedTaskState || undefined }
        });
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
      dispatch({
        type: 'MESSAGE_ADDED',
        payload: { projectId, message: errorMessage }
      });

      // Auto-invoke Rusty to analyze the error
      handleAutoInvokeRusty(errorContent, projectId);
    } finally {
      dispatch({ type: 'LOADING_STOPPED' });
      dispatch({ type: 'LAST_RESPONSE_TIME_SET', payload: Date.now() });
    }
  }, [state.projects, state.settings.apiKey, handleNewMessage, handleUpdateMessage]);

  const handleSendMessage = useCallback(async (content: string) => {
    console.log('[DEBUG] handleSendMessage called with:', content);
    console.log('[DEBUG] activeProjectId:', state.activeProjectId);
    console.log('[DEBUG] projects:', state.projects.length);

    if (!state.activeProjectId) {
      console.error('[DEBUG] No active project ID!');
      return;
    }

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) {
      console.error('[DEBUG] Active project not found!');
      return;
    }

    console.log('[DEBUG] Active project:', activeProject.name);

    // Check if message needs to be queued (1-minute cooldown after agent responses)
    // The 150 RPM limit is shared across ALL agents, so user messages must be throttled
    const COOLDOWN_MS = 60 * 1000; // 1 minute
    let queuedUntil: Date | undefined;

    if (state.lastAgentResponseTime) {
      const timeSinceLastResponse = Date.now() - state.lastAgentResponseTime;
      if (timeSinceLastResponse < COOLDOWN_MS) {
        // Queue the message for later
        queuedUntil = new Date(state.lastAgentResponseTime + COOLDOWN_MS);
        console.log(`[Message Queue] Message queued until ${queuedUntil.toLocaleTimeString()}`);
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      author: 'Ethan',
      content,
      timestamp: new Date(),
      queuedUntil, // Will be undefined if sending immediately
    };

    const fullHistory = [...activeProject.messages, userMessage];

    dispatch({
      type: 'MESSAGES_TRUNCATED',
      payload: { projectId: state.activeProjectId, messages: fullHistory }
    });

    // If not queued, send immediately
    if (!queuedUntil) {
      console.log('[DEBUG] Triggering agent response immediately');
      await triggerAgentResponse(fullHistory, state.activeProjectId);
    } else {
      console.log('[DEBUG] Message queued until:', queuedUntil);
    }
    // If queued, the interval will handle sending when time arrives
  }, [state.activeProjectId, state.projects, state.lastAgentResponseTime, triggerAgentResponse]);

  // Process queued messages - check every second for messages ready to send
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.activeProjectId) return;

      const activeProject = state.projects.find(p => p.id === state.activeProjectId);
      if (!activeProject) return;

      // Find queued messages that are ready to send
      const now = new Date();
      const queuedMessages = activeProject.messages.filter(m => m.queuedUntil && m.queuedUntil <= now);

      if (queuedMessages.length > 0) {
        // Process the first queued message
        const messageToSend = queuedMessages[0];
        console.log(`[Message Queue] Processing queued message: ${messageToSend.id}`);

        // Remove queuedUntil from the message
        dispatch({
          type: 'MESSAGE_DEQUEUED',
          payload: { projectId: state.activeProjectId, messageId: messageToSend.id }
        });

        // Trigger agent response
        triggerAgentResponse(activeProject.messages, state.activeProjectId);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!state.activeProjectId) return;

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
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
    dispatch({
      type: 'MESSAGES_TRUNCATED',
      payload: { projectId: state.activeProjectId, messages: newHistory }
    });

    // Use handleSendMessage logic to queue if needed
    await triggerAgentResponse(newHistory, state.activeProjectId);
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleResendFromMessage = useCallback(async (messageId: string) => {
    if (!state.activeProjectId) return;

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Truncate messages after this one (inclusive of responses)
    const truncatedMessages = activeProject.messages.slice(0, messageIndex + 1);

    // Update the project with the truncated history
    dispatch({
      type: 'MESSAGES_TRUNCATED',
      payload: { projectId: state.activeProjectId, messages: truncatedMessages }
    });

    await triggerAgentResponse(truncatedMessages, state.activeProjectId);
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleRegenerateResponse = useCallback(async (messageId: string) => {
    if (!state.activeProjectId) return;

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    // Find the message index
    const messageIndex = activeProject.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove this message (the last agent response) and regenerate
    const truncatedMessages = activeProject.messages.slice(0, messageIndex);

    // Update the project
    dispatch({
      type: 'MESSAGES_TRUNCATED',
      payload: { projectId: state.activeProjectId, messages: truncatedMessages }
    });

    await triggerAgentResponse(truncatedMessages, state.activeProjectId);
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleStopGeneration = useCallback(() => {
    if (state.abortController) {
      state.abortController.abort();
      dispatch({ type: 'LOADING_STOPPED' });
    }
  }, [state.abortController]);

  const handleApproveChanges = useCallback(async (messageId: string, changes: AgentProposedChanges) => {
    if (!state.activeProjectId) return;

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) return;

    try {
      // Extract repo info from codebase context
      const repoInfo = extractRepoInfo(activeProject.codebaseContext);
      if (!repoInfo) {
        toast.error('Could not determine repository from codebase context. Please include GitHub URL in project.');
        return;
      }

      // Get GitHub PAT from settings
      if (!state.settings.githubPat) {
        toast.error('GitHub Personal Access Token not configured. Please add it in Settings.');
        return;
      }

      toast.info('Pushing changes to GitHub...');

      // Commit to GitHub using the API
      const result = await commitToGitHub(
        changes,
        state.settings.githubPat,
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
      dispatch({
        type: 'PROJECT_CODEBASE_UPDATED',
        payload: { id: state.activeProjectId, codebaseContext: updatedContext }
      });

      // Remove proposedChanges from the message since they've been applied
      dispatch({
        type: 'PROPOSED_CHANGES_REMOVED',
        payload: { projectId: state.activeProjectId, messageId }
      });

      toast.success(
        `✅ Pushed ${changes.changes.length} file(s) to ${repoInfo.owner}/${repoInfo.repo}@${result.branchName}`,
        { autoClose: 5000 }
      );
    } catch (error) {
      console.error('Failed to apply changes:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to push changes: ${errorMsg}`);
    }
  }, [state.activeProjectId, state.projects, state.settings]);

  const handleRejectChanges = useCallback(async (messageId: string) => {
    if (!state.activeProjectId) return;

    // Simply remove proposedChanges from the message
    dispatch({
      type: 'PROPOSED_CHANGES_REMOVED',
      payload: { projectId: state.activeProjectId, messageId }
    });

    toast.info('Proposed changes rejected');
  }, [state.activeProjectId]);

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

      dispatch({ type: 'RUSTY_CODEBASE_UPDATED', payload: codebase });
      dispatch({ type: 'RUSTY_CONNECTION_STATUS', payload: true });

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
      dispatch({ type: 'PROJECTS_LOADED', payload: loadedProjects });

      toast.success('Projects imported successfully!');
    } catch (error) {
      console.error('Failed to import projects:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import projects');
    }
  }, []);

  const handleExportChat = useCallback(async () => {
    if (!state.activeProjectId) {
      toast.error('No active project to export');
      return;
    }

    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
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
  }, [state.activeProjectId, state.projects]);

  const handleRenameProject = useCallback(async (id: string, newName: string) => {
    try {
      dispatch({ type: 'PROJECT_RENAMED', payload: { id, newName } });
      toast.success('Project renamed!');
    } catch (error) {
      console.error('Failed to rename project:', error);
      toast.error('Failed to rename project');
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await indexedDbService.deleteProject(id);
      dispatch({ type: 'PROJECT_DELETED', payload: id });
      toast.success('Project deleted');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  }, []);

  const handleUpdateProjectSettings = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      dispatch({ type: 'PROJECT_UPDATED', payload: { id, updates } });

      // Persist to IndexedDB
      indexedDbService.updateProject(id, updates).catch(error => {
        console.error('Failed to update project settings in DB:', error);
        toast.error('Failed to save project settings');
      });
    } catch (error) {
      console.error('Failed to update project settings:', error);
      toast.error('Failed to update project settings');
    }
  }, [state.projects]);

  // Rusty Chat Management Handlers
  const handleNewRustyChat = useCallback(async () => {
    if (!state.activeProjectId) return;

    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;

    const newChat = {
      id: crypto.randomUUID(),
      name: `Chat ${project.rustyChats.length + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dispatch({
      type: 'RUSTY_CHAT_CREATED',
      payload: { projectId: state.activeProjectId, chat: newChat }
    });

    await indexedDbService.updateProject(state.activeProjectId, {
      rustyChats: [...project.rustyChats, newChat],
      activeRustyChatId: newChat.id
    });

    toast.success('New Rusty chat created');
  }, [state.activeProjectId, state.projects]);

  const handleSwitchRustyChat = useCallback(async (chatId: string) => {
    if (!state.activeProjectId) return;

    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;

    dispatch({
      type: 'RUSTY_CHAT_SWITCHED',
      payload: { projectId: state.activeProjectId, chatId }
    });

    await indexedDbService.updateProject(state.activeProjectId, { activeRustyChatId: chatId });
  }, [state.activeProjectId, state.projects]);

  const handleDeleteRustyChat = useCallback(async (chatId: string) => {
    if (!state.activeProjectId) return;

    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;

    dispatch({
      type: 'RUSTY_CHAT_DELETED',
      payload: { projectId: state.activeProjectId, chatId }
    });

    const updatedChats = project.rustyChats.filter(c => c.id !== chatId);
    const newActiveChatId = project.activeRustyChatId === chatId
      ? updatedChats[0]?.id
      : project.activeRustyChatId;

    await indexedDbService.updateProject(state.activeProjectId, {
      rustyChats: updatedChats,
      activeRustyChatId: newActiveChatId
    });

    toast.success('Chat deleted');
  }, [state.activeProjectId, state.projects]);

  const handleUpdateRustyChat = useCallback(async (chatId: string, messages: any[]) => {
    if (!state.activeProjectId) return;

    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;

    dispatch({
      type: 'RUSTY_CHAT_UPDATED',
      payload: { projectId: state.activeProjectId, chatId, messages }
    });

    const updatedChats = project.rustyChats.map(c =>
      c.id === chatId ? { ...c, messages, updatedAt: new Date() } : c
    );

    await indexedDbService.updateProject(state.activeProjectId, { rustyChats: updatedChats });
  }, [state.activeProjectId, state.projects]);

  // Auto-invoke Rusty when errors occur
  const handleAutoInvokeRusty = useCallback(async (errorMessage: string, projectId: string) => {
    const project = state.projects.find(p => p.id === projectId);
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
        sourceFiles: state.rustyCodebaseContext,
      }, state.settings.rustyApiKey);

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
            onClick={() => dispatch({ type: 'MODAL_OPENED', payload: 'rustyChat' })}
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
  }, [state.projects, state.rustyCodebaseContext, state.settings.rustyApiKey, handleUpdateRustyChat]);

  // Workflow approval handlers
  const handleWorkflowApprove = useCallback(() => {
    if (!state.activeProjectId) return;
    dispatch({ type: 'WORKFLOW_APPROVED', payload: { projectId: state.activeProjectId } });
    toast.success('Workflow approved! Continuing execution...');

    // Trigger the next stage of execution
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (activeProject?.activeTaskState) {
      // Re-trigger agent response to continue from where we paused
      triggerAgentResponse(activeProject.messages, state.activeProjectId);
    }
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleWorkflowEdit = useCallback((editedPlan: ActiveTaskState) => {
    if (!state.activeProjectId) return;
    dispatch({
      type: 'WORKFLOW_PLAN_UPDATED',
      payload: { projectId: state.activeProjectId, updatedPlan: editedPlan }
    });
    toast.success('Workflow plan updated! Continuing with modified plan...');

    // Continue execution with updated plan
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (activeProject) {
      triggerAgentResponse(activeProject.messages, state.activeProjectId);
    }
  }, [state.activeProjectId, state.projects, triggerAgentResponse]);

  const handleWorkflowCancel = useCallback(() => {
    if (!state.activeProjectId) return;
    dispatch({ type: 'WORKFLOW_CANCELLED', payload: { projectId: state.activeProjectId } });
    toast.info('Workflow cancelled');
  }, [state.activeProjectId]);

  const activeProject = state.projects.find(p => p.id === state.activeProjectId) || null;
  const activeAgent = AGENT_PROFILES.find(a => a.id === state.activeAgentId) || null;

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
          projects={state.projects}
          activeProjectId={state.activeProjectId}
          onSelectProject={handleSelectProject}
          onNewProjectClick={() => dispatch({ type: 'MODAL_OPENED', payload: 'newProject' })}
          onSettingsClick={() => dispatch({ type: 'MODAL_OPENED', payload: 'settings' })}
          activeAgentId={state.activeAgentId}
          onExportProjects={handleExportProjects}
          onImportProjects={handleImportProjects}
          onExportChat={handleExportChat}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
        />
        <ChatView
          ref={messageInputRef}
          activeProject={activeProject}
          isLoading={state.isLoading}
          onSendMessage={handleSendMessage}
          onAddContext={handleAddContext}
          activeAgent={activeAgent}
          apiKey={activeProject?.apiKey || state.settings.apiKey}
          onEditMessage={handleEditMessage}
          onResendFromMessage={handleResendFromMessage}
          onRegenerateResponse={handleRegenerateResponse}
          onStopGeneration={handleStopGeneration}
          onOpenRusty={() => dispatch({ type: 'MODAL_OPENED', payload: 'rustyChat' })}
          onOpenProjectSettings={() => dispatch({ type: 'MODAL_OPENED', payload: 'projectSettings' })}
          onApproveChanges={handleApproveChanges}
          onRejectChanges={handleRejectChanges}
          onWorkflowApprove={handleWorkflowApprove}
          onWorkflowEdit={handleWorkflowEdit}
          onWorkflowCancel={handleWorkflowCancel}
        />
      </div>

      {state.isNewProjectModalOpen && (
        <NewProjectModal
          onClose={() => dispatch({ type: 'MODAL_CLOSED', payload: 'newProject' })}
          onCreateProject={handleCreateProject}
        />
      )}

      {state.isSettingsModalOpen && (
        <SettingsModal
          onClose={() => dispatch({ type: 'MODAL_CLOSED', payload: 'settings' })}
          onSave={handleSaveSettings}
          initialSettings={state.settings}
        />
      )}

      {state.isProjectSettingsModalOpen && activeProject && (
        <ProjectSettingsModal
          onClose={() => dispatch({ type: 'MODAL_CLOSED', payload: 'projectSettings' })}
          onSave={(updates) => handleUpdateProjectSettings(activeProject.id, updates)}
          project={activeProject}
        />
      )}

      <KeyboardShortcutsModal
        isOpen={state.isKeyboardShortcutsOpen}
        onClose={() => dispatch({ type: 'MODAL_CLOSED', payload: 'keyboardShortcuts' })}
      />

      {state.isRustyChatOpen && activeProject && (
        <RustyChatModal
          onClose={() => dispatch({ type: 'MODAL_CLOSED', payload: 'rustyChat' })}
          apiKey={state.settings.rustyApiKey}
          codebaseContext={state.rustyCodebaseContext}
          isConnected={state.isRustyConnected}
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