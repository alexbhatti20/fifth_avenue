// =============================================
// ZOIRO BROAST HUB - INVENTORY TYPES & CONSTANTS
// =============================================
// NOTE: This file contains ONLY types, constants, and client-safe utility functions
// All async server functions that use database calls are in server-queries.ts
// =============================================

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
// TYPES & INTERFACES
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
// UTILITY FUNCTIONS (Client-Safe)
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
