import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis, rateLimiters } from '@/lib/redis';

const REVIEWS_CACHE_KEY = 'cache:public_reviews';

// POST - Mark a review as helpful
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const supabase = createClient();

    // Get IP address for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    // Rate limit: max 10 helpful votes per hour per IP
    if (rateLimiters) {
      const identifier = `helpful:${ip}`;
      const { success } = await rateLimiters.api.limit(identifier);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Check if user is logged in (optional) - using JWT token
    let customerId: string | null = null;
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : cookieToken;
    
    if (token) {
      const decoded = verifyToken(token);
      // Allow customers and admins to mark reviews as helpful
      const allowedUserTypes = ['customer', 'admin'];
      const userType = decoded?.userType || decoded?.type;
      if (decoded && allowedUserTypes.includes(userType as string)) {
        customerId = decoded.userId;
      }
    }

    // Mark as helpful via RPC
    const { data, error } = await supabase.rpc('mark_review_helpful', {
      p_review_id: reviewId,
      p_customer_id: customerId,
      p_ip_address: customerId ? null : ip,
    });

    if (error) {
      console.error('Error marking review helpful:', error);
      return NextResponse.json(
        { error: 'Failed to mark review as helpful' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || 'Already marked as helpful' },
        { status: 400 }
      );
    }

    // Invalidate cache
    if (redis) {
      const keys = await redis.keys(`${REVIEWS_CACHE_KEY}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Marked as helpful',
    });
  } catch (error) {
    console.error('Helpful POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
