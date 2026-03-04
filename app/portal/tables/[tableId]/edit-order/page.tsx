import { notFound } from 'next/navigation';
import {
  getTableByIdServer,
  getMenuForOrderingServer,
  getOrderForEditServer,
} from '@/lib/server-queries';
import { EditOrderClient } from './EditOrderClient';

// Always fetch fresh — this page edits live orders
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function EditOrderPage({ params }: Props) {
  const { tableId } = await params;

  const [table, menuData] = await Promise.all([
    getTableByIdServer(tableId),
    getMenuForOrderingServer(),
  ]);

  if (!table) notFound();

  // Fetch existing order details if the table is occupied
  const orderId = table.current_order?.id ?? null;
  const existingOrder = orderId ? await getOrderForEditServer(orderId) : null;

  if (!existingOrder) {
    // No active order to edit — redirect back to take-order
    notFound();
  }

  return (
    <EditOrderClient
      table={table}
      initialMenuData={menuData}
      existingOrder={existingOrder}
    />
  );
}
