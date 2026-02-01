// =============================================
// INVENTORY API - Stock Adjustment
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';
import { invalidateInventoryCache } from '@/lib/server-queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get token from header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No authentication token' }, { status: 401 });
    }

    // Verify token
    const decoded = await verifyToken(token);
    if (!decoded || !['admin', 'manager', 'kitchen'].includes(decoded.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Create authenticated client
    const supabase = createAuthenticatedClient(token);

    // Check if it's a bulk update
    if (body.bulk && Array.isArray(body.items)) {
      const { data, error } = await supabase.rpc('bulk_update_stock', {
        p_items: body.items,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      await invalidateInventoryCache();
      return NextResponse.json({ 
        success: true, 
        data: { updated: data?.updated, errors: data?.errors } 
      });
    }

    // Single item adjustment
    const { data, error } = await supabase.rpc('adjust_inventory_stock', {
      p_item_id: body.itemId,
      p_transaction_type: body.transactionType,
      p_quantity: body.quantity,
      p_reason: body.reason,
      p_unit_cost: body.unitCost,
      p_reference_number: body.referenceNumber,
      p_batch_number: body.batchNumber,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await invalidateInventoryCache();
    return NextResponse.json({ 
      success: true, 
      data: {
        new_quantity: data?.new_quantity,
        previous_quantity: data?.previous_quantity,
        change: data?.change,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

