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

// Configuration for retries
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // Start with 2 seconds
const MIN_429_BACKOFF_MS = 120000; // 120 seconds minimum for quota reset (429 errors) - ensures per-minute quota windows reset

/**
 * Estimate tokens from conversation contents
 * Uses ~4 chars per token approximation
 */
function estimateTokensFromContents(contents: Array<{ role: string; parts: Array<{ text: string }> }>): number {
  let totalChars = 0;
  for (const msg of contents) {
    for (const part of msg.parts) {
      totalChars += part.text?.length || 0;
    }
  }
  // Add 10% buffer for system prompts and overhead
  return Math.ceil((totalChars / 4) * 1.1);
}

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
  /** Force JSON output mode - use for orchestrator/router agents */
  responseMimeType?: 'text/plain' | 'application/json';
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
 * Custom error class for 429 errors that need to exit rate limiter and re-queue
 */
export class QuotaExhaustedError extends Error {
  constructor(message: string, public backoffMs: number) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
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

    // Estimate tokens for TPM tracking
    const estimatedTokens = estimateTokensFromContents(conversationContents);
    console.log(`[AgentExecutor] Estimated ${estimatedTokens} tokens for ${agent.id}`);

    // Wrap in rate limiter with token estimate for TPM tracking
    // CRITICAL: Handle QuotaExhaustedError by waiting and re-queuing through rate limiter
    const executeWithRetry = async (): Promise<GeminiModel> => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:144',message:'executeStreaming entering rateLimiter',data:{agentId:agent.id,model,estimatedTokens,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return await this.rateLimiter.execute(async () => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:145',message:'executeStreaming inside rateLimiter.execute callback',data:{agentId:agent.id,model,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return await this.callWithFallback(
            model,
            conversationContents,
            config,
            true,
            onChunk
          );
        }, estimatedTokens);
      } catch (error: any) {
        // Catch QuotaExhaustedError, wait for backoff, then re-queue through rate limiter
        if (error instanceof QuotaExhaustedError) {
          const waitStartTime = Date.now();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:155',message:'executeStreaming caught QuotaExhaustedError, waiting and re-queuing',data:{backoffMs:error.backoffMs,waitStartTime,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.log(`[AgentExecutor] Waiting ${Math.round(error.backoffMs / 1000)}s for quota reset, then re-queuing...`);
          await this.delay(error.backoffMs);
          const waitEndTime = Date.now();
          const actualWaitTime = waitEndTime - waitStartTime;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:180',message:'executeStreaming delay complete, re-queuing',data:{backoffMs:error.backoffMs,actualWaitTime,waitStartTime,waitEndTime,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Re-queue through rate limiter (recursive call)
          return await executeWithRetry();
        }
        throw error;
      }
    };
    
    const finalModel = await executeWithRetry();

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

    // Estimate tokens for TPM tracking
    const estimatedTokens = estimateTokensFromContents(conversationContents);
    console.log(`[AgentExecutor] Estimated ${estimatedTokens} tokens for ${agent.id} (non-streaming)`);

    // Wrap in rate limiter with token estimate for TPM tracking
    // CRITICAL: Handle QuotaExhaustedError by waiting and re-queuing through rate limiter
    const executeWithRetry = async (): Promise<GeminiModel> => {
      try {
        return await this.rateLimiter.execute(async () => {
          return await this.callWithFallback(
            model,
            conversationContents,
            config,
            false
          );
        }, estimatedTokens);
      } catch (error: any) {
        // Catch QuotaExhaustedError, wait for backoff, then re-queue through rate limiter
        if (error instanceof QuotaExhaustedError) {
          console.log(`[AgentExecutor] Waiting ${Math.round(error.backoffMs / 1000)}s for quota reset, then re-queuing...`);
          await this.delay(error.backoffMs);
          // Re-queue through rate limiter (recursive call)
          return await executeWithRetry();
        }
        throw error;
      }
    };
    
    const finalModel = await executeWithRetry();

    // Get the non-streaming response from the API
    const response = await this.retryOperation(async () => {
      return await this.ai.models.generateContent({
        model: finalModel,
        contents: conversationContents,
        config
      }) as GenerateContentResponse;
    });

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
   * Retry wrapper for API operations
   * Handles 429/503 errors with exponential backoff
   * CRITICAL: For 429 errors, throws QuotaExhaustedError to exit rate limiter and re-queue
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:269',message:'retryOperation started',data:{timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:274',message:'retryOperation attempt',data:{attempt,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:276',message:'retryOperation error caught',data:{attempt,errorMessage:error?.message,errorCode:error?.code,is429:error?.message?.includes('429'),timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Check if error is retryable (429 Too Many Requests or 503 Service Unavailable)
        const is429 = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
        const is503 = error.message?.includes('503') || error.message?.includes('overloaded');
        const isRetryable = is429 || is503;

        if (isRetryable && attempt < MAX_RETRIES) {
          // For 429 errors, use longer backoff (quota resets typically per minute)
          // For 503 errors, use shorter backoff (server overload is transient)
          const baseBackoff = is429 ? MIN_429_BACKOFF_MS : BASE_DELAY_MS;
          const exponentialBackoff = baseBackoff * Math.pow(2, attempt);
          const maxBackoff = is429 ? 120000 : 10000; // 429: up to 2 min, 503: up to 10s
          const backoffMs = Math.min(exponentialBackoff, maxBackoff);
          const jitter = Math.random() * (is429 ? 10000 : 1000); // More jitter for 429
          const delayMs = backoffMs + jitter;
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:291',message:'retryOperation scheduling retry',data:{attempt,backoffMs,delayMs,nextAttempt:attempt+1,is429,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // CRITICAL FIX: For 429 errors, exit rate limiter and re-queue after backoff
          // This ensures retries respect rate limits instead of bypassing them
          if (is429 && attempt === 0) {
            // First 429: exit rate limiter immediately, re-queue after backoff
            console.warn(`[AgentExecutor] 429 Quota exhausted. Exiting rate limiter and will re-queue after ${Math.round(delayMs / 1000)}s`);
            throw new QuotaExhaustedError(error.message || 'Resource exhausted', delayMs);
          }
          
          // For subsequent 429 retries or 503 errors: retry inside rate limiter
          console.warn(`[AgentExecutor] API Error ${error.message}. Retrying in ${Math.round(delayMs)}ms (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await this.delay(delayMs);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:293',message:'retryOperation backoff complete, retrying',data:{attempt,nextAttempt:attempt+1,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          continue;
        }
        
        // Not retryable or max retries reached
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:297',message:'retryOperation max retries reached or not retryable',data:{attempt,isRetryable,maxRetries:MAX_RETRIES,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw error;
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:308',message:'makeApiCall entry',data:{model,streaming,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (streaming) {
      console.log('[AgentExecutor] Making streaming API call with model:', model);
      
      // Use the retry wrapper for the streaming call setup
      let streamResult: GenerateContentStreamResponse = await this.retryOperation(async () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AgentExecutor.ts:320',message:'makeApiCall actual API call',data:{model,streaming,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return await this.ai.models.generateContentStream({
          model,
          contents,
          config
        }) as GenerateContentStreamResponse;
      });

      console.log('[AgentExecutor] Stream result received');

      // CRITICAL FIX: Check if streamResult is valid
      if (!streamResult) {
        throw new Error('API call failed: The response stream was empty.');
      }

      // Process stream chunks
      if (onChunk) {
        // Type-safe handling: Check for both SDK versions
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
        } catch (streamError: any) {
            console.error('[AgentExecutor] Error iterating stream:', streamError);
            // If stream dies mid-flight with 429, we should technically retry the whole request,
            // but for streaming that's complex. For now, let it fail but log clearly.
            throw streamError;
        }
      }

      return streamResult;
    } else {
      // Non-streaming: return standard response
      // NOTE: executeNonStreaming already wraps this call in retryOperation, 
      // but callWithFallback calls this directly, so we wrap here too for safety.
      return await this.retryOperation(async () => {
        return await this.ai.models.generateContent({
          model,
          contents,
          config
        }) as GenerateContentResponse;
      });
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
