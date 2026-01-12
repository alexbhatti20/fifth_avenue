// =============================================
// INVENTORY API - Item Operations [id]
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryTransactions,
} from '@/lib/inventory-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get transactions for this item
    const transactions = await getInventoryTransactions({
      itemId: id,
      limit: 50,
    });

    return NextResponse.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error('Inventory item GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const result = await updateInventoryItem(id, {
      name: body.name,
      sku: body.sku,
      category: body.category,
      unit: body.unit,
      min_quantity: body.min_quantity,
      max_quantity: body.max_quantity,
      cost_per_unit: body.cost_per_unit,
      supplier: body.supplier,
      notes: body.notes,
      location: body.location,
      barcode: body.barcode,
      expiry_date: body.expiry_date,
      reorder_point: body.reorder_point,
      lead_time_days: body.lead_time_days,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Inventory item PUT error:', error);
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

    const result = await deleteInventoryItem(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Inventory item DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
