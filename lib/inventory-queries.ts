// =============================================
// ZOIRO BROAST HUB - INVENTORY QUERIES MODULE
// =============================================

import { supabase, isSupabaseConfigured } from './supabase';
import { redis, CACHE_DURATION, getFromCache, setInCache } from './redis';

// =============================================
// CACHE KEYS
// =============================================

export const INVENTORY_CACHE_KEYS = {
  ITEMS_LIST: 'inventory:items:list',
  SUMMARY: 'inventory:summary',
  LOW_STOCK: 'inventory:low_stock',
  ALERTS: 'inventory:alerts',
  SUPPLIERS: 'inventory:suppliers',
  CATEGORIES: 'inventory:categories',
} as const;

// =============================================
// TYPES
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
  type: TransactionType;
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

export type TransactionType = 
  | 'purchase' 
  | 'usage' 
  | 'waste' 
  | 'adjustment' 
  | 'return' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'count' 
  | 'initial';

export interface InventorySummary {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  in_stock_count: number;
  overstock_count: number;
  expiring_soon: number;
  expired: number;
  categories: CategoryStats[];
}

export interface CategoryStats {
  category: string;
  count: number;
  value: number;
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
  alert_type: AlertType;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export type AlertType = 'low_stock' | 'out_of_stock' | 'expiring' | 'expired' | 'overstock';

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
  summary: MovementSummary;
  by_category: CategoryMovement[];
  daily_movement: DailyMovement[];
}

export interface MovementSummary {
  total_purchases: number;
  total_usage: number;
  total_waste: number;
  total_adjustments: number;
  purchase_value: number;
  usage_value: number;
  waste_value: number;
}

export interface CategoryMovement {
  category: string;
  purchases: number;
  usage: number;
  waste: number;
}

export interface DailyMovement {
  date: string;
  purchases: number;
  usage: number;
  waste: number;
}

export interface CategoryValue {
  category: string;
  items_count: number;
  total_quantity: number;
  total_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
}

export interface ExpiringItem extends InventoryItem {
  days_until_expiry: number;
  value_at_risk: number;
  expiry_status: 'expired' | 'critical' | 'warning';
}

export interface CreateItemData {
  name: string;
  sku?: string;
  category: string;
  unit: string;
  quantity?: number;
  min_quantity?: number;
  max_quantity?: number;
  cost_per_unit?: number;
  supplier?: string;
  notes?: string;
  location?: string;
  barcode?: string;
  expiry_date?: string;
}

export interface UpdateItemData {
  name?: string;
  sku?: string;
  category?: string;
  unit?: string;
  min_quantity?: number;
  max_quantity?: number;
  cost_per_unit?: number;
  supplier?: string;
  notes?: string;
  location?: string;
  barcode?: string;
  expiry_date?: string;
  reorder_point?: number;
  lead_time_days?: number;
}

export interface StockAdjustmentData {
  itemId: string;
  transactionType: TransactionType;
  quantity: number;
  reason?: string;
  unitCost?: number;
  referenceNumber?: string;
  batchNumber?: string;
}

export interface TransactionFilters {
  itemId?: string;
  startDate?: string;
  endDate?: string;
  transactionType?: TransactionType;
  limit?: number;
}

// =============================================
// CONSTANTS
// =============================================

export const CATEGORIES = [
  { value: 'meat', label: 'Meat & Poultry', icon: '🍖' },
  { value: 'vegetables', label: 'Vegetables', icon: '🥬' },
  { value: 'dairy', label: 'Dairy', icon: '🧀' },
  { value: 'spices', label: 'Spices & Seasonings', icon: '🌶️' },
  { value: 'oil', label: 'Oil & Fats', icon: '🫒' },
  { value: 'grains', label: 'Grains & Flour', icon: '🌾' },
  { value: 'beverages', label: 'Beverages', icon: '🥤' },
  { value: 'sauces', label: 'Sauces & Condiments', icon: '🥫' },
  { value: 'packaging', label: 'Packaging', icon: '📦' },
  { value: 'cleaning', label: 'Cleaning Supplies', icon: '🧹' },
  { value: 'frozen', label: 'Frozen Items', icon: '🧊' },
  { value: 'other', label: 'Other', icon: '📋' },
] as const;

export const UNITS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'l', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'pieces', label: 'Pieces (pcs)' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'packs', label: 'Packs' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cans', label: 'Cans' },
  { value: 'bags', label: 'Bags' },
  { value: 'cartons', label: 'Cartons' },
  { value: 'dozen', label: 'Dozen' },
] as const;

