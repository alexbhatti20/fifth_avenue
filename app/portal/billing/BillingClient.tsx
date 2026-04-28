'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
  QrCode,
  Utensils,
  ShoppingBag,
  User,
  Crown,
  Phone,
  Bell,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { getBillingDashboardStats, getBillingPendingOrders } from '@/lib/actions';
import { cn, isNetworkError } from '@/lib/utils';
import { toast } from 'sonner';
import { usePortalAuth } from '@/hooks/usePortal';
import { playNotificationSound, enableAudio, isAudioContextEnabled } from '@/lib/notification-sound';
import type { BillingStatsServer, BillableOrderServer } from '@/lib/server-queries';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';

// Import billing module components
import {
  BillingDashboardStats,
  PendingOrdersList,
  InvoicesList,
  InvoicePrintView,
  type BillableOrder,
  type BillingStats,
  type InvoiceDetails,
} from '@/components/portal/billing';

// Allowed roles for billing page
const ALLOWED_ROLES = ['admin', 'manager', 'billing_staff', 'waiter', 'reception'];

interface BillingClientProps {
  initialStats: BillingStatsServer | null;
  initialPendingOrders: BillableOrderServer[];
  initialPendingCount: number;
  initialOnlineOrdersCount: number;
  initialInvoices: any[];
  initialBillableOrders: BillableOrderServer[];
}

