import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

// Cache deals for 2 minutes (reduced for faster updates)
let cachedDeals: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedDeals && (now - cacheTimestamp) < CACHE_TTL) {
      // Double-check active status and validity from cache
      const validCachedDeals = cachedDeals.filter((deal: any) => {
        if (!deal.is_active) return false;
        const currentTime = new Date();
        const validFrom = deal.valid_from ? new Date(deal.valid_from) : null;
        const validUntil = deal.valid_until ? new Date(deal.valid_until) : null;
        if (validFrom && currentTime < validFrom) return false;
        if (validUntil && currentTime > validUntil) return false;
        return true;
      });
      
      return NextResponse.json({ 
        data: validCachedDeals,
        source: 'cache'
      });
    }

    // Try to use RPC function first (most efficient)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_active_deals_with_items');
    
    if (!rpcError && rpcData) {
      cachedDeals = rpcData;
      cacheTimestamp = now;
      return NextResponse.json({ 
        data: rpcData,
        source: 'rpc'
      });
    }

    // Fallback: Get deals from deals table (without items column)
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id,
        name,
        slug,
        description,
        discount_percentage,
        discount_amount,
        images,
        minimum_order_amount,
        valid_from,
        valid_until,
        is_active,
        usage_count,
        usage_limit
      `)
      .eq('is_active', true)
      .lte('valid_from', new Date().toISOString())
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (dealsError) {
      // Return cached data even if expired on error
      if (cachedDeals) {
        return NextResponse.json({ 
          data: cachedDeals,
          source: 'stale-cache'
        });
      }
      return NextResponse.json({ data: [], error: dealsError.message }, { status: 500 });
    }

    // Try to fetch deal items from separate table
    const dealIds = (dealsData || []).map((d: any) => d.id);
    let dealItemsMap: Record<string, any[]> = {};

    if (dealIds.length > 0) {
      // Try to get items from deal_items table
      const { data: dealItems, error: itemsError } = await supabase
        .from('deal_items')
        .select(`
          deal_id,
          menu_item_id,
          quantity,
          menu_items (
            id,
            name,
            price,
            images
          )
        `)
        .in('deal_id', dealIds);

      if (!itemsError && dealItems) {
        // Group items by deal_id
        dealItems.forEach((item: any) => {
          if (!dealItemsMap[item.deal_id]) {
            dealItemsMap[item.deal_id] = [];
          }
          dealItemsMap[item.deal_id].push({
            id: item.menu_item_id,
            quantity: item.quantity,
            name: item.menu_items?.name || 'Unknown Item',
            price: item.menu_items?.price || 0,
            image: item.menu_items?.images?.[0] || null,
          });
        });
      }
    }

    // Transform deals to match expected format
    const enrichedDeals = (dealsData || []).map((deal: any) => ({
      id: deal.id,
      name: deal.name,
      slug: deal.slug,
      description: deal.description,
      deal_type: 'combo', // Default type
      original_price: 0, // Will be calculated from items if available
      discounted_price: 0, // Will be calculated
      discount_percentage: deal.discount_percentage || 0,
      image_url: deal.images?.[0] || null,
      valid_from: deal.valid_from,
      valid_until: deal.valid_until,
      code: null,
      is_active: deal.is_active,
      items: dealItemsMap[deal.id] || [],
    }));

    // Calculate prices based on items
    enrichedDeals.forEach((deal: any) => {
      if (deal.items && deal.items.length > 0) {
        deal.original_price = deal.items.reduce(
          (sum: number, item: any) => sum + (item.price * item.quantity), 
          0
        );
        if (deal.discount_percentage > 0) {
          deal.discounted_price = Math.round(deal.original_price * (1 - deal.discount_percentage / 100));
        } else {
          deal.discounted_price = deal.original_price;
        }
      }
    });

    // Filter to only include active and valid deals
    const activeDeals = enrichedDeals.filter((deal: any) => {
      if (!deal.is_active) return false;
      const currentTime = new Date();
      const validFrom = deal.valid_from ? new Date(deal.valid_from) : null;
      const validUntil = deal.valid_until ? new Date(deal.valid_until) : null;
      if (validFrom && currentTime < validFrom) return false;
      if (validUntil && currentTime > validUntil) return false;
      return true;
    });

    cachedDeals = activeDeals;
    cacheTimestamp = now;

    return NextResponse.json({ 
      data: activeDeals,
      source: 'database'
    });
  } catch (error: any) {
    return NextResponse.json(
      { data: [], error: error.message },
      { status: 500 }
    );
  }
}

