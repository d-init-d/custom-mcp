/**
 * Rate Limiter Utility
 * Prevents request flooding and respects rate limits
 */

export interface RateLimiterOptions {
  requestsPerSecond: number;
  requestsPerMinute?: number;
  burstLimit?: number;
}

interface RequestRecord {
  timestamp: number;
}

export class RateLimiter {
  private requestsPerSecond: number;
  private requestsPerMinute: number;
  private burstLimit: number;
  private requests: RequestRecord[] = [];
  private lastRequestTime = 0;

  constructor(options: RateLimiterOptions) {
    this.requestsPerSecond = options.requestsPerSecond;
    this.requestsPerMinute = options.requestsPerMinute || options.requestsPerSecond * 60;
    this.burstLimit = options.burstLimit || Math.ceil(options.requestsPerSecond * 2);
  }

  /**
   * Clean up old request records
   */
  private cleanup(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(r => r.timestamp > oneMinuteAgo);
  }

  /**
   * Get current request counts
   */
  private getCounts(): { perSecond: number; perMinute: number } {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;

    const perSecond = this.requests.filter(r => r.timestamp > oneSecondAgo).length;
    const perMinute = this.requests.filter(r => r.timestamp > oneMinuteAgo).length;

    return { perSecond, perMinute };
  }

  /**
   * Calculate wait time before next request is allowed
   */
  getWaitTime(): number {
    this.cleanup();
    const counts = this.getCounts();
    const now = Date.now();

    // Check per-second limit
    if (counts.perSecond >= this.requestsPerSecond) {
      const oldestInWindow = this.requests
        .filter(r => r.timestamp > now - 1000)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      if (oldestInWindow) {
        return Math.max(0, oldestInWindow.timestamp + 1000 - now);
      }
    }

    // Check per-minute limit
    if (counts.perMinute >= this.requestsPerMinute) {
      const oldestInWindow = this.requests
        .filter(r => r.timestamp > now - 60000)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      if (oldestInWindow) {
        return Math.max(0, oldestInWindow.timestamp + 60000 - now);
      }
    }

    // Minimum delay between requests (anti-pattern detection)
    const minDelay = 500; // 500ms minimum between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < minDelay) {
      return minDelay - timeSinceLastRequest;
    }

    return 0;
  }

  /**
   * Check if request can be made immediately
   */
  canRequest(): boolean {
    return this.getWaitTime() === 0;
  }

  /**
   * Wait until request is allowed and record it
   */
  async acquire(): Promise<void> {
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      console.error(`[RateLimiter] Waiting ${waitTime}ms to respect rate limits...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.recordRequest();
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requests.push({ timestamp: now });
    this.lastRequestTime = now;
    this.cleanup();
  }

  /**
   * Get current status
   */
  getStatus(): { requestsInLastSecond: number; requestsInLastMinute: number; canRequest: boolean } {
    this.cleanup();
    const counts = this.getCounts();
    return {
      requestsInLastSecond: counts.perSecond,
      requestsInLastMinute: counts.perMinute,
      canRequest: this.canRequest()
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.lastRequestTime = 0;
  }
}

// Facebook-specific rate limiter (conservative defaults)
const facebookRateLimiter = new RateLimiter({
  requestsPerSecond: 1,    // 1 request per second
  requestsPerMinute: 20,   // 20 requests per minute max
  burstLimit: 3            // Allow burst of 3 quick requests
});

export { facebookRateLimiter };

/**
 * Decorator for rate-limited functions
 */
export function rateLimited<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limiter: RateLimiter = facebookRateLimiter
): T {
  return (async (...args: Parameters<T>) => {
    await limiter.acquire();
    return fn(...args);
  }) as T;
}
