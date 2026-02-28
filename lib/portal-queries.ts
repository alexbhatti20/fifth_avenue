// =============================================
// ZOIRO BROAST HUB - PORTAL CLIENT-SIDE QUERIES
// =============================================
//
// ⚠️  THIS FILE IS FOR CLIENT-SIDE OPERATIONS ONLY
//
// USAGE:
// - Mutations (create, update, delete) from client components
// - Real-time data refresh after mutations
// - Auth operations (login, getCurrentEmployee)
//
// DO NOT USE FOR:
// - Initial data fetching (use server-queries.ts SSR)
// - Static data display (use server-queries.ts SSR)
//
// SSR EQUIVALENTS IN server-queries.ts:
// - getAdminDashboardStats → getAdminDashboardStatsServer
// - getSalesAnalytics → getSalesAnalyticsServer  
// - getOrdersAdvanced → getOrdersAdvancedServer
// - getEmployeesPaginated → getEmployeesPaginatedServer
// - getPayslips → getPayslipsServer
// - getPayrollSummary → getPayrollSummaryServer
// - getAdminReviewsAdvanced → getAdminReviewsAdvancedServer
// - getNotifications → getNotificationsServer
// - getCategorySalesReport → getCategorySalesReportServer
// - getAuditLogs → getAuditLogsServer
// - getDeals → getDealsServer
// - getKitchenOrders → getKitchenOrdersServer
// =============================================

import { supabase, isSupabaseConfigured } from './supabase';
import { redis, CACHE_KEYS, getFromCache, setInCache } from './redis';
import { deduplicateRequest, CACHE_KEYS as DEDUP_KEYS, clearRequestCache } from './request-dedup';
import type {
  Employee,
  DashboardStats,
  Order,
  OrderAdvanced,
  OrdersAdvancedResponse,
  OrdersStats,
  Notification,
  WaiterDashboard,
  RestaurantTable,
} from '@/types/portal';

// =============================================
// AUTHENTICATED CLIENT HELPER
// =============================================
// Returns a Supabase client with the user's JWT token for authenticated RPC calls

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Our own custom keys (set on login + TOKEN_REFRESHED)
  const lsToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
  if (lsToken) return lsToken;

  // 2. Supabase's own native session JSON — key pattern: sb-<projectRef>-auth-token
  //    Supabase v2 always writes this immediately after signInWithPassword/signInWithOAuth,
  //    before TOKEN_REFRESHED fires, so it's reliably present on fresh logins.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        if (stored?.access_token) return stored.access_token;
      }
    }
  } catch { /* ignore */ }

  // 3. Cookie fallback (non-httpOnly cookies we set at login)
  try {
    const m1 = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
    if (m1) return decodeURIComponent(m1[2]);
    const m2 = document.cookie.match(/(^| )auth_token=([^;]+)/);
    if (m2) return decodeURIComponent(m2[2]);
  } catch { /* ignore */ }

  return null;
}

// Get an authenticated client for browser-side use.
//
// IMPORTANT: always returns the singleton `supabase` instance.
// The singleton already holds the session (set during login via supabase.auth.setSession
// and kept fresh by the TOKEN_REFRESHED handler in useAuth.tsx).
//
// Do NOT call createAuthenticatedClient() here — that spawns a second GoTrueClient
// sharing the same localStorage key, which triggers the
// "Multiple GoTrueClient instances detected" warning and can cause race conditions.
export function getAuthenticatedClient() {
  return supabase;
}

/**
 * Make a Supabase RPC call using a direct REST fetch, bypassing GoTrueClient entirely.
 *
 * Why: supabase.rpc() requires the singleton to have an active session. On first mount,
 * before loadEmployee() calls setSession, the singleton has no session → 401.
 * Using fetch() directly with the token from localStorage solves this without
 * creating new GoTrueClient instances.
 */
async function rpcWithToken<T = unknown>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const token = getAuthToken();
  if (!token) return { data: null, error: { message: 'No auth token available' } };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { data: null, error: { message: `${res.status}: ${text}` } };
    }

    const data = await res.json() as T;
    return { data, error: null };
  } catch (e: unknown) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } };
  }
}

/**
 * Ensure the Supabase singleton has an active session before making an
 * authenticated RPC call. This is needed when a component mounts with SSR
 * data (so `employee` is non-null immediately) and fires an RPC before
 * PortalProvider's `loadEmployee()` has had a chance to call setSession.
 */
