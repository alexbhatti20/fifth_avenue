import { NextRequest, NextResponse } from 'next/server';
import { 
  sendCustomerBannedNotification, 
  sendCustomerUnbannedNotification 
} from '@/lib/brevo';

/**
 * POST /api/customer/notify
 * Send customer ban/unban notification emails
 * This is a server-side route to protect the Brevo API key
 */
export async function POST(request: NextRequest) {
  try {
    const { type, email, name, reason } = await request.json();

    if (!type || !email || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: type, email, name' },
        { status: 400 }
      );
    }

    if (type === 'ban') {
      if (!reason) {
        return NextResponse.json(
          { error: 'Ban notification requires a reason' },
          { status: 400 }
        );
      }
      await sendCustomerBannedNotification(email, name, reason);
    } else if (type === 'unban') {
      await sendCustomerUnbannedNotification(email, name, reason);
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "ban" or "unban"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Customer notification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
