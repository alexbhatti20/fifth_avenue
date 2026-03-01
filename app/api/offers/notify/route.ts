import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Create authenticated Supabase client from request
async function getAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!accessToken) {
    const cookieStore = await cookies();
    // Try both auth_token and sb-access-token
    accessToken = cookieStore.get('auth_token')?.value ?? cookieStore.get('sb-access-token')?.value ?? null;
  }

  if (!accessToken) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

// Brevo API for sending emails
async function sendBrevoEmail(
  to: { email: string; name?: string }[],
  subject: string,
  htmlContent: string
) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('BREVO_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
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
        to,
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Brevo error:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: String(error) };
  }
}

// Generate offer email HTML
function generateOfferEmailHTML(offer: {
  name: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  end_date: string;
  banner_image?: string;
  pakistani_flags?: boolean;
}) {
  const discountText = offer.discount_type === 'percentage' 
    ? `${offer.discount_value}% OFF` 
    : `Rs ${offer.discount_value} OFF`;

  const endDate = new Date(offer.end_date).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const flagEmoji = offer.pakistani_flags ? '🇵🇰 ' : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${offer.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">
                ${flagEmoji}🎉 Special Offer! 🎉${flagEmoji}
              </h1>
            </td>
          </tr>
          
          <!-- Banner Image -->
          ${offer.banner_image ? `
          <tr>
            <td>
              <img src="${offer.banner_image}" alt="${offer.name}" style="width: 100%; height: auto; display: block;">
            </td>
          </tr>
          ` : ''}
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 24px;">
                ${offer.name}
              </h2>
              
              ${offer.description ? `
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ${offer.description}
              </p>
              ` : ''}
              
              <!-- Discount Badge -->
              <div style="background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                <span style="color: #ffffff; font-size: 32px; font-weight: bold;">
                  ${discountText}
                </span>
              </div>
              
              <!-- Validity -->
              <p style="margin: 0 0 25px 0; color: #888888; font-size: 14px; text-align: center;">
                ⏰ Offer valid until: <strong>${endDate}</strong>
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zoirobroast.me/#menu" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                      Order Now →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 20px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;">
                <strong>Zoiro Broast</strong> - Best Fried Chicken in Town!
              </p>
              <p style="margin: 0; color: #888888; font-size: 12px;">
                Model Town B-Block, Near Commercial Area, Bahawalpur
              </p>
              <p style="margin: 10px 0 0 0; color: #888888; font-size: 12px;">
                📞 0300-1234567 | 📧 info@zoirobroast.me
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

export async function POST(request: NextRequest) {
  try {
    // Create authenticated client from user's JWT
    const supabase = await getAuthenticatedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { offerId, type, title, description, sendEmail, sendPush } = body;

    if (!offerId) {
      return NextResponse.json({ error: 'Offer ID required' }, { status: 400 });
    }

    // Get offer details + included items
    const { data: offer, error: offerError } = await supabase
      .from('special_offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Fetch offer items with names + prices for the push body
    const { data: offerItems } = await supabase
      .from('special_offer_items')
      .select('offer_price, original_price, menu_items(name)')
      .eq('offer_id', offerId)
      .limit(3);

    // Build a phone-safe push notification body
    const buildPushBody = (): string => {
      if (offerItems && offerItems.length > 0) {
        const lines = offerItems.map((it: { offer_price: number; original_price: number; menu_items: { name: string }[] }) => {
          const name = it.menu_items?.[0]?.name ?? 'Item';
          const orig = it.original_price;
          const disc = it.offer_price;
          if (orig > disc) {
            return `${name}: Rs ${orig} -> Rs ${disc}`;
          }
          return `${name}: Rs ${disc}`;
        });
        const suffix = offer.discount_type === 'percentage'
          ? ` (${offer.discount_value}% off)`
          : ` (Rs ${offer.discount_value} off)`;
        return lines.join(' | ') + suffix;
      }
      // Storewide / no items
      if (offer.description) return offer.description;
      return offer.discount_type === 'percentage'
        ? `${offer.discount_value}% off your order - limited time!`
        : `Rs ${offer.discount_value} off your order - limited time!`;
    };

    const results = {
      email: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 },
    };

    // Determine what to send: support both old 'type' param and new 'sendEmail'/'sendPush' params
    const shouldSendEmail = sendEmail === true || type === 'email' || type === 'all';
    const shouldSendPush = sendPush === true || type === 'push' || type === 'all';

    // Send emails via Brevo
    if (shouldSendEmail) {
      // Use RPC with SECURITY DEFINER to get customers (bypasses RLS)
      const { data: customers, error: customersError } = await supabase
        .rpc('get_customers_for_notifications', {
          p_notification_type: 'email'
        });

      if (customersError) {
        console.error('[Notify] Error fetching customers via RPC:', customersError);
      }

      const allCustomers = (customers || []).map((c: { customer_id: string; email: string; name: string }) => ({
        email: c.email,
        name: c.name,
      }));

      if (allCustomers.length > 0) {
        // Brevo has batch limits, send in chunks of 50
        const chunks: { email: string; name: string }[][] = [];
        for (let i = 0; i < allCustomers.length; i += 50) {
          chunks.push(allCustomers.slice(i, i + 50));
        }

        const emailSubject = `🎉 ${offer.name} - ${offer.discount_type === 'percentage' ? `${offer.discount_value}% OFF` : `Rs ${offer.discount_value} OFF`}!`;
        const emailHTML = generateOfferEmailHTML(offer);

        for (const chunk of chunks) {
          const recipients = chunk.map(c => ({ email: c.email, name: c.name || undefined }));
          const result = await sendBrevoEmail(recipients, emailSubject, emailHTML);
          
          if (result.success) {
            results.email.sent += chunk.length;
          } else {
            results.email.failed += chunk.length;
          }
        }
      }
    }

    // Send push notifications
    if (shouldSendPush) {
      // Forward authorization header from original request
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const pushResponse = await fetch(new URL('/api/push/send', request.url), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: offer.name,
          body: buildPushBody(),
          notificationType: 'new_offer',
          userType: 'customer',
          data: { offerId: offer.id, slug: offer.slug },
        }),
      });

      if (pushResponse.ok) {
        const pushResult = await pushResponse.json();
        results.push.sent = pushResult.sent || 0;
        results.push.failed = pushResult.failed || 0;
      }
    }

    // Update offer with notification sent timestamp
    await supabase
      .from('special_offers')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', offerId);

    return NextResponse.json({
      success: true,
      results,
      message: `Sent ${results.email.sent} emails and ${results.push.sent} push notifications`,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}

// GET - Get notification stats for an offer
export async function GET(request: NextRequest) {
  // Create authenticated client from user's JWT
  const supabase = await getAuthenticatedClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get('offerId');

  if (!offerId) {
    return NextResponse.json({ error: 'Offer ID required' }, { status: 400 });
  }

  const { data: offer, error } = await supabase
    .from('special_offers')
    .select('notification_sent_at, notify_via_email, notify_via_push, view_count, click_count')
    .eq('id', offerId)
    .single();

  if (error || !offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({
    notification_sent_at: offer.notification_sent_at,
    notify_via_email: offer.notify_via_email,
    notify_via_push: offer.notify_via_push,
    stats: {
      views: offer.view_count,
      clicks: offer.click_count,
    },
  });
}
