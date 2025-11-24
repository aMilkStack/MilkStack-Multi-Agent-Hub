/**
 * useClaudeChat Hook
 *
 * Custom React hook for managing Claude chat interactions.
 * Replaces useRustyChat.ts for the Claude migration.
 *
 * Features:
 * - Send messages to Claude
 * - Stream responses in real-time
 * - Handle loading states
 * - Track tool usage
 * - Auto-scroll to latest message
 * - Error handling
 * - Session management for SDK
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ClaudeMessage, ToolActivity, ClaudeSession } from '../types/claude';
import { useClaude } from '../context/ClaudeContext';
import { claudeLogger, LogLevel } from '../services/claudeCodeService';

interface UseClaudeChatParams {
  activeChatId: string | undefined;
  messages: ClaudeMessage[];
  onUpdateChat: (chatId: string, messages: ClaudeMessage[]) => void;
  /** Optional session ID for resuming SDK conversations */
  sessionId?: string;
  /** Callback when session info is updated */
  onSessionUpdate?: (session: ClaudeSession) => void;
}

interface UseClaudeChatReturn {
  isLoading: boolean;
  streamingContent: string;
  toolActivity: ToolActivity[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSendMessage: (content: string) => Promise<void>;
  handleCancelMessage: () => void;
  latestAnalysis: null; // For compatibility with Rusty interface
  /** Current session info (for SDK mode) */
  currentSession: ClaudeSession | null;
  /** Active tool activities */
  activeTools: ToolActivity[];
}

export const useClaudeChat = ({
  activeChatId,
  messages,
  onUpdateChat,
  sessionId: _sessionId,
  onSessionUpdate,
}: UseClaudeChatParams): UseClaudeChatReturn => {
  const { service, isConnected, currentSessionId } = useClaude();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
  const [currentSession, setCurrentSession] = useState<ClaudeSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Initialize session tracking
  useEffect(() => {
    if (currentSessionId && !currentSession) {
      const newSession: ClaudeSession = {
        sessionId: currentSessionId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        numTurns: 0,
        totalCostUsd: 0,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
      };
      setCurrentSession(newSession);
    }
  }, [currentSessionId, currentSession]);

  /**
   * Add a tool activity entry
   */
  const addToolActivity = useCallback((toolName: string, description?: string) => {
    const activity: ToolActivity = {
      toolName,
      status: 'running',
      startTime: new Date(),
      description,
    };
    setToolActivity((prev) => [...prev, activity]);
  }, []);

  /**
   * Update tool activity status
   */
  const updateToolActivity = useCallback(
    (toolName: string, status: 'completed' | 'error', elapsedSeconds?: number) => {
      setToolActivity((prev) =>
        prev.map((activity) =>
          activity.toolName === toolName && activity.status === 'running'
            ? {
                ...activity,
                status,
                endTime: new Date(),
                elapsedSeconds,
              }
            : activity
        )
      );
    },
    []
  );

  /**
   * Get active (running) tools
   */
  const activeTools = toolActivity.filter((t) => t.status === 'running');

  /**
   * Send a message to Claude and handle streaming response
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !activeChatId || !service || !isConnected) {
        claudeLogger.log(
          LogLevel.WARN,
          'useClaudeChat',
          'Cannot send message: missing requirements',
          { hasContent: !!content.trim(), activeChatId, hasService: !!service, isConnected }
        );
        return;
      }

      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeChat',
        'Sending message to Claude',
        { chatId: activeChatId, messageLength: content.length }
      );

      // Create user message
      const userMessage: ClaudeMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      onUpdateChat(activeChatId, updatedMessages);

      setIsLoading(true);
      setStreamingContent('');
      setToolActivity([]);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      try {
        let fullResponse = '';
        const toolsUsed: string[] = [];
        const filesAccessed: string[] = [];
        let inputTokens = 0;
        let outputTokens = 0;

        // Stream the response
        for await (const chunk of service.chatStream(
          content,
          messages,
          (toolName, input) => {
            addToolActivity(toolName, `Using ${toolName}...`);
            toolsUsed.push(toolName);

            if (input && typeof input === 'object' && 'file_path' in input) {
              filesAccessed.push(input.file_path as string);
            }
          }
        )) {
          if (abortControllerRef.current?.signal.aborted) {
            claudeLogger.log(
              LogLevel.INFO,
              'useClaudeChat',
              'Message cancelled by user'
            );
            break;
          }

          if (chunk.type === 'text') {
            fullResponse += chunk.content;
            setStreamingContent(fullResponse);
          } else if (chunk.type === 'tool') {
            // Tool progress update - mark as completed
            const toolName = chunk.metadata?.toolName;
            if (toolName) {
              updateToolActivity(toolName, 'completed', chunk.metadata?.duration);
            }
          } else if (chunk.type === 'complete') {
            inputTokens = chunk.metadata?.usage?.inputTokens || 0;
            outputTokens = chunk.metadata?.usage?.outputTokens || 0;

            // Update session info
            if (currentSession) {
              const updatedSession: ClaudeSession = {
                ...currentSession,
                lastActivityAt: new Date(),
                numTurns: currentSession.numTurns + 1,
                totalCostUsd: currentSession.totalCostUsd + (chunk.metadata?.cost || 0),
                usage: {
                  ...currentSession.usage,
                  inputTokens: currentSession.usage.inputTokens + inputTokens,
                  outputTokens: currentSession.usage.outputTokens + outputTokens,
                },
              };
              setCurrentSession(updatedSession);
              onSessionUpdate?.(updatedSession);
            }

            claudeLogger.log(
              LogLevel.INFO,
              'useClaudeChat',
              'Response complete',
              {
                tokens: inputTokens + outputTokens,
                cost: chunk.metadata?.cost,
              }
            );
          } else if (chunk.type === 'error') {
            throw new Error(chunk.content);
          }
        }

        // Create Claude's response message
        const claudeMessage: ClaudeMessage = {
          id: crypto.randomUUID(),
          role: 'claude',
          content: fullResponse,
          timestamp: new Date(),
          metadata: {
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            filesAccessed: filesAccessed.length > 0 ? filesAccessed : undefined,
            usage:
              inputTokens > 0
                ? {
                    inputTokens,
                    outputTokens,
                  }
                : undefined,
          },
        };

        const finalMessages = [...updatedMessages, claudeMessage];
        onUpdateChat(activeChatId, finalMessages);
        setStreamingContent('');
        // Mark all running tools as completed
        setToolActivity((prev) =>
          prev.map((t) => (t.status === 'running' ? { ...t, status: 'completed' as const, endTime: new Date() } : t))
        );

        claudeLogger.log(
          LogLevel.INFO,
          'useClaudeChat',
          'Message sent successfully'
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        claudeLogger.log(
          LogLevel.ERROR,
          'useClaudeChat',
          'Failed to send message',
          error
        );

        // Mark all running tools as error
        setToolActivity((prev) =>
          prev.map((t) => (t.status === 'running' ? { ...t, status: 'error' as const, endTime: new Date() } : t))
        );

        const errorResponse: ClaudeMessage = {
          id: crypto.randomUUID(),
          role: 'claude',
          content: `I encountered an error: ${errorMessage}\n\nPlease check your API key and connection.`,
          timestamp: new Date(),
        };

        const finalMessages = [...updatedMessages, errorResponse];
        onUpdateChat(activeChatId, finalMessages);
        setStreamingContent('');
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [activeChatId, messages, service, isConnected, onUpdateChat, currentSession, onSessionUpdate, addToolActivity, updateToolActivity]
  );

  /**
   * Cancel ongoing message generation
   */
  const handleCancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setStreamingContent('');
      // Mark all running tools as error (cancelled)
      setToolActivity((prev) =>
        prev.map((t) => (t.status === 'running' ? { ...t, status: 'error' as const, endTime: new Date() } : t))
      );

      claudeLogger.log(
        LogLevel.INFO,
        'useClaudeChat',
        'Message generation cancelled'
      );
    }
  }, []);

  return {
    isLoading,
    streamingContent,
    toolActivity,
    messagesEndRef,
    handleSendMessage,
    handleCancelMessage,
    latestAnalysis: null, // For compatibility with Rusty interface
    currentSession,
    activeTools,
  };
};
