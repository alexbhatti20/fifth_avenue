"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  MapPin,
  Phone,
  CreditCard,
  ArrowRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { subscribeToOrders } from "@/lib/realtime";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface Order {
  id: string;
  order_number: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
  total: number;
  payment_method: string;
  payment_status: string;
  customer_address?: string;
  created_at: string;
  items: OrderItem[];
  assigned_to_name?: string;
  assigned_to_phone?: string;
}

interface OrderItem {
  id: string;
  menu_item: {
    name: string;
    image_url: string;
  };
  quantity: number;
  unit_price: number;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "text-blue-500", bg: "bg-blue-500/10", label: "Confirmed" },
  preparing: { icon: ChefHat, color: "text-orange-500", bg: "bg-orange-500/10", label: "Preparing" },
  ready: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Ready" },
  delivering: { icon: Truck, color: "text-purple-500", bg: "bg-purple-500/10", label: "Out for Delivery" },
  delivered: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Delivered" },
  cancelled: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Cancelled" },
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      // Set up realtime subscription using the realtime helper
      const unsubscribe = subscribeToOrders(
        (payload) => {
          // Only refetch when there's an actual change
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Update the specific order in state instead of refetching all
            setOrders(prev => {
              const updated = [...prev];
              const index = updated.findIndex(o => o.id === payload.new?.id);
              if (index >= 0) {
                updated[index] = { ...updated[index], ...payload.new };
              } else if (payload.eventType === 'INSERT') {
                updated.unshift(payload.new);
              }
              return updated;
            });
          }
        },
        { customerId: user.id }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      // Use RPC for optimized query
      const { data, error } = await supabase.rpc("get_customer_orders_paginated", {
        p_customer_id: user.id,
        p_limit: 50,
        p_offset: 0,
        p_status: null
      });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      } finally {
      setIsLoading(false);
    }
  }, [user]);

  const filteredOrders = orders.filter((order) => {
    if (filter === "active") {
      return ["pending", "confirmed", "preparing", "ready", "delivering"].includes(order.status);
    }
    if (filter === "completed") {
      return ["delivered", "cancelled"].includes(order.status);
    }
    return true;
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-2">My Orders</h1>
            <p className="text-muted-foreground">Track and manage your orders</p>
          </motion.div>

          {/* Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2 mb-6"
          >
            {[
              { value: "all", label: "All Orders" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={filter === tab.value ? "default" : "outline"}
                onClick={() => setFilter(tab.value as typeof filter)}
                className="rounded-full"
              >
                {tab.label}
              </Button>
            ))}
          </motion.div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground mb-6">
                Start ordering delicious food from our menu!
              </p>
              <Button onClick={() => router.push("/menu")} className="rounded-full">
                Browse Menu
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredOrders.map((order, index) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-card rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-6">
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Order #{order.order_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${status.bg}`}>
                            <StatusIcon className={`h-4 w-4 ${status.color}`} />
                            <span className={`text-sm font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Preview */}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex -space-x-2">
                            {order.items?.slice(0, 3).map((item, i) => (
                              <div
                                key={`${order.id}-item-${i}`}
                                className="w-10 h-10 rounded-full bg-secondary border-2 border-background overflow-hidden"
                              >
                                {item.menu_item?.image_url ? (
                                  <img
                                    src={item.menu_item.image_url}
                                    alt={item.menu_item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs">
                                    🍗
                                  </div>
                                )}
                              </div>
                            ))}
                            {order.items?.length > 3 && (
                              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-xs font-medium">
                                +{order.items.length - 3}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">
                              {order.items?.length} item{order.items?.length !== 1 ? "s" : ""}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {order.items?.map((i) => i.menu_item?.name).join(", ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">Rs. {order.total}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {order.payment_method?.replace("_", " ")}
                            </p>
                          </div>
                        </div>

                        {/* Delivery Rider Info (if out for delivery) */}
                        {order.status === "delivering" && order.assigned_to_name && (
                          <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                  <Truck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{order.assigned_to_name}</p>
                                  <p className="text-sm text-muted-foreground">Delivery Partner</p>
                                </div>
                              </div>
                              {order.assigned_to_phone && (
                                <a href={`tel:${order.assigned_to_phone}`}>
                                  <Button size="sm" variant="outline" className="rounded-full">
                                    <Phone className="h-4 w-4 mr-1" />
                                    Call
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{order.customer_address || 'N/A'}</span>
                          </div>
                          <div className="flex gap-2">
                            {["pending", "confirmed", "preparing", "ready", "delivering"].includes(
                              order.status
                            ) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => router.push(`/orders/track?id=${order.id}`)}
                              >
                                <MapPin className="h-4 w-4 mr-1" />
                                Track
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
