import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { getPayslipDetailServer, getAuthenticatedClient, getServerSession } = await import('@/lib/server-queries');
    const { sendPayslipNotification } = await import('@/lib/brevo');

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

    const body = await req.json();
    const { payslipId } = body;
    if (!payslipId) {
      return NextResponse.json({ error: 'Missing payslipId' }, { status: 400 });
    }

    // Get full payslip details
    const detail = await getPayslipDetailServer(payslipId);
    if (!detail?.payslip || !detail?.employee) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if (!detail.employee.email) {
      return NextResponse.json({ error: 'Employee email not available' }, { status: 400 });
    }

    // Calculate overtime pay
    const overtimePay = detail.payslip.base_salary > 0
      ? (detail.payslip.base_salary / 30 / 8) * detail.payslip.overtime_hours * (detail.payslip.overtime_rate || 1.5)
      : 0;

    await sendPayslipNotification({
      employeeEmail: detail.employee.email,
      employeeName: detail.employee.name,
      employeeId: detail.employee.employee_id,
      periodStart: detail.payslip.period_start,
      periodEnd: detail.payslip.period_end,
      baseSalary: detail.payslip.base_salary,
      overtimePay,
      bonuses: detail.payslip.bonuses,
      deductions: detail.payslip.deductions,
      taxAmount: detail.payslip.tax_amount,
      netSalary: detail.payslip.net_salary,
      paymentMethod: detail.payslip.payment_method || undefined,
      status: detail.payslip.status,
      paidAt: detail.payslip.paid_at || undefined,
      processedBy: detail.payslip.created_by_name || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Send payslip email error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
