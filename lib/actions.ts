'use server';

import { supabase } from '@/lib/supabase';
import { getAuthenticatedClient, getSSRCurrentEmployee } from '@/lib/server-queries';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
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

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update menu item' };
  }
}

// Delete menu item (hidden from Network tab)
export async function deleteMenuItemServer(itemId: string) {
  try {
    const { data, error } = await (await getAuthenticatedClient()).rpc('delete_menu_item', {
      p_item_id: itemId,
    });
    if (error) throw error;

    // Flush Redis cache for all menu-related keys
    await invalidateMenuCache();
    // Only revalidate the customer-facing page — portal updates via client fetchData()
    revalidatePath('/menu');

    // Return image URLs so caller can clean up storage
    const images: string[] = Array.isArray(data?.images) ? data.images : [];
    return { success: true, images };
  } catch (error: any) {
    return { success: false, images: [], error: error.message || 'Failed to delete menu item' };
  }
}

// Batch-delete multiple menu items in ONE DB call (hidden from Network tab)
export async function deleteMenuItemsBatchServer(itemIds: string[]) {
  try {
    if (!itemIds.length) return { success: true, deleted_count: 0, failed_count: 0, images: [] };

    const { data, error } = await (await getAuthenticatedClient()).rpc('delete_menu_items_batch', {
      p_item_ids: itemIds,
    });
    if (error) throw error;

    // Flush Redis cache for all menu-related keys
    await invalidateMenuCache();
    // Only revalidate the customer-facing page — portal updates via client fetchData()
    revalidatePath('/menu');

    const images: string[] = Array.isArray(data?.images) ? data.images : [];
    return {
      success: true,
      deleted_count: data?.deleted_count ?? itemIds.length,
      failed_count: data?.failed_count ?? 0,
      images,
    };
  } catch (error: any) {
    return { success: false, deleted_count: 0, failed_count: itemIds.length, images: [], error: error.message || 'Failed to batch delete menu items' };
  }
}

