/**
 * Rate Limiter for Gemini API calls
 *
 * Prevents Google from flagging API keys as "leaked" due to suspicious traffic patterns.
 * Uses a token bucket algorithm with configurable rate limits.
 *
 * Why this is needed:
 * - Parallel execution can cause burst traffic (3-4 simultaneous API calls)
 * - Retry logic can compound the issue
 * - High TPM usage from large context windows
 * - Google's automated systems flag unusual patterns as potentially compromised keys
 */

import { rustyLogger, LogLevel } from '../services/rustyPortableService';

/**
 * Configuration for rate limiting
 */
interface RateLimiterConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  /** Minimum delay between consecutive requests (ms) */
  minDelayBetweenRequests: number;
  /** Maximum concurrent requests (for parallel execution) */
  maxConcurrentRequests: number;
}

/**
 * Default configuration based on Gemini API quotas
 * Flash: 15 RPM, Pro: 2 RPM
 * We use conservative limits to avoid triggering fraud detection
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequestsPerMinute: 10, // Conservative limit (lower than Flash's 15 RPM)
  minDelayBetweenRequests: 500, // 500ms between requests
  maxConcurrentRequests: 2, // Limit parallel execution to 2 simultaneous calls
};

/**
 * Token bucket rate limiter
 * Implements a sliding window with token replenishment
 */
class RateLimiter {
  private config: RateLimiterConfig;
  private requestTimestamps: number[] = [];
  private currentConcurrentRequests = 0;
  private lastRequestTime = 0;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    rustyLogger.log(
      LogLevel.INFO,
      'RateLimiter',
      'Rate limiter initialized',
      {
        maxRequestsPerMinute: this.config.maxRequestsPerMinute,
        minDelayBetweenRequests: this.config.minDelayBetweenRequests,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
      }
    );
  }

  /**
   * Wait until a request can be made according to rate limits
   * This enforces both RPM limits and minimum delays between requests
   */
  async acquireToken(model: 'gemini-2.5-flash' | 'gemini-2.5-pro'): Promise<void> {
    const now = Date.now();

    // Clean up timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    // Check concurrent request limit
    while (this.currentConcurrentRequests >= this.config.maxConcurrentRequests) {
      rustyLogger.log(
        LogLevel.WARN,
        'RateLimiter',
        `Concurrent request limit reached (${this.config.maxConcurrentRequests}). Waiting...`,
        { currentConcurrent: this.currentConcurrentRequests }
      );
      await this.sleep(100); // Check every 100ms
    }

    // Check RPM limit
    if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);

      if (waitTime > 0) {
        rustyLogger.log(
          LogLevel.WARN,
          'RateLimiter',
          `RPM limit reached (${this.config.maxRequestsPerMinute}/min). Waiting ${waitTime}ms...`,
          {
            requestsInLastMinute: this.requestTimestamps.length,
            waitTimeMs: waitTime,
          }
        );
        await this.sleep(waitTime);
      }
    }

    // Enforce minimum delay between requests (prevents burst detection)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minDelayBetweenRequests) {
      const delayNeeded = this.config.minDelayBetweenRequests - timeSinceLastRequest;
      rustyLogger.log(
        LogLevel.DEBUG,
        'RateLimiter',
        `Enforcing minimum delay between requests (${delayNeeded}ms)`,
        { timeSinceLastRequest, delayNeeded }
      );
      await this.sleep(delayNeeded);
    }

    // Acquire the token
    this.requestTimestamps.push(Date.now());
    this.lastRequestTime = Date.now();
    this.currentConcurrentRequests++;

    rustyLogger.log(
      LogLevel.DEBUG,
      'RateLimiter',
      `Token acquired for ${model}`,
      {
        requestsInLastMinute: this.requestTimestamps.length,
        concurrentRequests: this.currentConcurrentRequests,
      }
    );
  }

  /**
   * Release a token after request completes
   * Must be called in a finally block to ensure it's always released
   */
  releaseToken(): void {
    this.currentConcurrentRequests = Math.max(0, this.currentConcurrentRequests - 1);
    rustyLogger.log(
      LogLevel.DEBUG,
      'RateLimiter',
      'Token released',
      { concurrentRequests: this.currentConcurrentRequests }
    );
  }

  /**
   * Get current rate limiter stats
   */
  getStats(): {
    requestsInLastMinute: number;
    concurrentRequests: number;
    utilizationPercent: number;
  } {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    return {
      requestsInLastMinute: recentRequests.length,
      concurrentRequests: this.currentConcurrentRequests,
      utilizationPercent: (recentRequests.length / this.config.maxRequestsPerMinute) * 100,
    };
  }

  /**
   * Update rate limiter configuration
   * Useful for adjusting limits based on API tier or user preferences
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
    rustyLogger.log(
      LogLevel.INFO,
      'RateLimiter',
      'Rate limiter configuration updated',
      this.config
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global rate limiter instance
 * Shared across all API calls to enforce limits application-wide
 */
export const geminiRateLimiter = new RateLimiter();

/**
 * Convenience wrapper for making rate-limited API calls
 * Automatically acquires token before call and releases it after
 *
 * @example
 * const response = await withRateLimit(
 *   'gemini-2.5-flash',
 *   () => ai.models.generateContent({ ... })
 * );
 */
export async function withRateLimit<T>(
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro',
  fn: () => Promise<T>
): Promise<T> {
  await geminiRateLimiter.acquireToken(model);

  try {
    const result = await fn();
    return result;
  } finally {
    geminiRateLimiter.releaseToken();
  }
}
