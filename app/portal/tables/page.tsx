import { getTablesForWaiterServer, getWaiterOrderHistoryServer } from '@/lib/server-queries';
import TablesClient from './TablesClient';

// Server Component - Fetches all data on the server (hidden from Network tab)
export default async function TablesPage() {
  // Fetch tables and waiter order history in parallel on the server
  const [tables, historyResult] = await Promise.all([
    getTablesForWaiterServer(),
    getWaiterOrderHistoryServer({ limit: 20, offset: 0 }),
  ]);

  return (
    <TablesClient
      initialTables={tables || []}
      initialHistory={historyResult.history || []}
      initialStats={historyResult.stats}
      initialHistoryCount={historyResult.total_count || 0}
      initialHasMore={historyResult.has_more || false}
    />
  );
}
