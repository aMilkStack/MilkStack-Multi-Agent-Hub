/**
 * Rusty Feedback Service
 *
 * Enables AI-to-AI collaboration through GitHub:
 * - Rusty analyzes code and writes feedback to rusty.md
 * - Claude Code reads rusty.md to see Rusty's analysis
 * - Both AIs communicate asynchronously through the repo
 */

import { RustyAnalysis } from './rustyPortableService';

export interface RustyFeedback {
  timestamp: Date;
  analysis: RustyAnalysis;
  commitSha?: string;
  branch: string;
}

/**
 * Format Rusty's analysis as markdown for rusty.md
 */
export function formatRustyFeedback(analysis: RustyAnalysis, commitSha?: string, branch: string = 'main'): string {
  const timestamp = new Date().toISOString();

  return `# 🔧 Rusty's Analysis Report

**Generated:** ${timestamp}
**Commit:** ${commitSha || 'unknown'}
**Branch:** ${branch}

---

## 📊 Code Quality Grade: ${analysis.grade}

${analysis.review}

---

## 🚨 Critical Issues Found: ${analysis.criticalIssues}

${analysis.criticalIssues > 0 ? '⚠️ **Action Required:** Please review the critical issues highlighted above.' : '✅ **All Clear:** No critical issues detected.'}

---

## 📝 Recommendations

${analysis.recommendations || 'Continue monitoring the codebase for potential improvements.'}

---

*This report was generated automatically by Rusty, Claude's inside agent. For questions, consult with Real Claude (Claude Code).*
`;
}

/**
 * Commit rusty.md to GitHub repository
 * This allows Claude Code to read Rusty's feedback
 */
export async function commitRustyFeedback(
  owner: string,
  repo: string,
  branch: string,
  feedback: string,
  githubToken?: string
): Promise<void> {
  if (!githubToken) {
    throw new Error('GitHub token required to commit rusty.md');
  }

  const filePath = 'rusty.md';
  const message = `chore: Update Rusty's analysis report [automated]`;

  try {
    // Get current file SHA if it exists (needed for updates)
    const getFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    let currentSha: string | undefined;

    try {
      const getResponse = await fetch(getFileUrl, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        currentSha = fileData.sha;
      }
    } catch (error) {
      // File doesn't exist yet, that's okay
      console.log('rusty.md does not exist yet, will create new file');
    }

    // Create or update the file
    const createFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const content = btoa(unescape(encodeURIComponent(feedback))); // Base64 encode

    const requestBody: any = {
      message,
      content,
      branch,
    };

    if (currentSha) {
      requestBody.sha = currentSha;
    }

    const response = await fetch(createFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to commit rusty.md: ${error.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ rusty.md committed successfully:', result.commit.sha);
  } catch (error) {
    console.error('Error committing rusty.md:', error);
    throw error;
  }
}

/**
 * Read rusty.md from GitHub repository
 * This allows Claude Code to see Rusty's feedback
 */
export async function fetchRustyFeedback(
  owner: string,
  repo: string,
  branch: string = 'main',
  githubToken?: string
): Promise<string | null> {
  const filePath = 'rusty.md';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(url, { headers });

    if (response.status === 404) {
      // File doesn't exist yet
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch rusty.md: ${response.statusText}`);
    }

    const data = await response.json();

    // Decode base64 content
    const content = decodeURIComponent(escape(atob(data.content)));

    return content;
  } catch (error) {
    console.error('Error fetching rusty.md:', error);
    return null;
  }
}

/**
 * Get the latest commit SHA for a branch
 */
export async function getLatestCommitSha(
  owner: string,
  repo: string,
  branch: string = 'main',
  githubToken?: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`;

  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to get commit SHA: ${response.statusText}`);
    }

    const data = await response.json();
    return data.object.sha;
  } catch (error) {
    console.error('Error getting commit SHA:', error);
    return null;
  }
}
