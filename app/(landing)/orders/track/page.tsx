// =============================================
// TRACK ORDER PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { getServerCustomer, getOrderDetailsServer } from "@/lib/server-queries";
import { supabase } from "@/lib/supabase";
import TrackOrderClient from "./TrackOrderClient";

export const metadata: Metadata = {
  title: "Track Order | ZOIRO Injected Broast",
  description: "Track your order status in real-time.",
};

// Get active orders for the customer
async function getActiveOrders(customerId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, total, customer_address, created_at, assigned_to_name, assigned_to_phone')
    .eq('customer_id', customerId)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data || [];
}

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function TrackOrderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const orderId = params.id || null;
  
  // Get customer from server-side session
  const customer = await getServerCustomer();
  
  let initialOrder = null;
  let initialRecentOrders: any[] = [];
  
  if (customer) {
    if (orderId) {
      // Fetch specific order on server (hidden from Network tab)
      initialOrder = await getOrderDetailsServer(orderId, customer.id);
    } else {
      // Fetch recent active orders
      initialRecentOrders = await getActiveOrders(customer.id);
    }
  }

  return (
    <TrackOrderClient 
      initialOrder={initialOrder} 
      initialRecentOrders={initialRecentOrders}
      orderId={orderId}
    />
  );
}
