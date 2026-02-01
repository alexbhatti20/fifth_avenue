'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  MoreVertical,
  Truck,
  Utensils,
  Package,
  DollarSign,
  Calendar,
  RefreshCw,
  MessageSquare,
  User,
  Phone,
  Mail,
  MapPin,
  Timer,
  TrendingUp,
  Flame,
  Building,
  UserCircle,
  Bike,
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { PortalOrder, OrdersStats as ServerOrdersStats } from '@/lib/server-queries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionHeader, DataTableWrapper } from '@/components/portal/PortalProvider';
import { updateOrderStatusQuickServer } from '@/lib/actions';
import { supabase } from '@/lib/supabase';
import { getAvailableDeliveryRiders, assignDeliveryRider, type DeliveryRider } from '@/lib/portal-queries';
// FIX #18: Import shared timer for performance
import { useSharedTimer } from '@/lib/shared-timer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { OrderStatus } from '@/types/portal';

// Props interface for SSR data
interface OrdersClientProps {
  orders: PortalOrder[];
  stats: ServerOrdersStats | null;
  totalCount: number;
  hasMore: boolean;
}

// FIX #19: CSS animations moved to globals.css to eliminate dynamic injection
// Previously injected gradientShift animation is now in app/globals.css

const STATUS_CONFIG: Record<OrderStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Pending', icon: <Clock className="h-4 w-4" /> },
  confirmed: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'In Kitchen', icon: <CheckCircle className="h-4 w-4" /> },
  preparing: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Preparing', icon: <Utensils className="h-4 w-4" /> },
  ready: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Ready', icon: <Package className="h-4 w-4" /> },
  delivering: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Out for Delivery', icon: <Truck className="h-4 w-4" /> },
  delivered: { color: 'text-green-600', bgColor: 'bg-green-600/10', label: 'Completed', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Cancelled', icon: <XCircle className="h-4 w-4" /> },
};

// Get status label based on order type (for context-aware display)
const getStatusLabel = (status: OrderStatus, orderType: string): string => {
  // Online orders have different labels for some statuses
  if (orderType === 'online') {
    if (status === 'confirmed') return 'Send to Kitchen';
    if (status === 'delivered') return 'Delivered';
    if (status === 'delivering') return 'Out for Delivery';
  }
  // Dine-in and walk-in orders
  if (status === 'confirmed') return 'In Kitchen';
  if (status === 'delivered') return 'Completed';  // Final status for dine-in/walk-in
  if (status === 'delivering') return 'Serving';   // Shouldn't happen for dine-in but just in case
  
  return STATUS_CONFIG[status].label;
};

// Get status badge display (for cards and lists)
const getStatusDisplay = (status: OrderStatus, orderType: string) => {
  const config = STATUS_CONFIG[status];
  const label = getStatusLabel(status, orderType);
  return { ...config, label };
};

const ORDER_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  'dine-in': { color: 'bg-blue-500/10 text-blue-500', icon: <Utensils className="h-3 w-3" />, label: 'Dine In' },
  'dine_in': { color: 'bg-blue-500/10 text-blue-500', icon: <Utensils className="h-3 w-3" />, label: 'Dine In' },
  'online': { color: 'bg-purple-500/10 text-purple-500', icon: <ShoppingBag className="h-3 w-3" />, label: 'Online' },
  'walk-in': { color: 'bg-amber-500/10 text-amber-500', icon: <User className="h-3 w-3" />, label: 'Walk-in' },
};

// =============================================
// Animated Stats Card Component - Mobile Optimized
// =============================================
function AnimatedStatsCard({
  title,
  value,
  icon,
  delay = 0,
  subValue,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  delay?: number;
  subValue?: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        padding: '2px',
        background: 'linear-gradient(90deg, #ff6b35, #f72585)',
      }}
    >
      <div className="relative rounded-[10px] bg-white dark:bg-zinc-950 p-2.5 sm:p-4 h-full">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            <p
              className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate"
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subValue && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" />}
                {trend === 'down' && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500 rotate-180" />}
                {subValue}
              </p>
            )}
          </div>
          <div
            className="p-1.5 sm:p-2 rounded-lg flex-shrink-0 ml-1"
            style={{
              background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(247,37,133,0.15))',
            }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Live Timer Component - Shows elapsed time in hours and minutes
