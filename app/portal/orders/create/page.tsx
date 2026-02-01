import { getOrderCreationDataServer } from '@/lib/server-queries';
import OrderCreateClient from './OrderCreateClient';

export const dynamic = 'force-dynamic';

export default async function CreateOrderPage() {
  // Fetch order creation data server-side (hidden from Network tab)
  const initialData = await getOrderCreationDataServer();

  return <OrderCreateClient initialData={initialData} />;
}
