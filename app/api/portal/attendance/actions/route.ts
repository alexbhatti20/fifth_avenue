import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to get authenticated client from cookies
async function getAuthClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value || 
                cookieStore.get('auth_token')?.value;
  
  if (!token) {
    return null;
  }
  
  // Check token validity
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const exp = payload.exp * 1000;
      const now = Date.now();
      
      if (exp < now) {
        return null;
      }
    }
  } catch (e) {
    // Could not decode token
  }
  
  return createAuthenticatedClient(token);
}

export async function POST(request: NextRequest) {
  try {
    const client = await getAuthClient();
    if (!client) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Verify the user is actually authenticated
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    let result;

    switch (action) {
      // ============ ATTENDANCE ACTIONS ============
      case 'get_my_today_attendance': {
        const { data, error } = await client.rpc('get_my_today_attendance');
        if (error) throw error;
        result = data;
        break;
      }

      case 'mark_attendance_with_code': {
        const { data, error } = await client.rpc('mark_attendance_with_code', {
          p_code: params.code
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'generate_attendance_code': {
        const { data, error } = await client.rpc('generate_attendance_code', {
          p_valid_minutes: params.validMinutes || 5
        });
        if (error) throw error;
        // The RPC returns { success: boolean, code?: string, error?: string }
        // If success is false, return error response
        if (data && !data.success) {
          return NextResponse.json({ success: false, error: data.error || 'Code generation failed' }, { status: 403 });
        }
        result = data;
        break;
      }

      case 'get_active_attendance_code': {
        const { data, error } = await client.rpc('get_active_attendance_code');
        if (error) throw error;
        if (data && data.error) {
          return NextResponse.json({ success: false, error: data.error || 'Failed to get active code' }, { status: 403 });
        }
        result = data;
        break;
      }

      case 'revoke_attendance_code': {
        const { data, error } = await client.rpc('revoke_attendance_code');
        if (error) throw error;
        if (data && !data.success) {
          return NextResponse.json({ success: false, error: data.error || 'Revoke failed' }, { status: 403 });
        }
        result = data;
        break;
      }

      case 'admin_mark_attendance': {
        const { data, error } = await client.rpc('admin_mark_attendance', {
          p_employee_id: params.employeeId,
          p_date: params.date,
          p_check_in: params.checkIn,
          p_check_out: params.checkOut,
          p_status: params.status,
          p_notes: params.notes
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_attendance_summary_by_employee': {
        const { data, error } = await client.rpc('get_attendance_summary_by_employee', {
          p_year: params.year,
          p_month: params.month
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_attendance_history': {
        const { data, error } = await client.rpc('get_attendance_history', {
          p_year: params.year,
          p_month: params.month
        });
        if (error) throw error;
        result = data;
        break;
      }

      // ============ LEAVE ACTIONS ============
      case 'get_leave_balance': {
        const { data, error } = await client.rpc('get_leave_balance');
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_leave_request': {
        const { data, error } = await client.rpc('create_leave_request', {
          p_leave_type: params.leaveType,
          p_start_date: params.startDate,
          p_end_date: params.endDate,
          p_reason: params.reason
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_my_leave_requests': {
        const { data, error } = await client.rpc('get_my_leave_requests', {
          p_year: params.year,
          p_limit: params.limit || 50
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'cancel_leave_request': {
        const { data, error } = await client.rpc('cancel_leave_request', {
          p_request_id: params.requestId
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'review_leave_request': {
        const { data, error } = await client.rpc('review_leave_request', {
          p_request_id: params.requestId,
          p_status: params.status,
          p_notes: params.reviewerNotes
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_all_leave_requests': {
        const { data, error } = await client.rpc('get_all_leave_requests', {
          p_status: params.statusFilter,
          p_year: params.year,
          p_month: params.month
        });
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Attendance API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
