// Portal Orders Page - Full SSR with Server-Side Data Fetching
// All data fetched on server, client only handles UI and triggers refresh

import { getOrdersAdvancedServer, getOrdersStatsServer } from '@/lib/server-queries';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrdersPageProps {
  searchParams?: Promise<{
    status?: string;
    type?: string;
    limit?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const status = params?.status || 'active';
  const orderType = params?.type || 'all';
  // Cap limit to prevent excessive DB load from crafted query strings
  const limit = Math.min(parseInt(params?.limit || '50', 10), 200);

  // Fetch data in parallel with error handling - don't let stats failure block orders
  const [ordersResult, statsResult] = await Promise.allSettled([
    getOrdersAdvancedServer(limit, {
      status: status === 'active' ? undefined : status === 'all' ? undefined : status,
      orderType: orderType === 'all' ? undefined : orderType,
    }),
    getOrdersStatsServer(),
  ]);

  // Extract data with fallbacks
  const ordersData = ordersResult.status === 'fulfilled' 
    ? ordersResult.value 
    : { orders: [], total_count: 0, has_more: false };
    
  const stats = statsResult.status === 'fulfilled' 
    ? statsResult.value 
    : null;

  return (
    <OrdersClient
      orders={ordersData.orders}
      stats={stats}
      totalCount={ordersData.total_count}
      hasMore={ordersData.has_more}
    />
  );
}
