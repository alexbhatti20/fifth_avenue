import {
  getPayrollDashboardServer,
  getEmployeesPayrollListServer,
  getPayslipsServer,
  getSSRCurrentEmployee,
  getMyPayslipsServer,
} from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import PayrollClient from './PayrollClient';
import EmployeePayrollView from './EmployeePayrollView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PayrollPage() {
  const employee = await getSSRCurrentEmployee();
  if (!employee) redirect('/portal/login');

  const role = (employee as { role: string }).role;

  // Admin & manager get the full management view
  if (role === 'admin' || role === 'manager') {
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

  // All other employees get their own read-only payroll self-service view
  const emp = employee as any;
  const employeeId: string = emp?.id ?? emp?.data?.id ?? '';
  const myData = employeeId ? await getMyPayslipsServer(employeeId) : null;
  return <EmployeePayrollView currentEmployee={emp} initialData={myData} />;
}
