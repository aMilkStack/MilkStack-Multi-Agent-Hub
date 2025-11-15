// Utility helper functions for MilkStack Multi-Agent Hub

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.html', '.css', '.scss', '.sass', '.py', '.java',
    '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.yml', '.yaml', '.xml', '.svg',
    '.toml', '.ini', '.env', '.gitignore', '.dockerignore'
  ];

  return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

export function shouldIgnoreFile(path: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some(pattern => path.includes(pattern));
}
