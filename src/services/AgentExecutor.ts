/**
 * AgentExecutor Service
 *
 * Handles all Gemini API interactions with retry logic, model fallback,
 * and abort signal support. Decouples API calling from orchestration logic.
 */

import { GoogleGenAI } from '@google/genai'; // FIXED: Updated import
import { Agent, GeminiModel } from '../../types';
import { rustyLogger, LogLevel } from './rustyPortableService';
import { RateLimiter } from './rateLimiter';
import { DEFAULT_MODEL } from '../config/ai';

/**
 * Type-safe configuration for agent execution
 * Maps to Gemini API GenerateContentConfig
 */
export interface AgentExecutionConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  thinking_config?: {
    include_thoughts: boolean;
    budget_tokens: number;
  };
}

/**
 * Type-safe conversation contents for Gemini API
 */
export interface ConversationContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Gemini API response structure
 */
export interface GenerateContentResponse {
  text?: string | (() => string);
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Gemini API streaming response structure
 */
export interface GenerateContentStreamResponse {
  stream?: AsyncIterable<GenerateContentChunk>;
  [Symbol.asyncIterator]?: () => AsyncIterator<GenerateContentChunk>;
}

/**
 * Individual chunk from streaming response
 */
export interface GenerateContentChunk {
  text?: string | (() => string);
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface AgentExecutionResult {
  content: string;
  model: GeminiModel;
}

export interface ParallelExecutionResult {
  agent: Agent;
  content: string;
  model: GeminiModel;
}

/**
 * AgentExecutor handles all Gemini API calls with:
 * - Exclusive use of gemini-2.5-pro model
 * - Abort signal support for cancellation
 * - Streaming and non-streaming execution
 * - Parallel execution with staggered starts
 * - Built-in rate limiting to prevent API quota exhaustion
 */
export class AgentExecutor {
  private ai: GoogleGenAI;
  private abortSignal?: AbortSignal;
  private rateLimiter: RateLimiter;

  constructor(ai: GoogleGenAI, rateLimiter: RateLimiter, abortSignal?: AbortSignal) {
    this.ai = ai;
    this.rateLimiter = rateLimiter;
    this.abortSignal = abortSignal;
  }

  /**
   * Execute a single agent with streaming response
   * Used for interactive chat where we want to show chunks as they arrive
   * Rate limiting is applied automatically at the service level
   */
  async executeStreaming(
    agent: Agent,
    model: GeminiModel,
    conversationContents: ConversationContent[],
    config: AgentExecutionConfig,
    onChunk: (chunk: string) => void
  ): Promise<AgentExecutionResult> {
    this.checkAborted();

    // Wrap in rate limiter to ensure all API calls are controlled
    const finalModel = await this.rateLimiter.execute(async () => {
      return await this.callWithFallback(
        model,
        conversationContents,
        config,
        true,
        onChunk
      );
    });

    // For streaming, onChunk has already received all content
    return {
      content: '', // Content was streamed via onChunk
      model: finalModel
    };
  }

  /**
   * Execute a single agent without streaming (for parallel execution)
   * Returns the complete response at once
   * Rate limiting is applied automatically at the service level
   */
  async executeNonStreaming(
    agent: Agent,
    model: GeminiModel,
    conversationContents: ConversationContent[],
    config: AgentExecutionConfig
  ): Promise<AgentExecutionResult> {
    this.checkAborted();

    // Wrap in rate limiter to ensure all API calls are controlled
    const finalModel = await this.rateLimiter.execute(async () => {
      return await this.callWithFallback(
        model,
        conversationContents,
        config,
        false
      );
    });

    // Get the non-streaming response from the API
    const response = await this.ai.models.generateContent({
      model: finalModel,
      contents: conversationContents,
      config
    }) as GenerateContentResponse;

    // Type-safe text extraction with proper guards
    let content = '';
    if (response && typeof response.text === 'function') {
        content = response.text();
    } else if (response && typeof response.text === 'string') {
        content = response.text;
    } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        content = response.candidates[0].content.parts[0].text;
    }

    return {
      content,
      model: finalModel
    };
  }

