import { NextRequest, NextResponse } from 'next/server';
import { sendEmployeeBlockedNotification, sendEmployeeUnblockedNotification } from '@/lib/brevo';

export async function POST(request: NextRequest) {
  try {
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
    console.error('Employee notify API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