export default function BillingClient({ initialStats, initialPendingOrders, initialPendingCount, initialOnlineOrdersCount, initialInvoices, initialBillableOrders }: BillingClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdFromUrl = searchParams.get('order');
  
  const { employee, isLoading: isAuthLoading } = usePortalAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Data states - cast through unknown to avoid type mismatch (server types are subsets)
  const [stats, setStats] = useState<BillingStats | null>(initialStats as unknown as BillingStats | null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Pending orders for dashboard preview
  const [pendingOrders, setPendingOrders] = useState<BillableOrder[]>(initialPendingOrders as unknown as BillableOrder[]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [onlineOrdersCount, setOnlineOrdersCount] = useState(initialOnlineOrdersCount);
  
  // Online order notification state
  const [newOnlineOrder, setNewOnlineOrder] = useState<any>(null);
  const lastOnlineOrderRef = useRef<string | null>(null);
  
  // Sound enabled state
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  // Print view state
  const [generatedInvoice, setGeneratedInvoice] = useState<InvoiceDetails | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);

  // Check authorization
  useEffect(() => {
    if (!isAuthLoading && employee) {
      const hasAccess = ALLOWED_ROLES.includes(employee.role || '');
      setIsAuthorized(hasAccess);
      
      if (!hasAccess) {
        toast.error('Access denied. You do not have permission to access billing.');
      }
    }
  }, [employee, isAuthLoading]);

  // Fetch stats using Server Action (hidden from Network tab)
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const result = await getBillingDashboardStats();
      
      if (result.success && result.data?.success) {
        const data = result.data;
        // Map RPC response to expected format with aliases
        setStats({
          ...data,
          pending_count: data.pending_orders || 0,
          cash_today: data.today?.cash_revenue || 0,
          card_today: data.today?.card_revenue || 0,
          online_today: data.today?.online_revenue || 0,
        });
      }
    } catch (error: any) {
      if (isNetworkError(error)) {
        toast.error('Unable to connect. Please check your internet connection.');
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch pending orders using Server Action (hidden from Network tab)
  const fetchPendingOrders = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const result = await getBillingPendingOrders(5); // Show only first 5 on dashboard

      if (result.success && result.data?.success) {
        setPendingOrders(result.data.orders || []);
        setPendingCount(result.data.pending_count || 0);
        setOnlineOrdersCount(result.data.online_orders_count || 0);
      }
    } catch (error: any) {
      if (isNetworkError(error)) {
        toast.error('Unable to connect. Please check your internet connection.');
      }
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(() => {
    fetchStats();
    fetchPendingOrders();
  }, [fetchStats, fetchPendingOrders]);

  // FIX #2: Properly track SSR data to prevent duplicate fetches
  const hasSSRData = initialStats !== null && initialPendingOrders !== undefined && initialPendingOrders.length >= 0;
  const hasFetchedRef = useRef(hasSSRData); // Initialize to true if we have SSR data

  useEffect(() => {
    // FIX #2: Skip initial fetch if we have server-provided data (SSR) or already fetched
    if (hasFetchedRef.current) return;
    if (isAuthorized) {
      hasFetchedRef.current = true;
      fetchAllData();
    }
  }, [isAuthorized, fetchAllData]);

  // Enable sound on first user interaction
  const handleEnableSound = useCallback(async () => {
    const enabled = await enableAudio();
    if (enabled) {
      setSoundEnabled(true);
      toast.success('🔊 Sound notifications enabled');
      // Play a test sound
      await playNotificationSound('assignment');
    } else {
      toast.error('Could not enable sound notifications');
    }
  }, []);

  // Check sound status on mount
  useEffect(() => {
    setSoundEnabled(isAudioContextEnabled());
  }, []);

  // Real-time subscription for new online orders via shared ORDERS channel
  useEffect(() => {
    if (!isAuthorized) return;

    const callback = async (payload?: any) => {
      // Only react to INSERT events for online orders
      if (payload?.eventType !== 'INSERT') return;
      const newOrder = payload.new as any;
      if (newOrder?.order_type !== 'online') return;
      
      // Check if this is a new order we haven't notified about
      if (newOrder.id !== lastOnlineOrderRef.current) {
        lastOnlineOrderRef.current = newOrder.id;
        
        // Show notification
        setNewOnlineOrder({
          id: newOrder.id,
          order_number: newOrder.order_number,
          customer_name: newOrder.customer_name || 'Online Customer',
          total: newOrder.total,
          created_at: newOrder.created_at,
        });
        
        // Play notification sound
        try {
          await playNotificationSound('new_order');
        } catch (e) {
          
        }
        
        // Show toast notification
        toast.info(
          `🛒 New Online Order #${newOrder.order_number}`,
          {
            description: `${newOrder.customer_name || 'Online Customer'} - Rs. ${newOrder.total?.toLocaleString()}`,
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => router.push(`/portal/orders`),
            },
          }
        );
        
        // Refresh pending orders count
        fetchPendingOrders();
        
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setNewOnlineOrder(null);
        }, 8000);
      }
    };

    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      callback
    );

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchPendingOrders();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [isAuthorized, fetchPendingOrders, router]);
  
  // Redirect to full page if order param is present
  useEffect(() => {
    if (isAuthorized && orderIdFromUrl) {
      router.push(`/portal/billing/${orderIdFromUrl}`);
    }
  }, [isAuthorized, orderIdFromUrl, router]);

  // Handle order selection - navigate to full page
  const handleGenerateBill = (order: BillableOrder) => {
    router.push(`/portal/billing/${order.id}`);
  };

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto" />
          <p className="text-muted-foreground">Loading billing system...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <ShieldCheck className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold">Access Restricted</h2>
              <p className="text-muted-foreground">
                The billing system is only accessible to managers, billing staff, reception, and administrators.
              </p>
              <Badge variant="outline" className="text-sm">
                Your role: {employee?.role || 'Unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      {/* New Online Order Notification Banner */}
      <AnimatePresence>
        {newOnlineOrder && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md"
          >
            <Card className="border-4 border-black bg-white rounded-none shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 border-4 border-black bg-[#ED1C24] flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bebas text-lg tracking-widest text-[#ED1C24] uppercase">New Online Order!</span>
                    </div>
                    <p className="font-bebas text-3xl tracking-tighter text-black">#{newOnlineOrder.order_number}</p>
                    <p className="text-xs font-source-sans font-black uppercase tracking-widest text-black/40">{newOnlineOrder.customer_name}</p>
                    <p className="text-2xl font-bebas text-[#008A45] mt-1">
                      RS. {newOnlineOrder.total?.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewOnlineOrder(null)}
                    className="text-black hover:bg-black/5"
                  >
                    ✕
                  </Button>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="flex-1 bg-black text-[#FFD200] font-bebas text-lg tracking-widest rounded-none border-2 border-black hover:bg-black/90"
                    onClick={() => {
                      router.push('/portal/orders');
                      setNewOnlineOrder(null);
                    }}
                  >
                    VIEW ORDERS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-bebas text-lg tracking-widest rounded-none border-2 border-black hover:bg-black/5"
                    onClick={() => setNewOnlineOrder(null)}
                  >
                    DISMISS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online Orders Alert Banner */}
      {onlineOrdersCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 border-4 border-black bg-[#FFD200] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 border-4 border-black bg-black flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-[#FFD200]" />
              </div>
              <div>
                <p className="font-bebas text-2xl text-black tracking-tight leading-none">
                  {onlineOrdersCount} ONLINE ORDER{onlineOrdersCount > 1 ? 'S' : ''} PENDING
                </p>
                <p className="text-[10px] font-source-sans font-black text-black/60 uppercase tracking-widest mt-1">
                  NEW ORDERS RECEIVED FROM ONLINE PLATFORM
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-black text-[#FFD200] font-bebas text-lg tracking-widest rounded-none border-2 border-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
              onClick={() => router.push('/portal/orders')}
            >
              VIEW ORDERS
            </Button>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <SectionHeader
          title="Billing & Invoices"
          description="Generate invoices, apply promo codes, and manage payments"
          icon={<Receipt className="h-5 w-5 md:h-6 md:w-6 text-red-500" />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="py-1.5 text-xs md:text-sm">
            <CheckCircle2 className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-green-500" />
            <span className="truncate max-w-[100px] md:max-w-none">{employee?.name}</span>
          </Badge>
          
          {/* Sound Toggle Button */}
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={handleEnableSound}
            className={cn(
              "font-bebas text-lg tracking-widest rounded-none border-2 border-black transition-all",
              soundEnabled 
                ? "bg-[#008A45] text-white hover:bg-[#008A45]/90" 
                : "bg-white text-black hover:bg-black/5"
            )}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 mr-2" />
            ) : (
              <VolumeX className="h-4 w-4 mr-2" />
            )}
            {soundEnabled ? "SOUND ON" : "ENABLE SOUND"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllData}
            disabled={isLoadingStats || isLoadingPending}
            className="ml-auto"
          >
            <RefreshCw className={cn('h-4 w-4', (isLoadingStats || isLoadingPending) && 'animate-spin')} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && <BillingDashboardStats stats={stats} isLoading={isLoadingStats} />}

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,138,69,1)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-[#008A45]" />
              <span className="font-bebas text-lg tracking-widest text-black/40 uppercase">CASH</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bebas text-black leading-none">
              RS. {(stats.cash_today || 0).toLocaleString()}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-black" />
              <span className="font-bebas text-lg tracking-widest text-black/40 uppercase">CARD</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bebas text-black leading-none">
              RS. {(stats.card_today || 0).toLocaleString()}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(237,28,36,1)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="h-4 w-4 text-[#ED1C24]" />
              <span className="font-bebas text-lg tracking-widest text-black/40 uppercase">ONLINE</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bebas text-black leading-none">
              RS. {(stats.online_today || 0).toLocaleString()}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(255,210,0,1)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-[#FFD200]" />
              <span className="font-bebas text-lg tracking-widest text-black/40 uppercase">PENDING</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bebas text-black leading-none">
              {pendingCount || stats.pending_count || 0} ORDERS
            </p>
          </motion.div>
        </div>
      )}

      {/* Orders Awaiting Bill - Dashboard Preview */}
      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              Orders Awaiting Bill
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('pending')}
              className="text-xs sm:text-sm"
            >
              View All
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Ready orders that need billing</p>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingPending ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 sm:h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
                    <div className="h-2 sm:h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
                  </div>
                  <div className="h-4 sm:h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
                </div>
              ))}
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-green-500 mx-auto mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base text-muted-foreground">All orders have been billed!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map((order, index) => {
                const orderTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
                  'dine-in': { color: 'bg-blue-500/10 text-blue-600', icon: <Utensils className="h-2.5 w-2.5 sm:h-3 sm:w-3" />, label: 'Dine-in' },
                  'dine_in': { color: 'bg-blue-500/10 text-blue-600', icon: <Utensils className="h-2.5 w-2.5 sm:h-3 sm:w-3" />, label: 'Dine-in' },
                  'online': { color: 'bg-purple-500/10 text-purple-600', icon: <ShoppingBag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />, label: 'Online' },
                  'walk-in': { color: 'bg-amber-500/10 text-amber-600', icon: <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />, label: 'Walk-in' },
                };
                const typeConfig = orderTypeConfig[order.order_type] || orderTypeConfig['walk-in'];
                
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleGenerateBill(order)}
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-700 cursor-pointer transition-all hover:shadow-md"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                      <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base">#{order.order_number}</span>
                        <Badge className={cn('text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0', typeConfig.color)}>
                          {typeConfig.icon}
                          <span className="ml-0.5 hidden xs:inline">{typeConfig.label}</span>
                        </Badge>
                        {order.is_registered_customer && (
                          <Crown className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{order.customer_name}</span>
                        {order.table_number && (
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">
                            T-{order.table_number}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-red-600 text-sm sm:text-base">
                        Rs. {order.total.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground justify-end">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(order.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {(pendingCount || stats?.pending_count || 0) > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs sm:text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => setActiveTab('pending')}
                >
                  +{(pendingCount || stats?.pending_count || 0) - 5} more orders awaiting bill
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 sm:flex">
          <TabsTrigger value="pending" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Pending</span> Bills
            {(pendingCount || stats?.pending_count) ? (
              <Badge className="bg-amber-500 ml-1 text-[10px] sm:text-xs">{pendingCount || stats?.pending_count}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0" forceMount style={{ display: activeTab === 'pending' ? 'block' : 'none' }}>
          <PendingOrdersList 
            onSelectOrder={handleGenerateBill} 
            initialOrders={initialBillableOrders as any[]}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-0" forceMount style={{ display: activeTab === 'invoices' ? 'block' : 'none' }}>
          {showPrintView && generatedInvoice ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Invoice Generated Successfully
                </h3>
                <Button
                  variant="outline"
                  onClick={() => setShowPrintView(false)}
                >
                  View All Invoices
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <InvoicePrintView invoice={generatedInvoice} />
            </motion.div>
          ) : (
            <InvoicesList initialInvoices={initialInvoices} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
