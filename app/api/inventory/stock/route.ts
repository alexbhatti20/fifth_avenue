// =============================================
// INVENTORY API - Stock Adjustment
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { adjustInventoryStock, bulkUpdateStock } from '@/lib/inventory-queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if it's a bulk update
    if (body.bulk && Array.isArray(body.items)) {
      const result = await bulkUpdateStock(body.items);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        data: { updated: result.updated, errors: result.errors } 
      });
    }

    // Single item adjustment
    const result = await adjustInventoryStock({
      itemId: body.itemId,
      transactionType: body.transactionType,
      quantity: body.quantity,
      reason: body.reason,
      unitCost: body.unitCost,
      referenceNumber: body.referenceNumber,
      batchNumber: body.batchNumber,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        new_quantity: result.new_quantity,
        previous_quantity: result.previous_quantity,
        change: result.change,
      }
    });
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
