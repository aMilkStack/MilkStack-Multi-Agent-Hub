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
