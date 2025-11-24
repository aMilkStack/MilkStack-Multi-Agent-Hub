import { AgentProposedChanges } from '../types';

/**
 * Get GitHub token from environment variable or localStorage (legacy)
 * Priority: VITE_GITHUB_TOKEN > localStorage
 */
export function getGitHubToken(): string | undefined {
  // Check environment variable first (new way)
  const envToken = import.meta.env?.VITE_GITHUB_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Fallback to localStorage (legacy - for backwards compatibility)
  return localStorage.getItem('github_token') || undefined;
}

/**
 * Custom error types for better error handling
 */
export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: string
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubAuthError extends GitHubError {
  constructor(message: string = 'GitHub authentication failed. Please check your Personal Access Token in Settings.') {
    super(message, 401);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(message: string = 'GitHub API rate limit exceeded. Please wait or add a Personal Access Token in Settings to increase your limit.') {
    super(message, 403);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}. Please check the repository URL and branch name.`, 404);
    this.name = 'GitHubNotFoundError';
  }
}

/**
 * Typed response interfaces for GitHub API
 */
interface GitHubRef {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

interface GitHubCommit {
  sha: string;
  url: string;
  tree: {
    sha: string;
    url: string;
  };
  message: string;
}

interface GitHubBlob {
  sha: string;
  url: string;
}

interface GitHubTree {
  sha: string;
  url: string;
}

/**
 * Handle GitHub API response errors with specific error types
 */
async function handleGitHubResponse<T>(response: Response, operation: string): Promise<T> {
  if (response.ok) {
    return await response.json();
  }

  const responseText = await response.text();

  // Specific error handling by status code
  switch (response.status) {
    case 401:
      throw new GitHubAuthError();
    case 403:
      // Check if it's a rate limit issue
      if (responseText.toLowerCase().includes('rate limit')) {
        throw new GitHubRateLimitError();
      }
      throw new GitHubError(
        `GitHub API access forbidden during ${operation}. Check your token permissions.`,
        403,
        responseText
      );
    case 404:
      throw new GitHubNotFoundError(operation);
    default:
      throw new GitHubError(
        `Failed to ${operation}: ${response.statusText}`,
        response.status,
        responseText
      );
  }
}

// Helper for throttling to prevent GitHub rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Applies proposed changes to a GitHub repository via the GitHub API
 * @param changes Array of proposed file changes
 * @param githubPat GitHub Personal Access Token
 * @param owner Repository owner (username or org)
 * @param repo Repository name
 * @param branchName Branch to commit to
 * @param commitMessage Commit message
 * @returns The commit SHA
 */
/**
 * Progress callback for GitHub operations
 */
export type GitHubProgressCallback = (step: string, current: number, total: number) => void;

/**
 * Result of a GitHub commit operation
 */
export interface GitHubCommitResult {
  commitSha: string;
  branchName: string;
  commitUrl: string;
  branchUrl: string;
  compareUrl: string;
}

export async function commitToGitHub(
  changes: AgentProposedChanges,
  owner: string,
  repo: string,
  baseBranch: string = 'main',
  onProgress?: GitHubProgressCallback
): Promise<GitHubCommitResult> {
  const githubPat = getGitHubToken();

  if (!githubPat) {
    throw new Error('GitHub Personal Access Token is required. Please set VITE_GITHUB_TOKEN in your .env file.');
  }

  // Validate changes before starting
  if (!changes.changes || changes.changes.length === 0) {
    throw new Error('No changes provided to commit');
  }

  const branchName = changes.branchNameHint || `milkteam/auto-changes-${Date.now()}`;
  const commitMessage = changes.commitMessageHint || 'Apply agent-proposed code changes';

  const apiBase = 'https://api.github.com';
  const headers = {
    'Authorization': `token ${githubPat}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const totalSteps = 7;
  let currentStep = 0;

  const reportProgress = (step: string) => {
    currentStep++;
    if (onProgress) {
      onProgress(step, currentStep, totalSteps);
    }
    console.log(`[GitHub] Step ${currentStep}/${totalSteps}: ${step}`);
  };

  try {
    // 1. Get the base branch reference
    reportProgress(`Fetching base branch '${baseBranch}'`);
    const baseBranchRef = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
      { headers }
    );

    const baseBranchData = await handleGitHubResponse<GitHubRef>(
      baseBranchRef,
      `get base branch '${baseBranch}'`
    );
    const baseCommitSha = baseBranchData.object.sha;

    // 2. Check if target branch already exists, if not create it
    reportProgress(`Creating branch '${branchName}'`);
    const existingBranchRef = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
      { headers }
    );

    if (!existingBranchRef.ok && existingBranchRef.status === 404) {
      // Branch doesn't exist, create it
      const createBranchResponse = await fetch(
        `${apiBase}/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: baseCommitSha,
          }),
        }
      );

      await handleGitHubResponse<GitHubRef>(
        createBranchResponse,
        `create branch '${branchName}'`
      );

      console.log(`[GitHub] Created new branch: ${branchName}`);
    } else if (existingBranchRef.ok) {
      console.log(`[GitHub] Using existing branch: ${branchName}`);
    } else {
      await handleGitHubResponse<GitHubRef>(
        existingBranchRef,
        `check branch '${branchName}'`
      );
    }

    // 3. Get the tree of the base commit
    reportProgress('Fetching base commit tree');
    const baseCommitResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { headers }
    );

    const baseCommitData = await handleGitHubResponse<GitHubCommit>(
      baseCommitResponse,
      'get base commit'
    );
    const baseTreeSha = baseCommitData.tree.sha;

    // 4. Create blobs for new/modified files
    reportProgress(`Creating blobs for ${changes.changes.length} file(s)`);
    const treeEntries: Array<{
      path: string;
      mode: string;
      type: string;
      sha?: string;
    }> = [];

    for (const change of changes.changes) {
      if (change.action === 'delete') {
        // For deletes, we'll exclude from tree (handled by not including it)
        continue;
      }

      if (!change.content) {
        console.warn(`[GitHub] Skipping ${change.filePath}: no content provided`);
        continue;
      }

      // Create blob for file content
      const blobResponse = await fetch(
        `${apiBase}/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: change.content,
            encoding: 'utf-8',
          }),
        }
      );

      const blobData = await handleGitHubResponse<GitHubBlob>(
        blobResponse,
        `create blob for ${change.filePath}`
      );

      treeEntries.push({
        path: change.filePath,
        mode: '100644', // regular file
        type: 'blob',
        sha: blobData.sha,
      });
    }

    if (treeEntries.length === 0) {
      throw new Error('No valid changes to commit after processing');
    }

    // 5. Create a new tree
    reportProgress('Creating new tree');
    const createTreeResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      }
    );

    const newTreeData = await handleGitHubResponse<GitHubTree>(
      createTreeResponse,
      'create tree'
    );

    // 6. Create a commit
    reportProgress('Creating commit');
    const createCommitResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeData.sha,
          parents: [baseCommitSha],
        }),
      }
    );

    const newCommitData = await handleGitHubResponse<GitHubCommit>(
      createCommitResponse,
      'create commit'
    );

    // 7. Update the branch reference
    reportProgress(`Pushing to branch '${branchName}'`);
    const updateRefResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      }
    );

    await handleGitHubResponse<GitHubRef>(
      updateRefResponse,
      `update branch '${branchName}'`
    );

    // Generate helpful URLs
    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`;
    const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`;
    const compareUrl = `https://github.com/${owner}/${repo}/compare/${baseBranch}...${branchName}`;

    console.log(`[GitHub] ✅ Committed and pushed to ${owner}/${repo}@${branchName}`);
    console.log(`[GitHub] Commit: ${commitUrl}`);
    console.log(`[GitHub] Branch: ${branchUrl}`);
    console.log(`[GitHub] Compare: ${compareUrl}`);

    return {
      commitSha: newCommitData.sha,
      branchName,
      commitUrl,
      branchUrl,
      compareUrl,
    };

  } catch (error) {
    console.error('[GitHub] Failed to commit changes:', error);

    // Enhance error message with recovery suggestions
    if (error instanceof GitHubAuthError) {
      throw new GitHubAuthError(
        'GitHub authentication failed. Please check that your Personal Access Token is valid and has the required permissions (repo scope).'
      );
    }

    throw error;
  }
}

