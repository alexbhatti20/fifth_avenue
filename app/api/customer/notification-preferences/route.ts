import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';

const DEFAULT_PREFERENCES = {
  order_updates: true,
  promotional_offers: true,
  loyalty_rewards: true,
  new_menu_items: false,
  push_notifications: false,
  email_notifications: true,
  sms_notifications: false,
};

async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) return { customer: null, token: null, decoded: null };

  const decoded = await verifyToken(token);
  if (!decoded || decoded.userType !== 'customer') return { customer: null, token: null, decoded: null };

  const supabase = createAuthenticatedClient(token);
  
  // Use RPC to get customer by auth_user_id (bypasses RLS issues)
  const { data: customers } = await supabase.rpc('get_customer_by_auth_id', {
    p_auth_user_id: decoded.authUserId
  });
  
  const customer = customers && customers.length > 0 ? customers[0] : null;

  return { customer, token, decoded };
}

// GET /api/customer/notification-preferences
export async function GET(request: NextRequest) {
  try {
    const { customer } = await getAuthenticatedCustomer();

    if (!customer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(customer.notification_preferences || {}),
    };

    return NextResponse.json({ data: preferences, error: null });
  } catch (error: unknown) {
    console.error('GET notification-preferences error:', error);
    return NextResponse.json({ data: DEFAULT_PREFERENCES, error: null });
  }
}

// PUT /api/customer/notification-preferences
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    // Whitelist valid preference keys
    const validKeys = Object.keys(DEFAULT_PREFERENCES);
    const sanitized: Record<string, boolean> = {};

    for (const key of validKeys) {
      if (key in body) {
        sanitized[key] = Boolean(body[key]);
      }
    }

    // Use RPC to update preferences (bypasses RLS)
    const supabase = createAuthenticatedClient(token);
    const { error } = await supabase.rpc('update_customer_notification_preferences', {
      p_customer_id: decoded.userId,
      p_preferences: sanitized
    });

    if (error) {
      console.error('RPC update_customer_notification_preferences error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: sanitized, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
