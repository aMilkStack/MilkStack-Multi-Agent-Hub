/**
 * Claude Agent Service
 *
 * SDK-based service for Claude Agent functionality.
 * Uses @anthropic-ai/claude-agent-sdk for full agentic capabilities.
 *
 * Features:
 * - Full SDK integration with query() function
 * - Streaming responses via AsyncGenerator<SDKMessage>
 * - Session management (resume, continue)
 * - Tool permissions and hooks
 * - Subagent definitions
 * - Automatic context compaction
 */

import {
  query,
  type Query,
  type Options,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKResultMessage,
  type SDKUserMessage,
  type SDKSystemMessage,
  type SDKPartialAssistantMessage,
  type SDKToolProgressMessage,
  type AgentDefinition,
  type PermissionMode,
  type HookCallback,
} from '@anthropic-ai/claude-agent-sdk';
import { claudeLogger, LogLevel } from './claudeCodeService';

/**
 * Rusty Query Options
 *
 * Options for querying Claude via the SDK with Rusty persona
 */
export interface RustyQueryOptions {
  /** The user's prompt/message */
  prompt: string;
  /** Session ID for resuming conversations */
  sessionId?: string;
  /** Working directory for file operations */
  cwd?: string;
  /** Callback when a message is received */
  onMessage?: (message: SDKMessage) => void;
  /** Callback when a tool is being used */
  onToolUse?: (toolName: string, input: unknown) => void;
  /** Callback for tool progress updates */
  onToolProgress?: (toolName: string, elapsedSeconds: number) => void;
  /** AbortController for cancellation */
  abortController?: AbortController;
  /** Permission mode for tool usage */
  permissionMode?: PermissionMode;
  /** Custom system prompt append */
  systemPromptAppend?: string;
}

/**
 * Rusty Query Result
 *
 * Result from a Rusty query including usage statistics
 */
export interface RustyQueryResult {
  /** The final response content */
  content: string;
  /** Session ID for this conversation */
  sessionId: string;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Number of turns in the conversation */
  numTurns: number;
  /** Token usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  /** Tools that were used */
  toolsUsed: string[];
  /** Whether the query completed successfully */
  isSuccess: boolean;
  /** Error messages if any */
  errors?: string[];
}

/**
 * Default subagent definitions for Rusty
 */
export const RUSTY_SUBAGENTS: Record<string, AgentDefinition> = {
  sre: {
    description:
      'Diagnose and fix production issues, analyze logs, debug crashes',
    prompt: `You are an SRE specialist. Focus on reliability, performance, and incident response.
Your expertise includes:
- Analyzing error logs and stack traces
- Debugging production issues
- Performance optimization
- Infrastructure and deployment issues
- Monitoring and alerting setup`,
    tools: ['Read', 'Grep', 'Bash', 'Glob'],
    model: 'sonnet',
  },
  security: {
    description: 'Audit code for security vulnerabilities and best practices',
    prompt: `You are a security expert. Look for XSS, injection, auth issues, and data exposure.
Your expertise includes:
- Identifying security vulnerabilities (XSS, CSRF, SQL injection, etc.)
- Authentication and authorization review
- Data exposure and privacy concerns
- Secure coding practices
- Dependency vulnerability assessment`,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'sonnet',
  },
  reviewer: {
    description: 'Review code for style, patterns, and best practices',
    prompt: `You are a code reviewer. Focus on React patterns, TypeScript usage, and maintainability.
Your expertise includes:
- React 19 best practices and hooks patterns
- TypeScript type safety and proper typing
- Code organization and modularity
- Performance optimizations
- Testing strategies`,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'sonnet',
  },
};

/**
 * Default Rusty system prompt
 */
export const RUSTY_SYSTEM_PROMPT = `
You are Rusty, the Meta Code Guardian for MilkStack Multi-Agent Hub.
You analyze code, identify issues, and help developers improve their codebase.

Your personality:
- Thorough but concise - prioritize actionable insights
- Friendly and approachable - you're here to help, not criticize
- Technical precision - when you cite issues, be specific about locations
- Proactive - suggest improvements even when not explicitly asked

The codebase you're analyzing is a React 19 + TypeScript multi-agent system using:
- Vite for building
- IndexedDB (Dexie) for data persistence
- React Context for state management
- Anthropic's Claude API for AI capabilities

When analyzing code:
- Reference specific files and line numbers
- Explain the "why" behind recommendations
- Consider the broader architectural context
- Prioritize practical solutions over theoretical perfection
`;

/**
 * Query Rusty with the Claude Agent SDK
 *
 * This function creates a query to Claude using the SDK with Rusty's
 * persona and configuration. It yields SDK messages as they arrive.
 */
