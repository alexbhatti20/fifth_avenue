import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { verifyCookieValue } from '@/lib/cookie-signing';

interface MaintenanceGuardResult {
  isMaintenanceMode: boolean;
  isAdmin: boolean;
  maintenanceData: {
    reason_type: string;
    custom_reason?: string;
    title: string;
    message?: string;
    estimated_restore_time?: string;
    show_timer: boolean;
    show_progress: boolean;
    enabled_at?: string;
  } | null;
}

/**
 * Check maintenance mode status and admin access
 * Call this in server components to determine if maintenance page should be shown
 */
export async function checkMaintenanceMode(): Promise<MaintenanceGuardResult> {
  try {
    // Get maintenance status
    const { data: maintenanceData, error } = await supabase.rpc('get_maintenance_status');
    
    if (error || !maintenanceData?.is_enabled) {
      return { isMaintenanceMode: false, isAdmin: false, maintenanceData: null };
    }

    // Check if current user is admin
    let isAdmin = false;
    try {
      const cookieStore = await cookies();
      const authToken = cookieStore.get('auth_token')?.value || cookieStore.get('sb-access-token')?.value;
      const employeeData = cookieStore.get('employee_data')?.value;

      // Check employee_data cookie first (must be HMAC-signed)
      if (employeeData) {
        try {
          const verified = await verifyCookieValue(employeeData);
          if (verified) {
            const parsed = JSON.parse(verified);
            isAdmin = parsed.role === 'admin';
          }
        } catch {}
      }

      // Fallback to JWT token
      if (!isAdmin && authToken) {
        try {
          const decoded = await verifyToken(authToken);
          isAdmin = decoded?.role === 'admin';
        } catch {}
      }
    } catch {}

    return {
      isMaintenanceMode: true,
      isAdmin,
      maintenanceData: {
        reason_type: maintenanceData.reason_type,
        custom_reason: maintenanceData.custom_reason,
        title: maintenanceData.title,
        message: maintenanceData.message,
        estimated_restore_time: maintenanceData.estimated_restore_time,
        show_timer: maintenanceData.show_timer,
        show_progress: maintenanceData.show_progress,
        enabled_at: maintenanceData.enabled_at,
      },
    };
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return { isMaintenanceMode: false, isAdmin: false, maintenanceData: null };
  }
}

/**
 * Redirect to maintenance page if in maintenance mode and not admin
 * Call this at the start of server components/layouts that should be blocked
 */
export async function redirectIfMaintenance(currentPath: string = '/'): Promise<void> {
  // Skip check for maintenance page itself
  if (currentPath === '/maintenance') return;
  
  // Skip check for portal login (allow access)
  if (currentPath === '/portal/login') return;
  
  // Skip check for API routes
  if (currentPath.startsWith('/api')) return;

  const { isMaintenanceMode, isAdmin } = await checkMaintenanceMode();
  
  if (isMaintenanceMode && !isAdmin) {
    redirect('/maintenance');
  }
}
