# GitHub Integration - Enhanced Features

**Last Updated:** Phase 1, Task 10
**Status:** ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [What's New](#whats-new)
3. [Features](#features)
4. [API Reference](#api-reference)
5. [Usage Examples](#usage-examples)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The GitHub integration allows MilkStack Multi-Agent Hub to interact with GitHub repositories:
- Commit agent-proposed changes directly to GitHub
- Automatically create pull requests
- Fetch repository contents for project context
- Handle authentication and rate limiting

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MilkStack Multi-Agent Hub                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Agent proposes changes                                          │
│          ↓                                                        │
│  User approves changes                                           │
│          ↓                                                        │
│  githubService.commitAndCreatePR()                               │
│          ↓                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Create blobs (file contents)                        │    │
│  │ 2. Create tree (file structure)                        │    │
│  │ 3. Create commit                                       │    │
│  │ 4. Update branch reference                             │    │
│  │ 5. (Optional) Create pull request                      │    │
│  └────────────────────────────────────────────────────────┘    │
│          ↓                                                        │
│  Return commit URL + PR URL                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                    GitHub API
```

---

## What's New

### Phase 1, Task 10 Enhancements

#### 1. Pull Request Auto-Creation ✨
**Before:** Users had to manually create PRs after committing changes.

**After:** Automatically create PRs with rich descriptions including file changes, statistics, and direct links.

```typescript
// Automatic PR creation with one function call
const result = await commitAndCreatePR(
  changes,
  'owner',
  'repo',
  'main',
  true  // ← createPR = true
);

console.log(`PR created: ${result.pr?.prUrl}`);
// Output: PR created: https://github.com/owner/repo/pull/42
```

#### 2. Progress Feedback 📊
**Before:** No feedback during long-running GitHub operations.

**After:** Real-time progress updates for each step of the commit/PR workflow.

```typescript
const onProgress = (step: string, current: number, total: number) => {
  console.log(`[${current}/${total}] ${step}`);
};

await commitToGitHub(changes, owner, repo, 'main', onProgress);

// Output:
// [1/7] Fetching base branch 'main'
// [2/7] Creating branch 'milkteam/auto-changes-1234'
// [3/7] Fetching base commit tree
// [4/7] Creating blobs for 5 file(s)
// [5/7] Creating new tree
// [6/7] Creating commit
// [7/7] Pushing to branch 'milkteam/auto-changes-1234'
```

#### 3. Enhanced Commit Results 🔗
**Before:** Only returned commit SHA and branch name.

**After:** Returns comprehensive URLs for easy navigation.

```typescript
const result = await commitToGitHub(changes, owner, repo);

console.log(result);
// {
//   commitSha: '7f3a9d2...',
//   branchName: 'milkteam/auto-changes-1234',
//   commitUrl: 'https://github.com/owner/repo/commit/7f3a9d2',
//   branchUrl: 'https://github.com/owner/repo/tree/milkteam/auto-changes-1234',
//   compareUrl: 'https://github.com/owner/repo/compare/main...milkteam/auto-changes-1234'
// }
```

#### 4. Improved Error Handling 🛡️
**Before:** Generic error messages.

**After:** Specific error types with actionable recovery suggestions.

```typescript
try {
  await commitToGitHub(changes, owner, repo);
} catch (error) {
  if (error instanceof GitHubAuthError) {
    // Specific guidance: Check PAT permissions
  } else if (error instanceof GitHubRateLimitError) {
    // Specific guidance: Wait or upgrade to paid tier
  } else if (error instanceof GitHubNotFoundError) {
    // Specific guidance: Check repo URL and branch
  }
}
```

#### 5. Input Validation ✅
**Before:** Errors occurred deep in the workflow.

**After:** Early validation catches issues before API calls.

```typescript
// Validates before starting:
// - Changes array not empty
// - Each change has required fields
// - GitHub token exists
// - Owner/repo are valid

await commitToGitHub(changes, owner, repo);
// Throws: "No changes provided to commit" (before any API calls)
```

#### 6. Automatic PR Descriptions 📝
**Before:** N/A (no PR creation).

**After:** Rich, formatted PR descriptions with file statistics.

```markdown
## Summary
Add dark mode support to application

## Changes
- ✨ Added: `src/context/ThemeContext.tsx`
- 📝 Modified: `tailwind.config.js`
- 📝 Modified: `src/components/Settings.tsx`

## Files Changed
- **Total files**: 3
- **Added**: 1
- **Modified**: 2
- **Deleted**: 0

---

🤖 *This pull request was automatically generated by MilkStack Multi-Agent Hub*
```

#### 7. Duplicate PR Detection 🔍
**Before:** N/A (no PR creation).

**After:** Detects existing PRs for the same branch to avoid duplicates.

```typescript
const result = await createPullRequest({
  owner,
  repo,
  headBranch: 'feature-branch',
  baseBranch: 'main',
  title: 'Add feature X',
  body: 'Description...'
});

// If PR already exists:
// console.log: [GitHub] Pull request already exists: #42
// Returns existing PR info instead of creating duplicate
```

---

## Features

### 1. Commit Changes to GitHub

Commit agent-proposed changes to a GitHub repository with full progress tracking.

**Function:** `commitToGitHub()`

**Capabilities:**
- Creates new branch from base branch
- Creates blobs for each file
- Creates tree structure
- Commits changes with custom message
- Updates branch reference
- Returns comprehensive URLs

**Example:**
```typescript
import { commitToGitHub } from './services/githubService';

const changes = {
  type: 'proposed_changes',
  changes: [
    {
      filePath: 'src/App.tsx',
      action: 'modify',
      content: '// Updated content...'
    }
  ],
  commitMessageHint: 'Fix navigation bug',
  branchNameHint: 'fix/navigation-bug'
};

const result = await commitToGitHub(
  changes,
  'myorg',
  'myrepo',
  'main',
  (step, current, total) => {
    console.log(`[${current}/${total}] ${step}`);
  }
);

console.log(`Commit: ${result.commitUrl}`);
console.log(`Compare: ${result.compareUrl}`);
```

### 2. Create Pull Request

Automatically create a pull request after committing changes.

**Function:** `createPullRequest()`

**Capabilities:**
- Creates PR with title and body
- Supports draft PRs
- Detects existing PRs (avoids duplicates)
- Returns PR number and URL

**Example:**
```typescript
import { createPullRequest } from './services/githubService';

const prResult = await createPullRequest({
  owner: 'myorg',
  repo: 'myrepo',
  headBranch: 'feature/new-feature',
  baseBranch: 'main',
  title: 'Add new feature X',
  body: '## Description\n\nThis PR adds feature X...',
  draft: false
});

console.log(`PR #${prResult.prNumber}: ${prResult.prUrl}`);
```

### 3. Commit + Create PR (Combined)

Single function to commit changes AND create a PR in one operation.

**Function:** `commitAndCreatePR()`

**Capabilities:**
- Commits changes to new branch
- Optionally creates PR
- Returns both commit and PR results
- Single progress callback for entire workflow

**Example:**
```typescript
import { commitAndCreatePR } from './services/githubService';

const result = await commitAndCreatePR(
  changes,
  'myorg',
  'myrepo',
  'main',
  true,  // createPR = true
  'Add feature X',  // PR title (optional)
  (step, current, total) => {
    console.log(`Progress: ${current}/${total} - ${step}`);
  }
);

console.log(`Commit: ${result.commit.commitUrl}`);
console.log(`PR: ${result.pr?.prUrl}`);
```

### 4. Fetch Repository Contents

Fetch repository files for project context (existing feature, enhanced error handling).

**Function:** `fetchGitHubRepository()`

**Capabilities:**
- Fetches repository tree
- Filters out node_modules, binaries, lock files
- Generates file tree visualization
- Fetches file contents (max 50 files)
- Returns formatted codebase context

**Example:**
```typescript
import { fetchGitHubRepository } from './services/githubService';

const codebase = await fetchGitHubRepository(
  'https://github.com/myorg/myrepo/tree/main',
  githubToken  // optional, for private repos
);

console.log(codebase);
// Output: Markdown-formatted codebase with file tree + file contents
```

---

## API Reference

### Types

#### `GitHubProgressCallback`

```typescript
type GitHubProgressCallback = (
  step: string,      // Description of current step
  current: number,   // Current step number (1-indexed)
  total: number      // Total number of steps
) => void;
```

#### `GitHubCommitResult`

```typescript
interface GitHubCommitResult {
  commitSha: string;      // Git commit SHA
  branchName: string;     // Branch where changes were committed
  commitUrl: string;      // Direct link to commit on GitHub
  branchUrl: string;      // Direct link to branch on GitHub
  compareUrl: string;     // Link to compare changes (base...head)
}
```

#### `CreatePROptions`

```typescript
interface CreatePROptions {
  owner: string;          // Repository owner (username or org)
  repo: string;           // Repository name
  headBranch: string;     // Branch with changes (source)
  baseBranch: string;     // Branch to merge into (target)
  title: string;          // PR title
  body: string;           // PR description (supports markdown)
  draft?: boolean;        // Create as draft PR (default: false)
}
```

#### `CreatePRResult`

```typescript
interface CreatePRResult {
  prNumber: number;       // GitHub PR number
  prUrl: string;          // Direct link to PR on GitHub
  title: string;          // PR title
}
```

### Functions

#### `commitToGitHub()`

```typescript
function commitToGitHub(
  changes: AgentProposedChanges,
  owner: string,
  repo: string,
  baseBranch: string = 'main',
  onProgress?: GitHubProgressCallback
): Promise<GitHubCommitResult>
```

**Parameters:**
- `changes`: Proposed file changes
- `owner`: Repository owner
- `repo`: Repository name
- `baseBranch`: Branch to branch from (default: 'main')
- `onProgress`: Optional progress callback

**Returns:** `GitHubCommitResult` with URLs

**Throws:**
- `GitHubAuthError` - Invalid or missing PAT
- `GitHubRateLimitError` - Rate limit exceeded
- `GitHubNotFoundError` - Repo or branch not found
- `GitHubError` - Other API errors

#### `createPullRequest()`

```typescript
function createPullRequest(
  options: CreatePROptions
): Promise<CreatePRResult>
```

**Parameters:**
- `options`: PR creation options

**Returns:** `CreatePRResult` with PR number and URL

**Throws:**
- `GitHubAuthError` - Invalid PAT or insufficient permissions
- `GitHubNotFoundError` - Repo or branch not found
- `GitHubError` - Other API errors

#### `commitAndCreatePR()`

```typescript
function commitAndCreatePR(
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
}>
```

**Parameters:**
- `changes`: Proposed file changes
- `owner`: Repository owner
- `repo`: Repository name
- `baseBranch`: Branch to branch from (default: 'main')
- `createPR`: Whether to create PR (default: false)
- `prTitle`: Optional PR title (defaults to commit message)
- `onProgress`: Optional progress callback

**Returns:** Object with `commit` and optional `pr` results

**Throws:** Same as `commitToGitHub()` and `createPullRequest()`

#### `generatePRDescription()`

```typescript
function generatePRDescription(
  changes: AgentProposedChanges
): string
```

**Parameters:**
- `changes`: Proposed file changes

**Returns:** Formatted markdown PR description

**Example Output:**
```markdown
## Summary
Apply agent-proposed code changes

## Changes
- ✨ Added: `src/new-file.ts`
- 📝 Modified: `src/existing.ts`

## Files Changed
- **Total files**: 2
- **Added**: 1
- **Modified**: 1
- **Deleted**: 0

---

🤖 *This pull request was automatically generated by MilkStack Multi-Agent Hub*
```

---

## Usage Examples

### Example 1: Simple Commit (No PR)

```typescript
import { commitToGitHub } from './services/githubService';

const changes = {
  type: 'proposed_changes',
  changes: [
    {
      filePath: 'README.md',
      action: 'modify',
      content: '# Updated README\n\nNew content here...'
    }
  ],
  commitMessageHint: 'Update README documentation'
};

try {
  const result = await commitToGitHub(
    changes,
    'myorg',
    'myrepo',
    'main'
  );

  console.log(`✅ Changes committed!`);
  console.log(`View commit: ${result.commitUrl}`);
  console.log(`View branch: ${result.branchUrl}`);

} catch (error) {
  console.error(`❌ Commit failed:`, error.message);
}
```

### Example 2: Commit + Auto-Create PR

```typescript
import { commitAndCreatePR } from './services/githubService';

const changes = {
  type: 'proposed_changes',
  changes: [
    {
      filePath: 'src/App.tsx',
      action: 'modify',
      content: '// Fixed navigation bug'
    },
    {
      filePath: 'src/tests/App.test.tsx',
      action: 'add',
      content: '// New test cases'
    }
  ],
  commitMessageHint: 'Fix navigation bug and add tests',
  branchNameHint: 'fix/navigation-bug'
};

try {
  const result = await commitAndCreatePR(
    changes,
    'myorg',
    'myrepo',
    'main',
    true,  // Create PR
    'Fix: Navigation bug in main menu'
  );

  console.log(`✅ Changes committed and PR created!`);
  console.log(`Commit: ${result.commit.commitUrl}`);
  console.log(`PR #${result.pr?.prNumber}: ${result.pr?.prUrl}`);

} catch (error) {
  console.error(`❌ Operation failed:`, error.message);
}
```

### Example 3: Commit with Progress Feedback

```typescript
import { commitToGitHub } from './services/githubService';
import { toast } from 'react-toastify';

const onProgress = (step: string, current: number, total: number) => {
  const percentage = Math.round((current / total) * 100);
  toast.info(`[${percentage}%] ${step}`, { autoClose: 1000 });
};

try {
  const result = await commitToGitHub(
    changes,
    'myorg',
    'myrepo',
    'main',
    onProgress
  );

  toast.success(`✅ Committed to ${result.branchName}`);

} catch (error) {
  toast.error(`❌ ${error.message}`);
}
```

### Example 4: Manual PR Creation After Commit

```typescript
import { commitToGitHub, createPullRequest, generatePRDescription } from './services/githubService';

// First, commit the changes
const commitResult = await commitToGitHub(changes, 'myorg', 'myrepo');

// Then, create PR manually (if you want custom PR description)
const customPRBody = `
## What changed?
Fixed the navigation bug that occurred when users clicked...

## Testing
- [x] Tested on Chrome
- [x] Tested on Firefox
- [ ] Tested on Safari

${generatePRDescription(changes)}
`;

const prResult = await createPullRequest({
  owner: 'myorg',
  repo: 'myrepo',
  headBranch: commitResult.branchName,
  baseBranch: 'main',
  title: 'Fix: Navigation bug',
  body: customPRBody,
  draft: false
});

console.log(`PR created: ${prResult.prUrl}`);
```

### Example 5: Draft PR Creation

```typescript
import { commitAndCreatePR } from './services/githubService';

// Create commit + draft PR for review before marking ready
const result = await commitAndCreatePR(
  changes,
  'myorg',
  'myrepo',
  'main',
  true,
  'WIP: Experimental feature X'
);

// Draft PR allows you to push more commits before marking ready
console.log(`Draft PR created: ${result.pr?.prUrl}`);
console.log(`Mark as ready when testing is complete`);
```

---

## Error Handling

### Error Types

#### `GitHubAuthError` (401)

**Cause:** Invalid or missing GitHub Personal Access Token

**Message:**
> GitHub authentication failed. Please check that your Personal Access Token is valid and has the required permissions (repo scope).

**Recovery:**
1. Check `.env` file has `VITE_GITHUB_TOKEN=ghp_...`
2. Verify token is valid: https://github.com/settings/tokens
3. Ensure token has `repo` scope permission
4. Regenerate token if needed

#### `GitHubRateLimitError` (403)

**Cause:** GitHub API rate limit exceeded

**Message:**
> GitHub API rate limit exceeded. Please wait or add a Personal Access Token in Settings to increase your limit.

**Recovery:**
1. Wait 60 minutes for rate limit reset
2. Use authenticated requests (PAT) for higher limits:
   - Unauthenticated: 60 requests/hour
   - Authenticated: 5,000 requests/hour
3. Check rate limit status:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/rate_limit
   ```

#### `GitHubNotFoundError` (404)

**Cause:** Repository, branch, or resource not found

**Message:**
> GitHub resource not found: {resource}. Please check the repository URL and branch name.

**Recovery:**
1. Verify repository exists and is accessible
2. Check branch name is correct (case-sensitive)
3. Ensure PAT has access to the repository (for private repos)
4. Verify owner/repo format: `owner/repo` (no spaces)

#### `GitHubError` (Other)

**Cause:** Other GitHub API errors

**Message:** Varies by error

**Recovery:** Check error message and GitHub API status

### Error Handling Pattern

```typescript
import {
  commitToGitHub,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubError
} from './services/githubService';

try {
  const result = await commitToGitHub(changes, owner, repo);
  console.log(`Success: ${result.commitUrl}`);

} catch (error) {
  if (error instanceof GitHubAuthError) {
    // Handle authentication error
    console.error('Auth failed. Please check your GitHub PAT.');
    // Show settings modal to user

  } else if (error instanceof GitHubRateLimitError) {
    // Handle rate limit error
    console.error('Rate limit exceeded. Please wait 60 minutes.');
    // Show "wait" message to user

  } else if (error instanceof GitHubNotFoundError) {
    // Handle not found error
    console.error('Repo/branch not found. Please check URL.');
    // Prompt user to verify repo URL

  } else if (error instanceof GitHubError) {
    // Handle other GitHub errors
    console.error(`GitHub error (${error.statusCode}): ${error.message}`);
    console.error('Response:', error.response);

  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

---

## Best Practices

### 1. Always Use Progress Callbacks for Long Operations

```typescript
// Good: User sees progress
const onProgress = (step, current, total) => {
  updateUI(`Step ${current}/${total}: ${step}`);
};
await commitToGitHub(changes, owner, repo, 'main', onProgress);

// Bad: User sees nothing, thinks app is frozen
await commitToGitHub(changes, owner, repo);
```

### 2. Use `commitAndCreatePR()` for Complete Workflows

```typescript
// Good: One function call for commit + PR
const result = await commitAndCreatePR(
  changes, owner, repo, 'main',
  true,  // createPR
  'Feature: Add dark mode'
);

// Less efficient: Two separate calls
const commitResult = await commitToGitHub(changes, owner, repo);
const prResult = await createPullRequest({
  owner, repo,
  headBranch: commitResult.branchName,
  baseBranch: 'main',
  title: 'Feature: Add dark mode',
  body: generatePRDescription(changes)
});
```

### 3. Validate Changes Before Committing

```typescript
// Good: Validate early
if (!changes.changes || changes.changes.length === 0) {
  throw new Error('No changes to commit');
}

const hasContent = changes.changes.every(c =>
  c.action === 'delete' || c.content
);

if (!hasContent) {
  throw new Error('All non-delete changes must have content');
}

await commitToGitHub(changes, owner, repo);

// Bad: Let commitToGitHub() fail deep in the workflow
await commitToGitHub(emptyChanges, owner, repo);
// Error occurs after several API calls wasted
```

### 4. Provide Meaningful Commit Messages

```typescript
// Good: Descriptive commit message
const changes = {
  changes: [...],
  commitMessageHint: 'Fix navigation bug in mobile menu (closes #42)'
};

// Bad: Generic commit message
const changes = {
  changes: [...],
  commitMessageHint: 'Update files'  // Not helpful
};
```

### 5. Use Branch Name Hints for Organization

```typescript
// Good: Descriptive branch name
const changes = {
  changes: [...],
  branchNameHint: 'fix/mobile-navigation-bug'
};

// Auto-generated: milkteam/auto-changes-1701234567890
// Less descriptive but works
const changes = {
  changes: [...]
  // No branchNameHint provided
};
```

### 6. Handle Errors Gracefully with User Feedback

```typescript
// Good: User-friendly error handling
try {
  await commitAndCreatePR(changes, owner, repo, 'main', true);
  toast.success('✅ Changes committed and PR created!');
} catch (error) {
  if (error instanceof GitHubAuthError) {
    toast.error('❌ GitHub authentication failed. Please check Settings.');
    openSettingsModal();
  } else {
    toast.error(`❌ ${error.message}`);
  }
}

// Bad: Silent failure
try {
  await commitAndCreatePR(changes, owner, repo, 'main', true);
} catch (error) {
  console.error(error);  // User sees nothing
}
```

### 7. Display URLs to Users

```typescript
// Good: Show clickable links
const result = await commitAndCreatePR(changes, owner, repo, 'main', true);

toast.success(
  <div>
    ✅ Changes committed!<br/>
    <a href={result.commit.commitUrl} target="_blank">View Commit</a> |
    <a href={result.pr?.prUrl} target="_blank">View PR #{result.pr?.prNumber}</a>
  </div>
);

// Less helpful: Just success message
toast.success('Changes committed!');
```

---

## Troubleshooting

### Issue: "GitHub Personal Access Token is required"

**Symptom:**
```
Error: GitHub Personal Access Token is required. Please set VITE_GITHUB_TOKEN in your .env file.
```

**Solution:**
1. Create `.env` file in project root (if not exists)
2. Add: `VITE_GITHUB_TOKEN=ghp_...`
3. Get token from: https://github.com/settings/tokens
4. Required scope: `repo` (full control of private repositories)
5. Restart dev server: `npm run dev`

---

### Issue: "No changes provided to commit"

**Symptom:**
```
Error: No changes provided to commit
```

**Solution:**
Check that `changes.changes` array is not empty:

```typescript
console.log(changes.changes.length);  // Should be > 0
```

---

### Issue: "No valid changes to commit after processing"

**Symptom:**
```
Error: No valid changes to commit after processing
```

**Cause:** All changes are either:
- Delete actions (which don't create blobs)
- Missing content field

**Solution:**
Ensure non-delete changes have `content`:

```typescript
const changes = {
  changes: [
    {
      filePath: 'src/App.tsx',
      action: 'modify',
      content: '// Must provide content!'  // ← Required
    }
  ]
};
```

---

### Issue: "Failed to {operation}: 404 Not Found"

**Symptom:**
```
GitHubNotFoundError: GitHub resource not found: get base branch 'main'
```

**Causes:**
1. Repository doesn't exist
2. Branch name is wrong (case-sensitive!)
3. PAT doesn't have access (private repo)

**Solutions:**
1. Verify repo exists: `https://github.com/owner/repo`
2. Check default branch name:
   - Modern repos: `main`
   - Older repos: `master`
3. Verify PAT has access to private repos

---

### Issue: Rate Limit Exceeded

**Symptom:**
```
GitHubRateLimitError: GitHub API rate limit exceeded.
```

**Solution:**
1. Wait 60 minutes for reset
2. Use authenticated requests (provide PAT)
3. Check rate limit status:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/rate_limit
   ```

**Rate Limits:**
- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour

---

### Issue: PR Already Exists

**Symptom:**
```
[GitHub] Pull request already exists: #42
```

**This is NOT an error!**

The system detected an existing PR for the same branch and returns the existing PR instead of creating a duplicate.

**Result:**
```typescript
{
  prNumber: 42,
  prUrl: 'https://github.com/owner/repo/pull/42',
  title: 'Existing PR title'
}
```

You can continue to push commits to the same branch, and they'll appear in the existing PR.

---

### Issue: "Failed to update branch" (Force Push Conflict)

**Symptom:**
```
Error: Failed to update branch 'feature-branch': fast-forward update rejected
```

**Cause:** Branch reference can't be updated (someone else pushed commits)

**Solution:**
1. Use a new branch name
2. Pull latest changes first (if working locally)
3. Resolve conflicts manually on GitHub

---

### Issue: Slow Commit Operations

**Symptom:** `commitToGitHub()` takes 10+ seconds

**Causes:**
1. Many files being committed (creates many blobs)
2. Large file contents
3. Slow network connection

**Solutions:**
1. **Use progress callback** to show user what's happening
2. **Batch related changes** instead of many small commits
3. **Optimize file sizes** - avoid committing large files
4. **Check network** - GitHub API latency

**Optimization Example:**
```typescript
// Before: 10 separate commits (slow)
for (const change of changes) {
  await commitToGitHub({ changes: [change] }, owner, repo);
}

// After: 1 batched commit (fast)
await commitToGitHub({ changes }, owner, repo);
```

---

## Additional Resources

- **GitHub API Docs**: https://docs.github.com/en/rest
- **Creating PAT**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **GitHub Rate Limits**: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting
- **MilkStack Troubleshooting Guide**: `docs/TROUBLESHOOTING.md`
- **Developer Onboarding**: `docs/DEVELOPER_ONBOARDING.md`

---

**Questions or Issues?**

- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Create an issue on GitHub
- Contact the development team
