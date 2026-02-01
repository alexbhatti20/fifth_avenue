// =============================================
// PORTAL MENU EDIT - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { supabase } from '@/lib/supabase';
import EditMenuClient from './EditMenuClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category_id: string;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  preparation_time?: number;
  nutrition_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  has_variants?: boolean;
  size_variants?: Array<{
    size: string;
    price: number;
    is_available: boolean;
  }>;
}

async function getMenuItemData(id: string): Promise<{ item: MenuItem | null; categories: Category[] }> {
  try {
    const [itemRes, catRes] = await Promise.all([
      supabase.from('menu_items').select('*').eq('id', id).single(),
      supabase.from('menu_categories').select('id, name, slug').order('display_order'),
    ]);

    return {
      item: itemRes.data as MenuItem | null,
      categories: (catRes.data || []) as Category[],
    };
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return { item: null, categories: [] };
  }
}

export default async function EditMenuItemPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  // Fetch data on server (hidden from browser Network tab)
  const { item, categories } = await getMenuItemData(id);

  if (!item) {
    notFound();
  }

  return (
    <EditMenuClient 
      id={id}
      initialItem={item}
      categories={categories}
    />
  );
}
