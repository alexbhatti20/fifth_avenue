import { redis } from './redis';

// Rate limit configuration types
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

// Rate limit configurations
export const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes
  },
  registration: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
  },
  otp: {
    maxAttempts: 5,
    windowMs: 2 * 60 * 1000, // 2 minutes
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },
  passwordChange: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
  },
  globalFailure: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // Global cooldown 1 hour
  },
};

// Rate limit keys
const KEYS = {
  loginAttempts: (ip: string) => `ratelimit:login:attempts:${ip}`,
  loginBlocked: (ip: string) => `ratelimit:login:blocked:${ip}`,
  registerAttempts: (ip: string) => `ratelimit:register:attempts:${ip}`,
  registerBlocked: (ip: string) => `ratelimit:register:blocked:${ip}`,
  otpAttempts: (email: string) => `ratelimit:otp:attempts:${email}`,
  otpBlocked: (email: string) => `ratelimit:otp:blocked:${email}`,
  globalFailures: () => `ratelimit:global:failures`,
  globalCooldown: () => `ratelimit:global:cooldown`,
  passwordChangeAttempts: (userId: string) => `ratelimit:password:attempts:${userId}`,
  passwordChangeBlocked: (userId: string) => `ratelimit:password:blocked:${userId}`,
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number | null;
  blockedUntil: number | null;
}

function allowWithoutRedis(config: RateLimitConfig): RateLimitResult {
  return {
    allowed: true,
    remaining: config.maxAttempts,
    resetAt: Date.now() + config.windowMs,
    blockedUntil: null,
  };
}

/**
 * Check and update login rate limit
 */
