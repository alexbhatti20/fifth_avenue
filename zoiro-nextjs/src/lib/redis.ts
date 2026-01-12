import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Initialize Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiter configurations
export const rateLimiters = {
  // Auth rate limiter - 5 requests per 60 seconds
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),
  
  // Order creation rate limiter - 5 requests per 60 seconds
  order: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "ratelimit:order",
  }),
  
  // General API rate limiter - 30 requests per 60 seconds
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    analytics: true,
    prefix: "ratelimit:api",
  }),
  
  // OTP rate limiter - 3 requests per 60 seconds
  otp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "60 s"),
    analytics: true,
    prefix: "ratelimit:otp",
  }),
};

// Cache keys
export const CACHE_KEYS = {
  SITE_CONTENT: (key: string) => `cache:site_content:${key}`,
  MENU_ITEMS: "cache:menu_items",
  CATEGORIES: "cache:categories",
  DEALS: "cache:deals",
  MEALS: "cache:meals",
  SETTINGS: "cache:settings",
} as const;

// Cache durations (in seconds)
export const CACHE_DURATION = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// Cache helper functions
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get<T>(key);
    return cached;
  } catch (error) {
    console.error("Redis GET error:", error);
    return null;
  }
}

export async function setInCache<T>(
  key: string,
  value: T,
  expirationSeconds: number = CACHE_DURATION.MEDIUM
): Promise<void> {
  try {
    await redis.set(key, value, { ex: expirationSeconds });
  } catch (error) {
    console.error("Redis SET error:", error);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis DEL error:", error);
  }
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Redis pattern DEL error:", error);
  }
}

// Rate limit check helper
export async function checkRateLimit(
  limiter: keyof typeof rateLimiters,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await rateLimiters[limiter].limit(identifier);
  return { success, remaining, reset };
}
