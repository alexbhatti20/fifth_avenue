// ==========================================
// BILLING PAGE TYPES
// ==========================================

import type { OrderItem, InvoiceStatus, PaymentMethod, OrderType } from '@/types/portal';

export interface BillableOrder {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: string;
  payment_status: string;
  payment_method?: PaymentMethod;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  items: OrderItem[];
  items_count: number;
  subtotal: number;
  discount: number;
  tax: number;
  delivery_fee: number;
  total: number;
  table_number?: number;
  waiter_id?: string;
  waiter_name?: string;
  notes?: string;
  created_at: string;
  is_registered_customer: boolean;
  customer_loyalty_points?: number;
  has_invoice: boolean;
  // Online payment fields
  transaction_id?: string;
  online_payment_method_id?: string;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    submitted_at?: string;
  };
}

export interface BillingCustomer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  is_verified?: boolean;
  is_registered: boolean;
  loyalty_points?: number;
  loyalty_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  total_orders?: number;
  total_spent?: number;
}

export interface BillingTable {
  id: string;
  table_number: number;
  capacity: number;
  section?: string;
  floor?: number;
  current_customers?: number;
}

export interface BillingWaiter {
  id: string;
  name: string;
  employee_id?: string;
}

export interface OrderForBilling {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: string;
  payment_status: string;
  items: OrderItem[];
  items_count: number;
  subtotal: number;
  discount: number;
  tax: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  created_at: string;
  table_number?: number;
  // Online payment fields
  transaction_id?: string;
  online_payment_method_id?: string;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    submitted_at?: string;
  };
}

export interface OrderBillingData {
  order: OrderForBilling;
  customer: BillingCustomer;
  table?: BillingTable | null;
  waiter?: BillingWaiter | null;
  existing_invoice?: ExistingInvoice | null;
  brand_info?: BrandInfo;
}

export interface ExistingInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
}

export interface BrandInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  ntn?: string;
  strn?: string;
  gstn?: string;
  logo_url?: string;
  website?: string;
  footer_text?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface PromoValidation {
  valid: boolean;
  error?: string;
  error_code?: string;
  promo?: {
    id: string;
    code: string;
    name: string;
    description?: string;
    promo_type: 'percentage' | 'fixed_amount';
    value: number;
    discount_amount: number;
    max_discount?: number;
    min_order_amount?: number;
    usage_left?: number;
  };
  discount_amount?: number;
}

export interface InvoiceDiscountDetails {
  manual_discount?: number;
  promo_discount?: number;
  promo_code?: string;
  points_discount?: number;
  points_used?: number;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  order_type: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discount_details?: InvoiceDiscountDetails;
  tax: number;
  service_charge: number;
  delivery_fee: number;
  tip: number;
  total: number;
  payment_method: string;
  payment_status: InvoiceStatus;
  bill_status: string;
  table_number?: number;
  loyalty_points_earned: number;
  loyalty_points_used?: number;
  promo_discount?: number;
  printed: boolean;
  printed_at?: string;
  notes?: string;
  brand_info?: BrandInfo;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetails {
  id: string;
  invoice_number: string;
  order_type?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items?: OrderItem[];
  subtotal: number;
  discount: number;
  promo_discount?: number;
  tax: number;
  service_charge?: number;
  delivery_fee?: number;
  tip?: number;
  total: number;
  payment_method: string;
  payment_status?: InvoiceStatus;
  bill_status?: string;
  table_number?: number;
  loyalty_points_earned?: number;
  loyalty_points_used?: number;
  is_printed?: boolean;
  is_voided?: boolean;
  void_reason?: string;
  created_at: string;
  // Online payment fields (fallback at invoice level)
  transaction_id?: string;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    submitted_at?: string;
  };
  order?: {
    id: string;
    order_number: string;
    order_type?: string;
    table_number?: number;
    items?: OrderItem[];
    created_at?: string;
    // Online payment fields
    transaction_id?: string;
    online_payment_method_id?: string;
    online_payment_details?: {
      method_name?: string;
      account_holder_name?: string;
      account_number?: string;
      bank_name?: string;
      submitted_at?: string;
    };
  } | null;
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    is_registered: boolean;
    loyalty_tier?: string;
  } | null;
  promo_code?: {
    id?: string;
    code: string;
    name?: string;
  } | null;
  brand?: BrandInfo;
  waiter?: BillingWaiter | null;
  billed_by?: BillingWaiter | null;
}

export interface BillingStats {
  success?: boolean;
  today: {
    total_revenue: number;
    invoices_count: number;
    cash_revenue: number;
    card_revenue: number;
    online_revenue: number;
    avg_invoice_value: number;
    total_discount_given: number;
    total_tips: number;
    dine_in_count: number;
    online_count: number;
    walk_in_count: number;
  };
  this_week: {
    total_revenue: number;
    invoices_count: number;
    avg_daily_revenue: number;
  };
  pending_orders: number;
  pending_count?: number; // Alias for pending_orders for consistency
  cash_today?: number; // Alias for today.cash_revenue
  card_today?: number; // Alias for today.card_revenue
  online_today?: number; // Alias for today.online_revenue
  recent_invoices: Array<{
    id: string;
    invoice_number: string;
    customer_name: string;
    total: number;
    payment_method: string;
    created_at: string;
  }>;
}

export interface GenerateInvoiceParams {
  order_id: string;
  payment_method: string;
  manual_discount?: number;
  tip?: number;
  service_charge?: number;
  promo_code?: string;
  loyalty_points_used?: number;
  notes?: string;
}

export interface GenerateInvoiceResult {
  success: boolean;
  error?: string;
  invoice_id?: string;
  invoice_number?: string;
  customer?: {
    id?: string;
    name: string;
    is_registered: boolean;
    points_earned: number;
    total_points?: number;
  };
  totals?: {
    subtotal: number;
    discount: number;
    tax: number;
    service_charge: number;
    delivery_fee: number;
    tip: number;
    total: number;
  };
  discount_breakdown?: {
    manual: number;
    promo: number;
    promo_code?: string;
    points: number;
  };
  reward_promo?: {
    generated: boolean;
    code?: string;
  };
  message?: string;
}

export interface TableBillingInfo {
  table: BillingTable;
  order: OrderForBilling & {
    customer_name: string;
    customer_phone?: string;
  };
  waiter?: BillingWaiter | null;
  can_generate_bill: boolean;
}