export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.login;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.loginBlocked(ip);
  const attemptsKey = KEYS.loginAttempts(ip);

  try {
    // Check if blocked
    const blockedUntil = await redis.get<number>(blockedKey);
    if (blockedUntil && Date.now() < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    // Get current attempts
    const attempts = await redis.get<number>(attemptsKey) || 0;
    const remaining = Math.max(0, config.maxAttempts - attempts);

    return {
      allowed: attempts < config.maxAttempts,
      remaining,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Record failed login attempt
 */
export async function recordLoginFailure(ip: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.login;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.loginBlocked(ip);
  const attemptsKey = KEYS.loginAttempts(ip);

  try {
    // Increment attempts
    const attempts = await redis.incr(attemptsKey);
    
    // Set expiry on first attempt
    if (attempts === 1) {
      await redis.expire(attemptsKey, Math.floor(config.windowMs / 1000));
    }

    // Block if exceeded
    if (attempts >= config.maxAttempts) {
      const blockedUntil = Date.now() + config.blockDurationMs;
      await redis.set(blockedKey, blockedUntil, {
        ex: Math.floor(config.blockDurationMs / 1000),
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - attempts,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Clear login rate limit on successful login
 */
export async function clearLoginRateLimit(ip: string): Promise<void> {
  if (!redis) return;
  const attemptsKey = KEYS.loginAttempts(ip);
  const blockedKey = KEYS.loginBlocked(ip);
  try {
    await redis.del(attemptsKey);
    await redis.del(blockedKey);
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Check registration rate limit
 */
export async function checkRegistrationRateLimit(ip: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.registration;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.registerBlocked(ip);
  const attemptsKey = KEYS.registerAttempts(ip);

  try {
    // Check global cooldown first
    const globalCooldown = await redis.get<number>(KEYS.globalCooldown());
    if (globalCooldown && Date.now() < globalCooldown) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil: globalCooldown,
      };
    }

    // Check if IP is blocked
    const blockedUntil = await redis.get<number>(blockedKey);
    if (blockedUntil && Date.now() < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    const attempts = await redis.get<number>(attemptsKey) || 0;
    const remaining = Math.max(0, config.maxAttempts - attempts);

    return {
      allowed: attempts < config.maxAttempts,
      remaining,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Record failed registration attempt
 */
export async function recordRegistrationFailure(ip: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.registration;
  const globalConfig = RATE_LIMITS.globalFailure;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.registerBlocked(ip);
  const attemptsKey = KEYS.registerAttempts(ip);
  const globalFailuresKey = KEYS.globalFailures();
  const globalCooldownKey = KEYS.globalCooldown();

  try {
    // Increment IP attempts
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, Math.floor(config.windowMs / 1000));
    }

    // Increment global failures
    const globalFailures = await redis.incr(globalFailuresKey);
    if (globalFailures === 1) {
      await redis.expire(globalFailuresKey, Math.floor(globalConfig.windowMs / 1000));
    }

    // Check for global cooldown
    if (globalFailures >= globalConfig.maxAttempts) {
      const cooldownUntil = Date.now() + globalConfig.blockDurationMs;
      await redis.set(globalCooldownKey, cooldownUntil, {
        ex: Math.floor(globalConfig.blockDurationMs / 1000),
      });
    }

    // Block IP if exceeded
    if (attempts >= config.maxAttempts) {
      const blockedUntil = Date.now() + config.blockDurationMs;
      await redis.set(blockedKey, blockedUntil, {
        ex: Math.floor(config.blockDurationMs / 1000),
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - attempts,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Clear registration rate limit on success
 */
export async function clearRegistrationRateLimit(ip: string): Promise<void> {
  if (!redis) return;
  const attemptsKey = KEYS.registerAttempts(ip);
  const blockedKey = KEYS.registerBlocked(ip);
  try {
    await redis.del(attemptsKey);
    await redis.del(blockedKey);
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Check OTP verification rate limit
 */
export async function checkOTPRateLimit(email: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.otp;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.otpBlocked(email);
  const attemptsKey = KEYS.otpAttempts(email);

  try {
    const blockedUntil = await redis.get<number>(blockedKey);
    if (blockedUntil && Date.now() < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    const attempts = await redis.get<number>(attemptsKey) || 0;
    const remaining = Math.max(0, config.maxAttempts - attempts);

    return {
      allowed: attempts < config.maxAttempts,
      remaining,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Record failed OTP attempt
 */
export async function recordOTPFailure(email: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.otp;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.otpBlocked(email);
  const attemptsKey = KEYS.otpAttempts(email);

  try {
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, Math.floor(config.windowMs / 1000));
    }

    if (attempts >= config.maxAttempts) {
      const blockedUntil = Date.now() + config.blockDurationMs;
      await redis.set(blockedKey, blockedUntil, {
        ex: Math.floor(config.blockDurationMs / 1000),
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - attempts,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Clear OTP rate limit on success
 */
export async function clearOTPRateLimit(email: string): Promise<void> {
  if (!redis) return;
  const attemptsKey = KEYS.otpAttempts(email);
  const blockedKey = KEYS.otpBlocked(email);
  try {
    await redis.del(attemptsKey);
    await redis.del(blockedKey);
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Check password change rate limit
 */
export async function checkPasswordChangeRateLimit(userId: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.passwordChange;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.passwordChangeBlocked(userId);
  const attemptsKey = KEYS.passwordChangeAttempts(userId);

  try {
    const blockedUntil = await redis.get<number>(blockedKey);
    if (blockedUntil && Date.now() < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    const attempts = await redis.get<number>(attemptsKey) || 0;
    const remaining = Math.max(0, config.maxAttempts - attempts);

    return {
      allowed: attempts < config.maxAttempts,
      remaining,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Record failed password change attempt
 */
export async function recordPasswordChangeFailure(userId: string): Promise<RateLimitResult> {
  const config = RATE_LIMITS.passwordChange;
  if (!redis) return allowWithoutRedis(config);

  const blockedKey = KEYS.passwordChangeBlocked(userId);
  const attemptsKey = KEYS.passwordChangeAttempts(userId);

  try {
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, Math.floor(config.windowMs / 1000));
    }

    if (attempts >= config.maxAttempts) {
      const blockedUntil = Date.now() + config.blockDurationMs;
      await redis.set(blockedKey, blockedUntil, {
        ex: Math.floor(config.blockDurationMs / 1000),
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        blockedUntil,
      };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - attempts,
      resetAt: Date.now() + config.windowMs,
      blockedUntil: null,
    };
  } catch {
    return allowWithoutRedis(config);
  }
}

/**
 * Clear password change rate limit on success
 */
export async function clearPasswordChangeRateLimit(userId: string): Promise<void> {
  if (!redis) return;
  const attemptsKey = KEYS.passwordChangeAttempts(userId);
  const blockedKey = KEYS.passwordChangeBlocked(userId);
  try {
    await redis.del(attemptsKey);
    await redis.del(blockedKey);
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Record password change attempt (success or failure)
 */
export async function recordPasswordChangeAttempt(
  userId: string, 
  ip: string, 
  success: boolean
): Promise<void> {
  if (success) {
    await clearPasswordChangeRateLimit(userId);
  } else {
    await recordPasswordChangeFailure(userId);
  }
}

/**
 * Get IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  
  return 'unknown';
}