/**
 * Extracts owner/repo from GitHub URL or codebase context
 * Looks for patterns like:
 * - https://github.com/owner/repo
 * - git@github.com:owner/repo.git
 * - owner/repo
 */
export function extractRepoInfo(codebaseContext: string): { owner: string; repo: string } | null {
  // Try to find GitHub URL patterns
  const httpsPattern = /github\.com\/([^\/]+)\/([^\/\s]+)/;
  const sshPattern = /git@github\.com:([^\/]+)\/([^\s\.]+)/;
  const shortPattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/m;

  const match = codebaseContext.match(httpsPattern) ||
              codebaseContext.match(sshPattern) ||
              codebaseContext.match(shortPattern);

  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace('.git', ''),
    };
  }

  return null;
}

// ============================================================================
// LEGACY FUNCTIONS FOR FETCHING REPO CONTENTS (Used by NewProjectModal)
// ============================================================================

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

// File extensions to ignore
const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.zip', '.gz', '.tar', '.rar', '.7z',
  '.mp4', '.mov', '.avi', '.mp3', '.wav', '.ogg',
  '.o', '.a', '.so', '.dll', '.exe', '.jar', '.class',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.DS_Store'
];

// Directories to ignore
const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'out', '.next',
  '.svelte-kit', 'venv', '__pycache__', '.vscode', '.idea',
  'coverage', '.cache', 'logs'
];