async function restoreSessionIfNeeded(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return; // already authenticated, nothing to do

    const token = getAuthToken();
    if (!token) return;

    // Try to extract refresh token — check localStorage keys in priority order:
    // 1. Our own key set during TOKEN_REFRESHED
    // 2. Supabase's own stored session JSON (key: sb-<projectRef>-auth-token)
    let refreshToken: string | undefined =
      localStorage.getItem('sb_refresh_token') || undefined;

    if (!refreshToken) {
      // Walk all localStorage keys looking for Supabase's own session storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          try {
            const stored = JSON.parse(localStorage.getItem(key) || '{}');
            if (stored?.refresh_token) {
              refreshToken = stored.refresh_token;
              break;
            }
          } catch { /* ignore */ }
        }
      }
    }

    const { setSupabaseSession } = await import('./supabase');
    await setSupabaseSession(token, refreshToken);
  } catch {
    // Fail silently — caller handles the 401
  }
}

// Re-export clearRequestCache for logout cleanup
export { clearRequestCache };

// =============================================
// TYPES (keep for backward compatibility)
// =============================================

export interface HourlySales {
  hour: number;
  total_orders: number;
  total_revenue: number;
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
  summary?: {
    total_sales: number;
    total_orders: number;
    avg_order_value: number;
    peak_hour?: number | null;
    peak_hour_label?: string;
    peak_sales?: number;
    current_hour?: number;
    busiest_period?: string;
    best_day?: string;
  };
  comparison?: {
    yesterday_same_hour?: number;
    last_week_same_day?: number;
    growth_vs_yesterday?: number;
    previous_sales?: number;
    previous_orders?: number;
    previous_period_sales?: number;
    previous_period_orders?: number;
  };
  peak_hour?: number;
  total_orders?: number;
  total_revenue?: number;
}

export interface DeliveryRider {
  id: string;
  name: string;
  phone: string;
  employee_id: string;
  avatar_url?: string;
  active_deliveries?: number;
  deliveries_today?: number;
}

export interface Deal {
  id: string;
  name: string;
  description?: string;
  code: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  image_url?: string;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  items: DealItem[];
  // Legacy fields for compatibility
  discount_type?: 'percentage' | 'fixed' | 'bogo';
  discount_value?: number;
  start_date?: string;
  end_date?: string;
  used_count?: number;
}

export interface DealItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Payslip {
  id: string;
  employee_id: string;
  employee?: {
    id: string;
    name: string;
    role: string;
    employee_id: string;
  };
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
  created_at: string;
}

export interface PayrollSummary {
  total_payroll: number;
  pending_count: number;
  pending_amount: number;
  paid_this_month: number;
  employees_count: number;
}

