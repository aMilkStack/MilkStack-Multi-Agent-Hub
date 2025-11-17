/**
 * GitHub Service - Handles fetching repository contents via GitHub API
 */

interface GitHubFile {
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  size: number;
}

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
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3.raw'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
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

  if (!treeResponse.ok) {
    if (treeResponse.status === 404) {
      throw new Error(`Repository not found or branch "${branch}" does not exist.`);
    }
    if (treeResponse.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please add a GitHub token in settings.');
    }
    throw new Error(`Failed to fetch repository: ${treeResponse.statusText}`);
  }

  const treeData = await treeResponse.json();
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
