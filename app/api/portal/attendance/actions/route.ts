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
          p_code: params.code,
          p_latitude: params.latitude ?? null,
          p_longitude: params.longitude ?? null,
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
        if (data && !data.success) {
          return NextResponse.json({ success: false, error: data.error || 'Code generation failed' }, { status: 403 });
        }
        result = data;

        // Broadcast push notification to all employees
        if (data?.success && data?.code) {
          const expiryText = `Valid for ${params.validMinutes || 5} min — expires at ${data.valid_until}`;
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/push/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Forward authentication cookie header for server-to-server
              'Authorization': request.headers.get('authorization') || '',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              userType: 'employee',
              title: `📋 Attendance Code: ${data.code}`,
              body: expiryText,
              notificationType: 'attendance_code',
              referenceId: data.code,
              priority: 'high',
            }),
          }).catch(() => null); // fire-and-forget, don't block response
        }
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
        const { data, error } = await client.rpc('get_leave_balance', {
          p_employee_id: params.employeeId ?? null,
        });
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

      // ============ MANUAL ATTENDANCE APPROVAL ACTIONS ============
      case 'request_manual_attendance': {
        const { data, error } = await client.rpc('request_manual_attendance', {
          p_date: params.date,
          p_check_in: params.checkIn,
          p_check_out: params.checkOut || null,
          p_status: params.status || 'present',
          p_notes: params.notes || null,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_pending_manual_attendances': {
        const { data, error } = await client.rpc('get_pending_manual_attendances');
        if (error) throw error;
        result = data;
        break;
      }

      case 'approve_manual_attendance': {
        const { data, error } = await client.rpc('approve_manual_attendance', {
          p_attendance_id: params.attendanceId,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'reject_manual_attendance': {
        const { data, error } = await client.rpc('reject_manual_attendance', {
          p_attendance_id: params.attendanceId,
          p_notes: params.notes || null,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_employee_attendance_grid': {
        const { data, error } = await client.rpc('get_employee_attendance_grid', {
          p_year: params.year || null,
          p_month: params.month || null,
          p_employee_id: params.employeeId || null,
        });
        if (error) throw error;
        result = data;
        break;
      }

      // ============ LOCATION / GEOFENCE SETTINGS ============
      case 'get_attendance_location': {
        const { data, error } = await client.rpc('get_attendance_location');
        if (error) throw error;
        result = data;
        break;
      }

      case 'save_attendance_location': {
        const { data, error } = await client.rpc('save_attendance_location', {
          p_latitude:      params.latitude,
          p_longitude:     params.longitude,
          p_location_name: params.locationName || 'Restaurant',
          p_radius_meters: params.radiusMeters || 100,
          p_enabled:       params.enabled !== false,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_my_attendance_sheet': {
        const { data, error } = await client.rpc('get_my_attendance_sheet', {
          p_start_date: params.startDate,
          p_end_date:   params.endDate,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_attendance_time_rules': {
        const { data, error } = await client.rpc('get_attendance_time_rules');
        if (error) throw error;
        result = data;
        break;
      }

      case 'save_attendance_time_rules': {
        const { data, error } = await client.rpc('save_attendance_time_rules', {
          p_checkin_enabled:    params.checkinEnabled !== false,
          p_checkin_opens:      params.checkinOpens     || '07:00',
          p_checkin_late_after: params.checkinLateAfter || '09:30',
          p_checkin_closes:     params.checkinCloses    || '12:00',
          p_checkout_enabled:   params.checkoutEnabled  === true,
          p_checkout_earliest:  params.checkoutEarliest || '13:00',
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_leave_quota_settings': {
        const { data, error } = await client.rpc('get_leave_quota_settings');
        if (error) throw error;
        result = data;
        break;
      }

      case 'save_leave_quota_settings': {
        const { data, error } = await client.rpc('save_leave_quota_settings', {
          p_annual_days:  params.annualDays  ?? 14,
          p_sick_days:    params.sickDays    ?? 10,
          p_casual_days:  params.casualDays  ?? 7,
          p_apply_to_all: params.applyToAll  === true,
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
