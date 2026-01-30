/**
 * Retry Utility with Exponential Backoff
 * Provides robust retry mechanism for network requests
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'rate limit',
    'timeout',
    '429',
    '500',
    '502',
    '503',
    '504'
  ]
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryable(error: Error, options: RetryOptions): boolean {
  const errorString = error.message.toLowerCase();
  const errorName = error.name?.toLowerCase() || '';
  
  return options.retryableErrors?.some(retryable => 
    errorString.includes(retryable.toLowerCase()) ||
    errorName.includes(retryable.toLowerCase())
  ) ?? false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt >= opts.maxRetries || !isRetryable(lastError, opts)) {
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, opts);
      
      // Callback for logging/monitoring
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay);
      }

      console.error(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed: ${lastError.message}`);
      console.error(`[Retry] Waiting ${delay}ms before next attempt...`);
      
      await sleep(delay);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Retry wrapper for fetch requests
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: Partial<RetryOptions>
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);
    
    // Treat certain status codes as retryable errors
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, retryOptions);
}

/**
 * Create a retry-wrapped function
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<RetryOptions>
): T {
  return ((...args: Parameters<T>) => withRetry(() => fn(...args), options)) as T;
}
