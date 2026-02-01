// =============================================
// ORDER DETAILS PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { getServerCustomer, getOrderDetailsServer } from "@/lib/server-queries";
import OrderDetailClient from "./OrderDetailClient";

export const metadata: Metadata = {
  title: "Order Details | Zoiro Broast",
  description: "View your order details from Zoiro Broast.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  // Get customer from server-side session
  const customer = await getServerCustomer();
  
  let initialOrder = null;
  
  if (customer && id) {
    // Fetch order details on server (hidden from Network tab)
    initialOrder = await getOrderDetailsServer(id, customer.id);
  }

  return <OrderDetailClient initialOrder={initialOrder} />;
}
