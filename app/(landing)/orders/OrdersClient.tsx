"use client";

import React, { useState, useEffect } from "react";
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
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToOrders } from "@/lib/realtime";
import { cn } from "@/lib/utils";

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
  pending: { icon: Clock, color: "text-black", bg: "bg-[#FFD200]", label: "PENDING" },
  confirmed: { icon: CheckCircle, color: "text-[#FFD200]", bg: "bg-black", label: "CONFIRMED" },
  preparing: { icon: ChefHat, color: "text-black", bg: "bg-[#F28C00]", label: "PREPARING" },
  ready: { icon: CheckCircle, color: "text-black", bg: "bg-[#FFD200]", label: "READY" },
  delivering: { icon: Truck, color: "text-white", bg: "bg-[#1E1E1E]", label: "OUT FOR DELIVERY" },
  delivered: { icon: CheckCircle, color: "text-white", bg: "bg-[#008A45]", label: "DELIVERED" },
  cancelled: { icon: XCircle, color: "text-white", bg: "bg-[#ED1C24]", label: "CANCELLED" },
};

interface OrdersClientProps {
  initialOrders: Order[];
}

export default function OrdersClient({ initialOrders }: OrdersClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHasCheckedAuth(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, hasCheckedAuth, router]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToOrders(
      (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          setOrders((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((o) => o.id === payload.new?.id);
            if (index >= 0) {
              updated[index] = { ...updated[index], ...payload.new };
            } else if (payload.eventType === "INSERT") {
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

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-12 h-12 text-[#FFD200]" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-16 bg-[#F8F8F8]">
      <div className="container-custom max-w-5xl px-4">
        {/* Header - Urban Style */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12 border-l-8 border-black pl-6"
        >
          <h1 className="font-bebas text-6xl md:text-8xl text-black leading-[0.8] tracking-tighter uppercase">
            MY <br />
            <span className="text-[#ED1C24] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">ORDERS</span>
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <span className="font-caveat text-2xl text-black/60 italic">Track your hunger in real-time.</span>
            <Package className="w-5 h-5 text-[#FFD200] fill-[#FFD200]" />
          </div>
        </motion.div>

        {/* Filter Tabs - Brutalist Style */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-3 mb-10"
        >
          {[
            { value: "all", label: "ALL ORDERS" },
            { value: "active", label: "ACTIVE" },
            { value: "completed", label: "COMPLETED" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as typeof filter)}
              className={cn(
                "px-6 py-2 font-bebas text-xl tracking-wider transition-all border-4 border-black",
                filter === tab.value 
                  ? "bg-black text-[#FFD200] shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]" 
                  : "bg-white text-black hover:bg-black hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          >
            <Package className="w-20 h-20 mx-auto text-black/10 mb-6" />
            <h3 className="font-bebas text-4xl text-black mb-2 uppercase tracking-tighter">NO ORDERS FOUND</h3>
            <p className="font-caveat text-2xl text-black/40 italic mb-8">
              Your order history is a ghost town...
            </p>
            <Button 
              onClick={() => router.push("/menu")} 
              className="bg-black text-[#FFD200] font-bebas text-2xl px-10 py-8 border-4 border-black shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none"
            >
              GO TO MENU
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, index) => {
                const status = statusConfig[order.status];
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                  >
                    <div className="p-6 sm:p-8">
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div>
                          <span className="font-bebas text-sm tracking-widest text-black/40 block mb-1">IDENTIFICATION</span>
                          <h3 className="font-bebas text-3xl text-black leading-none uppercase">#{order.order_number}</h3>
                          <p className="font-source-sans text-xs font-bold text-black/40 mt-1 uppercase">
                            {new Date(order.created_at).toLocaleDateString("en-US", {
                              weekday: 'short',
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className={cn(
                          "flex items-center gap-3 px-6 py-2 border-4 border-black font-bebas text-xl tracking-widest uppercase",
                          status.bg,
                          status.color
                        )}>
                          <StatusIcon className="h-5 w-5" />
                          {status.label}
                        </div>
                      </div>

                      {/* Items & Total Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mb-8 pt-8 border-t-2 border-black/5">
                        <div className="md:col-span-8 flex items-center gap-6">
                          <div className="flex -space-x-4">
                            {order.items?.slice(0, 3).map((item, i) => (
                              <div
                                key={`${order.id}-item-${i}`}
                                className="w-16 h-16 rounded-none bg-[#FFD200] border-4 border-black overflow-hidden flex-shrink-0"
                              >
                                {item.menu_item?.image_url ? (
                                  <img
                                    src={item.menu_item.image_url}
                                    alt={item.menu_item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-2xl">🍗</div>
                                )}
                              </div>
                            ))}
                            {order.items?.length > 3 && (
                              <div className="w-16 h-16 rounded-none bg-black text-[#FFD200] border-4 border-black flex items-center justify-center font-bebas text-2xl">
                                +{order.items.length - 3}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bebas text-2xl text-black truncate">
                              {order.items?.length} {order.items?.length !== 1 ? "STREET PACKS" : "STREET PACK"}
                            </p>
                            <p className="font-source-sans text-sm font-bold text-black/50 truncate uppercase">
                              {order.items?.map((i) => i.menu_item?.name).join(" + ")}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-4 flex flex-row md:flex-col justify-between items-end md:items-end gap-2">
                           <span className="font-bebas text-sm tracking-widest text-black/40 block md:hidden">BILL TOTAL</span>
                           <div className="text-right">
                             <p className="font-bebas text-4xl text-black leading-none">RS. {order.total}</p>
                             <p className="font-bebas text-sm text-[#ED1C24] tracking-widest uppercase">
                               {order.payment_method?.replace("_", " ")}
                             </p>
                           </div>
                        </div>
                      </div>

                      {/* Delivery Rider Alert */}
                      {order.status === "delivering" && order.assigned_to_name && (
                        <motion.div 
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="bg-[#FFD200] border-4 border-black p-4 mb-8 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <Truck className="h-8 w-8 text-black animate-bounce" />
                            <div>
                              <p className="font-bebas text-xl text-black leading-tight">YOUR RIDER IS NEAR: {order.assigned_to_name}</p>
                              <span className="font-source-sans text-[10px] font-bold text-black/60 uppercase tracking-tighter">OUT FOR DELIVERY</span>
                            </div>
                          </div>
                          {order.assigned_to_phone && (
                            <a href={`tel:${order.assigned_to_phone}`}>
                              <Button className="bg-black text-white hover:bg-white hover:text-black rounded-none border-2 border-black font-bebas">
                                <Phone className="h-4 w-4 mr-2" />
                                CALL RIDER
                              </Button>
                            </a>
                          )}
                        </motion.div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t-4 border-black">
                        <div className="flex items-center gap-3">
                          <div className="bg-black text-white p-1.5 border-2 border-black">
                             <MapPin className="h-4 w-4" />
                          </div>
                          <span className="font-bebas text-lg text-black truncate max-w-[250px] uppercase">
                            {order.customer_address || 'PICKUP @ STREET'}
                          </span>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                          {["pending", "confirmed", "preparing", "ready", "delivering"].includes(order.status) && (
                            <Button
                              onClick={() => router.push(`/orders/track?id=${order.id}`)}
                              className="flex-1 sm:flex-none bg-white text-black border-4 border-black hover:bg-black hover:text-[#FFD200] font-bebas text-xl h-12 rounded-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                            >
                              TRACK
                            </Button>
                          )}
                          <Button
                            onClick={() => router.push(`/orders/${order.id}`)}
                            className="flex-1 sm:flex-none bg-black text-[#FFD200] border-4 border-black hover:bg-[#FFD200] hover:text-black font-bebas text-xl h-12 rounded-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                          >
                            DETAILS
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
    </div>
  );
}
