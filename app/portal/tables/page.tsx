import { getTablesForWaiterServer } from '@/lib/server-queries';
import TablesClient from './TablesClient';

// Server Component - Fetches data on the server (hidden from Network tab)
export default async function TablesPage() {
  // Fetch tables data on the server
  const tables = await getTablesForWaiterServer();

  return <TablesClient initialTables={tables || []} />;
}
