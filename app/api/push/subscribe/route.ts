import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { subscription, userType, deviceInfo } = await request.json();

    if (!subscription || !userType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate subscription object
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, message: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Use RPC with SECURITY DEFINER to save subscription
    const supabase = createAuthenticatedClient(token);
    
    const { data, error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_user_type: userType,
      p_device_info: deviceInfo || {},
      p_user_id: decoded.userId
    });

    if (error) {
      console.error('RPC save_push_subscription error:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // Check RPC-level success/failure (returned in jsonb)
    if (data && data.success === false) {
      console.error('RPC save_push_subscription failed:', data.error);
      return NextResponse.json(
        { success: false, message: data.error || 'Failed to save subscription' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription_id: data?.subscription_id,
      message: 'Push subscription saved',
    });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
