import {
  getPayrollDashboardServer,
  getEmployeesPayrollListServer,
  getPayslipsServer,
} from '@/lib/server-queries';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PayrollPage() {
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
