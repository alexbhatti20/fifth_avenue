'use server';

import { supabase } from '@/lib/supabase';
import { getAuthenticatedClient } from '@/lib/server-queries';
import { revalidatePath } from 'next/cache';
import {
  invalidateMenuCache,
  invalidateDealsCache,
  invalidateSiteContentCache,
} from '@/lib/cache';
import { sendMaintenanceNotificationBatch } from '@/lib/brevo';

// =============================================
// MENU MANAGEMENT SERVER ACTIONS
// =============================================

// Advanced menu item creation with size variants (hidden from Network tab)
export async function createMenuItemAdvanced(data: {
  category_id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number;
  has_variants: boolean;
  size_variants: { size: string; price: number; is_available: boolean }[] | null;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('create_menu_item_advanced', {
      p_category_id: data.category_id,
      p_name: data.name,
      p_description: data.description,
      p_price: data.price,
      p_images: data.images,
      p_is_available: data.is_available,
      p_is_featured: data.is_featured,
      p_preparation_time: data.preparation_time,
      p_has_variants: data.has_variants,
      p_size_variants: data.size_variants,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    await invalidateMenuCache(data.category_id);
    revalidatePath('/menu');
    revalidatePath('/portal/menu');

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create menu item' };
  }
}

// Advanced menu item update with size variants (hidden from Network tab)
export async function updateMenuItemAdvanced(data: {
  item_id: string;
  category_id?: string;
  name?: string;
  description?: string;
  price?: number;
  images?: string[];
  is_available?: boolean;
  is_featured?: boolean;
  preparation_time?: number;
  has_variants?: boolean;
  size_variants?: { size: string; price: number; is_available: boolean }[] | null;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('update_menu_item_advanced', {
      p_item_id: data.item_id,
      p_category_id: data.category_id || null,
      p_name: data.name || null,
      p_description: data.description || null,
      p_price: data.price || null,
      p_images: data.images || null,
      p_is_available: data.is_available ?? null,
      p_is_featured: data.is_featured ?? null,
      p_preparation_time: data.preparation_time || null,
      p_has_variants: data.has_variants ?? null,
      p_size_variants: data.size_variants || null,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/portal/menu');

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update menu item' };
  }
}

// Delete menu item (hidden from Network tab)
export async function deleteMenuItemServer(itemId: string) {
  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/portal/menu');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete menu item' };
  }
}

// Toggle menu item availability (hidden from Network tab)
export async function toggleMenuItemAvailability(itemId: string, isAvailable: boolean) {
  try {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;

    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/portal/menu');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to toggle availability' };
  }
}

// Category management (hidden from Network tab)
export async function manageMenuCategory(data: {
  action: 'create' | 'update' | 'delete' | 'toggle';
  category_id: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  display_order: number | null;
  is_visible: boolean | null;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('manage_menu_category', {
      p_action: data.action,
      p_category_id: data.category_id,
      p_name: data.name,
      p_slug: null,
      p_description: data.description,
      p_image_url: data.image_url,
      p_display_order: data.display_order,
      p_is_visible: data.is_visible,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/portal/menu');

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to manage category' };
  }
}

export async function createMenuItem(formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      category_id: formData.get('category_id') as string,
      images: JSON.parse(formData.get('images') as string || '[]'),
      is_available: formData.get('is_available') === 'true',
    };

    const { data: item, error } = await supabase
      .from('menu_items')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await invalidateMenuCache(data.category_id);
    revalidatePath('/menu');

    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: 'Failed to create menu item' };
  }
}

export async function updateMenuItem(id: string, formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      is_available: formData.get('is_available') === 'true',
    };

    const { data: item, error } = await supabase
      .from('menu_items')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate all menu cache
    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/admin/menu');

    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: 'Failed to update menu item' };
  }
}

export async function deleteMenuItem(id: string) {
  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await invalidateMenuCache();
    revalidatePath('/menu');
    revalidatePath('/admin/menu');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete menu item' };
  }
}

// =============================================
// DEAL MANAGEMENT SERVER ACTIONS (Hidden from Network tab)
// =============================================

// Create deal with items using RPC (hidden from Network tab)
export async function createDealWithItems(data: {
  name: string;
  description: string;
  code?: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  original_price: number;
  discounted_price: number;
  image_url?: string;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  is_active: boolean;
  items: { id: string; quantity: number }[];
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('create_deal_with_items', {
      p_name: data.name,
      p_description: data.description,
      p_code: data.code || null,
      p_deal_type: data.deal_type,
      p_original_price: data.original_price,
      p_discounted_price: data.discounted_price,
      p_image_url: data.image_url || null,
      p_valid_from: data.valid_from,
      p_valid_until: data.valid_until,
      p_usage_limit: data.usage_limit || null,
      p_is_active: data.is_active,
      p_items: data.items,
    });

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal/deals');

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create deal' };
  }
}

// Update deal with items using RPC (hidden from Network tab)
export async function updateDealWithItems(data: {
  deal_id: string;
  name?: string;
  description?: string;
  original_price?: number;
  discounted_price?: number;
  image_url?: string;
  valid_until?: string;
  usage_limit?: number;
  is_active?: boolean;
  items?: { id: string; quantity: number }[];
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('update_deal_with_items', {
      p_deal_id: data.deal_id,
      p_name: data.name || null,
      p_description: data.description || null,
      p_original_price: data.original_price || null,
      p_discounted_price: data.discounted_price || null,
      p_image_url: data.image_url || null,
      p_valid_until: data.valid_until || null,
      p_usage_limit: data.usage_limit || null,
      p_is_active: data.is_active ?? null,
      p_items: data.items || null,
    });

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal/deals');

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update deal' };
  }
}

// Toggle deal status using RPC (hidden from Network tab)
export async function toggleDealStatusServer(dealId: string) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('toggle_deal_active', {
      p_deal_id: dealId,
    });

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal/deals');

    return result || { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to toggle deal status' };
  }
}

