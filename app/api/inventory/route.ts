// =============================================
// INVENTORY API ROUTES - Main Handler
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getInventoryItems,
  createInventoryItem,
  getInventorySummary,
  getInventoryTransactions,
  getLowStockItems,
  getInventoryAlerts,
  getInventorySuppliers,
  getInventoryValueByCategory,
  getReorderSuggestions,
  getExpiringItems,
  getInventoryMovementReport,
} from '@/lib/inventory-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list':
        const items = await getInventoryItems();
        return NextResponse.json({ success: true, data: items });

      case 'summary':
        const summary = await getInventorySummary();
        return NextResponse.json({ success: true, data: summary });

      case 'transactions':
        const itemId = searchParams.get('itemId') || undefined;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        const transactionType = searchParams.get('type') || undefined;
        
        const transactions = await getInventoryTransactions({
          itemId,
          startDate,
          endDate,
          limit,
          transactionType: transactionType as any,
        });
        return NextResponse.json({ success: true, data: transactions });

      case 'low-stock':
        const lowStock = await getLowStockItems();
        return NextResponse.json({ success: true, data: lowStock });

      case 'alerts':
        const unreadOnly = searchParams.get('unreadOnly') !== 'false';
        const alerts = await getInventoryAlerts(unreadOnly);
        return NextResponse.json({ success: true, data: alerts });

      case 'suppliers':
        const suppliers = await getInventorySuppliers();
        return NextResponse.json({ success: true, data: suppliers });

      case 'categories':
        const categories = await getInventoryValueByCategory();
        return NextResponse.json({ success: true, data: categories });

      case 'reorder':
        const reorderItems = await getReorderSuggestions();
        return NextResponse.json({ success: true, data: reorderItems });

      case 'expiring':
        const days = parseInt(searchParams.get('days') || '30');
        const expiringItems = await getExpiringItems(days);
        return NextResponse.json({ success: true, data: expiringItems });

      case 'report':
        const reportStart = searchParams.get('startDate') || undefined;
        const reportEnd = searchParams.get('endDate') || undefined;
        const report = await getInventoryMovementReport(reportStart, reportEnd);
        return NextResponse.json({ success: true, data: report });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await createInventoryItem({
      name: body.name,
      sku: body.sku,
      category: body.category,
      unit: body.unit,
      quantity: body.quantity,
      min_quantity: body.min_quantity,
      max_quantity: body.max_quantity,
      cost_per_unit: body.cost_per_unit,
      supplier: body.supplier,
      notes: body.notes,
      location: body.location,
      barcode: body.barcode,
      expiry_date: body.expiry_date,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: { id: result.id, sku: result.sku } 
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

