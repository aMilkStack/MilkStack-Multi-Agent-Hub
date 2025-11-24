import { Message, Agent } from '../types';
import { WorkflowEngine } from '../services/WorkflowEngine';
import { ConversationContents, buildConversationContents } from '../services/geminiService';

/**
 * Smart Context Pruning for Agency V2 Workflows
 *
 * Different workflow stages need different context:
 * - PLANNING: Full history (user intent + all debate)
 * - IMPLEMENTATION: Just synthesized plan + codebase
 * - CODE_REVIEW: Implementation output + codebase
 * - SYNTHESIZE: Collected feedback + original plan
 *
 * This reduces token usage by 40-60% per stage.
 */

interface ContextFilter {
  includeAgents?: string[]; // Only include messages from these agents (kebab-case)
  excludeAgents?: string[]; // Exclude messages from these agents
  includeUser?: boolean; // Include user messages (default: true)
  includeSystem?: boolean; // Include system messages (default: true)
  maxMessages?: number; // Limit total messages included
}

/**
 * Build context with agent filtering
 */
export function buildContextWithFilter(
  fullHistory: Message[],
  filter: ContextFilter,
  codebaseContext: string
): ConversationContents {
  const filteredMessages = fullHistory.filter(msg => {
    const isUserMessage = typeof msg.author === 'string';

    // Always include user messages if includeUser is true (default)
    if (isUserMessage) {
      return filter.includeUser !== false;
    }

    const agent = msg.author as Agent;
    const agentId = agent.id;

    // Check system messages
    if (agentId.includes('system')) {
      return filter.includeSystem !== false;
    }

    // Apply include filter if specified
    if (filter.includeAgents && filter.includeAgents.length > 0) {
      return filter.includeAgents.includes(agentId);
    }

    // Apply exclude filter if specified
    if (filter.excludeAgents && filter.excludeAgents.length > 0) {
      return !filter.excludeAgents.includes(agentId);
    }

    // Default: include all agent messages
    return true;
  });

  // Apply max messages limit if specified
  const limitedMessages = filter.maxMessages
    ? filteredMessages.slice(-filter.maxMessages)
    : filteredMessages;

  return buildConversationContents(limitedMessages, codebaseContext);
}

/**
 * Build context specifically for feedback synthesis
 * Includes: User query + collected feedback + original plan
 */
export function buildContextWithFeedback(
  collectedFeedback: { agentName: string; content: string }[],
  fullHistory: Message[],
  codebaseContext: string
): ConversationContents {
  // Extract original user query (first user message)
  const userQuery = fullHistory.find(msg => typeof msg.author === 'string');

  // Extract the initial plan (product-planner's output)
  const planMessage = fullHistory.find(msg => {
    if (typeof msg.author === 'string') return false;
    const agent = msg.author as Agent;
    return agent.id === 'product-planner';
  });

  // Build minimal context with just query + plan
  const minimalHistory: Message[] = [];
  if (userQuery) minimalHistory.push(userQuery);
  if (planMessage) minimalHistory.push(planMessage);

  // Add collected feedback as synthetic messages
  const feedbackMessages: Message[] = collectedFeedback.map((feedback, index) => ({
    id: `feedback-${index}`,
    author: {
      id: feedback.agentName,
      name: feedback.agentName,
      description: 'Stage Feedback',
      prompt: '',
      avatar: '📝',
      color: '#6366f1',
      status: 'active',
    } as Agent,
    content: feedback.content,
    timestamp: new Date(),
  }));

  const synthesisHistory = [...minimalHistory, ...feedbackMessages];

  return buildConversationContents(synthesisHistory, codebaseContext);
}

/**
 * Smart context builder - automatically selects optimal context based on current workflow stage
 */
