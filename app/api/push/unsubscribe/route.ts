import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(token);
    
    // Use RPC to remove subscription (SECURITY DEFINER bypasses RLS)
    const { data, error } = await supabase.rpc('remove_push_subscription', {
      p_endpoint: null,
      p_user_id: decoded.userId
    });

    if (error) {
      console.error('Error deleting push subscription:', error);
      return NextResponse.json({ success: false, message: 'Failed to remove subscription' }, { status: 500 });
    }

    // Also disable push_notifications preference for customers
    if (decoded.userType === 'customer') {
      await supabase.rpc('update_customer_notification_preferences', {
        p_customer_id: decoded.userId,
        p_preferences: { push_notifications: false }
      });
    }

    return NextResponse.json({ success: true, message: 'Push subscription removed successfully' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
