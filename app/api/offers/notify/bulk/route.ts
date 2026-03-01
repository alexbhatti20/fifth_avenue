import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Create authenticated Supabase client from request
async function getAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!accessToken) {
    const cookieStore = await cookies();
    accessToken = cookieStore.get('auth_token')?.value ?? cookieStore.get('sb-access-token')?.value ?? null;
  }

  if (!accessToken) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

// Brevo batch email sending
async function sendBrevoEmailBatch(
  recipients: { email: string; name?: string }[],
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, sent: 0, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Zoiro Broast',
          email: process.env.SENDER_EMAIL || 'info@zoirobroast.me',
        },
        to: recipients,
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, sent: 0, error };
    }

    return { success: true, sent: recipients.length };
  } catch (error) {
    return { success: false, sent: 0, error: String(error) };
  }
}

// Generate combined offers email HTML
function generateBulkOffersEmailHTML(offers: Array<{
  name: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  end_date: string;
  banner_image?: string;
}>) {
  const offerCards = offers.map(offer => {
    const discountText = offer.discount_type === 'percentage' 
      ? `${offer.discount_value}% OFF` 
      : `Rs ${offer.discount_value} OFF`;
    
    return `
      <div style="background: #ffffff; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        ${offer.banner_image ? `<img src="${offer.banner_image}" alt="${offer.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">` : ''}
        <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 18px;">${offer.name}</h3>
        ${offer.description ? `<p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">${offer.description}</p>` : ''}
        <div style="background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); border-radius: 6px; padding: 12px; text-align: center;">
          <span style="color: #ffffff; font-size: 20px; font-weight: bold;">${discountText}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Offers from Zoiro Broast</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">
                🎉 ${offers.length} Special Offers! 🎉
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; opacity: 0.9; font-size: 16px;">
                Don't miss out on these amazing deals!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f9fafb;">
              ${offerCards}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; text-align: center;">
              <a href="https://zoirobroast.me/#menu" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                Order Now →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a1a1a; padding: 20px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;">
                <strong>Zoiro Broast</strong> - Best Fried Chicken in Town!
              </p>
              <p style="margin: 0; color: #888888; font-size: 12px;">
                Model Town B-Block, Near Commercial Area, Bahawalpur
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Send push notifications directly via web-push
async function sendBulkPushNotifications(
  offers: Array<{ id: string; name: string; description?: string; discount_type: string; discount_value: number; slug?: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ sent: number; failed: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let webpush: any;
    try {
      webpush = await import('web-push');
    } catch {
      return { sent: 0, failed: 0 };
    }

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@zoirobroast.me';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return { sent: 0, failed: 0 };
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Get all customer push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .rpc('get_push_subscriptions', {
        p_user_ids: null,
        p_user_type: 'customer',
        p_roles: null,
      });

    if (subError || !subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Create a single combined notification for all offers
    const offerNames = offers.slice(0, 3).map(o => {
      const disc = o.discount_type === 'percentage' ? `${o.discount_value}% off` : `Rs ${o.discount_value} off`;
      return `${o.name} (${disc})`;
    }).join(', ');
    const moreText = offers.length > 3 ? ` and ${offers.length - 3} more` : '';
    
    const payload = JSON.stringify({
      title: `${offers.length} Special Offer${offers.length > 1 ? 's' : ''} at Zoiro!`,
      body: `${offerNames}${moreText}. Tap to order now!`,
      icon: '/assets/zoiro-logo.png',
      badge: '/assets/zoiro-logo.png',
      tag: `zoiro-bulk-offers-${Date.now()}`,
      notification_type: 'bulk_offers',
      data: { type: 'bulk_offers', offerCount: offers.length },
    });

    let sent = 0;
    let failed = 0;

    // Send to all subscriptions in parallel (batches of 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
        })
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
        }
      });
    }

    return { sent, failed };
  } catch (err) {
    console.error('[Bulk Push] Exception:', err);
    return { sent: 0, failed: 0 };
  }
}

// POST - Send bulk notifications for all active offers
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAuthenticatedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { offerIds, sendEmail, sendPush } = body;

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return NextResponse.json({ error: 'Offer IDs required' }, { status: 400 });
    }

    // Get all offers in one query
    const { data: offers, error: offersError } = await supabase
      .from('special_offers')
      .select('*')
      .in('id', offerIds);

    if (offersError || !offers || offers.length === 0) {
      return NextResponse.json({ error: 'No offers found' }, { status: 404 });
    }

    const results = {
      email: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 },
      offers: offers.length,
    };

    // Run email and push in parallel
    const tasks: Promise<void>[] = [];

    // Email task - send one combined email with all offers
    if (sendEmail) {
      tasks.push((async () => {
        const { data: customers, error: customersError } = await supabase
          .rpc('get_customers_for_notifications', {
            p_notification_type: 'email'
          });

        if (customersError) {
          console.error('[Bulk Notify] Error fetching customers:', customersError);
          return;
        }

        const allCustomers = (customers || []).map((c: { email: string; name: string }) => ({
          email: c.email,
          name: c.name,
        }));

        if (allCustomers.length === 0) return;

        // Send combined email with all offers - in batches of 50
        const emailSubject = `🎉 ${offers.length} Special Offers at Zoiro Broast!`;
        const emailHTML = generateBulkOffersEmailHTML(offers);

        // Use Promise.all for parallel batch sending
        const BATCH_SIZE = 50;
        const batches: Promise<{ success: boolean; sent: number }>[] = [];
        
        for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
          const batch = allCustomers.slice(i, i + BATCH_SIZE);
          const recipients = batch.map((c: { email: string; name: string }) => ({ 
            email: c.email, 
            name: c.name || undefined 
          }));
          batches.push(sendBrevoEmailBatch(recipients, emailSubject, emailHTML));
        }

        const batchResults = await Promise.all(batches);
        batchResults.forEach(result => {
          if (result.success) {
            results.email.sent += result.sent;
          } else {
            results.email.failed += result.sent || BATCH_SIZE;
          }
        });
      })());
    }

    // Push task
    if (sendPush) {
      tasks.push((async () => {
        const pushResult = await sendBulkPushNotifications(offers, supabase);
        results.push = pushResult;
      })());
    }

    // Wait for both to complete
    await Promise.all(tasks);

    // Update all offers with notification sent timestamp
    await supabase
      .from('special_offers')
      .update({ 
        notification_sent_at: new Date().toISOString(),
        notify_via_email: sendEmail || false,
        notify_via_push: sendPush || false,
      })
      .in('id', offerIds);

    return NextResponse.json({
      success: true,
      results,
      message: `Sent ${results.email.sent} emails and ${results.push.sent} push notifications for ${offers.length} offers`,
    });
  } catch (error) {
    console.error('Bulk notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send bulk notifications' },
      { status: 500 }
    );
  }
}
