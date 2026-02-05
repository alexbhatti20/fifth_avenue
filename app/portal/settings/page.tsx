// =============================================
// SETTINGS PAGE - SERVER COMPONENT WITH SSR
// Fetches all settings data on server (hidden from browser)
// Prevents duplicate API calls on client
// =============================================

import SettingsClient from './SettingsClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import {
  getEmployeeProfileServer,
  getWebsiteSettingsServer,
  getPaymentMethodsServer,
  get2FAStatusServer,
} from '@/lib/server-queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component - fetches all settings data server-side
export default async function SettingsPage() {
  // Get employee ID from auth cookie
  let employeeId: string | null = null;
  let isAdmin = false;

  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth_token')?.value || cookieStore.get('sb-access-token')?.value;
    const employeeData = cookieStore.get('employee_data')?.value;
    
    // Try to get ID from employee_data cookie first
    if (employeeData) {
      try {
        const parsed = JSON.parse(employeeData);
        employeeId = parsed.id || null;
        isAdmin = parsed.role === 'admin';
      } catch {}
    }
    
    // Fallback to JWT token
    if (!employeeId && authToken) {
      try {
        const decoded = await verifyToken(authToken);
        if (decoded?.sub) {
          employeeId = decoded.sub;
          isAdmin = decoded.role === 'admin';
        }
      } catch {}
    }
  } catch {}
  

  // Fetch all settings data in parallel on the server
  const [
    employeeProfile,
    websiteSettings,
    paymentMethodsData,
    twoFAStatus
  ] = await Promise.all([
    employeeId ? getEmployeeProfileServer(employeeId) : Promise.resolve(null),
    isAdmin ? getWebsiteSettingsServer() : Promise.resolve(null),
    isAdmin ? getPaymentMethodsServer() : Promise.resolve({ methods: [], stats: null }),
    employeeId ? get2FAStatusServer(employeeId) : Promise.resolve({ is_enabled: false }),
  ]);

  return (
    <SettingsClient
      initialEmployeeProfile={employeeProfile}
      initialWebsiteSettings={websiteSettings}
      initialPaymentMethods={paymentMethodsData.methods}
      initialPaymentStats={paymentMethodsData.stats}
      initial2FAStatus={twoFAStatus.is_enabled}
      hasSSRData={!!employeeProfile}
    />
  );
}
