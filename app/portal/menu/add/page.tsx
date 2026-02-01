// =============================================
// PORTAL MENU ADD - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { supabase } from '@/lib/supabase';
import AddMenuItemClient from './AddMenuItemClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Category {
  id: string;
  name: string;
  slug: string;
}

async function getCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('id, name, slug')
      .order('display_order');
    
    if (error) throw error;
    return (data || []) as Category[];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export default async function AddMenuItemPage() {
  // Fetch categories on server (hidden from browser Network tab)
  const categories = await getCategories();

  return <AddMenuItemClient categories={categories} />;
}
