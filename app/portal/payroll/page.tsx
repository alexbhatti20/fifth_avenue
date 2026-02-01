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

  // Server types are compatible with PayrollClient's PayrollEmployee type
  return (
    <PayrollClient
      initialPayslips={payslips as any}
      initialEmployees={employees}
      initialSummary={summary as any}
    />
  );
}