// Toggle menu item availability (hidden from Network tab)
export async function toggleMenuItemAvailability(itemId: string, isAvailable: boolean) {
  try {
    const { error } = await (await getAuthenticatedClient())
      .from('menu_items')
      .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;

    await invalidateMenuCache();
    revalidatePath('/menu');

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

    const { data: item, error } = await (await getAuthenticatedClient())
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

    const { data: item, error } = await (await getAuthenticatedClient())
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
    const { error } = await (await getAuthenticatedClient())
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

// Batch delete deals — single DB round-trip (hidden from Network tab)
export async function deleteDealsBatchServer(dealIds: string[]) {
  try {
    const { data: result, error } = await (await getAuthenticatedClient()).rpc('delete_deals_batch', {
      p_deal_ids: dealIds,
    });

    if (error) throw error;

    await invalidateDealsCache();
    revalidatePath('/');
    revalidatePath('/menu');
    revalidatePath('/portal/deals');

    return result || { success: true, deleted_count: dealIds.length, failed_count: 0 };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete deals', deleted_count: 0, failed_count: dealIds.length };
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

    const { data: deal, error } = await (await getAuthenticatedClient())
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

    const { data: deal, error } = await (await getAuthenticatedClient())
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

// Search customer for order creation (hidden from Network tab, server-side only)
export async function searchCustomerForOrderServer(searchTerm: string) {
  try {
    const trimmed = searchTerm.trim().toLowerCase();
    if (trimmed.length < 2) return { success: false, customers: [] };

    const { data, error } = await (await getAuthenticatedClient()).rpc('search_customer_for_order', {
      p_search: trimmed,
    });

    if (error) throw error;

    if (data?.success) {
      const customers = (data.customers || []).map((c: any) => ({
        id: c.id,
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || null,
        address: c.address || null,
        loyalty_points: c.loyalty_points || 0,
        loyalty_tier: (c.loyalty_tier || 'bronze') as 'bronze' | 'silver' | 'gold' | 'platinum',
        total_orders: c.total_orders || 0,
        total_spent: 0,
      }));
      return { success: true, customers };
    }

    return { success: true, customers: [] };
  } catch (error: any) {
    return { success: false, customers: [], error: error.message };
  }
}

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

    const { data: content, error } = await (await getAuthenticatedClient())
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
// All review operations use authenticated RPC calls for security
// =============================================

export async function updateReviewVisibilityAction(
  reviewId: string,
  isVisible: boolean,
  employeeId?: string
) {
  'use server';
  try {
    const client = await getAuthenticatedClient();
    
    // Use the employee-specific RPC if employeeId is provided for audit trails
    if (employeeId) {
      const { data, error } = await client.rpc('update_review_visibility_by_employee', {
        p_review_id: reviewId,
        p_is_visible: isVisible,
        p_employee_id: employeeId,
      });
      
      if (error) throw error;
      
      revalidatePath('/portal/reviews');
      revalidatePath('/');
      
      return { success: true, data };
    }
    
    // Fallback to basic version without employee tracking
    const { data, error } = await client.rpc('update_review_visibility', {
      p_review_id: reviewId,
      p_is_visible: isVisible,
    });

    if (error) throw error;

    revalidatePath('/portal/reviews');
    revalidatePath('/');

    return { success: true, data };
  } catch (error: any) {
    console.error('[Review Action] Update visibility failed:', error);
    return { success: false, error: error?.message || 'Failed to update review visibility' };
  }
}

export async function replyToReviewAction(
  reviewId: string,
  reply: string,
  employeeId?: string
) {
  'use server';
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('reply_to_review_advanced', {
      p_review_id: reviewId,
      p_reply: reply,
      p_employee_id: employeeId || null,
    });

    if (error) throw error;

    revalidatePath('/portal/reviews');
    revalidatePath('/');

    return { success: true, data };
  } catch (error: any) {
    console.error('[Review Action] Reply failed:', error);
    return { success: false, error: error?.message || 'Failed to reply to review' };
  }
}

export async function deleteReviewAction(
  reviewId: string,
  employeeId?: string
) {
  'use server';
  try {
    const client = await getAuthenticatedClient();
    
    // Use the employee-specific RPC if employeeId is provided
    const rpcName = employeeId ? 'delete_review_by_employee' : 'delete_review_advanced';
    const params = employeeId 
      ? { p_review_id: reviewId, p_employee_id: employeeId }
      : { p_review_id: reviewId };
    
    const { data, error } = await client.rpc(rpcName as any, params);

    if (error) throw error;

    revalidatePath('/portal/reviews');
    revalidatePath('/');

    return { success: true, data };
  } catch (error: any) {
    console.error('[Review Action] Delete failed:', error);
    return { success: false, error: error?.message || 'Failed to delete review' };
  }
}

export async function bulkUpdateReviewVisibilityAction(
  reviewIds: string[],
  isVisible: boolean,
  employeeId?: string
) {
  'use server';
  try {
    const client = await getAuthenticatedClient();
    
    // Use the employee-specific RPC if employeeId is provided for audit trails
    if (employeeId) {
      const { data, error } = await client.rpc('bulk_update_review_visibility_by_employee', {
        p_review_ids: reviewIds,
        p_is_visible: isVisible,
        p_employee_id: employeeId,
      });
      
      if (error) throw error;

      revalidatePath('/portal/reviews');
      revalidatePath('/');

      return { success: true, data };
    }
    
    // Fallback to basic version without employee tracking
    const { data, error } = await client.rpc('bulk_update_review_visibility', {
      p_review_ids: reviewIds,
      p_is_visible: isVisible,
    });

    if (error) throw error;

    revalidatePath('/portal/reviews');
    revalidatePath('/');

    return { success: true, data };
  } catch (error: any) {
    console.error('[Review Action] Bulk update failed:', error);
    return { success: false, error: error?.message || 'Failed to bulk update reviews' };
  }
}

// Legacy function for backwards compatibility
export async function toggleReviewVisibility(reviewId: string, isVisible: boolean) {
  return updateReviewVisibilityAction(reviewId, isVisible);
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

// Send order to billing queue (waiter action — no redirect, idempotent)
// The underlying generate_quick_bill RPC returns existing invoice if one already exists.
export async function sendOrderToBillingAction(orderId: string): Promise<{
  success: boolean;
  invoice_id?: string;
  invoice_number?: string;
  already_exists?: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('generate_quick_bill', {
      p_order_id: orderId,
      p_biller_id: null,
    });
    if (error) throw error;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to send bill to billing' };
    }
    revalidatePath('/portal/billing');
    revalidatePath('/portal/tables');
    return {
      success: true,
      invoice_id: result.invoice_id,
      invoice_number: result.invoice_number,
      already_exists: result.message === 'Invoice already exists',
    };
  } catch (error: any) {
    console.error('[Server Action] sendOrderToBillingAction error:', error);
    return { success: false, error: error.message || 'Failed to send bill to billing' };
  }
}

// Update an existing pending/draft invoice with the latest order items & totals.
// Called after a waiter edits the order (add/remove items).
export async function updatePendingInvoiceAction(orderId: string): Promise<{
  success: boolean;
  invoice_id?: string;
  invoice_number?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();

    // 1. Get latest order data (items JSONB + financials)
    const { data: orderData, error: orderErr } = await client
      .from('orders')
      .select('items, subtotal, discount, delivery_fee, total')
      .eq('id', orderId)
      .single();
    if (orderErr) throw orderErr;

    // 2. Find the pending/draft invoice for this order
    const { data: invoice, error: invoiceErr } = await client
      .from('invoices')
      .select('id, invoice_number')
      .eq('order_id', orderId)
      .in('payment_status', ['pending', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invoiceErr) throw invoiceErr;
    if (!invoice) {
      return { success: false, error: 'No pending invoice found for this order' };
    }

    // 3. Recalculate totals using DB tax rate
    const subtotal = orderData.subtotal ?? orderData.total;
    const discount = orderData.discount ?? 0;
    const deliveryFee = orderData.delivery_fee ?? 0;

    // Read tax settings from DB
    const { data: taxRow } = await client
      .from('system_settings')
      .select('value')
      .eq('key', 'tax_settings')
      .maybeSingle();
    const taxEnabled: boolean = taxRow?.value?.enabled ?? false;
    const taxRate: number = taxEnabled ? (taxRow?.value?.rate ?? 0) : 0;
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = subtotal - discount + tax + deliveryFee;

    // 4. Patch the invoice
    const { error: updateErr } = await client
      .from('invoices')
      .update({
        items: orderData.items,
        subtotal,
        tax,
        discount,
        delivery_fee: deliveryFee,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
    if (updateErr) throw updateErr;

    revalidatePath('/portal/billing');
    revalidatePath('/portal/tables');

    return { success: true, invoice_id: invoice.id, invoice_number: invoice.invoice_number };
  } catch (error: any) {
    console.error('[Server Action] updatePendingInvoiceAction error:', error);
    return { success: false, error: error.message || 'Failed to update invoice' };
  }
}


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

/**
 * Get My Payslips - Employee self-service (any authenticated employee)
 * Returns all payslips for the current logged-in employee + profile + company info
 */
export async function getMyPayslipsAction(): Promise<{
  employee: any;
  payslips: any[];
  company: any;
} | null> {
  try {
    const client = await getAuthenticatedClient();
    // Resolve employee ID from cookie JWT (avoids relying on auth.uid() in RPC)
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || cookieStore.get('auth_token')?.value;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const authUserId: string = payload.sub;
    if (!authUserId) return null;

    // Get employee record to get their UUID
    const empRes = await client.rpc('get_employee_by_auth_user' as any, { p_auth_user_id: authUserId });
    if (empRes.error || !empRes.data) return null;
    const empData = empRes.data as any;
    const employeeId: string = empData?.data?.id ?? empData?.id ?? null;
    if (!employeeId) return null;

    // Now fetch payslips by employee ID (no auth.uid() dependency)
    const { data, error } = await client.rpc('get_my_payslips_by_id' as any, { p_employee_id: employeeId });
    if (error) throw error;
    const d = data as any;
    if (!d || d.error) return null;
    return d as { employee: any; payslips: any[]; company: any };
  } catch (error: any) {
    console.error('getMyPayslipsAction error:', error);
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
// TAX SETTINGS - SERVER ACTIONS (SSR)
// Stored in system_settings table, key='tax_settings'
// =============================================

export interface TaxSettingsData {
  rate: number;   // percentage, e.g. 5 = 5%
  enabled: boolean;
  label: string;  // e.g. "GST"
}

export interface OnlineOrderingSettingsData {
  enabled: boolean;
  disabled_message: string;
  updated_at?: string | null;
}

const DEFAULT_ONLINE_ORDERING_DISABLED_MESSAGE =
  'Online ordering is currently unavailable. Please visit us in-store or try again later.';

export async function getOnlineOrderingSettingsAction(): Promise<{
  success: boolean;
  settings?: OnlineOrderingSettingsData;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_online_ordering_setting');

    if (error) throw error;

    const settings = (data as any) || {};

    return {
      success: true,
      settings: {
        enabled: settings.enabled ?? true,
        disabled_message:
          (typeof settings.disabled_message === 'string' && settings.disabled_message.trim()) ||
          DEFAULT_ONLINE_ORDERING_DISABLED_MESSAGE,
        updated_at: settings.updated_at ?? null,
      },
    };
  } catch (error: any) {
    console.error('[Server Action] getOnlineOrderingSettingsAction error:', error);
    return { success: false, error: error.message || 'Failed to get online ordering settings' };
  }
}

export async function updateOnlineOrderingSettingsAction(
  settings: Pick<OnlineOrderingSettingsData, 'enabled' | 'disabled_message'>
): Promise<{
  success: boolean;
  settings?: OnlineOrderingSettingsData;
  error?: string;
}> {
  try {
    const employee = await getSSRCurrentEmployee();
    if (!employee || employee.role !== 'admin') {
      return { success: false, error: 'Unauthorized. Admin access required.' };
    }

    const client = await getAuthenticatedClient();
    const sanitizedMessage = settings.disabled_message?.trim() || DEFAULT_ONLINE_ORDERING_DISABLED_MESSAGE;
    const { data, error } = await client.rpc('upsert_online_ordering_setting_internal', {
      p_enabled: settings.enabled,
      p_disabled_message: sanitizedMessage,
    });

    if (error) throw error;

    const result = data as any;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to save online ordering settings' };
    }

    const resultSettings = result.settings || {};

    revalidatePath('/portal/settings');
    revalidatePath('/menu');
    revalidatePath('/cart');
    revalidatePath('/offers');
    revalidatePath('/favorites');
    revalidatePath('/');

    return {
      success: true,
      settings: {
        enabled: resultSettings.enabled ?? settings.enabled,
        disabled_message:
          (typeof resultSettings.disabled_message === 'string' && resultSettings.disabled_message.trim()) ||
          sanitizedMessage,
        updated_at: resultSettings.updated_at ?? null,
      },
    };
  } catch (error: any) {
    console.error('[Server Action] updateOnlineOrderingSettingsAction error:', error);
    return { success: false, error: error.message || 'Failed to save online ordering settings' };
  }
}

export async function getTaxSettingsAction(): Promise<{
  success: boolean;
  settings?: TaxSettingsData;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client
      .from('system_settings')
      .select('value')
      .eq('key', 'tax_settings')
      .maybeSingle();
    if (error) throw error;
    const settings: TaxSettingsData = {
      rate: data?.value?.rate ?? 0,
      enabled: data?.value?.enabled ?? false,
      label: data?.value?.label ?? 'GST',
    };
    return { success: true, settings };
  } catch (error: any) {
    console.error('[Server Action] getTaxSettingsAction error:', error);
    return { success: false, error: error.message || 'Failed to get tax settings' };
  }
}

export async function updateTaxSettingsAction(settings: TaxSettingsData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { error } = await client
      .from('system_settings')
      .upsert(
        {
          key: 'tax_settings',
          value: settings,
          description: 'Tax rate applied to invoices (percentage, 0 = no tax)',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    if (error) throw error;
    revalidatePath('/portal/settings');
    revalidatePath('/portal/billing');
    return { success: true };
  } catch (error: any) {
    console.error('[Server Action] updateTaxSettingsAction error:', error);
    return { success: false, error: error.message || 'Failed to save tax settings' };
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

// =============================================
// PERKS MANAGEMENT SERVER ACTIONS (hidden from Network tab)
// All operations use authenticated RPC calls (SECURITY DEFINER)
// Mutations return fresh promo/settings data to avoid a second round-trip
// =============================================

// ── Internal helper: fetch fresh promos from DB ────────────────────────────
async function _fetchFreshPromos(limit = 100, offset = 0) {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc('get_all_customer_promo_codes_admin', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return [];
  const promoArray = data?.promos ?? (Array.isArray(data) ? data : []);
  return promoArray.map((p: any) => ({
    ...p,
    customer_name: p.customer_name || 'Unknown',
    customer_email: p.customer_email || '',
    awarded_reason: p.name || 'Loyalty Reward',
  }));
}

// ── Internal helper: fetch fresh settings from DB ─────────────────────────
async function _fetchFreshPerksSettings() {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc('get_all_perks_settings');
  if (error) return null;
  return data;
}

// Fetch perks settings (hidden from Network tab)
export async function fetchPerksSettingsAction(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await _fetchFreshPerksSettings();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch perks settings' };
  }
}

// Fetch customers loyalty data (hidden from Network tab)
export async function fetchPerksCustomersAction(limit = 100): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_all_customers_loyalty', { p_limit: limit });
    if (error) throw error;
    const customers = data?.customers ?? (Array.isArray(data) ? data : []);
    return { success: true, data: customers };
  } catch (error: any) {
    return { success: false, data: [], error: error.message || 'Failed to fetch customers' };
  }
}

// Fetch promo codes (hidden from Network tab)
export async function fetchPerksPromosAction(limit = 100, offset = 0): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const promos = await _fetchFreshPromos(limit, offset);
    return { success: true, data: promos };
  } catch (error: any) {
    return { success: false, data: [], error: error.message || 'Failed to fetch promo codes' };
  }
}

// Fetch ALL perks data in ONE server round-trip (hidden from Network tab)
// Use this for the initial page hydration to avoid 3 separate action calls.
export async function fetchAllPerksDataAction(customersLimit = 100, promosLimit = 100): Promise<{
  success: boolean;
  settings?: any;
  customers?: any[];
  promos?: any[];
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const [settingsResult, customersResult, promosResult] = await Promise.all([
      client.rpc('get_all_perks_settings'),
      client.rpc('get_all_customers_loyalty', { p_limit: customersLimit }),
      client.rpc('get_all_customer_promo_codes_admin', { p_limit: promosLimit, p_offset: 0 }),
    ]);

    const settings = settingsResult.data ?? null;
    const customersRaw = customersResult.data?.customers ?? (Array.isArray(customersResult.data) ? customersResult.data : []);
    const promosRaw = promosResult.data?.promos ?? (Array.isArray(promosResult.data) ? promosResult.data : []);

    const customers = customersRaw;
    const promos = promosRaw.map((p: any) => ({
      ...p,
      customer_name: p.customer_name || 'Unknown',
      customer_email: p.customer_email || '',
      awarded_reason: p.name || 'Loyalty Reward',
    }));

    return { success: true, settings, customers, promos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch perks data' };
  }
}

// Update a perks setting — returns fresh settings so client avoids a second round-trip
export async function updatePerksSettingAction(
  key: string,
  value: unknown
): Promise<{ success: boolean; freshSettings?: any; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('update_perks_setting', {
      p_setting_key: key,
      p_setting_value: value,
    });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to update setting');
    const freshSettings = await _fetchFreshPerksSettings();
    revalidatePath('/portal/perks');
    return { success: true, freshSettings };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update perks setting' };
  }
}

// Deactivate a single promo — returns fresh promos list
export async function deactivatePromoAction(
  promoId: string
): Promise<{ success: boolean; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('deactivate_customer_promo_admin', { p_promo_id: promoId });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to deactivate promo');
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to deactivate promo' };
  }
}

