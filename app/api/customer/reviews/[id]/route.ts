import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

const REVIEWS_CACHE_KEY = 'cache:public_reviews';

// Helper to get authenticated customer from JWT
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return { customer: null, token: null };

  const decoded = await verifyToken(token);
  if (!decoded || !decoded.userId || decoded.userType !== 'customer') {
    return { customer: null, token: null };
  }
  
  // Create authenticated client
  const supabase = createAuthenticatedClient(token);
  
  // Verify the customer exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', decoded.userId)
    .single();

  return { customer, token };
}

// DELETE - Delete customer's own review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    
    const { customer, token } = await getAuthenticatedCustomer();
    
    if (!customer || !token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create authenticated client for RPC call
    const supabase = createAuthenticatedClient(token);

    // Delete review via RPC
    const { data, error } = await supabase.rpc('delete_customer_review', {
      p_customer_id: customer.id,
      p_review_id: reviewId,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete review' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || 'Review not found or unauthorized' },
        { status: 404 }
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
      message: 'Review deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
