/**
 * Codespace Service - Live Connection to GitHub Codespaces
 *
 * Provides real-time codebase synchronization between GitHub Codespaces
 * and the MilkStack Multi-Agent Hub, enabling symmetrical access for
 * both Claude Code (in Codespace) and Rusty (in MilkStack).
 */

import { fetchGitHubRepository } from './githubService';

export interface CodespaceConnection {
  repoUrl: string;
  branch: string;
  owner: string;
  repo: string;
  lastSync: Date;
  isLive: boolean;
}

/**
 * Extract repository information from Codespace URL
 * Supports formats:
 * - https://[codespace-name].github.dev
 * - https://github.com/owner/repo
 * - owner/repo
 */
export function parseCodespaceUrl(input: string): { owner: string; repo: string; branch?: string } | null {
  // Remove trailing slashes and whitespace
  const cleaned = input.trim().replace(/\/+$/, '');

  // Format: https://github.com/owner/repo
  const githubPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
  const githubMatch = cleaned.match(githubPattern);
  if (githubMatch) {
    return {
      owner: githubMatch[1],
      repo: githubMatch[2].replace('.git', ''),
    };
  }

  // Format: owner/repo
  const shortPattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/;
  const shortMatch = cleaned.match(shortPattern);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }

  // Format: https://[codespace-name].github.dev (need to derive repo from user context)
  const codespacePattern = /^https?:\/\/([^.]+)\.github\.dev/;
  const codespaceMatch = cleaned.match(codespacePattern);
  if (codespaceMatch) {
    // Codespace names typically include the repo name
    // Format: [owner]-[repo]-[random-id]
    const codespaceName = codespaceMatch[1];
    const parts = codespaceName.split('-');

    // This is a best-effort parse - user should provide full repo URL for accuracy
    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1],
      };
    }
  }

  return null;
}

/**
 * Fetch latest codebase from Codespace repository
 */
export async function fetchCodespaceRepository(
  repoUrl: string,
  branch: string = 'main',
  githubToken?: string
): Promise<string> {
  const repoInfo = parseCodespaceUrl(repoUrl);

  if (!repoInfo) {
    throw new Error('Invalid Codespace URL format. Use: github.com/owner/repo or owner/repo');
  }

  // Construct full GitHub URL
  const fullRepoUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;

  // Use existing GitHub service to fetch repository
  return await fetchGitHubRepository(fullRepoUrl, githubToken, branch);
}

/**
 * Create a live Codespace connection
 */
export function createCodespaceConnection(
  repoUrl: string,
  branch: string = 'main'
): CodespaceConnection {
  const repoInfo = parseCodespaceUrl(repoUrl);

  if (!repoInfo) {
    throw new Error('Invalid repository URL');
  }

  return {
    repoUrl,
    branch: repoInfo.branch || branch,
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    lastSync: new Date(),
    isLive: true,
  };
}

/**
 * Check if we're currently running inside a GitHub Codespace
 */
export function isRunningInCodespace(): boolean {
  // GitHub Codespaces set these environment variables
  return !!(
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.dev') ||
     window.location.hostname.includes('githubpreview.dev'))
  );
}

/**
 * Get current Codespace information if running in one
 */
export function getCurrentCodespaceInfo(): { url: string; isCodespace: boolean } {
  const isCodespace = isRunningInCodespace();

  return {
    url: isCodespace ? window.location.origin : '',
    isCodespace,
  };
}
