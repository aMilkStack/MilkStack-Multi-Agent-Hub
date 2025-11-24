/**
 * Rusty Configuration
 *
 * Rusty is hardcoded to monitor the MilkStack Multi-Agent Hub repository.
 * This is NOT configurable - Rusty's sole purpose is to monitor MSMAH.
 */

/**
 * Rusty Configuration (Hardcoded)
 * Rusty is dedicated to monitoring MilkStack Multi-Agent Hub only
 */
export const RUSTY_CONFIG = {
  // Hardcoded connection to MilkStack Multi-Agent Hub
  repo: {
    owner: 'aMilkStack',
    name: 'MilkStack-Multi-Agent-Hub',
    branch: 'main',
    fullUrl: 'https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub',
  },

  // Rusty's identity
  agent: {
    id: 'rusty',
    name: 'Rusty',
    avatar: '🔧',
    color: '#ea580c', // orange-600
    description: "Claude's Inside Agent - Meta Code Guardian",
    role: 'meta-monitor',
  },

  // Auto-refresh settings
  autoRefresh: {
    enabled: true,
    intervalMinutes: 5, // Auto-fetch latest codebase every 5 minutes
  },
} as const;

/**
 * Backwards compatibility
 */
export const RUSTY_GLOBAL_CONFIG = RUSTY_CONFIG;
export const DEFAULT_RUSTY_CONFIG = RUSTY_CONFIG;

/**
 * Get the GitHub token for Rusty's repo access
 * Priority: Environment variable > localStorage (legacy)
 */
export function getRustyGitHubToken(): string | undefined {
  // Check environment variable first (new way)
  const envToken = import.meta.env?.VITE_GITHUB_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Fallback to localStorage (legacy - for backwards compatibility)
  return localStorage.getItem('github_token') || undefined;
}

/**
 * Check if Rusty is properly configured
 */
export function isRustyConfigured(): boolean {
  // Rusty is always configured - hardcoded to MSMAH
  return true;
}

/**
 * Get Rusty's full repo URL (owner/name format)
 */
export function getRustyRepoUrl(): string {
  return `${RUSTY_CONFIG.repo.owner}/${RUSTY_CONFIG.repo.name}`;
}
