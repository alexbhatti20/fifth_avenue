// =============================================
// INVENTORY API ROUTES - Main Handler
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';
import { redis, CACHE_DURATION } from '@/lib/redis';
import {
  getInventoryItems,
  getInventorySummary,
  getInventoryTransactions,
  getLowStockItems,
  getInventoryAlerts,
  getInventorySuppliers,
  getInventoryValueByCategory,
  getReorderSuggestions,
  getExpiringItems,
  getInventoryMovementReport,
  invalidateInventoryCache,
} from '@/lib/server-queries';
import type { CreateItemData } from '@/lib/inventory-queries';


// Helper to verify employee authentication
async function verifyEmployeeAuth(request: NextRequest): Promise<{ valid: boolean; error?: string; status?: number; user?: any }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return { valid: false, error: 'Unauthorized', status: 401 };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return { valid: false, error: 'Invalid token', status: 401 };
  }

  // Only admin, manager, and kitchen can access inventory
  if (!['admin', 'manager', 'kitchen'].includes(decoded.role)) {
    return { valid: false, error: 'Insufficient permissions', status: 403 };
  }

  return { valid: true, user: decoded };
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyEmployeeAuth(request);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status || 401 });
    }

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
    // Verify authentication
    const auth = await verifyEmployeeAuth(request);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status || 401 });
    }

    // Only admin/manager can create inventory items
    if (!['admin', 'manager'].includes(auth.user?.role)) {
      return NextResponse.json({ success: false, error: 'Only managers can create inventory items' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.category || !body.unit) {
      return NextResponse.json({ success: false, error: 'Name, category, and unit are required' }, { status: 400 });
    }
    
    // Get token from header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No authentication token' }, { status: 401 });
    }
    
    // Create authenticated client with the token
    const supabase = createAuthenticatedClient(token);
    
    // Call RPC function directly with authenticated client
    const { data, error } = await supabase.rpc('create_inventory_item', {
      p_name: body.name,
      p_sku: body.sku,
      p_category: body.category,
      p_unit: body.unit,
      p_quantity: body.quantity || 0,
      p_min_quantity: body.min_quantity || 10,
      p_max_quantity: body.max_quantity || 100,
      p_cost_per_unit: body.cost_per_unit || 0,
      p_supplier: body.supplier,
      p_notes: body.notes,
      p_location: body.location,
      p_barcode: body.barcode,
      p_expiry_date: body.expiry_date,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Invalidate cache
    await invalidateInventoryCache();

    return NextResponse.json({ 
      success: true, 
      data: { id: data?.id, sku: data?.sku } 
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

