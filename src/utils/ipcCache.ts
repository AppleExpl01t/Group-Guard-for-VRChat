/**
 * IPC Response Cache Utility
 * 
 * Provides a simple TTL-based cache for Electron IPC calls to prevent
 * redundant API requests when the same data is requested multiple times
 * in quick succession.
 * 
 * PERF FIX: Reduces redundant API calls during rapid navigation/interactions
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Global cache store
const ipcCache = new Map<string, CacheEntry<unknown>>();

// Default TTL is 5 seconds
const DEFAULT_TTL_MS = 5000;

/**
 * Execute an IPC call with caching
 * 
 * @param key - Unique cache key for this request (e.g., 'members-{groupId}')
 * @param fetcher - Async function that performs the actual IPC call
 * @param ttlMs - Time-to-live in milliseconds (default: 5000)
 * @returns Cached data or fresh data from fetcher
 */
export async function cachedIpcCall<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const cached = ipcCache.get(key);
  
  // Return cached data if still valid
  if (cached && (now - cached.timestamp) < ttlMs) {
    return cached.data as T;
  }
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  ipcCache.set(key, { data, timestamp: now });
  
  return data;
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string): void {
  ipcCache.delete(key);
}

/**
 * Invalidate all cache entries matching a prefix
 * Useful for invalidating all group-related caches when group changes
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of ipcCache.keys()) {
    if (key.startsWith(prefix)) {
      ipcCache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearIpcCache(): void {
  ipcCache.clear();
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: ipcCache.size,
    keys: Array.from(ipcCache.keys()),
  };
}
