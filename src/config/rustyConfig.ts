/**
 * Global Rusty Configuration
 *
 * Rusty is a meta-level global agent that's always connected to the MilkStack repo.
 * He is NOT project-specific - he's always watching, testing, and monitoring.
 *
 * This is separate from the internal agents which are configured per-project.
 */

export const RUSTY_GLOBAL_CONFIG = {
  // Hardcoded connection to the MilkStack Multi-Agent Hub repository
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
 * Get the GitHub token for Rusty's repo access
 */
export function getRustyGitHubToken(): string | undefined {
  return localStorage.getItem('github_token') || undefined;
}

/**
 * Check if Rusty is properly configured
 */
export function isRustyConfigured(): boolean {
  // Rusty is always configured - he's hardcoded to this repo
  return true;
}

/**
 * Get Rusty's full repo URL
 */
export function getRustyRepoUrl(): string {
  return `${RUSTY_GLOBAL_CONFIG.repo.owner}/${RUSTY_GLOBAL_CONFIG.repo.name}`;
}
