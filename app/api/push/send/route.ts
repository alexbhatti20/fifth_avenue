import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// NOTE: Install web-push: npm install web-push
// Install types: npm install -D @types/web-push  
// Generate VAPID keys: npx web-push generate-vapid-keys

// VAPID keys for web push (FREE - no API needed)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@zoirobroast.me';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  notification_type?: string;
  reference_id?: string;
  data?: Record<string, unknown>;
}

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id?: string;
}

// Verify admin authentication using anon key + user JWT
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; client?: any }> {
  try {
    // Get access token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    let accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!accessToken) {
      const cookieStore = await cookies();
      accessToken = cookieStore.get('sb-access-token')?.value ?? null;
    }

    if (!accessToken) {
      console.log('[Push] No access token found');
      return { isAdmin: false };
    }

    // Create client with the access token in headers for RLS queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // Verify the JWT by passing it directly to getUser()
    const { data: { user }, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !user) {
      console.log('[Push] User verification failed:', userError?.message);
      return { isAdmin: false };
    }

    const { data: employee } = await client
      .from('employees')
      .select('role, id')
      .eq('auth_user_id', user.id)
      .single();

    if (employee?.role && ['admin', 'manager'].includes(employee.role)) {
      return { isAdmin: true, userId: user.id, client };
    }

    console.log('[Push] User is not admin/manager:', employee?.role);
    return { isAdmin: false };
  } catch (err) {
    console.error('[Push] verifyAdmin error:', err);
    return { isAdmin: false };
  }
}

// Send push notification to a single subscription
async function sendPushToSubscription(
  subscription: Subscription,
  payload: PushPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient?: any
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let webpush: any;
  try {
    webpush = await import('web-push');
  } catch {
    return { success: false, error: 'web-push not installed. Run: npm install web-push' };
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { success: false, error: 'VAPID keys not configured' };
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true };
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    
    // Remove invalid subscriptions if admin client available
    if ((err.statusCode === 410 || err.statusCode === 404) && adminClient) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Send failed' 
    };
  }
}

// Main POST handler - Send notifications
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, userId, client } = await verifyAdmin(request);
    
    if (!isAdmin || !client) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userIds,           // Array of specific user IDs
      userType,          // 'employee' | 'customer' | 'all'
      targetRoles,       // Array of roles for employees ['admin', 'manager', 'kitchen']
      title,
      body: messageBody,
      notificationType,  // Type for routing/icons
      referenceId,
      image,
      priority,
    } = body;

    if (!title || !messageBody) {
      return NextResponse.json(
        { success: false, message: 'Title and body required' },
        { status: 400 }
      );
    }

    // Build query for subscriptions
    let query = client
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .eq('is_active', true);

    // Filter by specific users
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    // Filter by user type
    if (userType && userType !== 'all') {
      query = query.eq('user_type', userType);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    // Filter by roles if targeting employees with specific roles
    let filteredSubs = subscriptions || [];
    
    if (targetRoles && targetRoles.length > 0 && userType === 'employee') {
      const { data: roleUsers } = await client
        .from('employees')
        .select('id')
        .in('role', targetRoles);
      
      const roleUserIds = new Set((roleUsers || []).map(u => u.id));
      filteredSubs = filteredSubs.filter(s => roleUserIds.has(s.user_id));
    }

    if (filteredSubs.length === 0) {
      // Queue for later even if no current subscriptions
      await client.from('push_notification_queue').insert({
        target_user_ids: userIds || [],
        target_user_type: userType || 'all',
        target_roles: targetRoles || [],
        title,
        body: messageBody,
        notification_type: notificationType || 'general',
        reference_id: referenceId,
        image,
        priority: priority || 'normal',
        status: 'sent',
        sent_count: 0,
        created_by: userId,
      });

      return NextResponse.json({
        success: true,
        message: 'No active subscriptions found',
        sent: 0,
        total: 0,
      });
    }

    // Build notification payload
    const payload: PushPayload = {
      title,
      body: messageBody,
      icon: '/assets/zoiro-logo.png',
      badge: '/assets/zoiro-logo.png',
      image,
      tag: `zoiro-${notificationType || 'notification'}-${Date.now()}`,
      notification_type: notificationType,
      reference_id: referenceId,
      data: {
        type: notificationType,
        reference_id: referenceId,
      },
    };

    // Send to all subscriptions in parallel (batched)
    const BATCH_SIZE = 50;
    const results: { success: boolean; error?: string }[] = [];

    for (let i = 0; i < filteredSubs.length; i += BATCH_SIZE) {
      const batch = filteredSubs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((sub) => sendPushToSubscription(sub, payload, client))
      );
      results.push(...batchResults);
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const errors = results.filter(r => !r.success && r.error).map(r => r.error);

    // Log to queue for tracking
    await client.from('push_notification_queue').insert({
      target_user_ids: userIds || [],
      target_user_type: userType || 'all',
      target_roles: targetRoles || [],
      title,
      body: messageBody,
      notification_type: notificationType || 'general',
      reference_id: referenceId,
      image,
      priority: priority || 'normal',
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
      sent_count: sent,
      failed_count: failed,
      processed_at: new Date().toISOString(),
      error_details: errors.slice(0, 10),
      created_by: userId,
    });

    return NextResponse.json({
      success: true,
      message: `Push notifications sent`,
      sent,
      failed,
      total: filteredSubs.length,
    });
  } catch (error) {
    console.error('Push send error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Check push notification status (public — no DB query needed)
export async function GET() {
  const isConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

  return NextResponse.json({
    configured: isConfigured,
    vapidPublicKey: VAPID_PUBLIC_KEY || null,
    message: isConfigured
      ? 'Push notifications ready (100% FREE with VAPID)'
      : 'VAPID keys not configured. Run: npx web-push generate-vapid-keys',
  });
}
