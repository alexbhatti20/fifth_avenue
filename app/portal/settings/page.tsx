// =============================================
// SETTINGS PAGE - SERVER COMPONENT
// Auth handled by PortalProvider (client-side)
// All data fetched client-side with proper auth context
// =============================================

import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component - renders client component
// Auth is handled by PortalProvider in layout
export default function SettingsPage() {
  return <SettingsClient />;
}
