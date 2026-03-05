import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

// Helper to get authenticated customer from JWT
async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get('auth_token')?.value;
  
  if (!rawToken) return { customer: null, token: null };

  // Verify our custom JWT token
  let decoded = await verifyToken(rawToken);
  let activeToken = rawToken;

  // If the access token is expired, try to refresh it
  if (!decoded) {
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;
    if (refreshToken) {
      try {
        const { createClient } = await import('@/lib/supabase');
        const anonClient = createClient();
        const { data: refreshData } = await anonClient.auth.setSession({
          access_token: rawToken,
          refresh_token: refreshToken,
        });
        if (refreshData?.session?.access_token) {
          activeToken = refreshData.session.access_token;
          decoded = await verifyToken(activeToken);
        }
      } catch {
        // Refresh failed
      }
    }
  }

  if (!decoded || !decoded.userId) return { customer: null, token: null };
  
  // Create authenticated client
  const supabase = createAuthenticatedClient(activeToken);
  
  // For customers, userId is the customer.id from the customers table
  // Verify the customer exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', decoded.userId)
    .single();

  return { customer, token: activeToken };
}

// GET /api/customer/orders - Get customer orders (paginated)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const originalToken = cookieStore.get('auth_token')?.value;
    const { customer, token } = await getAuthenticatedCustomer();
    if (!customer || !token) {
      return NextResponse.json({ data: [], error: null });
    }
    
    // Create authenticated client to run as 'authenticated' role
    const supabase = createAuthenticatedClient(token);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || null;

    const { data, error } = await supabase.rpc('get_customer_orders_paginated', {
      p_customer_id: customer.id,
      p_limit: limit,
      p_offset: offset,
      p_status: status,
    });

    if (error) {
      return NextResponse.json({ data: [], error: error.message });
    }

    const response = NextResponse.json({ data: data || [], error: null });

    // If the token was refreshed, update the httpOnly cookie with the new token
    if (token !== originalToken) {
      const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch orders" });
  }
}
