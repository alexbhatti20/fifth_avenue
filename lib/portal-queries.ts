// =============================================
// ZOIRO BROAST HUB - PORTAL API & QUERIES
// =============================================

import { supabase, isSupabaseConfigured } from './supabase';
import { redis, CACHE_KEYS, CACHE_DURATION, getFromCache, setInCache } from './redis';
import type {
  Employee,
  EmployeeRole,
  DashboardStats,
  SalesAnalytics,
  HourlySales,
  RestaurantTable,
  Order,
  OrderAdvanced,
  OrdersAdvancedResponse,
  OrdersStats,
  Invoice,
  Attendance,
  Inventory,
  Notification,
  PromoCode,
  WebsiteContent,
  WaiterDashboard,
  EmployeeFormData,
  CreateOrderData,
  GenerateInvoiceData,
} from '@/types/portal';

// =============================================
// AUTH CHECK HELPER
// =============================================

// Check if user has valid Supabase session or localStorage auth before making queries
// This prevents 401 errors on dashboard load when not authenticated
async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // First check Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    
    // Fallback: Check localStorage for portal auth (unified auth system)
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data');
      const userType = localStorage.getItem('user_type');
      if (userData && (userType === 'admin' || userType === 'employee')) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
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
// AUTH & SESSION
// =============================================

export async function getCurrentEmployee(): Promise<Employee | null> {
  if (!isSupabaseConfigured) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Skip cache - always check fresh data for portal_enabled
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error || !data) return null;

  // Return the employee data - let the caller check portal_enabled
  return data as Employee;
}

export async function employeeLogin(email: string, password: string): Promise<{ success: boolean; error?: string; requiresOTP?: boolean }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  // Check if employee exists and is active - get block reason too
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, status, portal_enabled, is_2fa_enabled, block_reason')
    .eq('email', email)
    .single();

  if (empError || !employee) {
    return { success: false, error: 'Employee not found' };
  }

  if (employee.status === 'blocked') {
    return { success: false, error: employee.block_reason || 'Your account has been blocked. Contact admin.' };
  }

  if (!employee.portal_enabled) {
    return { success: false, error: 'Portal access is disabled for your account.' };
  }

  // Attempt Supabase auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Update last login
  await supabase
    .from('employees')
    .update({ last_login: new Date().toISOString() })
    .eq('id', employee.id);

  // Check if 2FA is required
  if (employee.is_2fa_enabled) {
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

  // First create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || 'Failed to create account' };
  }

  // Activate employee account
  const { data, error } = await supabase.rpc('activate_employee_account', {
    p_license_id: licenseId,
    p_auth_user_id: authData.user.id,
  });

  if (error || !data?.success) {
    // Cleanup auth user if activation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: data?.error || 'Failed to activate account' };
  }

  return { success: true };
}

// =============================================
// DASHBOARD QUERIES
// =============================================

export async function getAdminDashboardStats(): Promise<DashboardStats | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return null;
  }

  // Check cache
  const cached = await getFromCache<DashboardStats>(PORTAL_CACHE_KEYS.DASHBOARD_STATS);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');

  if (error || !data) {
    return null;
  }

  // Cache for 1 minute (dashboard should be fairly fresh)
  await setInCache(PORTAL_CACHE_KEYS.DASHBOARD_STATS, data, CACHE_DURATION.SHORT);

  return data as DashboardStats;
}

export async function getSalesAnalytics(
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesAnalytics[]> {
  if (!isSupabaseConfigured) return [];

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_sales_analytics', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_group_by: groupBy,
  });

  if (error) {
    return [];
  }

  return (data || []) as SalesAnalytics[];
}

// Advanced hourly sales response type
export interface HourlySalesAdvanced {
  hourly_data: HourlySales[];
  summary: {
    total_sales: number;
    total_orders: number;
    avg_order_value: number;
    peak_hour: number | null;
    peak_hour_label: string;
    peak_sales: number;
    current_hour: number;
    busiest_period: string;
  };
  comparison: {
    yesterday_same_hour: number;
    last_week_same_day: number;
    growth_vs_yesterday: number;
  };
}

export async function getHourlySalesToday(): Promise<HourlySales[]> {
  if (!isSupabaseConfigured) return [];

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return [];
  }

  // Check cache
  const cached = await getFromCache<HourlySales[]>(PORTAL_CACHE_KEYS.HOURLY_SALES);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_hourly_sales_today');

  if (error) {
    return [];
  }

  // Handle advanced response format
  const hourlyData = data?.hourly_data || data || [];
  
  // Cache for 5 minutes
  await setInCache(PORTAL_CACHE_KEYS.HOURLY_SALES, hourlyData, CACHE_DURATION.MEDIUM);

  return hourlyData as HourlySales[];
}

