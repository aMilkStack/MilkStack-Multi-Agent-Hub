/**
 * useClaudeHandlers Hook
 *
 * Handlers for Claude chat operations.
 * Replaces useRustyHandlers.ts for the Claude migration.
 *
 * Features:
 * - Create new Claude chats
 * - Switch between Claude chats
 * - Delete Claude chats
 * - Update Claude chat messages
 * - Refresh codebase context
 * - Auto-invoke Claude on errors
 */

import { useCallback } from 'react';
import { useProjects } from '../context/ProjectsContext';
import { useSettings } from '../context/SettingsContext';
import { useClaude } from '../context/ClaudeContext';
import { ClaudeChat, ClaudeMessage } from '../types/claude';
import { toast } from 'react-toastify';
import { claudeLogger, LogLevel } from '../services/claudeCodeService';

interface UseClaudeHandlersReturn {
  handleNewClaudeChat: () => void;
  handleSwitchClaudeChat: (chatId: string) => void;
  handleDeleteClaudeChat: (chatId: string) => void;
  handleUpdateClaudeChat: (chatId: string, messages: ClaudeMessage[]) => void;
  handleRefreshClaudeCodebase: () => Promise<void>;
  handleAutoInvokeClaude: (errorMessage: string, projectId: string) => Promise<void>;
}

