/**
 * Request Deduplication Utility
 * Prevents duplicate API calls by caching in-flight requests
 */

// Global cache for in-flight requests and their results
const inFlightRequests = new Map<string, Promise<unknown>>();
const requestCache = new Map<string, { data: unknown; timestamp: number }>();

// Default cache TTL: 5 seconds (prevents rapid duplicate calls)
const DEFAULT_CACHE_TTL = 5000;

interface DeduplicateOptions {
  /** Cache TTL in milliseconds (default: 5000) */
  ttl?: number;
  /** Force bypass cache */
  forceRefresh?: boolean;
}

/**
 * Deduplicate async requests - ensures only one request is made 
 * for the same key within the TTL window
 */
export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  options: DeduplicateOptions = {}
): Promise<T> {
  const { ttl = DEFAULT_CACHE_TTL, forceRefresh = false } = options;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  // Check if there's already an in-flight request for this key
  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  // Create new request and store it
  const request = requestFn()
    .then((result) => {
      // Cache the result
      requestCache.set(key, { data: result, timestamp: Date.now() });
      return result;
    })
    .finally(() => {
      // Remove from in-flight after completion
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

/**
 * Clear cached data for a specific key
 */
export function clearRequestCache(key?: string): void {
  if (key) {
    requestCache.delete(key);
    inFlightRequests.delete(key);
  } else {
    // Clear all if no key specified
    requestCache.clear();
    inFlightRequests.clear();
  }
}

/**
 * Clear all cached data
 */
export function clearAllRequestCache(): void {
  requestCache.clear();
  inFlightRequests.clear();
}

/**
 * Pre-defined cache keys for common requests
 */
export const CACHE_KEYS = {
  CURRENT_EMPLOYEE: 'portal:current-employee',
  CURRENT_CUSTOMER: 'customer:current',
  NOTIFICATIONS: 'portal:notifications',
  AUTH_USER: 'auth:user',
  MY_NOTIFICATIONS: 'portal:my-notifications',
  EMPLOYEE_BY_AUTH: (authId: string) => `portal:employee:${authId}`,
  CUSTOMER_BY_AUTH: (authId: string) => `customer:${authId}`,
} as const;
