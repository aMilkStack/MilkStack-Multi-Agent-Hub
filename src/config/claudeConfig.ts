/**
 * Claude Code Service Configuration
 *
 * Configuration management for Claude-based code analysis
 * Replaces rustyConfig.ts for the Claude migration
 */

import type { AuthMethod, ClaudeAuthCredentials } from '../types/claude';
import type { ClaudeAgentConfig } from '../types/claude';

export const CLAUDE_CONFIG = {
  apiKey: {
    sources: ['localStorage', 'env', 'project'] as const,
    localStorageKey: 'anthropic_api_key',
    envVar: 'VITE_ANTHROPIC_API_KEY',
  },

  // Session token for Pro/Max subscription users
  sessionToken: {
    localStorageKey: 'anthropic_session_token',
    authMethodKey: 'anthropic_auth_method', // 'api-key' | 'subscription'
  },

  model: {
    default: 'claude-sonnet-4-5-20250929',
    fallback: 'claude-sonnet-4-5-20250929',
    alternatives: {
      fast: 'claude-3-5-haiku-20241022',
      powerful: 'claude-opus-4-20250514',
    },
  },

  repo: {
    owner: 'aMilkStack',
    name: 'MilkStack-Multi-Agent-Hub',
    branch: 'main',
    fullUrl: 'https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub',
  },

  agent: {
    id: 'claude',
    name: 'Claude',
    avatar: '🤖',
    color: '#ea580c', // Keep same orange as Rusty for consistency
    description: "Claude Code Agent - Meta Code Guardian",
    role: 'meta-monitor',
  },

  autoRefresh: {
    enabled: true,
    intervalMinutes: 5,
  },

  limits: {
    maxTokens: 8192, // Max output tokens
    contextWindow: 200000, // Claude's context window (200K tokens)
    temperature: 0.3, // Low temperature for consistent analysis
  },

  permissions: {
    defaultMode: 'default' as const,
    allowedDirectories: ['/src', '/public'],
    disallowedTools: [] as string[],
  },

  /**
   * SDK-specific configuration for Claude Agent SDK
   */
  sdk: {
    /** Default permission mode for SDK operations */
    defaultPermissionMode: 'default' as const,
    /** Tools allowed by default (read-only safe operations) */
    defaultAllowedTools: [
      'Read',
      'Grep',
      'Glob',
      'Bash',
      'WebSearch',
      'WebFetch',
    ],
    /** Tools that require explicit approval */
    requireApprovalTools: ['Write', 'Edit', 'MultiEdit'],
    /** Maximum turns per query (prevents infinite loops) */
    maxTurns: 50,
    /** Maximum budget in USD per query */
    maxBudgetUsd: 1.0,
    /** Include partial messages for streaming UI */
    includePartialMessages: true,
    /** Session storage key in IndexedDB */
    sessionStorageKey: 'claude_sessions',
  },
} as const;

/**
 * Get Claude API key from configured sources
 * Priority: localStorage > env variable > undefined
 */
export function getClaudeApiKey(): string | undefined {
  // Check localStorage first
  const localStorageKey = localStorage.getItem(CLAUDE_CONFIG.apiKey.localStorageKey);
  if (localStorageKey) {
    return localStorageKey;
  }

  // Check environment variable
  const envKey = import.meta.env?.[CLAUDE_CONFIG.apiKey.envVar];
  if (envKey) {
    return envKey;
  }

  return undefined;
}

/**
 * Check if Claude is configured (has API key)
 */
export function isClaudeConfigured(): boolean {
  const apiKey = getClaudeApiKey();
  return !!apiKey && apiKey.startsWith('sk-ant-');
}

/**
 * Get full repository configuration
 */
export function getClaudeRepoConfig() {
  return {
    ...CLAUDE_CONFIG.repo,
  };
}

/**
 * Get the current authentication method
 */
export function getAuthMethod(): AuthMethod {
  const stored = localStorage.getItem(CLAUDE_CONFIG.sessionToken.authMethodKey);
  return (stored === 'subscription' ? 'subscription' : 'api-key') as AuthMethod;
}

/**
 * Set the authentication method
 */
export function setAuthMethod(method: AuthMethod): void {
  localStorage.setItem(CLAUDE_CONFIG.sessionToken.authMethodKey, method);
}

/**
 * Get session token for Pro/Max subscription users
 */
export function getSessionToken(): string | undefined {
  return localStorage.getItem(CLAUDE_CONFIG.sessionToken.localStorageKey) || undefined;
}

/**
 * Set session token for Pro/Max subscription users
 */
export function setSessionToken(token: string): void {
  localStorage.setItem(CLAUDE_CONFIG.sessionToken.localStorageKey, token);
}

/**
 * Set API key in localStorage
 */
export function setApiKey(apiKey: string): void {
  localStorage.setItem(CLAUDE_CONFIG.apiKey.localStorageKey, apiKey);
}

/**
 * Get authentication credentials
 * Returns either API key or session token based on user's chosen method.
 * Note: If subscription method is selected but no token is provided,
 * falls back to API key if available.
 */
export function getClaudeAuth(): ClaudeAuthCredentials | undefined {
  const authMethod = getAuthMethod();

  if (authMethod === 'subscription') {
    const token = getSessionToken();
    if (token) {
      return { type: 'subscription', value: token };
    }
    // Fall back to API key if subscription token not provided
  }

  // Use API key (either as primary choice or fallback)
  const apiKey = getClaudeApiKey();
  if (apiKey) {
    return { type: 'api-key', value: apiKey };
  }

  return undefined;
}

/**
 * Check if user is authenticated with Anthropic
 */
export function isClaudeAuthenticated(): boolean {
  return getClaudeAuth() !== undefined;
}

/**
 * Get display text for current auth method
 */
export function getAuthMethodDisplay(): string {
  const auth = getClaudeAuth();
  if (!auth) {
    return '⚠️ Not authenticated';
  }
  if (auth.type === 'subscription') {
    return '🔐 Pro/Max Subscription';
  }
  return '🔑 API Key';
}

/**
 * Logout from Claude - clears all credentials
 */
export function logoutClaude(): void {
  localStorage.removeItem(CLAUDE_CONFIG.apiKey.localStorageKey);
  localStorage.removeItem(CLAUDE_CONFIG.sessionToken.localStorageKey);
  localStorage.removeItem(CLAUDE_CONFIG.sessionToken.authMethodKey);
 * Get default SDK agent configuration
 */
export function getDefaultAgentConfig(): ClaudeAgentConfig {
  return {
    permissionMode: CLAUDE_CONFIG.sdk.defaultPermissionMode,
    allowedTools: [...CLAUDE_CONFIG.sdk.defaultAllowedTools],
    disallowedTools: [],
    additionalDirectories: [...CLAUDE_CONFIG.permissions.allowedDirectories],
    maxTurns: CLAUDE_CONFIG.sdk.maxTurns,
    maxBudgetUsd: CLAUDE_CONFIG.sdk.maxBudgetUsd,
  };
}