export async function* queryRusty(
  options: RustyQueryOptions
): AsyncGenerator<SDKMessage> {
  const abortController = options.abortController || new AbortController();

  claudeLogger.log(LogLevel.INFO, 'ClaudeAgentService', 'Starting Rusty query', {
    promptLength: options.prompt.length,
    hasSessionId: !!options.sessionId,
    cwd: options.cwd,
  });

  // Build the system prompt
  const systemPromptAppend = options.systemPromptAppend
    ? `${RUSTY_SYSTEM_PROMPT}\n\n${options.systemPromptAppend}`
    : RUSTY_SYSTEM_PROMPT;

  // Build query options
  const queryOptions: Options = {
    cwd: options.cwd,
    abortController,

    // Resume session if provided
    resume: options.sessionId,

    // Use Claude Code system prompt with Rusty persona
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: systemPromptAppend,
    },

    // Load project settings (including CLAUDE.md)
    settingSources: ['project'],

    // Permission mode
    permissionMode: options.permissionMode || 'default',

    // Tool permissions - default to safe read-only operations
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash', 'WebSearch', 'WebFetch'],

    // Subagents
    agents: RUSTY_SUBAGENTS,

    // Hooks for UI updates
    hooks: {
      PreToolUse: [
        {
          hooks: [
            createToolUseHook(options.onToolUse),
          ],
        },
      ],
    },

    // Include partial messages for streaming UI
    includePartialMessages: true,
  };

  try {
    const result: Query = query({
      prompt: options.prompt,
      options: queryOptions,
    });

    for await (const message of result) {
      // Call message callback if provided
      if (options.onMessage) {
        options.onMessage(message);
      }

      // Handle tool progress
      if (isToolProgressMessage(message) && options.onToolProgress) {
        options.onToolProgress(message.tool_name, message.elapsed_time_seconds);
      }

      yield message;
    }

    claudeLogger.log(
      LogLevel.INFO,
      'ClaudeAgentService',
      'Rusty query completed'
    );
  } catch (error) {
    claudeLogger.log(
      LogLevel.ERROR,
      'ClaudeAgentService',
      'Rusty query failed',
      error
    );
    throw error;
  }
}

/**
 * Create a hook callback for tool use notifications
 */
function createToolUseHook(
  onToolUse?: (toolName: string, input: unknown) => void
): HookCallback {
  // HookCallback requires Promise return, but we don't need async operations here
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (input, _toolUseId, { signal: _signal }) => {
    if (onToolUse && 'tool_name' in input) {
      onToolUse(input.tool_name, (input as { tool_input?: unknown }).tool_input);
    }
    return { continue: true };
  };
}

/**
 * Type guard for SDKAssistantMessage
 */
export function isAssistantMessage(
  message: SDKMessage
): message is SDKAssistantMessage {
  return message.type === 'assistant';
}

/**
 * Type guard for SDKResultMessage
 */
export function isResultMessage(
  message: SDKMessage
): message is SDKResultMessage {
  return message.type === 'result';
}

/**
 * Type guard for SDKUserMessage
 */
export function isUserMessage(message: SDKMessage): message is SDKUserMessage {
  return message.type === 'user';
}

/**
 * Type guard for SDKSystemMessage
 */
export function isSystemMessage(
  message: SDKMessage
): message is SDKSystemMessage {
  return message.type === 'system' && 'subtype' in message && message.subtype === 'init';
}

/**
 * Type guard for SDKPartialAssistantMessage (streaming)
 */
export function isPartialAssistantMessage(
  message: SDKMessage
): message is SDKPartialAssistantMessage {
  return message.type === 'stream_event';
}

/**
 * Type guard for SDKToolProgressMessage
 */
export function isToolProgressMessage(
  message: SDKMessage
): message is SDKToolProgressMessage {
  return message.type === 'tool_progress';
}

/**
 * Extract text content from an assistant message
 */
export function extractAssistantContent(message: SDKAssistantMessage): string {
  const textBlocks = message.message.content.filter(
    (block) => block.type === 'text'
  );
  return textBlocks
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n');
}

/**
 * Extract text content from a partial/streaming message
 */
export function extractStreamingContent(
  message: SDKPartialAssistantMessage
): string | null {
  const event = message.event;
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    return event.delta.text;
  }
  return null;
}

/**
 * Process SDK messages and aggregate into a final result
 */
export async function processRustyQuery(
  options: RustyQueryOptions
): Promise<RustyQueryResult> {
  let content = '';
  let sessionId = '';
  let totalCostUsd = 0;
  let numTurns = 0;
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
  const toolsUsed: string[] = [];
  let isSuccess = false;
  const errors: string[] = [];

  try {
    for await (const message of queryRusty(options)) {
      // Track session ID
      if ('session_id' in message && message.session_id) {
        sessionId = message.session_id;
      }

      // Handle assistant messages
      if (isAssistantMessage(message)) {
        content = extractAssistantContent(message);
      }

      // Handle streaming content
      if (isPartialAssistantMessage(message)) {
        const delta = extractStreamingContent(message);
        if (delta) {
          content += delta;
        }
      }

      // Handle tool progress
      if (isToolProgressMessage(message)) {
        if (!toolsUsed.includes(message.tool_name)) {
          toolsUsed.push(message.tool_name);
        }
      }

      // Handle result message
      if (isResultMessage(message)) {
        totalCostUsd = message.total_cost_usd;
        numTurns = message.num_turns;
        usage.inputTokens = message.usage.input_tokens;
        usage.outputTokens = message.usage.output_tokens;
        usage.cacheReadInputTokens = message.usage.cache_read_input_tokens;
        usage.cacheCreationInputTokens = message.usage.cache_creation_input_tokens;

        if (message.subtype === 'success') {
          isSuccess = true;
          content = message.result;
        } else {
          isSuccess = false;
          if ('errors' in message) {
            errors.push(...message.errors);
          }
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    content,
    sessionId,
    totalCostUsd,
    numTurns,
    usage,
    toolsUsed,
    isSuccess,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Re-export types from the SDK for convenience
 */
export type {
  SDKMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  SDKToolProgressMessage,
  PermissionMode,
  Options as SDKOptions,
  Query as SDKQuery,
  AgentDefinition,
};
