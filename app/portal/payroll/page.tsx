import { getPayslipsServer, getPayrollSummaryServer, getAllEmployeesServer } from '@/lib/server-queries';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PayrollPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const [payslips, employees, summary] = await Promise.all([
    getPayslipsServer({ limit: 100 }),
    getAllEmployeesServer(),
    getPayrollSummaryServer(),
  ]);

  return (
    <PayrollClient
      initialPayslips={payslips}
      initialEmployees={employees}
      initialSummary={summary}
    />
  );
}
