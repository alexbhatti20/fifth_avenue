import { notFound } from 'next/navigation';
import {
  getTableByIdServer,
  getMenuForOrderingServer,
} from '@/lib/server-queries';
import TakeOrderPageClient from './TakeOrderPageClient';

// =============================================
// TAKE ORDER — SSR PAGE
// Parallel server fetch: table + menu.
// Customer order history is loaded client-side when a registered customer
// is detected (so there is no per-request DB cost on every page load).
// =============================================

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function TakeOrderPage({ params }: Props) {
  const { tableId } = await params;

  const [table, menuData] = await Promise.all([
    getTableByIdServer(tableId),
    getMenuForOrderingServer(),
  ]);

  if (!table) {
    notFound();
  }

  return (
    <TakeOrderPageClient
      table={table}
      initialMenuData={menuData}
    />
  );
}
