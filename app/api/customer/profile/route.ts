import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis, redisKeys, CACHE_TTL, getCache, setCache, deleteCache } from '@/lib/redis';

// GET /api/customer/profile - Get customer profile
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

    // Try cache first
    const cacheKey = redisKeys.customerProfile(decoded.userId);
    const cached = await getCache<string>(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        profile: JSON.parse(cached),
        cached: true
      });
    }

    // Fetch from database
    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        id,
        full_name,
        email,
        phone,
        address,
        avatar_url,
        email_notifications,
        sms_notifications,
        two_factor_enabled,
        created_at,
        updated_at
      `)
      .eq('id', decoded.userId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get loyalty points
    const { data: loyaltyData } = await supabase.rpc('get_loyalty_balance', {
      p_customer_id: decoded.userId
    });

    // Get order stats
    const { data: orderStats } = await supabase
      .from('orders')
      .select('total_amount, status')
      .eq('customer_id', decoded.userId);

    const stats = {
      totalOrders: orderStats?.length || 0,
      totalSpent: orderStats?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      completedOrders: orderStats?.filter(o => o.status === 'delivered').length || 0,
      loyaltyPoints: loyaltyData || 0
    };

    const profile = {
      ...customer,
      stats
    };

    // Cache for 5 minutes
    await setCache(cacheKey, JSON.stringify(profile), CACHE_TTL.MEDIUM);

    return NextResponse.json({
      success: true,
      profile,
      cached: false
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/customer/profile - Update customer profile
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    
    // Allowed update fields
    const allowedFields = [
      'full_name',
      'phone',
      'address',
      'avatar_url',
      'email_notifications',
      'sms_notifications'
    ];

    // Filter to only allowed fields
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate phone if updating
    if (updates.phone) {
      const phoneRegex = /^(\+92|0)?3[0-9]{9}$/;
      if (!phoneRegex.test(updates.phone.replace(/[\s-]/g, ''))) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Use Pakistani format.' },
          { status: 400 }
        );
      }
    }

    // Validate full_name
    if (updates.full_name && updates.full_name.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Update database
    const { data: customer, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', decoded.userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Invalidate cache
    await deleteCache(redisKeys.customerProfile(decoded.userId));

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: customer
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

