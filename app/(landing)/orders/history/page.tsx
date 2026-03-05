import { getServerCustomer, getCustomerOrdersServer } from '@/lib/server-queries';
import OrderHistoryClient from './OrderHistoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrderHistoryPage() {
  // Use getServerCustomer() to get the customers.id (not the Supabase auth UUID)
  const customer = await getServerCustomer();
  
  let initialOrders: any[] = [];
  
  if (customer) {
    const result = await getCustomerOrdersServer(customer.id, { limit: 100 });
    initialOrders = (result.orders || []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      order_type: order.order_type || 'walk-in',
      total_amount: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      table_number: order.table_number,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      created_at: order.created_at,
      items_count: order.items?.length || 0,
    }));
  }

  return <OrderHistoryClient initialOrders={initialOrders} />;
}
