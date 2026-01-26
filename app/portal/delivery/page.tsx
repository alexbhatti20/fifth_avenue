'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Package,
  MapPin,
  Phone,
  Navigation,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Route,
  User,
  Timer,
  RefreshCw,
  Filter,
  Play,
  ArrowRight,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  ExternalLink,
  MessageSquare,
  Copy,
  ChevronDown,
  ChevronUp,
  Bike,
  History,
  Target,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { createClient } from '@/lib/supabase';
import { subscribeToRiderAssignments, subscribeToReadyForDelivery } from '@/lib/realtime';
import {
  playNotificationSound,
  showNotificationWithSound,
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '@/lib/notification-sound';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Order } from '@/types/portal';

const supabase = createClient();

// ==========================================
// TYPES
// ==========================================

interface DeliveryOrder extends Order {
  delivery_rider?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

// ==========================================
// UTILITY COMPONENTS
// ==========================================

// Order Timer with visual indicators
function DeliveryTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
      setElapsed(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const isUrgent = elapsed > 30;
  const isLate = elapsed > 45;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-sm px-2 py-0.5',
        isLate ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' :
        isUrgent ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
        'bg-green-500/10 text-green-500 border-green-500/30'
      )}
    >
      <Timer className="h-3 w-3 mr-1" />
      {elapsed} min
    </Badge>
  );
}

// Live indicator dot
function LiveIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-green-500">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      Live
    </span>
  );
}

// Notification Permission Banner
function NotificationBanner({
  onEnable,
  status,
}: {
  onEnable: () => void;
  status: NotificationPermission | 'unsupported';
}) {
  if (status === 'granted') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-lg mb-6 flex items-center justify-between',
        status === 'denied'
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-blue-500/10 border border-blue-500/20'
      )}
    >
      <div className="flex items-center gap-3">
        {status === 'denied' ? (
          <BellOff className="h-5 w-5 text-red-500" />
        ) : (
          <Bell className="h-5 w-5 text-blue-500 animate-bounce" />
        )}
        <div>
          <p className="font-medium">
            {status === 'denied'
              ? 'Notifications are blocked'
              : 'Enable notifications to get alerted when orders are assigned'}
          </p>
          <p className="text-sm text-muted-foreground">
            {status === 'denied'
              ? 'Please enable notifications in your browser settings'
              : 'Get instant alerts with sound when new orders are assigned to you'}
          </p>
        </div>
      </div>
      {status !== 'denied' && (
        <Button onClick={onEnable} className="gap-2">
          <Bell className="h-4 w-4" />
          Enable Notifications
        </Button>
      )}
    </motion.div>
  );
}

// ==========================================
// ORDER CARDS
// ==========================================

