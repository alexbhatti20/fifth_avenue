import {
  getPayrollDashboardServer,
  getEmployeesPayrollListServer,
  getPayslipsServer,
  getSSRCurrentEmployee,
} from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PayrollPage() {
  // SSR role guard — payroll data is admin-only
  const employee = await getSSRCurrentEmployee();
  if (!employee) redirect('/portal/login');
  if ((employee as { role: string }).role !== 'admin') redirect('/portal');
  const [dashboard, employees, payslips] = await Promise.all([
    getPayrollDashboardServer(),
    getEmployeesPayrollListServer(),
    getPayslipsServer({ page: 1, limit: 50 }),
  ]);

  return (
    <PayrollClient
      initialDashboard={dashboard}
      initialEmployees={employees}
      initialPayslips={payslips}
    />
  );
}
