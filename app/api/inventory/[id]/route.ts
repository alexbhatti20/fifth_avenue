// =============================================
// INVENTORY API - Item Operations [id]
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';
import { invalidateInventoryCache } from '@/lib/server-queries';
import type { UpdateItemData } from '@/lib/inventory-queries';


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get token from header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No authentication token' }, { status: 401 });
    }

    // Verify token
    const decoded = await verifyToken(token);
    if (!decoded || !['admin', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Create authenticated client
    const supabase = createAuthenticatedClient(token);

    const { data, error } = await supabase.rpc('update_inventory_item', {
      p_item_id: id,
      p_name: body.name,
      p_sku: body.sku,
      p_category: body.category,
      p_unit: body.unit,
      p_min_quantity: body.min_quantity,
      p_max_quantity: body.max_quantity,
      p_cost_per_unit: body.cost_per_unit,
      p_supplier: body.supplier,
      p_notes: body.notes,
      p_location: body.location,
      p_barcode: body.barcode,
      p_expiry_date: body.expiry_date,
      p_reorder_point: body.reorder_point,
      p_lead_time_days: body.lead_time_days,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await invalidateInventoryCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get token from header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No authentication token' }, { status: 401 });
    }

    // Verify token
    const decoded = await verifyToken(token);
    if (!decoded || !['admin', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Create authenticated client
    const supabase = createAuthenticatedClient(token);

    const { data, error } = await supabase.rpc('delete_inventory_item', {
      p_item_id: id,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await invalidateInventoryCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
