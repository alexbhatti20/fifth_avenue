import { Redis } from '@upstash/redis';

// Create Redis client only if credentials are available
let redis: Redis | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (error) {
    console.warn('Failed to initialize Redis client:', error);
  }
} else {
  console.warn('Redis credentials not configured - caching disabled');
}

// Cache durations in seconds
export const CACHE_DURATIONS = {
  MENU_ITEMS: 3600, // 1 hour
  MENU_CATEGORIES: 7200, // 2 hours
  DEALS: 1800, // 30 minutes
  SITE_CONTENT: 3600, // 1 hour
  USER_SESSION: 86400, // 24 hours
  ORDER_DETAILS: 300, // 5 minutes
  PAYMENT_METHODS: 3600, // 1 hour
} as const;

// Cache keys
export const CACHE_KEYS = {
  menuItems: (categoryId?: string) => 
    categoryId ? `menu:items:${categoryId}` : 'menu:items:all',
  menuCategories: () => 'menu:categories:all',
  activeDeals: () => 'deals:active',
  siteContent: (section: string) => `site:content:${section}`,
  customerOrders: (customerId: string) => `customer:orders:${customerId}`,
  orderDetails: (orderId: string) => `order:${orderId}`,
  paymentMethods: () => 'payment:methods:active',
} as const;

// Get cached data with automatic JSON parsing
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data as T | null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

// Set cache with automatic JSON stringification and TTL
export async function setCache<T>(
  key: string,
  value: T,
  expirationSeconds?: number
): Promise<boolean> {
  if (!redis) return false;
  try {
    // Value is already serialized when using redis client, no need to double-stringify
    if (expirationSeconds) {
      await redis.setex(key, expirationSeconds, value);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

// Delete cache key
export async function deleteCache(key: string): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

// Delete multiple cache keys by pattern
export async function deleteCachePattern(pattern: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return false;
  }
}

// Invalidate menu cache (when menu items updated)
export async function invalidateMenuCache(categoryId?: string) {
  if (categoryId) {
    await deleteCache(CACHE_KEYS.menuItems(categoryId));
  } else {
    await deleteCachePattern('menu:items:*');
  }
  await deleteCache(CACHE_KEYS.menuCategories());
  // Also invalidate customer-facing menu cache
  await deleteCache('customer:menu:all');
}

// Invalidate deals cache
export async function invalidateDealsCache() {
  await deleteCache(CACHE_KEYS.activeDeals());
  // Also invalidate customer-facing menu cache (includes deals)
  await deleteCache('customer:menu:all');
}

// Invalidate site content cache
export async function invalidateSiteContentCache(section?: string) {
  if (section) {
    await deleteCache(CACHE_KEYS.siteContent(section));
  } else {
    await deleteCachePattern('site:content:*');
  }
}

// Invalidate payment methods cache
export async function invalidatePaymentMethodsCache() {
  await deleteCache(CACHE_KEYS.paymentMethods());
}

// Invalidate customer orders cache
export async function invalidateCustomerOrdersCache(customerId: string) {
  await deleteCache(CACHE_KEYS.customerOrders(customerId));
}

// Cache wrapper with automatic fallback
export async function cacheWrapper<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  await setCache(key, data, ttl);
  
  return data;
}

export default redis;
