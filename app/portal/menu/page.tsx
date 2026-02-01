// =============================================
// PORTAL MENU MANAGEMENT - SERVER COMPONENT (SSR)
// Data is fetched on server, hidden from browser Network tab
// =============================================

import { getMenuManagementDataServer } from '@/lib/server-queries';
import MenuClient from './MenuClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function MenuManagementPage() {
  // Fetch all menu data on the server (hidden from browser)
  const initialData = await getMenuManagementDataServer();

  return <MenuClient initialData={initialData} />;
}