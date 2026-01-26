import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  getCached, 
  setCache, 
  CACHE_KEYS, 
  CACHE_DURATIONS 
} from '@/lib/cache';

// =============================================
// Customer Menu API - RPC with Caching
// Single endpoint to get all menu data for landing page
// =============================================

interface CachedMenuData {
  categories: any[];
  items: any[];
  deals: any[];
  timestamp: number;
}

const MENU_CACHE_KEY = 'customer:menu:all';
const MENU_CACHE_TTL = 300; // 5 minutes cache

// GET /api/customer/menu - Get all menu data with caching
export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cached = await getCached<CachedMenuData>(MENU_CACHE_KEY);
    
    if (cached) {
      // Return cached data with cache hit header
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        cachedAt: new Date(cached.timestamp).toISOString(),
      }, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        }
      });
    }

    // Fetch fresh data using RPCs for efficiency
    const [categoriesResult, itemsResult, dealsResult] = await Promise.all([
      // Categories - only visible ones for customers
      supabase
        .from('menu_categories')
        .select('*')
        .eq('is_visible', true)
        .order('display_order'),
      
      // Menu items - only available ones for customers WITH size variants
      supabase
        .from('menu_items')
        .select(`
          id,
          name,
          slug,
          description,
          price,
          images,
          is_available,
          is_featured,
          preparation_time,
          rating,
          total_reviews,
          tags,
          category_id,
          has_variants,
          size_variants,
          menu_categories(id, name, slug)
        `)
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false }),
      
      // Active deals only
      supabase
        .from('deals')
        .select('*')
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString())
        .lte('valid_from', new Date().toISOString())
        .order('discount_percentage', { ascending: false }),
    ]);

    // Handle errors
    if (categoriesResult.error) {
      }
    if (itemsResult.error) {
      }
    if (dealsResult.error) {
      }

    // Prepare response data
    const menuData: CachedMenuData = {
      categories: categoriesResult.data || [],
      items: itemsResult.data || [],
      deals: dealsResult.data || [],
      timestamp: Date.now(),
    };

    // Cache the result
    await setCache(MENU_CACHE_KEY, menuData, MENU_CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: menuData,
      cached: false,
    }, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch menu data' },
      { status: 500 }
    );
  }
}

// Revalidate cache endpoint (for webhooks/admin updates)
export async function POST(request: NextRequest) {
  try {
    // Optional: Add secret key validation for cache invalidation
    const { secret } = await request.json().catch(() => ({}));
    
    // Force refresh by deleting cache
    const { deleteCache } = await import('@/lib/cache');
    await deleteCache(MENU_CACHE_KEY);
    
    return NextResponse.json({
      success: true,
      message: 'Menu cache invalidated',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}

