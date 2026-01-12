import { supabase } from './supabase';
import { redis } from './redis';
import { unstable_cache } from 'next/cache';

// Cache TTL configurations
const CACHE_TTL = {
  ORDERS: 60, // 1 minute - orders change frequently
  LOYALTY: 300, // 5 minutes - loyalty changes less
  PROFILE: 600, // 10 minutes - profile rarely changes
  FAVORITES: 300, // 5 minutes
  NOTIFICATIONS: 30, // 30 seconds - notifications are time-sensitive
};

// Customer Orders with RPC
export async function getCustomerOrders(
  customerId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: string | null;
  } = {}
) {
  const { limit = 50, offset = 0, status = null } = options;
  const cacheKey = `customer:${customerId}:orders:${status || 'all'}:${offset}:${limit}`;

  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return {
      data: typeof cached === 'string' ? JSON.parse(cached) : cached,
      source: 'cache',
    };
  }

  // Use RPC for optimized query
  const { data, error } = await supabase.rpc('get_customer_orders_paginated', {
    p_customer_id: customerId,
    p_limit: limit,
    p_offset: offset,
    p_status: status,
  });

  if (error) throw error;

  // Cache result
  if (data) {
    await redis.setex(cacheKey, CACHE_TTL.ORDERS, JSON.stringify(data));
  }

  return { data, source: 'database' };
}

// Customer Order Details with RPC
export async function getOrderDetails(orderId: string, customerId?: string) {
  const cacheKey = `order:${orderId}:details`;

  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return {
      data: typeof cached === 'string' ? JSON.parse(cached) : cached,
      source: 'cache',
    };
  }

  // Use RPC for order details with status history
  const { data, error } = await supabase.rpc('get_order_details', {
    p_order_id: orderId,
    p_customer_id: customerId || null,
  });

  if (error) throw error;

  const orderData = data?.[0] || null;

  // Cache result (shorter TTL for active orders)
  if (orderData) {
    const ttl = ['delivered', 'cancelled'].includes(orderData.status)
      ? CACHE_TTL.ORDERS * 5 // 5 minutes for completed orders
      : CACHE_TTL.ORDERS; // 1 minute for active orders
    await redis.setex(cacheKey, ttl, JSON.stringify(orderData));
  }

  return { data: orderData, source: 'database' };
}

// Customer Loyalty Balance with RPC
export async function getLoyaltyBalance(customerId: string) {
  const cacheKey = `customer:${customerId}:loyalty`;

  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return {
      data: typeof cached === 'string' ? JSON.parse(cached) : cached,
      source: 'cache',
    };
  }

  // Use RPC for loyalty balance
  const { data, error } = await supabase.rpc('get_loyalty_balance', {
    p_customer_id: customerId,
  });

  if (error) throw error;

  const balance = data?.[0] || {
    total_points: 0,
    redeemable_points: 0,
    pending_points: 0,
  };

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL.LOYALTY, JSON.stringify(balance));

  return { data: balance, source: 'database' };
}

// Validate Promo Code with RPC
export async function validatePromoCode(
  code: string,
  customerId: string,
  orderSubtotal: number
) {
  // No caching for promo validation - always fresh
  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: code,
    p_customer_id: customerId,
    p_order_subtotal: orderSubtotal,
  });

  if (error) throw error;

  return data?.[0] || { valid: false, error_message: 'Invalid promo code' };
}

// Update Customer Profile with RPC
export async function updateCustomerProfile(
  customerId: string,
  updates: {
    name?: string;
    phone?: string;
    address?: string;
  }
) {
  const { data, error } = await supabase.rpc('update_customer_profile', {
    p_customer_id: customerId,
    p_name: updates.name || null,
    p_phone: updates.phone || null,
    p_address: updates.address || null,
  });

  if (error) throw error;

  const result = data?.[0];

  // Invalidate profile cache on success
  if (result?.success) {
    await redis.del(`customer:${customerId}:profile`);
  }

  return result;
}

// Toggle 2FA with RPC
export async function toggle2FA(
  customerId: string,
  enable: boolean,
  secret?: string
) {
  const { data, error } = await supabase.rpc('toggle_2fa', {
    p_customer_id: customerId,
    p_enable: enable,
    p_secret: secret || null,
  });

  if (error) throw error;

  const result = data?.[0];

  // Invalidate profile cache on success
  if (result?.success) {
    await redis.del(`customer:${customerId}:profile`);
  }

  return result;
}

// Cache Invalidation Helpers
export async function invalidateOrderCache(customerId: string) {
  const keys = [
    `customer:${customerId}:orders:all:*`,
    `customer:${customerId}:orders-history:*`,
  ];
  // Simple delete - for production use scan with pattern
  await redis.del(`customer:${customerId}:orders:all:0:50`);
  await redis.del(`customer:${customerId}:orders-history:1:10:all`);
}

export async function invalidateOrderDetailsCache(orderId: string) {
  await redis.del(`order:${orderId}:details`);
}

export async function invalidateLoyaltyCache(customerId: string) {
  await redis.del(`customer:${customerId}:loyalty`);
}

// Next.js cached query helpers (for server components)
export const getCachedOrders = unstable_cache(
  async (customerId: string, status?: string) => {
    const result = await getCustomerOrders(customerId, { status });
    return result.data;
  },
  ['customer-orders'],
  { revalidate: CACHE_TTL.ORDERS, tags: ['customer-orders'] }
);

export const getCachedLoyalty = unstable_cache(
  async (customerId: string) => {
    const result = await getLoyaltyBalance(customerId);
    return result.data;
  },
  ['customer-loyalty'],
  { revalidate: CACHE_TTL.LOYALTY, tags: ['customer-loyalty'] }
);
