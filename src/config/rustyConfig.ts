/**
 * Global Rusty Configuration
 *
 * Rusty is a meta-level global agent that's always connected to the MilkStack repo.
 * He is NOT project-specific - he's always watching, testing, and monitoring.
 *
 * This is separate from the internal agents which are configured per-project.
 */

/**
 * Default Rusty Configuration
 * Can be overridden via localStorage or environment variables
 */
export const DEFAULT_RUSTY_CONFIG = {
  // Default connection to the MilkStack Multi-Agent Hub repository
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
 * Backwards compatibility - export as RUSTY_GLOBAL_CONFIG
 * @deprecated Use getRustyConfig() instead
 */
export const RUSTY_GLOBAL_CONFIG = DEFAULT_RUSTY_CONFIG;

/**
 * Get the current Rusty configuration
 * Priority: localStorage > environment variables > default
 */
export function getRustyConfig(): typeof DEFAULT_RUSTY_CONFIG {
  // Try to load from localStorage (user override)
  const savedRepo = localStorage.getItem('rusty_repo_config');
  if (savedRepo) {
    try {
      const parsed = JSON.parse(savedRepo);
      return {
        ...DEFAULT_RUSTY_CONFIG,
        repo: {
          owner: parsed.owner || DEFAULT_RUSTY_CONFIG.repo.owner,
          name: parsed.name || DEFAULT_RUSTY_CONFIG.repo.name,
          branch: parsed.branch || DEFAULT_RUSTY_CONFIG.repo.branch,
          fullUrl: `https://github.com/${parsed.owner || DEFAULT_RUSTY_CONFIG.repo.owner}/${parsed.name || DEFAULT_RUSTY_CONFIG.repo.name}`,
        },
      };
    } catch (error) {
      console.warn('[RustyConfig] Invalid saved config, using default', error);
    }
  }

  // Try to load from environment variables (for builds)
  const envOwner = import.meta.env?.VITE_RUSTY_REPO_OWNER;
  const envName = import.meta.env?.VITE_RUSTY_REPO_NAME;
  const envBranch = import.meta.env?.VITE_RUSTY_REPO_BRANCH;

  if (envOwner && envName) {
    return {
      ...DEFAULT_RUSTY_CONFIG,
      repo: {
        owner: envOwner,
        name: envName,
        branch: envBranch || DEFAULT_RUSTY_CONFIG.repo.branch,
        fullUrl: `https://github.com/${envOwner}/${envName}`,
      },
    };
  }

  // Return default
  return DEFAULT_RUSTY_CONFIG;
}

/**
 * Save Rusty repository configuration to localStorage
 */
export function setRustyRepoConfig(owner: string, name: string, branch: string = 'main'): void {
  const config = { owner, name, branch };
  localStorage.setItem('rusty_repo_config', JSON.stringify(config));
}

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
 * Get Rusty's full repo URL (owner/name format)
 */
export function getRustyRepoUrl(): string {
  const config = getRustyConfig();
  return `${config.repo.owner}/${config.repo.name}`;
}
