import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

// Brevo batch email sending (max 50 recipients per request)
// (email sending removed — push notifications only)

async function _unused_sendBrevoEmailBatch_removed(
  recipients: { email: string; name?: string }[],
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, sent: 0, failed: recipients.length, error: 'Email service not configured' };
  }
  if (recipients.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  // Send one individual API call per recipient — works on all Brevo tiers
  // (messageVersions is a paid feature and silently fails on free tier)
  for (const r of recipients) {
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
          to: [{ email: r.email, name: r.name || r.email }],
          subject,
          htmlContent,
        }),
      });

      if (response.ok) {
        sent++;
      } else {
        const errText = await response.text();
        console.error(`[Brevo] Failed for ${r.email}:`, errText);
        lastError = errText;
        failed++;
      }
    } catch (err) {
      console.error(`[Brevo] Exception for ${r.email}:`, err);
      lastError = String(err);
      failed++;
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    ...(lastError ? { error: lastError } : {}),
  };
}

// Email HTML removed — push-only
function _unused_generateOfferEmailHTML_removed(offer: {
  name: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  end_date: string;
  banner_image?: string;
  pakistani_flags?: boolean;
  theme_colors?: { primary: string; secondary: string };
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
  const primaryColor = offer.theme_colors?.primary || '#dc2626';
  const secondaryColor = offer.theme_colors?.secondary || '#991b1b';

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
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">
                ${flagEmoji}🎉 Special Offer! 🎉${flagEmoji}
              </h1>
            </td>
          </tr>
          
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
              
              <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                <span style="color: #ffffff; font-size: 32px; font-weight: bold;">
                  ${discountText}
                </span>
              </div>
              
              <p style="margin: 0 0 25px 0; color: #888888; font-size: 14px; text-align: center;">
                ⏰ Offer valid until: <strong>${endDate}</strong>
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zoirobroast.me/#menu" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
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

// Build an adaptive push notification payload based on offer details
function buildPushPayload(offer: {
  id: string;
  name: string;
  description?: string | null;
  discount_type: string;
  discount_value: number;
  slug?: string | null;
  pakistani_flags?: boolean;
  items?: { name: string; price?: number; offerPrice?: number }[];   // menu items with original + offer price
  deals?: { name: string; originalPrice?: number; discountedPrice?: number }[]; // deals with before/after
}) {
  const flags = offer.pakistani_flags ? '\uD83C\uDDF5\uD83C\uDDF0 ' : '';
  const title = `${flags}\uD83C\uDF81 ${offer.name}`;

  const allItems = offer.items ?? [];
  const allDeals = offer.deals ?? [];
  const hasItems = allItems.length > 0 || allDeals.length > 0;

  // Format a single item/deal as "Name Rs 350 → Rs 280"
  const formatItemPrice = (name: string, original?: number, discounted?: number): string => {
    if (original && discounted && discounted < original) {
      return `${name} Rs\u202f${original}\u2192Rs\u202f${Math.round(discounted)}`;
    }
    if (original) {
      return `${name} Rs\u202f${original}`;
    }
    return name;
  };

  // Compute discounted price for a menu item based on offer's discount type
  // (only used as fallback when offer_price not stored directly)
  const computeDiscounted = (price: number): number | undefined => {
    switch (offer.discount_type) {
      case 'percentage':   return offer.discount_value > 0 ? price * (1 - offer.discount_value / 100) : undefined;
      case 'fixed_amount': return offer.discount_value > 0 ? Math.max(0, price - offer.discount_value) : undefined;
      default: return undefined;
    }
  };

  // Build formatted lines for items and deals
  const itemLines = allItems.map(i =>
    // Use stored offer_price if available, otherwise compute from discount
    formatItemPrice(i.name, i.price, i.offerPrice ?? (i.price != null ? computeDiscounted(i.price) : undefined))
  );
  const dealLines = allDeals.map(d =>
    formatItemPrice(d.name, d.originalPrice, d.discountedPrice)
  );
  const allLines = [...itemLines, ...dealLines];

  const discountSuffix = (() => {
    switch (offer.discount_type) {
      case 'percentage':    return offer.discount_value > 0 ? ` at ${offer.discount_value}% OFF` : '';
      case 'fixed_amount':  return offer.discount_value > 0 ? ` \u2014 save Rs\u202f${offer.discount_value}` : '';
      case 'bundle_price':  return ' at a bundle price';
      case 'buy_x_get_y':   return ' \u2014 buy more get free';
      default: return '';
    }
  })();

  let body: string;
  if (offer.description?.trim()) {
    body = offer.description.trim();
    if (hasItems) {
      const preview = allLines.slice(0, 2).join(' | ');
      const extra = allLines.length > 2 ? ` +${allLines.length - 2} more` : '';
      body += `\n${preview}${extra}`;
    }
  } else if (hasItems) {
    const preview = allLines.slice(0, 2).join(' | ');
    const extra = allLines.length > 2 ? ` & ${allLines.length - 2} more` : '';
    // If prices were shown in the lines, skip the redundant suffix
    const hasPrices = allLines.some(l => l.includes('Rs'));
    body = hasPrices
      ? `${preview}${extra} \uD83D\uDD25`
      : `${preview}${extra}${discountSuffix}! \uD83D\uDD25`;
  } else {
    // Fallback: discount-type only (storewide)
    switch (offer.discount_type) {
      case 'percentage':
        body = offer.discount_value > 0
          ? `${offer.discount_value}% OFF your order! Limited time only. \uD83D\uDD25`
          : 'Special offer live now \u2014 tap to order! \uD83D\uDD25';
        break;
      case 'fixed_amount':
        body = offer.discount_value > 0
          ? `Save Rs\u202f${offer.discount_value} on your order! Limited time. \uD83C\uDF89`
          : 'Special savings available now! \uD83C\uDF89';
        break;
      case 'bundle_price':
        body = 'Bundle deal \u2014 order more, save more! \uD83D\uDED2';
        break;
      case 'buy_x_get_y':
        body = 'Buy more, get items FREE! \uD83C\uDF81';
        break;
      default:
        body = 'Check out this special offer! \u2728';
    }
  }

  return {
    title,
    body,
    icon: '/assets/zoiro-logo.png',
    badge: '/assets/zoiro-logo.png',
    // Deterministic tag per offer — browser replaces instead of stacking
    tag: `zoiro-offer-${offer.id}`,
    notification_type: 'new_offer',
    data: { type: 'new_offer', offerId: offer.id, slug: offer.slug },
  };
}

const PUSH_BATCH_SIZE = 25;

// Send push notifications directly (no internal API call)
async function sendPushNotificationsDirectly(
  offer: { id: string; name: string; description?: string | null; discount_type: string; discount_value: number; slug?: string | null; pakistani_flags?: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  onBatchComplete?: (sent: number, failed: number, total: number) => void
): Promise<{ sent: number; failed: number; error?: string }> {
  try {
    // Import web-push
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let webpush: any;
    try {
      webpush = await import('web-push');
    } catch {
      return { sent: 0, failed: 0, error: 'web-push not installed' };
    }

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@zoirobroast.me';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return { sent: 0, failed: 0, error: 'VAPID keys not configured' };
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Fetch menu item names + prices included in this offer
    const { data: offerItems } = await supabase
      .from('special_offer_items')
      .select('menu_item_id, size_variant, original_price, offer_price, menu_items(name)')
      .eq('offer_id', offer.id);
    const items: { name: string; price?: number }[] = (offerItems || [])
      .map((i: { size_variant?: string; original_price?: number; offer_price?: number; menu_items?: { name?: string } | { name?: string }[] }) => {
        const mi = Array.isArray(i.menu_items) ? i.menu_items[0] : i.menu_items;
        const base = mi?.name ?? '';
        const name = i.size_variant ? `${base} (${i.size_variant})` : base;
        return {
          name,
          price: i.original_price,
          offerPrice: i.offer_price,
        };
      })
      .filter((i: { name: string }) => i.name);

    // Fetch deal names + before/after prices (table may not exist — fail gracefully)
    let deals: { name: string; originalPrice?: number; discountedPrice?: number }[] = [];
    try {
      const { data: offerDeals } = await supabase
        .from('special_offer_deals')
        .select('deal_id, deals(name, original_price, discounted_price)')
        .eq('offer_id', offer.id);
      deals = (offerDeals || [])
        .map((d: { deals?: { name?: string; original_price?: number; discounted_price?: number } }) => ({
          name: d.deals?.name ?? '',
          originalPrice: d.deals?.original_price,
          discountedPrice: d.deals?.discounted_price,
        }))
        .filter((d: { name: string }) => d.name);
    } catch { /* table may not exist */ }

    // Use RPC function with SECURITY DEFINER to bypass RLS
    const { data: subscriptions, error: subError } = await supabase
      .rpc('get_push_subscriptions', {
        p_user_ids: null,
        p_user_type: 'customer',
        p_roles: null,
      });

    if (subError) {
      console.error('[Stream Push] Error getting subscriptions via RPC:', subError);
      return { sent: 0, failed: 0, error: subError.message };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify(buildPushPayload({ ...offer, items, deals }));

    let sent = 0;
    let failed = 0;
    const total = subscriptions.length;

    // Send in parallel batches of PUSH_BATCH_SIZE for speed at scale
    for (let i = 0; i < total; i += PUSH_BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + PUSH_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          const reason = (results[j] as PromiseRejectedResult).reason as { statusCode?: number };
          if (reason?.statusCode === 410 || reason?.statusCode === 404) {
            console.log('[Stream Push] Stale subscription:', batch[j].endpoint?.slice(0, 50));
          }
        }
      }
      // Report batch progress to the SSE stream
      onBatchComplete?.(sent, failed, total);
    }

    return { sent, failed };
  } catch (err) {
    console.error('[Stream Push] Exception:', err);
    return { sent: 0, failed: 0, error: String(err) };
  }
}

export async function POST(request: NextRequest) {
  // Create authenticated client from user's JWT
  const supabase = await getAuthenticatedClient(request);
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { offerId, sendPush, forceResend } = body;

  if (!offerId) {
    return new Response(JSON.stringify({ error: 'Offer ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get offer details
  const { data: offer, error: offerError } = await supabase
    .from('special_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (offerError || !offer) {
    return new Response(JSON.stringify({ error: 'Offer not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Deduplication: block resend if already notified, unless forceResend=true
  if (offer.notification_sent_at && !forceResend) {
    const sentAt = new Date(offer.notification_sent_at).toLocaleString('en-PK', {
      dateStyle: 'medium', timeStyle: 'short',
    });
    return new Response(JSON.stringify({
      error: `already_sent`,
      message: `Notifications for this offer were already sent on ${sentAt}. Enable "Force Resend" to send again.`,
      sentAt: offer.notification_sent_at,
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch push subscriber count upfront so the modal shows the real number
  let pushSubscriberCount = 0;
  if (sendPush) {
    const { data: pushSubs, error: pushSubsError } = await supabase
      .rpc('get_push_subscriptions', {
        p_user_ids: null,
        p_user_type: 'customer',
        p_roles: null,
      });
    if (pushSubsError) {
      console.error('[Stream] Error fetching push subscriptions:', pushSubsError);
    }
    pushSubscriberCount = (pushSubs || []).length;
  }

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (err) {
          console.error('[Stream] Error encoding data:', err);
        }
      };

      const results = {
        email: { sent: 0, failed: 0 },
        push: { sent: 0, failed: 0 },
      };

      try {
        // Initial status
        send({
          type: 'init',
          totalCustomers: pushSubscriberCount,
          pushSubscriberCount,
          sendPush,
          offer: {
            id: offer.id,
            name: offer.name,
            discount_type: offer.discount_type,
            discount_value: offer.discount_value,
          },
        });

      // Send push notifications
      if (sendPush) {
        send({
          type: 'phase_start',
          phase: 'push',
          message: 'Sending push notifications...',
          totalSubscribers: pushSubscriberCount,
        });

        const pushResult = await sendPushNotificationsDirectly(offer, supabase, (bSent, bFailed, bTotal) => {
          send({
            type: 'batch_complete',
            sent: bSent,
            failed: bFailed,
            progress: Math.min(99, Math.round(((bSent + bFailed) / bTotal) * 100)),
          });
        });
        results.push = pushResult;

        send({
          type: 'phase_complete',
          phase: 'push',
          sent: results.push.sent,
          failed: results.push.failed,
        });
      }

      // Update offer with notification sent timestamp
      await supabase
        .from('special_offers')
        .update({ 
          notification_sent_at: new Date().toISOString(),
          notify_via_email: false,
          notify_via_push: sendPush,
        })
        .eq('id', offerId);

      // Final summary
      send({
        type: 'complete',
        results,
        totalCustomers: pushSubscriberCount,
        message: `Sent ${results.push.sent} push notifications`,
      });
      } catch (err) {
        console.error('[Stream] Error in notification stream:', err);
        // Send error event so client knows to close
        try {
          const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: errorMessage,
            results 
          })}\n\n`));
        } catch {
          // Ignore encoding errors during error handling
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
