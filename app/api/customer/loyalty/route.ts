import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { verifyToken } from '@/lib/jwt';
import { unstable_cache } from 'next/cache';

const REDIS_TTL = 120; // 2 minutes cache

// GET /api/customer/loyalty - Get loyalty points info
export async function GET(request: NextRequest) {
  try {
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const noCache = searchParams.get('no_cache') === 'true';

    const cacheKey = `customer:${decoded.userId}:loyalty:${page}:${limit}`;

    // Try Redis cache first
    if (!noCache) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return NextResponse.json({ ...data, source: 'cache' });
      }
    }

    // Get current balance using RPC
    const { data: balance } = await supabase.rpc('get_loyalty_balance', {
      p_customer_id: decoded.userId
    });

    // Get points history
    const offset = (page - 1) * limit;
    const { data: history, error, count } = await supabase
      .from('loyalty_points')
      .select(`
        id,
        points,
        type,
        description,
        created_at,
        order:orders(order_number)
      `, { count: 'exact' })
      .eq('customer_id', decoded.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Loyalty fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch loyalty data' }, { status: 500 });
    }

    // Calculate stats
    const { data: statsData } = await supabase
      .from('loyalty_points')
      .select('points, type')
      .eq('customer_id', decoded.userId);

    const stats = {
      totalEarned: statsData?.filter(p => p.points > 0).reduce((sum, p) => sum + p.points, 0) || 0,
      totalRedeemed: Math.abs(statsData?.filter(p => p.points < 0).reduce((sum, p) => sum + p.points, 0) || 0),
      currentBalance: balance || 0
    };

    // Points value info
    const pointsInfo = {
      valuePerPoint: 0.10, // Rs. 0.10 per point
      minimumRedemption: 100, // Minimum 100 points to redeem
      earnRate: '1 point per Rs. 100 spent'
    };

    const response = {
      success: true,
      loyalty: {
        balance: balance || 0,
        stats,
        info: pointsInfo,
        history: history?.map(h => {
          const orderData = Array.isArray(h.order) ? h.order[0] : h.order;
          return {
            id: h.id,
            points: h.points,
            type: h.type,
            description: h.description,
            orderNumber: orderData?.order_number || null,
            date: h.created_at
          };
        }) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    };

    // Cache response in Redis
    await redis.setex(cacheKey, REDIS_TTL, JSON.stringify(response));

    return NextResponse.json({ ...response, source: 'database' });

  } catch (error) {
    console.error('Loyalty fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
