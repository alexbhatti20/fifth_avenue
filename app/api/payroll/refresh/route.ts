import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const {
      getPayrollDashboardServer,
      getEmployeesPayrollListServer,
      getPayslipsServer,
      getAuthenticatedClient,
      getServerSession,
    } = await import('@/lib/server-queries');

    // Admin check via authenticated RPC (bypasses RLS)
    const user = await getServerSession();
    if (!user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const client = await getAuthenticatedClient();
    const { data: empData } = await client.rpc('get_employee_by_auth_user', { p_auth_user_id: user.id });
    const emp = (empData as any)?.data || empData;
    if (!emp?.role || emp.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [dashboard, employees, payslips] = await Promise.all([
      getPayrollDashboardServer(),
      getEmployeesPayrollListServer(),
      getPayslipsServer({ page: 1, limit: 50 }),
    ]);

    return NextResponse.json({ dashboard, employees, payslips });
  } catch (error: any) {
    console.error('Payroll refresh error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
