// =============================================
// ZOIRO BROAST HUB - SERVER-SIDE QUERIES
// These functions run ONLY on the server (hidden from browser)
// With Redis caching for reduced Supabase load
// =============================================

import { supabase, isSupabaseConfigured, createAuthenticatedClient } from './supabase';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { getCached, setCache, CACHE_DURATIONS, CACHE_KEYS } from './cache';
import { verifyToken } from './jwt';
import { isNetworkError, handleError } from './utils';
import { redis, CACHE_DURATION, getFromCache, setInCache } from './redis';
import type {
  InventoryItem,
  InventorySummary,
  InventorySupplier,
  InventoryAlert,
  LowStockItem,
  StockTransaction,
  CreateItemData,
  UpdateItemData,
  StockAdjustmentData,
  TransactionFilters,
  TransactionType,
  InventoryMovementReport,
  ExpiringItem,
  CategoryValue,
  INVENTORY_CACHE_KEYS,
} from './inventory-queries';

// =============================================
// AUTHENTICATED CLIENT HELPER (Server-Side)
// Creates an authenticated Supabase client using JWT from cookies
// Required for RPC calls that need authenticated role
// =============================================

export async function getAuthenticatedClient() {
  try {
    const cookieStore = await cookies();
    
    // Try to get access token - check multiple cookie names
    const sbToken = cookieStore.get('sb-access-token')?.value;
    const authToken = cookieStore.get('auth_token')?.value;
    const accessToken = sbToken || authToken;
    
    if (!accessToken) {
      return supabase;
    }
    
    // Check if token is expired by decoding it
    try {
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        
        if (expiresAt < now) {
          return supabase;
        }
      }
    } catch (e) {
      // If we can't decode, still try to use the token
    }
    
    return createAuthenticatedClient(accessToken);
  } catch (e) {
    // Silent fallback
  }
  
  // Fall back to anonymous client
  return supabase;
}

// =============================================
// SSR AUTH FUNCTIONS
// Get current user info server-side from cookies
// =============================================

export interface SSRUser {
  id: string;
  email: string;
  role?: string;
  userType: 'customer' | 'employee' | 'admin' | null;
}

/**
 * Get user type from cookies (set during login)
 * This is the fastest SSR auth check - no DB call needed
 */
export async function getSSRUserType(): Promise<'customer' | 'employee' | 'admin' | null> {
  try {
    const cookieStore = await cookies();
    const userType = cookieStore.get('user_type')?.value;
    if (userType === 'customer' || userType === 'employee' || userType === 'admin') {
      return userType;
    }
  } catch {}
  return null;
}

/**
 * Get current employee for SSR - uses auth token from cookies
 */
export async function getSSRCurrentEmployee() {
  try {
    const client = await getAuthenticatedClient();
    const cookieStore = await cookies();
    
    // Fast path: check user_type first
    const userType = cookieStore.get('user_type')?.value;
    if (userType === 'customer') {
      return null; // Customer, not employee
    }
    
    // Get token to decode user ID
    const token = cookieStore.get('sb-access-token')?.value || cookieStore.get('auth_token')?.value;
    if (!token) return null;
    
    // Decode JWT to get user ID
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const authUserId = payload.sub;
    if (!authUserId) return null;
    
    // Fetch employee data via RPC
    const { data, error } = await client.rpc('get_employee_by_auth_user', {
      p_auth_user_id: authUserId,
    });
    
    if (error || !data) return null;
    
    // Handle RPC response wrapper
    const result = data as { success?: boolean; data?: unknown; error?: string };
    if (result.success === false || result.error) return null;
    
    return result.data || data;
  } catch (e) {
    console.error('[SSR] getSSRCurrentEmployee error:', e);
    return null;
  }
}

/**
 * Get current customer for SSR - uses auth token from cookies
 */
export async function getSSRCurrentCustomer() {
  try {
    const client = await getAuthenticatedClient();
    const cookieStore = await cookies();
    
    // Fast path: check user_type first  
    const userType = cookieStore.get('user_type')?.value;
    if (userType === 'employee' || userType === 'admin') {
      return null; // Employee, not customer
    }
    
    // Get token to decode user ID
    const token = cookieStore.get('sb-access-token')?.value || cookieStore.get('auth_token')?.value;
    if (!token) return null;
    
    // Decode JWT to get user ID
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const authUserId = payload.sub;
    if (!authUserId) return null;
    
    // Fetch customer data via RPC
    const { data, error } = await client.rpc('get_customer_by_auth_id', {
      p_auth_user_id: authUserId,
    });
    
    if (error || !data || data.length === 0) return null;
    
    return data[0];
  } catch (e) {
    console.error('[SSR] getSSRCurrentCustomer error:', e);
    return null;
  }
}

// Universal error logger - logs full error in dev, returns user-friendly message
function logError(context: string, error: unknown): void {
  // Check if it's a network error for better messaging
  if (isNetworkError(error) || (error && typeof error === 'object' && Object.keys(error).length === 0)) {
    console.error(`[${context}] Network/Connection error - Check internet connectivity`);
  } else {
    console.error(`[${context}]`, error);
  }
}

// Redis cache wrapper - tries Redis first, falls back to Supabase
async function withRedisCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // Try Redis cache first
  const cached = await getCached<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch from database
  const data = await fetcher();
  
  // Store in Redis cache
  if (data !== null && data !== undefined) {
    await setCache(cacheKey, data, ttlSeconds);
  }
  
  return data;
}

// =============================================
// TYPES
// =============================================

export interface SizeVariant {
  size: string;
  price: number;
  is_available: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number;
  category_id: string;
  rating?: number;
  total_reviews?: number;
  has_variants?: boolean;
  size_variants?: SizeVariant[];
  tags?: string[];
  menu_categories?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
  is_visible: boolean;
}

export interface DealItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Deal {
  id: string;
  name: string;
  slug: string;
  description: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  image_url?: string;
  valid_from: string;
  valid_until: string;
  code?: string;
  items: DealItem[];
  is_active: boolean;
  rating?: number;
  total_reviews?: number;
  usage_count?: number;
  usage_limit?: number | null;
  is_featured?: boolean;
  created_at?: string;
}

export interface MenuData {
  categories: Category[];
  items: MenuItem[];
  deals: Deal[];
}

export interface ItemReview {
  id: string;
  customer: { name: string; initial: string };
  rating: number;
  comment: string;
  is_verified: boolean;
  created_at: string;
}

// =============================================
// AUTH HELPERS (Server-Side)
// =============================================

export async function getServerSession() {
  if (!isSupabaseConfigured) return null;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || 
                  cookieStore.get('auth_token')?.value;
    
    if (!token) return null;
    
    // First try Supabase auth (for sb-access-token)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) return user;
    
    // Fallback: Try custom JWT verification
    const decoded = await verifyToken(token);
    if (decoded && decoded.userId) {
      // Return a user-like object with the ID from JWT
      return { id: decoded.authUserId || decoded.userId, email: decoded.email };
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function getServerCustomer() {
  if (!isSupabaseConfigured) return null;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) return null;
    
    // Use JWT verification to get customer ID directly
    const decoded = await verifyToken(token);
    
    if (!decoded || !decoded.userId) return null;
    
    // userId in JWT is the customer.id from customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', decoded.userId)
      .single();
    
    return customer;
  } catch {
    return null;
  }
}

export async function getServerEmployee() {
  if (!isSupabaseConfigured) return null;
  
  try {
    const user = await getServerSession();
    if (!user) return null;
    
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();
    
    return employee;
  } catch {
    return null;
  }
}

// =============================================
// MENU QUERIES (PUBLIC - Cached)
// =============================================