// Get full advanced hourly sales data with summary and comparisons
export async function getHourlySalesAdvanced(): Promise<HourlySalesAdvanced | null> {
  if (!isSupabaseConfigured) return null;

  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_hourly_sales_today');

  if (error) {
    return null;
  }

  return data as HourlySalesAdvanced;
}

export async function getWaiterDashboard(): Promise<WaiterDashboard | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_waiter_dashboard');

  if (error) {
    return null;
  }

  return data as WaiterDashboard;
}

// =============================================
// EMPLOYEE MANAGEMENT
// =============================================

export async function getAllEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured) return [];

  // Check authentication before making queries
  if (!(await isAuthenticated())) {
    return [];
  }

  // Check cache first
  const cached = await getFromCache<Employee[]>(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);
  if (cached) return cached;

  // Use RPC instead of direct query
  const result = await getEmployeesPaginated(1, 500);
  const employees = result.employees || [];

  // Cache for 5 minutes
  await setInCache(PORTAL_CACHE_KEYS.EMPLOYEES_LIST, employees, CACHE_DURATION.MEDIUM);

  return employees;
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication before making queries
  if (!(await isAuthenticated())) {
    return null;
  }

  // Use RPC instead of direct query
  const data = await getEmployeeComplete(id);
  return data as Employee | null;
}

export async function createEmployee(formData: EmployeeFormData): Promise<{ success: boolean; license_id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('create_employee', {
    p_name: formData.name,
    p_email: formData.email,
    p_phone: formData.phone,
    p_role: formData.role,
    p_salary: formData.salary,
    p_hired_date: formData.hired_date,
    p_documents: formData.documents,
    p_address: formData.address,
    p_emergency_contact: formData.emergency_contact,
    p_emergency_contact_name: formData.emergency_contact_name,
    p_date_of_birth: formData.date_of_birth,
    p_blood_group: formData.blood_group,
    p_notes: formData.notes,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return { 
    success: data?.success || false, 
    license_id: data?.license_id,
    error: data?.error 
  };
}

export async function getEmployeeAnalytics(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_employee_analytics', {
    p_employee_id: employeeId,
  });

  if (error) {
    return null;
  }

  return data;
}

export async function toggleEmployeeStatus(
  employeeId: string,
  status: 'active' | 'inactive' | 'blocked'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('toggle_employee_status', {
    p_employee_id: employeeId,
    p_status: status,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return { success: true };
}

// =============================================
// ADVANCED EMPLOYEE MANAGEMENT
// =============================================

// Get paginated employees with stats
export async function getEmployeesPaginated(
  page: number = 1,
  limit: number = 20,
  search?: string,
  role?: string,
  status?: string
): Promise<{
  employees: Employee[];
  total_count: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}> {
  const emptyResponse = {
    employees: [],
    total_count: 0,
    page: 1,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  };

  if (!isSupabaseConfigured) return emptyResponse;

  if (!(await isAuthenticated())) {
    return emptyResponse;
  }

  const { data, error } = await supabase.rpc('get_employees_paginated', {
    p_page: page,
    p_limit: limit,
    p_search: search || null,
    p_role: role || null,
    p_status: status || null,
  });

  if (error) {
    return emptyResponse;
  }

  // RPC RETURNS TABLE returns an array, so we need data[0]
  const result = Array.isArray(data) ? data[0] : data;

  return {
    employees: result?.employees || [],
    total_count: result?.total_count || 0,
    page: result?.page || 1,
    total_pages: result?.total_pages || 0,
    has_next: result?.has_next || false,
    has_prev: result?.has_prev || false,
  };
}

// Get complete employee details
export async function getEmployeeComplete(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) return null;

  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_employee_complete', {
    p_employee_id: employeeId,
  });

  if (error) {
    return null;
  }

  return data?.success ? data.data : null;
}

// Get employee dashboard stats
export async function getEmployeesDashboardStats(): Promise<any> {
  if (!isSupabaseConfigured) return null;

  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_employees_dashboard_stats');

  if (error) {
    return null;
  }

  return data;
}

// Get active employee count (uses RPC data)
export async function getActiveEmployeeCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  if (!(await isAuthenticated())) {
    return 0;
  }

  // Use RPC to get stats which includes count
  const stats = await getEmployeesDashboardStats();
  return stats?.total_employees || stats?.total || 0;
}

