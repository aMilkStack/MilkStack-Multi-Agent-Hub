/**
 * Type Guard Utilities
 * Provides runtime type checking functions for safer type narrowing
 */

import { Agent } from '../types';

/**
 * Type guard to check if a message author is an Agent object (not a string)
 * @param author - The author to check (either string for user messages or Agent for agent messages)
 * @returns true if author is an Agent object
 */
export function isAgent(author: string | Agent): author is Agent {
  return typeof author !== 'string' && author !== null && typeof author === 'object' && 'id' in author;
}

/**
 * Type guard to check if a message author is a string (user message)
 * @param author - The author to check
 * @returns true if author is a string (user message)
 */
export function isUserMessage(author: string | Agent): author is string {
  return typeof author === 'string';
}