// Get all menu data for landing page - HEAVILY CACHED (Redis + unstable_cache)
export const getMenuData = unstable_cache(
  async (): Promise<MenuData> => {
    // Use Redis as primary cache for runtime (reduces Supabase hits)
    return withRedisCache<MenuData>(
      'menu:data:all',
      async () => {
        if (!isSupabaseConfigured) {
          return { categories: [], items: [], deals: [] };
        }

        try {
          const [categoriesResult, itemsResult, dealsResult] = await Promise.all([
            // Categories - only visible ones
            supabase
              .from('menu_categories')
              .select('*')
              .eq('is_visible', true)
              .order('display_order'),
            
            // Menu items - only available ones WITH size variants
            supabase
              .from('menu_items')
              .select(`
                id, name, slug, description, price, images,
                is_available, is_featured, preparation_time,
                rating, total_reviews, tags, category_id,
                has_variants, size_variants,
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

          return {
            categories: (categoriesResult.data || []) as Category[],
            items: (itemsResult.data || []) as MenuItem[],
            deals: (dealsResult.data || []) as Deal[],
          };
        } catch (error) {
          console.error('Error fetching menu data:', error);
          return { categories: [], items: [], deals: [] };
        }
      },
      CACHE_DURATIONS.MENU_ITEMS // 1 hour Redis TTL
    );
  },
  ['menu-data-all'],
  {
    revalidate: 300, // 5 minutes Next.js cache
    tags: ['menu', 'categories', 'deals'],
  }
);

// Get menu categories only
export const getMenuCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_visible', true)
      .order('display_order');

    if (error) return [];
    return (data || []) as Category[];
  },
  ['menu-categories'],
  {
    revalidate: 7200, // 2 hours
    tags: ['categories'],
  }
);

// Get menu items by category
export const getMenuItemsByCategory = unstable_cache(
  async (categoryId?: string): Promise<MenuItem[]> => {
    if (!isSupabaseConfigured) return [];

    let query = supabase
      .from('menu_items')
      .select(`
        id, name, slug, description, price, images,
        is_available, is_featured, preparation_time,
        rating, total_reviews, tags, category_id,
        has_variants, size_variants,
        menu_categories(id, name, slug)
      `)
      .eq('is_available', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query
      .order('is_featured', { ascending: false })
      .order('name');

    if (error) return [];
    return (data || []) as MenuItem[];
  },
  ['menu-items'],
  {
    revalidate: 3600, // 1 hour
    tags: ['menu'],
  }
);

// Get active deals - Redis cached for public-facing performance
export const getActiveDeals = unstable_cache(
  async (): Promise<Deal[]> => {
    return withRedisCache<Deal[]>(
      CACHE_KEYS.activeDeals(),
      async () => {
        if (!isSupabaseConfigured) return [];

        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('deals')
          .select('*')
          .eq('is_active', true)
          .lte('valid_from', now)
          .gte('valid_until', now)
          .order('discount_percentage', { ascending: false });

        if (error) return [];
        return (data || []) as Deal[];
      },
      CACHE_DURATIONS.DEALS // 30 minutes Redis TTL
    );
  },
  ['active-deals'],
  {
    revalidate: 1800, // 30 minutes Next.js cache
    tags: ['deals'],
  }
);

// =============================================
// SPECIAL OFFERS QUERIES (SSR)
// =============================================

// Get active special offers for landing page
// Uses get_active_offers (same RPC as popup – confirmed working)
export const getActiveOffers = unstable_cache(
  async () => {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase.rpc('get_active_offers', {
        p_include_items: true,
        p_for_popup: false,
      });
      
      if (error) {
        console.error('Error fetching active offers:', error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('Error in getActiveOffers:', err);
      return [];
    }
  },
  ['active-offers'],
  {
    revalidate: 300, // 5 minutes cache
    tags: ['offers'],
  }
);

// Get all special offers for admin (no cache for real-time data)
export async function getAllSpecialOffers() {
  if (!isSupabaseConfigured) return { success: false, offers: [] };

  try {
    const { data, error } = await supabase.rpc('get_all_special_offers');
    
    if (error) {
      console.error('Error fetching all offers:', error);
      return { success: false, offers: [], error: error.message };
    }
    
    return data || { success: true, offers: [] };
  } catch (err: any) {
    console.error('Error in getAllSpecialOffers:', err);
    return { success: false, offers: [], error: err.message };
  }
}

// Get single offer details for edit page
export async function getOfferDetails(offerId: string) {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.rpc('get_offer_details', {
      p_offer_id: offerId,
    });
    
    if (error || !data?.success) {
      console.error('Error fetching offer details:', error || data?.error);
      return null;
    }
    
    return data.offer;
  } catch (err) {
    console.error('Error in getOfferDetails:', err);
    return null;
  }
}

// Get deals for offer selection dropdown
export async function getDealsForOffers() {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase.rpc('get_deals_for_offers');
    
    if (error || !data?.success) {
      console.error('Error fetching deals for offers:', error || data?.error);
      return [];
    }
    
    return data.deals || [];
  } catch (err) {
    console.error('Error in getDealsForOffers:', err);
    return [];
  }
}

// =============================================
// REVIEWS QUERIES
// =============================================

// Get item reviews (for menu item detail modal)
export async function getItemReviews(
  itemId: string,
  type: 'item' | 'meal' = 'item',
  limit: number = 5
): Promise<ItemReview[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const column = type === 'meal' ? 'meal_id' : 'item_id';
    
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id, rating, comment, is_verified, created_at,
        customers(name)
      `)
      .eq(column, itemId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];

    return (data || []).map((review: any) => ({
      id: review.id,
      customer: {
        name: review.customers?.name || 'Anonymous',
        initial: (review.customers?.name || 'A').charAt(0).toUpperCase(),
      },
      rating: review.rating,
      comment: review.comment,
      is_verified: review.is_verified,
      created_at: review.created_at,
    }));
  } catch {
    return [];
  }
}

// Get visible reviews for landing page
export const getVisibleReviews = unstable_cache(
  async (limit: number = 10) => {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('reviews')
      .select('*, customers(name)')
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },
  ['visible-reviews'],
  {
    revalidate: 3600,
    tags: ['reviews'],
  }
);

// =============================================
// CUSTOMER QUERIES (Require Auth)
// =============================================

// Get customer orders with pagination (RPC with params)
export async function getCustomerOrdersServer(
  customerId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: string | null;
  } = {}
) {
  if (!isSupabaseConfigured) return { orders: [], total: 0 };

  const { limit = 50, offset = 0, status = null } = options;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_customer_orders_paginated', {
    p_customer_id: customerId,
    p_limit: limit,
    p_offset: offset,
    p_status: status,
  });

  if (error) {
    console.error('Error fetching customer orders:', error);
    return { orders: [], total: 0 };
  }

  return {
    orders: data?.orders || data || [],
    total: data?.total_count || data?.length || 0,
  };
}

// Get order details
export async function getOrderDetailsServer(orderId: string, customerId?: string) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_order_details', {
    p_order_id: orderId,
    p_customer_id: customerId || null,
  });

  if (error) {
    console.error('Error fetching order details:', error);
    return null;
  }

  return data?.[0] || null;
}

// Get customer loyalty balance
export async function getLoyaltyBalanceServer(customerId: string) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_loyalty_balance', {
    p_customer_id: customerId,
  });

  if (error) {
    console.error('Error fetching loyalty balance:', error);
    return null;
  }

  return data?.[0] || {
    total_points: 0,
    redeemable_points: 0,
    pending_points: 0,
  };
}

// Get customer favorites
export async function getCustomerFavoritesServer(customerId: string) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      id, item_type, item_id, created_at,
      menu_items(id, name, price, images, is_available),
      deals(id, name, discounted_price, image_url, is_active)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }

  return data || [];
}

// =============================================
// PORTAL QUERIES (Require Employee Auth)
// =============================================

// Get employees list
export async function getEmployeesListServer(options: {
  role?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  if (!isSupabaseConfigured) return { employees: [], total: 0 };

  const { role, status, limit = 50, offset = 0 } = options;

  let query = supabase
    .from('employees')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching employees:', error);
    return { employees: [], total: 0 };
  }

  return {
    employees: data || [],
    total: count || 0,
  };
}

// Toggle block/unblock employee (Server-side only - hidden from browser)
export async function toggleBlockEmployeeServer(
  employeeId: string,
  reason?: string
): Promise<{ 
  success: boolean; 
  action?: string;
  portal_enabled?: boolean;
  message?: string;
  error?: string 
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('toggle_block_employee', {
      p_employee_id: employeeId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('[SSR] toggle_block_employee error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to toggle employee block status' 
      };
    }

    if (!data || !data.success) {
      return { 
        success: false, 
        error: data?.error || 'Failed to toggle employee block status' 
      };
    }

    return {
      success: true,
      action: data.action,
      portal_enabled: data.portal_enabled,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[SSR] toggleBlockEmployeeServer error:', error);
    return { 
      success: false, 
      error: error.message || 'Server error while toggling employee block status' 
    };
  }
}

// Get inventory list
export async function getInventoryListServer(options: {
  category?: string;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  if (!isSupabaseConfigured) return { items: [], total: 0 };

  const { category, lowStock, limit = 100, offset = 0 } = options;

  // Get authenticated client for RPC calls
  const authClient = await getAuthenticatedClient();

  let query = supabase
    .from('inventory')
    .select('*', { count: 'exact' })
    .order('name')
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (lowStock) {
    // Get reorder level first, then use it in the filter
    const { data: reorderLevel } = await authClient.rpc('get_reorder_level');
    if (reorderLevel !== null) {
      query = query.lte('quantity', reorderLevel);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching inventory:', error);
    return { items: [], total: 0 };
  }

  return {
    items: data || [],
    total: count || 0,
  };
}

// Get hourly sales today
export async function getHourlySalesTodayServer() {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_hourly_sales_today');

  if (error) {
    console.error('Error fetching hourly sales:', error);
    return null;
  }

  return data;
}

// Get sales analytics
export async function getSalesAnalyticsServer(
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_sales_analytics', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_group_by: groupBy,
  });

  if (error) {
    console.error('Error fetching sales analytics:', error);
    return [];
  }

  return data || [];
}

// OLD getNotificationsServer - REMOVED (duplicate of cached version below)

// =============================================
// WAITER QUERIES
// =============================================

export async function getWaiterDashboardServer(employeeId: string) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_waiter_dashboard', {
    p_employee_id: employeeId,
  });

  if (error) {
    console.error('Error fetching waiter dashboard:', error);
    return null;
  }

  return data;
}

// OLD getDeliveryOrdersServer - REMOVED (duplicate of cached version below)

// =============================================
// MENU MANAGEMENT QUERIES (Portal)
// =============================================

export async function getMenuItemsForManagement() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      menu_categories(id, name, slug)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching menu items:', error);
    return [];
  }

  return data || [];
}

export async function getDealsForManagement() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deals:', error);
    return [];
  }

  return data || [];
}

// =============================================
// PORTAL DASHBOARD QUERIES (Server-Side)
// =============================================

export interface DashboardStats {
  total_sales: number; // Date range filtered
  total_sales_today: number;
  total_orders: number; // Date range filtered
  total_orders_today: number;
  completed_orders: number;
  cancelled_orders: number;
  pending_orders: number;
  preparing_orders: number;
  ready_orders: number;
  avg_order_value: number;
  total_tables: number;
  active_tables: number;
  active_employees: number;
  present_today: number;
  low_inventory_count: number;
  delivery_orders: number;
  online_orders: number;
  walk_in_orders: number;
  dine_in_orders: number;
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

export interface HourlySales {
  hour: number;
  hour_label?: string;
  sales: number;
  orders: number;
  avg_order_value?: number;
  is_current?: boolean;
  is_peak?: boolean;
  dine_in_sales?: number;
  online_sales?: number;
  walk_in_sales?: number;
  percentage_of_day?: number;
}

export interface HourlySalesAdvanced {
  type?: 'hourly' | 'daily';
  data?: Array<{
    hour?: number;
    date?: string;
    sales: number;
    orders: number;
  }>;
  hourly_data?: HourlySales[];  // Legacy field for backwards compatibility
  summary: {
    total_sales: number;
    total_orders: number;
    avg_order_value: number;
    peak_hour?: number | null;
    peak_hour_label?: string;
    peak_sales?: number;
    current_hour?: number;
    busiest_period?: string;
    best_day?: string;  // For daily mode
  };
  comparison: {
    yesterday_same_hour?: number;
    last_week_same_day?: number;
    growth_vs_yesterday?: number;
    previous_sales?: number;
    previous_orders?: number;
    previous_period_sales?: number;
    previous_period_orders?: number;
  };
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';
  current_order_id?: string;
  waiter_id?: string;
}

export interface PortalOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  order_type: 'dine_in' | 'online' | 'walk_in' | 'delivery';
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  payment_status?: 'pending' | 'paid' | 'failed';
  payment_method?: string;
  transaction_id?: string;
  subtotal?: number;
  discount?: number;
  delivery_fee?: number;
  tax?: number;
  total: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
  notes?: string;
  table_number?: string;
  table_details?: {
    capacity?: number;
    section?: string;
    floor?: string;
  };
  waiter?: {
    name?: string;
    id?: string;
  };
  delivery_rider?: {
    name?: string;
    id?: string;
    phone?: string;
  };
  total_items?: number;
  is_delayed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingStats {
  total_bills: number;
  total_amount: number;
  cash_amount: number;
  card_amount: number;
  online_amount: number;
  pending_bills: number;
}

// Get Admin Dashboard Stats (Server-Side) - NO CACHE for real-time order counts
export async function getAdminDashboardStatsServer(
  startDate?: string,
  endDate?: string
): Promise<DashboardStats | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_admin_dashboard_stats', {
    p_start_date: startDate || null,
    p_end_date: endDate || null
  });

  if (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }

  return data as DashboardStats;
}