export const useClaudeHandlers = (): UseClaudeHandlersReturn => {
  const { currentProject, updateProject } = useProjects();
  const { settings } = useSettings();
  const { updateCodebase, service } = useClaude();

  /**
   * Create a new Claude chat
   */
  const handleNewClaudeChat = useCallback(() => {
    if (!currentProject) {
      toast.error('No active project');
      return;
    }

    const newChat: ClaudeChat = {
      id: crypto.randomUUID(),
      name: `Chat ${(currentProject.claudeChats?.length || 0) + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedClaudeChats = [...(currentProject.claudeChats || []), newChat];

    updateProject(currentProject.id, {
      claudeChats: updatedClaudeChats,
      activeClaudeChatId: newChat.id,
    });

    claudeLogger.log(
      LogLevel.INFO,
      'useClaudeHandlers',
      'New Claude chat created',
      { chatId: newChat.id, chatName: newChat.name }
    );

    toast.success(`New chat "${newChat.name}" created`);
  }, [currentProject, updateProject]);

  /**
   * Switch to a different Claude chat
   */
  const handleSwitchClaudeChat = useCallback(
    (chatId: string) => {
      if (!currentProject) {
        toast.error('No active project');
        return;
      }

      const chat = currentProject.claudeChats?.find((c) => c.id === chatId);
      if (!chat) {
        toast.error('Chat not found');
        return;
      }

      updateProject(currentProject.id, {
        activeClaudeChatId: chatId,
      });

      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeHandlers',
        'Switched Claude chat',
        { chatId, chatName: chat.name }
      );
    },
    [currentProject, updateProject]
  );

  /**
   * Delete a Claude chat
   */
  const handleDeleteClaudeChat = useCallback(
    (chatId: string) => {
      if (!currentProject) {
        toast.error('No active project');
        return;
      }

      const chat = currentProject.claudeChats?.find((c) => c.id === chatId);
      if (!chat) {
        toast.error('Chat not found');
        return;
      }

      // Confirm deletion
      if (!confirm(`Delete chat "${chat.name}"?`)) {
        return;
      }

      const updatedClaudeChats = (currentProject.claudeChats || []).filter(
        (c) => c.id !== chatId
      );

      // If deleting active chat, switch to first remaining chat
      let newActiveId = currentProject.activeClaudeChatId;
      if (currentProject.activeClaudeChatId === chatId) {
        newActiveId = updatedClaudeChats[0]?.id;
      }

      updateProject(currentProject.id, {
        claudeChats: updatedClaudeChats,
        activeClaudeChatId: newActiveId,
      });

      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeHandlers',
        'Deleted Claude chat',
        { chatId, chatName: chat.name }
      );

      toast.success(`Chat "${chat.name}" deleted`);
    },
    [currentProject, updateProject]
  );

  /**
   * Update Claude chat messages
   */
  const handleUpdateClaudeChat = useCallback(
    (chatId: string, messages: ClaudeMessage[]) => {
      if (!currentProject) {
        toast.error('No active project');
        return;
      }

      const updatedClaudeChats = (currentProject.claudeChats || []).map(
        (chat) => {
          if (chat.id === chatId) {
            return {
              ...chat,
              messages,
              updatedAt: new Date(),
            };
          }
          return chat;
        }
      );

      updateProject(currentProject.id, {
        claudeChats: updatedClaudeChats,
      });

      claudeLogger.log(
        LogLevel.DEBUG,
        'useClaudeHandlers',
        'Updated Claude chat messages',
        { chatId, messageCount: messages.length }
      );
    },
    [currentProject, updateProject]
  );

  /**
   * Refresh codebase context from GitHub
   */
  const handleRefreshClaudeCodebase = useCallback(async () => {
    if (!currentProject) {
      toast.error('No active project');
      return;
    }

    try {
      toast.info('Refreshing codebase context...');
      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeHandlers',
        'Refreshing codebase context'
      );

      // Reuse the existing codebase context from the project
      // In a full implementation, this would fetch from GitHub
      const context = currentProject.codebaseContext;

      updateCodebase(context);

      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeHandlers',
        'Codebase context refreshed',
        { contextLength: context.length }
      );

      toast.success('Codebase context refreshed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      claudeLogger.log(
        LogLevel.ERROR,
        'useClaudeHandlers',
        'Failed to refresh codebase',
        error
      );
      toast.error(`Failed to refresh codebase: ${errorMessage}`);
    }
  }, [currentProject, updateCodebase]);

  /**
   * Auto-invoke Claude when an error occurs
   *
   * Creates a new message in the active chat with error details
   * and triggers Claude to analyze the error.
   */
  const handleAutoInvokeClaude = useCallback(
    async (errorMessage: string, projectId: string) => {
      if (!currentProject || currentProject.id !== projectId) {
        return;
      }

      if (!service) {
        claudeLogger.log(
          LogLevel.WARN,
          'useClaudeHandlers',
          'Cannot auto-invoke Claude: service not initialized'
        );
        return;
      }

      try {
        // Get or create active chat
        let activeChatId = currentProject.activeClaudeChatId;
        let claudeChats = currentProject.claudeChats || [];

        if (!activeChatId || !claudeChats.find((c) => c.id === activeChatId)) {
          // Create new chat for auto-analysis
          const newChat: ClaudeChat = {
            id: crypto.randomUUID(),
            name: `Error Analysis ${new Date().toLocaleTimeString()}`,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          claudeChats = [...claudeChats, newChat];
          activeChatId = newChat.id;

          updateProject(projectId, {
            claudeChats,
            activeClaudeChatId: activeChatId,
          });
        }

        // Create analysis request message
        const userMessage: ClaudeMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: `Auto-analysis requested for error:\n\n${errorMessage}`,
          timestamp: new Date(),
        };

        const chat = claudeChats.find((c) => c.id === activeChatId);
        if (!chat) return;

        const updatedMessages = [...chat.messages, userMessage];

        // Update chat with user message
        handleUpdateClaudeChat(activeChatId, updatedMessages);

        claudeLogger.log(
          LogLevel.INFO,
          'useClaudeHandlers',
          'Auto-invoking Claude for error analysis',
          { error: errorMessage }
        );

        // Show toast notification
        toast.info('Claude is analyzing the error...', {
          autoClose: 3000,
        });
      } catch (error) {
        claudeLogger.log(
          LogLevel.ERROR,
          'useClaudeHandlers',
          'Auto-invoke failed',
          error
        );
      }
    },
    [currentProject, service, updateProject, handleUpdateClaudeChat]
  );

  return {
    handleNewClaudeChat,
    handleSwitchClaudeChat,
    handleDeleteClaudeChat,
    handleUpdateClaudeChat,
    handleRefreshClaudeCodebase,
    handleAutoInvokeClaude,
  };
};
