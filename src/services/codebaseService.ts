import { isTextFile, shouldIgnoreFile } from '../utils/helpers';

const IGNORE_PATTERNS = ['.git/', '__MACOSX', '.DS_Store', 'node_modules/', 'dist/', 'build/'];
const MAX_FILE_SIZE = 100000; // 100KB

export interface CodebaseFile {
  path: string;
  content: string;
}

/**
 * Process a folder using the File System Access API
 */
export async function processFolder(folderHandle: FileSystemDirectoryHandle): Promise<string> {
  const files: CodebaseFile[] = [];

  async function readDirectory(dirHandle: FileSystemDirectoryHandle, currentPath: string = '') {
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (shouldIgnoreFile(entryPath, IGNORE_PATTERNS)) {
        continue;
      }

      if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();

        if (isTextFile(file.name) && file.size < MAX_FILE_SIZE) {
          const content = await file.text();
          files.push({ path: entryPath, content });
        }
      } else if (entry.kind === 'directory') {
        await readDirectory(entry as FileSystemDirectoryHandle, entryPath);
      }
    }
  }

  await readDirectory(folderHandle);
  return formatCodebaseContext(files);
}

/**
 * Format files into a structured codebase context string
 */
export function formatCodebaseContext(files: CodebaseFile[]): string {
  if (files.length === 0) return '';

  // Create file tree
  const tree = buildFileTree(files);

  // Format as context string
  let context = '=== PROJECT FILE TREE ===\n\n';
  context += tree + '\n\n';
  context += '=== FILE CONTENTS ===\n\n';

  files.forEach(file => {
    context += `--- ${file.path} ---\n`;
    context += file.content;
    context += '\n\n';
  });

  return context;
}

/**
 * Build a visual file tree from file paths
 */
export function buildFileTree(files: CodebaseFile[]): string {
  const tree: any = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let current = tree;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        if (!current._files) current._files = [];
        current._files.push(part);
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });

  function renderTree(node: any, indent: string = ''): string {
    let result = '';

    // Render directories
    Object.keys(node).filter(k => k !== '_files').forEach(key => {
      result += `${indent}📁 ${key}/\n`;
      result += renderTree(node[key], indent + '  ');
    });

    // Render files
    if (node._files) {
      node._files.forEach((file: string) => {
        result += `${indent}📄 ${file}\n`;
      });
    }

    return result;
  }

  return renderTree(tree);
}