// Activate a single promo — returns fresh promos list
export async function activatePromoAction(
  promoId: string
): Promise<{ success: boolean; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('activate_customer_promo_admin', { p_promo_id: promoId });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to activate promo');
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to activate promo' };
  }
}

// Delete a single promo — returns fresh promos list
export async function deletePromoAction(
  promoId: string
): Promise<{ success: boolean; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('delete_customer_promo_admin', { p_promo_id: promoId });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to delete promo');
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete promo' };
  }
}

// Bulk activate promos — returns fresh promos list
export async function bulkActivatePromosAction(
  promoIds: string[]
): Promise<{ success: boolean; message?: string; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('bulk_activate_promo_codes_admin', { p_promo_ids: promoIds });
    if (error) throw error;
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, message: (data as any)?.message, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to bulk activate promos' };
  }
}

// Bulk deactivate promos — returns fresh promos list
export async function bulkDeactivatePromosAction(
  promoIds: string[]
): Promise<{ success: boolean; message?: string; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('bulk_deactivate_promo_codes_admin', { p_promo_ids: promoIds });
    if (error) throw error;
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, message: (data as any)?.message, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to bulk deactivate promos' };
  }
}

// Bulk delete promos — returns fresh promos list
export async function bulkDeletePromosAction(
  promoIds: string[]
): Promise<{ success: boolean; message?: string; freshPromos?: any[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('bulk_delete_promo_codes_admin', { p_promo_ids: promoIds });
    if (error) throw error;
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, message: (data as any)?.message, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to bulk delete promos' };
  }
}