// Files to ignore
const IGNORED_FILES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.gitignore', '.npmrc', '.nvmrc'
];

/**
 * Parse a GitHub URL to extract owner, repo, and branch
 */
const parseGitHubUrl = (url: string): { owner: string; repo: string; branch: string } | null => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) return null;

    const owner = pathParts[0];
    const repo = pathParts[1];
    let branch = 'main';

    // Check if URL contains /tree/{branch}
    const treeIndex = pathParts.indexOf('tree');
    if (treeIndex !== -1 && pathParts.length > treeIndex + 1) {
      branch = pathParts[treeIndex + 1];
    }

    return { owner, repo, branch };
  } catch {
    return null;
  }
};

/**
 * Check if a file should be ignored based on its path
 */
const shouldIgnoreFile = (path: string): boolean => {
  const pathParts = path.split('/');
  const fileName = pathParts[pathParts.length - 1];

  // Check ignored directories
  if (pathParts.some(part => IGNORED_DIRS.includes(part))) {
    return true;
  }

  // Check ignored files
  if (IGNORED_FILES.includes(fileName)) {
    return true;
  }

  // Check ignored extensions
  if (IGNORED_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
    return true;
  }

  return false;
};

/**
 * Fetch file content from GitHub
 */
const fetchFileContent = async (url: string, token?: string): Promise<string> => {
  // raw.githubusercontent.com doesn't need (and doesn't support) custom headers
  // Only send headers for GitHub API endpoints, not raw content CDN
  const isRawGitHub = url.includes('raw.githubusercontent.com');

  const headers: HeadersInit = isRawGitHub ? {} : {
    'Accept': 'application/vnd.github.v3.raw'
  };

  // Note: Authorization not needed for public repos on raw.githubusercontent.com
  // and actually causes CORS issues
  if (token && !isRawGitHub) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new GitHubError(
      `Failed to fetch file content`,
      response.status,
      await response.text()
    );
  }

  return response.text();
};

/**
 * Generate a file tree manifest from paths
 */
