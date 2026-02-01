import { 
  getInventoryItems, 
  getInventorySummary, 
  getLowStockItems, 
  getInventoryAlerts 
} from '@/lib/server-queries';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InventoryPage() {
  // Fetch data server-side (hidden from browser Network tab)
  const [items, summary, lowStockItems, alerts] = await Promise.all([
    getInventoryItems(false), // false = skip Redis cache for fresh data
    getInventorySummary(),
    getLowStockItems(),
    getInventoryAlerts(true),
  ]);

  return (
    <InventoryClient 
      initialItems={items}
      initialSummary={summary}
      initialLowStockItems={lowStockItems}
      initialAlerts={alerts}
    />
  );
}