// Cleanup expired promos — returns fresh promos list
export async function cleanupExpiredPromosAction(): Promise<{
  success: boolean;
  deactivated_count?: number;
  freshPromos?: any[];
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('cleanup_expired_customer_promos');
    if (error) throw error;
    const freshPromos = await _fetchFreshPromos();
    revalidatePath('/portal/perks');
    return { success: true, deactivated_count: (data as any)?.deactivated_count ?? 0, freshPromos };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to cleanup expired promos' };
  }
}

// =============================================
// WAITER TABLES SERVER ACTIONS
// SSR-authenticated actions for waiter functionality
// =============================================

export interface WaiterOrderHistoryItem {
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

export interface WaiterOrderStats {
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

// Refresh waiter tables (SSR authenticated)
export async function refreshWaiterTablesAction(): Promise<{
  success: boolean;
  tables?: any[];
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_tables_for_waiter');

    if (error) throw error;

    if (data?.success && data?.tables) {
      return { success: true, tables: data.tables };
    }

    // Fallback to direct query if RPC doesn't return expected structure
    const { data: tablesData, error: tablesError } = await client
      .from('restaurant_tables')
      .select('*')
      .order('table_number');

    if (tablesError) throw tablesError;

    return { success: true, tables: tablesData || [] };
  } catch (error: any) {
    console.error('[Server Action] refreshWaiterTablesAction error:', error);
    return { success: false, error: error.message || 'Failed to refresh tables' };
  }
}

// Refresh waiter order history (SSR authenticated)
export async function refreshWaiterOrderHistoryAction(options: {
  date?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  success: boolean;
  history?: WaiterOrderHistoryItem[];
  stats?: WaiterOrderStats | null;
  total_count?: number;
  has_more?: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_waiter_order_history', {
      p_date: options.date || null,
      p_limit: options.limit || 20,
      p_offset: options.offset || 0,
    });

    if (error) throw error;

    if (data?.success) {
      return {
        success: true,
        history: data.history || [],
        stats: data.stats || null,
        total_count: data.total_count || 0,
        has_more: data.has_more || false,
      };
    }

    return {
      success: false,
      history: [],
      stats: null,
      total_count: 0,
      has_more: false,
      error: data?.error || 'Unknown error',
    };
  } catch (error: any) {
    console.error('[Server Action] refreshWaiterOrderHistoryAction error:', error);
    return { success: false, error: error.message || 'Failed to refresh order history' };
  }
}

// Claim table for waiter (SSR authenticated)
export async function claimTableForWaiterAction(tableId: string): Promise<{
  success: boolean;
  table_number?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('claim_table_for_waiter', {
      p_table_id: tableId,
    });

    if (error) throw error;

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to claim table' };
    }

    revalidatePath('/portal/tables');
    return { success: true, table_number: data.table_number };
  } catch (error: any) {
    console.error('[Server Action] claimTableForWaiterAction error:', error);
    return { success: false, error: error.message || 'Failed to claim table' };
  }
}

// =============================================
// MENU & ORDER SERVER ACTIONS (Waiter)
// SSR authenticated actions for order creation
// =============================================

export interface MenuItemForOrder {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category_id: string;
  category_name: string;
  status: string;
  is_featured: boolean;
  has_variants: boolean;
  size_variants: { size: string; price: number; is_available: boolean }[] | null;
}

export interface MenuCategoryForOrder {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  display_order: number;
}

export interface DealForOrder {
  id: string;
  name: string;
  description: string;
  original_price: number;
  deal_price: number;
  images: string[];
  deal_items: any[];
}

export interface MenuDataForOrder {
  categories: MenuCategoryForOrder[];
  items: MenuItemForOrder[];
  deals: DealForOrder[];
}

// Get menu data for ordering (SSR authenticated)
export async function getMenuForOrderingAction(): Promise<{
  success: boolean;
  data?: MenuDataForOrder;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    // Try the RPC first
    const { data: rpcData, error: rpcError } = await client.rpc('get_menu_for_ordering');
    
    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        data: {
          categories: rpcData.categories || [],
          items: rpcData.items || [],
          deals: rpcData.deals || [],
        },
      };
    }

    // Fallback to direct queries with correct table names
    const [categoriesResult, itemsResult, dealsResult] = await Promise.all([
      client
        .from('menu_categories')
        .select('id, name, slug, image_url, display_order')
        .eq('is_visible', true)
        .order('display_order'),
      client
        .from('menu_items')
        .select('id, name, description, price, images, category_id, is_available, is_featured, has_variants, size_variants, menu_categories(name)')
        .eq('is_available', true),
      client
        .from('deals')
        .select('id, name, description, original_price, discounted_price, images, applicable_items, discount_percentage, discount_amount, code, deal_type, is_featured')
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString()),
    ]);

    const categories = categoriesResult.data || [];
    const items = (itemsResult.data || []).map((item: any) => ({
      ...item,
      status: item.is_available ? 'available' : 'unavailable',
      category_name: item.menu_categories?.name || '',
    }));
    const deals = (dealsResult.data || []).map((deal: any) => ({
      ...deal,
      deal_price: deal.discounted_price, // Map to expected field name
      deal_items: deal.applicable_items || [],
    }));

    return {
      success: true,
      data: { categories, items, deals },
    };
  } catch (error: any) {
    console.error('[Server Action] getMenuForOrderingAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch menu' };
  }
}

export interface CustomerLookupResult {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
}

export interface CustomerPromoCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  promo_type: string;
  value: number;
  max_discount: number | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface CustomerFullDetails {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_date: string | null;
  promo_codes: CustomerPromoCode[];
  membership_tier: string;
}

export interface CustomerOrderSummary {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  table_number: number | null;
  notes: string | null;
  created_at: string;
}

export async function getCustomerOrderHistoryAction(
  customerId: string
): Promise<{ success: boolean; orders: CustomerOrderSummary[]; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client
      .from('orders')
      .select(
        'id, order_number, order_type, status, items, subtotal, tax, discount, total, payment_method, payment_status, table_number, notes, created_at'
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return { success: true, orders: (data ?? []) as CustomerOrderSummary[] };
  } catch (e: any) {
    console.error('[Server Action] getCustomerOrderHistoryAction error:', e);
    return { success: false, orders: [], error: e.message };
  }
}