// Get Hourly Sales Advanced (Server-Side) - NO CACHE for authenticated data
export async function getHourlySalesAdvancedServer(
  startDate?: string,
  endDate?: string
): Promise<HourlySalesAdvanced | null> {
  if (!isSupabaseConfigured) return null;

  // Use date-range version if dates provided, otherwise use today's data
  const rpcName = startDate && endDate ? 'get_hourly_sales' : 'get_hourly_sales_today';
  const params = startDate && endDate 
    ? { p_start_date: startDate, p_end_date: endDate }
    : {};

  const { data, error } = await (await getAuthenticatedClient()).rpc(rpcName, params);

  if (error) {
    console.error('Error fetching hourly sales:', error);
    return null;
  }

  return data as HourlySalesAdvanced;
}

// Get Tables Status (Server-Side) - NO CACHE for authenticated data
export async function getTablesStatusServer(): Promise<RestaurantTable[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_tables_status');

  if (error) {
    console.error('Error fetching tables:', error);
    return [];
  }

  return (data || []) as RestaurantTable[];
}

// Get Recent Orders (Server-Side) - NO CACHE for real-time data
export async function getRecentOrdersServer(limit: number = 10, status?: string): Promise<PortalOrder[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_orders_advanced', {
    p_limit: limit,
    p_offset: 0,
    p_status: status || null,
    p_order_type: null,
    p_start_date: null,
    p_end_date: null,
  });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  return (data?.orders || []) as PortalOrder[];
}

// OLD getBillingStatsServer and getPendingBillingOrdersServer - REMOVED (duplicates below)

// Get Kitchen Orders (Server-Side)
// Kitchen Types
export interface KitchenOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  image?: string;
}

export interface KitchenTableDetails {
  id: string;
  table_number: number;
  capacity: number;
  section?: string;
  floor: number;
  current_customers: number;
  assigned_waiter?: { id: string; name: string; phone?: string };
}

export interface KitchenOrder {
  id: string;
  order_number: string;
  order_type: 'online' | 'dine-in' | 'walk-in';
  table_number?: number;
  items: KitchenOrderItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'ready';
  notes?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  subtotal: number;
  total: number;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  kitchen_started_at?: string;
  kitchen_completed_at?: string;
  waiter?: { id: string; name: string };
  table_details?: KitchenTableDetails;
  elapsed_seconds: number;
  prep_elapsed_seconds?: number;
  total_items: number;
}

export interface KitchenStats {
  pending_count: number;
  confirmed_count: number;
  preparing_count: number;
  ready_count: number;
  total_today: number;
  completed_today: number;
  avg_prep_time_mins: number | null;
  orders_this_hour: number;
}

// Kitchen Orders Server Query (using v2 RPC) - NO CACHE for real-time data
export async function getKitchenOrdersServer(): Promise<KitchenOrder[]> {
  if (!isSupabaseConfigured) return [];

  // Try v2 RPC first
  const { data: rpcData, error: rpcError } = await (await getAuthenticatedClient()).rpc('get_kitchen_orders_v2');
  
  if (!rpcError && rpcData) {
    return rpcData as KitchenOrder[];
  }
  
  // Fallback: Direct query for kitchen orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['confirmed', 'preparing', 'ready'])
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: true });
    
  if (!fallbackError && fallbackData) {
    // Transform data to match expected format
    const transformedOrders = fallbackData.map(order => ({
      ...order,
      elapsed_seconds: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000),
      total_items: order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0,
    }));
    return transformedOrders as KitchenOrder[];
  }

  console.error('Error fetching kitchen orders:', rpcError || fallbackError);
  return [];
}

// Kitchen Stats Server Query - NO CACHE for real-time data
export async function getKitchenStatsServer(orders: KitchenOrder[] = []): Promise<KitchenStats> {
  if (!isSupabaseConfigured) {
    return {
      pending_count: 0,
      confirmed_count: 0,
      preparing_count: 0,
      ready_count: 0,
      total_today: 0,
      completed_today: 0,
      avg_prep_time_mins: null,
      orders_this_hour: 0,
    };
  }

  const { data: statsData, error: statsError } = await (await getAuthenticatedClient()).rpc('get_kitchen_stats');
  
  if (!statsError && statsData) {
    return statsData as KitchenStats;
  }
  
  // Calculate stats from orders as fallback
  const confirmedCount = orders.filter(o => o.status === 'confirmed').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  
  return {
    pending_count: 0,
    confirmed_count: confirmedCount,
    preparing_count: preparingCount,
    ready_count: readyCount,
    total_today: orders.length,
    completed_today: 0,
    avg_prep_time_mins: null,
    orders_this_hour: 0,
  };
}

// =============================================
// PORTAL ORDERS PAGE QUERIES (Server-Side)
// =============================================

export interface OrdersStats {
  total_today: number;
  pending_count: number;
  preparing_count: number;
  ready_count: number;
  completed_today: number;
  revenue_today: number;
  delayed_orders: number;
}

export interface OrdersAdvancedResponse {
  orders: PortalOrder[];
  total_count: number;
  has_more: boolean;
}

// Get Orders Stats (Server-Side) - NO CACHE for real-time data
export async function getOrdersStatsServer(): Promise<OrdersStats | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_orders_stats');

    if (error) {
      console.error('Error fetching orders stats:', error);
      return null;
    }

    return data as OrdersStats;
  } catch (err) {
    console.error('Exception fetching orders stats:', err);
    return null;
  }
}

// Get Orders Advanced (Server-Side) - NO CACHE for real-time data
export async function getOrdersAdvancedServer(
  limit: number = 50,
  filters?: {
    status?: string;
    orderType?: string;
    startDate?: string;
    endDate?: string;
    offset?: number;
  }
): Promise<OrdersAdvancedResponse> {
  if (!isSupabaseConfigured) return { orders: [], total_count: 0, has_more: false };

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_orders_advanced', {
      p_limit: limit,
      p_offset: filters?.offset || 0,
      p_status: filters?.status || null,
      p_order_type: filters?.orderType || null,
      p_start_date: filters?.startDate || null,
      p_end_date: filters?.endDate || null,
    });

    if (error) {
      console.error('Error fetching orders:', error);
      return { orders: [], total_count: 0, has_more: false };
    }

    // Filter active orders on server if needed
    let orders = (data?.orders || []) as PortalOrder[];
    if (filters?.status === 'active') {
      orders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
    }

    return {
      orders,
      total_count: data?.total_count || orders.length,
      has_more: data?.has_more || false,
    };
  } catch (err) {
    console.error('Exception fetching orders:', err);
    return { orders: [], total_count: 0, has_more: false };
  }
}

// =============================================
// PORTAL TABLES PAGE QUERIES (Server-Side)
// =============================================

// Import WaiterTable type from components for consistency
import type { WaiterTable as WaiterTableType } from '@/components/portal/tables/types';

// Get Tables for Waiter (Server-Side) - NO CACHE for authenticated data
export async function getTablesForWaiterServer(): Promise<WaiterTableType[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_tables_for_waiter');

  if (error) {
    console.error('Error fetching waiter tables:', error);
    return [];
  }

  // RPC returns { success: true, tables: [...] } structure
  if (data?.success && data?.tables) {
    return data.tables as WaiterTableType[];
  }

  return [];
}

// =============================================
// PORTAL PERKS PAGE QUERIES (Server-Side)
// =============================================

export interface PerksSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export interface CustomerLoyalty {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  points: number;
  tier: string;
  total_orders: number;
  total_spent: number;
}

export interface CustomerPromoCode {
  id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  used_count: number;
  max_uses?: number;
  expires_at?: string;
}

// Get All Perks Settings (Server-Side) - NO CACHE for authenticated data
export async function getPerksSettingsServer(): Promise<PerksSetting[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_perks_settings');

  if (error) {
    console.error('Error fetching perks settings:', error);
    return [];
  }

  return (data || []) as PerksSetting[];
}

// Get All Customers Loyalty (Server-Side) - NO CACHE for authenticated data
export async function getCustomersLoyaltyServer(limit: number = 100): Promise<CustomerLoyalty[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_customers_loyalty', { p_limit: limit });

  if (error) {
    logError('getCustomersLoyaltyServer', error);
    return [];
  }

  // RPC returns { customers: [...], total: N } - extract customers array
  const customers = data?.customers || (Array.isArray(data) ? data : []);
  return customers as CustomerLoyalty[];
}

// Get All Customer Promo Codes Admin (Server-Side) - NO CACHE for authenticated data
export async function getCustomerPromoCodesServer(limit: number = 50, offset: number = 0): Promise<CustomerPromoCode[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_customer_promo_codes_admin', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    logError('getCustomerPromoCodesServer', error);
    return [];
  }

  // RPC returns { success: true, promos: [...], total: N } - extract promos array
  const promos = data?.promos || (Array.isArray(data) ? data : []);
  return promos as CustomerPromoCode[];
}

// =============================================
// PORTAL MENU MANAGEMENT QUERIES (Server-Side)
// =============================================

export interface MenuItemAdmin {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category: string;
  category_id?: string;
  images?: string[];
  is_available: boolean;
  is_featured: boolean;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  preparation_time?: number;
  nutrition_info?: Record<string, any>;
  created_at: string;
  slug?: string;
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

export interface CategoryAdmin {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  display_order: number;
  is_visible: boolean;
}

export interface MenuManagementData {
  items: MenuItemAdmin[];
  categories: CategoryAdmin[];
  deals: Deal[];
  offers?: { offers: any[]; stats: any };
}

// Deal Form Data for Add/Edit pages
export interface DealFormData {
  categories: { id: string; name: string; slug: string }[];
  menuItems: {
    id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
    category_id: string;
    is_available: boolean;
  }[];
}

// Get Deal Form Data (Server-Side) - For add/edit deal pages
export const getDealFormDataServer = unstable_cache(
  async (): Promise<DealFormData> => {
    if (!isSupabaseConfigured) return { categories: [], menuItems: [] };

    try {
      const [catRes, itemsRes] = await Promise.all([
        supabase.from('menu_categories').select('id, name, slug').order('display_order'),
        supabase.from('menu_items').select('id, name, description, price, images, category_id, is_available').eq('is_available', true).order('name'),
      ]);

      return {
        categories: catRes.data || [],
        menuItems: itemsRes.data || [],
      };
    } catch (error) {
      logError('getDealFormDataServer', error);
      return { categories: [], menuItems: [] };
    }
  },
  ['portal-deal-form-data'],
  { revalidate: 60, tags: ['portal-deals', 'portal-menu'] }
);

// Get single deal with items (Server-Side) - For edit page - NO CACHE for authenticated data
export async function getDealByIdServer(dealId: string): Promise<Deal | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_deal_with_items', { deal_id: dealId });
    
    if (error || !data) {
      logError('getDealByIdServer', error);
      return null;
    }

    // Map the data to Deal interface
    return {
      ...data,
      discount_type: data.deal_type === 'combo' ? 'percentage' : data.deal_type,
      discount_value: data.discount_percentage,
      start_date: data.valid_from,
      end_date: data.valid_until,
      used_count: data.usage_count,
    } as Deal;
  } catch (error) {
    logError('getDealByIdServer', error);
    return null;
  }
}

