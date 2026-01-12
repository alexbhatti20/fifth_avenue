// =============================================
// ZOIRO BROAST HUB - PORTAL TYPES
// =============================================

// Employee roles
export type EmployeeRole = 
  | 'admin' 
  | 'manager' 
  | 'waiter' 
  | 'billing_staff' 
  | 'kitchen_staff' 
  | 'delivery_rider' 
  | 'other';

// Employee status
export type EmployeeStatus = 'active' | 'inactive' | 'blocked' | 'pending';

// Table status
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';

// Order status
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'delivering' 
  | 'delivered' 
  | 'cancelled';

// Order type
export type OrderType = 'online' | 'walk-in' | 'dine-in';

// Payment method
export type PaymentMethod = 'cash' | 'card' | 'online' | 'wallet';

// Invoice status
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'cancelled' | 'refunded';

// Attendance status
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';

// Notification type
export type NotificationType = 'order' | 'system' | 'alert' | 'promo' | 'message' | 'attendance';

// Promo type
export type PromoType = 'percentage' | 'fixed_amount' | 'free_item' | 'loyalty_points';

// Loyalty tier
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// =============================================
// INTERFACES
// =============================================

export interface Employee {
  id: string;
  auth_user_id?: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  permissions: Record<string, boolean>;
  documents?: EmployeeDocument[];
  salary?: number;
  hired_date?: string;
  license_id?: string;
  avatar_url?: string;
  address?: string;
  emergency_contact?: string;
  emergency_contact_name?: string;
  date_of_birth?: string;
  blood_group?: string;
  portal_enabled: boolean;
  block_reason?: string;
  is_2fa_enabled: boolean;
  last_login?: string;
  total_tips: number;
  total_orders_taken: number;
  bank_details?: Record<string, string>;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  attendance_this_month?: number;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_type: string;
  uploaded_at: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

export interface EmployeePayroll {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  base_salary: number;
  bonus: number;
  deductions: number;
  tips: number;
  total_amount: number;
  paid: boolean;
  paid_at?: string;
  paid_by?: string;
  notes?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: AttendanceStatus;
  check_in_method?: string;
  check_out_method?: string;
  hours_worked?: number;
  overtime_hours?: number;
  notes?: string;
  approved_by?: string;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'name' | 'role'>;
}

export interface AttendanceCode {
  id: string;
  code: string;
  generated_by: string;
  valid_for_date: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: TableStatus;
  section?: string;
  floor: number;
  position?: { x: number; y: number };
  current_order_id?: string;
  current_customers: number;
  assigned_waiter_id?: string;
  reserved_by?: string;
  reservation_time?: string;
  reservation_notes?: string;
  created_at: string;
  updated_at: string;
  current_order?: Partial<Order>;
  assigned_waiter?: Pick<Employee, 'id' | 'name'>;
}

export interface TableExchangeRequest {
  id: string;
  from_waiter_id: string;
  to_waiter_id: string;
  table_id: string;
  exchange_type: 'one_way' | 'swap';
  swap_table_id?: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason?: string;
  responded_at?: string;
  created_at: string;
  from_waiter?: Pick<Employee, 'id' | 'name'>;
  to_waiter?: Pick<Employee, 'id' | 'name'>;
  table?: Pick<RestaurantTable, 'id' | 'table_number'>;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address?: string;
  order_type: OrderType;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: string;
  status: OrderStatus;
  notes?: string;
  table_number?: number;
  waiter_id?: string;
  assigned_to?: string;
  prepared_by?: string;
  delivery_rider_id?: string;
  kitchen_started_at?: string;
  kitchen_completed_at?: string;
  can_cancel_until?: string;
  cancellation_reason?: string;
  delivery_started_at?: string;
  estimated_delivery_time?: string;
  delivered_at?: string;
  customer_notified: boolean;
  created_at: string;
  updated_at: string;
  waiter?: Pick<Employee, 'id' | 'name'>;
  // Online payment fields
  transaction_id?: string;
  online_payment_method_id?: string;
  online_payment_details?: {
    method_name?: string;
    method_type?: string;
    account_title?: string;
    account_number?: string;
    [key: string]: any;
  };
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  notes?: string;
}

// Enhanced Order with full details (from RPC)
export interface OrderAdvanced extends Omit<Order, 'waiter' | 'prepared_by'> {
  // Registered customer details
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  // Table details for dine-in
  table_details?: {
    id: string;
    table_number: number;
    capacity: number;
    section?: string;
    floor?: string;
    status: TableStatus;
    current_customers?: number;
    assigned_waiter?: Pick<Employee, 'id' | 'name' | 'phone'>;
  };
  // Staff assignments with full details
  waiter?: Pick<Employee, 'id' | 'name' | 'phone' | 'avatar_url' | 'employee_id'>;
  prepared_by?: Pick<Employee, 'id' | 'name' | 'phone'>;
  delivery_rider?: Pick<Employee, 'id' | 'name' | 'phone' | 'avatar_url' | 'employee_id'>;
  // Calculated fields
  total_items?: number;
  elapsed_seconds?: number;
  prep_elapsed_seconds?: number;
  delivery_elapsed_seconds?: number;
  is_delayed?: boolean;
  can_cancel?: boolean;
  // Status history
  status_history?: OrderStatusHistory[];
  // Payment
  payment_proof_url?: string;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  changed_at: string;
  changed_by_name?: string;
  notes?: string;
}

export interface OrdersStats {
  total_today: number;
  pending_count: number;
  confirmed_count: number;
  preparing_count: number;
  ready_count: number;
  delivering_count: number;
  completed_today: number;
  cancelled_today: number;
  revenue_today: number;
  avg_order_value: number;
  dine_in_count: number;
  online_count: number;
  walk_in_count: number;
  delivery_count: number;
  delayed_orders: number;
  long_prep_orders: number;
}

export interface OrdersAdvancedResponse {
  orders: OrderAdvanced[];
  total_count: number;
  has_more: boolean;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_type: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discount_details?: {
    manual_discount?: number;
    promo_discount?: number;
    promo_code?: string;
    points_discount?: number;
    points_used?: number;
  };
  tax: number;
  delivery_fee: number;
  service_charge: number;
  tip: number;
  total: number;
  payment_method?: string;
  payment_status: InvoiceStatus;
  loyalty_points_earned: number;
  table_number?: number;
  served_by?: string;
  billed_by?: string;
  printed: boolean;
  printed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPoints {
  id: string;
  customer_id: string;
  points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  points_change: number;
  transaction_type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  order_id?: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  promo_type: PromoType;
  value: number;
  min_order_amount: number;
  max_discount?: number;
  usage_limit?: number;
  usage_per_customer: number;
  current_usage: number;
  applicable_items?: string[];
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebsiteContent {
  id: string;
  key: string;
  title?: string;
  content: Record<string, any>;
  section?: string;
  is_active: boolean;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  user_type: 'customer' | 'employee';
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  action_url?: string;
  expires_at?: string;
  sent_by?: string;
  created_at: string;
}

export interface Inventory {
  id: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_per_unit?: number;
  supplier?: string;
  last_restocked?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  transaction_type: 'purchase' | 'usage' | 'waste' | 'adjustment';
  quantity_change: number;
  unit_cost?: number;
  total_cost?: number;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface WaiterTip {
  id: string;
  waiter_id: string;
  order_id?: string;
  invoice_id?: string;
  tip_amount: number;
  table_id?: string;
  date: string;
  created_at: string;
}

export interface ReportArchive {
  id: string;
  report_type: 'sales' | 'inventory' | 'employees' | 'payroll';
  report_period: 'daily' | 'weekly' | 'monthly' | 'custom';
  start_date: string;
  end_date: string;
  data: Record<string, any>;
  file_url?: string;
  generated_by?: string;
  created_at: string;
}

// =============================================
// DASHBOARD STATS TYPES
// =============================================

export interface DashboardStats {
  total_sales: number;
  total_sales_today: number;
  total_orders_today: number;
  total_orders_month: number;
  pending_orders: number;
  active_tables: number;
  total_tables: number;
  active_employees: number;
  present_today: number;
  low_inventory_count: number;
}

export interface SalesAnalytics {
  date?: string;
  week_start?: string;
  month?: string;
  total_sales: number;
  order_count: number;
  avg_order_value: number;
}

export interface HourlySales {
  hour: number;           // 0-23
  hour_label?: string;    // "12 AM", "1 PM", etc.
  sales: number;
  orders: number;
  avg_order_value?: number;
  is_peak?: boolean;
  is_current?: boolean;
  percentage_of_day?: number;
  dine_in_sales?: number;
  dine_in_orders?: number;
  online_sales?: number;
  online_orders?: number;
  walk_in_sales?: number;
  walk_in_orders?: number;
}

export interface WaiterDashboard {
  today_orders: number;
  today_tips: number;
  assigned_tables: RestaurantTable[];
  pending_orders: Order[];
  employee: Pick<Employee, 'id' | 'name' | 'hired_date' | 'total_tips' | 'total_orders_taken'>;
}

// =============================================
// FORM TYPES
// =============================================

export interface EmployeeFormData {
  // Personal Details
  name: string;
  email: string;
  phone: string;
  address?: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact?: string;
  emergency_contact_name?: string;
  
  // Documents
  documents: Array<{
    type: string;
    name: string;
    url: string;
    fileType: string;
  }>;
  
  // Role & Permissions
  role: EmployeeRole;
  permissions: Record<string, boolean>;
  
  // Payroll
  salary: number;
  hired_date: string;
  bank_details?: Record<string, string>;
  
  // Notes
  notes?: string;
}

export interface CreateOrderData {
  table_id?: string;
  customer_count?: number;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  items: OrderItem[];
  notes?: string;
  send_confirmation?: boolean;
}

export interface GenerateInvoiceData {
  order_id: string;
  payment_method: PaymentMethod;
  tip?: number;
  discount?: number;
  promo_code?: string;
  loyalty_points_used?: number;
}

// =============================================
// PERMISSION CONFIGS
// =============================================

export const ROLE_PERMISSIONS: Record<EmployeeRole, string[]> = {
  admin: ['*'], // All permissions
  manager: [
    'dashboard',
    'menu:view',
    'orders:view',
    'orders:manage',
    'tables:view',
    'tables:manage',
    'employees:view',
    'inventory:view',
    'inventory:manage',
    'billing:view',
    'billing:create',
    'attendance:view',
    'attendance:manage',
    'notifications:send',
  ],
  waiter: [
    'dashboard',
    'menu:view',
    'orders:view',
    'orders:create',
    'orders:cancel-own',
    'tables:view',
    'tables:assign',
    'attendance:mark',
    'notifications:view',
  ],
  billing_staff: [
    'dashboard',
    'menu:view',
    'orders:view',
    'billing:view',
    'billing:create',
    'customers:view',
    'loyalty:manage',
    'promo:apply',
    'attendance:mark',
    'notifications:view',
  ],
  kitchen_staff: [
    'dashboard',
    'menu:view',
    'orders:view',
    'orders:update-status',
    'tables:view',
    'inventory:view',
    'attendance:mark',
    'notifications:view',
  ],
  delivery_rider: [
    'dashboard',
    'orders:view-delivery',
    'orders:update-delivery',
    'attendance:mark',
    'notifications:view',
  ],
  other: [
    'dashboard',
    'attendance:mark',
    'notifications:view',
  ],
};

export function hasPermission(role: EmployeeRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

// =============================================
// NAV ITEMS BY ROLE
// =============================================

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission?: string;
  badge?: number;
  children?: NavItem[];
}

export const PORTAL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/portal', icon: 'LayoutDashboard' },
  { 
    label: 'Menu', 
    path: '/portal/menu', 
    icon: 'UtensilsCrossed',
    permission: 'menu:view'
  },
  { 
    label: 'Orders', 
    path: '/portal/orders', 
    icon: 'ShoppingBag',
    permission: 'orders:view'
  },
  { 
    label: 'Tables', 
    path: '/portal/tables', 
    icon: 'LayoutGrid',
    permission: 'tables:view'
  },
  { 
    label: 'Billing', 
    path: '/portal/billing', 
    icon: 'Receipt',
    permission: 'billing:view'
  },
  { 
    label: 'Employees', 
    path: '/portal/employees', 
    icon: 'Users',
    permission: 'employees:view'
  },
  { 
    label: 'Inventory', 
    path: '/portal/inventory', 
    icon: 'Package',
    permission: 'inventory:view'
  },
  { 
    label: 'Attendance', 
    path: '/portal/attendance', 
    icon: 'Clock',
    permission: 'attendance:view'
  },
  { 
    label: 'Payroll', 
    path: '/portal/payroll', 
    icon: 'Wallet',
    permission: 'payroll:view'
  },
  { 
    label: 'Reports', 
    path: '/portal/reports', 
    icon: 'BarChart3',
    permission: 'reports:view'
  },
  { 
    label: 'Settings', 
    path: '/portal/settings', 
    icon: 'Settings',
  },
];
