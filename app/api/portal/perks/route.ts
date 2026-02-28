import { NextRequest, NextResponse } from 'next/server';
import { getSSRCurrentEmployee, getAuthenticatedClient } from '@/lib/server-queries';
import type { Employee } from '@/types/portal';

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Verifies the employee is authenticated and has admin/manager role.
// Uses getSSRCurrentEmployee (decodes JWT + RPC lookup) for accurate role check,
// then returns an authenticated Supabase client for subsequent DB calls.
async function getAuthorizedClient() {
  const employee = (await getSSRCurrentEmployee()) as Employee | null;

  if (!employee) return { client: null, role: null, error: 'Unauthorized', status: 401 };

  const role = employee.role as string;
  if (!['admin', 'manager'].includes(role)) {
    return { client: null, role, error: 'Forbidden', status: 403 };
  }

  const client = await getAuthenticatedClient();
  return { client, role, error: null, status: 200 };
}

// ─── GET /api/portal/perks – fetch fresh data for client-side refresh ──────
export async function GET(request: NextRequest) {
  const { client, error, status } = await getAuthorizedClient();
  if (!client) {
    return NextResponse.json({ error }, { status });
  }

  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') ?? 'settings';

  try {
    if (resource === 'settings') {
      const { data, error } = await client.rpc('get_all_perks_settings');
      if (error) throw error;
      return NextResponse.json({ data, error: null });
    }

    if (resource === 'customers') {
      const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
      const { data, error } = await client.rpc('get_all_customers_loyalty', { p_limit: limit });
      if (error) throw error;
      const customers = data?.customers ?? (Array.isArray(data) ? data : []);
      return NextResponse.json({ data: customers, error: null });
    }

    if (resource === 'promos') {
      const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const { data, error } = await client.rpc('get_all_customer_promo_codes_admin', {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      const promos = data?.promos ?? (Array.isArray(data) ? data : []);
      return NextResponse.json({ data: promos, error: null });
    }

    return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

// ─── POST /api/portal/perks – authenticated mutations ─────────────────────
export async function POST(request: NextRequest) {
  const { client, error, status } = await getAuthorizedClient();
  if (!client) {
    return NextResponse.json({ error }, { status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action } = body;

  try {
    switch (action) {
      // ── Settings ────────────────────────────────────────────────────────
      case 'update_setting': {
        const { key, value } = body as { key: string; value: unknown };
        if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
        const { data, error } = await client.rpc('update_perks_setting', {
          p_setting_key: key,
          p_setting_value: value,
        });
        if (error) throw error;
        return NextResponse.json({ data, error: null });
      }

      // ── Single promo actions ─────────────────────────────────────────────
      case 'deactivate_promo': {
        const { promoId } = body as { promoId: string };
        if (!promoId) return NextResponse.json({ error: 'promoId is required' }, { status: 400 });
        const { data, error } = await client.rpc('deactivate_customer_promo_admin', {
          p_promo_id: promoId,
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? 'Failed to deactivate');
        return NextResponse.json({ data, error: null });
      }

      case 'activate_promo': {
        const { promoId } = body as { promoId: string };
        if (!promoId) return NextResponse.json({ error: 'promoId is required' }, { status: 400 });
        const { data, error } = await client.rpc('activate_customer_promo_admin', {
          p_promo_id: promoId,
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? 'Failed to activate');
        return NextResponse.json({ data, error: null });
      }

      case 'delete_promo': {
        const { promoId } = body as { promoId: string };
        if (!promoId) return NextResponse.json({ error: 'promoId is required' }, { status: 400 });
        const { data, error } = await client.rpc('delete_customer_promo_admin', {
          p_promo_id: promoId,
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? 'Failed to delete');
        return NextResponse.json({ data, error: null });
      }

      // ── Bulk promo actions ───────────────────────────────────────────────
      case 'bulk_activate_promos': {
        const { promoIds } = body as { promoIds: string[] };
        if (!Array.isArray(promoIds) || promoIds.length === 0)
          return NextResponse.json({ error: 'promoIds array is required' }, { status: 400 });
        const { data, error } = await client.rpc('bulk_activate_promo_codes_admin', {
          p_promo_ids: promoIds,
        });
        if (error) throw error;
        return NextResponse.json({ data, error: null });
      }

      case 'bulk_deactivate_promos': {
        const { promoIds } = body as { promoIds: string[] };
        if (!Array.isArray(promoIds) || promoIds.length === 0)
          return NextResponse.json({ error: 'promoIds array is required' }, { status: 400 });
        const { data, error } = await client.rpc('bulk_deactivate_promo_codes_admin', {
          p_promo_ids: promoIds,
        });
        if (error) throw error;
        return NextResponse.json({ data, error: null });
      }

      case 'bulk_delete_promos': {
        const { promoIds } = body as { promoIds: string[] };
        if (!Array.isArray(promoIds) || promoIds.length === 0)
          return NextResponse.json({ error: 'promoIds array is required' }, { status: 400 });
        const { data, error } = await client.rpc('bulk_delete_promo_codes_admin', {
          p_promo_ids: promoIds,
        });
        if (error) throw error;
        return NextResponse.json({ data, error: null });
      }

      // ── Maintenance ──────────────────────────────────────────────────────
      case 'cleanup_expired_promos': {
        const { data, error } = await client.rpc('cleanup_expired_customer_promos');
        if (error) throw error;
        return NextResponse.json({ data, error: null });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
