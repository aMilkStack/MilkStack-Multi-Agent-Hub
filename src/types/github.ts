/**
 * GitHub Integration Types
 * Defines structures for GitHub proposed changes and commits
 */

export interface ProposedChange {
  filePath: string;
  action: 'add' | 'modify' | 'delete';
  content?: string; // Full new content for 'add' or 'modify'
  diff?: string;    // Git-style diff format for 'modify'
}

export interface AgentProposedChanges {
  type: 'proposed_changes';
  changes: ProposedChange[];
  commitMessageHint?: string;
  branchNameHint?: string;
}

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

/**
 * Options for creating a pull request
 */
export interface CreatePROptions {
  owner: string;
  repo: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
  draft?: boolean;
}

/**
 * Result of a PR creation operation
 */
export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  title: string;
}
