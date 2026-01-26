import { supabase } from '@/lib/supabase';
import { unstable_cache } from 'next/cache';
import {
  getCached,
  setCache,
  CACHE_KEYS,
  CACHE_DURATIONS,
  cacheWrapper,
} from '@/lib/cache';

// =============================================
// MENU QUERIES WITH MULTI-LAYER CACHING
// =============================================

// Get all menu categories (Redis + Next.js cache)
export const getMenuCategories = unstable_cache(
  async () => {
    try {
      if (!supabase) return [];
      return cacheWrapper(
        CACHE_KEYS.menuCategories(),
        async () => {
          const { data, error } = await supabase
            .from('menu_categories')
            .select('*')
            .eq('is_visible', true)
            .order('display_order', { ascending: true });

          if (error) {
            return [];
          }
          return data || [];
        },
        CACHE_DURATIONS.MENU_CATEGORIES
      );
    } catch (error) {
      return [];
    }
  },
  ['menu-categories'],
  {
    revalidate: 7200, // 2 hours
    tags: ['menu-categories'],
  }
);

// Get menu items by category (Redis + Next.js cache)
export const getMenuItemsByCategory = unstable_cache(
  async (categoryId?: string) => {
    try {
      if (!supabase) return [];
      const cacheKey = CACHE_KEYS.menuItems(categoryId);
      
      return cacheWrapper(
        cacheKey,
        async () => {
          let query = supabase
            .from('menu_items')
            .select('*, menu_categories(name, slug)')
            .eq('is_available', true);

          if (categoryId) {
            query = query.eq('category_id', categoryId);
          }

          const { data, error } = await query.order('name');

          if (error) {
            return [];
          }
          return data || [];
        },
        CACHE_DURATIONS.MENU_ITEMS
      );
    } catch (error) {
      return [];
    }
  },
  ['menu-items'],
  {
    revalidate: 3600, // 1 hour
    tags: ['menu-items'],
  }
);

// Get active deals (Redis + Next.js cache)
export const getActiveDeals = unstable_cache(
  async () => {
    try {
      if (!supabase) return [];
      return cacheWrapper(
        CACHE_KEYS.activeDeals(),
        async () => {
          const now = new Date().toISOString();
          const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('is_active', true)
            .lte('valid_from', now)
            .gte('valid_until', now)
            .order('created_at', { ascending: false });

          if (error) {
            return [];
          }
          return data || [];
        },
        CACHE_DURATIONS.DEALS
      );
    } catch (error) {
      return [];
    }
  },
  ['active-deals'],
  {
    revalidate: 1800, // 30 minutes
    tags: ['deals'],
  }
);

// =============================================
// SITE CONTENT QUERIES (HEAVILY CACHED)
// =============================================

export const getSiteContent = unstable_cache(
  async (section: string) => {
    try {
      if (!supabase) return null;
      return cacheWrapper(
        CACHE_KEYS.siteContent(section),
        async () => {
          const { data, error } = await supabase
            .from('site_content')
            .select('*')
            .eq('section', section)
            .eq('is_active', true)
            .single();

          if (error) {
            return null;
          }
          return data;
        },
        CACHE_DURATIONS.SITE_CONTENT
      );
    } catch (error) {
      return null;
    }
  },
  ['site-content'],
  {
    revalidate: 3600, // 1 hour
    tags: ['site-content'],
  }
);

// =============================================
// REVIEW QUERIES
// =============================================

export const getVisibleReviews = unstable_cache(
  async (limit: number = 10) => {
    try {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('reviews')
        .select('*, customers(name), orders(order_number)')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }
      return data || [];
    } catch (error) {
      return [];
    }
  },
  ['visible-reviews'],
  {
    revalidate: 3600, // 1 hour
    tags: ['reviews'],
  }
);

// =============================================
// ORDER QUERIES (NO SERVER CACHE - DYNAMIC)
// =============================================

// Get order details - client will fetch directly
export async function getOrderDetails(orderId: string) {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers(name, email, phone),
        restaurant_tables(table_number)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
}

// Get customer orders - client will fetch directly
export async function getCustomerOrders(customerId: string, limit = 10, offset = 0) {
  try {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return [];
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

// =============================================
// ANALYTICS QUERIES (ADMIN ONLY - NO CACHE)
// =============================================

export async function getDashboardStats() {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
}

export async function getSalesByDateRange(startDate: string, endDate: string) {
  try {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_sales_by_date_range', {
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) {
      return [];
    }
    return data;
  } catch (error) {
    return [];
  }
}

export async function getTopSellingItems(limit = 10) {
  try {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_top_selling_items', {
      p_limit: limit,
    });
    if (error) {
      return [];
    }
    return data;
  } catch (error) {
    return [];
  }
}

// Get notifications for user
export async function getUserNotifications(userId: string, userType: 'customer' | 'employee') {
  try {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('user_type', userType)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return [];
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

// Get available tables
export async function getAvailableTables() {
  try {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('status', 'available')
      .order('table_number');

    if (error) {
      return [];
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

