// =============================================
// SETTINGS PAGE - SERVER COMPONENT WITH SSR
// Fetches all settings data on server (hidden from browser)
// Auth is handled by middleware - no need to check here
// =============================================

import SettingsClient from './SettingsClient';
import {
  getSSRCurrentEmployee,
  getWebsiteSettingsServer,
  getPaymentMethodsServer,
  get2FAStatusServer,
  getMaintenanceStatusServer,
} from '@/lib/server-queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component - fetches all settings data server-side
export default async function SettingsPage() {
  // Get current employee from SSR (middleware handles auth redirect)
  const employee = await getSSRCurrentEmployee();
  
  const employeeId = employee?.id || null;
  const isAdmin = employee?.role === 'admin';

  // Fetch all settings data in parallel on the server
  const [
    websiteSettings,
    paymentMethodsData,
    twoFAStatus,
    maintenanceStatus
  ] = await Promise.all([
    isAdmin ? getWebsiteSettingsServer() : Promise.resolve(null),
    isAdmin ? getPaymentMethodsServer() : Promise.resolve({ methods: [], stats: null }),
    employeeId ? get2FAStatusServer(employeeId) : Promise.resolve({ is_enabled: false }),
    isAdmin ? getMaintenanceStatusServer() : Promise.resolve(null),
  ]);

  return (
    <SettingsClient
      initialEmployeeProfile={employee}
      initialWebsiteSettings={websiteSettings}
      initialPaymentMethods={paymentMethodsData.methods}
      initialPaymentStats={paymentMethodsData.stats}
      initial2FAStatus={twoFAStatus.is_enabled}
      initialMaintenanceStatus={maintenanceStatus}
      hasSSRData={!!employee}
    />
  );
}
