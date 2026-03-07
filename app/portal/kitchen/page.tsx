import { getKitchenOrdersServer, getKitchenStatsServer } from '@/lib/server-queries';
import KitchenClient from './KitchenClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component - Fetches data on the server (hidden from Network tab)
export default async function KitchenPage() {
  // Fetch kitchen data on the server
  const [orders, stats] = await Promise.all([
    getKitchenOrdersServer(),
    getKitchenStatsServer(),
  ]);

  return (
    <KitchenClient
      initialOrders={orders}
      initialStats={stats}
    />
  );
}
