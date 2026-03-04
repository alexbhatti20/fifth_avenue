// ==========================================
// WAITER TABLES PAGE TYPES
// ==========================================

import type { RestaurantTable, TableStatus, OrderStatus } from '@/types/portal';

export interface MenuItem {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  category_id: string;
  category_name: string;
  image_url?: string;
  status: string;
  is_featured?: boolean;
  spicy_level?: number;
  is_vegetarian?: boolean;
  prep_time?: number;
}

export interface Deal {
  id: string;
  name: string;
  description?: string;
  deal_type?: string;
  discount_type?: string;
  discount_value?: number;
  original_price: number;
  deal_price: number;
  image_url?: string;
  items?: any[];
  is_active?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  items_count?: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  isDeal?: boolean;
  sizeVariant?: string;
}

export interface CustomerPromoCode {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  promo_type: string;
  value: number;
  max_discount?: number | null;
  expires_at?: string | null;
  is_active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyalty_points?: number;
  total_orders?: number;
  total_spent?: number;
  avg_order_value?: number;
  last_order_date?: string | null;
  membership_tier?: string;
  is_verified?: boolean;
  promo_codes?: CustomerPromoCode[];
}

export interface WaiterTable extends RestaurantTable {
  is_my_table?: boolean;
  assigned_waiter?: {
    id: string;
    name: string;
  } | null;
  current_order?: {
    id: string;
    order_number: string;
    status: OrderStatus;
    payment_status?: string;
    total: number;
    items_count: number;
    created_at: string;
    has_invoice?: boolean;
    invoice_id?: string | null;
    invoice_payment_status?: string | null;
  } | null;
}

export interface MenuData {
  categories: Category[];
  items: MenuItem[];
  deals: Deal[];
}

export interface WaiterStats {
  total_orders?: number;
  orders_today: number;
  orders_this_week?: number;
  total_sales?: number;
  sales_today: number;
  total_tips?: number;
  tips_today: number;
  avg_order_value?: number;
  total_customers?: number;
  customers_today: number;
}

export interface OrderHistoryItem {
  id: string;
  order_id?: string;
  order_number: string;
  invoice_number?: string;
  table_number: number;
  customer_name?: string;
  customer_phone?: string;
  is_registered_customer: boolean;
  customer_count?: number;
  items?: any[];
  total_items: number;
  subtotal?: number;
  tax?: number;
  total: number;
  tip_amount: number;
  payment_method?: string;
  payment_status?: string;
  order_status?: string;
  order_taken_at: string;
  order_completed_at?: string;
}
