import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis } from '@/lib/redis';

const CACHE_TTL = 60; // 1 minute for history

// GET /api/orders/history - Get customer's order history
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Customer access only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status'); // Filter by status
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate pagination
    const validPage = Math.max(1, page);
    const validLimit = Math.min(50, Math.max(1, limit));
    const offset = (validPage - 1) * validLimit;

    // Try cache first
    const cacheKey = `customer:${decoded.userId}:orders-history:${validPage}:${validLimit}:${status || 'all'}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return NextResponse.json({ ...data, source: 'cache' });
    }

    // Use RPC for paginated orders
    const { data: orders, error } = await supabase.rpc('get_customer_orders_paginated', {
      p_customer_id: decoded.userId,
      p_limit: validLimit,
      p_offset: offset,
      p_status: status && status !== 'all' ? status : null
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', decoded.userId);

    // Calculate totals for summary using aggregation
    const { data: summary } = await supabase
      .from('orders')
      .select('total, status')
      .eq('customer_id', decoded.userId);

    const orderSummary = {
      totalOrders: count || 0,
      totalSpent: summary?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      completedOrders: summary?.filter(o => o.status === 'delivered').length || 0,
      pendingOrders: summary?.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'delivering'].includes(o.status)).length || 0
    };

    const response = {
      success: true,
      orders: orders || [],
      pagination: {
        page: validPage,
        limit: validLimit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / validLimit),
        hasMore: (offset + validLimit) < (count || 0)
      },
      summary: orderSummary
    };

    // Cache for 1 minute
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

    return NextResponse.json({ ...response, source: 'database' });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

