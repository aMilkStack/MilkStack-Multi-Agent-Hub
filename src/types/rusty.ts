/**
 * Rusty Chat Types
 * Defines structures for the Rusty meta-agent chat system
 */

import { AgentProposedChanges } from './index';

export interface RustyMessage {
  id: string;
  role: 'user' | 'rusty';
  content: string;
  timestamp: Date;
  proposedChanges?: AgentProposedChanges;
}

export interface RustyChat {
  id: string;
  name: string; // Chat name/title
  messages: RustyMessage[];
  createdAt: Date;
  updatedAt: Date;
}
