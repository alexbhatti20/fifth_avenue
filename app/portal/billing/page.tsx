import { getBillingStatsServer, getBillingPendingOrdersServer, getRecentInvoicesServer, getBillableOrdersServer, getSSRCurrentEmployee } from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import BillingClient from './BillingClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BILLING_ALLOWED_ROLES = ['admin', 'manager', 'billing_staff', 'reception'];

export default async function BillingPage() {
  // SSR role guard — waiters cannot access billing
  const employee = await getSSRCurrentEmployee();
  if (!employee) redirect('/portal/login');
  if (!BILLING_ALLOWED_ROLES.includes((employee as { role: string }).role)) redirect('/portal');
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
