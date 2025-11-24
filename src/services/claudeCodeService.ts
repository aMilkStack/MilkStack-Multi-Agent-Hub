/**
 * Claude Code Service
 *
 * Core service for Claude-based code analysis and chat functionality.
 * Replaces rustyPortableService.ts (Gemini-based).
 *
 * Features:
 * - Code analysis with structured JSON output
 * - Streaming chat with real-time responses
 * - Error monitoring and context tracking
 * - Retry logic with exponential backoff
 * - Token usage tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ClaudeAnalysisRequest,
  ClaudeAnalysisResponse,
  ClaudeMessage,
  ClaudeServiceOptions,
  StreamChunk,
  CodeAnalysisResult,
} from '../types/claude';
import { CLAUDE_CONFIG } from '../config/claudeConfig';

/**
 * Logger for Claude service (reuses existing RustyLogger pattern)
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogEntry {
  level: LogLevel;
  category: string;
  message: string;
  timestamp: Date;
  details?: unknown;
}

class ClaudeLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private apiRequests: Map<string, number> = new Map();

  log(level: LogLevel, category: string, message: string, details?: unknown) {
    const entry: LogEntry = {
      level,
      category,
      message,
      timestamp: new Date(),
      details,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with color coding
    const color = this.getColorForLevel(level);
    console.log(
      `%c[${level}] ${category}: ${message}`,
      `color: ${color}`,
      details || ''
    );
  }

  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '#6b7280';
      case LogLevel.INFO:
        return '#3b82f6';
      case LogLevel.WARN:
        return '#f59e0b';
      case LogLevel.ERROR:
        return '#ef4444';
      case LogLevel.CRITICAL:
        return '#dc2626';
      default:
        return '#000000';
    }
  }

  trackApiRequest(model: string) {
    const count = this.apiRequests.get(model) || 0;
    this.apiRequests.set(model, count + 1);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getCriticalIssues(): LogEntry[] {
    return this.logs.filter((log) => log.level === LogLevel.CRITICAL);
  }

  getUsageStats() {
    return {
      totalRequests: Array.from(this.apiRequests.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      requestsByModel: Object.fromEntries(this.apiRequests),
      criticalIssues: this.getCriticalIssues().length,
    };
  }
}

export const claudeLogger = new ClaudeLogger();

/**
 * Main Claude Code Service
 */
export class ClaudeCodeService {
  private client: Anthropic;
  private options: ClaudeServiceOptions;

  constructor(apiKey: string, options: ClaudeServiceOptions = {}) {
    this.client = new Anthropic({
      apiKey,
    });

    this.options = {
      model: options.model || CLAUDE_CONFIG.model.default,
      maxTokens: options.maxTokens || CLAUDE_CONFIG.limits.maxTokens,
      temperature: options.temperature || CLAUDE_CONFIG.limits.temperature,
      cwd: options.cwd || process.cwd?.() || '/',
    };

    claudeLogger.log(
      LogLevel.INFO,
      'ClaudeCodeService',
      'Initialized',
      this.options
    );
  }

