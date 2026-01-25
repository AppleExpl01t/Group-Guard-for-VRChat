/**
 * Retry Utility with Exponential Backoff
 * 
 * Wraps async operations with automatic retry logic using exponential backoff.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Optional jitter factor 0-1 to add randomness (default: 0.1) */
  jitter?: number;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback on each retry */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

/**
 * Default function to determine if an error is retryable.
 * Network errors and 5xx server errors are retryable.
 * 4xx client errors (except 429 rate limit) are not retryable.
 */
export const defaultIsRetryable = (error: unknown): boolean => {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check for HTTP status codes
  const statusCode = (error as { status?: number; statusCode?: number })?.status 
    || (error as { status?: number; statusCode?: number })?.statusCode;
  
  if (statusCode) {
    // Rate limit - retryable
    if (statusCode === 429) return true;
    // Server errors - retryable
    if (statusCode >= 500 && statusCode < 600) return true;
    // Client errors (except 429) - not retryable
    if (statusCode >= 400 && statusCode < 500) return false;
  }

  // Check for specific error messages
  const message = (error as Error)?.message?.toLowerCase() || '';
  if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
    return true;
  }

  // Default: retry on unknown errors
  return true;
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
const calculateDelay = (
  attempt: number, 
  initialDelay: number, 
  maxDelay: number, 
  multiplier: number, 
  jitter: number
): number => {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitterAmount = cappedDelay * jitter * Math.random();
  return Math.floor(cappedDelay + jitterAmount);
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute an async function with automatic retries using exponential backoff.
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with function result or rejects after all retries exhausted
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(() => fetchUserData(userId));
 * 
 * // With custom options
 * const result = await withRetry(
 *   () => apiCall(),
 *   { 
 *     maxRetries: 5,
 *     initialDelayMs: 500,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error}`)
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitter = 0.1,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        throw error;
      }

      // Calculate delay
      const delayMs = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, jitter);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This shouldn't be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retryable version of an async function.
 * Useful for wrapping API client methods.
 * 
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryable(
 *   (id: string) => apiClient.getUser(id),
 *   { maxRetries: 3 }
 * );
 * 
 * const user = await fetchWithRetry('user-123');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry configuration presets for common scenarios
 */
export const RetryPresets = {
  /** Quick retries for time-sensitive operations */
  fast: {
    maxRetries: 2,
    initialDelayMs: 250,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /** Default balanced retry strategy */
  default: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /** Patient retries for rate-limited APIs */
  patient: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitter: 0.2,
  } as RetryOptions,

  /** VRChat API specific - respects their rate limits */
  vrchat: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: 0.15,
    isRetryable: (error: unknown) => {
      const statusCode = (error as { status?: number })?.status;
      // VRChat often returns 429 when rate limited
      if (statusCode === 429) return true;
      // Server errors
      if (statusCode && statusCode >= 500) return true;
      // Network errors
      return defaultIsRetryable(error);
    },
  } as RetryOptions,
};
