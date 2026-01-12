import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";
import { unstable_cache } from "next/cache";

const CACHE_TTL = 60; // 1 minute for orders (short because they change)
const REDIS_TTL = 30; // 30 seconds in Redis

// Get cached orders using RPC
async function getOrdersFromDB(customerId: string, status?: string) {
  const { data, error } = await supabase.rpc("get_customer_orders_paginated", {
    p_customer_id: customerId,
    p_limit: 50,
    p_offset: 0,
    p_status: status || null,
  });

  if (error) {
    console.error("RPC Error:", error);
    throw error;
  }

  return data;
}

// Multi-layer cached function
const getCachedOrders = unstable_cache(
  async (customerId: string, status?: string) => {
    return getOrdersFromDB(customerId, status);
  },
  ["customer-orders"],
  { revalidate: CACHE_TTL, tags: ["customer-orders"] }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");
    const status = searchParams.get("status");
    const noCache = searchParams.get("no_cache") === "true";

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    // Cache key
    const cacheKey = `customer:${customerId}:orders:${status || "all"}`;

    // Try Redis cache first (unless no_cache is set)
    if (!noCache) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          orders: typeof cached === "string" ? JSON.parse(cached) : cached,
          source: "redis-cache",
        });
      }
    }

    // Use RPC function with Next.js cache
    const orders = noCache
      ? await getOrdersFromDB(customerId, status || undefined)
      : await getCachedOrders(customerId, status || undefined);

    // Store in Redis for faster subsequent requests
    if (orders && orders.length > 0) {
      await redis.setex(cacheKey, REDIS_TTL, JSON.stringify(orders));
    }

    return NextResponse.json({
      orders: orders || [],
      source: noCache ? "database" : "next-cache",
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// Invalidate cache when order is created/updated
export async function POST(request: NextRequest) {
  try {
    const { customerId, action } = await request.json();

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    // Invalidate all order caches for this customer
    const cacheKeys = [
      `customer:${customerId}:orders:all`,
      `customer:${customerId}:orders:pending`,
      `customer:${customerId}:orders:confirmed`,
      `customer:${customerId}:orders:preparing`,
      `customer:${customerId}:orders:ready`,
      `customer:${customerId}:orders:delivering`,
      `customer:${customerId}:orders:delivered`,
      `customer:${customerId}:orders:cancelled`,
    ];

    await Promise.all(cacheKeys.map((key) => redis.del(key)));

    return NextResponse.json({ success: true, message: "Cache invalidated" });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
