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

// GET - Get offer details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await getAuthenticatedClient(request);
    const { id } = await params;
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Fetch offer with direct query
    const { data: offer, error } = await client
      .from('special_offers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Fetch offer items
    const { data: rawItems } = await client
      .from('special_offer_items')
      .select(`
        id,
        menu_item_id,
        original_price,
        offer_price,
        menu_items (
          id,
          name,
          price,
          images
        )
      `)
      .eq('offer_id', id);
    
    // Transform items to expected format (menu_items -> menu_item)
    const items = (rawItems || []).map((item: any) => ({
      menu_item_id: item.menu_item_id,
      original_price: item.original_price,
      offer_price: item.offer_price,
      menu_item: item.menu_items ? {
        name: item.menu_items.name,
        images: item.menu_items.images || [],
        price: item.menu_items.price,
      } : null,
    }));
    
    return NextResponse.json({ 
      offer: {
        ...offer,
        items,
        deals: [], // No deals table support yet
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update offer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await getAuthenticatedClient(request);
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Handle status-only update (for toggle status)
    if (body.status && Object.keys(body).length === 1) {
      const { data, error } = await client.rpc('toggle_offer_status', {
        p_offer_id: id,
        p_status: body.status,
      });
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      if (!data?.success) {
        return NextResponse.json({ error: data?.error || 'Failed to update status' }, { status: 400 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Status updated successfully',
      });
    }
    
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
    
    // Update the offer
    const { data, error } = await client.rpc('update_special_offer', {
      p_offer_id: id,
      p_name: name?.trim() || null,
      p_description: description || null,
      p_event_type: event_type || null,
      p_discount_type: discount_type || null,
      p_discount_value: discount_value ? parseFloat(discount_value) : null,
      p_start_date: start_date || null,
      p_end_date: end_date || null,
      p_banner_image: banner_image || null,
      p_popup_image: popup_image || null,
      p_theme_colors: theme_colors || null,
      p_pakistani_flags: pakistani_flags,
      p_confetti_enabled: confetti_enabled,
      p_show_popup: show_popup,
      p_popup_auto_close_seconds: popup_auto_close_seconds,
      p_min_order_amount: min_order_amount ? parseFloat(min_order_amount) : null,
      p_max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      p_notify_via_email: notify_via_email,
      p_notify_via_push: notify_via_push,
      p_auto_notify_on_start: auto_notify_on_start,
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Failed to update offer' }, { status: 400 });
    }
    
    // Update menu items if provided
    if (items !== undefined) {
      // First clear existing items
      await client.from('special_offer_items').delete().eq('offer_id', id);
      
      if (items.length > 0) {
        const itemsData = items.map((item: any) => ({
          menu_item_id: item.menu_item_id,
          original_price: parseFloat(item.original_price) || 0,
          offer_price: parseFloat(item.offer_price) || 0,
        }));
        
        await client.rpc('add_offer_items', {
          p_offer_id: id,
          p_items: itemsData,
        });
      }
    }
    
    // Note: special_offer_deals table not yet implemented
    
    return NextResponse.json({
      success: true,
      message: 'Offer updated successfully',
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete offer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await getAuthenticatedClient(request);
    
    if (!client) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const { data, error } = await client.rpc('delete_special_offer', { p_offer_id: id });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Failed to delete offer' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Offer deleted successfully',
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