// Get Menu Management Data (Server-Side) - NO CACHE for authenticated data
export async function getMenuManagementDataServer(): Promise<MenuManagementData> {
  if (!isSupabaseConfigured) return { items: [], categories: [], deals: [], offers: { offers: [], stats: {} } };

  // Get authenticated client for RPC calls
  const authClient = await getAuthenticatedClient();

  // Fetch all data in parallel using RPCs where available
  const [menuDataResult, dealsResult, offersResult] = await Promise.all([
    authClient.rpc('get_menu_management_data'),
    authClient.rpc('get_all_deals_with_items'),
    authClient.rpc('get_all_special_offers', { p_status: null, p_include_items: true }),
  ]);

  // Process menu data
  let items: MenuItemAdmin[] = [];
  let categories: CategoryAdmin[] = [];
  
  if (!menuDataResult.error && menuDataResult.data) {
    items = (menuDataResult.data.items || []) as MenuItemAdmin[];
    categories = (menuDataResult.data.categories || []) as CategoryAdmin[];
  } else {
    // Fallback to direct queries
    const [itemsRes, categoriesRes] = await Promise.all([
      supabase.from('menu_items').select('*').order('created_at', { ascending: false }),
      supabase.from('menu_categories').select('*').order('display_order'),
    ]);
    items = (itemsRes.data || []) as MenuItemAdmin[];
    categories = (categoriesRes.data || []) as CategoryAdmin[];
  }

  // Process deals data
  let deals: Deal[] = [];
  if (!dealsResult.error && dealsResult.data) {
    deals = (dealsResult.data || []).map((d: any) => ({
      ...d,
      discount_type: d.deal_type === 'combo' ? 'percentage' : d.deal_type,
      discount_value: d.discount_percentage,
      start_date: d.valid_from,
      end_date: d.valid_until,
      used_count: d.usage_count,
    })) as Deal[];
  }

  // Process offers data
  let offers = { offers: [] as any[], stats: { total: 0, active: 0, scheduled: 0, expired: 0, draft: 0 } };
  if (!offersResult.error && offersResult.data?.success) {
    offers = {
      offers: offersResult.data.offers || [],
      stats: offersResult.data.stats || { total: 0, active: 0, scheduled: 0, expired: 0, draft: 0 },
    };
  }

  return { items, categories, deals, offers };
}

// =============================================
// PORTAL EMPLOYEES QUERIES (Server-Side)
// =============================================

export interface EmployeeServer {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  portal_enabled: boolean;
  avatar_url?: string;
  hire_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface EmployeesPaginatedResponse {
  employees: EmployeeServer[];
  total_count: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Get Employees Paginated (Server-Side) - NO CACHE for authenticated data
export async function getEmployeesPaginatedServer(
  page: number = 1,
  limit: number = 100,
  search?: string,
  role?: string,
  status?: string
): Promise<EmployeesPaginatedResponse> {
  if (!isSupabaseConfigured) {
    return {
      employees: [],
      total_count: 0,
      page: 1,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_employees_paginated', {
    p_page: page,
    p_limit: limit,
    p_search: search || null,
    p_role: role || null,
    p_status: status || null,
  });

  if (error) {
    console.error('Error fetching employees:', error);
    return {
      employees: [],
      total_count: 0,
      page: 1,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };
  }

  // RPC returns an array, so we need data[0]
  const result = Array.isArray(data) ? data[0] : data;

  return {
    employees: (result?.employees || []) as EmployeeServer[],
    total_count: result?.total_count || 0,
    page: result?.page || 1,
    total_pages: result?.total_pages || 0,
    has_next: result?.has_next || false,
    has_prev: result?.has_prev || false,
  };
}

// =============================================
// PORTAL DEALS QUERIES (Server-Side)
// =============================================

export interface DealItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  item_name?: string;
  item_price?: number;
}

export interface DealServer {
  id: string;
  name: string;
  description?: string;
  code?: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  discount_percentage?: number;
  original_price?: number;
  discounted_price?: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit?: number;
  usage_count?: number;
  is_active: boolean;
  items?: DealItem[];
  image_url?: string;
  created_at: string;
  // Legacy field mappings
  discount_type?: string;
  discount_value?: number;
  start_date?: string;
  end_date?: string;
  used_count?: number;
}

// Get All Deals (Server-Side) - NO CACHE for authenticated data
export async function getDealsServer(): Promise<DealServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_deals_with_items');

  if (error) {
    console.error('Error fetching deals:', error);
    return [];
  }

  // Map to include legacy field names for backward compatibility
  return (data || []).map((d: any) => ({
    ...d,
    discount_type: d.deal_type === 'combo' ? 'percentage' : d.deal_type,
    discount_value: d.discount_percentage,
    start_date: d.valid_from,
    end_date: d.valid_until,
    used_count: d.usage_count,
  })) as DealServer[];
}

// =============================================
// PORTAL CUSTOMERS QUERIES (Server-Side)
// =============================================

export interface CustomerServer {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  is_verified: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  created_at: string;
  total_orders: number;
  total_spending: number;
  online_orders: number;
  dine_in_orders: number;
  takeaway_orders: number;
  last_order_date: string | null;
  loyalty_points: number;
  total_invoices: number;
  total_invoice_amount: number;
}

export interface CustomerStatsServer {
  total_customers: number;
  active_customers: number;
  banned_customers: number;
  verified_customers: number;
  customers_this_month: number;
  total_spending: number;
  average_order_value: number;
}

export interface CustomersDataServer {
  customers: CustomerServer[];
  stats: CustomerStatsServer | null;
}

// Get All Customers Admin (Server-Side) - NO CACHE for authenticated data
export async function getCustomersAdminServer(
  limit: number = 100,
  offset: number = 0,
  search?: string,
  filter: string = 'all'
): Promise<CustomerServer[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_customers_admin', {
      p_limit: limit,
      p_offset: offset,
      p_search: search || null,
      p_filter: filter,
    });

    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }

    return (data || []) as CustomerServer[];
  } catch (err) {
    console.error('Exception fetching customers:', err);
    return [];
  }
}

// Get Customers Stats (Server-Side) - NO CACHE for authenticated data
export async function getCustomersStatsServer(): Promise<CustomerStatsServer | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_customers_stats');

    if (error) {
      console.error('Error fetching customer stats:', error);
      return null;
    }

    return (data?.[0] || null) as CustomerStatsServer | null;
  } catch (err) {
    console.error('Exception fetching customer stats:', err);
    return null;
  }
}

// Get Customer Detail Admin (Server-Side) - NO CACHE for authenticated data
export async function getCustomerDetailAdminServer(customerId: string): Promise<any | null> {
  if (!isSupabaseConfigured || !customerId) return null;

  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_customer_detail_admin', {
      p_customer_id: customerId,
    });

    if (error) {
      console.error('Error fetching customer detail:', error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    console.error('Exception fetching customer detail:', err);
    return null;
  }
}

// =============================================
// PORTAL INVENTORY QUERIES (Server-Side)
// =============================================

// Re-export inventory types from inventory-queries for convenience
// (Functions are now defined in this file below)
export type {
  InventoryItem,
  InventorySummary,
  LowStockItem,
  InventoryAlert,
  CategoryValue,
} from './inventory-queries';


// =============================================
// PORTAL DELIVERY QUERIES (Server-Side)
// =============================================

export interface DeliveryOrderServer {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_email?: string;
  order_type: string;
  status: string;
  total: number;
  subtotal: number;
  tax?: number;
  items: any[];
  delivery_rider_id?: string;
  created_at: string;
  updated_at: string;
}

// Get Delivery Orders (Ready/Delivering) - Server-Side via RPC (no direct table access)
// NOTE: unstable_cache blocks cookies(), so we use getAuthenticatedClient() directly
// and rely on Next.js per-request caching (no stale data between users).
export async function getDeliveryOrdersServer(): Promise<DeliveryOrderServer[]> {
  if (!isSupabaseConfigured) return [];

  try {
    // Must use an authenticated client – the RPC calls get_employee_id() internally
    // and the anon client has no permission to execute it.
    const client = await getAuthenticatedClient();

    const { data, error } = await client.rpc('get_delivery_orders');

    if (error) {
      // PostgrestError properties are non-enumerable – spread them explicitly
      console.error('[delivery SSR] RPC error:', {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      });
      return [];
    }

    // RPC returns a JSON array directly (COALESCE to [])
    if (Array.isArray(data)) {
      return data as DeliveryOrderServer[];
    }

    // RPC may return { success, data: [...] } shape from newer versions
    const result = data as { success?: boolean; data?: DeliveryOrderServer[] } | null;
    return (result?.data ?? []) as DeliveryOrderServer[];
  } catch (err: any) {
    console.error('[delivery SSR] Unexpected error:', err?.message ?? err);
    return [];
  }
}

// =============================================
// PORTAL ATTENDANCE QUERIES (Server-Side)
// =============================================

export interface AttendanceStatsServer {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  total: number;
  attendance_rate: number;
}

export interface TodayAttendanceServer {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  status: string;
  employee: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
}

// Get Attendance Stats (Server-Side) - NO CACHE for authenticated data
export async function getAttendanceStatsServer(): Promise<AttendanceStatsServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_attendance_stats');

  if (error) {
    console.error('Error fetching attendance stats:', error);
    return null;
  }

  if (data?.success && data.stats) {
    return data.stats as AttendanceStatsServer;
  }

  return null;
}

// Get Today's Attendance (Server-Side) - NO CACHE for authenticated data
export async function getTodayAttendanceServer(): Promise<TodayAttendanceServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_today_attendance');

  if (error) {
    console.error('Error fetching today attendance:', error);
    return [];
  }

  if (data?.success) {
    return (data.attendance || []) as TodayAttendanceServer[];
  }

  return [];
}

// Get Attendance History (Server-Side)
export interface AttendanceHistoryServer {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  status: string;
  notes?: string;
  employee: {
    id: string;
    employee_id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
}

export async function getAttendanceHistoryServer(
  year?: number,
  month?: number,
  employeeId?: string
): Promise<AttendanceHistoryServer[]> {
  if (!isSupabaseConfigured) return [];

  const currentDate = new Date();
  const { data, error } = await (await getAuthenticatedClient()).rpc('get_attendance_history', {
    p_year: year || currentDate.getFullYear(),
    p_month: month || currentDate.getMonth() + 1,
    p_employee_id: employeeId || null
  });

  if (error) {
    console.error('Error fetching attendance history:', error);
    return [];
  }

  if (data?.success) {
    return (data.attendance || []) as AttendanceHistoryServer[];
  }

  return [];
}

// Get Attendance Summary by Employee (Server-Side)
export interface AttendanceSummaryServer {
  employee: {
    id: string;
    employee_id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  present_days: number;
  late_days: number;
  absent_days: number;
  leave_days: number;
  half_days: number;
  total_hours: number;
}

export async function getAttendanceSummaryServer(
  year?: number,
  month?: number
): Promise<AttendanceSummaryServer[]> {
  if (!isSupabaseConfigured) return [];

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return empty (expected for unauthenticated users)
    return [];
  }

