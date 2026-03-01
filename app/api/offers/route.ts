import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Create authenticated admin client
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

async function getAuthenticatedClient(request?: NextRequest) {
  // First try Authorization header (for API calls with token)
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) return createAuthenticatedClient(token);
    }
  }
  
  // Fallback to cookies
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value || cookieStore.get('auth_token')?.value;
  
  if (!accessToken) {
    return null;
  }
  
  return createAuthenticatedClient(accessToken);
}

// POST - Create offer
export async function POST(request: NextRequest) {
  try {
    const client = await getAuthenticatedClient(request);
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      name,
      description,
      event_type,
      discount_type,
      discount_value,
      start_date,
      end_date,
      banner_image,
      popup_image,
      theme_colors,
      pakistani_flags,
      confetti_enabled,
      show_popup,
      popup_auto_close_seconds,
      min_order_amount,
      max_discount_amount,
      notify_via_email,
      notify_via_push,
      auto_notify_on_start,
      items,
      deals,
    } = body;
    
    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Offer name is required' }, { status: 400 });
    }
    
    // Discount is only required for storewide offers — per-item priced offers set prices on each item/deal
    const hasPerItemPricing = (items && items.length > 0) || (deals && deals.length > 0);
    if (!hasPerItemPricing && (!discount_value || parseFloat(discount_value) <= 0)) {
      return NextResponse.json({ error: 'Discount value is required for storewide offers' }, { status: 400 });
    }
    
    // Create the offer using RPC
    const { data, error } = await client.rpc('create_special_offer', {
      p_name: name.trim(),
      p_description: description || null,
      p_event_type: event_type || 'custom',
      p_discount_type: discount_type || 'percentage',
      p_discount_value: parseFloat(discount_value) || 0,
      p_start_date: start_date,
      p_end_date: end_date,
      p_banner_image: banner_image || null,
      p_popup_image: popup_image || null,
      p_theme_colors: theme_colors || {},
      p_pakistani_flags: pakistani_flags || false,
      p_confetti_enabled: confetti_enabled !== false,
      p_show_popup: show_popup !== false,
      p_popup_auto_close_seconds: popup_auto_close_seconds || 5,
      p_min_order_amount: parseFloat(min_order_amount) || 0,
      p_max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      p_notify_via_email: notify_via_email || false,
      p_notify_via_push: notify_via_push || false,
      p_auto_notify_on_start: auto_notify_on_start || false,
    });
    
    if (error) {
      console.error('Create offer RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Failed to create offer' }, { status: 400 });
    }
    
    const offerId = data.offer_id;
    
    // Add menu items if provided
    if (items && items.length > 0) {
      const itemsData = items.map((item: any) => ({
        menu_item_id: item.menu_item_id,
        original_price: parseFloat(item.original_price) || 0,
        offer_price: parseFloat(item.offer_price) || 0,
      }));
      
      const { error: itemsError } = await client.rpc('add_offer_items', {
        p_offer_id: offerId,
        p_items: itemsData,
      });
      
      if (itemsError) {
        console.error('Add offer items error:', itemsError);
      }
    }
    
    // Add deals if provided
    if (deals && deals.length > 0) {
      const dealsData = deals.map((deal: any) => ({
        deal_id: deal.deal_id,
        original_price: parseFloat(deal.original_price) || 0,
        offer_price: parseFloat(deal.offer_price) || 0,
      }));
      
      const { error: dealsError } = await client.rpc('add_offer_deals', {
        p_offer_id: offerId,
        p_deals: dealsData,
      });
      
      if (dealsError) {
        console.error('Add offer deals error:', dealsError);
      }
    }
    
    return NextResponse.json({
      success: true,
      offer_id: offerId,
      slug: data.slug,
      message: 'Offer created successfully',
    });
    
  } catch (error: any) {
    console.error('Create offer error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create offer' }, { status: 500 });
  }
}

// GET - List all offers
export async function GET(request: NextRequest) {
  try {
    const client = await getAuthenticatedClient(request);
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const { data, error } = await client.rpc('get_all_special_offers', {
      p_status: null,
      p_include_items: true,
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // RPC returns { success, offers, stats }
    return NextResponse.json({ 
      offers: data?.offers || [], 
      stats: data?.stats || { total: 0, active: 0, scheduled: 0, expired: 0, draft: 0 }
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
