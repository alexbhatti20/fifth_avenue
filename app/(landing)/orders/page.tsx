// =============================================
// ORDERS PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerOrdersServer, getServerCustomer } from "@/lib/server-queries";
import OrdersClient from "./OrdersClient";

export const metadata: Metadata = {
  title: "My Orders | Fifth Avenue",
  description: "Track and manage your orders from Fifth Avenue.",
};

export default async function OrdersPage() {
  // Get customer from server-side session
  const customer = await getServerCustomer();
  
  // If no customer, the client component will handle redirect
  // We still render with empty orders to avoid flash
  let orders: any[] = [];
  
  if (customer) {
    // Fetch orders on server (hidden from Network tab)
    const result = await getCustomerOrdersServer(customer.id, {
      limit: 50,
      offset: 0,
      status: null,
    });
    orders = result.orders;
  }

  return <OrdersClient initialOrders={orders} />;
}