  /**
   * Execute multiple agents in parallel with staggered start times
   * Used for CODE_REVIEW and PLAN_REVIEW stages
   */
  async executeParallel(
    agents: Agent[],
    model: GeminiModel,
    conversationContents: ConversationContent[],
    config: AgentExecutionConfig,
    staggerDelayMs: number = 500
  ): Promise<ParallelExecutionResult[]> {
    const promises = agents.map(async (agent, index) => {
      // Stagger starts to avoid API rate limits
      if (index > 0) {
        await this.delay(staggerDelayMs * index);
      }

      this.checkAborted();

      const result = await this.executeNonStreaming(
        agent,
        model,
        conversationContents,
        config
      );

      return {
        agent,
        content: result.content,
        model: result.model
      };
    });

    return await Promise.all(promises);
  }

  /**
   * Core API call - uses DEFAULT_MODEL (gemini-2.5-pro) exclusively
   * Type-safe wrapper that delegates to makeApiCall
   */
  private async callWithFallback(
    model: GeminiModel,
    contents: ConversationContent[],
    config: AgentExecutionConfig,
    streaming: boolean,
    onChunk?: (chunk: string) => void
  ): Promise<GeminiModel> {
    // Always use DEFAULT_MODEL (no fallback)
    await this.makeApiCall(DEFAULT_MODEL, contents, config, streaming, onChunk);
    return DEFAULT_MODEL;
  }

  /**
   * Make the actual Gemini API call
   * Returns GenerateContentResponse for non-streaming, GenerateContentStreamResponse for streaming
   */
  private async makeApiCall(
    model: GeminiModel,
    contents: ConversationContent[],
    config: AgentExecutionConfig,
    streaming: boolean,
    onChunk?: (chunk: string) => void
  ): Promise<GenerateContentResponse | GenerateContentStreamResponse> {
    if (streaming) {
      console.log('[AgentExecutor] Making streaming API call with model:', model);
      console.log('[AgentExecutor] Config:', JSON.stringify(config, null, 2));

      let streamResult: GenerateContentStreamResponse;
      try {
        streamResult = await this.ai.models.generateContentStream({
          model,
          contents,
          config
        }) as GenerateContentStreamResponse;
        console.log('[AgentExecutor] Stream result received:', {
          hasResult: !!streamResult,
          isAsyncIterator: !!(streamResult?.[Symbol.asyncIterator]),
          resultType: streamResult ? typeof streamResult : 'N/A'
        });
      } catch (apiError) {
        console.error('[AgentExecutor] API call threw error:', apiError);
        rustyLogger.log(
          LogLevel.ERROR,
          'AgentExecutor',
          'generateContentStream threw error',
          { model, error: apiError instanceof Error ? apiError.message : String(apiError) }
        );
        throw new Error(`API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}. Check your API key and network connection.`);
      }

      // CRITICAL FIX: Check if streamResult is valid
      if (!streamResult) {
        rustyLogger.log(
          LogLevel.ERROR,
          'AgentExecutor',
          'generateContentStream returned undefined or null',
          { model, config }
        );
        throw new Error('API call failed: The response stream was empty. This is often caused by an invalid or expired API key. Please verify your key in the global settings.');
      }

      // Process stream chunks
      if (onChunk) {
        // Type-safe handling: Check for both SDK versions (result.stream vs result is iterable)
        const iterable: AsyncIterable<GenerateContentChunk> = streamResult.stream || streamResult as AsyncIterable<GenerateContentChunk>;

        try {
            for await (const chunk of iterable) {
              this.checkAborted();

              // Type-safe text extraction with proper guards
              let text = '';
              if (typeof chunk.text === 'function') {
                text = chunk.text();
              } else if (typeof chunk.text === 'string') {
                text = chunk.text;
              } else if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                text = chunk.candidates[0].content.parts[0].text;
              }

              if (text) {
                onChunk(text);
              }
            }
        } catch (streamError) {
            console.error('[AgentExecutor] Error iterating stream:', streamError);
            throw streamError;
        }
      }

      return streamResult;
    } else {
      // Non-streaming: return standard response
      const response = await this.ai.models.generateContent({
        model,
        contents,
        config
      }) as GenerateContentResponse;
      return response;
    }
  }

  /**
   * Check if execution has been aborted
   */
  private checkAborted(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Agent execution aborted by user');
    }
  }

  /**
   * Delay helper for staggered execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an AgentExecutor instance
 * Rate limiter must be provided to ensure all API calls are controlled
 */
export function createAgentExecutor(
  ai: GoogleGenAI,
  rateLimiter: RateLimiter,
  abortSignal?: AbortSignal
): AgentExecutor {
  return new AgentExecutor(ai, rateLimiter, abortSignal);
}