export const TRANSACTION_TYPES = [
  { value: 'purchase', label: 'Purchase', icon: '📥', color: 'green', delta: 'positive' },
  { value: 'usage', label: 'Usage', icon: '📤', color: 'blue', delta: 'negative' },
  { value: 'waste', label: 'Waste', icon: '🗑️', color: 'red', delta: 'negative' },
  { value: 'return', label: 'Return', icon: '↩️', color: 'orange', delta: 'positive' },
  { value: 'transfer_in', label: 'Transfer In', icon: '➡️', color: 'cyan', delta: 'positive' },
  { value: 'transfer_out', label: 'Transfer Out', icon: '⬅️', color: 'purple', delta: 'negative' },
  { value: 'count', label: 'Inventory Count', icon: '📊', color: 'gray', delta: 'neutral' },
  { value: 'adjustment', label: 'Adjustment', icon: '✏️', color: 'yellow', delta: 'neutral' },
] as const;

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
    const cached = await getFromCache<InventoryItem[]>(INVENTORY_CACHE_KEYS.ITEMS_LIST);
    if (cached) return cached;
  }

  const { data, error } = await supabase.rpc('get_inventory_items');

  if (error) {
    return [];
  }

  const items = (data || []) as InventoryItem[];
  
  // Cache for 5 minutes
  await setInCache(INVENTORY_CACHE_KEYS.ITEMS_LIST, items, CACHE_DURATION.MEDIUM);

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

  const { data, error } = await supabase.rpc('delete_inventory_item', {
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

  const { data: result, error } = await supabase.rpc('adjust_inventory_stock', {
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

  const { data, error } = await supabase.rpc('bulk_update_stock', {
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

  const { data, error } = await supabase.rpc('get_inventory_transactions', {
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
  const cached = await getFromCache<InventorySummary>(INVENTORY_CACHE_KEYS.SUMMARY);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_inventory_summary');

  if (error) {
    return null;
  }

  // Cache for 2 minutes
  await setInCache(INVENTORY_CACHE_KEYS.SUMMARY, data, CACHE_DURATION.SHORT);

  return data as InventorySummary;
}

/**
 * Get low stock items for reordering
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  if (!isSupabaseConfigured) return [];

  const cached = await getFromCache<LowStockItem[]>(INVENTORY_CACHE_KEYS.LOW_STOCK);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_low_stock_items');

  if (error) {
    return [];
  }

  const items = (data || []) as LowStockItem[];
  await setInCache(INVENTORY_CACHE_KEYS.LOW_STOCK, items, CACHE_DURATION.SHORT);

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

  const { data, error } = await supabase.rpc('get_inventory_movement_report', {
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

  const { data, error } = await supabase.rpc('get_expiring_items', {
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

  const { data, error } = await supabase.rpc('get_inventory_value_by_category');

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

  const { data, error } = await supabase.rpc('generate_reorder_suggestions');

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

  const cached = await getFromCache<InventorySupplier[]>(INVENTORY_CACHE_KEYS.SUPPLIERS);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_inventory_suppliers');

  if (error) {
    return [];
  }

  const suppliers = (data || []) as InventorySupplier[];
  await setInCache(INVENTORY_CACHE_KEYS.SUPPLIERS, suppliers, CACHE_DURATION.MEDIUM);

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

  await redis.del(INVENTORY_CACHE_KEYS.SUPPLIERS);

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

  const { data, error } = await supabase.rpc('get_inventory_alerts', {
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

  const { error } = await supabase.rpc('mark_inventory_alert_read', {
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

  const { error } = await supabase.rpc('resolve_inventory_alert', {
    p_alert_id: alertId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================
// CACHE HELPERS
// =============================================

/**
 * Invalidate all inventory cache
 */
export async function invalidateInventoryCache(): Promise<void> {
  await Promise.all([
    redis.del(INVENTORY_CACHE_KEYS.ITEMS_LIST),
    redis.del(INVENTORY_CACHE_KEYS.SUMMARY),
    redis.del(INVENTORY_CACHE_KEYS.LOW_STOCK),
    redis.del(INVENTORY_CACHE_KEYS.ALERTS),
  ]);
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Get status color based on stock status
 */
export function getStatusColor(status: InventoryItem['status']): string {
  switch (status) {
    case 'in_stock':
      return 'bg-green-500/10 text-green-500';
    case 'low_stock':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'out_of_stock':
      return 'bg-red-500/10 text-red-500';
    default:
      return 'bg-gray-500/10 text-gray-500';
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: InventoryItem['status']): string {
  switch (status) {
    case 'in_stock':
      return 'In Stock';
    case 'low_stock':
      return 'Low Stock';
    case 'out_of_stock':
      return 'Out of Stock';
    default:
      return 'Unknown';
  }
}

/**
 * Get transaction type config
 */
export function getTransactionConfig(type: TransactionType) {
  const configs: Record<TransactionType, { label: string; color: string; icon: string }> = {
    purchase: { label: 'Purchase', color: 'text-green-500', icon: 'TrendingUp' },
    usage: { label: 'Usage', color: 'text-red-500', icon: 'TrendingDown' },
    waste: { label: 'Waste', color: 'text-orange-500', icon: 'Trash2' },
    adjustment: { label: 'Adjustment', color: 'text-blue-500', icon: 'ArrowUpDown' },
    return: { label: 'Return', color: 'text-purple-500', icon: 'RotateCcw' },
    transfer_in: { label: 'Transfer In', color: 'text-cyan-500', icon: 'ArrowDownLeft' },
    transfer_out: { label: 'Transfer Out', color: 'text-pink-500', icon: 'ArrowUpRight' },
    count: { label: 'Count', color: 'text-indigo-500', icon: 'ClipboardCheck' },
    initial: { label: 'Initial', color: 'text-gray-500', icon: 'Plus' },
  };
  return configs[type] || { label: type, color: 'text-gray-500', icon: 'Circle' };
}

/**
 * Get priority color for low stock items
 */
export function getPriorityColor(priority: LowStockItem['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/10 text-red-500 border-red-500';
    case 'high':
      return 'bg-orange-500/10 text-orange-500 border-orange-500';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500';
  }
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Calculate stock percentage
 */
export function calculateStockPercentage(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    meat: '🍖',
    vegetables: '🥬',
    dairy: '🥛',
    spices: '🌶️',
    oils: '🫒',
    packaging: '📦',
    beverages: '🥤',
    grains: '🌾',
    sauces: '🥫',
    frozen: '❄️',
    other: '📋',
  };
  return icons[category.toLowerCase()] || '📋';
}