// Delete deal using RPC (hidden from Network tab)
export async function deleteDealServer(dealId: string) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('delete_deal_cascade', {
      p_deal_id: dealId,
    });

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal/deals');

    return result || { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete deal' };
  }
}

// Get all deals with items (hidden from Network tab)
export async function getDealsServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_deals_with_items');

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch deals', data: [] };
  }
}

// Legacy FormData-based actions (kept for backward compatibility)
export async function createDeal(formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      original_price: parseFloat(formData.get('original_price') as string),
      discounted_price: parseFloat(formData.get('discounted_price') as string),
      items: JSON.parse(formData.get('items') as string),
      valid_from: formData.get('valid_from') as string,
      valid_until: formData.get('valid_until') as string,
      is_active: formData.get('is_active') === 'true',
    };

    const { data: deal, error } = await supabase
      .from('deals')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');

    return { success: true, data: deal };
  } catch (error) {
    return { success: false, error: 'Failed to create deal' };
  }
}

export async function updateDeal(id: string, formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      is_active: formData.get('is_active') === 'true',
    };

    const { data: deal, error } = await supabase
      .from('deals')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/admin/deals');

    return { success: true, data: deal };
  } catch (error) {
    return { success: false, error: 'Failed to update deal' };
  }
}

// =============================================
// ORDER MANAGEMENT SERVER ACTIONS
// =============================================

// Quick order status update (optimized for realtime, hidden from Network tab)
export async function updateOrderStatusQuickServer(
  orderId: string,
  status: string,
  notes?: string
) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('update_order_status_quick', {
      p_order_id: orderId,
      p_status: status,
      p_notes: notes || null,
    });

    if (error) throw error;

    revalidatePath('/portal/orders');
    revalidatePath('/portal/kitchen');

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update order status' };
  }
}

// Kitchen order status update (hidden from Network tab)
export async function updateKitchenOrderStatusServer(
  orderId: string,
  status: string
) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('update_kitchen_order_status', {
      p_order_id: orderId,
      p_status: status,
    });

    if (error) throw error;

    revalidatePath('/portal/kitchen');
    revalidatePath('/portal/orders');

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update kitchen order status' };
  }
}

// Fetch kitchen orders (for refresh, hidden from Network tab)
export async function fetchKitchenOrdersServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_kitchen_orders_v2');
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

// Fetch kitchen stats (for refresh, hidden from Network tab)
export async function fetchKitchenStatsServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_kitchen_stats');
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message, data: null };
  }
}

// Fetch completed orders by the current employee (kitchen history)
export async function fetchKitchenCompletedOrdersServer(params: {
  filterType: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_kitchen_completed_orders', {
      p_employee_id: null, // Will use current employee from auth context or pass null to see all
      p_filter_type: params.filterType,
      p_start_date: params.startDate || null,
      p_end_date: params.endDate || null,
      p_limit: params.limit || 50,
      p_offset: params.offset || 0,
    });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

// Fetch stats for completed kitchen orders
export async function fetchKitchenCompletedStatsServer(params: {
  filterType: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
}) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_kitchen_completed_stats', {
      p_employee_id: null,
      p_filter_type: params.filterType,
      p_start_date: params.startDate || null,
      p_end_date: params.endDate || null,
    });

    if (error) throw error;

    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    return { success: false, error: error.message, data: null };
  }
}

// Fetch orders advanced (for refresh/pagination, hidden from Network tab)
export async function fetchOrdersAdvancedServer(params?: {
  status?: string;
  order_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_orders_advanced', {
      p_status: params?.status || null,
      p_order_type: params?.order_type || null,
      p_date_from: params?.date_from || null,
      p_date_to: params?.date_to || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0,
    });

    if (error) throw error;

    return { 
      success: true, 
      orders: data || [],
      total_count: data?.length || 0,
      has_more: (data?.length || 0) >= (params?.limit || 50)
    };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [], total_count: 0, has_more: false };
  }
}

