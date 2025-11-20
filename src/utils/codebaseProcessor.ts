// A list of directories that should be ignored during codebase processing.
const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.svelte-kit', 
  'venv', '__pycache__', '.vscode', '.idea'
];

// A list of file extensions for binary or non-text files to be ignored.
const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', 
  '.pdf', '.zip', '.gz', '.tar', '.rar', '.7z', 
  '.mp4', '.mov', '.avi', '.mp3', '.wav', '.ogg', 
  '.o', '.a', '.so', '.dll', '.exe', '.jar', '.class', 
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.DS_Store'
];

// A list of specific filenames to be ignored.
const IGNORED_FILES = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
];

// Add a safety limit (e.g., 1MB per file)
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * A type representing a file-like object with a potential relative path.
 * The standard File object from a directory upload often includes webkitRelativePath.
 */
// Fix: Use Omit to override the 'webkitRelativePath' property from the base File type,
// making it optional to correctly reflect its behavior in different upload scenarios
// (e.g., single file vs. directory upload).
interface ProcessableFile extends Omit<File, 'webkitRelativePath'> {
  webkitRelativePath?: string;
}

/**
 * Checks if a file should be ignored based on its path, name, or type.
 * @param file - The file to check.
 * @returns True if the file should be ignored, false otherwise.
 */
const isIgnored = (file: ProcessableFile): boolean => {
  const path = file.webkitRelativePath || file.name;
  const pathParts = path.split('/');

  if (pathParts.some(part => IGNORED_DIRS.includes(part))) {
    return true;
  }

  if (IGNORED_FILES.includes(file.name)) {
    return true;
  }

  if (IGNORED_EXTENSIONS.some(ext => file.name.endsWith(ext))) {
    return true;
  }
  
  if (file.type && !file.type.startsWith('text/')) {
      const allowedMimeTypes = ['application/json', 'application/javascript', 'application/xml', 'application/x-typescript'];
      if (!allowedMimeTypes.includes(file.type)) {
          return true;
      }
  }

  return false;
};

/**
 * Generates a string representation of the file tree.
 * @param files - An array of files with relative paths.
 * @returns A string representing the file tree.
 */
const generateFileTreeManifest = (files: ProcessableFile[]): string => {
    const tree: { [key: string]: any } = {};
    files.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        const parts = path.split('/');
        let currentLevel = tree;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                currentLevel[part] = null; // Mark as file
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
            if (node[entry] !== null) { // It's a directory
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += buildTreeString(node[entry], newPrefix);
            }
        });
        return result;
    };

    return `/\n${buildTreeString(tree)}`;
};

/**
 * Processes a collection of files from a codebase into a single context string.
 * This function filters out irrelevant files, generates a file tree manifest,
 * and concatenates the content of all valid text-based files.
 *
 * @param files - A collection of File objects, typically from a directory upload.
 * @returns A promise that resolves to a single structured string containing
 *          both the manifest and the concatenated file contents.
 */
export const processCodebase = async (files: ProcessableFile[]): Promise<string> => {
  const fileList = Array.from(files); // Convert FileList to array if necessary
  const validFiles = fileList.filter(file => !isIgnored(file));
  
  if (validFiles.length === 0) {
    return "No processable files found in the provided codebase.";
  }

  const fileTree = generateFileTreeManifest(validFiles);

  const contentPromises = validFiles.map(async file => {
    try {
      const path = file.webkitRelativePath || file.name;

      // FIX: Check file size before reading
      if (file.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`Skipping large file ${path}: ${(file.size / 1024).toFixed(2)}KB`);
        return `// =================================================================
// FILE: ${path}
// =================================================================

// Skipped: File too large (>1MB)
`;
      }

      const content = await file.text();
      return `
// =================================================================
// FILE: ${path}
// =================================================================

${content}
`;
    } catch (error) {
      const path = file.webkitRelativePath || file.name;
      console.warn(`Could not read file ${path}:`, error);
      return `// =================================================================\n// FILE: ${path}\n// =================================================================\n\n// Error: Could not read file content. It may be a binary file or have encoding issues.\n`;
    }
  });

  const allContents = await Promise.all(contentPromises);
  const concatenatedContents = allContents.join('');

  return `# Codebase Context

## File Tree Manifest
\`\`\`
${fileTree}
\`\`\`

## Concatenated File Contents
${concatenatedContents}
`;
};
