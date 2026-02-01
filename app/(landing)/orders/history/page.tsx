import { getServerSession, getCustomerOrdersServer } from '@/lib/server-queries';
import OrderHistoryClient from './OrderHistoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrderHistoryPage() {
  // Get user session server-side
  const user = await getServerSession();
  
  // If no user, the client will redirect to auth
  // But we can still try to fetch if we have a session
  let initialOrders: any[] = [];
  
  if (user) {
    const result = await getCustomerOrdersServer(user.id, { limit: 100 });
    initialOrders = (result.orders || []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      order_type: order.order_type || 'walk-in',
      total_amount: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      created_at: order.created_at,
      items_count: order.items?.length || 0,
    }));
  }

  return <OrderHistoryClient initialOrders={initialOrders} />;
}
