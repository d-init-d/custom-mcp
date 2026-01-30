/**
 * Cache Utility
 * In-memory caching with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheOptions {
  defaultTTLMs: number;
  maxEntries: number;
  cleanupIntervalMs: number;
}

const DEFAULT_OPTIONS: CacheOptions = {
  defaultTTLMs: 5 * 60 * 1000,    // 5 minutes
  maxEntries: 1000,
  cleanupIntervalMs: 60 * 1000   // 1 minute
};

export class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: CacheOptions;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanup();
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupIntervalMs);
    
    // Don't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    // Enforce max entries (LRU-style: remove oldest first)
    if (this.cache.size > this.options.maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      const toRemove = entries.slice(0, this.cache.size - this.options.maxEntries);
      for (const [key] of toRemove) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Generate cache key from URL and options
   */
  static generateKey(url: string, options?: Record<string, any>): string {
    const optionsString = options ? JSON.stringify(options, Object.keys(options).sort()) : '';
    return `${url}:${optionsString}`;
  }

  /**
   * Get item from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set item in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs || this.options.defaultTTLMs;

    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      createdAt: now
    });

    // Trigger cleanup if over max entries
    if (this.cache.size > this.options.maxEntries * 1.2) {
      this.cleanup();
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; defaultTTLMs: number } {
    this.cleanup();
    return {
      size: this.cache.size,
      maxEntries: this.options.maxEntries,
      defaultTTLMs: this.options.defaultTTLMs
    };
  }

  /**
   * Get or set with factory function
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      console.error(`[Cache] HIT: ${key.substring(0, 50)}...`);
      return cached;
    }

    console.error(`[Cache] MISS: ${key.substring(0, 50)}...`);
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

// Singleton cache instances
export const scrapeCache = new Cache({
  defaultTTLMs: 10 * 60 * 1000,  // 10 minutes for scrape results
  maxEntries: 500
});

export const searchCache = new Cache({
  defaultTTLMs: 5 * 60 * 1000,   // 5 minutes for search results
  maxEntries: 200
});

export const htmlCache = new Cache<string>({
  defaultTTLMs: 2 * 60 * 1000,   // 2 minutes for raw HTML
  maxEntries: 100
});
