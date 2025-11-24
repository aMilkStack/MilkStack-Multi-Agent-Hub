/**
 * Claude Code Service Configuration
 *
 * Configuration management for Claude-based code analysis
 * Replaces rustyConfig.ts for the Claude migration
 */

import type { ClaudeAgentConfig } from '../types/claude';

export const CLAUDE_CONFIG = {
  apiKey: {
    sources: ['localStorage', 'env', 'project'] as const,
    localStorageKey: 'anthropic_api_key',
    envVar: 'VITE_ANTHROPIC_API_KEY',
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
