// =============================================
// PORTAL DEALS EDIT - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { getDealByIdServer, getDealFormDataServer } from '@/lib/server-queries';
import EditDealClient from './EditDealClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function EditDealPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  // Fetch all data on the server in parallel (hidden from browser)
  const [deal, formData] = await Promise.all([
    getDealByIdServer(id),
    getDealFormDataServer(),
  ]);

  if (!deal) {
    notFound();
  }

  return (
    <EditDealClient 
      dealId={id}
      initialDeal={deal}
      initialCategories={formData.categories}
      initialMenuItems={formData.menuItems}
    />
  );
}
