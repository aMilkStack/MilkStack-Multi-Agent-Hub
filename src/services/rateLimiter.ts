/**
 * Rate Limiter with Concurrency Control
 *
 * Manages API rate limits and concurrent execution for Gemini API calls.
 *
 * **Rate Limit**: Maximum calls per second (delays excess calls)
 * **Parallelism Limit**: Maximum concurrent executions (waits for available slots)
 *
 * Example: rate=2/sec, parallelism=3
 * - Up to 3 agents can run concurrently
 * - But only 2 new calls can start per second
 * - Additional calls are queued and executed when limits allow
 */

export interface RateLimiterConfig {
    /** Maximum calls that can start per second */
    ratePerSecond: number;
    /** Maximum number of concurrent executions */
    maxParallelism: number;
    /** Maximum tokens per minute (TPM) - Gemini Pro paid tier is ~2M TPM */
    maxTokensPerMinute?: number;
    /** Name for logging purposes */
    name?: string;
}

interface QueuedCall<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
    estimatedTokens?: number;
}

export class RateLimiter {
    private config: RateLimiterConfig;
    private callTimestamps: number[] = [];
    private activeExecutions = 0;
    private queue: QueuedCall<any>[] = [];
    private processing = false;
    private tokenUsage: { timestamp: number; tokens: number }[] = [];

    constructor(config: RateLimiterConfig) {
        this.config = config;
    }