const generateFileTree = (paths: string[]): string => {
  const tree: { [key: string]: any } = {};

  paths.forEach(path => {
    const parts = path.split('/');
    let currentLevel = tree;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        currentLevel[part] = null; // File
      } else {
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }
    });
  });

  const buildTreeString = (node: { [key: string]: any }, prefix = ''): string => {
    let result = '';
    const entries = Object.keys(node).sort();

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${entry}\n`;

      if (node[entry] !== null) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        result += buildTreeString(node[entry], newPrefix);
      }
    });

    return result;
  };

  return `/\n${buildTreeString(tree)}`;
};

/**
 * Fetch repository contents from GitHub
 */
export const fetchGitHubRepository = async (
  url: string,
  token?: string
): Promise<string> => {
  const parsed = parseGitHubUrl(url);

  if (!parsed) {
    throw new Error('Invalid GitHub URL. Please provide a valid repository URL.');
  }

  const { owner, repo, branch } = parsed;

  // Fetch repository tree using git/trees API (recursive)
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const treeResponse = await fetch(treeUrl, { headers });

  const treeData = await handleGitHubResponse<{ tree: GitHubTreeItem[] }>(
    treeResponse,
    `fetch repository tree for ${owner}/${repo}@${branch}`
  );
  const items: GitHubTreeItem[] = treeData.tree;

  // Filter out ignored files and directories
  const validFiles = items.filter(item =>
    item.type === 'blob' &&
    !shouldIgnoreFile(item.path) &&
    (item.size || 0) < 500000 // Max 500KB per file
  );

  if (validFiles.length === 0) {
    throw new Error('No valid files found in repository.');
  }

  // Generate file tree
  const filePaths = validFiles.map(f => f.path);
  const fileTree = generateFileTree(filePaths);

  // Fetch file contents (limit to first 50 files to avoid rate limits)
  const filesToFetch = validFiles.slice(0, 50);
  const fileContents: string[] = [];

  for (const file of filesToFetch) {
    // FIX: Add 100ms delay between requests to respect GitHub rate limits
    await delay(100);

    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      const content = await fetchFileContent(rawUrl, token);
      fileContents.push(`
// =================================================================
// FILE: ${file.path}
// =================================================================

${content}
`);
    } catch (error) {
      console.warn(`Failed to fetch ${file.path}:`, error);
      fileContents.push(`
// =================================================================
// FILE: ${file.path}
// =================================================================

// Error: Could not fetch file content
`);
    }
  }

  const totalFiles = validFiles.length;
  const fetchedFiles = filesToFetch.length;
  const limitNote = totalFiles > fetchedFiles
    ? `\n**Note:** Repository contains ${totalFiles} files. Showing first ${fetchedFiles} files to avoid rate limits.\n`
    : '';

  return `# Codebase Context - ${owner}/${repo} (${branch})
${limitNote}
## File Tree Manifest
\`\`\`
${fileTree}
\`\`\`

## Concatenated File Contents
${fileContents.join('')}
`;
};

// ============================================================================
// PULL REQUEST CREATION
// ============================================================================

interface GitHubPullRequest {
  number: number;
  html_url: string;
  title: string;
  state: string;
}

export interface CreatePROptions {
  owner: string;
  repo: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
  draft?: boolean;
}

export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  title: string;
}

/**
 * Generate a PR description from changes
 */
export function generatePRDescription(changes: AgentProposedChanges): string {
  const fileChanges = changes.changes.map(c => {
    const action = c.action === 'add' ? '✨ Added' : c.action === 'modify' ? '📝 Modified' : '🗑️ Deleted';
    return `- ${action}: \`${c.filePath}\``;
  }).join('\n');

  return `## Summary

${changes.commitMessageHint || 'Agent-proposed code changes'}

## Changes

${fileChanges}

## Files Changed

- **Total files**: ${changes.changes.length}
- **Added**: ${changes.changes.filter(c => c.action === 'add').length}
- **Modified**: ${changes.changes.filter(c => c.action === 'modify').length}
- **Deleted**: ${changes.changes.filter(c => c.action === 'delete').length}

---

🤖 *This pull request was automatically generated by MilkStack Multi-Agent Hub*`;
}