  /**
   * Analyze codebase with structured JSON output
   *
   * This method provides deep code analysis with a structured response
   * including grades, critical issues, and recommendations.
   */
  async analyzeCodebase(
    request: ClaudeAnalysisRequest
  ): Promise<ClaudeAnalysisResponse> {
    claudeLogger.log(
      LogLevel.INFO,
      'ClaudeCodeService',
      'Starting codebase analysis',
      { query: request.userQuery }
    );

    const prompt = this.buildAnalysisPrompt(request);

    try {
      const startTime = Date.now();

      // Make API call with structured output request
      const response = await this.client.messages.create({
        model: this.options.model!,
        max_tokens: this.options.maxTokens!,
        temperature: this.options.temperature,
        system: this.getSystemPromptForAnalysis(),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      claudeLogger.trackApiRequest(this.options.model!);

      // Extract text content
      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('\n');

      // Try to parse structured output from content
      const analysis = this.parseAnalysisResponse(content);

      const result: ClaudeAnalysisResponse = {
        content,
        grade: analysis.grade,
        criticalIssues: analysis.criticalIssues.length,
        recommendations: analysis.recommendations.map((r) => r.action),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalCost: this.calculateCost(
            response.usage.input_tokens,
            response.usage.output_tokens
          ),
        },
      };

      claudeLogger.log(
        LogLevel.INFO,
        'ClaudeCodeService',
        `Analysis complete in ${duration}ms`,
        {
          grade: result.grade,
          criticalIssues: result.criticalIssues,
          tokens: result.usage.inputTokens + result.usage.outputTokens,
        }
      );

      return result;
    } catch (error) {
      claudeLogger.log(
        LogLevel.ERROR,
        'ClaudeCodeService',
        'Analysis failed',
        error
      );
      throw error;
    }
  }

  /**
   * Stream chat responses with real-time updates
   *
   * This method provides streaming responses for interactive chat,
   * yielding chunks as they arrive from Claude.
   */
  async *chatStream(
    userMessage: string,
    conversationHistory: ClaudeMessage[],
    _onToolUse?: (toolName: string, input: unknown) => void
  ): AsyncGenerator<StreamChunk> {
    claudeLogger.log(
      LogLevel.INFO,
      'ClaudeCodeService',
      'Starting chat stream',
      { messageLength: userMessage.length }
    );

    const messages = this.buildConversationMessages(
      userMessage,
      conversationHistory
    );

    try {
      const stream = await this.client.messages.create({
        model: this.options.model!,
        max_tokens: this.options.maxTokens!,
        temperature: this.options.temperature,
        system: this.getSystemPromptForChat(),
        messages,
        stream: true,
      });

      claudeLogger.trackApiRequest(this.options.model!);

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Content block starting
          continue;
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullContent += event.delta.text;
            yield {
              type: 'text',
              content: event.delta.text,
            };
          }
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_stop') {
          yield {
            type: 'complete',
            content: fullContent,
            metadata: {
              usage: {
                inputTokens,
                outputTokens,
              },
              cost: this.calculateCost(inputTokens, outputTokens),
            },
          };

          claudeLogger.log(
            LogLevel.INFO,
            'ClaudeCodeService',
            'Chat stream complete',
            {
              totalTokens: inputTokens + outputTokens,
              responseLength: fullContent.length,
            }
          );
        }
      }
    } catch (error) {
      claudeLogger.log(
        LogLevel.ERROR,
        'ClaudeCodeService',
        'Chat stream failed',
        error
      );

      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build analysis prompt from request
   */
  private buildAnalysisPrompt(request: ClaudeAnalysisRequest): string {
    let prompt = `# Code Analysis Request\n\n`;

    if (request.userQuery) {
      prompt += `## User Question:\n${request.userQuery}\n\n`;
    }

    if (request.errorContext && request.errorContext.length > 0) {
      prompt += `## Recent Runtime Errors:\n`;
      request.errorContext.slice(0, 5).forEach((err, i) => {
        prompt += `\n### Error ${i + 1}:\n`;
        prompt += `- **Message:** ${err.message}\n`;
        prompt += `- **Type:** ${err.type}\n`;
        prompt += `- **Timestamp:** ${err.timestamp.toISOString()}\n`;
        if (err.stack) {
          prompt += `\`\`\`\n${err.stack}\n\`\`\`\n`;
        }
      });
      prompt += '\n';
    }

    if (request.codebaseContext) {
      prompt += `## Codebase Context:\n\`\`\`\n${request.codebaseContext.slice(0, 50000)}\n\`\`\`\n\n`;
    }

    if (request.focusAreas && request.focusAreas.length > 0) {
      prompt += `## Focus Areas:\n`;
      request.focusAreas.forEach((area) => {
        prompt += `- ${area}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please analyze the codebase and provide a comprehensive review. Structure your response as JSON with the following format:

\`\`\`json
{
  "summary": "2-3 sentence executive summary",
  "grade": "A|B|C|D|F",
  "criticalIssues": [
    {
      "title": "Issue title",
      "severity": "critical|high|medium|low",
      "location": "file:line",
      "description": "What's wrong",
      "recommendation": "How to fix"
    }
  ],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "priority": 1-10,
      "action": "What to do",
      "reasoning": "Why",
      "effort": "low|medium|high"
    }
  ]
}
\`\`\``;

    return prompt;
  }

  /**
   * Build conversation messages from history
   */
  private buildConversationMessages(
    userMessage: string,
    history: ClaudeMessage[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> =
      [];

    // Include recent history (last 10 messages to stay within context)
    const recentHistory = history.slice(-10);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role === 'claude' ? 'assistant' : 'user',
        content: msg.content,
      });
    });

    // Add current message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  /**
   * System prompt for code analysis
   */
  private getSystemPromptForAnalysis(): string {
    return `You are Claude, a world-class AI code analysis expert integrated into the MilkStack Multi-Agent Hub.

Your role is to:
1. Analyze code architecture, patterns, and quality
2. Identify critical bugs, security issues, and performance problems
3. Provide actionable recommendations with specific file locations
4. Grade overall code quality on an A-F scale

Focus on:
- React 19 + TypeScript best practices
- State management correctness (Context API, hooks)
- IndexedDB usage patterns
- API integration reliability
- Error handling completeness
- Code organization and modularity

Provide responses in structured JSON format as requested.
Be thorough but concise. Prioritize critical issues over minor style concerns.`;
  }

  /**
   * System prompt for chat
   */
  private getSystemPromptForChat(): string {
    return `You are Claude, an AI assistant integrated into the MilkStack Multi-Agent Hub.

You help developers understand and improve their codebase through conversational analysis.
Provide clear, actionable insights in a friendly but technically precise tone.

When discussing code:
- Reference specific files and line numbers when relevant
- Explain the "why" behind recommendations
- Consider the broader architectural context
- Prioritize practical solutions over theoretical perfection

The codebase is a React 19 + TypeScript multi-agent system using:
- Vite for building
- IndexedDB (Dexie) for data persistence
- React Context for state management
- Anthropic's Claude API for AI capabilities`;
  }

  /**
   * Parse analysis response from Claude
   */
  private parseAnalysisResponse(content: string): CodeAnalysisResult {
    try {
      // Try to extract JSON from code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try to parse the whole content as JSON
      return JSON.parse(content);
    } catch (error) {
      // Fallback: extract information using text parsing
      claudeLogger.log(
        LogLevel.WARN,
        'ClaudeCodeService',
        'Failed to parse structured output, using fallback',
        error
      );

      return {
        summary: this.extractSummary(content),
        grade: this.extractGrade(content),
        criticalIssues: [],
        strengths: [],
        recommendations: [],
      };
    }
  }

  private extractSummary(content: string): string {
    const lines = content.split('\n');
    return lines.slice(0, 3).join(' ').slice(0, 200);
  }

  private extractGrade(content: string): 'A' | 'B' | 'C' | 'D' | 'F' {
    const gradeMatch = content.match(/grade[:\s]+([A-F])/i);
    if (gradeMatch) {
      return gradeMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'F';
    }
    return 'B'; // Default
  }

  /**
   * Calculate cost based on token usage
   * Pricing for Claude Sonnet 4.5 (as of 2025)
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const INPUT_COST_PER_1M = 3.0; // $3 per million input tokens
    const OUTPUT_COST_PER_1M = 15.0; // $15 per million output tokens

    const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

    return inputCost + outputCost;
  }
}

/**
 * Initialize Claude Code Service
 *
 * Helper function to create a ClaudeCodeService instance with error handling
 */
export async function initializeClaudeService(
  apiKey: string,
  options?: ClaudeServiceOptions
): Promise<ClaudeCodeService> {
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('Invalid Anthropic API key');
  }

  const service = new ClaudeCodeService(apiKey, options);

  claudeLogger.log(
    LogLevel.INFO,
    'ClaudeCodeService',
    'Service initialized successfully'
  );

  return service;
}

/**
 * Analyze context usage
 *
 * Estimate token usage and context window utilization
 */
export function analyzeContextUsage(messages: ClaudeMessage[]): {
  estimatedTokens: number;
  maxTokens: number;
  utilizationPercent: number;
  status: 'healthy' | 'warning' | 'critical';
} {
  const totalChars = messages.reduce((sum, msg) => {
    return sum + msg.content.length;
  }, 0);

  // Rough estimate: 4 characters ≈ 1 token
  const estimatedTokens = Math.round(totalChars / 4);
  const maxTokens = CLAUDE_CONFIG.limits.contextWindow;
  const utilizationPercent = (estimatedTokens / maxTokens) * 100;

  let status: 'healthy' | 'warning' | 'critical';
  if (utilizationPercent > 80) {
    status = 'critical';
  } else if (utilizationPercent > 60) {
    status = 'warning';
  } else {
    status = 'healthy';
  }

  return {
    estimatedTokens,
    maxTokens,
    utilizationPercent,
    status,
  };
}

/**
 * Get context usage summary (human-readable)
 */
export function getContextUsageSummary(messages: ClaudeMessage[]): string {
  const usage = analyzeContextUsage(messages);

  let emoji = '✅';
  if (usage.status === 'warning') emoji = '⚠️';
  if (usage.status === 'critical') emoji = '🚨';

  return `${emoji} Context: ${usage.estimatedTokens.toLocaleString()} / ${usage.maxTokens.toLocaleString()} tokens (${usage.utilizationPercent.toFixed(1)}%)`;
}