  const currentDate = new Date();
  const { data, error } = await (await getAuthenticatedClient()).rpc('get_attendance_summary_by_employee', {
    p_caller_id: employee.id,
    p_year: year || currentDate.getFullYear(),
    p_month: month || currentDate.getMonth() + 1
  });

  if (error) {
    console.error('Error fetching attendance summary:', error);
    return [];
  }

  if (data?.success) {
    return (data.summary || []) as AttendanceSummaryServer[];
  }

  return [];
}

// Get Absent Employees Today (Server-Side)
export interface AbsentEmployeeServer {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar_url?: string;
  hired_date?: string;
}

export async function getAbsentEmployeesTodayServer(): Promise<AbsentEmployeeServer[]> {
  if (!isSupabaseConfigured) return [];

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return empty (expected for unauthenticated users)
    return [];
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_absent_employees_today', {
    p_caller_id: employee.id
  });

  if (error) {
    console.error('Error fetching absent employees:', error);
    return [];
  }

  if (data?.success) {
    return (data.absent_employees || []) as AbsentEmployeeServer[];
  }

  return [];
}

// =============================================
// PORTAL LEAVE MANAGEMENT QUERIES (Server-Side)
// =============================================

export interface LeaveRequestServer {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  employee?: {
    id: string;
    employee_id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar_url?: string;
  };
  reviewer?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface LeaveBalanceServer {
  annual: { total: number; used: number; available: number };
  sick: { total: number; used: number; available: number };
  casual: { total: number; used: number; available: number };
  year: number;
}

// Get All Leave Requests (Admin/Manager)
export async function getAllLeaveRequestsServer(
  status?: string,
  year?: number,
  month?: number
): Promise<LeaveRequestServer[]> {
  if (!isSupabaseConfigured) return [];

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return empty (expected for unauthenticated users)
    return [];
  }

  const currentDate = new Date();
  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_leave_requests', {
    p_caller_id: employee.id,
    p_status: status || null,
    p_year: year || currentDate.getFullYear(),
    p_month: month || null
  });

  if (error) {
    console.error('Error fetching leave requests:', error);
    return [];
  }

  if (data?.success) {
    return (data.requests || []) as LeaveRequestServer[];
  }

  return [];
}

// Get My Leave Requests (Employee)
export async function getMyLeaveRequestsServer(
  year?: number
): Promise<LeaveRequestServer[]> {
  if (!isSupabaseConfigured) return [];

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return empty (expected for unauthenticated users)
    return [];
  }

  const currentDate = new Date();
  const { data, error } = await (await getAuthenticatedClient()).rpc('get_my_leave_requests', {
    p_employee_id: employee.id,
    p_year: year || currentDate.getFullYear(),
    p_limit: 50
  });

  if (error) {
    console.error('Error fetching my leave requests:', error);
    return [];
  }

  if (data?.success) {
    return (data.requests || []) as LeaveRequestServer[];
  }

  return [];
}

// Get Leave Balance (Employee)
export async function getLeaveBalanceServer(): Promise<LeaveBalanceServer | null> {
  if (!isSupabaseConfigured) return null;

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return null (expected for unauthenticated users)
    return null;
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_leave_balance', {
    p_employee_id: employee.id
  });

  if (error) {
    console.error('Error fetching leave balance:', error);
    return null;
  }

  if (data?.success) {
    return data.balance as LeaveBalanceServer;
  }

  return null;
}

// Get Employee Leave Details (Admin/Manager)
export interface EmployeeLeaveDetailsServer {
  employee: {
    id: string;
    employee_id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  balance: LeaveBalanceServer;
  requests: LeaveRequestServer[];
}

export async function getEmployeeLeaveDetailsServer(
  employeeId: string
): Promise<EmployeeLeaveDetailsServer | null> {
  if (!isSupabaseConfigured) return null;

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return null (expected for unauthenticated users)
    return null;
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_employee_leave_details', {
    p_caller_id: employee.id,
    p_employee_id: employeeId
  });

  if (error) {
    console.error('Error fetching employee leave details:', error);
    return null;
  }

  if (data?.success) {
    return {
      employee: data.employee,
      balance: data.balance,
      requests: data.requests || []
    } as EmployeeLeaveDetailsServer;
  }

  return null;
}

// Get Pending Leave Count (Admin/Manager)
export async function getPendingLeaveCountServer(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  // Get employee ID from session for SSR authentication
  const employee = await getServerEmployee();
  if (!employee?.id) {
    // Not authenticated - return 0 (expected for unauthenticated users)
    return 0;
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_pending_leave_count', {
    p_caller_id: employee.id
  });

  if (error) {
    console.error('Error fetching pending leave count:', error);
    return 0;
  }

  if (data?.success) {
    return data.pending_count || 0;
  }

  return 0;
}

// =============================================
// PORTAL BILLING QUERIES (Server-Side)
// =============================================

export interface BillingStatsServer {
  success: boolean;
  pending_orders: number;
  pending_count: number;
  cash_today: number;
  card_today: number;
  online_today: number;
  today?: {
    cash_revenue: number;
    card_revenue: number;
    online_revenue: number;
    total_revenue: number;
    orders_count: number;
  };
}

export interface BillableOrderServer {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  order_type: string;
  status: string;
  total: number;
  subtotal: number;
  table_number?: string;
  is_registered_customer: boolean;
  items: any[];
  created_at: string;
}

// Get Billing Dashboard Stats (Server-Side) - NO CACHE for real-time data
export async function getBillingStatsServer(): Promise<BillingStatsServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_billing_dashboard_stats');

  if (error) {
    console.error('Error fetching billing stats:', error);
    return null;
  }

  if (data?.success) {
    return {
      ...data,
      pending_count: data.pending_orders || 0,
      cash_today: data.today?.cash_revenue || 0,
      card_today: data.today?.card_revenue || 0,
      online_today: data.today?.online_revenue || 0,
    } as BillingStatsServer;
  }

  return null;
}

// Get Billing Pending Orders (Server-Side) - NO CACHE for real-time data
export async function getBillingPendingOrdersServer(limit: number = 5): Promise<{ orders: BillableOrderServer[]; pendingCount: number; onlineOrdersCount: number }> {
  if (!isSupabaseConfigured) return { orders: [], pendingCount: 0, onlineOrdersCount: 0 };

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_billing_pending_orders', {
    p_limit: limit,
  });

  if (error) {
    logError('getBillingPendingOrdersServer', error);
    return { orders: [], pendingCount: 0, onlineOrdersCount: 0 };
  }

  if (data?.success) {
    return {
      orders: (data.orders || []) as BillableOrderServer[],
      pendingCount: data.pending_count || 0,
      onlineOrdersCount: data.online_orders_count || 0,
    };
  }

  return { orders: [], pendingCount: 0, onlineOrdersCount: 0 };
}

// Invoice Server Types
export interface InvoiceServer {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  payment_reference?: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  order_type?: string;
  created_at: string;
  voided_at?: string;
}

// Get Recent Invoices (Server-Side) - NO CACHE for authenticated data
export async function getRecentInvoicesServer(dateFilter: string = 'today', paymentFilter: string = 'all'): Promise<InvoiceServer[]> {
  if (!isSupabaseConfigured) return [];

  // Calculate date range based on filter
  let startDate = new Date();
  let endDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  switch (dateFilter) {
    case 'today':
      // Default - already set
      break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'all':
      startDate = new Date('2020-01-01');
      break;
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_recent_invoices', {
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_payment_method: paymentFilter === 'all' ? null : paymentFilter,
    p_limit: 100,
  });

  if (error) {
    console.error('Error fetching recent invoices:', error);
    return [];
  }

  return (data || []) as InvoiceServer[];
}

// Get Billable Orders (Server-Side) - NO CACHE for authenticated data
export async function getBillableOrdersServer(orderTypeFilter: string = 'all', statusFilter: string = 'pending_bill'): Promise<BillableOrderServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_billable_orders', {
    p_order_type: orderTypeFilter === 'all' ? null : orderTypeFilter,
    p_status_filter: statusFilter,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    console.error('Error fetching billable orders:', error);
    return [];
  }

  if (data?.success) {
    return (data.orders || []) as BillableOrderServer[];
  }

  return [];
}

// =============================================
// REVIEWS SERVER TYPES
// =============================================

export interface AdminReviewCustomerServer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  member_since: string;
}

export interface AdminReviewItemServer {
  id: string;
  name: string;
  category: string | null;
  image: string | null;
}

export interface AdminReviewMealServer {
  id: string;
  name: string;
  image: string | null;
}

export interface AdminReviewOrderServer {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status: string;
}

export interface AdminReviewAdvancedServer {
  id: string;
  rating: number;
  comment: string | null;
  review_type: string;
  images: string[];
  is_verified: boolean;
  is_visible: boolean;
  helpful_count: number;
  admin_reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  created_at: string;
  updated_at: string;
  order_id: string | null;
  customer: AdminReviewCustomerServer;
  item: AdminReviewItemServer | null;
  meal: AdminReviewMealServer | null;
  order: AdminReviewOrderServer | null;
}

export interface AdminReviewsResponseServer {
  success: boolean;
  error?: string;
  reviews: AdminReviewAdvancedServer[];
  total_count: number;
  has_more: boolean;
}

export interface AllReviewStatsServer {
  success: boolean;
  error?: string;
  total_reviews: number;
  visible_reviews: number;
  hidden_reviews: number;
  verified_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  pending_replies: number;
  total_replied: number;
  this_week: number;
  this_month: number;
  today: number;
  most_helpful: number;
  avg_helpful: number;
  by_type: Record<string, number>;
  recent_avg_rating: number;
  previous_avg_rating: number;
}

export type ReviewStatusFilterServer = 'all' | 'visible' | 'hidden' | 'pending_reply' | 'replied' | 'verified';
export type ReviewSortByServer = 'recent' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful';

export interface AdminReviewFiltersServer {
  status?: ReviewStatusFilterServer;
  minRating?: number;
  maxRating?: number;
  hasReply?: boolean | null;
  sortBy?: ReviewSortByServer;
  limit?: number;
  offset?: number;
}

// Get Admin Reviews Advanced (Server-Side) - NO CACHE for authenticated data
export async function getAdminReviewsAdvancedServer(filters?: AdminReviewFiltersServer): Promise<AdminReviewsResponseServer> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured', reviews: [], total_count: 0, has_more: false };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_admin_reviews_advanced', {
    p_status: filters?.status || null,
    p_min_rating: filters?.minRating || null,
    p_max_rating: filters?.maxRating || null,
    p_has_reply: filters?.hasReply ?? null,
    p_sort_by: filters?.sortBy || 'recent',
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    console.error('Error fetching admin reviews:', error);
    return { success: false, error: error.message, reviews: [], total_count: 0, has_more: false };
  }

  return data as AdminReviewsResponseServer;
}

