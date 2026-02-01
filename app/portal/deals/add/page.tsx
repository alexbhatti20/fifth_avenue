// =============================================
// PORTAL DEALS ADD - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { getDealFormDataServer } from '@/lib/server-queries';
import AddDealClient from './AddDealClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function AddDealPage() {
  // Fetch menu items and categories on the server (hidden from browser)
  const { categories, menuItems } = await getDealFormDataServer();

  return (
    <AddDealClient 
      initialCategories={categories}
      initialMenuItems={menuItems}
    />
  );
}
