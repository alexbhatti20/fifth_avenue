"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  ChefHat,
  MapPin,
  Phone,
  ArrowLeft,
  RefreshCw,
  User,
  Bike,
  Timer,
  Sparkles,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { isMobile } from "@/lib/utils";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  customer_address: string;
  created_at: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_phone?: string;
  items?: any[];
  notes?: string;
  payment_method?: string;
  payment_status?: string;
}

const trackingSteps = [
  { key: "pending", label: "Order Placed", icon: Package, description: "Your order has been received" },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle, description: "Restaurant confirmed your order" },
  { key: "preparing", label: "Preparing", icon: ChefHat, description: "Chef is preparing your food" },
  { key: "ready", label: "Ready", icon: Sparkles, description: "Order is ready for pickup/delivery" },
  { key: "delivering", label: "On the Way", icon: Bike, description: "Your order is out for delivery" },
  { key: "delivered", label: "Delivered", icon: CheckCircle, description: "Enjoy your meal!" },
];

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setIsMobileDevice(isMobile());
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    if (!orderId || !user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_order_details", {
        p_order_id: orderId,
        p_customer_id: user.id
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        if (isMountedRef.current) {
          setOrder(rpcData[0]);
          setLastUpdate(new Date());
        }
      } else {
        // Fallback to direct query with employee join
        const { data: orderData, error: queryError } = await supabase
          .from('orders')
          .select(`
            id, 
            order_number, 
            status, 
            total, 
            customer_address, 
            created_at, 
            assigned_to,
            items,
            notes,
            payment_method,
            payment_status
          `)
          .eq('id', orderId)
          .eq('customer_id', user.id)
          .single();
        
        if (queryError) {
          throw queryError;
        }
        
        if (orderData) {
          // If there's an assigned rider, fetch their details
          let riderName = null;
          let riderPhone = null;
          
          if (orderData.assigned_to) {
            const { data: employeeData } = await supabase
              .from('employees')
              .select('name, phone')
              .eq('id', orderData.assigned_to)
              .single();
            
            if (employeeData) {
              riderName = employeeData.name;
              riderPhone = employeeData.phone;
            }
          }
          
          if (isMountedRef.current) {
            setOrder({
              ...orderData,
              assigned_to_name: riderName,
              assigned_to_phone: riderPhone
            });
            setLastUpdate(new Date());
          }
        } else {
          setError("Order not found");
        }
      }
    } catch (err: any) {
      console.error("Error fetching order:", err);
      if (isMountedRef.current) {
        setError(err.message || "Failed to load order");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [orderId, user?.id]);

  // Fetch recent active orders
  const fetchRecentOrders = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total, customer_address, created_at')
        .eq('customer_id', user.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      if (isMountedRef.current) {
        setRecentOrders(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching recent orders:", err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  // Setup realtime subscription for order updates
  useEffect(() => {
    if (!orderId || !user?.id) return;

    // Initial fetch
    fetchOrder();

    // Subscribe to order changes
    const channel = supabase
      .channel(`order-track-${orderId}`)
      // Listen to direct order updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          console.log('Order updated:', payload);
          if (isMountedRef.current) {
            // Refetch full order to get rider details
            fetchOrder();
            setIsLive(true);
            setTimeout(() => setIsLive(false), 2000);
          }
        }
      )
      // Also listen to status history for status changes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log('Status history updated:', payload);
          if (isMountedRef.current && payload.new?.status) {
            setOrder(prev => prev ? { ...prev, status: payload.new.status } : null);
            setLastUpdate(new Date());
            setIsLive(true);
            setTimeout(() => setIsLive(false), 2000);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [orderId, user?.id, fetchOrder]);

  // Fetch recent orders when no specific order
  useEffect(() => {
    if (!orderId && user?.id) {
      fetchRecentOrders();
    }
  }, [orderId, user?.id, fetchRecentOrders]);

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const index = trackingSteps.findIndex((step) => step.key === order.status);
    return index >= 0 ? index : 0;
  };

  const getEstimatedTime = () => {
    if (!order) return null;
    const status = order.status;
    if (status === 'pending') return '25-35 mins';
    if (status === 'confirmed') return '20-30 mins';
    if (status === 'preparing') return '15-25 mins';
    if (status === 'ready') return '10-20 mins';
    if (status === 'delivering') return '5-15 mins';
    return null;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-8 h-8 text-primary" />
          </motion.div>
          <p className="text-muted-foreground">Loading order details...</p>
        </motion.div>
      </div>
    );
  }

  // Show recent orders list when no order ID is provided
  if (!orderId) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
          <div className="container-custom max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-3xl font-bold mb-2">Track Your Orders</h1>
              <p className="text-muted-foreground">
                Select an active order to track its status in real-time
              </p>
            </motion.div>

            {recentOrders.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No active orders</h2>
                <p className="text-muted-foreground mb-6">
                  You don't have any orders to track right now.
                </p>
                <Button onClick={() => router.push("/menu")} className="rounded-full">
                  Browse Menu
                </Button>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {recentOrders.map((recentOrder, index) => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
                    pending: { label: "Order Placed", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Clock },
                    confirmed: { label: "Confirmed", color: "text-blue-500", bg: "bg-blue-500/10", icon: CheckCircle },
                    preparing: { label: "Preparing", color: "text-orange-500", bg: "bg-orange-500/10", icon: ChefHat },
                    ready: { label: "Ready", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Sparkles },
                    delivering: { label: "On the Way", color: "text-purple-500", bg: "bg-purple-500/10", icon: Bike },
                  };
                  const config = statusConfig[recentOrder.status] || { label: recentOrder.status, color: "text-gray-500", bg: "bg-gray-500/10", icon: Package };
                  const StatusIcon = config.icon;

                  return (
                    <motion.div
                      key={recentOrder.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={!isMobileDevice ? { scale: 1.02, boxShadow: "0 20px 50px rgba(0, 0, 0, 0.1)" } : {}}
                      whileTap={{ scale: 0.98 }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 20 }}
                      onClick={() => router.push(`/orders/track?id=${recentOrder.id}`)}
                      className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-6 cursor-pointer hover:border-primary/50 transition-all relative overflow-hidden group"
                    >
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      
                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <div>
                          <h3 className="text-lg font-semibold mb-1">Order #{recentOrder.order_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(recentOrder.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xl">Rs. {recentOrder.total}</p>
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} mt-1`}>
                            <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                            <span className={`text-sm font-medium ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {recentOrder.customer_address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 relative z-10">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="line-clamp-1">{recentOrder.customer_address}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2 text-primary">
                          <Radio className="h-4 w-4 animate-pulse" />
                          <span className="text-sm font-medium">Live Tracking</span>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-primary rotate-180 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-center"
            >
              <Button
                variant="outline"
                onClick={() => router.push("/orders/history")}
                className="rounded-full"
              >
                View All Orders
              </Button>
            </motion.div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
          <div className="container-custom text-center py-16">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || "Order not found"}</h2>
            <p className="text-muted-foreground mb-6">
              The order you're looking for doesn't exist or you don't have access to it.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => fetchOrder()} variant="outline" className="rounded-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button onClick={() => router.push("/orders/track")} className="rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const currentStep = getCurrentStepIndex();
  const estimatedTime = getEstimatedTime();
  const isCancelled = order.status === 'cancelled';

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-2xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push("/orders/track")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          {/* Live Update Indicator */}
          <AnimatePresence>
            {isLive && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-4 flex items-center justify-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 py-2 rounded-full"
              >
                <Radio className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">Live Update Received!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Order Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-6 mb-6 relative overflow-hidden"
          >
            {/* Live indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-xs text-green-600 font-medium">LIVE</span>
            </div>

            <div className="flex items-start justify-between mb-4 pr-16">
              <div>
                <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
                <p className="text-muted-foreground text-sm">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-2xl text-primary">Rs. {order.total}</p>
                {order.payment_status && (
                  <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending Payment'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Estimated Time */}
            {estimatedTime && !isCancelled && order.status !== 'delivered' && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl mb-4">
                <Timer className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                  <p className="font-semibold text-primary">{estimatedTime}</p>
                </div>
              </div>
            )}

            {order.customer_address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{order.customer_address}</span>
              </div>
            )}
            
            {lastUpdate && (
              <p className="text-xs text-muted-foreground mt-4">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </motion.div>

          {/* Tracking Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-card via-card to-secondary/30 rounded-2xl border shadow-lg p-6 mb-6 overflow-hidden relative"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            
            <h2 className="font-semibold mb-6 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Order Status
            </h2>

            {isCancelled ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-red-600 mb-2">Order Cancelled</h3>
                <p className="text-muted-foreground">This order has been cancelled.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-secondary" />
                <motion.div
                  className="absolute left-6 top-0 w-0.5 bg-gradient-to-b from-primary to-primary/50"
                  initial={{ height: 0 }}
                  animate={{
                    height: `${(currentStep / (trackingSteps.length - 1)) * 100}%`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />

                {/* Steps */}
                <div className="space-y-6">
                  {trackingSteps.map((step, index) => {
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;
                    const StepIcon = step.icon;

                    return (
                      <motion.div
                        key={step.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1, type: "spring" }}
                        className="flex items-center gap-4 relative"
                      >
                        <motion.div
                          className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all ${
                            isCompleted
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                              : "bg-secondary text-muted-foreground"
                          }`}
                          animate={
                            isCurrent
                              ? {
                                  scale: [1, 1.1, 1],
                                }
                              : {}
                          }
                          transition={{ duration: 1.5, repeat: isCurrent ? Infinity : 0 }}
                        >
                          <StepIcon className="h-5 w-5" />
                        </motion.div>

                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              isCompleted ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className={`text-sm ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                            {isCurrent ? "In Progress" : isCompleted && index < currentStep ? "Completed" : step.description}
                          </p>
                        </div>

                        {isCompleted && index < currentStep && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {isCurrent && (
                          <motion.div
                            className="h-3 w-3 rounded-full bg-primary"
                            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Delivery Person Info - Shows when assigned */}
          <AnimatePresence>
            {order.assigned_to_name && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-green-200 dark:border-green-800 shadow-lg p-6 relative overflow-hidden mb-6"
              >
                {/* Animated background */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-green-100/50 to-transparent dark:from-green-800/20"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Bike className="h-5 w-5 text-green-600" />
                    <h2 className="font-semibold text-green-800 dark:text-green-400">
                      {order.status === 'delivering' ? 'Your Delivery Partner' : 'Assigned Rider'}
                    </h2>
                    {order.status === 'delivering' && (
                      <Badge className="bg-green-500 text-white animate-pulse ml-auto">On the way</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                        <User className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-xl text-gray-900 dark:text-white">{order.assigned_to_name}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {order.status === 'delivering' ? '🛵 On the way to you' : '✓ Assigned to your order'}
                        </p>
                      </div>
                    </div>
                    
                    {order.assigned_to_phone && (
                      <a href={`tel:${order.assigned_to_phone}`}>
                        <Button className="rounded-full bg-green-600 hover:bg-green-700 shadow-lg">
                          <Phone className="h-4 w-4 mr-2" />
                          Call Now
                        </Button>
                      </a>
                    )}
                  </div>
                  
                  {order.assigned_to_phone && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Contact: {order.assigned_to_phone}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Order Items Preview */}
          {order.items && order.items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-2xl border shadow-lg p-6 mb-6"
            >
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Order Items ({order.items.length})
              </h2>
              <div className="space-y-3">
                {order.items.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🍗</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-sm">Rs. {item.price * item.quantity}</p>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{order.items.length - 3} more items
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Notes */}
          {order.notes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800"
            >
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> {order.notes}
              </p>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <Button
              variant="outline"
              onClick={() => router.push(`/orders/${order.id}`)}
              className="flex-1 rounded-full"
            >
              View Full Details
            </Button>
            <Button
              onClick={() => router.push("/menu")}
              className="flex-1 rounded-full"
            >
              Order Again
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-8 h-8 text-primary" />
            </motion.div>
            <p className="text-muted-foreground">Loading...</p>
          </motion.div>
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
