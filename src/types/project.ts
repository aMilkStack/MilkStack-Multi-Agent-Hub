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
  rustyChats: RustyChat[]; // Persistent Rusty chat history (deprecated, migrating to Claude)
  activeRustyChatId?: string; // Currently active Rusty chat (deprecated)
  claudeChats: ClaudeChat[]; // Persistent Claude chat history
  activeClaudeChatId?: string; // Currently active Claude chat
  createdAt: Date;
  updatedAt: Date;
  activeTaskState?: ActiveTaskState; // V2 Agency workflow state
  apiKey?: string; // Project-specific API key (overrides global settings)
  claudeApiKey?: string; // Claude/Anthropic API key (separate from Gemini)
}

export interface Settings {
  apiKey: string; // Gemini API key (for Rusty + all agents: Builder, Architect, etc.)
  claudeApiKey?: string; // Anthropic API key (ONLY for Claude - replaces Rusty as meta-agent)
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}