/**
 * Create a Pull Request on GitHub
 * @param options PR creation options
 * @returns PR number and URL
 */
export async function createPullRequest(options: CreatePROptions): Promise<CreatePRResult> {
  const githubPat = getGitHubToken();

  if (!githubPat) {
    throw new Error('GitHub Personal Access Token is required. Please set VITE_GITHUB_TOKEN in your .env file.');
  }

  const { owner, repo, headBranch, baseBranch, title, body, draft = false } = options;

  const apiBase = 'https://api.github.com';
  const headers = {
    'Authorization': `token ${githubPat}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // Check if PR already exists for this branch
    const existingPRResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/pulls?head=${owner}:${headBranch}&base=${baseBranch}&state=open`,
      { headers }
    );

    const existingPRs = await handleGitHubResponse<GitHubPullRequest[]>(
      existingPRResponse,
      'check existing pull requests'
    );

    if (existingPRs.length > 0) {
      const existingPR = existingPRs[0];
      console.log(`[GitHub] Pull request already exists: #${existingPR.number}`);
      return {
        prNumber: existingPR.number,
        prUrl: existingPR.html_url,
        title: existingPR.title,
      };
    }

    // Create new PR
    const createPRResponse = await fetch(
      `${apiBase}/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          body,
          head: headBranch,
          base: baseBranch,
          draft,
        }),
      }
    );

    const newPR = await handleGitHubResponse<GitHubPullRequest>(
      createPRResponse,
      'create pull request'
    );

    console.log(`[GitHub] ✅ Created pull request #${newPR.number}: ${newPR.html_url}`);

    return {
      prNumber: newPR.number,
      prUrl: newPR.html_url,
      title: newPR.title,
    };

  } catch (error) {
    console.error('[GitHub] Failed to create pull request:', error);

    // Provide helpful error messages
    if (error instanceof GitHubAuthError) {
      throw new GitHubAuthError(
        'GitHub authentication failed. Please check that your Personal Access Token has the "repo" scope permission.'
      );
    }

    if (error instanceof GitHubNotFoundError) {
      throw new GitHubNotFoundError(
        `repository or branch (${owner}/${repo}, branches: ${baseBranch} -> ${headBranch})`
      );
    }

    throw error;
  }
}

/**
 * Commit changes and optionally create a pull request
 * @param changes Proposed changes
 * @param owner Repository owner
 * @param repo Repository name
 * @param baseBranch Base branch (default: 'main')
 * @param createPR Whether to create a PR after committing
 * @param prTitle Optional PR title (defaults to commit message)
 * @param onProgress Optional progress callback
 * @returns Commit result and optional PR result
 */
export async function commitAndCreatePR(
  changes: AgentProposedChanges,
  owner: string,
  repo: string,
  baseBranch: string = 'main',
  createPR: boolean = false,
  prTitle?: string,
  onProgress?: GitHubProgressCallback
): Promise<{
  commit: GitHubCommitResult;
  pr?: CreatePRResult;
}> {
  // First, commit the changes
  const commitResult = await commitToGitHub(
    changes,
    owner,
    repo,
    baseBranch,
    onProgress
  );

  // If requested, create a PR
  let prResult: CreatePRResult | undefined;

  if (createPR) {
    const prBody = generatePRDescription(changes);
    const prTitleFinal = prTitle || changes.commitMessageHint || 'Agent-proposed code changes';

    prResult = await createPullRequest({
      owner,
      repo,
      headBranch: commitResult.branchName,
      baseBranch,
      title: prTitleFinal,
      body: prBody,
      draft: false,
    });

    console.log(`[GitHub] ✅ Full workflow complete: commit + PR`);
    console.log(`[GitHub] PR: ${prResult.prUrl}`);
  }

  return {
    commit: commitResult,
    pr: prResult,
  };
}