// Lookup customer by phone/email (SSR authenticated)
export async function lookupCustomerAction(params: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<{
  success: boolean;
  found: boolean;
  customer?: CustomerLookupResult;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    // Try the RPC first
    const { data, error } = await client.rpc('lookup_customer', {
      p_phone: params.phone || null,
      p_email: params.email || null,
      p_name: params.name || null,
    });

    if (error) throw error;

    if (data?.found) {
      return {
        success: true,
        found: true,
        customer: data.customer,
      };
    }

    return {
      success: true,
      found: false,
    };
  } catch (error: any) {
    console.error('[Server Action] lookupCustomerAction error:', error);
    return { success: false, found: false, error: error.message || 'Failed to lookup customer' };
  }
}

// Enhanced customer lookup with promo codes and full details (SSR authenticated)
export async function getCustomerFullDetailsAction(params: {
  phone?: string | null;
  email?: string | null;
  customer_id?: string | null;
  name?: string | null;
}): Promise<{
  success: boolean;
  found: boolean;
  customer?: CustomerFullDetails;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();

    // customer_order_history view has all stats + linked customer_id
    // Columns: customer_id, customer_name, customer_phone, customer_email,
    //          total_orders, total_spent, last_order_date, loyalty_points, loyalty_tier
    const STATS_SELECT =
      'customer_id, customer_name, customer_phone, customer_email, total_orders, total_spent, last_order_date, loyalty_points, loyalty_tier';

    let row: any = null;

    if (params.customer_id) {
      const { data } = await client
        .from('customer_order_history')
        .select(STATS_SELECT)
        .eq('customer_id', params.customer_id)
        .maybeSingle();
      row = data;

      // Might not have an order yet — fall back to customers table
      if (!row) {
        const { data: c } = await client
          .from('customers')
          .select('id, name, email, phone')
          .eq('id', params.customer_id)
          .maybeSingle();
        if (c) {
          row = {
            customer_id: c.id,
            customer_name: c.name,
            customer_email: c.email,
            customer_phone: c.phone,
            total_orders: 0,
            total_spent: 0,
            last_order_date: null,
            loyalty_points: 0,
            loyalty_tier: 'bronze',
          };
        }
      }
    } else if (params.phone) {
      const raw = params.phone;
      const digits = raw.replace(/\D/g, '');
      const last10 = digits.slice(-10);

      // 1. Exact match
      const { data: exact } = await client
        .from('customer_order_history')
        .select(STATS_SELECT)
        .eq('customer_phone', raw)
        .maybeSingle();
      row = exact;

      // 2. Suffix match for different phone formats (+92 vs 0 prefix, etc.)
      if (!row && last10.length >= 10) {
        const { data: fuzzy } = await client
          .from('customer_order_history')
          .select(STATS_SELECT)
          .ilike('customer_phone', `%${last10}`)
          .limit(1)
          .maybeSingle();
        row = fuzzy ?? null;
      }
    } else if (params.email) {
      const { data } = await client
        .from('customer_order_history')
        .select(STATS_SELECT)
        .ilike('customer_email', params.email.trim())
        .maybeSingle();
      row = data;
    } else if (params.name) {
      const { data } = await client
        .from('customer_order_history')
        .select(STATS_SELECT)
        .ilike('customer_name', `%${params.name.trim()}%`)
        .order('total_orders', { ascending: false })
        .limit(1)
        .maybeSingle();
      row = data;
    } else {
      return { success: true, found: false };
    }

    if (!row) return { success: true, found: false };

    // Fetch active, unused promo codes
    const { data: promoCodes } = await client
      .from('customer_promo_codes')
      .select('id, code, name, description, promo_type, value, max_discount, expires_at, is_active')
      .eq('customer_id', row.customer_id)
      .eq('is_used', false)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('expires_at', { ascending: true, nullsFirst: false });

    const totalOrders = Number(row.total_orders) || 0;
    const totalSpent = Number(row.total_spent) || 0;

    return {
      success: true,
      found: true,
      customer: {
        id: row.customer_id,
        name: row.customer_name || 'Customer',
        email: row.customer_email || null,
        phone: row.customer_phone || null,
        loyalty_points: Number(row.loyalty_points) || 0,
        total_orders: totalOrders,
        total_spent: totalSpent,
        avg_order_value: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
        last_order_date: row.last_order_date || null,
        membership_tier: row.loyalty_tier || 'bronze',
        promo_codes: promoCodes || [],
      },
    };
  } catch (error: any) {
    console.error('[Server Action] getCustomerFullDetailsAction error:', error);
    return { success: false, found: false, error: error.message || 'Failed to get customer details' };
  }
}

export interface CreateOrderParams {
  table_id: string;
  customer_count: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_id?: string;
  items: {
    item_id?: string;
    deal_id?: string;
    quantity: number;
    unit_price: number;
    size_variant?: string;
    notes?: string;
  }[];
  notes?: string;
  payment_method?: string;
  send_email?: boolean;
}

// Create a new order (SSR authenticated)
export async function createOrderAction(params: CreateOrderParams): Promise<{
  success: boolean;
  order_id?: string;
  order_number?: string;
  table_number?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('create_table_order', {
      p_table_id: params.table_id,
      p_customer_count: params.customer_count,
      p_customer_name: params.customer_name || null,
      p_customer_phone: params.customer_phone || null,
      p_customer_email: params.customer_email || null,
      p_customer_id: params.customer_id || null,
      p_items: params.items,
      p_notes: params.notes || null,
      p_payment_method: params.payment_method || 'cash',
      p_send_email: params.send_email ?? true,
    });

    if (error) throw error;

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to create order' };
    }

    revalidatePath('/portal/tables');
    revalidatePath('/portal/orders');
    
    return {
      success: true,
      order_id: data.order_id,
      order_number: data.order_number,
      table_number: data.table_number,
    };
  } catch (error: any) {
    console.error('[Server Action] createOrderAction error:', error);
    return { success: false, error: error.message || 'Failed to create order' };
  }
}

// Add items to existing order (SSR authenticated)
export async function addItemsToOrderAction(params: {
  order_id: string;
  items: {
    item_id?: string;
    deal_id?: string;
    quantity: number;
    unit_price: number;
    size_variant?: string;
    notes?: string;
  }[];
}): Promise<{
  success: boolean;
  new_total?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('add_items_to_order', {
      p_order_id: params.order_id,
      p_items: params.items,
    });

    if (error) throw error;

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to add items' };
    }

    revalidatePath('/portal/tables');
    revalidatePath('/portal/orders');
    
    return {
      success: true,
      new_total: data.new_total,
    };
  } catch (error: any) {
    console.error('[Server Action] addItemsToOrderAction error:', error);
    return { success: false, error: error.message || 'Failed to add items to order' };
  }
}

