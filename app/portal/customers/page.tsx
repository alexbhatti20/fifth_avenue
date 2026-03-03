import { getCustomersAdminServer, getCustomersStatsServer, getSSRCurrentEmployee } from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomersPage() {
  // SSR role guard — only admin and manager may view customer PII
  const employee = await getSSRCurrentEmployee();
  if (!employee) redirect('/portal/login');
  if (!['admin', 'manager'].includes((employee as { role: string }).role)) redirect('/portal');
  // Fetch data with error handling - don't let stats failure block customers
  const [customersResult, statsResult] = await Promise.allSettled([
    getCustomersAdminServer(100, 0, undefined, 'all'),
    getCustomersStatsServer(),
  ]);

  // Extract data with fallbacks
  const customers = customersResult.status === 'fulfilled' 
    ? customersResult.value 
    : [];
    
  const stats = statsResult.status === 'fulfilled' 
    ? statsResult.value 
    : null;

  return (
    <CustomersClient 
      initialCustomers={customers} 
      initialStats={stats}
    />
  );
}
