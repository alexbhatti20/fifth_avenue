import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';

const REVIEWS_CACHE_KEY = 'cache:public_reviews';

// DELETE - Delete customer's own review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const supabase = createClient();

    // Get customer session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get customer ID
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 403 }
      );
    }

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