// FIX #18: Using shared timer to reduce setInterval instances
// =============================================
function LiveTimer({ createdAt }: { createdAt: string }) {
  // Use shared timer instead of individual setInterval per component
  const elapsed = useSharedTimer(createdAt);

  const totalMins = Math.floor(elapsed / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const secs = elapsed % 60;
  
  // Warning thresholds
  const isWarning = totalMins >= 15 && totalMins < 30;
  const isCritical = totalMins >= 30;

  // Format display
  const formatTime = () => {
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (totalMins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <span className={cn(
      'font-mono text-xs flex items-center gap-1',
      isCritical ? 'text-red-500 font-semibold' : 
      isWarning ? 'text-orange-500' : 
      'text-muted-foreground'
    )}>
      <Timer className={cn(
        "h-3 w-3",
        isCritical && "animate-pulse"
      )} />
      {formatTime()}
      {isCritical && <span className="text-[10px]">⚠️</span>}
    </span>
  );
}

// Order Details Dialog
function OrderDetailsDialog({
  order,
  open,
  onOpenChange,
  onStatusChange,
  onRiderAssigned,
  onGenerateBill,
}: {
  order: PortalOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onRiderAssigned?: () => void;
  onGenerateBill: (orderId: string) => void;
}) {
  const router = useRouter();
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigningRider, setAssigningRider] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [showItems, setShowItems] = useState(true);
  
  // Load delivery riders when order is ready and online
  useEffect(() => {
    if (open && order && order.status === 'ready' && order.order_type === 'online' && !order.delivery_rider) {
      loadRiders();
    }
  }, [open, order]);

  const loadRiders = async () => {
    setLoadingRiders(true);
    try {
      const data = await getAvailableDeliveryRiders();
      setRiders(data);
    } catch (error) {
      
    } finally {
      setLoadingRiders(false);
    }
  };

  const handleAssignRider = async () => {
    if (!order || !selectedRiderId) return;
    
    setAssigningRider(true);
    try {
      const result = await assignDeliveryRider(order.id, selectedRiderId);
      if (result.success) {
        // Get rider name from local state
        const assignedRider = riders.find(r => r.id === selectedRiderId);
        toast.success(`Delivery rider ${assignedRider?.name || ''} assigned successfully`);
        onRiderAssigned?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to assign rider');
      }
    } catch (error) {
      toast.error('Failed to assign rider');
    } finally {
      setAssigningRider(false);
    }
  };

  if (!order) return null;

  const statusConfig = getStatusDisplay(order.status, order.order_type);
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['online'];
  
  // Show assign rider option when: order is ready, order type is online, no rider assigned yet
  const canAssignRider = order.status === 'ready' && order.order_type === 'online' && !order.delivery_rider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Order #{order.order_number}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <LiveTimer createdAt={order.created_at} />
                <span>•</span>
                {new Date(order.created_at).toLocaleString()}
              </DialogDescription>
            </div>
            <Badge className={cn('gap-1 text-sm px-3 py-1', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Info & Order Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Card */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white">
                    {order.customer_name?.charAt(0) || 'G'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{order.customer_name}</p>
                  {order.customer?.email && (
                    <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2 text-sm">
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{order.customer_phone}</span>
                  </div>
                )}
                {order.customer_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{order.customer_email}</span>
                  </div>
                )}
                {order.customer_address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span>{order.customer_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Type & Table Info */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={cn('px-3 py-1', typeConfig?.color)}>
                  {typeConfig?.icon}
                  <span className="ml-1">{typeConfig?.label}</span>
                </Badge>
                {order.payment_method && (
                  <Badge variant="outline">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {order.payment_method}
                  </Badge>
                )}
              </div>

              {/* Table Details */}
              {(order.table_number || order.table_details) && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Building className="h-4 w-4" />
                    <span className="font-medium">Table {order.table_number}</span>
                  </div>
                  {order.table_details && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                      <p>Capacity: {order.table_details?.capacity} seats</p>
                      {order.table_details?.section && (
                        <p>Section: {order.table_details?.section}</p>
                      )}
                      {order.table_details?.floor && (
                        <p>Floor: {order.table_details?.floor}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Waiter Info */}
              {order.waiter && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Served by: <span className="font-medium">{order.waiter?.name}</span></span>
                </div>
              )}

              {/* Delivery Rider */}
              {order.delivery_rider && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Truck className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Rider: <span className="font-medium">{order.delivery_rider?.name}</span></span>
                </div>
              )}

              {/* Transaction ID for online payments */}
              {(order.payment_method === 'online' || order.transaction_id || (order as any).online_payment_details) && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Receipt className="h-4 w-4" />
                    <span className="font-medium text-sm">Online Payment Details</span>
                  </div>
                  {order.transaction_id ? (
                    <p className="text-xs font-mono bg-purple-500/10 px-2 py-1 rounded">
                      TXN: {order.transaction_id}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No transaction ID recorded
                    </p>
                  )}
                  {(order as any).online_payment_details?.method_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      via {(order as any).online_payment_details.method_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
            <button
              type="button"
              onClick={() => setShowItems(!showItems)}
              className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Order Items ({order.total_items || order.items.length})</span>
              {showItems ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <AnimatePresence>
            {showItems && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
            <div className="space-y-2 mt-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded">
                      {item.quantity}x
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              
              <Separator className="my-3" />
              
              {/* Price Breakdown */}
              <div className="space-y-1 text-sm">
                {order.subtotal && order.subtotal !== order.total && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>Rs. {order.subtotal.toLocaleString()}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-Rs. {order.discount.toLocaleString()}</span>
                  </div>
                )}
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Fee</span>
                    <span>Rs. {order.delivery_fee.toLocaleString()}</span>
                  </div>
                )}
                {order.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span>Rs. {order.tax.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-300 dark:border-zinc-600">
                <span>Total</span>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Rs. {order.total.toLocaleString()}
                </span>
              </div>
            </div>
            </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Special Instructions */}
          {order.notes && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <MessageSquare className="h-4 w-4" />
                <p className="text-sm font-medium">Special Instructions</p>
              </div>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {/* Delayed Warning */}
          {order.is_delayed && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-600">Order Delayed</p>
                <p className="text-sm text-muted-foreground">This order has been waiting longer than expected</p>
              </div>
            </div>
          )}

          {/* Assign Delivery Rider (only for ready online orders) */}
          {canAssignRider && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <Bike className="h-5 w-5" />
                <p className="font-medium">Assign Delivery Rider</p>
              </div>
              
              {loadingRiders ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading available riders...</span>
                </div>
              ) : riders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery riders available</p>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedRiderId} onValueChange={setSelectedRiderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a delivery rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders.map((rider) => (
                        <SelectItem key={rider.id} value={rider.id}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <span className="font-medium">{rider.name}</span>
                              {(rider.active_deliveries !== undefined || rider.deliveries_today !== undefined) && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({rider.active_deliveries ?? 0} active • {rider.deliveries_today ?? 0} today)
                                </span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleAssignRider} 
                    disabled={!selectedRiderId || assigningRider}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {assigningRider ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4 mr-2" />
                        Assign & Start Delivery
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Current Delivery Rider Info (if assigned) */}
          {order.delivery_rider && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500/20">
                    <Bike className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.delivery_rider.name}</p>
                    <p className="text-sm text-muted-foreground">Delivery Rider</p>
                  </div>
                </div>
                {order.delivery_rider.phone && (
                  <a href={`tel:${order.delivery_rider.phone}`}>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Update Status */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Update Status</p>
            <Select
              value={order.status}
              onValueChange={(value) => onStatusChange(order.id, value as OrderStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {getStatusLabel(status as OrderStatus, order.order_type)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {order.status !== 'cancelled' && order.payment_status !== 'paid' && (
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                onGenerateBill(order.id);
                onOpenChange(false);
              }}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Generate Bill
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// Enhanced Order Card with Animated Border & Quick Status
// =============================================
function OrderCard({
  order,
  onViewDetails,
  onStatusChange,
  onGenerateBill,
}: {
  order: PortalOrder;
  onViewDetails: (order: PortalOrder) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onGenerateBill: (orderId: string) => void;
}) {
  const statusConfig = getStatusDisplay(order.status, order.order_type);
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['online'];

  // Get next logical status based on current status and order type
  const getNextStatus = (): OrderStatus | null => {
    const flow: Record<string, OrderStatus> = {
      'pending': 'preparing',
      'confirmed': 'preparing',
      'preparing': 'ready',
      'ready': order.order_type === 'online' ? 'delivering' : 'delivered',
      'delivering': 'delivered',
    };
    return flow[order.status] || null;
  };

  const nextStatus = getNextStatus();
  const nextStatusConfig = nextStatus ? getStatusDisplay(nextStatus, order.order_type) : null;

  // Quick status button labels
  const getQuickActionLabel = () => {
    if (order.status === 'pending') return 'Send to Kitchen';
    if (order.status === 'confirmed') return 'Send to Kitchen';
    if (order.status === 'preparing') return 'Mark Ready';
    if (order.status === 'ready') return order.order_type === 'online' ? 'Out for Delivery' : 'Complete';
    if (order.status === 'delivering') return 'Delivered';
    return null;
  };

  const quickActionLabel = getQuickActionLabel();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative rounded-xl"
      style={{
        padding: '2px',
        backgroundImage: order.is_delayed 
          ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444, #f97316)'
          : 'linear-gradient(90deg, #ff6b35, #f72585, #ff6b35, #f72585)',
        animation: 'gradientShift 4s ease infinite',
      }}
    >
      <Card className="rounded-[10px] hover:shadow-lg transition-all bg-white dark:bg-zinc-950 h-full">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => onViewDetails(order)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base min-w-[52px]">#{order.order_number}</span>
              {order.is_delayed && <Flame className="h-4 w-4 text-red-500 animate-pulse" />}
            </div>
            <Badge className={cn('gap-1 text-xs', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground truncate max-w-[120px]">{order.customer_name}</span>
            <LiveTimer createdAt={order.created_at} />
          </div>
        </CardHeader>
        <CardContent className="pb-3 space-y-2">
          <div className="flex items-center justify-between text-sm cursor-pointer" onClick={() => onViewDetails(order)}>
            <Badge variant="outline" className={cn('text-xs', typeConfig?.color)}>
              {typeConfig?.icon}
              <span className="ml-1">{typeConfig?.label}</span>
            </Badge>
            <span
              className="font-bold"
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Rs. {order.total.toLocaleString()}
            </span>
          </div>
          
          {/* Table/Address Info */}
          {order.table_number && (
            <div className="flex items-center gap-1 text-xs text-blue-500 cursor-pointer" onClick={() => onViewDetails(order)}>
              <Building className="h-3 w-3" />
              <span>Table {order.table_number}</span>
            </div>
          )}
          {order.customer_address && order.order_type === 'online' && (
            <div className="flex items-center gap-1 text-xs text-green-500 truncate cursor-pointer" onClick={() => onViewDetails(order)}>
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{order.customer_address}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span>{order.total_items || order.items.length} items</span>
            <span>{new Date(order.created_at).toLocaleTimeString()}</span>
          </div>

          {/* View Details Button */}
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(order);
            }}
          >
            <Eye className="h-3 w-3" />
            View Details
          </Button>

          {/* Quick Status Selector - Always visible */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <Select
              value={order.status}
              onValueChange={(value) => onStatusChange(order.id, value as OrderStatus)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span className={statusConfig.color}>{statusConfig.icon}</span>
                    {statusConfig.label}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {getStatusLabel(status as OrderStatus, order.order_type)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Status Action Button - Only show for pending and preparing orders */}
          {nextStatus && quickActionLabel && ['pending', 'preparing', 'ready'].includes(order.status) && (
            <Button
              size="sm"
              className={cn(
                'w-full gap-2 font-medium',
                nextStatus === 'preparing' && 'bg-orange-500 hover:bg-orange-600',
                nextStatus === 'ready' && 'bg-green-500 hover:bg-green-600',
                nextStatus === 'delivering' && 'bg-purple-500 hover:bg-purple-600',
                nextStatus === 'delivered' && 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, nextStatus);
              }}
            >
              {nextStatusConfig?.icon}
              {quickActionLabel}
            </Button>
          )}
          
          {/* Generate Bill Button - Show for ready/delivered orders */}
          {['ready', 'delivered'].includes(order.status) && order.payment_status !== 'paid' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 font-medium border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateBill(order.id);
              }}
            >
              <Receipt className="h-4 w-4" />
              Generate Bill
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =============================================
// Main Orders Page Client Component
// =============================================
export default function OrdersClient({
  orders: serverOrders,
  stats: serverStats,
  totalCount: serverTotalCount,
  hasMore: serverHasMore,
}: OrdersClientProps) {
  const router = useRouter();
  
  // Use server data directly - no client-side fetching
  const orders = serverOrders;
  const stats = serverStats;
  const totalCount = serverTotalCount;
  const hasMore = serverHasMore;
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<PortalOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Debounce timer ref for realtime updates
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh data from server
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  // Filter orders locally for instant UI response
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = 
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_phone?.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' 
        || (statusFilter === 'active' && !['delivered', 'cancelled'].includes(order.status))
        || order.status === statusFilter;
      const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [orders, searchQuery, statusFilter, typeFilter]);

  // Handle status change with server action
  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      // Call server action (revalidatePath will auto-refresh)
      const result = await updateOrderStatusQuickServer(orderId, status);
      
      if (result.success) {
        toast.success(`Order status updated to ${STATUS_CONFIG[status].label}`);
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  // Real-time subscription for changes from OTHER users/sources only
  useEffect(() => {
    let lastUpdateTime = Date.now();
    
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Only refresh if enough time has passed (avoid duplicate refresh from our own action)
          const now = Date.now();
          if (now - lastUpdateTime > 3000) { // 3 second cooldown
            if (refreshTimerRef.current) {
              clearTimeout(refreshTimerRef.current);
            }
            refreshTimerRef.current = setTimeout(() => {
              router.refresh();
              lastUpdateTime = Date.now();
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      channel.unsubscribe();
    };
  }, [router]);

  // Handle generate bill - redirect to billing page with order details
  const handleGenerateBill = (orderId: string) => {
    // Instant redirect to billing page
    router.push(`/portal/billing/${orderId}`);
  };

  // Calculate local stats if server stats not available
  const displayStats = stats || {
    total_today: orders.length,
    pending_count: orders.filter((o) => o.status === 'pending').length,
    preparing_count: orders.filter((o) => o.status === 'preparing').length,
    ready_count: orders.filter((o) => o.status === 'ready').length,
    completed_today: orders.filter((o) => ['delivered', 'ready'].includes(o.status)).length,
    revenue_today: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    delayed_orders: orders.filter((o) => o.is_delayed).length,
  };

  return (
    <>
      <SectionHeader
        title="Orders Management"
        description={`${totalCount} total orders • Real-time updates enabled`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {stats?.delayed_orders > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.delayed_orders} Delayed
              </Badge>
            )}
            <Button 
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              onClick={() => router.push('/portal/orders/create')}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Create Order</span>
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} size="icon" className="sm:w-auto sm:px-4">
              <RefreshCw className={cn('h-4 w-4 sm:mr-2', isRefreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-6 mb-4 sm:mb-6">
        <AnimatedStatsCard
          title="Today's Orders"
          value={displayStats.total_today}
          icon={<ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />}
          delay={0}
        />
        <AnimatedStatsCard
          title="Pending"
          value={displayStats.pending_count}
          icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />}
          delay={0.1}
        />
        <AnimatedStatsCard
          title="Preparing"
          value={displayStats.preparing_count}
          icon={<Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />}
          delay={0.2}
        />
        <AnimatedStatsCard
          title="Ready"
          value={displayStats.ready_count}
          icon={<Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />}
          delay={0.3}
        />
        <AnimatedStatsCard
          title="Revenue Today"
          value={`Rs. ${(displayStats.revenue_today || 0).toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />}
          delay={0.4}
        />
        <AnimatedStatsCard
          title="Completed"
          value={displayStats.completed_today}
          icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />}
          delay={0.5}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Orders</SelectItem>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                <span className="flex items-center gap-2">
                  <span className={config.color}>{config.icon}</span>
                  {config.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="dine-in">Dine In</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="walk-in">Walk-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Grid */}
      <DataTableWrapper 
        isLoading={isRefreshing} 
        isEmpty={filteredOrders.length === 0} 
        emptyMessage="No orders found matching your filters"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onViewDetails={(o) => { setSelectedOrder(o); setIsDetailsOpen(true); }}
                onStatusChange={handleStatusChange}
                onGenerateBill={handleGenerateBill}
              />
            ))}
          </AnimatePresence>
        </div>
        
        {/* Load More - Removed for SSR simplicity */}
      </DataTableWrapper>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        order={selectedOrder}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onStatusChange={handleStatusChange}
        onRiderAssigned={() => router.refresh()}
        onGenerateBill={handleGenerateBill}
      />
    </>
  );
}
