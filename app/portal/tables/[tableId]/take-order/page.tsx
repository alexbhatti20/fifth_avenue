import { notFound } from 'next/navigation';
import {
  getTableByIdServer,
  getMenuForOrderingServer,
} from '@/lib/server-queries';
import TakeOrderPageClient from './TakeOrderPageClient';

// Always render fresh from the server — never serve a cached snapshot.
// Without this, Next.js may reuse a stale RSC payload where the table
// still shows the previous order's data even after the table was released.
export const dynamic = 'force-dynamic';

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
