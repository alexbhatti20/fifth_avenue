// =============================================
// INVENTORY API - Alerts
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getInventoryAlerts,
  markInventoryAlertRead,
  resolveInventoryAlert,
} from '@/lib/inventory-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') !== 'false';

    const alerts = await getInventoryAlerts(unreadOnly);
    return NextResponse.json({ success: true, data: alerts });
  } catch (error: any) {
    console.error('Alerts GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'resolve') {
      result = await resolveInventoryAlert(alertId);
    } else {
      result = await markInventoryAlertRead(alertId);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Alerts PUT error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