// Fetch orders stats (for refresh, hidden from Network tab)
export async function fetchOrdersStatsServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_orders_stats');
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message, data: null };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  notes?: string
) {
  try {
    const { error } = await (await getAuthenticatedClient()).rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: status,
      p_notes: notes || null,
    });

    if (error) throw error;

    revalidatePath('/admin/orders');
    revalidatePath(`/orders/${orderId}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update order status' };
  }
}

// =============================================
// SITE CONTENT SERVER ACTIONS
// =============================================

export async function updateSiteContent(section: string, formData: FormData) {
  try {
    const data = {
      content: JSON.parse(formData.get('content') as string),
      is_active: formData.get('is_active') === 'true',
    };

    const { data: content, error } = await supabase
      .from('site_content')
      .update(data)
      .eq('section', section)
      .select()
      .single();

    if (error) throw error;

    await invalidateSiteContentCache(section);
    revalidatePath('/');

    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: 'Failed to update site content' };
  }
}

// =============================================
// REVIEW MANAGEMENT SERVER ACTIONS
// =============================================

export async function toggleReviewVisibility(reviewId: string, isVisible: boolean) {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ is_visible: isVisible })
      .eq('id', reviewId);

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/reviews');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to toggle review visibility' };
  }
}

// =============================================
// TABLE MANAGEMENT SERVER ACTIONS
// =============================================

export async function assignTable(orderId: string, tableId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('assign_table_to_order', {
      p_order_id: orderId,
      p_table_id: tableId,
    });

    if (error) throw error;
    if (!data) return { success: false, error: 'Table not available' };

    revalidatePath('/admin/tables');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to assign table' };
  }
}

export async function releaseTable(tableId: string) {
  try {
    const { error } = await (await getAuthenticatedClient()).rpc('release_table', {
      p_table_id: tableId,
    });

    if (error) throw error;

    revalidatePath('/admin/tables');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to release table' };
  }
}

// =============================================
// BILLING SERVER ACTIONS
// =============================================

// Quick bill generation - instant bill with default settings (OPTIMIZED)
export async function generateQuickBill(orderId: string, billerId?: string) {
  try {
    // Use optimized quick_bill RPC for instant generation
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('generate_quick_bill', {
      p_order_id: orderId,
      p_biller_id: billerId || null,
    });

    if (error) {
      // Fallback to full invoice if quick_bill RPC doesn't exist
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        const { data: fallbackResult, error: fallbackError } = await (await getAuthenticatedClient()).rpc('generate_advanced_invoice', {
          p_order_id: orderId,
          p_payment_method: 'cash',
          p_manual_discount: 0,
          p_tip: 0,
          p_service_charge: 0,
          p_promo_code: null,
          p_loyalty_points_used: 0,
          p_notes: 'Quick bill generated',
          p_biller_id: billerId || null,
        });
        if (fallbackError) throw fallbackError;
        if (fallbackResult && !fallbackResult.success) {
          return { success: false, error: fallbackResult.error || 'Failed to generate bill' };
        }
        revalidatePath('/portal/orders');
        revalidatePath('/portal/billing');
        return { 
          success: true, 
          data: fallbackResult,
          invoice_number: fallbackResult?.invoice_number,
          invoice_id: fallbackResult?.invoice_id 
        };
      }
      throw error;
    }
    
    if (result && !result.success) {
      return { success: false, error: result.error || 'Failed to generate bill' };
    }

    revalidatePath('/portal/orders');
    revalidatePath('/portal/billing');

    return { 
      success: true, 
      data: result,
      invoice_number: result?.invoice_number,
      invoice_id: result?.invoice_id 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate bill' };
  }
}

// Full bill generation with all options
export async function generateFullBill(data: {
  orderId: string;
  paymentMethod: 'cash' | 'card' | 'online' | 'wallet';
  manualDiscount?: number;
  tip?: number;
  serviceCharge?: number;
  promoCode?: string;
  loyaltyPointsUsed?: number;
  notes?: string;
  billerId?: string;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('generate_advanced_invoice', {
      p_order_id: data.orderId,
      p_payment_method: data.paymentMethod,
      p_manual_discount: data.manualDiscount || 0,
      p_tip: data.tip || 0,
      p_service_charge: data.serviceCharge || 0,
      p_promo_code: data.promoCode || null,
      p_loyalty_points_used: data.loyaltyPointsUsed || 0,
      p_notes: data.notes || null,
      p_biller_id: data.billerId || null,
    });

    if (error) throw error;
    if (result && !result.success) {
      return { success: false, error: result.error || 'Failed to generate bill' };
    }

    revalidatePath('/portal/orders');
    revalidatePath('/portal/billing');

    return { 
      success: true, 
      data: result,
      invoice_number: result?.invoice_number,
      invoice_id: result?.invoice_id 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate bill' };
  }
}

// Mark invoice as paid
export async function markInvoicePaid(invoiceId: string, paymentMethod?: string) {
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ 
        payment_status: 'paid',
        bill_status: 'paid',
        payment_method: paymentMethod || 'cash',
        paid_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (error) throw error;

    revalidatePath('/portal/orders');
    revalidatePath('/portal/billing');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to mark as paid' };
  }
}

// Get order details for billing (SSR - hidden from Network tab)
export async function getOrderForBilling(orderId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_order_for_billing', {
      p_order_id: orderId,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get order details' };
  }
}

// Validate promo code for billing (SSR - hidden from Network tab)
export async function validatePromoCodeForBilling(code: string, customerId?: string, orderAmount?: number) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('validate_promo_code_for_billing', {
      p_code: code,
      p_customer_id: customerId || null,
      p_order_amount: orderAmount || 0,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to validate promo code' };
  }
}

// Get invoice details for print (SSR - hidden from Network tab)
export async function getInvoiceDetails(invoiceId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_invoice_details', {
      p_invoice_id: invoiceId,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get invoice details' };
  }
}

// Mark invoice as printed (SSR)
export async function markInvoicePrinted(invoiceId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('mark_invoice_printed', {
      p_invoice_id: invoiceId,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to mark invoice as printed' };
  }
}

// Get billing dashboard stats (SSR)
export async function getBillingDashboardStats() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_billing_dashboard_stats');

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get billing stats' };
  }
}

// Get billing pending orders (SSR)
export async function getBillingPendingOrders(limit: number = 10) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_billing_pending_orders', {
      p_limit: limit,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get pending orders' };
  }
}

// Get recent invoices (SSR)
export async function getRecentInvoices(startDate?: string, endDate?: string, paymentMethod?: string, limit: number = 50) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_recent_invoices', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_payment_method: paymentMethod || null,
      p_limit: limit,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get recent invoices' };
  }
}

// Void an invoice (SSR)
export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('void_invoice', {
      p_invoice_id: invoiceId,
      p_reason: reason,
    });

    if (error) throw error;
    revalidatePath('/portal/billing');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to void invoice' };
  }
}

// Get billable orders for pending orders list (SSR)
export async function getBillableOrders(orderType?: string, statusFilter: string = 'pending_bill', limit: number = 50, offset: number = 0) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_billable_orders', {
      p_order_type: orderType || null,
      p_status_filter: statusFilter,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get billable orders' };
  }
}

// =============================================
// CUSTOMER MANAGEMENT SERVER ACTIONS
// =============================================

// Get customer detail (Server Action - hidden from Network tab)
export async function getCustomerDetailServer(customerId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_customer_detail_admin', {
      p_customer_id: customerId,
    });

    if (error) throw error;
    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get customer details', data: null };
  }
}

// =============================================
// CUSTOMER BAN/UNBAN SERVER ACTIONS
// =============================================

export async function banCustomerServer(data: {
  customerId: string;
  reason: string;
  bannedBy: string;
  sendEmail: boolean;
  email?: string;
  name?: string;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('ban_customer', {
      p_customer_id: data.customerId,
      p_reason: data.reason,
      p_banned_by: data.bannedBy,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    // Send email notification asynchronously (don't block)
    if (data.sendEmail && data.email && data.name) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/customer/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ban',
          email: data.email,
          name: data.name,
          reason: data.reason,
        }),
      }).catch(() => {}); // Silent fail for email
    }

    revalidatePath('/portal/customers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function unbanCustomerServer(data: {
  customerId: string;
  unbannedBy: string;
  sendEmail: boolean;
  email?: string;
  name?: string;
  reason?: string;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('unban_customer', {
      p_customer_id: data.customerId,
      p_unbanned_by: data.unbannedBy,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    // Send email notification asynchronously (don't block)
    if (data.sendEmail && data.email && data.name) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/customer/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'unban',
          email: data.email,
          name: data.name,
          reason: data.reason,
        }),
      }).catch(() => {}); // Silent fail for email
    }

    revalidatePath('/portal/customers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Refresh customers list (for client-side refresh)
export async function refreshCustomersServer(params?: {
  search?: string;
  filter?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_all_customers_admin', {
      p_limit: params?.limit || 100,
      p_offset: params?.offset || 0,
      p_search: params?.search || null,
      p_filter: params?.filter || 'all',
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

// Refresh customer stats (for client-side refresh)
export async function refreshCustomerStatsServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_customers_stats');

    if (error) throw error;
    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    return { success: false, error: error.message, data: null };
  }
}

// =============================================
// INVENTORY SERVER ACTIONS
// =============================================

export async function createInventoryItemServer(itemData: {
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
}) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('create_inventory_item', {
      p_name: itemData.name,
      p_sku: itemData.sku || null,
      p_category: itemData.category,
      p_unit: itemData.unit,
      p_quantity: itemData.quantity || 0,
      p_min_quantity: itemData.min_quantity || 10,
      p_max_quantity: itemData.max_quantity || 100,
      p_cost_per_unit: itemData.cost_per_unit || 0,
      p_supplier: itemData.supplier || null,
      p_notes: itemData.notes || null,
      p_location: itemData.location || null,
      p_barcode: itemData.barcode || null,
      p_expiry_date: itemData.expiry_date || null,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/portal/inventory');
    return { success: true, data };
  } catch (error: any) {
    console.error('createInventoryItemServer error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateInventoryItemServer(
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
    location?: string;
    barcode?: string;
    expiry_date?: string;
    reorder_point?: number;
    lead_time_days?: number;
  }
) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('update_inventory_item', {
      p_item_id: itemId,
      p_name: updates.name || null,
      p_sku: updates.sku || null,
      p_category: updates.category || null,
      p_unit: updates.unit || null,
      p_min_quantity: updates.min_quantity || null,
      p_max_quantity: updates.max_quantity || null,
      p_cost_per_unit: updates.cost_per_unit || null,
      p_supplier: updates.supplier || null,
      p_notes: updates.notes || null,
      p_location: updates.location || null,
      p_barcode: updates.barcode || null,
      p_expiry_date: updates.expiry_date || null,
      p_reorder_point: updates.reorder_point || null,
      p_lead_time_days: updates.lead_time_days || null,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/portal/inventory');
    return { success: true, data };
  } catch (error: any) {
    console.error('updateInventoryItemServer error:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteInventoryItemServer(itemId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('delete_inventory_item', {
      p_item_id: itemId,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/portal/inventory');
    return { success: true };
  } catch (error: any) {
    console.error('deleteInventoryItemServer error:', error);
    return { success: false, error: error.message };
  }
}

export async function adjustInventoryStockServer(data: {
  itemId: string;
  transactionType: string;
  quantity: number;
  reason?: string;
  unitCost?: number;
  referenceNumber?: string;
  batchNumber?: string;
}) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('adjust_inventory_stock', {
      p_item_id: data.itemId,
      p_transaction_type: data.transactionType,
      p_quantity: data.quantity,
      p_reason: data.reason || null,
      p_unit_cost: data.unitCost || null,
      p_reference_number: data.referenceNumber || null,
      p_batch_number: data.batchNumber || null,
    });

    if (error) throw error;
    if (result && !result.success) throw new Error(result.error);

    revalidatePath('/portal/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('adjustInventoryStockServer error:', error);
    return { success: false, error: error.message };
  }
}

export async function refreshInventoryServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_items');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function refreshInventorySummaryServer() {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_summary');

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message, data: null };
  }
}

export async function getInventoryTransactionsServer(itemId: string, limit: number = 50) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('get_inventory_transactions', {
      p_item_id: itemId,
      p_start_date: null,
      p_end_date: null,
      p_limit: limit,
      p_transaction_type: null,
    });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('getInventoryTransactionsServer error:', error);
    throw new Error(error.message || 'Failed to load transactions');
  }
}

export async function deleteInventoryTransactionServer(transactionId: string, itemId: string) {
  try {
    const client = await getAuthenticatedClient();
    
    // First, get the transaction to reverse its effect
    const { data: transaction, error: fetchError } = await client
      .from('inventory_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Delete the transaction
    const { error: deleteError } = await client
      .from('inventory_transactions')
      .delete()
      .eq('id', transactionId);

    if (deleteError) throw deleteError;

    // Recalculate and update the item's current stock based on remaining transactions
    // Get the latest transaction for this item to know the current stock
    const { data: latestTransaction, error: latestError } = await client
      .from('inventory_transactions')
      .select('new_stock')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate new stock: if there are remaining transactions, use the latest new_stock
    // If no transactions remain, we need to calculate from the initial state
    let newCurrentStock: number;
    if (latestError || !latestTransaction) {
      // No transactions left, recalculate from scratch
      const { data: allTransactions } = await client
        .from('inventory_transactions')
        .select('quantity, transaction_type')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      // Start from 0 and apply all remaining transactions
      newCurrentStock = (allTransactions || []).reduce((stock, t) => {
        if (['purchase', 'return', 'transfer_in'].includes(t.transaction_type)) {
          return stock + t.quantity;
        } else if (['usage', 'waste', 'transfer_out'].includes(t.transaction_type)) {
          return stock - Math.abs(t.quantity);
        } else if (['count', 'adjustment'].includes(t.transaction_type)) {
          return t.quantity;
        }
        return stock;
      }, 0);
    } else {
      newCurrentStock = latestTransaction.new_stock;
    }

    // Update the item's current stock
    const { error: updateError } = await client
      .from('inventory_items')
      .update({ current_stock: Math.max(0, newCurrentStock) })
      .eq('id', itemId);

    if (updateError) {
      console.error('Failed to update stock after deletion:', updateError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('deleteInventoryTransactionServer error:', error);
    throw new Error(error.message || 'Failed to delete transaction');
  }
}

// =============================================
// EMPLOYEE MANAGEMENT SERVER ACTIONS (SSR - HIDDEN FROM DEV TOOLS)
// =============================================

/**
 * Toggle block/unblock employee - Server action (hidden from browser)
 * Uses authenticated RPC with SECURITY DEFINER
 */
export async function toggleBlockEmployeeServer(
  employeeId: string,
  reason?: string,
  options?: {
    sendEmail?: boolean;
    employeeEmail?: string;
    employeeName?: string;
    employeeIdNumber?: string;
  }
): Promise<{ 
  success: boolean; 
  action?: string;
  portal_enabled?: boolean;
  message?: string;
  error?: string 
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('toggle_block_employee', {
      p_employee_id: employeeId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('toggleBlockEmployeeServer RPC error:', error);
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

    // Send email notification if requested (server-side, secure)
    if (options?.sendEmail && options?.employeeEmail && options?.employeeName) {
      try {
        const { sendEmployeeBlockedNotification, sendEmployeeUnblockedNotification } = await import('@/lib/brevo');
        const actionDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric', 
          month: 'long', 
          year: 'numeric'
        });

        if (data.action === 'blocked') {
          await sendEmployeeBlockedNotification(
            options.employeeEmail,
            options.employeeName,
            options.employeeIdNumber || employeeId,
            reason || 'No reason provided',
            actionDate
          );
        } else if (data.action === 'unblocked') {
          await sendEmployeeUnblockedNotification(
            options.employeeEmail,
            options.employeeName,
            options.employeeIdNumber || employeeId,
            reason || 'No reason provided',
            actionDate
          );
        }
      } catch (emailError: any) {
        // Don't fail the whole operation if email fails
        console.error('Failed to send email notification:', emailError);
      }
    }

    // Revalidate relevant paths
    revalidatePath('/portal/employees');
    revalidatePath(`/portal/employees/${employeeId}`);

    return {
      success: true,
      action: data.action,
      portal_enabled: data.portal_enabled,
      message: data.message,
    };
  } catch (error: any) {
    console.error('toggleBlockEmployeeServer error:', error);
    return { 
      success: false, 
      error: error.message || 'Server error while toggling employee block status' 
    };
  }
}

/**
 * Update employee profile - Server action (SSR, hidden from browser)
 * Uses authenticated RPC with SECURITY DEFINER
 */
export async function updateEmployeeProfileServer(
  employeeId: string,
  updates: {
    name?: string;
    phone?: string;
    address?: string;
    emergency_contact?: string;
    avatar_url?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('update_employee_complete', {
      p_employee_id: employeeId,
      p_data: updates,
    });

    if (error) {
      console.error('updateEmployeeProfileServer RPC error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update employee profile' 
      };
    }

    if (data && !data.success) {
      return { 
        success: false, 
        error: data.error || 'Failed to update employee profile' 
      };
    }

    // Note: Not calling revalidatePath to avoid page reload
    // Client handles local state update directly

    return { success: true };
  } catch (error: any) {
    console.error('updateEmployeeProfileServer error:', error);
    return { 
      success: false, 
      error: error.message || 'Server error while updating employee profile' 
    };
  }
}

// =============================================
// EMPLOYEE PAYROLL SERVER ACTIONS (v3 - Advanced)
// =============================================

/**
 * Helper: Get current employee via authenticated RPC (bypasses RLS)
 * Uses getAuthenticatedClient + getServerSession to reliably get employee data
 */
async function getPayrollAdmin() {
  const { getAuthenticatedClient, getServerSession } = await import('@/lib/server-queries');
  const user = await getServerSession();
  if (!user?.id) return null;
  
  const client = await getAuthenticatedClient();
  const { data } = await client.rpc('get_employee_by_auth_user', {
    p_auth_user_id: user.id,
  });
  
  if (!data) return null;
  
  // RPC returns {success, data: employee} or direct employee object
  const emp = (data as any)?.data || data;
  if (!emp?.role || emp.role !== 'admin') return null;
  
  return emp;
}

/**
 * Get employee payroll summary - Server action (SSR, hidden from browser)
 */
export async function getEmployeePayrollSummaryAction(
  employeeId: string
): Promise<any> {
  try {
    const { getEmployeePayrollSummaryServer } = await import('@/lib/server-queries');
    const data = await getEmployeePayrollSummaryServer(employeeId);
    return data;
  } catch (error: any) {
    console.error('getEmployeePayrollSummaryAction error:', error);
    return null;
  }
}

/**
 * Create Payslip - Server action (SSR, hidden from browser)
 */
export async function createPayslipAction(data: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  overtimeHours?: number;
  overtimeRate?: number;
  bonuses?: number;
  deductions?: number;
  taxAmount?: number;
  paymentMethod?: string;
  notes?: string;
  createdBy?: string;
}): Promise<{ success: boolean; id?: string; netSalary?: number; employeeName?: string; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('create_payslip_advanced', {
      p_employee_id: data.employeeId,
      p_period_start: data.periodStart,
      p_period_end: data.periodEnd,
      p_base_salary: data.baseSalary,
      p_overtime_hours: data.overtimeHours || 0,
      p_overtime_rate: data.overtimeRate || 1.5,
      p_bonuses: data.bonuses || 0,
      p_deductions: data.deductions || 0,
      p_tax_amount: data.taxAmount || 0,
      p_payment_method: data.paymentMethod || null,
      p_notes: data.notes || null,
      p_created_by: data.createdBy || emp.id || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: result?.success, id: result?.id, netSalary: result?.net_salary, employeeName: result?.employee_name, error: result?.error };
  } catch (error: any) {
    console.error('createPayslipAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Update Payslip - Server action (SSR, hidden from browser) 
 */
export async function updatePayslipAction(data: {
  payslipId: string;
  status?: string;
  paymentMethod?: string;
  bonuses?: number;
  deductions?: number;
  taxAmount?: number;
  overtimeHours?: number;
  notes?: string;
}): Promise<{ success: boolean; netSalary?: number; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('update_payslip_advanced', {
      p_payslip_id: data.payslipId,
      p_status: data.status || null,
      p_payment_method: data.paymentMethod || null,
      p_bonuses: data.bonuses ?? null,
      p_deductions: data.deductions ?? null,
      p_tax_amount: data.taxAmount ?? null,
      p_overtime_hours: data.overtimeHours ?? null,
      p_notes: data.notes || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: result?.success, netSalary: result?.net_salary, error: result?.error };
  } catch (error: any) {
    console.error('updatePayslipAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Delete Payslip - Server action (SSR, hidden from browser)
 */
export async function deletePayslipAction(payslipId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('delete_payslip_advanced', {
      p_payslip_id: payslipId,
    });

    if (error) return { success: false, error: error.message };
    return result || { success: false, error: 'Unknown error' };
  } catch (error: any) {
    console.error('deletePayslipAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Update Employee Salary - Server action (SSR, hidden from browser)
 */
export async function updateEmployeeSalaryAction(data: {
  employeeId: string;
  newSalary: number;
  paymentFrequency?: string;
  bankDetails?: Record<string, any>;
}): Promise<{ success: boolean; oldSalary?: number; newSalary?: number; employeeName?: string; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('update_employee_salary', {
      p_employee_id: data.employeeId,
      p_new_salary: data.newSalary,
      p_payment_frequency: data.paymentFrequency || null,
      p_bank_details: data.bankDetails || null,
      p_updated_by: emp.id || null,
    });

    if (error) return { success: false, error: error.message };
    return { 
      success: result?.success, 
      oldSalary: result?.old_salary, 
      newSalary: result?.new_salary, 
      employeeName: result?.employee_name,
      error: result?.error 
    };
  } catch (error: any) {
    console.error('updateEmployeeSalaryAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Bulk Pay Payslips - Server action (SSR, hidden from browser)
 */
export async function bulkPayPayslipsAction(
  payslipIds: string[],
  paymentMethod: string = 'bank_transfer'
): Promise<{ success: boolean; paidCount?: number; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('bulk_pay_payslips', {
      p_payslip_ids: payslipIds,
      p_payment_method: paymentMethod,
    });

    if (error) return { success: false, error: error.message };
    return { success: result?.success, paidCount: result?.paid_count, error: result?.error };
  } catch (error: any) {
    console.error('bulkPayPayslipsAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Bulk Delete Payslips - Server action (SSR, hidden from browser)
 */
export async function bulkDeletePayslipsAction(
  payslipIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const { getAuthenticatedClient } = await import('@/lib/server-queries');
    
    const emp = await getPayrollAdmin();
    if (!emp) return { success: false, error: 'Admin access required' };
    
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('bulk_delete_payslips', {
      p_payslip_ids: payslipIds,
    });

    if (error) return { success: false, error: error.message };
    return { success: result?.success, deletedCount: result?.deleted_count, error: result?.error };
  } catch (error: any) {
    console.error('bulkDeletePayslipsAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Get Payslip Detail for PDF - Server action (SSR, hidden from browser)
 */
export async function getPayslipDetailAction(payslipId: string): Promise<any> {
  try {
    const { getPayslipDetailServer } = await import('@/lib/server-queries');
    return await getPayslipDetailServer(payslipId);
  } catch (error: any) {
    console.error('getPayslipDetailAction error:', error);
    return null;
  }
}

// =============================================
// PAYMENT METHODS SERVER ACTIONS (SSR - Admin Only)
// =============================================

interface PaymentMethodData {
  method_type: 'jazzcash' | 'easypaisa' | 'bank';
  method_name: string;
  account_number: string;
  account_holder_name: string;
  bank_name?: string;
  is_active?: boolean;
  display_order?: number;
}

/**
 * Get all payment methods - Server action (SSR, hidden from browser)
 * Uses RPC function to bypass RLS
 */
export async function getPaymentMethodsServerAction(): Promise<{
  success: boolean;
  methods?: any[];
  stats?: any;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data, error } = await client.rpc('get_all_payment_methods');

    if (error) {
      console.error('getPaymentMethodsServerAction RPC error:', error);
      return { success: false, error: error.message || 'Failed to fetch payment methods' };
    }

    // RPC returns JSON with success, methods, stats
    const result = data as any;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to fetch payment methods' };
    }

    return {
      success: true,
      methods: result.methods || [],
      stats: result.stats || null,
    };
  } catch (error: any) {
    console.error('getPaymentMethodsServerAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Create payment method - Server action (SSR, hidden from browser)
 * Uses RPC function to bypass RLS
 */
export async function createPaymentMethodServer(data: PaymentMethodData): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data: result, error } = await client.rpc('create_payment_method', {
      p_method_type: data.method_type,
      p_method_name: data.method_name,
      p_account_number: data.account_number,
      p_account_holder_name: data.account_holder_name,
      p_bank_name: data.bank_name || null,
      p_is_active: data.is_active ?? true,
      p_display_order: data.display_order ?? 0,
    });

    if (error) {
      console.error('createPaymentMethodServer RPC error:', error);
      return { success: false, error: error.message || 'Failed to create payment method' };
    }

    // RPC returns JSON with success, id
    const rpcResult = result as any;
    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to create payment method' };
    }

    // Invalidate cache
    const { invalidatePaymentMethodsCache } = await import('@/lib/cache');
    await invalidatePaymentMethodsCache();

    return { success: true, id: rpcResult.id };
  } catch (error: any) {
    console.error('createPaymentMethodServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Update payment method - Server action (SSR, hidden from browser)
 * Uses RPC function to bypass RLS
 */
export async function updatePaymentMethodServer(
  id: string,
  data: Partial<PaymentMethodData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data: result, error } = await client.rpc('update_payment_method', {
      p_id: id,
      p_method_type: data.method_type ?? null,
      p_method_name: data.method_name ?? null,
      p_account_number: data.account_number ?? null,
      p_account_holder_name: data.account_holder_name ?? null,
      p_bank_name: data.bank_name ?? null,
      p_is_active: data.is_active ?? null,
      p_display_order: data.display_order ?? null,
    });

    if (error) {
      console.error('updatePaymentMethodServer RPC error:', error);
      return { success: false, error: error.message || 'Failed to update payment method' };
    }

    // RPC returns JSON with success
    const rpcResult = result as any;
    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to update payment method' };
    }

    // Invalidate cache
    const { invalidatePaymentMethodsCache } = await import('@/lib/cache');
    await invalidatePaymentMethodsCache();

    return { success: true };
  } catch (error: any) {
    console.error('updatePaymentMethodServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Delete payment method - Server action (SSR, hidden from browser)
 * Uses RPC function to bypass RLS
 */
export async function deletePaymentMethodServer(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data: result, error } = await client.rpc('delete_payment_method', {
      p_id: id,
    });

    if (error) {
      console.error('deletePaymentMethodServer RPC error:', error);
      return { success: false, error: error.message || 'Failed to delete payment method' };
    }

    // RPC returns JSON with success
    const rpcResult = result as any;
    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to delete payment method' };
    }

    // Invalidate cache
    const { invalidatePaymentMethodsCache } = await import('@/lib/cache');
    await invalidatePaymentMethodsCache();

    return { success: true };
  } catch (error: any) {
    console.error('deletePaymentMethodServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Toggle payment method status - Server action (SSR, hidden from browser)
 * Uses RPC function to bypass RLS
 */
export async function togglePaymentMethodStatusServer(
  id: string,
  is_active: boolean
): Promise<{ success: boolean; is_active?: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    // Use RPC function (SECURITY DEFINER, checks auth internally)
    const { data: result, error } = await client.rpc('toggle_payment_method_status', {
      p_id: id,
      p_is_active: is_active,
    });

    if (error) {
      console.error('togglePaymentMethodStatusServer RPC error:', error);
      return { success: false, error: error.message || 'Failed to toggle payment method status' };
    }

    // RPC returns JSON with success, is_active
    const rpcResult = result as any;
    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to toggle payment method status' };
    }

    // Invalidate cache
    const { invalidatePaymentMethodsCache } = await import('@/lib/cache');
    await invalidatePaymentMethodsCache();

    return { success: true, is_active: rpcResult.is_active };
  } catch (error: any) {
    console.error('togglePaymentMethodStatusServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

// =============================================
// MAINTENANCE MODE SERVER ACTIONS (SSR - Admin Only)
// =============================================

export interface MaintenanceSettings {
  is_enabled: boolean;
  reason_type: 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom';
  custom_reason?: string;
  title?: string;
  message?: string;
  estimated_restore_time?: string;
  show_timer?: boolean;
  show_progress?: boolean;
}

export interface MaintenanceStatus {
  is_enabled: boolean;
  reason_type: string;
  custom_reason?: string;
  title: string;
  message?: string;
  estimated_restore_time?: string;
  show_timer: boolean;
  show_progress: boolean;
  enabled_at?: string;
}

/**
 * Get maintenance mode status - Server action (SSR, public)
 * Uses base supabase client (no auth required)
 */
export async function getMaintenanceStatusServer(): Promise<{
  success: boolean;
  data?: MaintenanceStatus;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_maintenance_status');

    if (error) {
      console.error('getMaintenanceStatusServer RPC error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MaintenanceStatus };
  } catch (error: any) {
    console.error('getMaintenanceStatusServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Toggle maintenance mode - Server action (SSR, admin only)
 */
export async function toggleMaintenanceModeServer(
  settings: MaintenanceSettings,
  employeeId?: string
): Promise<{
  success: boolean;
  is_enabled?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data: result, error } = await client.rpc('toggle_maintenance_mode', {
      p_is_enabled: settings.is_enabled,
      p_reason_type: settings.reason_type,
      p_custom_reason: settings.custom_reason || null,
      p_title: settings.title || null,
      p_message: settings.message || null,
      p_estimated_restore_time: settings.estimated_restore_time || null,
      p_show_timer: settings.show_timer ?? true,
      p_show_progress: settings.show_progress ?? true,
      p_employee_id: employeeId || null,
    });

    if (error) {
      console.error('toggleMaintenanceModeServer RPC error:', error);
      return { success: false, error: error.message };
    }

    const rpcResult = result as any;
    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to toggle maintenance mode' };
    }

    // Revalidate all pages to reflect maintenance status
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal');

    return {
      success: true,
      is_enabled: rpcResult.is_enabled,
      message: rpcResult.message,
    };
  } catch (error: any) {
    console.error('toggleMaintenanceModeServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Send maintenance notification to all users - Server action (SSR, admin only)
 * Delegates to API route to avoid serialization issues
 */
export async function sendMaintenanceNotificationToAllServer(
  settings: MaintenanceSettings
): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  error: string;
  customerCount: number;
  employeeCount: number;
}> {
  try {
    // Call API route to handle email sending
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/maintenance/send-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error' }));
      return {
        success: false,
        error: String(errorData.error || 'API request failed'),
        sentCount: 0,
        failedCount: 0,
        customerCount: 0,
        employeeCount: 0,
      };
    }

    const result = await response.json();
    return {
      success: result.success || false,
      sentCount: result.sentCount || 0,
      failedCount: result.failedCount || 0,
      error: String(result.error || ''),
      customerCount: result.customerCount || 0,
      employeeCount: result.employeeCount || 0,
    };
  } catch (error: any) {
    console.error('sendMaintenanceNotificationToAllServer error:', error);
    return {
      success: false,
      error: String(error?.message || 'Server error'),
      sentCount: 0,
      failedCount: 0,
      customerCount: 0,
      employeeCount: 0,
    };
  }
}

// =============================================
// WEBSITE SETTINGS - SERVER ACTIONS (SSR)
// =============================================

export interface WebsiteSettingsData {
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

/**
 * Get website settings - Server action (SSR, admin only)
 * No client-side requests visible in devtools
 */
export async function getWebsiteSettingsServerAction(): Promise<{
  success: boolean;
  settings?: WebsiteSettingsData;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('get_website_settings_internal');

    if (error) {
      console.error('getWebsiteSettingsServerAction RPC error:', error);
      return { success: false, error: error.message };
    }

    if (data?.settings) {
      return {
        success: true,
        settings: data.settings as WebsiteSettingsData,
      };
    }

    return { success: true, settings: undefined };
  } catch (error: any) {
    console.error('getWebsiteSettingsServerAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Update website settings - Server action (SSR, admin only)
 * No client-side requests visible in devtools
 */
export async function updateWebsiteSettingsServer(
  settings: WebsiteSettingsData
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('upsert_website_settings_internal', {
      p_settings: settings,
    });

    if (error) {
      console.error('updateWebsiteSettingsServer RPC error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('updateWebsiteSettingsServer error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

// =============================================
// EMPLOYEE PROFILE - SERVER ACTIONS (SSR)
// =============================================

export interface EmployeeProfileData {
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

/**
 * Get employee profile - Server action (SSR)
 * No client-side requests visible in devtools
 */
export async function getEmployeeProfileServerAction(
  employeeId: string
): Promise<{
  success: boolean;
  employee?: EmployeeProfileData;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('get_employee_profile_by_id', {
      p_employee_id: employeeId,
    });

    if (error) {
      console.error('getEmployeeProfileServerAction RPC error:', error);
      return { success: false, error: error.message };
    }

    if (data?.success && data?.employee) {
      return {
        success: true,
        employee: data.employee as EmployeeProfileData,
      };
    }

    return { success: false, error: data?.error || 'Profile not found' };
  } catch (error: any) {
    console.error('getEmployeeProfileServerAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}
// =============================================
// CONTACT MESSAGES - SERVER ACTIONS (SSR)
// For admin/manager portal management
// =============================================

import { sendContactMessageReply } from '@/lib/brevo';

/**
 * Update contact message status (SSR)
 */
export async function updateContactMessageStatusAction(
  messageId: string,
  status: 'unread' | 'read' | 'replied' | 'archived'
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('update_contact_message_status', {
      p_message_id: messageId,
      p_status: status,
    });

    if (error) {
      console.error('updateContactMessageStatusAction RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to update status' };
    }

    revalidatePath('/portal/messages');
    return { success: true };
  } catch (error: any) {
    console.error('updateContactMessageStatusAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Update contact message priority (SSR)
 */
export async function updateContactMessagePriorityAction(
  messageId: string,
  priority: 'low' | 'normal' | 'high' | 'urgent'
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('update_contact_message_priority', {
      p_message_id: messageId,
      p_priority: priority,
    });

    if (error) {
      console.error('updateContactMessagePriorityAction RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to update priority' };
    }

    revalidatePath('/portal/messages');
    return { success: true };
  } catch (error: any) {
    console.error('updateContactMessagePriorityAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Reply to contact message and send email (SSR)
 */
export async function replyToContactMessageAction(
  messageId: string,
  replyMessage: string,
  repliedById: string,
  repliedByName: string,
  originalMessage: string,
  originalSubject?: string,
  sendVia: 'email' | 'phone' | 'both' = 'email'
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  try {
    const client = await getAuthenticatedClient();
    
    // Save reply to database
    const { data, error } = await client.rpc('add_contact_message_reply', {
      p_message_id: messageId,
      p_reply_message: replyMessage,
      p_replied_by: repliedById,
      p_send_via: sendVia,
    });

    if (error) {
      console.error('replyToContactMessageAction RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { 
      success: boolean; 
      error?: string; 
      send_email?: boolean;
      recipient_email?: string;
      recipient_name?: string;
    };
    
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to save reply' };
    }

    // Send email if requested
    let emailSent = false;
    if (result.send_email && result.recipient_email && sendVia !== 'phone') {
      try {
        const emailResult = await sendContactMessageReply(
          result.recipient_email,
          result.recipient_name || 'Customer',
          originalMessage,
          replyMessage,
          repliedByName,
          originalSubject
        );
        emailSent = emailResult.success;
        
        if (!emailResult.success) {
          console.warn('Email send failed but reply saved:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Reply is saved, just email failed
      }
    }

    revalidatePath('/portal/messages');
    return { success: true, emailSent };
  } catch (error: any) {
    console.error('replyToContactMessageAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Bulk delete contact messages (Admin only - SSR)
 */
export async function bulkDeleteContactMessagesAction(
  messageIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('bulk_delete_contact_messages', {
      p_message_ids: messageIds,
    });

    if (error) {
      console.error('bulkDeleteContactMessagesAction RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; deleted_count?: number; error?: string };
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to delete messages' };
    }

    revalidatePath('/portal/messages');
    return { success: true, deletedCount: result.deleted_count || 0 };
  } catch (error: any) {
    console.error('bulkDeleteContactMessagesAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}

/**
 * Bulk update contact message status (SSR)
 */
export async function bulkUpdateContactStatusAction(
  messageIds: string[],
  status: 'unread' | 'read' | 'replied' | 'archived'
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('bulk_update_contact_status', {
      p_message_ids: messageIds,
      p_status: status,
    });

    if (error) {
      console.error('bulkUpdateContactStatusAction RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; updated_count?: number; error?: string };
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to update messages' };
    }

    revalidatePath('/portal/messages');
    return { success: true, updatedCount: result.updated_count || 0 };
  } catch (error: any) {
    console.error('bulkUpdateContactStatusAction error:', error);
    return { success: false, error: error.message || 'Server error' };
  }
}