// Block employee
export async function blockEmployee(
  employeeId: string,
  reason: string,
  blockedBy?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('block_employee', {
    p_employee_id: employeeId,
    p_reason: reason,
    p_blocked_by: blockedBy || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return data || { success: false, error: 'Unknown error' };
}

// Activate employee
export async function activateEmployee(
  employeeId: string,
  enablePortal: boolean = true,
  activatedBy?: string
): Promise<{ success: boolean; error?: string; message?: string; new_license_id?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('activate_employee', {
    p_employee_id: employeeId,
    p_enable_portal: enablePortal,
    p_activated_by: activatedBy || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return data || { success: false, error: 'Unknown error' };
}

// Toggle block/unblock employee - fast single button action
export async function toggleBlockEmployee(
  employeeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; message?: string; action?: string; portal_enabled?: boolean }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  // Get employee auth_user_id first for cache invalidation
  const { data: empData } = await supabase
    .from('employees')
    .select('auth_user_id')
    .eq('id', employeeId)
    .single();

  const { data, error } = await supabase.rpc('toggle_block_employee', {
    p_employee_id: employeeId,
    p_reason: reason || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate caches
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);
  
  // Also clear the employee's profile cache so they can't access with cached data
  if (empData?.auth_user_id) {
    await redis.del(PORTAL_CACHE_KEYS.EMPLOYEE_PROFILE(empData.auth_user_id));
  }

  return data || { success: false, error: 'Unknown error' };
}

// Delete employee cascade
export async function deleteEmployeeCascade(
  employeeId: string,
  deletedBy?: string
): Promise<{ success: boolean; error?: string; message?: string; deleted?: any }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('delete_employee_cascade', {
    p_employee_id: employeeId,
    p_deleted_by: deletedBy || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return data || { success: false, error: 'Unknown error' };
}

// Toggle portal access
export async function toggleEmployeePortal(
  employeeId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('toggle_employee_portal', {
    p_employee_id: employeeId,
    p_enabled: enabled,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.EMPLOYEES_LIST);

  return data || { success: false, error: 'Unknown error' };
}

// Get employee payroll summary
export async function getEmployeePayrollSummary(employeeId: string): Promise<any> {
  if (!isSupabaseConfigured) return null;

  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_employee_payroll_summary', {
    p_employee_id: employeeId,
  });

  if (error) {
    return null;
  }

  return data;
}

// Add employee document
export async function addEmployeeDocument(
  employeeId: string,
  documentType: string,
  documentName: string,
  fileUrl: string,
  fileType?: string
): Promise<{ success: boolean; error?: string; document_id?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('add_employee_document', {
    p_employee_id: employeeId,
    p_document_type: documentType,
    p_document_name: documentName,
    p_file_url: fileUrl,
    p_file_type: fileType || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

// Remove employee document
export async function removeEmployeeDocument(
  employeeId: string,
  documentId: string
): Promise<{ success: boolean; error?: string; file_url?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('remove_employee_document', {
    p_employee_id: employeeId,
    p_document_id: documentId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

// Delete file from Supabase storage
export async function deleteStorageFile(bucketName: string, filePath: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// =============================================
// TABLES MANAGEMENT
// =============================================

export async function getTablesStatus(): Promise<RestaurantTable[]> {
  if (!isSupabaseConfigured) return [];

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return [];
  }

  // Check cache
  const cached = await getFromCache<RestaurantTable[]>(PORTAL_CACHE_KEYS.TABLES_STATUS);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_tables_status');

  if (error) {
    return [];
  }

  // Cache for 30 seconds (tables change frequently)
  await setInCache(PORTAL_CACHE_KEYS.TABLES_STATUS, data, 30);

  return (data || []) as RestaurantTable[];
}

export async function updateTableStatus(
  tableId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('update_table_status', {
    p_table_id: tableId,
    p_status: status,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.TABLES_STATUS);

  return { success: true };
}

// =============================================
// ORDERS MANAGEMENT
// =============================================

export async function getOrders(filters?: {
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];
  
  // Check authentication before making queries
  if (!(await isAuthenticated())) {
    return [];
  }

  // Use RPC instead of direct query to avoid RLS infinite loop issues
  try {
    const { data, error } = await supabase.rpc('get_orders_advanced', {
      p_status: filters?.status || null,
      p_order_type: filters?.orderType || null,
      p_start_date: filters?.startDate || null,
      p_end_date: filters?.endDate || null,
      p_limit: filters?.limit || 10,
      p_offset: 0,
    });

    if (error) {
      return [];
    }

    // Transform RPC response to match expected Order format
    const orders = data?.orders || [];
    return orders.map((order: any) => ({
      ...order,
      items: order.items || [],
      waiter: order.waiter ? { id: order.waiter.id, name: order.waiter.name } : null,
    }));
  } catch (err) {
    return [];
  }
}

// =============================================
// ADVANCED ORDERS (RPC-based, optimized)
// =============================================

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

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return emptyResponse;
  }

  const { data, error } = await supabase.rpc('get_orders_advanced', {
    p_status: filters?.status || null,
    p_order_type: filters?.orderType || null,
    p_start_date: filters?.startDate || null,
    p_end_date: filters?.endDate || null,
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    // Fallback to basic getOrders - don't pass orderType to avoid enum errors
    const basicOrders = await getOrders({
      status: filters?.status,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: filters?.limit,
      // Note: orderType intentionally omitted to avoid invalid enum errors
    });
    return {
      orders: basicOrders as unknown as OrderAdvanced[],
      total_count: basicOrders.length,
      has_more: false,
    };
  }

  return data as OrdersAdvancedResponse;
}

export async function getOrderFullDetails(orderId: string): Promise<OrderAdvanced | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_order_full_details', {
    p_order_id: orderId,
  });

  if (error) {
    return null;
  }

  return data as OrderAdvanced;
}

export async function getOrdersStats(): Promise<OrdersStats | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_orders_stats');

  if (error) {
    return null;
  }

  return data as OrdersStats;
}

export async function updateOrderStatusQuick(
  orderId: string,
  status: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('update_order_status_quick', {
    p_order_id: orderId,
    p_status: status,
    p_notes: notes || null,
  });

  if (error) {
    // Fallback to direct update
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    return { success: true };
  }

  return data as { success: boolean; error?: string };
}

// =============================================
// DELIVERY RIDER FUNCTIONS
// =============================================

export interface DeliveryRider {
  id: string;
  name: string;
  phone: string;
  employee_id: string;
  avatar_url?: string;
  status: string;
  active_deliveries: number;
  last_delivery_at?: string;
  deliveries_today: number;
}

export async function getAvailableDeliveryRiders(): Promise<DeliveryRider[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_available_delivery_riders');

  if (error) {
    return [];
  }

  return (data || []) as DeliveryRider[];
}

export async function assignDeliveryRider(
  orderId: string,
  riderId: string
): Promise<{ success: boolean; error?: string; rider?: { id: string; name: string; phone: string } }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('assign_delivery_rider', {
    p_order_id: orderId,
    p_rider_id: riderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string; rider?: { id: string; name: string; phone: string } };
}

export async function getKitchenOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  // Check authentication before making direct queries
  if (!(await isAuthenticated())) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_kitchen_orders');

  if (error) {
    return [];
  }

  return (data || []) as Order[];
}

export async function createDineInOrder(orderData: CreateOrderData): Promise<{ success: boolean; order_id?: string; order_number?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('create_dine_in_order', {
    p_table_id: orderData.table_id,
    p_customer_count: orderData.customer_count,
    p_customer_id: orderData.customer_id,
    p_customer_name: orderData.customer_name,
    p_customer_phone: orderData.customer_phone,
    p_items: orderData.items,
    p_notes: orderData.notes,
    p_send_confirmation: orderData.send_confirmation,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate caches
  await redis.del(PORTAL_CACHE_KEYS.TABLES_STATUS);

  return { 
    success: data?.success || false,
    order_id: data?.order_id,
    order_number: data?.order_number,
    error: data?.error,
  };
}

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('cancel_order_by_waiter', {
    p_order_id: orderId,
    p_reason: reason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: data?.success || false, error: data?.error };
}

export async function updateOrderStatusKitchen(
  orderId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('update_order_status_kitchen', {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// BILLING & INVOICES
// =============================================

export async function generateInvoice(invoiceData: GenerateInvoiceData): Promise<{ success: boolean; invoice_id?: string; invoice_number?: string; total?: number; points_earned?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('generate_invoice', {
    p_order_id: invoiceData.order_id,
    p_payment_method: invoiceData.payment_method,
    p_tip: invoiceData.tip || 0,
    p_discount: invoiceData.discount || 0,
    p_promo_code: invoiceData.promo_code,
    p_loyalty_points_used: invoiceData.loyalty_points_used || 0,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate caches
  await redis.del(PORTAL_CACHE_KEYS.TABLES_STATUS);
  await redis.del(PORTAL_CACHE_KEYS.DASHBOARD_STATS);

  return {
    success: data?.success || false,
    invoice_id: data?.invoice_id,
    invoice_number: data?.invoice_number,
    total: data?.total,
    points_earned: data?.points_earned,
    error: data?.error,
  };
}

export async function getInvoices(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
}): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters?.status) {
    query = query.eq('payment_status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data as Invoice[];
}

export async function validatePromoCode(
  code: string,
  customerId?: string,
  orderAmount?: number
): Promise<{ valid: boolean; promo?: any; error?: string }> {
  if (!isSupabaseConfigured) {
    return { valid: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: code,
    p_customer_id: customerId,
    p_order_amount: orderAmount || 0,
  });

  if (error) {
    return { valid: false, error: error.message };
  }

  return data;
}

// =============================================
// ATTENDANCE
// =============================================

export async function markAttendanceWithCode(code: string): Promise<{ success: boolean; action?: 'check_in' | 'check_out'; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('mark_attendance_with_code', {
    p_code: code,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { 
    success: data?.success || false,
    action: data?.action,
    error: data?.error,
  };
}

export async function generateAttendanceCode(
  validFrom: string,
  validUntil: string
): Promise<{ success: boolean; code?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('generate_attendance_code', {
    p_valid_from: validFrom,
    p_valid_until: validUntil,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { 
    success: data?.success || false,
    code: data?.code,
    error: data?.error,
  };
}

export async function getAttendanceRecords(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Attendance[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('attendance')
    .select('*, employee:employees(id, name, role)')
    .order('date', { ascending: false });

  if (filters?.employeeId) {
    query = query.eq('employee_id', filters.employeeId);
  }
  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data as Attendance[];
}

// =============================================
// NOTIFICATIONS
// =============================================

export async function getMyNotifications(
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_my_notifications', {
    p_limit: limit,
    p_unread_only: unreadOnly,
  });

  if (error) {
    return [];
  }

  return (data || []) as Notification[];
}

export async function markNotificationsRead(
  notificationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('mark_notifications_read', {
    p_notification_ids: notificationIds,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function sendNotification(
  userIds: string[],
  userType: 'customer' | 'employee',
  title: string,
  message: string,
  type: string = 'system',
  data?: Record<string, any>,
  priority: string = 'normal'
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data: result, error } = await supabase.rpc('send_notification', {
    p_user_ids: userIds,
    p_user_type: userType,
    p_title: title,
    p_message: message,
    p_type: type,
    p_data: data,
    p_priority: priority,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, count: result?.count };
}

// =============================================
// REPORTS
// =============================================

export async function generateSalesReport(
  startDate: string,
  endDate: string
): Promise<any> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('generate_sales_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return null;
  }

  return data;
}

export async function generateEmployeeReport(
  startDate: string,
  endDate: string
): Promise<any> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('generate_employee_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return null;
  }

  return data;
}

// =============================================
// WEBSITE CONTENT
// =============================================

export async function getWebsiteContent(): Promise<WebsiteContent[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('website_content')
    .select('*')
    .order('section', { ascending: true });

  if (error) {
    return [];
  }

  return data as WebsiteContent[];
}

export async function updateWebsiteContent(
  key: string,
  content: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase
    .from('website_content')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// PROMO CODES
// =============================================

export async function getPromoCodes(): Promise<PromoCode[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data as PromoCode[];
}

export async function createPromoCode(
  promoData: Omit<PromoCode, 'id' | 'current_usage' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase
    .from('promo_codes')
    .insert(promoData);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// TABLE EXCHANGE
// =============================================

export async function requestTableExchange(
  tableId: string,
  toWaiterId: string,
  exchangeType: 'one_way' | 'swap',
  swapTableId?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('request_table_exchange', {
    p_table_id: tableId,
    p_to_waiter_id: toWaiterId,
    p_exchange_type: exchangeType,
    p_swap_table_id: swapTableId,
    p_reason: reason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function respondTableExchange(
  requestId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('respond_table_exchange', {
    p_request_id: requestId,
    p_accept: accept,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.TABLES_STATUS);

  return { success: true };
}

// =============================================
// DELIVERY
// =============================================

export async function getDeliveryOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_delivery_orders');

  if (error) {
    return [];
  }

  return (data || []) as Order[];
}

export async function acceptDeliveryOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('accept_delivery_order', {
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function completeDelivery(orderId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('complete_delivery', {
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// INVENTORY - Full CRUD with Advanced Features
// =============================================

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  cost_per_unit: number;
  supplier: string;
  last_restocked: string | null;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  notes?: string;
  location?: string;
  barcode?: string;
  expiry_date?: string;
  is_active: boolean;
  reorder_point: number;
  lead_time_days: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  item_id: string;
  item_name: string;
  item_sku?: string;
  type: 'purchase' | 'usage' | 'waste' | 'adjustment' | 'return' | 'transfer_in' | 'transfer_out' | 'count' | 'initial';
  quantity: number;
  unit?: string;
  unit_cost?: number;
  total_cost?: number;
  reason: string;
  reference_number?: string;
  batch_number?: string;
  performed_by: string;
  created_at: string;
}

export interface InventorySummary {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  in_stock_count: number;
  overstock_count: number;
  expiring_soon: number;
  expired: number;
  categories: {
    category: string;
    count: number;
    value: number;
  }[];
}

export interface InventorySupplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  payment_terms?: string;
  lead_time_days: number;
  rating?: number;
  is_active: boolean;
  items_count: number;
  notes?: string;
  created_at: string;
}

export interface InventoryAlert {
  id: string;
  item_id: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'expiring' | 'expired' | 'overstock';
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  min_stock: number;
  reorder_point: number;
  unit: string;
  supplier: string;
  cost_per_unit: number;
  suggested_order_qty: number;
  estimated_cost: number;
  lead_time_days: number;
  status: 'low_stock' | 'out_of_stock';
  priority: 'critical' | 'high' | 'medium';
}

export interface InventoryMovementReport {
  period: { start: string; end: string };
  summary: {
    total_purchases: number;
    total_usage: number;
    total_waste: number;
    total_adjustments: number;
    purchase_value: number;
    usage_value: number;
    waste_value: number;
  };
  by_category: {
    category: string;
    purchases: number;
    usage: number;
    waste: number;
  }[];
  daily_movement: {
    date: string;
    purchases: number;
    usage: number;
    waste: number;
  }[];
}

export interface CategoryValue {
  category: string;
  items_count: number;
  total_quantity: number;
  total_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return [];

  // Check cache first
  const cached = await getFromCache<InventoryItem[]>(PORTAL_CACHE_KEYS.INVENTORY_LIST);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_inventory_items');

  if (error) {
    return [];
  }

  const items = (data || []) as InventoryItem[];
  
  // Cache for 5 minutes
  await setInCache(PORTAL_CACHE_KEYS.INVENTORY_LIST, items, CACHE_DURATION.MEDIUM);

  return items;
}

export async function createInventoryItem(
  itemData: {
    name: string;
    sku: string;
    category: string;
    unit: string;
    quantity?: number;
    min_quantity?: number;
    max_quantity?: number;
    cost_per_unit?: number;
    supplier?: string;
    notes?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('create_inventory_item', {
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
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.INVENTORY_LIST);

  return { success: data?.success || false, id: data?.id, error: data?.error };
}

export async function updateInventoryItem(
  itemId: string,
  updates: {
    name?: string;
    sku?: string;
    category?: string;
    unit?: string;
    min_quantity?: number;
    max_quantity?: number;
    cost_per_unit?: number;
    supplier?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('update_inventory_item', {
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
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.INVENTORY_LIST);

  return { success: true };
}

export async function adjustInventoryStock(
  itemId: string,
  transactionType: 'purchase' | 'usage' | 'waste' | 'adjustment',
  quantity: number,
  reason?: string,
  unitCost?: number
): Promise<{ success: boolean; new_quantity?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('adjust_inventory_stock', {
    p_item_id: itemId,
    p_transaction_type: transactionType,
    p_quantity: quantity,
    p_reason: reason,
    p_unit_cost: unitCost,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.INVENTORY_LIST);

  return { 
    success: data?.success || false, 
    new_quantity: data?.new_quantity,
    error: data?.error,
  };
}

export async function getInventoryTransactions(
  filters?: {
    itemId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<StockTransaction[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_inventory_transactions', {
    p_item_id: filters?.itemId,
    p_start_date: filters?.startDate,
    p_end_date: filters?.endDate,
    p_limit: filters?.limit || 50,
  });

  if (error) {
    return [];
  }

  return (data || []) as StockTransaction[];
}

export async function deleteInventoryItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('delete_inventory_item', {
    p_item_id: itemId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.INVENTORY_LIST);

  return { success: true };
}

// Get inventory summary/dashboard stats
export async function getInventorySummary(): Promise<InventorySummary | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_inventory_summary');

  if (error) {
    return null;
  }

  return data as InventorySummary;
}

// Get low stock items for reordering
export async function getLowStockItems(): Promise<LowStockItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_low_stock_items');

  if (error) {
    return [];
  }

  return (data || []) as LowStockItem[];
}

// Get inventory movement report
export async function getInventoryMovementReport(
  startDate?: string,
  endDate?: string
): Promise<InventoryMovementReport | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_inventory_movement_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return null;
  }

  return data as InventoryMovementReport;
}

// Get expiring items
export async function getExpiringItems(days: number = 30): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_expiring_items', {
    p_days: days,
  });

  if (error) {
    return [];
  }

  return (data || []) as InventoryItem[];
}

// Get inventory suppliers
export async function getInventorySuppliers(): Promise<InventorySupplier[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_inventory_suppliers');

  if (error) {
    return [];
  }

  return (data || []) as InventorySupplier[];
}

// Create inventory supplier
export async function createInventorySupplier(
  supplierData: {
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    payment_terms?: string;
    lead_time_days?: number;
    notes?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('create_inventory_supplier', {
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

  return { success: true, id: data?.id };
}

// Get inventory alerts
export async function getInventoryAlerts(unreadOnly: boolean = true): Promise<InventoryAlert[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_inventory_alerts', {
    p_unread_only: unreadOnly,
  });

  if (error) {
    return [];
  }

  return (data || []) as InventoryAlert[];
}

// Mark alert as read
export async function markInventoryAlertRead(alertId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('mark_inventory_alert_read', {
    p_alert_id: alertId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Resolve alert
export async function resolveInventoryAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('resolve_inventory_alert', {
    p_alert_id: alertId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Bulk update stock (inventory count)
export async function bulkUpdateStock(
  items: { item_id: string; quantity: number; reason?: string }[]
): Promise<{ success: boolean; updated?: number; errors?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('bulk_update_stock', {
    p_items: items,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Invalidate cache
  await redis.del(PORTAL_CACHE_KEYS.INVENTORY_LIST);

  return { 
    success: true, 
    updated: data?.updated,
    errors: data?.errors,
  };
}

// Generate reorder suggestions
export async function getReorderSuggestions(): Promise<LowStockItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('generate_reorder_suggestions');

  if (error) {
    return [];
  }

  return (data || []) as LowStockItem[];
}

// Get inventory value by category
export async function getInventoryValueByCategory(): Promise<CategoryValue[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_inventory_value_by_category');

  if (error) {
    return [];
  }

  return (data || []) as CategoryValue[];
}

// =============================================
// DEALS & PROMOTIONS - Full CRUD (New deals table)
// =============================================

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

export async function getDeals(): Promise<Deal[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_all_deals_with_items');

  if (error) {
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

  const { data, error } = await supabase.rpc('get_deal_with_items', {
    p_deal_id: dealId,
  });

  if (error) {
    return null;
  }

  if (!data) return null;

  // Map to include legacy field names
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
): Promise<{ success: boolean; id?: string; code?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('create_deal_with_items', {
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
    id: data?.id, 
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

  const { data, error } = await supabase.rpc('update_deal_with_items', {
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

export async function toggleDealStatus(dealId: string): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('toggle_deal_active', {
    p_deal_id: dealId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, is_active: data?.is_active };
}

export async function deleteDeal(dealId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('delete_deal_cascade', {
    p_deal_id: dealId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// AUDIT LOGS
// =============================================

export interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  employee: {
    id: string;
    name: string;
    role: string;
  };
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export async function getAuditLogs(
  filters?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    actionType?: string;
    limit?: number;
  }
): Promise<AuditLog[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_audit_logs', {
    p_start_date: filters?.startDate,
    p_end_date: filters?.endDate,
    p_employee_id: filters?.employeeId,
    p_action_type: filters?.actionType,
    p_limit: filters?.limit || 100,
  });

  if (error) {
    return [];
  }

  return (data || []) as AuditLog[];
}

export async function logAuditAction(
  action: string,
  tableName: string,
  recordId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('log_audit_action', {
    p_action: action,
    p_table_name: tableName,
    p_record_id: recordId,
    p_old_values: oldValues,
    p_new_values: newValues,
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// PAYROLL MANAGEMENT
// =============================================

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

export async function getPayslips(
  filters?: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<Payslip[]> {
  if (!isSupabaseConfigured) return [];

  // Use v2 RPC that doesn't require is_manager_or_admin() check
  const { data, error } = await supabase.rpc('get_payslips_v2', {
    p_employee_id: filters?.employeeId,
    p_status: filters?.status,
    p_start_date: filters?.startDate,
    p_end_date: filters?.endDate,
    p_limit: filters?.limit || 100,
  });

  if (error) {
    return [];
  }

  return (data || []) as Payslip[];
}

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

  // Use v2 RPC that doesn't require is_manager_or_admin() check
  const { data: result, error } = await supabase.rpc('create_payslip_v2', {
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

  // Use v2 RPC that doesn't require is_manager_or_admin() check
  const { error } = await supabase.rpc('update_payslip_status_v2', {
    p_payslip_id: payslipId,
    p_status: status,
    p_payment_method: paymentMethod,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getPayrollSummary(
  periodStart?: string,
  periodEnd?: string
): Promise<PayrollSummary | null> {
  if (!isSupabaseConfigured) return null;

  // Use v2 RPC that doesn't require is_manager_or_admin() check
  const { data, error } = await supabase.rpc('get_payroll_summary_v2', {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) {
    return null;
  }

  return data as PayrollSummary;
}

// =============================================
// REVIEW MANAGEMENT
// =============================================

export interface AdminReview {
  id: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  order_id?: string;
  item?: {
    id: string;
    name: string;
    image?: string;
  };
  meal?: {
    id: string;
    name: string;
    image?: string;
  };
  rating: number;
  comment?: string;
  images: string[];
  is_verified: boolean;
  is_visible: boolean;
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
}

export interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  pending_replies: number;
  this_week: number;
}

export async function getAdminReviews(
  filters?: {
    status?: 'visible' | 'hidden' | 'verified';
    minRating?: number;
    maxRating?: number;
    limit?: number;
  }
): Promise<AdminReview[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_admin_reviews', {
    p_status: filters?.status,
    p_min_rating: filters?.minRating,
    p_max_rating: filters?.maxRating,
    p_limit: filters?.limit || 100,
  });

  if (error) {
    return [];
  }

  return (data || []) as AdminReview[];
}

export async function updateReviewVisibility(
  reviewId: string,
  isVisible: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('update_review_visibility', {
    p_review_id: reviewId,
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function replyToReview(
  reviewId: string,
  reply: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('reply_to_review', {
    p_review_id: reviewId,
    p_reply: reply,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { error } = await supabase.rpc('delete_review', {
    p_review_id: reviewId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getReviewStats(): Promise<ReviewStats | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_review_stats');

  if (error) {
    return null;
  }

  return data as ReviewStats;
}

// =============================================
// ENHANCED ADMIN REVIEW MANAGEMENT (OPTIMIZED)
// =============================================

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

// Single optimized call to get all admin reviews with full details
export async function getAdminReviewsAdvanced(
  filters?: AdminReviewFilters
): Promise<AdminReviewsResponse> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured', reviews: [], total_count: 0, has_more: false };
  }

  // Check authentication before making call
  if (!(await isAuthenticated())) {
    return { success: false, error: 'Not authenticated', reviews: [], total_count: 0, has_more: false };
  }

  const { data, error } = await supabase.rpc('get_admin_reviews_advanced', {
    p_status: filters?.status || null,
    p_min_rating: filters?.minRating || null,
    p_max_rating: filters?.maxRating || null,
    p_has_reply: filters?.hasReply ?? null,
    p_sort_by: filters?.sortBy || 'recent',
    p_limit: filters?.limit || 50,
    p_offset: filters?.offset || 0,
  });

  if (error) {
    return { success: false, error: error.message, reviews: [], total_count: 0, has_more: false };
  }

  return data as AdminReviewsResponse;
}

// Single optimized call for all review stats
export async function getAllReviewStats(): Promise<AllReviewStats | null> {
  if (!isSupabaseConfigured) return null;

  // Check authentication
  if (!(await isAuthenticated())) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_all_review_stats');

  if (error) {
    return null;
  }

  return data as AllReviewStats;
}

// Bulk update review visibility
export async function bulkUpdateReviewVisibility(
  reviewIds: string[],
  isVisible: boolean
): Promise<{ success: boolean; error?: string; affected_count?: number }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('bulk_update_review_visibility', {
    p_review_ids: reviewIds,
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

// Reply to review with employee tracking
export async function replyToReviewAdvanced(
  reviewId: string,
  reply: string,
  employeeId?: string
): Promise<{ success: boolean; error?: string; replied_at?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('reply_to_review_advanced', {
    p_review_id: reviewId,
    p_reply: reply,
    p_employee_id: employeeId || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

// Delete review with rating update
export async function deleteReviewAdvanced(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('delete_review_advanced', {
    p_review_id: reviewId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

// Show/Hide all reviews at once
export async function setAllReviewsVisibility(
  isVisible: boolean
): Promise<{ success: boolean; error?: string; affected_count?: number }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data, error } = await supabase.rpc('set_all_reviews_visibility', {
    p_is_visible: isVisible,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

// =============================================
// NOTIFICATION MANAGEMENT
// =============================================

export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: Record<string, any>;
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

  const { data, error } = await supabase.rpc('get_notifications', {
    p_user_id: filters?.userId,
    p_user_type: filters?.userType || 'employee',
    p_is_read: filters?.isRead,
    p_limit: filters?.limit || 50,
  });

  if (error) {
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

  const { error } = await supabase.rpc('mark_notification_read', {
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

  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_type: userType,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function createNotification(
  data: {
    userId: string;
    userType: 'employee' | 'customer';
    title: string;
    message: string;
    type?: string;
    data?: Record<string, any>;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database not configured' };
  }

  const { data: result, error } = await supabase.rpc('create_notification', {
    p_user_id: data.userId,
    p_user_type: data.userType,
    p_title: data.title,
    p_message: data.message,
    p_type: data.type || 'system',
    p_data: data.data,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, id: result?.id };
}

export async function getUnreadNotificationCount(
  userType: 'employee' | 'customer' = 'employee'
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { data, error } = await supabase.rpc('get_unread_notification_count', {
    p_user_type: userType,
  });

  if (error) {
    return 0;
  }

  return data?.count || 0;
}

// =============================================
// REPORTS & ANALYTICS
// =============================================

export interface CategorySales {
  category: string;
  category_id: string;
  total_sales: number;
  order_count: number;
  items_sold: number;
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

export async function getCategorySalesReport(
  startDate?: string,
  endDate?: string
): Promise<CategorySales[]> {
  if (!isSupabaseConfigured) return [];

  // Use v2 RPC that doesn't require is_manager_or_admin() check
  const { data, error } = await supabase.rpc('get_category_sales_report_v2', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return [];
  }

  return (data || []) as CategorySales[];
}

export async function getEmployeePerformanceReport(
  startDate?: string,
  endDate?: string
): Promise<EmployeePerformance[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_employee_performance_report', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    return [];
  }

  return (data || []) as EmployeePerformance[];
}

export async function getInventoryReport(): Promise<InventoryReport | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_inventory_report');

  if (error) {
    return null;
  }

  return data as InventoryReport;
}
