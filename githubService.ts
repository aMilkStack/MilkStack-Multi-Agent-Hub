import * as JSZip from 'jszip';

// Helper to retrieve the token from local storage
const getGitHubToken = (): string | null => {
    try {
        return localStorage.getItem('github_pat');
    } catch (e) {
        console.error("Could not access localStorage for GitHub token.");
        return null;
    }
};

// Helper to parse GitHub URL
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') {
      return null;
    }
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
      return null;
    }
    const [owner, repo] = pathParts;
    // Strip .git from repo name if present
    const cleanRepo = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
    return { owner, repo: cleanRepo };
  } catch (e) {
    return null;
  }
}

// Helper to get the default branch of a repo
async function getDefaultBranch(owner: string, repo: string, token: string | null): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        if (response.status === 401) throw new Error("Invalid GitHub token.");
        if (response.status === 404) throw new Error("Repository not found.");
        throw new Error(`Could not fetch repo details (Status: ${response.status})`);
    }
    const repoData = await response.json();
    return repoData.default_branch || 'main'; // Fallback to 'main'
}

// Helper to decode base64
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  const len = binString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}


/**
 * Fetches a GitHub repository as a zip Blob by fetching individual files via the API.
 * This avoids CORS issues with the zipball download link.
 */
export async function fetchRepoAsZip(owner: string, repo:string): Promise<Blob> {
    const token = getGitHubToken();
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        // 1. Get default branch
        const branch = await getDefaultBranch(owner, repo, token);

        // 2. Get the file tree
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const treeResponse = await fetch(treeUrl, { headers });
        if (!treeResponse.ok) {
             if (treeResponse.status === 401) throw new Error("Invalid or expired GitHub token.");
            if (treeResponse.status === 404) throw new Error("Repository not found.");
            throw new Error(`Failed to fetch file tree (Status: ${treeResponse.status})`);
        }
        const treeData = await treeResponse.json();

        if (treeData.truncated) {
            console.warn("Warning: Repository file tree is truncated. Some files may be missing from the context.");
        }

        const filesToFetch = treeData.tree.filter((node: any) => node.type === 'blob' && node.size < 200000); // 200kb file limit

        if (filesToFetch.length === 0) {
            throw new Error("This repository appears to be empty or contains only very large files.");
        }

        // 3. Create a zip instance
        // FIX: Corrected JSZip instantiation. The `JSZip` object is the constructor itself, not a namespace with a `default` property.
        const zip = new JSZip();

        // 4. Fetch each file blob and add to zip
        // We run requests in chunks to avoid hitting rate limits.
        const chunkSize = 10;
        for (let i = 0; i < filesToFetch.length; i += chunkSize) {
            const chunk = filesToFetch.slice(i, i + chunkSize);
            await Promise.all(
                chunk.map(async (file: { path: string, url: string }) => {
                    try {
                        const blobResponse = await fetch(file.url, { headers });
                        if (!blobResponse.ok) {
                            console.warn(`Skipping file ${file.path} due to fetch error (Status: ${blobResponse.status}).`);
                            return;
                        }
                        const blobData = await blobResponse.json();
                        if (blobData.encoding === 'base64' && blobData.content) {
                            zip.file(file.path, base64ToBytes(blobData.content));
                        } else {
                            console.warn(`Skipping file ${file.path} due to unexpected encoding or empty content.`);
                        }
                    } catch (e) {
                         console.warn(`Error processing blob for file ${file.path}:`, e);
                    }
                })
            );
        }
        
        // 5. Generate and return the zip blob
        return await zip.generateAsync({ type: 'blob' });

    } catch (error) {
        console.error("Error in fetchRepoAsZip:", error);
        if (error instanceof Error) {
           throw error;
        }
        throw new Error("Could not download repository. Ensure it exists and you have access.");
    }
}