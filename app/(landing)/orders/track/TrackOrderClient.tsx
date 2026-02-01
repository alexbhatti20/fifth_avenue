"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

interface TrackOrderClientProps {
  initialOrder: Order | null;
  initialRecentOrders: Order[];
  orderId: string | null;
}

export default function TrackOrderClient({ 
  initialOrder, 
  initialRecentOrders,
  orderId 
}: TrackOrderClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [recentOrders, setRecentOrders] = useState<Order[]>(initialRecentOrders);
  // Start loading if we have orderId but no initial order (needs client-side fetch)
  const [isLoading, setIsLoading] = useState(orderId && !initialOrder ? true : false);
  const [error, setError] = useState<string | null>(null);

  // Sync order state with initialOrder prop when it changes (navigation)
  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder);
      setIsLoading(false);
    }
  }, [initialOrder]);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  // Track if we've fetched - initialize to true if we already have orders from server
  const hasFetchedActiveOrdersRef = useRef(initialRecentOrders.length > 0);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure client-side only rendering to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (initialOrder) {
      setLastUpdate(new Date());
    }
  }, [initialOrder]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsMobileDevice(isMobile());
    const timer = setTimeout(() => setHasCheckedAuth(true), 100);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // Only redirect to auth if we're certain user is not logged in
    // Wait for auth to fully resolve and give extra time for cookie-based auth
    if (hasCheckedAuth && !authLoading && !user) {
      // Double-check by waiting a bit more before redirecting
      const redirectTimer = setTimeout(() => {
        if (!user && isMountedRef.current) {
          router.push("/auth");
        }
      }, 500);
      return () => clearTimeout(redirectTimer);
    }
  }, [user, authLoading, router, hasCheckedAuth]);

  // Fetch active orders on client if server didn't provide them
  const fetchActiveOrders = useCallback(async () => {
    if (!user?.id || hasFetchedActiveOrdersRef.current) return;
    
    hasFetchedActiveOrdersRef.current = true;
    
    try {
      setIsLoading(true);
      const res = await fetch('/api/customer/orders/active');
      const { data, error } = await res.json();
      
      if (!error && data && data.length > 0 && isMountedRef.current) {
        setRecentOrders(data);
      }
    } catch (err) {
      // Silent fail - reset flag to allow retry
      hasFetchedActiveOrdersRef.current = false;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  // Fetch active orders if not provided by server and no specific order ID
  useEffect(() => {
    // Only fetch if we don't have an orderId, user is logged in, no orders from server, and haven't fetched yet
    if (!orderId && user?.id && initialRecentOrders.length === 0 && mounted && !hasFetchedActiveOrdersRef.current) {
      fetchActiveOrders();
    }
  }, [orderId, user?.id, initialRecentOrders.length, mounted, fetchActiveOrders]);

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    
    try {
      setIsLoading(true);
      const res = await fetch(`/api/customer/orders/${orderId}`);
      const result = await res.json();

      if (!result.error && result.data && isMountedRef.current) {
        setOrder(result.data);
        setLastUpdate(new Date());
        setError(null);
      } else if (isMountedRef.current) {
        setError(result.error || 'Order not found');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to fetch order');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [orderId]);

  // Fetch order when orderId changes and we don't have initial order data
  useEffect(() => {
    if (orderId && !order && mounted) {
      fetchOrder();
    }
  }, [orderId, order, mounted, fetchOrder]);

  // Setup realtime subscription for order updates
  useEffect(() => {
    if (!orderId) return;

    // Subscribe to order changes
    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async () => {
          if (isMountedRef.current) {
            fetchOrder();
            setIsLive(true);
            setTimeout(() => setIsLive(false), 2000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (isMountedRef.current && payload.new?.status) {
            setOrder(prev => prev ? { ...prev, status: payload.new.status } : null);
            setLastUpdate(new Date());
            setIsLive(true);
            setTimeout(() => setIsLive(false), 2000);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [orderId, fetchOrder]);

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

  // Show loading when:
  // - Not yet mounted
  // - Explicitly loading (fetch in progress)
  // - Have orderId but order not yet loaded
  const showLoading = !mounted || isLoading || (orderId && !order && !error);
  
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Show recent orders list when no order ID is provided
  if (!orderId) {
    return (
      <div className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              onClick={() => router.push("/orders")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
            <h1 className="text-3xl font-bold">Track Your Order</h1>
            <p className="text-muted-foreground mt-2">
              Select an active order to track its progress
            </p>
          </motion.div>

          {recentOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Active Orders</h3>
              <p className="text-muted-foreground mb-6">
                You don&apos;t have any orders in progress
              </p>
              <Button onClick={() => router.push("/menu")} className="rounded-full">
                Browse Menu
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((o, index) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-2xl border p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/orders/track?id=${o.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Order #{o.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {o.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-2xl text-center">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || "We couldn't find this order"}
          </p>
          <Button onClick={() => router.push("/orders")} className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStepIndex();
  const estimatedTime = getEstimatedTime();

  return (
    <div className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
      <div className="container-custom max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/orders")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </motion.div>

        {/* Order Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border shadow-sm overflow-hidden mb-6"
        >
          {/* Order Header */}
          <div className="bg-primary/5 p-6 border-b">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold">ORDER #{order.order_number}</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">Rs. {order.total}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {order.payment_status?.replace("_", " ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLive && (
                <Badge variant="default" className="bg-green-500 animate-pulse">
                  <Radio className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              )}
            </div>
          </div>

          {/* Estimated Time */}
          {estimatedTime && order.status !== "delivered" && order.status !== "cancelled" && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                  <p className="font-bold text-green-600">{estimatedTime}</p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {order.customer_address && (
            <div className="p-4 border-b">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">{order.customer_address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Last Update */}
          {lastUpdate && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </motion.div>

        {/* Tracking Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border shadow-sm p-6"
        >
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            ORDER STATUS
          </h3>

          <div className="space-y-0">
            {trackingSteps.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isPending = index > currentStep;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="relative">
                  {/* Connector Line */}
                  {index < trackingSteps.length - 1 && (
                    <div
                      className={`absolute left-5 top-10 w-0.5 h-12 ${
                        isCompleted ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}

                  <div className="flex items-start gap-4 pb-8">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`font-semibold ${
                            isPending ? "text-muted-foreground" : ""
                          }`}
                        >
                          {step.label}
                        </h4>
                        {isCurrent && (
                          <Badge variant="default" className="text-xs bg-primary">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Rider Info */}
        {order.status === "delivering" && order.assigned_to_name && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 bg-card rounded-2xl border shadow-sm p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bike className="w-5 h-5 text-primary" />
              DELIVERY PARTNER
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{order.assigned_to_name}</p>
                  <p className="text-sm text-muted-foreground">Delivery Partner</p>
                </div>
              </div>
              {order.assigned_to_phone && (
                <a href={`tel:${order.assigned_to_phone}`}>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
