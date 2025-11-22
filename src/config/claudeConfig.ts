/**
 * Claude Code Service Configuration
 *
 * Configuration management for Claude-based code analysis
 * Replaces rustyConfig.ts for the Claude migration
 */

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
 * Save Claude API key to localStorage
 */
export function setClaudeApiKey(apiKey: string): void {
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('Invalid Claude API key format. Key must start with "sk-ant-"');
  }

  localStorage.setItem(CLAUDE_CONFIG.apiKey.localStorageKey, apiKey);
}

/**
 * Clear Claude API key from localStorage
 */
export function clearClaudeApiKey(): void {
  localStorage.removeItem(CLAUDE_CONFIG.apiKey.localStorageKey);
}

/**
 * Check if Claude is configured (has API key)
 */
export function isClaudeConfigured(): boolean {
  const apiKey = getClaudeApiKey();
  return !!apiKey && apiKey.startsWith('sk-ant-');
}

/**
 * Get the repository URL in owner/name format
 */
export function getClaudeRepoUrl(): string {
  return `${CLAUDE_CONFIG.repo.owner}/${CLAUDE_CONFIG.repo.name}`;
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
 * Set repository configuration (saves to localStorage)
 */
export function setClaudeRepoConfig(config: {
  owner?: string;
  name?: string;
  branch?: string;
}) {
  const currentConfig = getClaudeRepoConfig();
  const updatedConfig = {
    ...currentConfig,
    ...config,
  };

  localStorage.setItem('claude_repo_config', JSON.stringify(updatedConfig));
}

/**
 * Get model configuration based on use case
 */
export function getModelForTask(
  taskType: 'analysis' | 'chat' | 'quick'
): string {
  switch (taskType) {
    case 'analysis':
      return CLAUDE_CONFIG.model.default; // Sonnet for deep analysis
    case 'chat':
      return CLAUDE_CONFIG.model.default; // Sonnet for chat
    case 'quick':
      return CLAUDE_CONFIG.model.alternatives.fast; // Haiku for quick tasks
    default:
      return CLAUDE_CONFIG.model.default;
  }
}
