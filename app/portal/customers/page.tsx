import { getCustomersAdminServer, getCustomersStatsServer } from '@/lib/server-queries';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomersPage() {
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
