// =============================================
// PORTAL EMPLOYEES - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { getEmployeesPaginatedServer } from '@/lib/server-queries';
import EmployeesClient from './EmployeesClient';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  // Fetch all employees on the server (hidden from browser)
  const initialData = await getEmployeesPaginatedServer(1, 100);

  return <EmployeesClient initialData={initialData} />;
}
