// =============================================
// ZOIRO BROAST HUB - ROLE-BASED PERMISSION SYSTEM
// =============================================

import type { EmployeeRole } from '@/types/portal';

// =============================================
// PERMISSION CONSTANTS
// =============================================

// All available pages/features in the system
export const ALL_PAGES = {
  // General pages (everyone has access)
  dashboard: { path: '/portal', label: 'Dashboard', icon: 'LayoutDashboard' },
  profile: { path: '/portal/settings', label: 'Settings', icon: 'Settings' },
  attendance: { path: '/portal/attendance', label: 'Attendance', icon: 'Clock' },
  
  // Feature pages (role-based)
  menu: { path: '/portal/menu', label: 'Menu Management', icon: 'UtensilsCrossed' },
  orders: { path: '/portal/orders', label: 'Orders', icon: 'ShoppingBag' },
  kitchen: { path: '/portal/kitchen', label: 'Kitchen', icon: 'ChefHat' },
  delivery: { path: '/portal/delivery', label: 'Delivery', icon: 'Truck' },
  tables: { path: '/portal/tables', label: 'Tables', icon: 'LayoutGrid' },
  bookings: { path: '/portal/bookings', label: 'Bookings', icon: 'CalendarDays' },
  billing: { path: '/portal/billing', label: 'Billing', icon: 'Receipt' },
  employees: { path: '/portal/employees', label: 'Employees', icon: 'Users' },
  customers: { path: '/portal/customers', label: 'Customers', icon: 'UserCog' },
  inventory: { path: '/portal/inventory', label: 'Inventory', icon: 'Package' },
  payroll: { path: '/portal/payroll', label: 'Payroll', icon: 'Wallet' },
  reports: { path: '/portal/reports', label: 'Reports', icon: 'BarChart3' },
  perks: { path: '/portal/perks', label: 'Perks & Loyalty', icon: 'Gift' },
  reviews: { path: '/portal/reviews', label: 'Reviews', icon: 'Star' },
  messages: { path: '/portal/messages', label: 'Messages', icon: 'MessageSquare' },
  notifications: { path: '/portal/notifications', label: 'Notifications', icon: 'Bell' },
  deals: { path: '/portal/deals', label: 'Deals', icon: 'Percent' },
  audit: { path: '/portal/audit', label: 'Audit Log', icon: 'FileSearch' },
  backup: { path: '/portal/backup', label: 'DB Backup', icon: 'HardDriveDownload' },
} as const;

export type PageKey = keyof typeof ALL_PAGES;

// General pages everyone has access to
export const GENERAL_PAGES: PageKey[] = ['dashboard', 'profile', 'attendance', 'payroll'];

// =============================================
// DEFAULT ROLE PERMISSIONS
// =============================================

export const ROLE_DEFAULT_PERMISSIONS: Record<EmployeeRole, {
  pages: PageKey[];
  orderFilters?: string[]; // which order types they can view
  features?: string[]; // additional feature flags
}> = {
  admin: {
    pages: Object.keys(ALL_PAGES) as PageKey[],
    orderFilters: ['all'],
    features: ['manage_all', 'view_reports', 'system_settings', 'employee_management', 'database_backup'],
  },
  
  manager: {
    // All pages except employee management and website settings
    pages: [
      ...GENERAL_PAGES,
      'menu', 'orders', 'kitchen', 'delivery', 'tables', 'bookings', 'billing',
      'inventory', 'reports', 'perks', 'reviews', 'messages', 'deals', 'notifications', 'customers',
      'backup',
    ],
    orderFilters: ['all'],
    features: ['manage_orders', 'manage_tables', 'view_reports', 'manage_inventory'],
  },
  
  waiter: {
    // General + Tables, Orders (dine-in only)
    pages: [...GENERAL_PAGES, 'tables', 'orders'],
    orderFilters: ['dine-in'],
    features: ['create_orders', 'view_own_tables'],
  },
  
  billing_staff: {
    // General + Billing, Orders, Tables
    pages: [...GENERAL_PAGES, 'billing', 'orders', 'tables'],
    orderFilters: ['all'],
    features: ['process_payments', 'generate_invoices', 'view_sales'],
  },
  
  kitchen_staff: {
    // General + Kitchen, Orders, Inventory, Menu, Tables
    pages: [...GENERAL_PAGES, 'kitchen', 'orders', 'inventory', 'menu', 'tables'],
    orderFilters: ['all'],
    features: ['update_order_status', 'view_inventory', 'view_menu'],
  },
  
  delivery_rider: {
    // General + Delivery, Orders (online only)
    pages: [...GENERAL_PAGES, 'delivery', 'orders'],
    orderFilters: ['online'],
    features: ['update_delivery_status', 'view_delivery_orders'],
  },
  
  other: {
    // Only general pages, custom permissions needed
    pages: [...GENERAL_PAGES],
    orderFilters: [],
    features: [],
  },
};

