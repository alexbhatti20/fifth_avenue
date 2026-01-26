import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Check if we're on the server and have Redis credentials
const isServer = typeof window === 'undefined';
const hasRedisConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Initialize Redis client only on server with valid config
export const redis = isServer && hasRedisConfig 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiter configurations (only on server with valid redis)
export const rateLimiters = redis ? {
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

  // Review rate limiter - 3 reviews per day (86400 seconds)
  review: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "86400 s"),
    analytics: true,
    prefix: "ratelimit:review",
  }),

  // Helpful vote rate limiter - 10 votes per hour
  helpful: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "3600 s"),
    analytics: true,
    prefix: "ratelimit:helpful",
  }),
} : null;

// Cache keys
export const CACHE_KEYS = {
  SITE_CONTENT: (key: string) => `cache:site_content:${key}`,
  MENU_ITEMS: "cache:menu_items",
  CATEGORIES: "cache:categories",
  DEALS: "cache:deals",
  MEALS: "cache:meals",
  SETTINGS: "cache:settings",
  REVIEWS: "cache:public_reviews",
  REVIEW_STATS: "cache:review_stats",
} as const;

// Extended redis keys for auth and customer features
export const redisKeys = {
  // Auth
  loginAttempts: (identifier: string) => `login_attempts:${identifier}`,
  loginBlock: (identifier: string) => `login_block:${identifier}`,
  registrationAttempts: (identifier: string) => `registration_attempts:${identifier}`,
  registrationGlobal: (ip: string) => `registration_global:${ip}`,
  otpAttempts: (identifier: string) => `otp_attempts:${identifier}`,
  pendingRegistration: (email: string) => `pending_registration:${email}`,
  passwordChangeAttempts: (userId: string) => `password_change:${userId}`,
  
  // Customer
  customerProfile: (customerId: string) => `customer_profile:${customerId}`,
  userProfile: (authUserId: string) => `user_profile:${authUserId}`,
  
  // Settings
  deliveryFee: () => `settings:delivery_fee`,
  
  // Sessions
  userSession: (userId: string) => `session:${userId}`,
};

// Cache durations (in seconds)
export const CACHE_DURATION = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// Alias for consistency
export const CACHE_TTL = CACHE_DURATION;

// Cache helper functions
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!redis) return null; // Skip on client-side or if Redis not configured
  try {
    const cached = await redis.get<T>(key);
    return cached;
  } catch {
    return null;
  }
}

export async function setInCache<T>(
  key: string,
  value: T,
  expirationSeconds: number = CACHE_DURATION.MEDIUM
): Promise<void> {
  if (!redis) return; // Skip on client-side or if Redis not configured
  try {
    await redis.set(key, value, { ex: expirationSeconds });
  } catch {
    // Silently fail - caching is non-critical
  }
}

export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return; // Skip on client-side or if Redis not configured
  try {
    await redis.del(key);
  } catch {
    // Silently fail - cache invalidation is non-critical
  }
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redis) return; // Skip on client-side or if Redis not configured
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silently fail - cache invalidation is non-critical
  }
}

// Rate limit check helper
export async function checkRateLimit(
  limiter: keyof NonNullable<typeof rateLimiters>,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!rateLimiters) {
    // If Redis not configured, allow all requests
    return { success: true, remaining: 999, reset: 0 };
  }
  const { success, remaining, reset } = await rateLimiters[limiter].limit(identifier);
  return { success, remaining, reset };
}

// Alias functions for consistency with other files
export const getCache = getFromCache;
export const setCache = setInCache;
export const deleteCache = invalidateCache;