// Get All Review Stats (Server-Side) - NO CACHE for authenticated data
export async function getAllReviewStatsServer(): Promise<AllReviewStatsServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_review_stats');

  if (error) {
    console.error('Error fetching review stats:', error);
    return null;
  }

  return data as AllReviewStatsServer;
}

// =============================================
// PAYROLL SERVER TYPES (v3 - Advanced)
// =============================================

export interface PayslipEmployeeServer {
  id: string;
  name: string;
  role: string;
  employee_id: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
}

export interface PayslipServer {
  id: string;
  employee_id: string;
  employee?: PayslipEmployeeServer;
  period_start: string;
  period_end: string;
  base_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  bonuses: number;
  deductions: number;
  tax_amount: number;
  net_salary: number;
  status: 'pending' | 'approved' | 'paid';
  payment_method?: string;
  paid_at?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface PayrollDashboardServer {
  total_payroll: number;
  total_paid: number;
  pending_count: number;
  pending_amount: number;
  paid_this_month: number;
  paid_last_month: number;
  total_employees: number;
  total_salary_budget: number;
  payslips_this_month: number;
  avg_salary: number;
}

export interface PayrollEmployeeServer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  employee_id: string;
  salary: number | null;
  hired_date: string | null;
  avatar_url: string | null;
  bank_details: Record<string, any> | null;
  address: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  emergency_contact_name: string | null;
  created_at: string;
  latest_payroll: {
    id: string;
    base_salary: number;
    payment_frequency: string;
    bank_details: Record<string, any>;
    month: number;
    year: number;
    bonus: number;
    deductions: number;
    tips: number;
    total_amount: number;
    paid: boolean;
  } | null;
  total_payslips: number;
  pending_payslips: number;
  total_paid_amount: number;
}

export interface PayslipDetailServer {
  payslip: {
    id: string;
    period_start: string;
    period_end: string;
    base_salary: number;
    overtime_hours: number;
    overtime_rate: number;
    bonuses: number;
    deductions: number;
    tax_amount: number;
    net_salary: number;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    notes: string | null;
    created_at: string;
    created_by_name: string | null;
  };
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    employee_id: string;
    hired_date: string | null;
    salary: number | null;
    bank_details: Record<string, any> | null;
    avatar_url: string | null;
    address: string | null;
    date_of_birth: string | null;
    blood_group: string | null;
  };
  company: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    ntn: string;
    logo_url: string;
  };
}

export interface PayslipsPaginatedServer {
  payslips: PayslipServer[];
  total_count: number;
  page: number;
  total_pages: number;
}

// Get Payroll Dashboard (Server-Side)
export async function getPayrollDashboardServer(): Promise<PayrollDashboardServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_payroll_dashboard');

  if (error) {
    console.error('Error fetching payroll dashboard:', error);
    return null;
  }

  return data as PayrollDashboardServer;
}

// Get Employees with Payroll Info (Server-Side)
export async function getEmployeesPayrollListServer(): Promise<PayrollEmployeeServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_employees_payroll_list');

  if (error) {
    console.error('Error fetching employees payroll list:', error);
    return [];
  }

  return (data || []) as PayrollEmployeeServer[];
}

// Get Payslips Advanced (Server-Side) with pagination
export async function getPayslipsServer(filters?: {
  employeeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PayslipsPaginatedServer> {
  if (!isSupabaseConfigured) return { payslips: [], total_count: 0, page: 1, total_pages: 0 };

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_payslips_advanced', {
    p_employee_id: filters?.employeeId || null,
    p_status: filters?.status || null,
    p_start_date: filters?.startDate || null,
    p_end_date: filters?.endDate || null,
    p_search: filters?.search || null,
    p_page: filters?.page || 1,
    p_limit: filters?.limit || 50,
  });

  if (error) {
    console.error('Error fetching payslips:', error);
    return { payslips: [], total_count: 0, page: 1, total_pages: 0 };
  }

  return (data || { payslips: [], total_count: 0, page: 1, total_pages: 0 }) as PayslipsPaginatedServer;
}

// Get Payslip Detail for PDF (Server-Side)
export async function getPayslipDetailServer(payslipId: string): Promise<PayslipDetailServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_payslip_detail', {
    p_payslip_id: payslipId,
  });

  if (error) {
    console.error('Error fetching payslip detail:', error);
    return null;
  }

  return data as PayslipDetailServer;
}

// =============================================
// AUDIT LOGS SERVER TYPES
// =============================================

export interface AuditLogEmployeeServer {
  id: string;
  name: string;
  role: string;
}

export interface AuditLogServer {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  employee: AuditLogEmployeeServer;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Get Audit Logs (Server-Side) - NO CACHE for authenticated data
export async function getAuditLogsServer(filters?: {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  actionType?: string;
  limit?: number;
}): Promise<AuditLogServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_audit_logs', {
    p_start_date: filters?.startDate,
    p_end_date: filters?.endDate,
    p_employee_id: filters?.employeeId,
    p_action_type: filters?.actionType,
    p_limit: filters?.limit || 100,
  });

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }

  return (data || []) as AuditLogServer[];
}

// =============================================
// NOTIFICATIONS SERVER TYPES
// =============================================

export interface PortalNotificationServer {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

// Get Notifications (Server-Side) - NO CACHE for authenticated data
export async function getNotificationsServer(filters?: {
  userId?: string;
  userType?: 'employee' | 'customer';
  isRead?: boolean;
  limit?: number;
}): Promise<PortalNotificationServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_notifications', {
    p_user_id: filters?.userId,
    p_user_type: filters?.userType || 'employee',
    p_is_read: filters?.isRead,
    p_limit: filters?.limit || 50,
  });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return (data || []) as PortalNotificationServer[];
}

// Get Unread Notification Count (Server-Side) - NO CACHE for authenticated data
export async function getUnreadNotificationCountServer(userType: 'employee' | 'customer' = 'employee'): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_unread_notification_count', {
    p_user_type: userType,
  });

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return data?.count || 0;
}

// =============================================
// REPORTS SERVER TYPES & QUERIES
// =============================================

export interface SalesAnalyticsServer {
  date: string;
  total_sales: number;
  order_count: number;
  avg_order_value: number;
}

export interface CategorySalesServer {
  category_id: string;
  category: string;
  total_sales: number;
  order_count: number;
  items_sold: number;
}

export interface EmployeePerformanceServer {
  employee_id: string;
  employee_name: string;
  role: string;
  orders_handled: number;
  total_sales: number;
  attendance_rate: number;
}

export interface InventoryReportServer {
  total_items: number;
  low_stock_count: number;
  out_of_stock: number;
  total_value: number;
  categories: {
    category: string;
    item_count: number;
    total_value: number;
    low_stock: number;
  }[];
  low_stock_items: {
    id: string;
    name: string;
    quantity: number;
    min_quantity: number;
    unit: string;
  }[];
}

// Get Sales Analytics (Server-Side) - NO CACHE for authenticated data
export async function getSalesAnalyticsServerCached(startDate: string, endDate: string, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<SalesAnalyticsServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_sales_analytics', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_group_by: groupBy,
  });

  if (error) {
    console.error('Error fetching sales analytics:', error);
    return [];
  }

  return (data || []) as SalesAnalyticsServer[];
}

// Get Category Sales Report (Server-Side) - NO CACHE for authenticated data
export async function getCategorySalesReportServer(startDate?: string, endDate?: string): Promise<CategorySalesServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_category_sales_report_v2', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error('Error fetching category sales:', error);
    return [];
  }

  return (data || []) as CategorySalesServer[];
}

// Get Employee Performance Report (Server-Side) - NO CACHE for authenticated data
export async function getEmployeePerformanceReportServer(startDate?: string, endDate?: string): Promise<EmployeePerformanceServer[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_employee_performance_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error('Error fetching employee performance:', error);
    return [];
  }

  return (data || []) as EmployeePerformanceServer[];
}

// Get Inventory Report (Server-Side) - NO CACHE for authenticated data
export async function getInventoryReportServer(): Promise<InventoryReportServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_report');

  if (error) {
    console.error('Error fetching inventory report:', error);
    return null;
  }

  return data as InventoryReportServer;
}

// =============================================
// ORDER CREATION SERVER QUERIES
// =============================================

export interface OrderCreationDataServer {
  items: {
    id: string;
    name: string;
    description: string;
    price: number;
    category_name: string;
    image_url?: string;
    is_available: boolean;
    variants?: { name: string; price: number }[];
  }[];
  categories: { id: string; name: string }[];
  tables: { id: string; table_number: number; capacity: number; status: string }[];
}

// Get Order Creation Data (Server-Side) - NO CACHE for authenticated data
export async function getOrderCreationDataServer(): Promise<OrderCreationDataServer | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_order_creation_data');

  if (error) {
    console.error('Error fetching order creation data:', error);
    return null;
  }

  if (data?.success) {
    return {
      items: data.items || [],
      categories: data.categories || [],
      tables: data.tables || [],
    };
  }

  return null;
}

// =============================================
// PUBLIC REVIEWS SERVER QUERIES
// =============================================

