/**
 * Claude Context
 *
 * Global React context for Claude Code service state management.
 * Replaces RustyContext.tsx for the Claude migration.
 *
 * Provides:
 * - Claude service instance
 * - Codebase context
 * - Connection status
 * - Initialization and cleanup
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { ClaudeCodeService } from '../services/claudeCodeService';
import { getClaudeApiKey } from '../config/claudeConfig';
import { useSettings } from './SettingsContext';

interface ClaudeContextValue {
  // Service instances
  service: ClaudeCodeService | null;

  // State
  isConnected: boolean;
  codebaseContext: string;
  currentSessionId: string | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  updateCodebase: (context: string) => void;
  setConnectionStatus: (connected: boolean) => void;
  disconnect: () => void;
}

const ClaudeContext = createContext<ClaudeContextValue | undefined>(undefined);

interface ClaudeProviderProps {
  children: ReactNode;
}

export const ClaudeProvider: React.FC<ClaudeProviderProps> = ({ children }) => {
  const { settings } = useSettings();
  const [service, setService] = useState<ClaudeCodeService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [codebaseContext, setCodebaseContext] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize Claude service with API key
   *
   * Priority order:
   * 1. Global settings (settings.claudeApiKey)
   * 2. localStorage (anthropic_api_key)
   * 3. Environment variable (VITE_ANTHROPIC_API_KEY)
   */
  const initialize = useCallback(async () => {
    try {
      setError(null);

      // Check global settings first
      let apiKey = settings.claudeApiKey;

      // Fallback to localStorage and env
      if (!apiKey) {
        apiKey = getClaudeApiKey();
      }

      if (!apiKey) {
        throw new Error('Claude API key not found. Please add your Anthropic API key in settings.');
      }

      const newService = new ClaudeCodeService(apiKey);
      setService(newService);
      setIsConnected(true);
      setCurrentSessionId(crypto.randomUUID());

      console.log('[ClaudeContext] Initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Claude';
      console.error('[ClaudeContext] Initialization failed:', err);
      setError(errorMessage);
      setIsConnected(false);
      throw err;
    }
  }, [settings.claudeApiKey]);

  /**
   * Update codebase context (source code to analyze)
   */
  const updateCodebase = useCallback((context: string) => {
    setCodebaseContext(context);
    console.log(`[ClaudeContext] Codebase context updated (${context.length} characters)`);
  }, []);

  /**
   * Set connection status
   */
  const setConnectionStatus = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    setService(null);
    setIsConnected(false);
    setCurrentSessionId(null);
    setError(null);
    console.log('[ClaudeContext] Disconnected');
  }, []);

  const value: ClaudeContextValue = {
    service,
    isConnected,
    codebaseContext,
    currentSessionId,
    error,
    initialize,
    updateCodebase,
    setConnectionStatus,
    disconnect,
  };

  return (
    <ClaudeContext.Provider value={value}>
      {children}
    </ClaudeContext.Provider>
  );
};

/**
 * Hook to access Claude context
 *
 * Must be used within ClaudeProvider
 */
export const useClaude = () => {
  const context = useContext(ClaudeContext);
  if (!context) {
    throw new Error('useClaude must be used within ClaudeProvider');
  }
  return context;
};
