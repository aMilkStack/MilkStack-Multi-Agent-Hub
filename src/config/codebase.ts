/**
 * Codebase Processing Configuration
 *
 * Configuration for codebase file processing, including ignore patterns
 * and file size limits.
 */

/**
 * Directories that should be ignored during codebase processing
 */
export const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.svelte-kit',
  'venv',
  '__pycache__',
  '.vscode',
  '.idea',
  'coverage',
  '.nyc_output',
] as const;

/**
 * File extensions for binary or non-text files to be ignored
 */
export const IGNORED_EXTENSIONS = [
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.bmp',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  // Archives
  '.zip',
  '.gz',
  '.tar',
  '.rar',
  '.7z',
  // Media
  '.mp4',
  '.mov',
  '.avi',
  '.mp3',
  '.wav',
  '.ogg',
  // Binaries
  '.o',
  '.a',
  '.so',
  '.dll',
  '.exe',
  '.jar',
  '.class',
  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  // System
  '.DS_Store',
] as const;

/**
 * Specific filenames to be ignored
 */
export const IGNORED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.eslintcache',
] as const;

/**
 * Maximum file size in bytes (1MB per file)
 * Files larger than this will be skipped during processing
 */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * Allowed MIME types for non-text files
 */
export const ALLOWED_MIME_TYPES = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/x-typescript',
] as const;