// Compact Order Card for My Deliveries
function MyDeliveryCard({
  order,
  onDeliver,
  onViewDetails,
  isExpanded,
  onToggle,
}: {
  order: DeliveryOrder;
  onDeliver: (orderId: string) => void;
  onViewDetails: (order: DeliveryOrder) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isDelivering = order.status === 'delivering';
  const isReady = order.status === 'ready';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="overflow-hidden"
    >
      <Card className={cn(
        'border-2 transition-all',
        isDelivering
          ? 'border-orange-500/50 bg-orange-500/5'
          : 'border-blue-500/50 bg-blue-500/5'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isDelivering ? 'bg-orange-500/20' : 'bg-blue-500/20'
              )}>
                {isDelivering ? (
                  <Bike className={cn('h-6 w-6 text-orange-500 animate-pulse')} />
                ) : (
                  <Package className="h-6 w-6 text-blue-500" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  #{order.order_number}
                  <Badge variant={isDelivering ? 'default' : 'secondary'} className="ml-2">
                    {isDelivering ? 'On the Way' : 'Ready for Pickup'}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {order.items.length} items • Rs. {order.total.toLocaleString()}
                  <span className="text-muted-foreground">•</span>
                  <DeliveryTimer createdAt={order.created_at} />
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onToggle}>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {/* Customer Quick Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 mb-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
              onClick={() => window.open(`tel:${order.customer_phone}`, '_blank')}
            >
              <Phone className="h-5 w-5" />
            </Button>
          </div>

          {/* Address */}
          <div className="p-3 rounded-lg bg-background/50 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm">{order.customer_address || 'No address provided'}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(order.customer_address || '', 'Address')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-500"
                  onClick={() =>
                    window.open(
                      `https://maps.google.com/?q=${encodeURIComponent(order.customer_address || '')}`,
                      '_blank'
                    )
                  }
                >
                  <Navigation className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* Order Items */}
                <div className="p-3 rounded-lg bg-background/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Order Items
                  </h4>
                  <div className="space-y-2">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">
                          Rs. {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between font-bold">
                      <span>Total</span>
                      <span>Rs. {order.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Payment</span>
                  </div>
                  <Badge
                    variant={order.payment_method === 'cash' ? 'outline' : 'default'}
                    className={cn(
                      order.payment_method === 'cash'
                        ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                        : 'bg-green-500/10 text-green-600 border-green-500/30'
                    )}
                  >
                    {order.payment_method === 'cash'
                      ? `Cash on Delivery - Rs. ${order.total.toLocaleString()}`
                      : 'Paid Online ✓'}
                  </Badge>
                </div>

                {/* Special Instructions */}
                {order.notes && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <h4 className="font-medium mb-1 text-yellow-600 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Special Instructions
                    </h4>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        <CardFooter className="pt-0 gap-2">
          {isReady && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onViewDetails(order)}
              >
                Full Details
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => onDeliver(order.id)}
              >
                <Truck className="h-4 w-4 mr-2" />
                Start Delivery
              </Button>
            </>
          )}
          {isDelivering && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(
                    `https://maps.google.com/?q=${encodeURIComponent(order.customer_address || '')}`,
                    '_blank'
                  )
                }
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => onDeliver(order.id)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Delivered
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Available Order Card (for unassigned orders)
function AvailableOrderCard({
  order,
  onAccept,
  onViewDetails,
}: {
  order: DeliveryOrder;
  onAccept: (orderId: string) => void;
  onViewDetails: (order: DeliveryOrder) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="border-2 border-zinc-200 dark:border-zinc-800 hover:border-primary/50 transition-all hover:shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">#{order.order_number}</CardTitle>
                <CardDescription>
                  {order.items.length} items • Rs. {order.total.toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <DeliveryTimer createdAt={order.created_at} />
          </div>
        </CardHeader>

        <CardContent className="pb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{order.customer_name}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <span className="line-clamp-2">{order.customer_address || 'No address'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {order.payment_method === 'cash' ? 'Cash' : 'Paid'}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="pt-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails(order)}
          >
            Details
          </Button>
          <Button size="sm" className="flex-1" onClick={() => onAccept(order.id)}>
            <Truck className="h-4 w-4 mr-2" />
            Accept Order
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ==========================================
// ORDER DETAILS DIALOG
// ==========================================

function OrderDetailsDialog({
  order,
  open,
  onOpenChange,
  onAction,
}: {
  order: DeliveryOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: 'accept' | 'deliver', orderId: string) => void;
}) {
  if (!order) return null;

  const isReady = order.status === 'ready';
  const isDelivering = order.status === 'delivering';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isDelivering ? 'bg-orange-500/20' : 'bg-blue-500/20'
              )}
            >
              {isDelivering ? (
                <Bike className="h-6 w-6 text-orange-500" />
              ) : (
                <Package className="h-6 w-6 text-blue-500" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">Order #{order.order_number}</DialogTitle>
              <DialogDescription>
                {isDelivering ? 'Currently being delivered' : 'Ready for pickup'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Timer */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
            <span className="font-medium">Time Since Order</span>
            <DeliveryTimer createdAt={order.created_at} />
          </div>

          {/* Customer Details */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.customer_phone}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500"
                    onClick={() => window.open(`tel:${order.customer_phone}`, '_blank')}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </h4>
            <p className="text-sm">{order.customer_address || 'No address provided'}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                window.open(
                  `https://maps.google.com/?q=${encodeURIComponent(order.customer_address || '')}`,
                  '_blank'
                )
              }
            >
              <Navigation className="h-4 w-4 mr-2" />
              Open in Google Maps
            </Button>
          </div>

          {/* Order Items */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items ({order.items.length})
            </h4>
            <div className="space-y-2">
              {order.items.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {item.quantity}x {item.name}
                    </p>
                    {item.special_instructions && (
                      <p className="text-xs text-muted-foreground">{item.special_instructions}</p>
                    )}
                  </div>
                  <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>Rs. {order.subtotal.toLocaleString()}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Delivery Fee</span>
                <span>Rs. {order.delivery_fee.toLocaleString()}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-Rs. {order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>Rs. {order.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Payment Method</span>
              </div>
              <Badge
                variant={order.payment_method === 'cash' ? 'outline' : 'default'}
                className={cn(
                  'text-sm',
                  order.payment_method === 'cash'
                    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                    : 'bg-green-500/10 text-green-600 border-green-500/30'
                )}
              >
                {order.payment_method === 'cash' ? 'Cash on Delivery' : 'Paid Online'}
              </Badge>
            </div>
            {order.payment_method === 'cash' && (
              <p className="text-sm text-yellow-600 mt-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Collect Rs. {order.total.toLocaleString()} from customer
              </p>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <h4 className="font-medium text-yellow-600 flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" />
                Special Instructions
              </h4>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onAction && isReady && (
            <Button onClick={() => onAction('accept', order.id)}>
              <Truck className="h-4 w-4 mr-2" />
              Accept & Start Delivery
            </Button>
          )}
          {onAction && isDelivering && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => onAction('deliver', order.id)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Delivered
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// DELIVERY HISTORY
// ==========================================

interface HistoryDelivery {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: any[];
  total_items: number;
  total: number;
  payment_method?: string;
  delivery_status: string;
  accepted_at: string;
  started_at?: string;
  delivered_at?: string;
  actual_delivery_minutes?: number;
  customer_rating?: number;
}

interface DeliveryStats {
  total_deliveries: number;
  total_today: number;
  total_this_week: number;
  total_this_month: number;
  avg_delivery_minutes?: number;
  avg_rating?: number;
  total_earnings: number;
  cancelled_count: number;
  active_deliveries: number;
}

function DeliveryHistory({ riderId }: { riderId: string }) {
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchHistory = useCallback(async (loadMore = false) => {
    try {
      setIsLoading(true);
      
      // Use the fast RPC - pass rider ID explicitly to avoid auth issues
      const { data, error } = await supabase.rpc('get_rider_delivery_history', {
        p_rider_id: riderId,  // Pass rider ID explicitly
        p_status: 'delivered',
        p_limit: 20,
        p_offset: loadMore ? offset : 0,
      });

      if (error) throw error;

      if (data?.success) {
        const historyData = data.history || [];
        if (loadMore) {
          setDeliveries((prev) => [...prev, ...historyData]);
        } else {
          setDeliveries(historyData);
        }
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(loadMore ? offset + 20 : 20);
      }
    } catch (error) {
      
      // Fallback to direct query if RPC not available
      try {
        const { data, error: fallbackError } = await supabase
          .from('orders')
          .select('*')
          .eq('delivery_rider_id', riderId)
          .eq('status', 'delivered')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!fallbackError && data) {
          const mapped = data.map((d) => ({
            id: d.id,
            order_id: d.id,
            order_number: d.order_number,
            customer_name: d.customer_name,
            customer_phone: d.customer_phone,
            customer_address: d.customer_address,
            items: d.items || [],
            total_items: d.items?.length || 0,
            total: d.total,
            payment_method: d.payment_method,
            delivery_status: 'delivered',
            accepted_at: d.created_at,
            delivered_at: d.updated_at,
          }));
          setDeliveries(mapped);
          
          // Calculate basic stats
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - 7);
          
          setStats({
            total_deliveries: data.length,
            total_today: data.filter((d) => new Date(d.updated_at) >= todayStart).length,
            total_this_week: data.filter((d) => new Date(d.updated_at) >= weekStart).length,
            total_this_month: data.length,
            total_earnings: data.reduce((sum, d) => sum + (d.total || 0), 0),
            cancelled_count: 0,
            active_deliveries: 0,
          });
        }
      } catch (fallbackError) {
        
      }
    } finally {
      setIsLoading(false);
    }
  }, [riderId, offset]);

  useEffect(() => {
    fetchHistory();
  }, [riderId]);

  return (
    <div className="space-y-6">
      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-2xl font-bold text-green-600">{stats?.total_today || 0}</p>
          <p className="text-sm text-muted-foreground">Today</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats?.total_this_week || 0}</p>
          <p className="text-sm text-muted-foreground">This Week</p>
        </div>
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats?.total_deliveries || 0}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {stats?.avg_delivery_minutes ? `${stats.avg_delivery_minutes}m` : '-'}
          </p>
          <p className="text-sm text-muted-foreground">Avg Time</p>
        </div>
      </div>

      {/* Earnings Card */}
      {stats && (
        <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-3xl font-bold text-green-600">
                  Rs. {stats.total_earnings?.toLocaleString() || 0}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {stats.avg_rating && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-500">⭐ {stats.avg_rating}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                )}
                {stats.cancelled_count > 0 && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-500">{stats.cancelled_count}</p>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History List */}
      <DataTableWrapper
        isLoading={isLoading}
        isEmpty={deliveries.length === 0}
        emptyMessage="No deliveries completed yet"
      >
        <div className="space-y-3">
          {deliveries.map((delivery) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">#{delivery.order_number}</p>
                  <p className="text-sm text-muted-foreground">{delivery.customer_name}</p>
                  {delivery.actual_delivery_minutes && (
                    <p className="text-xs text-muted-foreground">
                      <Timer className="h-3 w-3 inline mr-1" />
                      {delivery.actual_delivery_minutes} mins
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">Rs. {delivery.total?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {delivery.delivered_at
                    ? new Date(delivery.delivered_at).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </p>
                {delivery.customer_rating && (
                  <p className="text-xs text-amber-500">⭐ {delivery.customer_rating}</p>
                )}
              </div>
            </motion.div>
          ))}
          
          {/* Load More */}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fetchHistory(true)}
              disabled={isLoading}
            >
              Load More
            </Button>
          )}
        </div>
      </DataTableWrapper>
    </div>
  );
}

// ==========================================
// MAIN DELIVERY PAGE
// ==========================================

export default function DeliveryPage() {
  const { employee, role } = usePortalAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const audioInitializedRef = useRef(false);
  const knownOrdersRef = useRef<Set<string>>(new Set());

  const isRider = role === 'delivery_rider';
  const riderId = employee?.id;

  // Check notification permission on mount
  useEffect(() => {
    setNotificationStatus(getNotificationPermissionStatus());
  }, []);

  // Initialize audio on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitializedRef.current) {
        audioInitializedRef.current = true;
        // Silent playback to unlock audio context
        playNotificationSound('assignment');
        document.removeEventListener('click', initAudio);
      }
    };
    document.addEventListener('click', initAudio);
    return () => document.removeEventListener('click', initAudio);
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!riderId) return;

    setIsLoading(true);
    try {
      // Fetch orders assigned to this rider OR ready for pickup (online/delivery orders)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_type', 'online')
        .in('status', ['ready', 'delivering'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Store known orders
      (data || []).forEach((o) => knownOrdersRef.current.add(o.id));
      setOrders(data || []);
      setLastUpdate(new Date());
    } catch (error) {
      
      toast.error('Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [riderId]);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time subscriptions
  useEffect(() => {
    if (!riderId || !isRider) return;

    // Subscribe to orders assigned to this rider
    const unsubscribeRider = subscribeToRiderAssignments(
      riderId,
      // New assignment
      async (newOrder) => {
        // Check if this is actually a new order we haven't seen
        if (!knownOrdersRef.current.has(newOrder.id)) {
          knownOrdersRef.current.add(newOrder.id);
          
          // Show notification with sound
          await showNotificationWithSound(
            '🚴 New Delivery Assigned!',
            `Order #${newOrder.order_number} - ${newOrder.customer_name}\n${newOrder.customer_address}`,
            {
              soundType: 'assignment',
              requireInteraction: true,
              tag: `order-${newOrder.id}`,
            }
          );

          // Update orders list
          setOrders((prev) => {
            const exists = prev.find((o) => o.id === newOrder.id);
            if (exists) {
              return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
            }
            return [newOrder, ...prev];
          });

          // Show toast
          toast.success(`New order assigned: #${newOrder.order_number}`, {
            description: `${newOrder.customer_name} - ${newOrder.items?.length || 0} items`,
            duration: 10000,
          });
        }

        setLastUpdate(new Date());
      },
      // Order update
      (updatedOrder) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
        );
        setLastUpdate(new Date());
      }
    );

    // Also subscribe to ready orders
    const unsubscribeReady = subscribeToReadyForDelivery(
      (readyOrder) => {
        if (!knownOrdersRef.current.has(readyOrder.id)) {
          knownOrdersRef.current.add(readyOrder.id);
          setOrders((prev) => [readyOrder, ...prev]);
          
          // Play subtle sound for available orders
          playNotificationSound('new_order');
        }
        setLastUpdate(new Date());
      },
      (updatedOrder) => {
        setOrders((prev) => {
          // Remove if delivered or cancelled
          if (['delivered', 'cancelled'].includes(updatedOrder.status)) {
            return prev.filter((o) => o.id !== updatedOrder.id);
          }
          return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
        });
        setLastUpdate(new Date());
      }
    );

    return () => {
      unsubscribeRider();
      unsubscribeReady();
    };
  }, [riderId, isRider]);

  // Enable notifications
  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
    if (granted) {
      toast.success('Notifications enabled!');
      // Play test sound
      playNotificationSound('assignment');
    }
  };

  // Accept/Start delivery using fast RPC
  const handleAcceptOrder = async (orderId: string) => {
    try {
      // Use the fast RPC that handles everything atomically
      // Pass rider ID explicitly to avoid auth issues
      const { data, error } = await supabase.rpc('accept_delivery_order', {
        p_order_id: orderId,
        p_rider_id: riderId,
      });

      if (error) throw error;

      // Check RPC response
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to accept order');
      }

      toast.success(
        `Order #${data.order_number} accepted! Navigate to ${data.order?.customer_address || 'customer'}.`,
        {
          duration: 5000,
          action: {
            label: 'Navigate',
            onClick: () => {
              const address = data.order?.customer_address;
              if (address) {
                window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
              }
            },
          },
        }
      );

      fetchOrders();
    } catch (error: any) {
      
      toast.error(error.message || 'Failed to accept order');
    }
  };

  // Complete delivery using fast RPC
  const handleDeliverOrder = async (orderId: string, notes?: string) => {
    try {
      // Use the fast RPC - pass rider ID explicitly to avoid auth issues
      const { data, error } = await supabase.rpc('complete_delivery_order', {
        p_order_id: orderId,
        p_notes: notes || null,
        p_rider_id: riderId,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to complete delivery');
      }

      const deliveryTime = data.delivery_minutes
        ? ` (${data.delivery_minutes} mins)`
        : '';

      toast.success(`Order #${data.order_number} delivered successfully!${deliveryTime} 🎉`, {
        duration: 4000,
      });

      fetchOrders();
    } catch (error: any) {
      
      toast.error(error.message || 'Failed to complete delivery');
    }
  };

  // Cancel delivery
  const handleCancelDelivery = async (orderId: string, reason: string) => {
    try {
      // Pass rider ID explicitly to avoid auth issues
      const { data, error } = await supabase.rpc('cancel_delivery_order', {
        p_order_id: orderId,
        p_reason: reason,
        p_rider_id: riderId,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to cancel delivery');
      }

      toast.info(data.message || 'Delivery cancelled. Order is back in queue.');
      fetchOrders();
    } catch (error: any) {
      
      toast.error(error.message || 'Failed to cancel delivery');
    }
  };

  // Dialog action handler
  const handleDialogAction = (action: 'accept' | 'deliver', orderId: string) => {
    if (action === 'accept') {
      handleAcceptOrder(orderId);
    } else {
      handleDeliverOrder(orderId);
    }
    setIsDetailsOpen(false);
  };

  // Filter orders
  const myAssignedOrders = orders.filter(
    (o) => o.delivery_rider_id === riderId && ['ready', 'delivering'].includes(o.status)
  );
  const availableOrders = orders.filter(
    (o) => !o.delivery_rider_id && o.status === 'ready'
  );
  const allDeliveries = orders.filter((o) => o.status === 'delivering');

  const stats = {
    myActive: myAssignedOrders.length,
    available: availableOrders.length,
    inProgress: allDeliveries.length,
  };

  return (
    <>
      <SectionHeader
        title={
          <div className="flex items-center gap-3">
            <span>{isRider ? 'My Deliveries' : 'Delivery Management'}</span>
            <LiveIndicator />
          </div>
        }
        description={
          <span>
            {isRider
              ? 'View your assigned orders and make deliveries'
              : 'Manage all delivery orders in real-time'}
            <span className="ml-2 text-muted-foreground">
              • Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </span>
        }
        action={
          <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Notification Permission Banner */}
      {isRider && (
        <NotificationBanner status={notificationStatus} onEnable={handleEnableNotifications} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {isRider ? (
          <>
            <StatsCard
              title="My Active Orders"
              value={stats.myActive}
              icon={<Target className="h-5 w-5 text-blue-500" />}
            />
            <StatsCard
              title="Available to Pick"
              value={stats.available}
              icon={<Package className="h-5 w-5 text-orange-500" />}
            />
            <StatsCard
              title="Total In Progress"
              value={stats.inProgress}
              icon={<Truck className="h-5 w-5 text-green-500" />}
            />
          </>
        ) : (
          <>
            <StatsCard
              title="Ready for Pickup"
              value={stats.available}
              icon={<Package className="h-5 w-5 text-blue-500" />}
            />
            <StatsCard
              title="In Transit"
              value={stats.inProgress}
              icon={<Truck className="h-5 w-5 text-orange-500" />}
            />
            <StatsCard
              title="Active Riders"
              value={new Set(allDeliveries.map((o) => o.delivery_rider_id).filter(Boolean)).size}
              icon={<Bike className="h-5 w-5 text-green-500" />}
            />
          </>
        )}
      </div>

      <Tabs defaultValue={isRider ? 'my-orders' : 'all'} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          {isRider && (
            <TabsTrigger value="my-orders" className="gap-2">
              <Target className="h-4 w-4" />
              My Orders
              {stats.myActive > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {stats.myActive}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="all" className="gap-2">
            <Package className="h-4 w-4" />
            Available
            {stats.available > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {stats.available}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* My Orders Tab (for riders) */}
        {isRider && (
          <TabsContent value="my-orders">
            <DataTableWrapper
              isLoading={isLoading}
              isEmpty={myAssignedOrders.length === 0}
              emptyMessage={
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No active deliveries</h3>
                  <p className="text-muted-foreground mb-4">
                    Accept an order from the Available tab to start delivering
                  </p>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {myAssignedOrders.map((order) => (
                    <MyDeliveryCard
                      key={order.id}
                      order={order}
                      onDeliver={
                        order.status === 'delivering' ? handleDeliverOrder : handleAcceptOrder
                      }
                      onViewDetails={(o) => {
                        setSelectedOrder(o);
                        setIsDetailsOpen(true);
                      }}
                      isExpanded={expandedOrderId === order.id}
                      onToggle={() =>
                        setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            </DataTableWrapper>
          </TabsContent>
        )}

        {/* Available Orders Tab */}
        <TabsContent value="all">
          <DataTableWrapper
            isLoading={isLoading}
            isEmpty={availableOrders.length === 0}
            emptyMessage={
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  No orders are waiting for delivery at the moment
                </p>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {availableOrders.map((order) => (
                  <AvailableOrderCard
                    key={order.id}
                    order={order}
                    onAccept={handleAcceptOrder}
                    onViewDetails={(o) => {
                      setSelectedOrder(o);
                      setIsDetailsOpen(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </DataTableWrapper>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {riderId && <DeliveryHistory riderId={riderId} />}
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        order={selectedOrder}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onAction={handleDialogAction}
      />
    </>
  );
}
