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
  apiKey?: string; // Project-specific Gemini API key (for agents)
  claudeApiKey?: string; // Project-specific Claude API key (for Rusty)
}

export interface Settings {
  apiKey: string; // Gemini API key (for multi-agent system: Builder, Architect, Debugger, etc.)
  claudeApiKey?: string; // Anthropic API key (for Rusty meta-agent)
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}
