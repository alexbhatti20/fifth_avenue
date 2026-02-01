// Portal Dashboard - Server Component with SSR Data Fetching
// API calls happen on server - hidden from browser Network tab

import {
  getAdminDashboardStatsServer,
  getHourlySalesAdvancedServer,
  getTablesStatusServer,
  getRecentOrdersServer,
  getBillingStatsServer,
  getBillingPendingOrdersServer,
} from '@/lib/server-queries';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  // Fetch all dashboard data on the server (hidden from browser)
  const [
    stats,
    hourlySales,
    tables,
    orders,
    billingStats,
    pendingBillingOrders,
  ] = await Promise.all([
    getAdminDashboardStatsServer(),
    getHourlySalesAdvancedServer(),
    getTablesStatusServer(),
    getRecentOrdersServer(10),
    getBillingStatsServer(),
    getBillingPendingOrdersServer(5),
  ]);

  return (
    <DashboardClient
      initialStats={stats}
      initialHourlySales={hourlySales}
      initialTables={tables}
      initialOrders={orders}
      initialBillingStats={billingStats}
      initialPendingBillingOrders={pendingBillingOrders}
    />
  );
}
