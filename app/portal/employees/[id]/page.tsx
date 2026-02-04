import { notFound } from 'next/navigation';
import { getAuthenticatedClient, getEmployeePayrollSummaryServer } from '@/lib/server-queries';
import EmployeeDetailsClient from './EmployeeDetailsClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// Server-side data fetching
async function getEmployeeData(employeeId: string) {
  try {
    const client = await getAuthenticatedClient();

    // Fetch employee complete details using RPC
    const { data, error: empError } = await client.rpc('get_employee_complete', {
      p_employee_id: employeeId,
    });

    if (empError) {
      // Log detailed error for debugging
      console.error('[SSR] Error fetching employee:', JSON.stringify(empError, null, 2));
      console.error('[SSR] Error code:', empError.code, 'message:', empError.message);
      return null;
    }

    console.log('[SSR] RPC returned:', JSON.stringify(data, null, 2));

    // RPC returns {success: true/false, data: {...}} or {error: string}
    if (data && data.success === true && data.data) {
      return data.data;
    }
    
    // Handle error response from RPC
    if (data && data.success === false) {
      console.error('[SSR] RPC returned error:', data.error);
      return null;
    }
    
    // Legacy format - if data doesn't have success wrapper, return as-is
    return data;
  } catch (error) {
    console.error('[SSR] Error in getEmployeeData:', error);
    return null;
  }
}

// Check if current user is admin
async function getCurrentUserRole() {
  try {
    const client = await getAuthenticatedClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) return { isAdmin: false };

    // Get employee data for current user
    const { data: employee } = await client
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    return {
      isAdmin: employee?.role === 'admin' || employee?.role === 'manager',
    };
  } catch (error) {
    return { isAdmin: false };
  }
}

export default async function EmployeeDetailsPage({ params }: PageProps) {
  const { id: employeeId } = await params;

  // Fetch data in parallel on the server (SSR)
  const [employee, payroll, userRole] = await Promise.all([
    getEmployeeData(employeeId),
    getEmployeePayrollSummaryServer(employeeId),
    getCurrentUserRole(),
  ]);

  // Handle not found - if employee fetch failed, pass null and let client handle auth redirect
  // This allows the client to check if it's an auth issue vs a real not-found
  if (!employee) {
    // Pass employeeId to client so it can try fetching with client-side auth
    return (
      <EmployeeDetailsClient
        employee={null}
        payroll={null}
        isAdmin={userRole.isAdmin}
        employeeId={employeeId}
      />
    );
  }

  return (
    <EmployeeDetailsClient
      employee={employee}
      payroll={payroll}
      isAdmin={userRole.isAdmin}
      employeeId={employeeId}
    />
  );
}

// Generate metadata
export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const employee = await getEmployeeData(id);

  if (!employee) {
    return {
      title: 'Employee Details',
    };
  }

  return {
    title: `${employee.name} - Employee Details`,
    description: `View details for ${employee.name} (${employee.employee_id})`,
  };
}

// Enable dynamic rendering (no caching, always fresh data)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
