/**
 * Claude Code Service Type Definitions
 *
 * Types for the Claude-based code analysis and chat functionality
 * that replaces the Gemini-based Rusty service.
 */

/**
 * Authentication method type
 * - 'api-key': Standard API key authentication for developers
 * - 'subscription': Session token for Pro/Max subscription users
 */
export type AuthMethod = 'api-key' | 'subscription';

/**
 * Claude authentication credentials
 */
export interface ClaudeAuthCredentials {
  type: AuthMethod;
  value: string;
}

export interface RuntimeError {
  message: string;
  type: 'javascript' | 'api' | 'quota' | 'react' | 'unknown';
  stack?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface ClaudeAnalysisRequest {
  userQuery: string;
  codebaseContext?: string;
  errorContext?: RuntimeError[];
  focusAreas?: string[];
}

export interface CriticalIssue {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  recommendation: string;
}

export interface Recommendation {
  priority: number;
  action: string;
  reasoning: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ClaudeAnalysisResponse {
  content: string;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  criticalIssues: number;
  recommendations: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

export interface ClaudeMessage {
  id: string;
  role: 'user' | 'claude';
  content: string;
  timestamp: Date;
  metadata?: {
    toolsUsed?: string[];
    filesAccessed?: string[];
    model?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}

export interface ClaudeChat {
  id: string;
  name: string;
  messages: ClaudeMessage[];
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaudeServiceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cwd?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool' | 'complete' | 'error';
  content: string;
  metadata?: {
    toolName?: string;
    input?: unknown;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
    cost?: number;
    duration?: number;
  };
}

/**
 * Structured output schema for code analysis
 */
export interface CodeAnalysisResult {
  summary: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  criticalIssues: CriticalIssue[];
  strengths: string[];
  recommendations: Recommendation[];
}

/**
 * SDK-related types for Claude Agent SDK integration
 */

/**
 * Tool activity status for UI display
 */
export interface ToolActivity {
  toolName: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  elapsedSeconds?: number;
  description?: string;
}

/**
 * Session information for SDK conversations
 */
export interface ClaudeSession {
  sessionId: string;
  startedAt: Date;
  lastActivityAt: Date;
  numTurns: number;
  totalCostUsd: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

/**
 * Extended Claude message with SDK metadata
 */
export interface ClaudeMessageWithSDK extends ClaudeMessage {
  /** SDK-specific UUID for this message */
  sdkUuid?: string;
  /** Parent tool use ID if this is a tool result */
  parentToolUseId?: string;
  /** Tool activities during this message */
  toolActivities?: ToolActivity[];
  /** Whether this message is still streaming */
  isStreaming?: boolean;
}

/**
 * Permission request for destructive operations
 */
export interface PermissionRequest {
  toolName: string;
  input: Record<string, unknown>;
  description: string;
  suggestions?: string[];
  blockedPath?: string;
  decisionReason?: string;
}

/**
 * SDK configuration for Claude Agent
 */
export interface ClaudeAgentConfig {
  /** Permission mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' */
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  /** Tools that are allowed without prompting */
  allowedTools: string[];
  /** Tools that are explicitly disallowed */
  disallowedTools: string[];
  /** Additional directories to allow access */
  additionalDirectories: string[];
  /** Maximum number of turns per query */
  maxTurns?: number;
  /** Maximum budget in USD per query */
  maxBudgetUsd?: number;
}