    /**
     * Estimate tokens from text (rough: 1 token ≈ 4 chars)
     */
    static estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Execute a function with rate, concurrency, AND token limits
     */
    async execute<T>(fn: () => Promise<T>, estimatedTokens?: number): Promise<T> {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rateLimiter.ts:55',message:'rateLimiter.execute queued',data:{queueLength:this.queue.length+1,activeExecutions:this.activeExecutions,estimatedTokens,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ execute: fn, resolve, reject, estimatedTokens });
            this.processQueue();
        });
    }

    private async processQueue() {
        // Prevent concurrent queue processing
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            // Check if we can start a new execution
            if (this.activeExecutions >= this.config.maxParallelism) {
                // Wait for a slot to free up
                await this.waitForSlot();
                continue;
            }

            // Check rate limit
            const now = Date.now();
            this.cleanOldTimestamps(now);

            // Check TPM limit (tokens per minute)
            if (this.config.maxTokensPerMinute) {
                const tokensInLastMinute = this.getTokensInLastMinute(now);
                const nextCall = this.queue[0];
                const estimatedTokens = nextCall?.estimatedTokens || 0;

                if (tokensInLastMinute + estimatedTokens > this.config.maxTokensPerMinute) {
                    const name = this.config.name || 'RateLimiter';
                    // Calculate wait time - wait for tokens to "expire" (older than 1 minute)
                    const waitTime = Math.min(30000, Math.max(10000, (tokensInLastMinute / this.config.maxTokensPerMinute) * 60000));
                    console.log(`[${name}] TPM limit hit (${tokensInLastMinute}/${this.config.maxTokensPerMinute}). Waiting ${Math.round(waitTime / 1000)}s for tokens to clear...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }

            if (this.callTimestamps.length >= this.config.ratePerSecond) {
                // Calculate how long to wait
                const oldestCall = this.callTimestamps[0];
                const timeSinceOldest = now - oldestCall;
                const waitTime = 1000 - timeSinceOldest;

                if (waitTime > 0) {
                    const name = this.config.name || 'RateLimiter';
                    console.log(`[${name}] Rate limit reached (${this.config.ratePerSecond}/sec). Waiting ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }

            // Start the next queued call
            const call = this.queue.shift();
            if (!call) break;

            this.startExecution(call);
        }

        this.processing = false;
    }

    private startExecution<T>(call: QueuedCall<T>) {
        const name = this.config.name || 'RateLimiter';
        this.activeExecutions++;
        this.callTimestamps.push(Date.now());

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rateLimiter.ts:119',message:'rateLimiter.startExecution',data:{activeExecutions:this.activeExecutions,maxParallelism:this.config.maxParallelism,rateInLastSecond:this.callTimestamps.length,rateLimit:this.config.ratePerSecond,estimatedTokens:call.estimatedTokens,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        // Record token usage for TPM tracking
        if (call.estimatedTokens && call.estimatedTokens > 0) {
            this.tokenUsage.push({ timestamp: Date.now(), tokens: call.estimatedTokens });
            const tokensInMinute = this.getTokensInLastMinute(Date.now());
            console.log(`[${name}] Recorded ${call.estimatedTokens} tokens (TPM: ${tokensInMinute}/${this.config.maxTokensPerMinute || 'unlimited'})`);
        }

        console.log(`[${name}] Starting execution (active: ${this.activeExecutions}/${this.config.maxParallelism}, rate: ${this.callTimestamps.length}/${this.config.ratePerSecond} in last 1s)`);

        call.execute()
            .then(result => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rateLimiter.ts:133',message:'rateLimiter.execute success',data:{activeExecutions:this.activeExecutions-1,timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                this.activeExecutions--;
                call.resolve(result);
                // Continue processing queue after completion
                this.processQueue();
            })
            .catch(error => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/72ed71a1-34c6-4149-b017-0792e60d92c6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rateLimiter.ts:140',message:'rateLimiter.execute error',data:{activeExecutions:this.activeExecutions-1,errorMessage:error?.message,is429:error?.message?.includes('429'),timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                this.activeExecutions--;
                call.reject(error);
                // Continue processing queue even on error
                this.processQueue();
            });
    }

    private waitForSlot(): Promise<void> {
        return new Promise(resolve => {
            // Poll for available slot every 100ms
            const interval = setInterval(() => {
                if (this.activeExecutions < this.config.maxParallelism) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    private cleanOldTimestamps(now: number) {
        // Remove timestamps older than 1 second
        const oneSecondAgo = now - 1000;
        this.callTimestamps = this.callTimestamps.filter(ts => ts > oneSecondAgo);
    }

    private getTokensInLastMinute(now: number): number {
        const oneMinuteAgo = now - 60000;
        this.tokenUsage = this.tokenUsage.filter(t => t.timestamp > oneMinuteAgo);
        return this.tokenUsage.reduce((sum, t) => sum + t.tokens, 0);
    }

    /**
     * Record token usage for TPM tracking
     */
    recordTokenUsage(tokens: number) {
        this.tokenUsage.push({ timestamp: Date.now(), tokens });
    }

    /**
     * Get current limiter status
     */
    getStatus() {
        const now = Date.now();
        this.cleanOldTimestamps(now);

        return {
            activeExecutions: this.activeExecutions,
            maxParallelism: this.config.maxParallelism,
            callsInLastSecond: this.callTimestamps.length,
            rateLimit: this.config.ratePerSecond,
            queuedCalls: this.queue.length,
            tokensInLastMinute: this.getTokensInLastMinute(now),
            maxTokensPerMinute: this.config.maxTokensPerMinute,
        };
    }
}

/**
 * Free Tier Rate Limiter (Gemini 2.5 Flash)
 * Limit: 15 RPM (0.25 calls/sec)
 * Config: 12 RPM (0.2 calls/sec) safe buffer
 */
export function createFreeTierRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 0.2,
        maxParallelism: 3,
        name: 'GeminiFree'
    });
}

/**
 * Paid Tier Rate Limiter (Gemini 2.5 Pro)
 * Limit: 150 RPM (2.5 calls/sec) for Tier 1 paid tier
 * 
 * Config: 120 RPM (2.0 calls/sec) - 80% of limit with safety margin
 * This prevents hitting 429s while allowing reasonable throughput
 *
 * NOTE: Discovery Mode makes rapid sequential calls (Orchestrator → Specialist)
 * so we keep maxParallelism=1 to prevent burst 429s, but allow 2 calls/sec.
 */
export function createPaidTierRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 1.5, // 90 RPM - a safer setting for parallel execution
        maxParallelism: 3,  // Allow up to 3 parallel agents (for CODE_REVIEW stages)
        maxTokensPerMinute: 500000, // 500k TPM - a more realistic budget for Gemini 2.5 Pro
        name: 'GeminiPaid'
    });
}

/**
 * SINGLETON: Shared rate limiter for ALL Gemini API calls across the app
 * This ensures coordinated rate limiting between geminiService, discoveryService, etc.
 */
export const sharedRateLimiter = createPaidTierRateLimiter();
