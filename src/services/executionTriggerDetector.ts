import { Message } from '../types';

/**
 * Execution Trigger Detector
 * Detects when user wants to transition from Discovery Mode to Execution Mode
 */

/**
 * Keywords that signal user wants to start execution
 */
const EXECUTION_TRIGGER_KEYWORDS = [
  'go ahead',
  'implement',
  'execute',
  'start building',
  'build it',
  'make it',
  'create it',
  'do it',
  'proceed',
  'continue with implementation',
  "let's build",
  "let's implement",
  'start implementation',
  'crack on',
  'get on with it',
];

/**
 * Detects if the user's message signals readiness for execution
 */
export const detectExecutionTrigger = (message: string): boolean => {
  const normalized = message.toLowerCase().trim();
  
  return EXECUTION_TRIGGER_KEYWORDS.some(keyword => 
    normalized.includes(keyword)
  );
};

/**
 * Checks conversation history for execution readiness
 * Returns true if recent messages show consensus + user approval
 */
export const isReadyForExecution = (messages: Message[]): boolean => {
  // Check last 3 messages for execution signals
  const recentMessages = messages.slice(-3);
  
  return recentMessages.some(msg => {
    if (typeof msg.author === 'string') { // User message
      return detectExecutionTrigger(msg.content);
    }
    return false;
  });
};
