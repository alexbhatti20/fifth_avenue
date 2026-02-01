import { getDeliveryOrdersServer } from '@/lib/server-queries';
import DeliveryClient from './DeliveryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DeliveryPage() {
  // Fetch data server-side (hidden from browser Network tab)
  const orders = await getDeliveryOrdersServer();

  return <DeliveryClient initialOrders={orders} />;
}
