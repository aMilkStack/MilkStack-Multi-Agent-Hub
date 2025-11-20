/**
 * Rusty Chat Types
 * Defines structures for the Rusty meta-agent chat system
 */

export interface RustyMessage {
  id: string;
  role: 'user' | 'rusty';
  content: string;
  timestamp: Date;
}

export interface RustyChat {
  id: string;
  name: string; // Chat name/title
  messages: RustyMessage[];
  createdAt: Date;
  updatedAt: Date;
}