// =============================================
// AVAILABLE EXTRA PERMISSIONS (for custom assignment)
// =============================================

export const EXTRA_PERMISSIONS = [
  // Page Access
  { key: 'access_menu', label: 'Menu Management Access', category: 'Page Access', page: 'menu' },
  { key: 'access_orders', label: 'Orders Access', category: 'Page Access', page: 'orders' },
  { key: 'access_kitchen', label: 'Kitchen Access', category: 'Page Access', page: 'kitchen' },
  { key: 'access_delivery', label: 'Delivery Access', category: 'Page Access', page: 'delivery' },
  { key: 'access_tables', label: 'Tables Access', category: 'Page Access', page: 'tables' },
  { key: 'access_bookings', label: 'Bookings Access', category: 'Page Access', page: 'bookings' },
  { key: 'access_billing', label: 'Billing Access', category: 'Page Access', page: 'billing' },
  { key: 'access_inventory', label: 'Inventory Access', category: 'Page Access', page: 'inventory' },
  { key: 'access_customers', label: 'Customers Access', category: 'Page Access', page: 'customers' },
  { key: 'access_reports', label: 'Reports Access', category: 'Page Access', page: 'reports' },
  { key: 'access_perks', label: 'Perks & Loyalty Access', category: 'Page Access', page: 'perks' },
  { key: 'access_reviews', label: 'Reviews Access', category: 'Page Access', page: 'reviews' },
  { key: 'access_messages', label: 'Messages Access', category: 'Page Access', page: 'messages' },
  { key: 'access_notifications', label: 'Notifications Access', category: 'Page Access', page: 'notifications' },
  { key: 'access_deals', label: 'Deals & Promotions Access', category: 'Page Access', page: 'deals' },
  { key: 'access_audit', label: 'Audit Log Access', category: 'Page Access', page: 'audit' },
  { key: 'access_payroll', label: 'Payroll Access', category: 'Page Access', page: 'payroll' },
  { key: 'access_backup', label: 'Database Backup Access', category: 'Page Access', page: 'backup' },
  
  // Order Filters
  { key: 'view_dine_in_orders', label: 'View Dine-in Orders', category: 'Orders' },
  { key: 'view_online_orders', label: 'View Online Orders', category: 'Orders' },
  { key: 'view_walk_in_orders', label: 'View Walk-in Orders', category: 'Orders' },
  { key: 'view_all_orders', label: 'View All Orders', category: 'Orders' },
  { key: 'create_orders', label: 'Create New Orders', category: 'Orders' },
  { key: 'update_order_status', label: 'Update Order Status', category: 'Orders' },
  { key: 'cancel_orders', label: 'Cancel Orders', category: 'Orders' },
  
  // Menu
  { key: 'view_menu', label: 'View Menu Items', category: 'Menu' },
  { key: 'edit_menu', label: 'Edit Menu Items', category: 'Menu' },
  { key: 'manage_categories', label: 'Manage Categories', category: 'Menu' },
  
  // Tables
  { key: 'view_tables', label: 'View Tables', category: 'Tables' },
  { key: 'manage_tables', label: 'Manage Tables', category: 'Tables' },
  { key: 'assign_tables', label: 'Assign Tables', category: 'Tables' },

  // Bookings
  { key: 'view_bookings', label: 'View Reservations', category: 'Bookings' },
  { key: 'manage_bookings', label: 'Create / Edit / Cancel Reservations', category: 'Bookings' },
  { key: 'delete_bookings', label: 'Delete Reservations', category: 'Bookings' },
  { key: 'toggle_booking_system', label: 'Enable / Disable Online Booking', category: 'Bookings' },
  
  // Billing
  { key: 'process_payments', label: 'Process Payments', category: 'Billing' },
  { key: 'generate_invoices', label: 'Generate Invoices', category: 'Billing' },
  { key: 'apply_discounts', label: 'Apply Discounts', category: 'Billing' },
  { key: 'process_refunds', label: 'Process Refunds', category: 'Billing' },
  
  // Inventory
  { key: 'view_inventory', label: 'View Inventory', category: 'Inventory' },
  { key: 'manage_inventory', label: 'Manage Inventory', category: 'Inventory' },
  { key: 'manage_suppliers', label: 'Manage Suppliers', category: 'Inventory' },
  
  // Reports
  { key: 'view_sales_reports', label: 'View Sales Reports', category: 'Reports' },
  { key: 'view_inventory_reports', label: 'View Inventory Reports', category: 'Reports' },
  { key: 'export_reports', label: 'Export Reports', category: 'Reports' },
] as const;

export type ExtraPermissionKey = typeof EXTRA_PERMISSIONS[number]['key'];

