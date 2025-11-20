/**
 * Message Types
 * Defines message structure for the chat system
 */

import { Agent } from './agent';
import { AgentProposedChanges } from './github';

export interface Message {
  id: string;
  author: 'Ethan' | Agent;
  content: string;
  timestamp: Date;
  proposedChanges?: AgentProposedChanges; // Optional proposed code changes from agents
  isError?: boolean; // Indicates if this message represents an error state
  queuedUntil?: Date; // If set, message is queued and will be sent at this time
}
