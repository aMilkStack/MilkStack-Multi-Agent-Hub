'use server';

import { Settings } from '@/lib/types';
import { Buffer } from 'buffer';

const GITHUB_API_BASE_URL = 'https://api.github.com';

async function githubApiRequest(path: string, token: string, options: RequestInit = {}) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };

    const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`GitHub API request failed for ${path}: ${errorBody.message}`);
    }

    return response.json();
}

function parseRepoUrl(url: string): { owner: string; repo: string } {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== 'github.com') {
            throw new Error('Invalid GitHub URL');
        }
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2) {
            throw new Error('Invalid GitHub repository path');
        }
        const [owner, repo] = pathParts;
        return { owner, repo: repo.replace('.git', '') };
    } catch (e) {
        throw new Error('Invalid GitHub URL format');
    }
}

export async function getGitLog(repoUrl: string, numCommits: number = 10, settings?: Settings): Promise<string> {
    if (!settings?.githubPat) {
        throw new Error('GitHub Personal Access Token is not configured.');
    }
    const { owner, repo } = parseRepoUrl(repoUrl);
    const commits = await githubApiRequest(`/repos/${owner}/${repo}/commits?per_page=${numCommits}`, settings.githubPat);

    return commits.map((commit: any) => 
        `Commit: ${commit.sha}\n` +
        `Author: ${commit.commit.author.name} <${commit.commit.author.email}>\n` +
        `Date: ${commit.commit.author.date}\n\n` +
        `    ${commit.commit.message}`
    ).join('\n\n---\n\n');
}

export async function getRepoContents(repoUrl: string, settings: Settings): Promise<any> {
    if (!settings.githubPat) {
        throw new Error('GitHub Personal Access Token is not configured.');
    }
    const { owner, repo } = parseRepoUrl(repoUrl);
    
    const repoInfo = await githubApiRequest(`/repos/${owner}/${repo}`, settings.githubPat);
    const defaultBranch = repoInfo.default_branch;

    const tree = await githubApiRequest(`/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, settings.githubPat);
    
    return tree;
}

export async function getFileContent(fileUrl: string, settings: Settings): Promise<string> {
    if (!settings.githubPat) {
        throw new Error('GitHub Personal Access Token is not configured.');
    }
    
    // We can't use the standard githubApiRequest because the fileUrl is absolute
    const headers = {
        'Accept': 'application/vnd.github.v3.raw',
        'Authorization': `Bearer ${settings.githubPat}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };

    const response = await fetch(fileUrl, { headers });
    
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`GitHub API request failed for ${fileUrl}: ${errorBody.message}`);
    }

    const blobData = await response.json();

    if (blobData.encoding !== 'base64') {
        throw new Error(`Unsupported file encoding: ${blobData.encoding}`);
    }

    return Buffer.from(blobData.content, 'base64').toString('utf-8');
}
