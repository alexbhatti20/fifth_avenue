import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// Helper: build an authenticated Supabase client from cookies
// ─────────────────────────────────────────────────────────────
async function getAuthClient(request: NextRequest) {
  // 1. Try cookies (SSR context)
  const cookieStore = await cookies();
  let token =
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('auth_token')?.value;

  // 2. Fallback to Authorization header (client fetch)
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  // Validate token is not expired
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload.exp * 1000 < Date.now()) return null;
    }
  } catch {
    // proceed with potentially expired token; RPC will reject it
  }

  return createAuthenticatedClient(token);
}

// ─────────────────────────────────────────────────────────────
// GET /api/portal/delivery
// Returns all online orders with status 'ready' or 'delivering'
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const client = await getAuthClient(request);
  if (!client) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await client.rpc('get_delivery_orders');

  if (error) {
    console.error('[/api/portal/delivery GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // data is the JSON returned by the RPC: { success, data: [...] }
  return NextResponse.json(data ?? { success: true, data: [] });
}

// ─────────────────────────────────────────────────────────────
// POST /api/portal/delivery
// Body: { action, ...params }
//
// Actions:
//   accept   → accept_delivery_order(p_order_id, p_rider_id)
//   complete → complete_delivery_order(p_order_id, p_notes, p_rider_id)
//   cancel   → cancel_delivery_order(p_order_id, p_reason, p_rider_id)
//   history  → get_rider_delivery_history(p_rider_id, p_status, p_limit, p_offset)
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
    // ── Accept / start delivery ──────────────────────────────
    case 'accept': {
      const { data, error } = await client.rpc('accept_delivery_order', {
        p_order_id: params.orderId as string,
        p_rider_id: (params.riderId as string) ?? null,
      });
      if (error) {
        console.error('[delivery/accept]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(data ?? { success: false, error: 'No response' });
    }

    // ── Complete delivery ────────────────────────────────────
    case 'complete': {
      const { data, error } = await client.rpc('complete_delivery_order', {
        p_order_id: params.orderId as string,
        p_notes: (params.notes as string) ?? null,
        p_rider_id: (params.riderId as string) ?? null,
      });
      if (error) {
        console.error('[delivery/complete]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(data ?? { success: false, error: 'No response' });
    }

    // ── Cancel delivery ──────────────────────────────────────
    case 'cancel': {
      const { data, error } = await client.rpc('cancel_delivery_order', {
        p_order_id: params.orderId as string,
        p_reason: (params.reason as string) ?? null,
        p_rider_id: (params.riderId as string) ?? null,
      });
      if (error) {
        console.error('[delivery/cancel]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(data ?? { success: false, error: 'No response' });
    }

    // ── Rider delivery history ───────────────────────────────
    case 'history': {
      const { data, error } = await client.rpc('get_rider_delivery_history', {
        p_rider_id: (params.riderId as string) ?? null,
        p_status: (params.status as string) ?? null,
        p_limit: (params.limit as number) ?? 20,
        p_offset: (params.offset as number) ?? 0,
      });
      if (error) {
        console.error('[delivery/history]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(data ?? { success: false, error: 'No response' });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}
