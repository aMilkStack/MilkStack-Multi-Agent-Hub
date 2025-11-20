import { useState, useRef, useEffect } from 'react';
import { RustyMessage } from '../../types';
import { invokeRustyPortable, rustyLogger, LogLevel, RustyAnalysis } from '../services/rustyPortableService';

interface UseRustyChatParams {
  activeRustyChatId: string | undefined;
  messages: RustyMessage[];
  codebaseContext: string | undefined;
  apiKey: string | undefined;
  onUpdateChat: (chatId: string, messages: RustyMessage[]) => void;
}

/**
 * Custom hook to manage Rusty chat logic
 * Handles message sending, loading state, and auto-scrolling
 */
export const useRustyChat = ({
  activeRustyChatId,
  messages,
  codebaseContext,
  apiKey,
  onUpdateChat,
}: UseRustyChatParams) => {
  const [isLoading, setIsLoading] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<RustyAnalysis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !activeRustyChatId) return;

    // Add user message
    const userMessage: RustyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    onUpdateChat(activeRustyChatId, updatedMessages);
    setIsLoading(true);

    try {
      rustyLogger.log(LogLevel.INFO, 'RustyChat', 'User message sent to Rusty', { content });

      // Call Rusty with the user's query and full codebase context (no truncation)
      const response = await invokeRustyPortable({
        userQuery: content,
        sourceFiles: codebaseContext, // Pass full untruncated context
      }, apiKey);

      // Store the latest analysis for potential commit to rusty.md
      setLatestAnalysis(response);

      const rustyMessage: RustyMessage = {
        id: crypto.randomUUID(),
        role: 'rusty',
        content: response.review,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, rustyMessage];
      onUpdateChat(activeRustyChatId, finalMessages);
      rustyLogger.log(LogLevel.INFO, 'RustyChat', 'Rusty response received', {
        grade: response.grade,
        criticalIssues: response.criticalIssues,
      });

    } catch (error) {
      console.error('Error calling Rusty:', error);
      rustyLogger.log(LogLevel.ERROR, 'RustyChat', 'Failed to get Rusty response', { error });

      const errorMessage: RustyMessage = {
        id: crypto.randomUUID(),
        role: 'rusty',
        content: `Oops! I encountered an error: ${error instanceof Error ? error.message : String(error)}

This usually means there's an API key issue or network problem. Check the console for details!`,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, errorMessage];
      onUpdateChat(activeRustyChatId, finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    latestAnalysis,
    messagesEndRef,
    handleSendMessage,
  };
};