export interface PublicReviewServer {
  id: string;
  customer: {
    name: string;
    initial: string;
  };
  rating: number;
  comment: string;
  review_type: string;
  images: string[];
  is_verified: boolean;
  helpful_count: number;
  item?: { id: string; name: string; image?: string } | null;
  meal?: { id: string; name: string; image?: string } | null;
  admin_reply?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export interface ReviewStatsServer {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export interface PublicReviewsResponseServer {
  reviews: PublicReviewServer[];
  stats: ReviewStatsServer;
  has_more: boolean;
}

// Get Public Reviews (Server-Side)
export const getPublicReviewsServer = unstable_cache(
  async (options?: {
    limit?: number;
    offset?: number;
    sort?: string;
    minRating?: number;
    type?: string;
  }): Promise<PublicReviewsResponseServer> => {
    if (!isSupabaseConfigured) {
      return {
        reviews: [],
        stats: { total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 },
        has_more: false,
      };
    }

    // Use base supabase client for public data (no auth required, cached with unstable_cache)
    const { data, error } = await supabase.rpc('get_public_reviews', {
      p_review_type: options?.type || null,
      p_item_id: null,
      p_meal_id: null,
      p_min_rating: options?.minRating || null,
      p_limit: options?.limit || 20,
      p_offset: options?.offset || 0,
      p_sort: options?.sort || 'recent',
    });

    if (error) {
      console.error('Error fetching public reviews:', error);
      return {
        reviews: [],
        stats: { total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 },
        has_more: false,
      };
    }

    return {
      reviews: data?.reviews || [],
      stats: data?.stats || { total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 },
      has_more: data?.has_more || false,
    };
  },
  ['public-reviews'],
  { revalidate: 120, tags: ['reviews'] }
);

// =============================================
// CUSTOMER LOYALTY SERVER QUERIES
// =============================================

export interface LoyaltyDataServer {
  total_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points_to_next_tier: number;
}

export interface PromoCodeServer {
  id: string;
  code: string;
  name: string;
  description: string;
  promo_type: 'percentage' | 'fixed_amount';
  value: number;
  max_discount: number | null;
  loyalty_points_required: number;
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
  is_active: boolean;
  is_expired?: boolean;
}

export interface PointsHistoryServer {
  id: string;
  points: number;
  type: 'earned' | 'redeemed';
  description: string;
  created_at: string;
}

export interface LoyaltyPageDataServer {
  loyalty: LoyaltyDataServer | null;
  promoCodes: PromoCodeServer[];
  pointsHistory: PointsHistoryServer[];
}

// Get Loyalty Page Data (Server-Side)
export async function getLoyaltyPageDataServer(customerId: string): Promise<LoyaltyPageDataServer> {
  if (!isSupabaseConfigured || !customerId) {
    return { loyalty: null, promoCodes: [], pointsHistory: [] };
  }

  try {
    // Get authenticated client for RPC calls
    const authClient = await getAuthenticatedClient();

    // Fetch all in parallel
    const [loyaltyResult, promoResult, historyResult] = await Promise.all([
      authClient.rpc('get_loyalty_balance', { p_customer_id: customerId }),
      authClient.rpc('get_customer_promo_codes', { p_customer_id: customerId }),
      supabase
        .from('loyalty_points')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Calculate tier from balance
    const balanceData = loyaltyResult.data?.[0];
    const totalPoints = balanceData?.total_points || 0;
    
    let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
    let pointsToNext = 500 - totalPoints;

    if (totalPoints >= 3000) {
      tier = 'platinum';
      pointsToNext = 0;
    } else if (totalPoints >= 1500) {
      tier = 'gold';
      pointsToNext = 3000 - totalPoints;
    } else if (totalPoints >= 500) {
      tier = 'silver';
      pointsToNext = 1500 - totalPoints;
    }

    const loyalty: LoyaltyDataServer = {
      total_points: totalPoints,
      tier,
      points_to_next_tier: Math.max(0, pointsToNext),
    };

    const promoCodes = promoResult.data || [];
    const pointsHistory = historyResult.data || [];

    return { loyalty, promoCodes, pointsHistory };
  } catch (error) {
    console.error('Error fetching loyalty page data:', error);
    return { loyalty: null, promoCodes: [], pointsHistory: [] };
  }
}

// =============================================
// CUSTOMER PAYMENTS SERVER QUERIES
// =============================================

export interface PaymentServer {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  payment_method: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'pending_verification';
  transaction_id: string | null;
  proof_url: string | null;
  created_at: string;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    submitted_at?: string;
  } | null;
}

// Get Customer Payments (Server-Side)
export async function getCustomerPaymentsServer(customerId: string): Promise<PaymentServer[]> {
  if (!isSupabaseConfigured || !customerId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total,
        payment_method,
        payment_status,
        transaction_id,
        payment_proof_url,
        online_payment_details,
        created_at
      `)
      .eq('customer_id', customerId)
      .not('payment_status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }

    return (data || []).map((order: any) => ({
      id: order.id,
      order_id: order.id,
      order_number: order.order_number,
      amount: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      transaction_id: order.transaction_id,
      proof_url: order.payment_proof_url,
      created_at: order.created_at,
      online_payment_details: order.online_payment_details,
    }));
  } catch (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
}

// =============================================
// CUSTOMER SETTINGS SERVER QUERIES
// =============================================

export interface CustomerSettingsServer {
  name: string;
  phone: string;
  email: string;
  address: string;
  is_2fa_enabled: boolean;
}

// Get Customer Settings (Server-Side)
export async function getCustomerSettingsServer(customerId: string): Promise<CustomerSettingsServer | null> {
  if (!isSupabaseConfigured || !customerId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('name, phone, email, address, is_2fa_enabled')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching customer settings:', error);
    return null;
  }
}

// =============================================
// INVENTORY MODULE - SERVER FUNCTIONS
// =============================================
// These functions use authenticated client and run only on the server
// Types are imported from inventory-queries.ts

// =============================================
// INVENTORY ITEMS CRUD
// =============================================

/**
 * Get all inventory items with status information
 */
export async function getInventoryItems(useCache: boolean = true): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return [];

  // Check cache first
  if (useCache) {
    const cached = await getFromCache<InventoryItem[]>('inventory:items:list');
    if (cached) return cached;
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_items');

  if (error) {
    return [];
  }

  const items = (data || []) as InventoryItem[];
  
  // Cache for 5 minutes
  await setInCache('inventory:items:list', items, CACHE_DURATION.MEDIUM);

  return items;
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  itemData: CreateItemData
): Promise<{ success: boolean; id?: string; sku?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('create_inventory_item', {
    p_name: itemData.name,
    p_sku: itemData.sku,
    p_category: itemData.category,
    p_unit: itemData.unit,
    p_quantity: itemData.quantity || 0,
    p_min_quantity: itemData.min_quantity || 10,
    p_max_quantity: itemData.max_quantity || 100,
    p_cost_per_unit: itemData.cost_per_unit || 0,
    p_supplier: itemData.supplier,
    p_notes: itemData.notes,
    p_location: itemData.location,
    p_barcode: itemData.barcode,
    p_expiry_date: itemData.expiry_date,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await invalidateInventoryCache();

  return { 
    success: data?.success || false, 
    id: data?.id, 
    sku: data?.sku,
    error: data?.error 
  };
}

/**
 * Update an existing inventory item
 */
export async function updateInventoryItem(
  itemId: string,
  updates: UpdateItemData
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('update_inventory_item', {
    p_item_id: itemId,
    p_name: updates.name,
    p_sku: updates.sku,
    p_category: updates.category,
    p_unit: updates.unit,
    p_min_quantity: updates.min_quantity,
    p_max_quantity: updates.max_quantity,
    p_cost_per_unit: updates.cost_per_unit,
    p_supplier: updates.supplier,
    p_notes: updates.notes,
    p_location: updates.location,
    p_barcode: updates.barcode,
    p_expiry_date: updates.expiry_date,
    p_reorder_point: updates.reorder_point,
    p_lead_time_days: updates.lead_time_days,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await invalidateInventoryCache();

  return { success: data?.success ?? true, error: data?.error };
}

/**
 * Delete an inventory item (soft delete)
 */
export async function deleteInventoryItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('delete_inventory_item', {
    p_item_id: itemId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await invalidateInventoryCache();

  return { success: true };
}

// =============================================
// STOCK MANAGEMENT
// =============================================

/**
 * Adjust inventory stock with transaction logging
 */
export async function adjustInventoryStock(
  data: StockAdjustmentData
): Promise<{ success: boolean; new_quantity?: number; previous_quantity?: number; change?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data: result, error } = await (await getAuthenticatedClient()).rpc('adjust_inventory_stock', {
    p_item_id: data.itemId,
    p_transaction_type: data.transactionType,
    p_quantity: data.quantity,
    p_reason: data.reason,
    p_unit_cost: data.unitCost,
    p_reference_number: data.referenceNumber,
    p_batch_number: data.batchNumber,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await invalidateInventoryCache();

  return { 
    success: result?.success || false, 
    new_quantity: result?.new_quantity,
    previous_quantity: result?.previous_quantity,
    change: result?.change,
    error: result?.error,
  };
}

/**
 * Bulk update stock for inventory count
 */
export async function bulkUpdateStock(
  items: { item_id: string; quantity: number; reason?: string }[]
): Promise<{ success: boolean; updated?: number; errors?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('bulk_update_stock', {
    p_items: items,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await invalidateInventoryCache();

  return { 
    success: true, 
    updated: data?.updated,
    errors: data?.errors,
  };
}

// =============================================
// TRANSACTIONS
// =============================================

/**
 * Get inventory transactions with filters
 */
export async function getInventoryTransactions(
  filters?: TransactionFilters
): Promise<StockTransaction[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_transactions', {
    p_item_id: filters?.itemId,
    p_start_date: filters?.startDate,
    p_end_date: filters?.endDate,
    p_limit: filters?.limit || 100,
    p_transaction_type: filters?.transactionType,
  });

  if (error) {
    return [];
  }

  return (data || []) as StockTransaction[];
}

// =============================================
// REPORTS & ANALYTICS
// =============================================

/**
 * Get inventory summary/dashboard stats
 */
export async function getInventorySummary(): Promise<InventorySummary | null> {
  if (!isSupabaseConfigured) return null;

  // Check cache
  const cached = await getFromCache<InventorySummary>('inventory:summary');
  if (cached) return cached;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_summary');

  if (error) {
    return null;
  }

  // Cache for 2 minutes
  await setInCache('inventory:summary', data, CACHE_DURATION.SHORT);

  return data as InventorySummary;
}

/**
 * Get low stock items for reordering
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  if (!isSupabaseConfigured) return [];

  const cached = await getFromCache<LowStockItem[]>('inventory:low_stock');
  if (cached) return cached;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_low_stock_items');

  if (error) {
    return [];
  }

  const items = (data || []) as LowStockItem[];
  await setInCache('inventory:low_stock', items, CACHE_DURATION.SHORT);

  return items;
}

/**
 * Get inventory movement report
 */
export async function getInventoryMovementReport(
  startDate?: string,
  endDate?: string
): Promise<InventoryMovementReport | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_movement_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return null;
  }

  return data as InventoryMovementReport;
}

/**
 * Get expiring items
 */
export async function getExpiringItems(days: number = 30): Promise<ExpiringItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_expiring_items', {
    p_days: days,
  });

  if (error) {
    return [];
  }

  return (data || []) as ExpiringItem[];
}

/**
 * Get inventory value by category
 */
export async function getInventoryValueByCategory(): Promise<CategoryValue[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_value_by_category');

  if (error) {
    return [];
  }

  return (data || []) as CategoryValue[];
}

/**
 * Generate reorder suggestions
 */
export async function getReorderSuggestions(): Promise<LowStockItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('generate_reorder_suggestions');

  if (error) {
    return [];
  }

  return (data || []) as LowStockItem[];
}

// =============================================
// SUPPLIERS
// =============================================

/**
 * Get all inventory suppliers
 */
export async function getInventorySuppliers(): Promise<InventorySupplier[]> {
  if (!isSupabaseConfigured) return [];

  const cached = await getFromCache<InventorySupplier[]>('inventory:suppliers');
  if (cached) return cached;

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_suppliers');

  if (error) {
    return [];
  }

  const suppliers = (data || []) as InventorySupplier[];
  await setInCache('inventory:suppliers', suppliers, CACHE_DURATION.MEDIUM);

  return suppliers;
}

/**
 * Create a new supplier
 */
export async function createInventorySupplier(
  supplierData: Omit<InventorySupplier, 'id' | 'items_count' | 'is_active' | 'created_at'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await (await getAuthenticatedClient()).rpc('create_inventory_supplier', {
    p_name: supplierData.name,
    p_contact_person: supplierData.contact_person,
    p_email: supplierData.email,
    p_phone: supplierData.phone,
    p_address: supplierData.address,
    p_city: supplierData.city,
    p_payment_terms: supplierData.payment_terms,
    p_lead_time_days: supplierData.lead_time_days || 7,
    p_notes: supplierData.notes,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await redis.del('inventory:suppliers');

  return { success: true, id: data?.id };
}

// =============================================
// ALERTS
// =============================================

/**
 * Get inventory alerts
 */
export async function getInventoryAlerts(unreadOnly: boolean = true): Promise<InventoryAlert[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_alerts', {
    p_unread_only: unreadOnly,
  });

  if (error) {
    return [];
  }

  return (data || []) as InventoryAlert[];
}

/**
 * Mark alert as read
 */
export async function markInventoryAlertRead(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await (await getAuthenticatedClient()).rpc('mark_inventory_alert_read', {
    p_alert_id: alertId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Resolve an alert
 */
export async function resolveInventoryAlert(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await (await getAuthenticatedClient()).rpc('resolve_inventory_alert', {
    p_alert_id: alertId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// PAYROLL QUERIES (SSR) - Additional helpers
// =============================================

/**
 * Get employee payroll summary - Used by employee detail page
 */
export async function getEmployeePayrollSummaryServer(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) {
    console.error('[SSR] Supabase not configured');
    return null;
  }

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_payslip_detail', {
      p_payslip_id: employeeId, // This is a fallback; main payroll uses new RPCs
    });

    if (error) {
      console.error('[SSR] getEmployeePayrollSummaryServer error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        raw: JSON.stringify(error)
      });
      return null;
    }

    return data;
  } catch (error) {
    console.error('[SSR] getEmployeePayrollSummaryServer catch:', error);
    return null;
  }
}

// =============================================
// CACHE HELPERS
// =============================================

/**
 * Invalidate all inventory cache
 */
export async function invalidateInventoryCache(): Promise<void> {
  await Promise.all([
    redis.del('inventory:items:list'),
    redis.del('inventory:summary'),
    redis.del('inventory:low_stock'),
    redis.del('inventory:alerts'),
  ]);
}

// =============================================
// SETTINGS PAGE SSR QUERIES
// =============================================

export interface SettingsEmployeeServer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  avatar_url?: string;
  role: string;
  hired_date?: string;
  employee_id?: string;
  is_2fa_enabled?: boolean;
}

export interface WebsiteSettingsServer {
  siteName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  facebook: string;
  instagram: string;
  twitter: string;
  deliveryRadius: string;
  minOrderAmount: string;
  deliveryFee: string;
}

export interface PaymentMethodServer {
  id: string;
  method_type: 'jazzcash' | 'easypaisa' | 'bank';
  method_name: string;
  account_number: string;
  account_holder_name: string;
  bank_name: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodsStatsServer {
  total: number;
  active: number;
  inactive: number;
  jazzcash: number;
  easypaisa: number;
  bank: number;
}

/**
 * Get employee profile for settings page (SSR)
 */
export async function getEmployeeProfileServer(employeeId: string): Promise<SettingsEmployeeServer | null> {
  if (!isSupabaseConfigured || !employeeId) {
    return null;
  }

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_employee_profile_by_id', {
      p_employee_id: employeeId
    });

    if (error) {
      console.error('[SSR] getEmployeeProfileServer error:', error.message);
      return null;
    }

    if (data?.success && data?.employee) {
      return data.employee as SettingsEmployeeServer;
    }

    return null;
  } catch (error) {
    console.error('[SSR] getEmployeeProfileServer catch:', error);
    return null;
  }
}

/**
 * Get website settings (SSR)
 */
export async function getWebsiteSettingsServer(): Promise<WebsiteSettingsServer | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_website_settings_internal');

    if (error) {
      console.error('[SSR] getWebsiteSettingsServer error:', error.message);
      return null;
    }

    if (data?.settings) {
      return data.settings as WebsiteSettingsServer;
    }

    return null;
  } catch (error) {
    console.error('[SSR] getWebsiteSettingsServer catch:', error);
    return null;
  }
}

/**
 * Get payment methods (SSR)
 * Uses RPC function to bypass RLS
 */
export async function getPaymentMethodsServer(): Promise<{
  methods: PaymentMethodServer[];
  stats: PaymentMethodsStatsServer | null;
}> {
  if (!isSupabaseConfigured) {
    return { methods: [], stats: null };
  }

  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data, error } = await client.rpc('get_all_payment_methods');

    if (error) {
      console.error('[SSR] getPaymentMethodsServer RPC error:', error.message);
      return { methods: [], stats: null };
    }

    // RPC returns JSON with success, methods, stats
    const result = data as any;
    if (!result?.success) {
      console.error('[SSR] getPaymentMethodsServer RPC failed:', result?.error);
      return { methods: [], stats: null };
    }

    return {
      methods: (result.methods || []) as PaymentMethodServer[],
      stats: result.stats as PaymentMethodsStatsServer || null
    };
  } catch (error) {
    console.error('[SSR] getPaymentMethodsServer catch:', error);
    return { methods: [], stats: null };
  }
}

/**
 * Get 2FA status for an employee (SSR)
 */
export async function get2FAStatusServer(employeeId: string): Promise<{ is_enabled: boolean }> {
  if (!isSupabaseConfigured || !employeeId) {
    return { is_enabled: false };
  }

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client
      .from('employees')
      .select('is_2fa_enabled')
      .eq('id', employeeId)
      .single();

    if (error) {
      console.error('[SSR] get2FAStatusServer error:', error.message);
      return { is_enabled: false };
    }

    return { is_enabled: data?.is_2fa_enabled || false };
  } catch (error) {
    console.error('[SSR] get2FAStatusServer catch:', error);
    return { is_enabled: false };
  }
}

// =============================================
// MAINTENANCE MODE SSR QUERIES
// =============================================

export interface MaintenanceStatusServer {
  is_enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  reason_type: 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom' | null;
  custom_reason: string | null;
  estimated_end_time: string | null;
  title?: string | null;
  message?: string | null;
  show_timer?: boolean;
  show_progress?: boolean;
}

/**
 * Get maintenance mode status (SSR - public, no auth needed)
 */
export async function getMaintenanceStatusServer(): Promise<MaintenanceStatusServer> {
  if (!isSupabaseConfigured) {
    return {
      is_enabled: false,
      enabled_at: null,
      enabled_by: null,
      reason_type: null,
      custom_reason: null,
      estimated_end_time: null,
    };
  }

  try {
    // Use base client (public RPC, no auth needed)
    const { data, error } = await supabase.rpc('get_maintenance_status');

    if (error) {
      console.error('[SSR] getMaintenanceStatusServer RPC error:', error.message);
      return {
        is_enabled: false,
        enabled_at: null,
        enabled_by: null,
        reason_type: null,
        custom_reason: null,
        estimated_end_time: null,
      };
    }

    return {
      is_enabled: data?.is_enabled || false,
      enabled_at: data?.enabled_at || null,
      enabled_by: data?.enabled_by || null,
      reason_type: data?.reason_type || null,
      custom_reason: data?.custom_reason || null,
      // Map estimated_restore_time from SQL to estimated_end_time
      estimated_end_time: data?.estimated_restore_time || null,
      title: data?.title || null,
      message: data?.message || null,
      show_timer: data?.show_timer ?? true,
      show_progress: data?.show_progress ?? true,
    };
  } catch (error) {
    console.error('[SSR] getMaintenanceStatusServer catch:', error);
    return {
      is_enabled: false,
      enabled_at: null,
      enabled_by: null,
      reason_type: null,
      custom_reason: null,
      estimated_end_time: null,
    };
  }
}

// =============================================
// CONTACT MESSAGES SERVER TYPES & FUNCTIONS
// For Admin/Manager portal - SSR optimized
// =============================================

export interface ContactMessageServer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reply_message?: string;
  replied_at?: string;
  reply_sent_via?: 'email' | 'phone' | 'both';
  created_at: string;
  updated_at: string;
  replied_by?: {
    id: string;
    name: string;
    role: string;
  };
  customer?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    total_orders: number;
    is_verified: boolean;
  };
}

export interface ContactMessageStatsServer {
  total: number;
  unread: number;
  read: number;
  replied: number;
  archived: number;
  urgent: number;
  high_priority: number;
  today: number;
  this_week: number;
  avg_response_time_hours?: number;
}

export interface ContactMessagesResponseServer {
  success: boolean;
  messages: ContactMessageServer[];
  total_count: number;
  has_more: boolean;
  error?: string;
}

export interface ContactMessageFiltersServer {
  status?: 'unread' | 'read' | 'replied' | 'archived' | 'all';
  sortBy?: 'recent' | 'oldest' | 'priority';
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Get Contact Messages (Admin/Manager SSR) - optimized RPC
 */
export async function getContactMessagesServer(
  filters?: ContactMessageFiltersServer
): Promise<ContactMessagesResponseServer> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured', messages: [], total_count: 0, has_more: false };
  }

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_contact_messages_advanced', {
      p_status: filters?.status || 'all',
      p_sort_by: filters?.sortBy || 'recent',
      p_limit: filters?.limit || 50,
      p_offset: filters?.offset || 0,
      p_search: filters?.search || null,
    });

    if (error) {
      console.error('[SSR] getContactMessagesServer RPC error:', error.message);
      return { success: false, error: error.message, messages: [], total_count: 0, has_more: false };
    }

    // Handle RPC response wrapper
    const result = data as ContactMessagesResponseServer;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to fetch messages', messages: [], total_count: 0, has_more: false };
    }

    return result;
  } catch (error) {
    console.error('[SSR] getContactMessagesServer catch:', error);
    return { success: false, error: 'Server error', messages: [], total_count: 0, has_more: false };
  }
}

/**
 * Get Contact Message Stats (Admin/Manager SSR)
 */
export async function getContactMessageStatsServer(): Promise<ContactMessageStatsServer | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_contact_message_stats');

    if (error) {
      console.error('[SSR] getContactMessageStatsServer RPC error:', error.message);
      return null;
    }

    const result = data as { success: boolean; stats: ContactMessageStatsServer; error?: string };
    if (!result?.success) {
      console.error('[SSR] getContactMessageStatsServer:', result?.error);
      return null;
    }

    return result.stats;
  } catch (error) {
    console.error('[SSR] getContactMessageStatsServer catch:', error);
    return null;
  }
}

/**
 * Get Single Contact Message by ID (Admin/Manager SSR)
 */
export async function getContactMessageByIdServer(messageId: string): Promise<ContactMessageServer | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_contact_message_by_id', {
      p_message_id: messageId,
    });

    if (error) {
      console.error('[SSR] getContactMessageByIdServer RPC error:', error.message);
      return null;
    }

    const result = data as { success: boolean; message: ContactMessageServer; error?: string };
    if (!result?.success) {
      return null;
    }

    return result.message;
  } catch (error) {
    console.error('[SSR] getContactMessageByIdServer catch:', error);
    return null;
  }
}

