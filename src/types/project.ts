/**
 * Project and Settings Types
 * Defines project structure and application settings
 */

import { Message } from './message';
import { RustyChat } from './rusty';
import { ClaudeChat } from './claude';
import { ActiveTaskState, GeminiModel } from './workflow';

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebaseContext: string;
  rustyChats: RustyChat[]; // Rusty chat history (Gemini-based - deprecated)
  activeRustyChatId?: string; // Active Rusty chat (deprecated)
  claudeChats: ClaudeChat[]; // Rusty chat history (Claude-based - new)
  activeClaudeChatId?: string; // Active Rusty chat (new)
  createdAt: Date;
  updatedAt: Date;
  activeTaskState?: ActiveTaskState; // V2 Agency workflow state
  // apiKey removed - now read from GEMINI_API_KEY environment variable
  // claudeApiKey removed - now read from VITE_ANTHROPIC_API_KEY environment variable
}

export interface Settings {
  // apiKey removed - now read from GEMINI_API_KEY environment variable
  // claudeApiKey removed - now read from VITE_ANTHROPIC_API_KEY environment variable
  // githubPat removed - now read from VITE_GITHUB_TOKEN environment variable
  globalRules: string;
  model: GeminiModel;
}
