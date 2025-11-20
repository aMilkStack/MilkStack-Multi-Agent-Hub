/**
 * Project and Settings Types
 * Defines project structure and application settings
 */

import { Message } from './message';
import { RustyChat } from './rusty';
import { ActiveTaskState, GeminiModel } from './workflow';

export interface Project {
  id: string;
  name: string;
  messages: Message[];
  codebaseContext: string;
  rustyChats: RustyChat[]; // Persistent Rusty chat history
  activeRustyChatId?: string; // Currently active Rusty chat
  createdAt: Date;
  updatedAt: Date;
  activeTaskState?: ActiveTaskState; // V2 Agency workflow state
  apiKey?: string; // Project-specific API key (overrides global settings)
}

export interface Settings {
  apiKey: string;
  githubPat: string;
  globalRules: string;
  model: GeminiModel;
}
