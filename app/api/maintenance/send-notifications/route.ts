import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';
import { sendMaintenanceNotificationBatch } from '@/lib/brevo';

// Helper to get authenticated client and verify admin
async function getAuthenticatedAdminClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value || 
                cookieStore.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Not authenticated' };
  }
  
  let authUserId: string | null = null;
  let isAdminFromCookie = false;
  
  // Check employee_data for admin role (quick check)
  const employeeData = cookieStore.get('employee_data')?.value;
  if (employeeData) {
    try {
      const parsed = JSON.parse(decodeURIComponent(employeeData));
      if (parsed.role === 'admin') {
        isAdminFromCookie = true;
      }
    } catch (e) {
      console.error('Failed to parse employee_data:', e);
    }
  }
  
  // Decode token to get auth user ID
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const exp = payload.exp * 1000;
      const now = Date.now();
      
      if (exp < now) {
        return { error: 'Token expired' };
      }
      
      // Get auth user ID from token's sub claim
      authUserId = payload.sub;
    }
  } catch (e) {
    console.error('Failed to decode token:', e);
    return { error: 'Invalid token format' };
  }
  
  const client = createAuthenticatedClient(token);
  
  // If admin confirmed from cookie, return client
  if (isAdminFromCookie) {
    return { client };
  }
  
  // Otherwise verify from database using auth_user_id
  if (!authUserId) {
    return { error: 'Invalid token - no user ID' };
  }
  
  try {
    // Query employees table using auth_user_id (not id)
    const { data: employee, error } = await client
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    
    if (error) {
      console.error('[Maintenance Auth] DB error:', error);
      return { error: 'Database error checking permissions' };
    }
    
    if (!employee) {
      return { error: 'Unauthorized - employee not found' };
    }
    
    if (employee.role !== 'admin') {
      return { error: `Unauthorized - admin access required (your role: ${employee.role})` };
    }
    
    return { client };
  } catch (e) {
    console.error('[Maintenance Auth] Error:', e);
    return { error: 'Failed to verify admin access' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Missing settings' },
        { status: 400 }
      );
    }

    // Verify authentication and admin access
    const authResult = await getAuthenticatedAdminClient();
    if (authResult.error || !authResult.client) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed',
        sentCount: 0,
        failedCount: 0,
        customerCount: 0,
        employeeCount: 0,
      }, { status: 401 });
    }

    const client = authResult.client;
    
    // Get all users for email
    const { data: usersData, error: usersError } = await client.rpc('get_all_users_for_maintenance_email');

    console.log('[Maintenance Email API] RPC Response:', JSON.stringify(usersData, null, 2));

    if (usersError) {
      console.error('[Maintenance Email API] RPC error:', usersError);
      return NextResponse.json({
        success: false,
        error: usersError.message || 'RPC error',
        sentCount: 0,
        failedCount: 0,
        customerCount: 0,
        employeeCount: 0,
      });
    }

    const result = usersData as any;
    if (!result?.success) {
      console.error('[Maintenance Email API] RPC returned error:', result?.error);
      return NextResponse.json({
        success: false,
        error: result?.error || 'Failed to get user list',
        sentCount: 0,
        failedCount: 0,
        customerCount: 0,
        employeeCount: 0,
      });
    }

    // Parse arrays - handle both array and null cases
    const customers: Array<{email: string; name: string}> = Array.isArray(result.customers) ? result.customers : [];
    const employees: Array<{email: string; name: string}> = Array.isArray(result.employees) ? result.employees : [];
    const allRecipients = [...customers, ...employees].filter(r => r && r.email);

    console.log('[Maintenance Email API] Recipients:', {
      customerCount: customers.length,
      employeeCount: employees.length,
      totalRecipients: allRecipients.length,
    });

    if (allRecipients.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        failedCount: 0,
        error: '',
        customerCount: customers.length,
        employeeCount: employees.length,
      });
    }

    // Send emails in background (fire and forget)
    sendMaintenanceNotificationBatch(allRecipients, {
      reasonType: settings.reason_type,
      customReason: settings.custom_reason,
      title: settings.title || 'Scheduled Maintenance',
      message: settings.message,
      estimatedRestoreTime: settings.estimated_restore_time,
    }).then((emailResult) => {
      console.log('[Maintenance Email API] Send completed:', emailResult);
      
      // Update email sent count in database using authenticated client
      client.rpc('update_maintenance_email_sent', {
        p_count: emailResult.sentCount,
      }).catch((e: any) => console.error('[Maintenance Email API] Update count failed:', e));
    }).catch((error: any) => {
      console.error('[Maintenance Email API] Batch send failed:', error);
    });

    // Return immediately - emails are being sent in background
    return NextResponse.json({
      success: true,
      sentCount: allRecipients.length,
      failedCount: 0,
      error: '',
      customerCount: customers.length,
      employeeCount: employees.length,
    });
  } catch (error: any) {
    console.error('[Maintenance Email API] Server error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Server error',
      sentCount: 0,
      failedCount: 0,
      customerCount: 0,
      employeeCount: 0,
    }, { status: 500 });
  }
}
