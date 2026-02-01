import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';

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

// GET - Get customer's own reviews
export async function GET(request: NextRequest) {
  try {
    const { customer, token } = await getAuthenticatedCustomer();
    
    if (!customer || !token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create authenticated client for RPC call
    const supabase = createAuthenticatedClient(token);

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
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

