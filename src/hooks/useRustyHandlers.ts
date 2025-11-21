/**
 * useRustyHandlers Hook
 * Extracts Rusty-related handlers from App.tsx for better separation of concerns
 */

import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useProjects } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import { useRusty } from '../context/RustyContext';
import { invokeRustyPortable, rustyLogger, LogLevel } from '../services/rustyPortableService';
import { fetchGitHubRepository } from '../services/githubService';
import { getRustyGitHubToken, getRustyRepoUrl, RUSTY_GLOBAL_CONFIG } from '../config/rustyConfig';

export function useRustyHandlers() {
  const { projects, activeProjectId, updateProject } = useProjects();
  const { settings } = useSettings();
  const { rustyCodebaseContext, updateCodebase: updateRustyCodebase, setConnectionStatus } = useRusty();

  // Global Rusty refresh handler
  const handleRefreshRustyCodebase = useCallback(async () => {
    try {
      const token = getRustyGitHubToken();
      const repoUrl = getRustyRepoUrl();

      rustyLogger.log(
        LogLevel.INFO,
        'App',
        `Refreshing Rusty's connection to ${repoUrl}...`
      );

      toast.info(`Syncing Rusty with ${repoUrl}...`);

      const fullRepoUrl = `https://github.com/${repoUrl}/tree/${RUSTY_GLOBAL_CONFIG.repo.branch}`;
      const codebase = await fetchGitHubRepository(fullRepoUrl, token);

      updateRustyCodebase(codebase);
      setConnectionStatus(true);

      rustyLogger.log(
        LogLevel.INFO,
        'App',
        `Rusty codebase refreshed successfully`
      );

      toast.success(`Rusty synced with latest code from ${repoUrl}`);
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

  // Create new Rusty chat
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

  // Switch Rusty chat
  const handleSwitchRustyChat = useCallback(async (chatId: string) => {
    if (!activeProjectId) return;
    updateProject(activeProjectId, { activeRustyChatId: chatId });
  }, [activeProjectId, updateProject]);

  // Delete Rusty chat
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

  // Update Rusty chat messages
  const handleUpdateRustyChat = useCallback(async (chatId: string, messages: any[]) => {
    if (!activeProjectId) return;

    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const updatedChats = project.rustyChats.map(c =>
      c.id === chatId ? { ...c, messages, updatedAt: new Date() } : c
    );

    updateProject(activeProjectId, { rustyChats: updatedChats });
  }, [activeProjectId, projects, updateProject]);

  // Auto-invoke Rusty when errors occur
  const handleAutoInvokeRusty = useCallback(async (
    errorMessage: string,
    projectId: string,
    openRustyChat: () => void
  ) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.activeRustyChatId) return;

    try {
      const rustyAutoMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: `Auto-analysis requested: An error occurred in the project.\n\nError: ${errorMessage}\n\nPlease analyze what might have caused this error and suggest fixes.`,
        timestamp: new Date(),
      };

      const currentChat = project.rustyChats.find(c => c.id === project.activeRustyChatId);
      if (!currentChat) return;

      const updatedMessages = [...currentChat.messages, rustyAutoMessage];
      const updatedChats = project.rustyChats.map(c =>
        c.id === project.activeRustyChatId ? { ...c, messages: updatedMessages, updatedAt: new Date() } : c
      );
      updateProject(projectId, { rustyChats: updatedChats });

      const response = await invokeRustyPortable({
        userQuery: rustyAutoMessage.content,
        sourceFiles: rustyCodebaseContext,
      }, settings.apiKey);

      const rustyResponseMessage = {
        id: crypto.randomUUID(),
        role: 'rusty' as const,
        content: response.review,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, rustyResponseMessage];
      const finalChats = project.rustyChats.map(c =>
        c.id === project.activeRustyChatId ? { ...c, messages: finalMessages, updatedAt: new Date() } : c
      );
      updateProject(projectId, { rustyChats: finalChats });

      const analysisPreview = response.review.slice(0, 150) + (response.review.length > 150 ? '...' : '');
      toast.info(
        <div className="flex flex-col gap-2">
          <div className="font-bold flex items-center gap-2">
            <span>Rusty analyzed the error:</span>
          </div>
          <div className="text-sm text-milk-slate-light">{analysisPreview}</div>
          <button
            onClick={openRustyChat}
            className="mt-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-sm transition-colors"
          >
            Open Rusty Chat
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
  }, [projects, rustyCodebaseContext, settings.apiKey, updateProject]);

  return {
    handleRefreshRustyCodebase,
    handleNewRustyChat,
    handleSwitchRustyChat,
    handleDeleteRustyChat,
    handleUpdateRustyChat,
    handleAutoInvokeRusty,
  };
}
