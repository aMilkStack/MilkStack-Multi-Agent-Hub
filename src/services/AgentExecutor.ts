/**
 * AgentExecutor Service
 *
 * Handles all Gemini API interactions with retry logic, model fallback,
 * and abort signal support. Decouples API calling from orchestration logic.
 */

import { GoogleGenAI } from '@google/generative-ai';
import { Agent, GeminiModel } from '../../types';
import { rustyLogger, LogLevel } from './rustyPortableService';

export interface AgentExecutionConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
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
 */
export class AgentExecutor {
  private ai: GoogleGenAI;
  private abortSignal?: AbortSignal;

  constructor(ai: GoogleGenAI, abortSignal?: AbortSignal) {
    this.ai = ai;
    this.abortSignal = abortSignal;
  }

  /**
   * Execute a single agent with streaming response
   * Used for interactive chat where we want to show chunks as they arrive
   */
  async executeStreaming(
    agent: Agent,
    model: GeminiModel,
    conversationContents: any,
    config: AgentExecutionConfig,
    onChunk: (chunk: string) => void
  ): Promise<AgentExecutionResult> {
    this.checkAborted();

    const finalModel = await this.callWithFallback(
      model,
      conversationContents,
      config,
      true,
      onChunk
    );

    // For streaming, onChunk has already received all content
    return {
      content: '', // Content was streamed via onChunk
      model: finalModel
    };
  }

  /**
   * Execute a single agent without streaming (for parallel execution)
   * Returns the complete response at once
   */
  async executeNonStreaming(
    agent: Agent,
    model: GeminiModel,
    conversationContents: any,
    config: AgentExecutionConfig
  ): Promise<AgentExecutionResult> {
    this.checkAborted();

    let finalModel = model;
    const response = await this.callWithFallback(
      model,
      conversationContents,
      config,
      false
    );

    const content = response.response?.text?.() || '';

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
    conversationContents: any,
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
   * Core API call - uses gemini-2.5-pro exclusively
   */
  private async callWithFallback(
    model: GeminiModel,
    contents: any,
    config: any,
    streaming: boolean,
    onChunk?: (chunk: string) => void
  ): Promise<any> {
    // Always use gemini-2.5-pro (no fallback)
    return await this.makeApiCall('gemini-2.5-pro', contents, config, streaming, onChunk);
  }

  /**
   * Make the actual Gemini API call
   */
  private async makeApiCall(
    model: GeminiModel,
    contents: any,
    config: any,
    streaming: boolean,
    onChunk?: (chunk: string) => void
  ): Promise<any> {
    if (streaming) {
      console.log('[AgentExecutor] Making streaming API call with model:', model);
      console.log('[AgentExecutor] Config:', JSON.stringify(config, null, 2));

      let streamResult;
      try {
        streamResult = await this.ai.models.generateContentStream({
          model,
          contents,
          config
        });
        console.log('[AgentExecutor] Stream result received:', {
          hasResult: !!streamResult,
          hasStream: !!(streamResult?.stream),
          streamType: streamResult?.stream ? typeof streamResult.stream : 'N/A'
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

      // CRITICAL FIX: Check if streamResult and its stream property are valid
      if (!streamResult || !streamResult.stream) {
        rustyLogger.log(
          LogLevel.ERROR,
          'AgentExecutor',
          'generateContentStream returned undefined or null stream',
          { model, config, streamResult }
        );
        throw new Error('API call failed: The response stream was empty. This is often caused by an invalid or expired API key. Please verify your key in the global settings.');
      }

      // Process stream chunks
      if (onChunk) {
        for await (const chunk of streamResult.stream) {
          this.checkAborted();
          const text = chunk.text();
          if (text) {
            onChunk(text);
          }
        }
      }

      return streamResult;
    } else {
      return await this.ai.models.generateContent({
        model,
        contents,
        config
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
 */
export function createAgentExecutor(
  ai: GoogleGenAI,
  abortSignal?: AbortSignal
): AgentExecutor {
  return new AgentExecutor(ai, abortSignal);
}