// Create waiter dine-in order (SSR authenticated) - used by TakeOrderDialog
export async function createWaiterDineInOrderAction(params: {
  table_id: string;
  items: { id: string; name: string; price: number; quantity: number }[];
  customer_count: number;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  notes?: string | null;
  payment_method?: string;
  send_email?: boolean;
}): Promise<{
  success: boolean;
  order_id?: string;
  order_number?: string;
  table_number?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    
    const { data, error } = await client.rpc('create_waiter_dine_in_order', {
      p_table_id: params.table_id,
      p_items: params.items,
      p_customer_count: params.customer_count,
      p_customer_id: params.customer_id || null,
      p_customer_name: params.customer_name || null,
      p_customer_phone: params.customer_phone || null,
      p_customer_email: params.customer_email || null,
      p_notes: params.notes || null,
      p_payment_method: params.payment_method || 'cash',
      p_send_email: params.send_email ?? true,
    });

    if (error) throw error;

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to create order' };
    }

    revalidatePath('/portal/tables');
    revalidatePath('/portal/orders');
    
    return {
      success: true,
      order_id: data.order_id,
      order_number: data.order_number,
      table_number: data.table_number,
    };
  } catch (error: any) {
    console.error('[Server Action] createWaiterDineInOrderAction error:', error);
    return { success: false, error: error.message || 'Failed to create order' };
  }
}

// =============================================
// TABLE CRUD SERVER ACTIONS (Admin/Manager)
// =============================================

export interface CreateTableData {
  table_number: number;
  capacity: number;
  section?: string;
  floor?: number;
  position?: { x: number; y: number } | null;
}

export interface UpdateTableData {
  table_id: string;
  table_number?: number;
  capacity?: number;
  section?: string;
  floor?: number;
  status?: string;
  position?: { x: number; y: number } | null;
}

// Create a new restaurant table (Admin/Manager only)
export async function createRestaurantTableAction(data: CreateTableData): Promise<{
  success: boolean;
  table_id?: string;
  table_number?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('create_restaurant_table', {
      p_table_number: data.table_number,
      p_capacity: data.capacity,
      p_section: data.section || null,
      p_floor: data.floor || 1,
      p_position: data.position || null,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to create table' };
    }

    revalidatePath('/portal/tables');
    return { success: true, table_id: result.table_id, table_number: result.table_number };
  } catch (error: any) {
    console.error('[Server Action] createRestaurantTableAction error:', error);
    return { success: false, error: error.message || 'Failed to create table' };
  }
}

// Update a restaurant table (Admin/Manager only)
export async function updateRestaurantTableAction(data: UpdateTableData): Promise<{
  success: boolean;
  table_id?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('update_restaurant_table', {
      p_table_id: data.table_id,
      p_table_number: data.table_number || null,
      p_capacity: data.capacity || null,
      p_section: data.section || null,
      p_floor: data.floor || null,
      p_status: data.status || null,
      p_position: data.position || null,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to update table' };
    }

    revalidatePath('/portal/tables');
    return { success: true, table_id: result.table_id };
  } catch (error: any) {
    console.error('[Server Action] updateRestaurantTableAction error:', error);
    return { success: false, error: error.message || 'Failed to update table' };
  }
}

// Delete a restaurant table (Admin/Manager only)
export async function deleteRestaurantTableAction(tableId: string): Promise<{
  success: boolean;
  table_number?: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('delete_restaurant_table', {
      p_table_id: tableId,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to delete table' };
    }

    revalidatePath('/portal/tables');
    return { success: true, table_number: result.table_number };
  } catch (error: any) {
    console.error('[Server Action] deleteRestaurantTableAction error:', error);
    return { success: false, error: error.message || 'Failed to delete table' };
  }
}

// Bulk delete restaurant tables (Admin/Manager only)
export async function bulkDeleteRestaurantTablesAction(tableIds: string[]): Promise<{
  success: boolean;
  deleted_count?: number;
  skipped_count?: number;
  skipped_tables?: string[];
  message?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('bulk_delete_restaurant_tables', {
      p_table_ids: tableIds,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to delete tables' };
    }

    revalidatePath('/portal/tables');
    return {
      success: true,
      deleted_count: result.deleted_count,
      skipped_count: result.skipped_count,
      skipped_tables: result.skipped_tables,
      message: result.message,
    };
  } catch (error: any) {
    console.error('[Server Action] bulkDeleteRestaurantTablesAction error:', error);
    return { success: false, error: error.message || 'Failed to delete tables' };
  }
}

// Get a single restaurant table (for editing)
export async function getRestaurantTableAction(tableId: string): Promise<{
  success: boolean;
  table?: any;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('get_restaurant_table', {
      p_table_id: tableId,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to get table' };
    }

    return { success: true, table: result.table };
  } catch (error: any) {
    console.error('[Server Action] getRestaurantTableAction error:', error);
    return { success: false, error: error.message || 'Failed to get table' };
  }
}

// Update table status (waiter/admin/manager)
export async function updateTableStatusAction(tableId: string, status: string): Promise<{
  success: boolean;
  new_status?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('update_table_status', {
      p_table_id: tableId,
      p_status: status,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to update status' };
    }

    revalidatePath('/portal/tables');
    return { success: true, new_status: result.new_status };
  } catch (error: any) {
    console.error('[Server Action] updateTableStatusAction error:', error);
    return { success: false, error: error.message || 'Failed to update status' };
  }
}

// Release table (waiter/admin/manager)
/**
 * Complete an order (mark as completed) and release the table to 'cleaning'.
 * Called from the waiter table card "Complete Order" button.
 */
export async function completeOrderAndReleaseTable(orderId: string, tableId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();

    // 1. Mark the order as delivered (terminal state for dine-in)
    const { error: orderError } = await client.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: 'delivered',
      p_notes: null,
    });
    if (orderError) throw orderError;

    // 2. Release the table and set it to cleaning
    const { data: releaseResult, error: releaseError } = await client.rpc('release_table_waiter', {
      p_table_id: tableId,
      p_set_to_cleaning: true,
    });
    if (releaseError) throw releaseError;
    if (!releaseResult?.success) {
      throw new Error(releaseResult?.error || 'Failed to release table');
    }

    revalidatePath('/portal/tables');
    revalidatePath('/portal/orders');
    return { success: true };
  } catch (error: any) {
    console.error('[Server Action] completeOrderAndReleaseTable error:', {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return { success: false, error: error.message || 'Failed to complete order' };
  }
}

export async function releaseTableAction(tableId: string, setToCleaning: boolean = false): Promise<{
  success: boolean;
  table_number?: number;
  new_status?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data: result, error } = await client.rpc('release_table_waiter', {
      p_table_id: tableId,
      p_set_to_cleaning: setToCleaning,
    });

    if (error) throw error;

    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to release table' };
    }

    revalidatePath('/portal/tables');
    return { success: true, table_number: result.table_number, new_status: result.new_status };
  } catch (error: any) {
    console.error('[Server Action] releaseTableAction error:', error);
    return { success: false, error: error.message || 'Failed to release table' };
  }
}

// =============================================
// TABLE ORDER DETAILS & BILLING ACTIONS
// =============================================

export interface TableOrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  size_variant?: string | null;
}

export interface TableOrderDetails {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  created_at: string;
  has_invoice?: boolean;
  invoice_payment_status?: string | null;
  customer?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    loyalty_points?: number;
    membership_tier?: string;
  } | null;
  items: TableOrderItem[];
  table_number: number;
  customer_count: number;
}

