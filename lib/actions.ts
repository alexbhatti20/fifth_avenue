'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import {
  invalidateMenuCache,
  invalidateDealsCache,
  invalidateSiteContentCache,
} from '@/lib/cache';

// =============================================
// MENU MANAGEMENT SERVER ACTIONS
// =============================================

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
// DEAL MANAGEMENT SERVER ACTIONS
// =============================================

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

export async function updateOrderStatus(
  orderId: string,
  status: string,
  notes?: string
) {
  try {
    const { error } = await supabase.rpc('update_order_status', {
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
    const { data, error } = await supabase.rpc('assign_table_to_order', {
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
    const { error } = await supabase.rpc('release_table', {
      p_table_id: tableId,
    });

    if (error) throw error;

    revalidatePath('/admin/tables');

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to release table' };
  }
}

