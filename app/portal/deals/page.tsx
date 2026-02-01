// =============================================
// PORTAL DEALS - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { getDealsServer } from '@/lib/server-queries';
import DealsClient from './DealsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function DealsPage() {
  // Fetch all deals on the server (hidden from browser)
  const initialDeals = await getDealsServer();

  return <DealsClient initialDeals={initialDeals} />;
}