export function buildSmartContext(
  engine: WorkflowEngine | null,
  fullHistory: Message[],
  codebaseContext: string
): ConversationContents {
  // If no workflow engine, use full context (normal mode)
  if (!engine) {
    return buildConversationContents(fullHistory, codebaseContext);
  }

  const state = engine.getState();
  const currentStage = state.taskMap.tasks[state.currentTaskIndex]?.stages[state.currentStageIndex];

  if (!currentStage) {
    return buildConversationContents(fullHistory, codebaseContext);
  }

  // Stage-specific context pruning
  switch (currentStage.stageName) {
    case 'PLANNING':
    case 'PLAN_REVIEW':
      // Planners need full context to understand user intent and debate
      return buildConversationContents(fullHistory, codebaseContext);

    case 'IMPLEMENTATION':
      // Builders only need the synthesized plan (product-planner output) + codebase
      // Exclude all review/feedback debate
      return buildContextWithFilter(
        fullHistory,
        {
          includeAgents: ['product-planner', 'orchestrator'],
          includeSystem: true,
          includeUser: true,
        },
        codebaseContext
      );

    case 'CODE_REVIEW':
    case 'TESTING':
      // Reviewers need implementation output (builder messages) + codebase
      // Don't need planning debate
      return buildContextWithFilter(
        fullHistory,
        {
          includeAgents: ['builder', 'orchestrator'],
          includeSystem: true,
          includeUser: true,
          maxMessages: 20, // Limit context window for faster reviews
        },
        codebaseContext
      );

    case 'SYNTHESIZE':
      // Synthesizer needs: user query + collected feedback + original plan
      // This is the most aggressive pruning
      return buildContextWithFeedback(
        state.collectedFeedback,
        fullHistory,
        codebaseContext
      );

    case 'DEBUGGING':
      // Debuggers need recent implementation + error messages
      return buildContextWithFilter(
        fullHistory,
        {
          includeAgents: ['builder', 'system-error'],
          includeSystem: true,
          includeUser: true,
          maxMessages: 15,
        },
        codebaseContext
      );

    case 'DOCUMENTATION':
      // Documentation writers need implementation + synthesized output
      return buildContextWithFilter(
        fullHistory,
        {
          includeAgents: ['builder', 'synthesizer', 'orchestrator'],
          includeSystem: true,
          includeUser: true,
        },
        codebaseContext
      );

    default:
      // Unknown stage - use full context as fallback
      console.warn(`[SmartContext] Unknown stage: ${currentStage.stageName}, using full context`);
      return buildConversationContents(fullHistory, codebaseContext);
  }
}

/**
 * Build lightweight orchestrator context - file tree only, no full codebase
 * Used for routing decisions where we don't need file contents
 */
export function buildOrchestratorContext(
  fullHistory: Message[],
  codebaseContext: string
): ConversationContents {
  // Extract just the file tree from codebase context
  const fileTreeSummary = extractFileTreeSummary(codebaseContext);

  // Keep only last 5 messages for routing decisions
  const recentHistory = fullHistory.slice(-5);

  return buildConversationContents(recentHistory, fileTreeSummary);
}

/**
 * Extract file paths from full codebase context to create a lightweight summary
 */
export function extractFileTreeSummary(codebaseContext: string): string {
  if (!codebaseContext) return '';

  // Match file paths from codebase context format: "=== path/to/file.ts ===" or similar
  const filePathPattern = /(?:===|###)\s*([^\s=]+\.[a-zA-Z]+)\s*(?:===|$)/g;
  const paths: string[] = [];
  let match;

  while ((match = filePathPattern.exec(codebaseContext)) !== null) {
    paths.push(match[1]);
  }

  // If no paths found with that pattern, try line-by-line extraction
  if (paths.length === 0) {
    const lines = codebaseContext.split('\n');
    for (const line of lines) {
      // Look for common file path patterns
      const pathMatch = line.match(/^(?:File:|Path:)?\s*(\S+\.[a-zA-Z]{1,5})\s*$/);
      if (pathMatch) {
        paths.push(pathMatch[1]);
      }
    }
  }

  // Build summary
  if (paths.length > 0) {
    return `# Project Structure (${paths.length} files)\n${paths.map(p => `- ${p}`).join('\n')}`;
  }

  // Fallback: return truncated context (first 2000 chars)
  return `# Codebase Summary\n${codebaseContext.substring(0, 2000)}...\n[Truncated for routing - full context available to specialists]`;
}

/**
 * Calculate token savings from context pruning
 */
export function estimateTokenSavings(
  fullHistory: Message[],
  filteredHistory: Message[]
): { original: number; filtered: number; savings: number; savingsPercent: number } {
  // Rough token estimation: ~4 chars per token
  const estimateTokens = (messages: Message[]) => {
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  };

  const originalTokens = estimateTokens(fullHistory);
  const filteredTokens = estimateTokens(filteredHistory);
  const savings = originalTokens - filteredTokens;
  const savingsPercent = originalTokens > 0 ? (savings / originalTokens) * 100 : 0;

  return {
    original: originalTokens,
    filtered: filteredTokens,
    savings,
    savingsPercent,
  };
}
