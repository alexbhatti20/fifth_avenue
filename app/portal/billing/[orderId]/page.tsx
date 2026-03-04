import { getOrderForBilling } from '@/lib/actions';
import { getMenuForOrderingServer, getSSRCurrentEmployee } from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import GenerateInvoiceClient from './GenerateInvoiceClient';

export const dynamic = 'force-dynamic';

const BILLING_ALLOWED_ROLES = ['admin', 'manager', 'billing_staff', 'reception'];

export default async function GenerateInvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  // SSR role guard — waiters cannot access billing pages
  const employee = await getSSRCurrentEmployee();
  if (!employee) redirect('/portal/login');
  if (!BILLING_ALLOWED_ROLES.includes((employee as { role: string }).role)) redirect('/portal');

  const { orderId } = await params;

  const [orderResult, menuData] = await Promise.all([
    getOrderForBilling(orderId),
    getMenuForOrderingServer(),
  ]);

  const initialOrderData =
    orderResult.success && orderResult.data?.success ? orderResult.data : null;

  return (
    <GenerateInvoiceClient
      orderId={orderId}
      initialOrderData={initialOrderData}
      initialMenuData={menuData}
    />
  );
}