// =============================================
// PERMISSION UTILITIES
// =============================================

export interface UserPermissions {
  role: EmployeeRole;
  pages: PageKey[];
  orderFilters: string[];
  features: string[];
  customPermissions: string[];
}

/**
 * Build complete permissions for a user based on role + custom permissions
 */
export function buildUserPermissions(
  role: EmployeeRole,
  customPermissions: string[] = []
): UserPermissions {
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role];
  
  // Start with role defaults
  const pages = new Set<PageKey>(roleDefaults.pages);
  const orderFilters = new Set<string>(roleDefaults.orderFilters || []);
  const features = new Set<string>(roleDefaults.features || []);
  
  // Add custom permissions
  for (const perm of customPermissions) {
    // Check if it's a page access permission
    const pageAccess = EXTRA_PERMISSIONS.find(p => p.key === perm && p.key.startsWith('access_'));
    if (pageAccess && 'page' in pageAccess) {
      pages.add(pageAccess.page as PageKey);
    }
    
    // Check order filter permissions
    if (perm === 'view_dine_in_orders') orderFilters.add('dine-in');
    if (perm === 'view_online_orders') orderFilters.add('online');
    if (perm === 'view_walk_in_orders') orderFilters.add('walk-in');
    if (perm === 'view_all_orders') orderFilters.add('all');
    
    // Add to features
    features.add(perm);
  }
  
  return {
    role,
    pages: Array.from(pages),
    orderFilters: Array.from(orderFilters),
    features: Array.from(features),
    customPermissions,
  };
}

/**
 * Check if user has access to a specific page
 */
export function canAccessPage(permissions: UserPermissions, page: PageKey): boolean {
  return permissions.pages.includes(page);
}

/**
 * Check if user can view a specific order type
 */
export function canViewOrderType(permissions: UserPermissions, orderType: string): boolean {
  if (permissions.orderFilters.includes('all')) return true;
  return permissions.orderFilters.includes(orderType);
}

/**
 * Check if user has a specific feature permission
 */
export function hasFeature(permissions: UserPermissions, feature: string): boolean {
  return permissions.features.includes(feature);
}

/**
 * Get sidebar items for a user based on permissions
 */
export function getSidebarItems(permissions: UserPermissions) {
  return permissions.pages
    .filter(page => page in ALL_PAGES)
    .map(page => ALL_PAGES[page]);
}

/**
 * Cache key for storing permissions in localStorage
 * BUMP THIS VERSION whenever ALL_PAGES or ROLE_DEFAULT_PERMISSIONS changes
 * so stale caches are automatically invalidated for all users.
 */
export const PERMISSIONS_CACHE_KEY = 'user_permissions';
export const PERMISSIONS_CACHE_EXPIRY = 'user_permissions_expiry';
export const PERMISSIONS_CACHE_VERSION_KEY = 'user_permissions_version';
export const PERMISSIONS_CACHE_VERSION = '7'; // bumped: force-clear stale v6 caches that still had billing for waiter
export const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Store permissions in cache
 */
export function cachePermissions(permissions: UserPermissions): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(permissions));
  localStorage.setItem(PERMISSIONS_CACHE_EXPIRY, String(Date.now() + CACHE_DURATION));
  localStorage.setItem(PERMISSIONS_CACHE_VERSION_KEY, PERMISSIONS_CACHE_VERSION);
}

/**
 * Get cached permissions — returns null if expired OR version is stale
 */
export function getCachedPermissions(): UserPermissions | null {
  if (typeof window === 'undefined') return null;

  // Version check: if the stored version doesn't match, bust the cache
  const storedVersion = localStorage.getItem(PERMISSIONS_CACHE_VERSION_KEY);
  if (storedVersion !== PERMISSIONS_CACHE_VERSION) {
    localStorage.removeItem(PERMISSIONS_CACHE_KEY);
    localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY);
    localStorage.removeItem(PERMISSIONS_CACHE_VERSION_KEY);
    return null;
  }

  const expiry = localStorage.getItem(PERMISSIONS_CACHE_EXPIRY);
  if (!expiry || Date.now() > parseInt(expiry)) {
    // Cache expired
    localStorage.removeItem(PERMISSIONS_CACHE_KEY);
    localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY);
    localStorage.removeItem(PERMISSIONS_CACHE_VERSION_KEY);
    return null;
  }
  
  const cached = localStorage.getItem(PERMISSIONS_CACHE_KEY);
  if (!cached) return null;
  
  try {
    return JSON.parse(cached) as UserPermissions;
  } catch {
    return null;
  }
}

/**
 * Clear cached permissions
 */
export function clearPermissionsCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PERMISSIONS_CACHE_KEY);
  localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY);
  localStorage.removeItem(PERMISSIONS_CACHE_VERSION_KEY);
}
