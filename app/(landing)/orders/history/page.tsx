"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Package,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { isMobile } from "@/lib/utils";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface OrderHistory {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items_count: number;
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
    setIsMobileDevice(isMobile());
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchOrderHistory();
    }
  }, [user]);

  const fetchOrderHistory = async () => {
    if (!user) return;

    try {
      // Use RPC for optimized query
      const { data, error } = await supabase.rpc("get_customer_orders_paginated", {
        p_customer_id: user.id,
        p_limit: 100,
        p_offset: 0,
        p_status: null
      });

      if (error) throw error;

      setOrders(
        data?.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_amount: order.total,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          created_at: order.created_at,
          items_count: order.items?.length || 0,
        })) || []
      );
    } catch (error) {
      } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      // Use RPC for optimized order details query
      const { data, error } = await supabase.rpc("get_order_details", {
        p_order_id: orderId,
        p_customer_id: user?.id
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const orderData = data[0];
        // Transform the data to match the expected format
        const transformedData = {
          ...orderData,
          total_amount: orderData.total,
          subtotal: orderData.subtotal,
          discount_amount: orderData.discount || 0,
          delivery_fee: orderData.delivery_fee || 0,
          order_items: Array.isArray(orderData.items) ? orderData.items : []
        };
        setOrderDetails(transformedData);
      } else {
        setOrderDetails(null);
      }
    } catch (error) {
      setOrderDetails(null);
    }
  };

  const handleExpandOrder = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      setOrderDetails(null);
    } else {
      setExpandedOrder(orderId);
      await fetchOrderDetails(orderId);
    }
  };

  const downloadInvoice = async (orderId: string) => {
    // In a real app, this would generate a PDF invoice
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Create a simple text invoice for now
    const invoiceContent = `
ZOIRO BROAST
Invoice #${order.order_number}
Date: ${new Date(order.created_at).toLocaleDateString()}

Status: ${order.status}
Payment: ${order.payment_method} (${order.payment_status})

Total: Rs. ${order.total_amount}

Thank you for your order!
    `;

    const blob = new Blob([invoiceContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${order.order_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    // Search filter
    if (
      searchQuery &&
      !order.order_number.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const orderDate = new Date(order.created_at);
      const now = new Date();

      if (dateFilter === "today") {
        if (orderDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (orderDate < weekAgo) return false;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (orderDate < monthAgo) return false;
      }
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
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push("/orders")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                <History className="h-8 w-8 text-primary" />
                Order History
              </h1>
              <p className="text-muted-foreground">
                View all your past orders and download invoices
              </p>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)" }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-4 mb-6"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by order number..."
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                  ? "Try adjusting your filters"
                  : "You haven't placed any orders yet"}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={!isMobileDevice ? { 
                    scale: 1.02, 
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
                    transition: { type: "spring", stiffness: 400, damping: 25 }
                  } : {}}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gradient-to-br from-card via-card to-secondary/20 rounded-2xl border shadow-md overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                  {/* Order Summary */}
                  <motion.div
                    className="p-4 md:p-6 cursor-pointer hover:bg-secondary/40 transition-all duration-300 relative z-10"
                    onClick={() => handleExpandOrder(order.id)}
                    whileHover={!isMobileDevice ? { x: 5 } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            order.status === "delivered"
                              ? "bg-green-500/10 text-green-500"
                              : order.status === "cancelled"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          {order.status === "delivered" ? (
                            <CheckCircle className="h-6 w-6" />
                          ) : order.status === "cancelled" ? (
                            <XCircle className="h-6 w-6" />
                          ) : (
                            <Clock className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">#{order.order_number}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.created_at).toLocaleDateString()}
                            <span>•</span>
                            {order.items_count} item{order.items_count !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="font-bold text-lg">Rs. {order.total_amount}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {order.payment_method?.replace("_", " ")}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            expandedOrder === order.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedOrder === order.id && orderDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="border-t"
                      >
                        <div className="p-4 md:p-6 bg-gradient-to-b from-secondary/30 to-secondary/10">
                          {/* Order Items */}
                          <div className="space-y-3 mb-6">
                            {orderDetails.order_items && orderDetails.order_items.length > 0 ? (
                              orderDetails.order_items.map((item: any, index: number) => (
                                <div
                                  key={item.id || index}
                                  className="flex items-center gap-4 p-3 bg-background rounded-xl"
                                >
                                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.name || 'Item'}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        🍗
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium">{item.name || 'Unknown Item'}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Qty: {item.quantity} × Rs. {item.price || item.unit_price}
                                    </p>
                                    {item.special_instructions && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Note: {item.special_instructions}
                                      </p>
                                    )}
                                  </div>
                                  <p className="font-semibold">
                                    Rs. {item.quantity * (item.price || item.unit_price)}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-center text-muted-foreground py-4">
                                No items found for this order
                              </p>
                            )}
                          </div>

                          {/* Order Summary */}
                          <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>Rs. {orderDetails.subtotal || orderDetails.total_amount}</span>
                            </div>
                            {orderDetails.discount_amount > 0 && (
                              <div className="flex justify-between text-sm text-green-500">
                                <span>Discount</span>
                                <span>-Rs. {orderDetails.discount_amount}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Delivery Fee</span>
                              <span>Rs. {orderDetails.delivery_fee || 0}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                              <span>Total</span>
                              <span>Rs. {orderDetails.total_amount}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-6">
                            <Button
                              variant="outline"
                              className="flex-1 rounded-xl"
                              onClick={() => downloadInvoice(order.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Invoice
                            </Button>
                            <Button
                              className="flex-1 rounded-xl"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