export interface AdminReview {
  id: string;
  customer_id?: string;
  menu_item_id?: string;
  order_id?: string;
  rating: number;
  comment?: string;
  is_visible: boolean;
  admin_reply?: string;
  replied_at?: string;
  replied_by?: string;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  menu_item?: {
    id: string;
    name: string;
    slug: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

// Enhanced types for admin review management
export interface AdminReviewCustomer {
  id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_verified: boolean;
  total_orders: number;
  member_since: string | null;
}

export interface AdminReviewItem {
  id: string;
  name: string;
  image: string | null;
  category: string;
  price: number;
  avg_rating: number;
  total_reviews: number;
}

export interface AdminReviewMeal {
  id: string;
  name: string;
  image: string | null;
  price: number;
  avg_rating: number;
  total_reviews: number;
}

export interface AdminReviewOrder {
  id: string;
  order_number: string;
  total: number;
  order_type: string;
  created_at: string;
}

export interface AdminReviewAdvanced {
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
  customer: AdminReviewCustomer;
  item: AdminReviewItem | null;
  meal: AdminReviewMeal | null;
  order: AdminReviewOrder | null;
}

export type ReviewStatusFilter = 'all' | 'visible' | 'hidden' | 'pending_reply' | 'replied' | 'verified';
export type ReviewSortBy = 'recent' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful';

export interface AdminReviewFilters {
  status?: ReviewStatusFilter;
  minRating?: number;
  maxRating?: number;
  hasReply?: boolean | null;
  sortBy?: ReviewSortBy;
  limit?: number;
  offset?: number;
}

export interface AdminReviewsResponse {
  success: boolean;
  error?: string;
  reviews: AdminReviewAdvanced[];
  total_count: number;
  has_more: boolean;
}

export interface AllReviewStats {
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

export interface AuditLog {
  id: string;
  user_id: string;
  user_type: 'employee' | 'customer' | 'system';
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
    role?: string;
  };
}

export interface CategorySalesData {
  category_id: string;
  category_name: string;
  total_sales: number;
  total_orders: number;
  total_items: number;
  percentage: number;
}

export interface CategorySalesReport {
  categories: CategorySalesData[];
  total_revenue: number;
  period: string;
}

export interface EmployeePerformance {
  employee_id: string;
  employee_name: string;
  role: string;
  orders_handled: number;
  total_sales: number;
  attendance_rate: number;
  total_days: number;
  present_days: number;
}

// =============================================
// CACHE KEYS
// =============================================

export const PORTAL_CACHE_KEYS = {
  DASHBOARD_STATS: 'portal:dashboard:stats',
  HOURLY_SALES: 'portal:dashboard:hourly_sales',
  TABLES_STATUS: 'portal:tables:status',
  KITCHEN_ORDERS: 'portal:kitchen:orders',
  DELIVERY_ORDERS: 'portal:delivery:orders',
  EMPLOYEES_LIST: 'portal:employees:list',
  INVENTORY_LIST: 'portal:inventory:list',
  EMPLOYEE_PROFILE: (id: string) => `portal:employee:${id}`,
  WAITER_DASHBOARD: (id: string) => `portal:waiter:dashboard:${id}`,
} as const;

// =============================================
// AUTH & SESSION (Client-side)
// =============================================

export async function getCurrentEmployee(): Promise<Employee | null> {
  if (!isSupabaseConfigured) return null;

  // Use deduplication to prevent multiple calls
  return deduplicateRequest(DEDUP_KEYS.CURRENT_EMPLOYEE, async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (process.env.NODE_ENV === 'development' && authError && authError.message !== 'Auth session missing!') {
    }
    
    if (!user) {
      return null;
    }

    const { data, error } = await getAuthenticatedClient().rpc('get_employee_by_auth_user', {
      p_auth_user_id: user.id,
    });

    if (error || !data) {
      return null;
    }

    // RPC returns {success: boolean, data: Employee} - extract the actual employee data
    const result = data as { success?: boolean; data?: Employee; error?: string };
    
    if (result.success === false || result.error) {
      return null;
    }
    
    // If data has a 'data' property, extract it; otherwise use data directly
    const employeeData = result.data || (result as unknown as Employee);
    
    return employeeData as Employee;
  }, { ttl: 5000 }); // 5 second cache
}

export async function employeeLogin(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string; requiresOTP?: boolean }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  // Check portal access via RPC
  const { data: accessCheck } = await getAuthenticatedClient().rpc('check_employee_portal_access', {
    p_email: email,
  });

  if (!accessCheck?.found) {
    return { success: false, error: 'Employee not found' };
  }

  if (!accessCheck?.portal_enabled) {
    return { success: false, error: accessCheck?.block_reason || 'Portal access is disabled for your account.' };
  }

  // Attempt Supabase auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Write access token to our custom localStorage keys immediately.
  // The TOKEN_REFRESHED event only fires on *refresh*, not initial sign-in,
  // so getAuthToken() would return null until the first refresh without this.
  // This ensures getAuthHeaders() works on settings page button clicks right away.
  if (typeof window !== 'undefined' && data.session?.access_token) {
    try {
      localStorage.setItem('sb_access_token', data.session.access_token);
      localStorage.setItem('auth_token', data.session.access_token);
      if (data.session.refresh_token) {
        localStorage.setItem('sb_refresh_token', data.session.refresh_token);
      }
    } catch { /* ignore — private browsing may refuse */ }
  }

  // Check if 2FA is required via RPC
  const { data: employee } = await getAuthenticatedClient().rpc('get_employee_for_2fa', {
    p_employee_id: data.user?.id,
  });

  if (employee?.[0]?.is_2fa_enabled) {
    return { success: true, requiresOTP: true };
  }

  return { success: true };
}

