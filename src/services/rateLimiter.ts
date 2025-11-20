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
    /** Name for logging purposes */
    name?: string;
}

interface QueuedCall<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

export class RateLimiter {
    private config: RateLimiterConfig;
    private callTimestamps: number[] = [];
    private activeExecutions = 0;
    private queue: QueuedCall<any>[] = [];
    private processing = false;

    constructor(config: RateLimiterConfig) {
        this.config = config;
    }

    /**
     * Execute a function with rate and concurrency limits
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ execute: fn, resolve, reject });
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

        console.log(`[${name}] Starting execution (active: ${this.activeExecutions}/${this.config.maxParallelism}, rate: ${this.callTimestamps.length}/${this.config.ratePerSecond} in last 1s)`);

        call.execute()
            .then(result => {
                this.activeExecutions--;
                call.resolve(result);
                // Continue processing queue after completion
                this.processQueue();
            })
            .catch(error => {
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
        };
    }
}

/**
 * Create a rate limiter optimized for Gemini API dev keys
 *
 * Dev key limits:
 * - gemini-2.5-pro: 2 RPM (0.033 calls/sec)
 * - gemini-2.5-flash: 15 RPM (0.25 calls/sec)
 *
 * We use conservative settings safe for flash:
 * - Rate: 0.2 calls/sec (12 RPM) - safe for gemini-2.5-flash dev (15 RPM limit)
 * - Parallelism: 3 concurrent calls
 *
 * Note: gemini-2.5-pro dev keys (2 RPM) will be VERY slow with these settings
 */
export function createGeminiDevRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 0.2, // 12 RPM (safe for gemini-2.5-flash dev)
        maxParallelism: 3,
        name: 'GeminiDev'
    });
}

/**
 * Create a rate limiter optimized for Gemini API production keys (gemini-2.5-pro ONLY)
 *
 * Production limits for gemini-2.5-pro:
 * - RPM: 150 (2.5 calls/sec)
 * - TPM: 2M tokens/min
 *
 * Settings:
 * - Rate: 2 calls/sec (120 RPM - 80% of limit for safety margin)
 * - Parallelism: 8 concurrent calls (plenty of headroom at 150 RPM)
 */
export function createGeminiProdRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 2, // 120 RPM (80% of 150 RPM limit)
        maxParallelism: 8, // Higher for production throughput
        name: 'GeminiProd'
    });
}