// Get full order details for a table (waiter/admin/manager)
export async function getTableCurrentOrderAction(tableId: string): Promise<{
  success: boolean;
  order?: TableOrderDetails;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();

    // Get the table and its current order
    const { data: tableData, error: tableError } = await client
      .from('restaurant_tables')
      .select('table_number, current_order_id')
      .eq('id', tableId)
      .single();

    if (tableError) throw tableError;
    if (!tableData?.current_order_id) {
      return { success: false, error: 'No active order for this table' };
    }

    const orderId = tableData.current_order_id;

    // Check if there's already an invoice for this order
    const { data: invoiceData } = await client
      .from('invoices')
      .select('id, payment_status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const has_invoice = !!invoiceData;
    const invoice_payment_status = invoiceData?.payment_status ?? null;

    // Try the billing RPC which has full order details
    const { data: billingData, error: billingError } = await client.rpc('get_order_for_billing', {
      p_order_id: orderId,
    });

    if (!billingError && billingData?.success && billingData?.order) {
      const order = billingData.order;
      return {
        success: true,
        order: {
          order_id: order.id || orderId,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status || 'pending',
          subtotal: order.subtotal || order.total || 0,
          tax_amount: order.tax_amount || 0,
          discount_amount: order.discount_amount || 0,
          total: order.total || 0,
          notes: order.notes,
          created_at: order.created_at,
          customer: order.customer || null,
          items: (order.items || []).map((item: any) => ({
            id: item.id || item.menu_item_id,
            name: item.name || item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price || item.price,
            total_price: item.total_price || item.quantity * (item.unit_price || item.price || 0),
            notes: item.notes,
            size_variant: item.size_variant,
          })),
          table_number: tableData.table_number,
          customer_count: order.customer_count || 1,
          has_invoice,
          invoice_payment_status,
        },
      };
    }

    // Fallback: direct query
    const { data: orderData, error: orderError } = await client
      .from('orders')
      .select(`
        id, order_number, status, payment_status, subtotal, tax_amount, discount_amount, total,
        notes, created_at, customer_count,
        customers(id, name, phone, email, loyalty_points, membership_tier),
        order_items(id, quantity, unit_price, total_price, notes, size_variant,
          menu_items(name),
          deals(name)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    const items = (orderData.order_items || []).map((oi: any) => ({
      id: oi.id,
      name: oi.menu_items?.name || oi.deals?.name || 'Unknown Item',
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      total_price: oi.total_price || oi.quantity * oi.unit_price,
      notes: oi.notes,
      size_variant: oi.size_variant,
    }));

    return {
      success: true,
      order: {
        order_id: orderData.id,
        order_number: orderData.order_number,
        status: orderData.status,
        payment_status: orderData.payment_status || 'pending',
        subtotal: orderData.subtotal || orderData.total || 0,
        tax_amount: orderData.tax_amount || 0,
        discount_amount: orderData.discount_amount || 0,
        total: orderData.total || 0,
        notes: orderData.notes,
        created_at: orderData.created_at,
        customer: Array.isArray(orderData.customers) ? (orderData.customers[0] ?? null) : (orderData.customers || null),
        items,
        table_number: tableData.table_number,
        customer_count: orderData.customer_count || 1,
        has_invoice,
        invoice_payment_status,
      },
    };
  } catch (error: any) {
    console.error('[Server Action] getTableCurrentOrderAction error:', error);
    return { success: false, error: error.message || 'Failed to get order details' };
  }
}

// Send table bill to billing counter as pending (waiter/admin/manager)
export async function sendTableToBillingAction(orderId: string): Promise<{
  success: boolean;
  order_number?: string;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();

    // Mark the order as billing_requested by adding a note/updating billing status
    // We update payment_status to 'pending' (it should already be, but confirm it)
    // and add to notes that billing was requested
    const { data: orderData, error: fetchError } = await client
      .from('orders')
      .select('order_number, notes, payment_status')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    const billingNote = `[BILLING REQUESTED: ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}]`;
    const updatedNotes = orderData.notes
      ? `${orderData.notes}\n${billingNote}`
      : billingNote;

    const { error: updateError } = await client
      .from('orders')
      .update({
        notes: updatedNotes,
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    revalidatePath('/portal/billing');
    revalidatePath('/portal/tables');

    return { success: true, order_number: orderData.order_number };
  } catch (error: any) {
    console.error('[Server Action] sendTableToBillingAction error:', error);
    return { success: false, error: error.message || 'Failed to send to billing' };
  }
}

// =============================================
// ONLINE TABLE BOOKING SERVER ACTIONS
// All calls use SECURITY DEFINER RPCs — hidden from browser
// =============================================

export interface TableForBooking {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  section?: string;
  floor: number;
  current_customers: number;
  reserved_by?: string | null;
  reservation_time?: string | null;
  reservation_notes?: string | null;
  reservation_id?: string | null;
  reserved_by_name?: string | null;
  reserved_by_phone?: string | null;
  reservation_date?: string | null;
  arrival_time?: string | null;
  party_size?: number | null;
  auto_release_at?: string | null;
}

export interface OnlineBookingSetting {
  enabled: boolean;
  max_advance_days: number;
  min_notice_hours: number;
  auto_release_minutes: number;
}

/** Public — fetches all tables + booking setting (auto-releases expired) */
export async function getTablesForBookingAction(): Promise<{
  success: boolean;
  tables: TableForBooking[];
  booking_enabled: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_tables_for_booking');
    if (error) throw error;
    return {
      success: true,
      tables: data?.tables ?? [],
      booking_enabled: data?.booking_enabled ?? false,
    };
  } catch (e: any) {
    return { success: false, tables: [], booking_enabled: false, error: e.message };
  }
}

/** Public — get just the booking setting (lightweight) */
export async function getOnlineBookingSettingAction(): Promise<OnlineBookingSetting> {
  try {
    const { data } = await supabase.rpc('get_online_booking_setting');
    return data ?? { enabled: false, max_advance_days: 14, min_notice_hours: 1, auto_release_minutes: 10 };
  } catch {
    return { enabled: false, max_advance_days: 14, min_notice_hours: 1, auto_release_minutes: 10 };
  }
}

/** Customer action — create a table reservation */
export async function createTableReservationAction(params: {
  tableId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  reservationDate: string; // 'YYYY-MM-DD'
  arrivalTime: string;     // 'HH:MM'
  partySize: number;
  preOrderItems?: { name: string; price: number; quantity: number }[];
  notes?: string;
}): Promise<{
  success: boolean;
  reservation_id?: string;
  table_number?: number;
  arrival_time?: string;
  auto_release_at?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('create_table_reservation', {
      p_table_id: params.tableId,
      p_customer_id: params.customerId ?? null,
      p_customer_name: params.customerName,
      p_customer_phone: params.customerPhone,
      p_customer_email: params.customerEmail ?? null,
      p_reservation_date: params.reservationDate,
      p_arrival_time: params.arrivalTime,
      p_party_size: params.partySize,
      p_pre_order_items: JSON.stringify(params.preOrderItems ?? []),
      p_notes: params.notes ?? null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? 'Reservation failed');
    revalidatePath('/book-online');
    return {
      success: true,
      reservation_id: data.reservation_id,
      table_number: data.table_number,
      arrival_time: data.arrival_time,
      auto_release_at: data.auto_release_at,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Customer or admin — cancel a reservation */
export async function cancelTableReservationAction(reservationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('cancel_table_reservation', {
      p_reservation_id: reservationId,
    });
    if (error) throw error;
    revalidatePath('/book-online');
    revalidatePath('/portal/tables');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Admin / Manager only — toggle online booking on/off */
export async function toggleOnlineBookingAction(enabled: boolean): Promise<{
  success: boolean;
  enabled?: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('toggle_online_booking', { p_enabled: enabled });
    if (error) throw error;
    revalidatePath('/portal/tables');
    revalidatePath('/book-online');
    return { success: true, enabled: data?.enabled };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Admin / Manager — fetch all reservations with optional filters */
export async function getAdminReservationsAction(params?: {
  status?: string;
  date?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  reservations: AdminReservation[];
  total: number;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_all_reservations_for_admin', {
      p_status: params?.status ?? null,
      p_date: params?.date ?? null,
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
    });
    if (error) throw error;
    return {
      success: true,
      reservations: data?.reservations ?? [],
      total: data?.total ?? 0,
    };
  } catch (e: any) {
    return { success: false, reservations: [], total: 0, error: e.message };
  }
}

export interface AdminReservation {
  id: string;
  table_id: string;
  table_number: number;
  capacity: number;
  section?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  reservation_date: string;
  arrival_time: string;
  party_size: number;
  pre_order_items: any[];
  notes?: string | null;
  status: 'confirmed' | 'pending' | 'arrived' | 'cancelled' | 'expired';
  auto_release_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Admin / Manager — update reservation status and optionally edit fields */
export async function updateReservationStatusAction(params: {
  reservationId: string;
  status: 'confirmed' | 'pending' | 'arrived' | 'cancelled' | 'expired';
  notes?: string;
  arrivalTime?: string;     // 'HH:MM'
  reservationDate?: string; // 'YYYY-MM-DD'
  partySize?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('update_reservation_status', {
      p_reservation_id: params.reservationId,
      p_status: params.status,
      p_notes: params.notes ?? null,
      p_arrival_time: params.arrivalTime ?? null,
      p_reservation_date: params.reservationDate ?? null,
      p_party_size: params.partySize ?? null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? 'Update failed');
    revalidatePath('/portal/bookings');
    revalidatePath('/portal/tables');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Admin / Manager — permanently delete a cancelled or expired reservation */
export async function deleteReservationAction(reservationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('delete_reservation', {
      p_reservation_id: reservationId,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? 'Delete failed');
    revalidatePath('/portal/bookings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// =============================================
// 2FA SERVER ACTIONS (SSR — reads httpOnly cookies directly)
// These replace the /api/portal/security/2fa REST route to eliminate
// the "Not authenticated" error caused by httpOnly cookie limitations.
// =============================================

/** Resolve the employee DB record from the current request cookies */
async function get2FAEmployee() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('auth_token')?.value;
  if (!token) return null;

  // Decode JWT to get Supabase auth user ID
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) return null;

    const authUserId: string | undefined = payload.sub;
    if (!authUserId) return null;

    const client = await getAuthenticatedClient();

    // Look up employee by auth_user_id
    const { data: byId } = await client
      .from('employees')
      .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (byId) return { employee: byId, client };

    // Fallback: look up by email from JWT payload
    const email: string | undefined = payload.email;
    if (email) {
      const { data: byEmail } = await client
        .from('employees')
        .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
        .ilike('email', email)
        .maybeSingle();
      if (byEmail) {
        // Back-fill auth_user_id
        await client
          .from('employees')
          .update({ auth_user_id: authUserId })
          .eq('id', byEmail.id);
        return { employee: byEmail, client };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Generate a new TOTP secret + QR code for the current employee */
export async function generate2FASetupAction(): Promise<{
  success: boolean;
  qr_code?: string;
  secret?: string;
  manual_entry_key?: string;
  is_enabled?: boolean;
  error?: string;
}> {
  try {
    // Dynamic import keeps speakeasy out of the client bundle
    const speakeasy = await import('speakeasy');
    const QRCode = await import('qrcode');

    const auth = await get2FAEmployee();
    if (!auth) return { success: false, error: 'Not authenticated' };

    const { employee } = auth;

    const secretObj = speakeasy.generateSecret({
      name: `ZOIRO Broast (${employee.email})`,
      issuer: 'ZOIRO Broast Hub',
      length: 32,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secretObj.otpauth_url || '');

    return {
      success: true,
      qr_code: qrCodeDataUrl,
      secret: secretObj.base32,
      manual_entry_key: secretObj.base32,
      is_enabled: employee.is_2fa_enabled || false,
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to generate 2FA setup' };
  }
}

/** Verify a TOTP code and enable 2FA for the current employee */
export async function enable2FAAction(
  secret: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const speakeasy = await import('speakeasy');

    if (!secret || !token) {
      return { success: false, error: 'Secret and token are required' };
    }

    const auth = await get2FAEmployee();
    if (!auth) return { success: false, error: 'Not authenticated' };

    const { employee, client } = auth;

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return { success: false, error: 'Invalid verification code' };
    }

    const { error } = await client
      .from('employees')
      .update({
        is_2fa_enabled: true,
        two_fa_secret: secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/portal/settings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to enable 2FA' };
  }
}

/** Verify a TOTP code and disable 2FA for the current employee */
export async function disable2FAAction(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const speakeasy = await import('speakeasy');

    if (!token) {
      return { success: false, error: 'Token is required' };
    }

    const auth = await get2FAEmployee();
    if (!auth) return { success: false, error: 'Not authenticated' };

    const { employee, client } = auth;

    if (!employee.two_fa_secret) {
      return { success: false, error: '2FA is not configured for this account' };
    }

    const verified = speakeasy.totp.verify({
      secret: employee.two_fa_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return { success: false, error: 'Invalid verification code' };
    }

    const { error } = await client
      .from('employees')
      .update({
        is_2fa_enabled: false,
        two_fa_secret: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/portal/settings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to disable 2FA' };
  }
}

// =============================================
// EDIT ORDER ACTION
// Replaces the full items array on an active
// dine-in order (pending/confirmed/preparing).
// Recalculates subtotal, tax, total and sends
// a kitchen_updates notification via Postgres.
// =============================================

export interface OrderCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isDeal?: boolean;
  notes?: string;
}

export async function updateOrderItemsAction(
  orderId: string,
  items: OrderCartItem[]
): Promise<{ success: boolean; subtotal?: number; tax?: number; total?: number; items_count?: number; error?: string }> {
  try {
    const client = await getAuthenticatedClient();

    const { data, error } = await client.rpc('update_order_items', {
      p_order_id: orderId,
      p_items: items as any,
    });

    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Failed to update order' };

    revalidatePath('/portal/tables');
    revalidatePath('/portal/orders');
    revalidatePath('/portal/kitchen');

    return {
      success: true,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      items_count: data.items_count,
    };
  } catch (error: any) {
    console.error('[Server Action] updateOrderItemsAction error:', error);
    return { success: false, error: error.message || 'Failed to update order items' };
  }
}