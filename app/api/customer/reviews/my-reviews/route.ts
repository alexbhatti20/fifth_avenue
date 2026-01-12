import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET - Get customer's own reviews
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get customer reviews via RPC
    const { data, error } = await supabase.rpc('get_customer_reviews', {
      p_customer_id: customer.id,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Error fetching customer reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('My reviews GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
