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
