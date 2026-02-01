import { NextRequest, NextResponse } from 'next/server';
import { sendEmployeeBlockedNotification, sendEmployeeUnblockedNotification } from '@/lib/brevo';
import { verifyToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only admin/manager can send employee notifications
    if (!['admin', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { type, email, name, employeeId, reason, date } = body;

    if (!type || !email || !name || !employeeId || !reason || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;
    
    if (type === 'blocked') {
      result = await sendEmployeeBlockedNotification(
        email,
        name,
        employeeId,
        reason,
        date
      );
    } else if (type === 'unblocked') {
      result = await sendEmployeeUnblockedNotification(
        email,
        name,
        employeeId,
        reason,
        date
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email', details: result },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending employee notification:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

