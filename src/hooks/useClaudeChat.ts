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
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ClaudeMessage } from '../types/claude';
import { useClaude } from '../context/ClaudeContext';
import { claudeLogger, LogLevel } from '../services/claudeCodeService';

interface UseClaudeChatParams {
  activeChatId: string | undefined;
  messages: ClaudeMessage[];
  onUpdateChat: (chatId: string, messages: ClaudeMessage[]) => void;
}

interface UseClaudeChatReturn {
  isLoading: boolean;
  streamingContent: string;
  toolActivity: string[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleSendMessage: (content: string) => Promise<void>;
  handleCancelMessage: () => void;
  latestAnalysis: null; // For compatibility with Rusty interface
}

export const useClaudeChat = ({
  activeChatId,
  messages,
  onUpdateChat,
}: UseClaudeChatParams): UseClaudeChatReturn => {
  const { service, isConnected, codebaseContext } = useClaude();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

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
            setToolActivity((prev) => [...prev, `Using ${toolName}...`]);
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
            setToolActivity((prev) => [...prev, chunk.content]);
          } else if (chunk.type === 'complete') {
            inputTokens = chunk.metadata?.usage?.inputTokens || 0;
            outputTokens = chunk.metadata?.usage?.outputTokens || 0;

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
        setToolActivity([]);

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

        const errorResponse: ClaudeMessage = {
          id: crypto.randomUUID(),
          role: 'claude',
          content: `I encountered an error: ${errorMessage}\n\nPlease check your API key and connection.`,
          timestamp: new Date(),
        };

        const finalMessages = [...updatedMessages, errorResponse];
        onUpdateChat(activeChatId, finalMessages);
        setStreamingContent('');
        setToolActivity([]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [activeChatId, messages, service, isConnected, onUpdateChat]
  );

  /**
   * Cancel ongoing message generation
   */
  const handleCancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setStreamingContent('');
      setToolActivity([]);

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
  };
};
