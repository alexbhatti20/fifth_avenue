import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// Helper: build an authenticated Supabase client from cookies
// (same pattern as /api/portal/delivery)
// ─────────────────────────────────────────────────────────────
async function getAuthClient(request: NextRequest) {
  // 1. Try cookies (SSR / same-origin fetch)
  const cookieStore = await cookies();
  let token =
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('auth_token')?.value;

  // 2. Fallback to Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  // Validate token not expired
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload.exp * 1000 < Date.now()) return null;
    }
  } catch {
    // proceed — RPC will reject an expired token itself
  }

  return createAuthenticatedClient(token);
}

// ─────────────────────────────────────────────────────────────
// GET /api/portal/kitchen
// Returns kitchen orders + stats for the authenticated user
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const client = await getAuthClient(request);
  if (!client) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Try v2 RPC first
  const { data: rpcData, error: rpcError } = await client.rpc('get_kitchen_orders_v2');

  let orders = rpcData;
  if (rpcError || !rpcData) {
    // Fallback: direct table query (no RPC needed)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: fallback, error: fbError } = await client
      .from('orders')
      .select('*')
      .in('status', ['confirmed', 'preparing', 'ready'])
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: true });

    if (fbError) {
      console.error('[/api/portal/kitchen GET fallback]', fbError);
      return NextResponse.json({ success: false, error: fbError.message }, { status: 500 });
    }

    orders = (fallback || []).map((o: any) => ({
      ...o,
      elapsed_seconds: Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000),
      total_items: o.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0,
    }));
  }

  // Fetch stats — fail-soft (stats are non-critical)
  const { data: statsData } = await client.rpc('get_kitchen_stats');

  return NextResponse.json({ success: true, orders: orders || [], stats: statsData || null });
}

// ─────────────────────────────────────────────────────────────
// POST /api/portal/kitchen
// Body: { action, ...params }
//
// Actions:
//   update_status      → update_kitchen_order_status(p_order_id, p_status)
//   completed_orders   → get_kitchen_completed_orders(...)
//   completed_stats    → get_kitchen_completed_stats(...)
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const client = await getAuthClient(request);
  if (!client) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, ...params } = body;

  switch (action) {
    // ── Update kitchen order status ───────────────────────────
    case 'update_status': {
      const { data, error } = await client.rpc('update_kitchen_order_status', {
        p_order_id: params.orderId as string,
        p_status: params.status as string,
      });
      if (error) {
        console.error('[kitchen/update_status]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    // ── Get completed orders ──────────────────────────────────
    case 'completed_orders': {
      const { data, error } = await client.rpc('get_kitchen_completed_orders', {
        p_employee_id: null,
        p_filter_type: params.filterType as string,
        p_start_date: (params.startDate as string) || null,
        p_end_date: (params.endDate as string) || null,
        p_limit: (params.limit as number) || 50,
        p_offset: (params.offset as number) || 0,
      });
      if (error) {
        console.error('[kitchen/completed_orders]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data || [] });
    }

    // ── Get completed stats ───────────────────────────────────
    case 'completed_stats': {
      const { data, error } = await client.rpc('get_kitchen_completed_stats', {
        p_employee_id: null,
        p_filter_type: params.filterType as string,
        p_start_date: (params.startDate as string) || null,
        p_end_date: (params.endDate as string) || null,
      });
      if (error) {
        console.error('[kitchen/completed_stats]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data?.[0] || null });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}