export async function activateEmployeeAccount(
  licenseId: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('activate_employee_portal', {
    p_license_id: licenseId,
    p_email: email,
    p_password: password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

// =============================================
// EMPLOYEE MUTATIONS (Client-side only)
// =============================================

export async function updateEmployee(
  employeeId: string, 
  updates: Partial<Employee>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('update_employee_complete', {
    p_employee_id: employeeId,
    p_data: updates,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && !data.success) {
    return { success: false, error: data.error || 'Failed to update employee' };
  }

  // Invalidate cache
  if (redis) {
    await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST).catch(() => {});
    await redis.del(PORTAL_CACHE_KEYS.EMPLOYEE_PROFILE(employeeId)).catch(() => {});
  }

  return { success: true };
}

export async function blockEmployee(
  employeeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('toggle_block_employee', {
    p_employee_id: employeeId,
    p_reason: reason || 'Blocked by admin',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await redis?.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST).catch(() => {});

  return data || { success: false, error: 'Unknown error' };
}

export async function activateEmployee(
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('activate_employee', {
    p_employee_id: employeeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await redis?.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST).catch(() => {});

  return data || { success: false, error: 'Unknown error' };
}

export async function deleteEmployeeCascade(
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('delete_employee_cascade', {
    p_employee_id: employeeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await redis?.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST).catch(() => {});

  return data || { success: false, error: 'Unknown error' };
}

export async function getEmployeeComplete(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) return null;

  const client = getAuthenticatedClient();
  const { data, error } = await client.rpc('get_employee_complete', {
    p_employee_id: employeeId,
  });

  if (error) {
    console.error('[getEmployeeComplete] RPC error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  // RPC returns {success: true/false, data: {...}} or {error: string}
  if (data && data.success === true && data.data) {
    return data.data;
  }
  
  // Handle error response from RPC
  if (data && data.success === false) {
    console.error('[getEmployeeComplete] RPC returned error:', data.error);
    return null;
  }
  
  // Legacy format - if data doesn't have success wrapper, return as-is
  return data;
}

export async function getEmployeePayrollSummary(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_employee_payroll_v2', {
    p_employee_id: employeeId,
  });

  if (error) {
    console.error('getEmployeePayrollSummary error:', error);
    return null;
  }

  return data;
}

// =============================================
// NOTIFICATIONS (Client-side - PortalProvider)
// =============================================

export async function getMyNotifications(
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  if (!isSupabaseConfigured) return [];

  // Use deduplication to prevent multiple calls with same params
  const cacheKey = `${DEDUP_KEYS.NOTIFICATIONS}:${limit}:${unreadOnly}`;

  return deduplicateRequest(cacheKey, async () => {
    // Use rpcWithToken — direct fetch with token from localStorage.
    // This bypasses GoTrueClient session entirely so it works even when
    // the singleton hasn't had setSession called yet (race on first mount).
    const { data, error } = await rpcWithToken<Notification[]>(
      'get_my_notifications',
      { p_limit: limit, p_unread_only: unreadOnly }
    );

    if (error) return [];
    return (data || []) as Notification[];
  }, { ttl: 3000 }); // 3 second dedup cache
}

export async function markNotificationsRead(
  notificationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  // Use rpcWithToken for the same reason as getMyNotifications
  const { error } = await rpcWithToken('mark_notifications_read', {
    p_notification_ids: notificationIds,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// =============================================
// TABLES MANAGEMENT (Client-side)
// =============================================

export async function getTablesStatus(): Promise<RestaurantTable[]> {
  if (!isSupabaseConfigured) return [];

  // Check cache
  const cached = await getFromCache<RestaurantTable[]>(PORTAL_CACHE_KEYS.TABLES_STATUS);
  if (cached) return cached;

  const { data, error } = await getAuthenticatedClient().rpc('get_tables_status');

  if (error) {
    console.error('getTablesStatus error:', error);
    return [];
  }

  // Cache for 30 seconds (tables change frequently)
  await setInCache(PORTAL_CACHE_KEYS.TABLES_STATUS, data, 30);

  return (data || []) as RestaurantTable[];
}

// =============================================
// ORDER MUTATIONS (Client-side only)
// =============================================

export async function getAvailableDeliveryRiders(): Promise<DeliveryRider[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_available_delivery_riders');

  if (error) return [];
  return data || [];
}

export async function assignDeliveryRider(
  orderId: string,
  riderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('assign_delivery_rider', {
    p_order_id: orderId,
    p_rider_id: riderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

export async function updateOrderStatusQuick(
  orderId: string,
  status: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('update_order_status_quick', {
    p_order_id: orderId,
    p_status: status,
    p_notes: notes || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

// =============================================
// DEAL MUTATIONS (Client-side only)
// =============================================

export async function getDeals(): Promise<Deal[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_all_deals_with_items');

  if (error) {
    console.error('getDeals error:', error);
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
  })) as Deal[];
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_deal_with_items', {
    p_deal_id: dealId,
  });

  if (error) {
    console.error('getDealById error:', error);
    return null;
  }

  if (!data) return null;
  
  // Map to include legacy field names for backward compatibility
  return {
    ...data,
    discount_type: data.deal_type === 'combo' ? 'percentage' : data.deal_type,
    discount_value: data.discount_percentage,
    start_date: data.valid_from,
    end_date: data.valid_until,
    used_count: data.usage_count,
  } as Deal;
}

export async function createDeal(
  dealData: {
    name: string;
    description?: string;
    code?: string;
    deal_type?: string;
    original_price?: number;
    discounted_price?: number;
    image_url?: string;
    valid_from?: string;
    valid_until?: string;
    usage_limit?: number;
    is_active?: boolean;
    items?: { id: string; quantity: number }[];
  }
): Promise<{ success: boolean; deal_id?: string; code?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('create_deal_with_items', {
    p_name: dealData.name,
    p_description: dealData.description,
    p_code: dealData.code,
    p_deal_type: dealData.deal_type || 'combo',
    p_original_price: dealData.original_price || 0,
    p_discounted_price: dealData.discounted_price || 0,
    p_image_url: dealData.image_url,
    p_valid_from: dealData.valid_from,
    p_valid_until: dealData.valid_until,
    p_usage_limit: dealData.usage_limit,
    p_is_active: dealData.is_active !== false,
    p_items: dealData.items || [],
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { 
    success: data?.success || false, 
    deal_id: data?.id, 
    code: data?.code,
    error: data?.error,
  };
}

export async function updateDeal(
  dealId: string,
  updates: {
    name?: string;
    description?: string;
    original_price?: number;
    discounted_price?: number;
    image_url?: string;
    valid_until?: string;
    usage_limit?: number;
    is_active?: boolean;
    items?: { id: string; quantity: number }[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('update_deal_with_items', {
    p_deal_id: dealId,
    p_name: updates.name,
    p_description: updates.description,
    p_original_price: updates.original_price,
    p_discounted_price: updates.discounted_price,
    p_image_url: updates.image_url,
    p_valid_until: updates.valid_until,
    p_usage_limit: updates.usage_limit,
    p_is_active: updates.is_active,
    p_items: updates.items,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function toggleDealStatus(
  dealId: string
): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('toggle_deal_active', {
    p_deal_id: dealId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

export async function deleteDeal(
  dealId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('delete_deal_cascade', {
    p_deal_id: dealId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

// =============================================
// REVIEW MUTATIONS (Client-side only)
// =============================================

export async function updateReviewVisibility(
  reviewId: string,
  isVisible: boolean,
  employeeId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  // Use employee-based RPC if employeeId provided
  if (employeeId) {
    const { data, error } = await getAuthenticatedClient().rpc('update_review_visibility_by_employee', {
      p_review_id: reviewId,
      p_is_visible: isVisible,
      p_employee_id: employeeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data || { success: true };
  }

  const { error } = await getAuthenticatedClient().rpc('update_review_visibility', {
    p_review_id: reviewId,
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function bulkUpdateReviewVisibility(
  reviewIds: string[],
  isVisible: boolean,
  employeeId?: string
): Promise<{ success: boolean; error?: string; affected_count?: number }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  if (employeeId) {
    const { data, error } = await getAuthenticatedClient().rpc('bulk_update_review_visibility_by_employee', {
      p_review_ids: reviewIds,
      p_is_visible: isVisible,
      p_employee_id: employeeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data || { success: true };
  }

  const { data, error } = await getAuthenticatedClient().rpc('bulk_update_review_visibility', {
    p_review_ids: reviewIds,
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

export async function replyToReviewAdvanced(
  reviewId: string,
  reply: string,
  employeeId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  if (employeeId) {
    const { data, error } = await getAuthenticatedClient().rpc('reply_to_review_by_employee', {
      p_review_id: reviewId,
      p_reply: reply,
      p_employee_id: employeeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data || { success: true };
  }

  const { data, error } = await getAuthenticatedClient().rpc('reply_to_review_advanced', {
    p_review_id: reviewId,
    p_reply: reply,
    p_employee_id: employeeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

export async function deleteReviewAdvanced(
  reviewId: string,
  employeeId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  if (employeeId) {
    const { data, error } = await getAuthenticatedClient().rpc('delete_review_by_employee', {
      p_review_id: reviewId,
      p_employee_id: employeeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data || { success: true };
  }

  const { data, error } = await getAuthenticatedClient().rpc('delete_review_advanced', {
    p_review_id: reviewId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

export async function setAllReviewsVisibility(
  isVisible: boolean,
  employeeId?: string
): Promise<{ success: boolean; error?: string; affected_count?: number }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('set_all_reviews_visibility', {
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: true };
}

// =============================================
// PAYROLL MUTATIONS (Client-side only)
// =============================================

export async function createPayslip(
  data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    overtimeHours?: number;
    overtimeRate?: number;
    bonuses?: number;
    deductions?: number;
    taxAmount?: number;
    notes?: string;
  }
): Promise<{ success: boolean; id?: string; netSalary?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data: result, error } = await getAuthenticatedClient().rpc('create_payslip_v2', {
    p_employee_id: data.employeeId,
    p_period_start: data.periodStart,
    p_period_end: data.periodEnd,
    p_base_salary: data.baseSalary,
    p_overtime_hours: data.overtimeHours || 0,
    p_overtime_rate: data.overtimeRate || 1.5,
    p_bonuses: data.bonuses || 0,
    p_deductions: data.deductions || 0,
    p_tax_amount: data.taxAmount || 0,
    p_notes: data.notes,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { 
    success: true, 
    id: result?.id, 
    netSalary: result?.net_salary 
  };
}

export async function updatePayslipStatus(
  payslipId: string,
  status: 'pending' | 'approved' | 'paid',
  paymentMethod?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await getAuthenticatedClient().rpc('update_payslip_status_v2', {
    p_payslip_id: payslipId,
    p_status: status,
    p_payment_method: paymentMethod,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deletePayslip(
  payslipId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('delete_payslip_v2', {
    p_payslip_id: payslipId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

// =============================================
// REPORTS (Client-side - for dynamic filtering)
// =============================================

export interface SalesAnalytics {
  date: string;
  total_sales: number;
  order_count: number;
  avg_order_value: number;
  items_sold: number;
}

export async function getSalesAnalytics(
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesAnalytics[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_sales_analytics', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_group_by: groupBy,
  });

  if (error) {
    console.error('getSalesAnalytics error:', error);
    return [];
  }

  return (data || []) as SalesAnalytics[];
}

export async function getCategorySalesReport(
  startDate: string,
  endDate: string
): Promise<CategorySales[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_category_sales_report_v2', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error('getCategorySalesReport error:', error);
    return [];
  }

  return (data || []) as CategorySales[];
}

export async function getEmployeePerformanceReport(
  startDate: string,
  endDate: string
): Promise<EmployeePerformance[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_employee_performance_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error('getEmployeePerformanceReport error:', error);
    return [];
  }

  return (data || []) as EmployeePerformance[];
}

// =============================================
// AUDIT LOGS (Client-side - for filtering)
// =============================================

export async function getAuditLogs(
  limit: number = 50,
  offset: number = 0,
  filters?: { action?: string; entity_type?: string }
): Promise<AuditLog[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_audit_logs', {
    p_limit: limit,
    p_offset: offset,
    p_action: filters?.action || null,
    p_entity_type: filters?.entity_type || null,
  });

  if (error) {
    console.error('getAuditLogs error:', error);
    return [];
  }

  return data || [];
}

// =============================================
// STORAGE (Client-side utility)
// =============================================

export async function deleteStorageFile(
  bucketName: string, 
  filePath: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('deleteStorageFile error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('deleteStorageFile error:', err);
    return false;
  }
}

// =============================================
// NOTIFICATIONS (Client-side - for filtering)
// =============================================

export interface PortalNotification {
  id: string;
  user_id: string;
  user_type: 'employee' | 'customer';
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: any;
  created_at: string;
}

export async function getNotifications(
  filters?: {
    userId?: string;
    userType?: 'employee' | 'customer';
    isRead?: boolean;
    limit?: number;
  }
): Promise<PortalNotification[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_notifications', {
    p_user_id: filters?.userId,
    p_user_type: filters?.userType || 'employee',
    p_is_read: filters?.isRead,
    p_limit: filters?.limit || 50,
  });

  if (error) {
    console.error('getNotifications error:', error);
    return [];
  }

  return (data || []) as PortalNotification[];
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await getAuthenticatedClient().rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markAllNotificationsRead(
  userType: 'employee' | 'customer' = 'employee'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await getAuthenticatedClient().rpc('mark_all_notifications_read', {
    p_user_type: userType,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getUnreadNotificationCount(
  userType: 'employee' | 'customer' = 'employee'
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { data, error } = await getAuthenticatedClient().rpc('get_unread_notification_count', {
    p_user_type: userType,
  });

  if (error) return 0;
  return data || 0;
}

// =============================================
// USEPORTAL HOOKS SUPPORT (Client-side)
// =============================================

export async function getOrders(filters?: {
  status?: string;
  limit?: number;
  orderType?: string;
}): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_all_orders', {
    p_status: filters?.status || null,
    p_limit: filters?.limit || 50,
    p_order_type: filters?.orderType || null,
  });

  if (error) return [];
  return data || [];
}

export async function getOrdersAdvanced(filters?: {
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<OrdersAdvancedResponse> {
  const emptyResponse: OrdersAdvancedResponse = { orders: [], total_count: 0, has_more: false };
  if (!isSupabaseConfigured) return emptyResponse;

  const { data, error } = await getAuthenticatedClient().rpc('get_orders_advanced', {
    p_status: filters?.status || null,
    p_order_type: filters?.orderType || null,
    p_start_date: filters?.startDate || null,
    p_end_date: filters?.endDate || null,
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    console.error('getOrdersAdvanced error:', error);
    // Fallback to basic getOrders
    const basicOrders = await getOrders({
      status: filters?.status,
      limit: filters?.limit,
    });
    return {
      orders: basicOrders as unknown as OrderAdvanced[],
      total_count: basicOrders.length,
      has_more: false,
    };
  }

  return data as OrdersAdvancedResponse;
}

export async function getOrdersStats(): Promise<OrdersStats | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_orders_stats');

  if (error) {
    console.error('getOrdersStats error:', error);
    return null;
  }

  return data as OrdersStats;
}

export async function getKitchenOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_kitchen_orders_v2');

  if (error) return [];
  return data?.orders || [];
}

export async function getWaiterDashboard(): Promise<WaiterDashboard | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_waiter_dashboard');

  if (error) return null;
  return data;
}

export async function getAllEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_all_employees');

  if (error) return [];
  return data || [];
}

// =============================================
// REPORTS (Client-side - for dynamic filtering)
// =============================================

export interface CategorySales {
  category: string;
  category_id: string;
  total_sales: number;
  order_count: number;
  items_sold: number;
}

export interface InventoryReport {
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

export async function getInventoryReport(): Promise<InventoryReport | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_inventory_report');

  if (error) {
    console.error('getInventoryReport error:', error);
    return null;
  }

  return data;
}

// =============================================
// REVIEWS (Client-side operations)
// =============================================

export async function getAdminReviewsAdvanced(
  filters?: AdminReviewFilters,
  employeeId?: string
): Promise<AdminReviewsResponse> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured', reviews: [], total_count: 0, has_more: false };
  }

  if (employeeId) {
    const { data, error } = await getAuthenticatedClient().rpc('get_admin_reviews_by_employee', {
      p_employee_id: employeeId,
      p_status: filters?.status || null,
      p_min_rating: filters?.minRating || null,
      p_max_rating: filters?.maxRating || null,
      p_limit: filters?.limit || 50,
    });

    if (error) {
      return { success: false, error: error.message, reviews: [], total_count: 0, has_more: false };
    }

    if (data?.success) {
      return {
        success: true,
        reviews: data.reviews || [],
        total_count: data.stats?.total || 0,
        has_more: false,
      };
    }
  }

  const { data, error } = await getAuthenticatedClient().rpc('get_admin_reviews_advanced', {
    p_status: filters?.status || null,
    p_min_rating: filters?.minRating || null,
    p_max_rating: filters?.maxRating || null,
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    return { success: false, error: error.message, reviews: [], total_count: 0, has_more: false };
  }

  return data || { success: false, error: 'Unknown error', reviews: [], total_count: 0, has_more: false };
}

export async function getAllReviewStats(): Promise<AllReviewStats | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_all_review_stats');

  if (error) return null;
  return data;
}

// =============================================
// PAYROLL (Client-side refresh)
// =============================================

export async function getPayslips(
  filters?: { employeeId?: string; status?: string; limit?: number }
): Promise<Payslip[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getAuthenticatedClient().rpc('get_payslips_v2', {
    p_employee_id: filters?.employeeId || null,
    p_status: filters?.status || null,
    p_limit: filters?.limit || 50,
  });

  if (error) return [];
  return data?.payslips || [];
}

export async function getPayrollSummary(
  startDate?: string,
  endDate?: string
): Promise<PayrollSummary | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getAuthenticatedClient().rpc('get_payroll_summary_v2', {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) return null;
  return data;
}

// =============================================
// ATTENDANCE & LEAVE MANAGEMENT (Client-Side Mutations)
// =============================================

/**
 * Mark attendance with code (for employees)
 */
export async function markAttendanceWithCode(code: string): Promise<{
  success: boolean;
  action?: 'check_in' | 'check_out';
  message?: string;
  attendance?: any;
  error?: string;
}> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  const { data, error } = await getAuthenticatedClient().rpc('mark_attendance_with_code', {
    p_code: code
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Generate attendance code (for admin/manager)
 */
export async function generateAttendanceCode(validMinutes: number = 5): Promise<{
  success: boolean;
  code?: string;
  valid_from?: string;
  valid_until?: string;
  expires_in_minutes?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  const { data, error } = await getAuthenticatedClient().rpc('generate_attendance_code', {
    p_valid_minutes: validMinutes
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Admin mark attendance manually
 */
export async function adminMarkAttendance(params: {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut?: string | null;
  status?: string;
  notes?: string | null;
}): Promise<{ success: boolean; message?: string; attendance?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  const { data, error } = await getAuthenticatedClient().rpc('admin_mark_attendance', {
    p_employee_id: params.employeeId,
    p_date: params.date,
    p_check_in: params.checkIn,
    p_check_out: params.checkOut || null,
    p_status: params.status || 'present',
    p_notes: params.notes || null
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Create leave request (for employees)
 */
export async function createLeaveRequest(params: {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  // Get current employee for SSR-compatible auth
  const employee = await getCurrentEmployee();
  if (!employee?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('create_leave_request', {
    p_employee_id: employee.id,
    p_leave_type: params.leaveType,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_reason: params.reason
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Review leave request (for admin/manager)
 */
export async function reviewLeaveRequest(params: {
  requestId: string;
  status: 'approved' | 'rejected';
  notes?: string | null;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  // Get current employee for SSR-compatible auth
  const employee = await getCurrentEmployee();
  if (!employee?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('review_leave_request', {
    p_caller_id: employee.id,
    p_request_id: params.requestId,
    p_status: params.status,
    p_notes: params.notes || null
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Cancel leave request (for employees)
 */
export async function cancelLeaveRequest(requestId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  // Get current employee for SSR-compatible auth
  const employee = await getCurrentEmployee();
  if (!employee?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('cancel_leave_request', {
    p_employee_id: employee.id,
    p_request_id: requestId
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

/**
 * Get leave balance (for employees)
 */
export async function getLeaveBalance(): Promise<{
  success: boolean;
  balance?: {
    annual: { total: number; used: number; available: number };
    sick: { total: number; used: number; available: number };
    casual: { total: number; used: number; available: number };
    year: number;
  };
  error?: string;
}> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  
  // Get current employee for SSR-compatible auth
  const employee = await getCurrentEmployee();
  if (!employee?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await getAuthenticatedClient().rpc('get_leave_balance', {
    p_employee_id: employee.id
  });

  if (error) return { success: false, error: error.message };
  return data || { success: false, error: 'Unknown error' };
}

// =============================================
// DEPRECATED - Use server-queries.ts instead
// =============================================

/**
 * @deprecated Use getAdminDashboardStatsServer from server-queries.ts
 */
export async function getAdminDashboardStats(): Promise<DashboardStats | null> {
  console.warn('getAdminDashboardStats is deprecated. Use getAdminDashboardStatsServer from server-queries.ts');
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getAuthenticatedClient().rpc('get_admin_dashboard_stats');
  if (error) return null;
  return data;
}

/**
 * @deprecated Use getEmployeesPaginatedServer from server-queries.ts
 */
export async function getEmployeesPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
  role?: string,
  status?: string
): Promise<{ employees: Employee[]; total: number; page: number; limit: number }> {
  console.warn('getEmployeesPaginated is deprecated. Use getEmployeesPaginatedServer from server-queries.ts');
  if (!isSupabaseConfigured) return { employees: [], total: 0, page, limit };
  
  const { data, error } = await getAuthenticatedClient().rpc('get_employees_paginated', {
    p_page: page,
    p_limit: limit,
    p_search: search || null,
    p_role: role || null,
    p_status: status || null,
  });

  if (error) return { employees: [], total: 0, page, limit };
  return data || { employees: [], total: 0, page, limit };
}

/**
 * @deprecated Use getEmployeesPaginatedServer from server-queries.ts
 */
export async function getEmployeesDashboardStats(): Promise<any> {
  console.warn('getEmployeesDashboardStats is deprecated. Use getEmployeesPaginatedServer stats from server-queries.ts');
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getAuthenticatedClient().rpc('get_employees_dashboard_stats');
  if (error) return null;
  return data;
}
