import { getBillingStatsServer, getBillingPendingOrdersServer, getRecentInvoicesServer, getBillableOrdersServer } from '@/lib/server-queries';
import BillingClient from './BillingClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BillingPage() {
  // Fetch ALL billing data server-side (hidden from browser Network tab)
  // Use 'week' filter to show recent invoices even if none created today
  const [stats, pendingData, invoices, billableOrders] = await Promise.all([
    getBillingStatsServer(),
    getBillingPendingOrdersServer(5),
    getRecentInvoicesServer('week', 'all'),
    getBillableOrdersServer('all', 'pending_bill'),
  ]);

  return (
    <BillingClient 
      initialStats={stats}
      initialPendingOrders={pendingData.orders}
      initialPendingCount={pendingData.pendingCount}
      initialOnlineOrdersCount={pendingData.onlineOrdersCount}
      initialInvoices={invoices}
      initialBillableOrders={billableOrders}
    />
  );
}
