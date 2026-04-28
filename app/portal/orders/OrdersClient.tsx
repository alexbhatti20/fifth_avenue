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
  ChevronRight,
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
import { updateOrderStatusQuickServer, sendOrderToBillingAction } from '@/lib/actions';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
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
  currentEmployeeId?: string | null;
  currentRole?: string | null;
}

// FIX #19: CSS animations moved to globals.css to eliminate dynamic injection
// Previously injected gradientShift animation is now in app/globals.css

const STATUS_CONFIG: Record<OrderStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'text-black', bgColor: 'bg-[#FFD200]', label: 'PENDING', icon: <Clock className="h-4 w-4" /> },
  confirmed: { color: 'text-white', bgColor: 'bg-black', label: 'IN KITCHEN', icon: <CheckCircle className="h-4 w-4" /> },
  preparing: { color: 'text-white', bgColor: 'bg-[#ED1C24]', label: 'PREPARING', icon: <Utensils className="h-4 w-4" /> },
  ready: { color: 'text-black', bgColor: 'bg-[#FFD200]', label: 'READY', icon: <Package className="h-4 w-4" /> },
  delivering: { color: 'text-white', bgColor: 'bg-black', label: 'OUT FOR DELIVERY', icon: <Truck className="h-4 w-4" /> },
  delivered: { color: 'text-white', bgColor: 'bg-[#008A45]', label: 'COMPLETED', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { color: 'text-white', bgColor: 'bg-[#ED1C24]', label: 'CANCELLED', icon: <XCircle className="h-4 w-4" /> },
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
  'dine-in': { color: 'bg-black text-[#FFD200] border-black', icon: <Utensils className="h-3 w-3" />, label: 'DINE IN' },
  'dine_in': { color: 'bg-black text-[#FFD200] border-black', icon: <Utensils className="h-3 w-3" />, label: 'DINE IN' },
  'online': { color: 'bg-[#ED1C24] text-white border-black', icon: <ShoppingBag className="h-3 w-3" />, label: 'ONLINE' },
  'walk-in': { color: 'bg-[#FFD200] text-black border-black', icon: <User className="h-3 w-3" />, label: 'WALK-IN' },
};

// =============================================
// Animated Stats Card Component - Mobile Optimized
// =============================================
function AnimatedStatsCard({
  title,
  value,
  icon,
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
    <div className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bebas tracking-widest text-black/40 uppercase truncate">{title}</p>
          <p className="text-3xl font-bebas text-black leading-none mt-1 truncate">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-[10px] font-source-sans font-black text-black/60 mt-2 flex items-center gap-1 uppercase tracking-tighter">
              {trend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-[#008A45]" />}
              {trend === 'down' && <TrendingUp className="h-2.5 w-2.5 text-[#ED1C24] rotate-180" />}
              {subValue}
            </p>
          )}
        </div>
        <div className="p-3 bg-black text-[#FFD200] shadow-[2px_2px_0px_0px_rgba(237,28,36,1)] flex-shrink-0 ml-2">
          {icon}
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
      'font-bebas text-lg flex items-center gap-1.5 px-2 py-1 border-2 border-black',
      isCritical ? 'bg-[#ED1C24] text-white animate-pulse' : 
      isWarning ? 'bg-[#FFD200] text-black' : 
      'bg-black text-[#FFD200]'
    )}>
      <Timer className="h-4 w-4" />
      {formatTime()}
    </span>
  );
}

// Order Details Dialog - Mobile Optimized Premium Design
function OrderDetailsDialog({
  order,
  open,
  onOpenChange,
  onStatusChange,
  onRiderAssigned,
  onGenerateBill,
  onSendToBilling,
  isWaiter,
  billingStatus,
}: {
  order: PortalOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onRiderAssigned?: () => void;
  onGenerateBill: (orderId: string) => void;
  onSendToBilling?: (orderId: string) => void;
  isWaiter?: boolean;
  billingStatus?: 'pending' | 'already_exists';
}) {
  const router = useRouter();
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigningRider, setAssigningRider] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [showItems, setShowItems] = useState(true);
  const [showCustomerInfo, setShowCustomerInfo] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
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

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      await onStatusChange(order.id, status);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!order) return null;

  const statusConfig = getStatusDisplay(order.status, order.order_type);
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['online'];
  
  // Show assign rider option when: order is ready, order type is online, no rider assigned yet
  const canAssignRider = order.status === 'ready' && order.order_type === 'online' && !order.delivery_rider;

  const CollapsibleSection = ({ 
    title, 
    icon: Icon, 
    defaultOpen = true, 
    children,
    badge,
    className = ''
  }: { 
    title: string; 
    icon: React.ElementType; 
    defaultOpen?: boolean; 
    children: React.ReactNode;
    badge?: React.ReactNode;
    className?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className={cn("border-2 border-black bg-white overflow-hidden", className)}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-black/5 active:bg-black/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 border-2 border-black bg-black text-[#FFD200]">
              <Icon className="h-4 w-4" />
            </div>
            <span className="font-bebas text-lg tracking-widest uppercase">{title}</span>
            {badge}
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-black" />
          </motion.div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-0">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-none border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white">
        {/* Fixed Header - Urban Design */}
        <div className="sticky top-0 z-10 bg-black text-white border-b-4 border-black px-4 py-4 sm:p-6">
          
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-3xl sm:text-5xl font-bebas text-[#FFD200] leading-none uppercase tracking-widest">
                  ORDER #{order.order_number}
                  <Badge className={cn('ml-4 text-lg px-3 py-0 border-2 border-white rounded-none font-bebas tracking-widest', typeConfig?.color)}>
                    {typeConfig?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-2 flex-wrap text-xs sm:text-sm font-source-sans font-black uppercase tracking-widest text-black/40">
                  <LiveTimer createdAt={order.created_at} />
                  <span>•</span>
                  <span>
                    {new Date(order.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </DialogDescription>
              </div>
              
              {/* Status Badge - Larger on Mobile */}
              <Badge className={cn(
                'gap-2 text-sm sm:text-lg px-3 sm:px-4 py-1 shrink-0 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
                statusConfig.bgColor, 
                statusConfig.color
              )}>
                {statusConfig.icon}
                <span className="hidden xs:inline">{statusConfig.label}</span>
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-4 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
          
          {/* Delayed Warning - Top Priority */}
          {order.is_delayed && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 flex items-center gap-3"
            >
              <div className="p-2 rounded-xl bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-600 text-sm">Order Delayed</p>
                <p className="text-xs text-muted-foreground">Waiting longer than expected</p>
              </div>
            </motion.div>
          )}

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/10 to-pink-500/10 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Items</p>
              <p className="text-lg sm:text-xl font-bold text-orange-600">{order.total_items || order.items.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Total</p>
              <p className="text-lg sm:text-xl font-bold text-green-600">Rs.{order.total.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Payment</p>
              <p className="text-sm sm:text-base font-bold text-blue-600 capitalize truncate">{order.payment_method || 'Cash'}</p>
            </div>
          </div>

          {/* Customer Info - Collapsible on Mobile */}
          <CollapsibleSection 
            title="Customer" 
            icon={UserCircle}
            defaultOpen={true}
          >
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-700/50 mb-3">
              <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white font-bold">
                  {order.customer_name?.charAt(0) || 'G'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{order.customer_name || 'Guest'}</p>
                {order.customer?.email && (
                  <p className="text-xs text-muted-foreground truncate">{order.customer?.email}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {order.customer_phone && (
                <a 
                  href={`tel:${order.customer_phone}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-600 transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <Phone className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm flex-1">{order.customer_phone}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
              {order.customer_address && (
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-zinc-700/50">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 mt-0.5">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm flex-1">{order.customer_address}</span>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Table / Waiter Info */}
          {(order.table_number || order.waiter) && (
            <CollapsibleSection 
              title="Service Info" 
              icon={Building}
              defaultOpen={true}
            >
              <div className="space-y-2">
                {/* Table Details */}
                {order.table_number && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-blue-600">Table {order.table_number}</span>
                    </div>
                    {order.table_details && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {order.table_details?.capacity} seats
                        </Badge>
                        {order.table_details?.section && (
                          <Badge variant="outline" className="text-xs">
                            {order.table_details?.section}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Waiter Info */}
                {order.waiter?.name && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-violet-500/20 text-violet-600 font-medium text-sm">
                        {order.waiter.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{order.waiter.name}</p>
                      <p className="text-xs text-muted-foreground">Served by</p>
                    </div>
                    <UserCircle className="h-4 w-4 text-violet-500 shrink-0" />
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Order Items - Collapsible */}
          <CollapsibleSection 
            title="Order Items" 
            icon={ShoppingBag}
            badge={
              <Badge variant="secondary" className="text-xs ml-1">
                {order.total_items || order.items.length}
              </Badge>
            }
            defaultOpen={true}
          >
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-700/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white px-2.5 py-1 rounded-lg shrink-0">
                      {item.quantity}x
                    </span>
                    <span className="font-medium text-sm truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-sm shrink-0 ml-2">Rs.{(item.price * item.quantity).toLocaleString()}</span>
                </motion.div>
              ))}
              
              {/* Price Breakdown */}
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600 space-y-2">
                {order.subtotal && order.subtotal !== order.total && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>Rs.{order.subtotal.toLocaleString()}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <span className="text-xs">🎉</span> Discount
                    </span>
                    <span>-Rs.{order.discount.toLocaleString()}</span>
                  </div>
                )}
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Delivery Fee</span>
                    <span>Rs.{order.delivery_fee.toLocaleString()}</span>
                  </div>
                )}
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax</span>
                    <span>Rs.{order.tax.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-600">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                    Rs.{order.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Special Instructions */}
          {order.notes && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <MessageSquare className="h-4 w-4" />
                <p className="text-sm font-semibold">Special Instructions</p>
              </div>
              <p className="text-sm text-foreground/80">{order.notes}</p>
            </div>
          )}

          {/* Assign Delivery Rider */}
          {canAssignRider && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <Bike className="h-5 w-5" />
                <p className="font-semibold text-sm">Assign Delivery Rider</p>
              </div>
              
              {loadingRiders ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading riders...</span>
                </div>
              ) : riders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No riders available</p>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedRiderId} onValueChange={setSelectedRiderId}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select a rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders.map((rider) => (
                        <SelectItem key={rider.id} value={rider.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rider.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({rider.active_deliveries ?? 0} active)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleAssignRider} 
                    disabled={!selectedRiderId || assigningRider}
                    className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 font-semibold"
                  >
                    {assigningRider ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4 mr-2" />
                        Assign Rider
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Update Status Section */}
          <CollapsibleSection 
            title="Update Status" 
            icon={RefreshCw}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const isCurrentStatus = order.status === status;
                return (
                  <Button
                    key={status}
                    variant={isCurrentStatus ? "default" : "outline"}
                    size="sm"
                    disabled={isCurrentStatus || updatingStatus}
                    onClick={() => handleStatusChange(status as OrderStatus)}
                    className={cn(
                      "h-11 rounded-xl justify-start gap-2 text-xs font-medium",
                      isCurrentStatus && "bg-primary/10 text-primary border-primary/30"
                    )}
                  >
                    <span className={isCurrentStatus ? "text-primary" : config.color}>
                      {config.icon}
                    </span>
                    <span className="truncate">{getStatusLabel(status as OrderStatus, order.order_type)}</span>
                  </Button>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>

        {/* Fixed Footer Actions */}
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-white via-white to-white/95 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900/95 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800 px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-2.5 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 sm:h-11 rounded-xl font-semibold"
            >
              Close
            </Button>
            {order.status !== 'cancelled' && order.payment_status !== 'paid' && (
              isWaiter ? (
                billingStatus ? (
                  <Button
                    className="flex-1 h-12 sm:h-11 rounded-xl font-semibold border-2 border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500 cursor-default"
                    disabled
                  >
                    <Receipt className="h-4 w-4 mr-1.5" />
                    {billingStatus === 'already_exists' ? 'Bill Already in Billing' : 'Bill Pending Payment'}
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 h-12 sm:h-11 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 font-semibold shadow-lg shadow-blue-500/20"
                    onClick={() => {
                      onSendToBilling?.(order.id);
                      onOpenChange(false);
                    }}
                  >
                    <Receipt className="h-4 w-4 mr-1.5" />
                    Send to Billing
                  </Button>
                )
              ) : (
                <Button 
                  className="flex-1 h-12 sm:h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 font-semibold shadow-lg shadow-green-500/20"
                  onClick={() => {
                    onGenerateBill(order.id);
                    onOpenChange(false);
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  Generate Bill
                </Button>
              )
            )}
          </div>
        </div>
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
  onSendToBilling,
  showWaiterBadge,
  isWaiter,
  billingStatus,
}: {
  order: PortalOrder;
  onViewDetails: (order: PortalOrder) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onGenerateBill: (orderId: string) => void;
  onSendToBilling?: (orderId: string) => void;
  showWaiterBadge?: boolean;
  isWaiter?: boolean;
  billingStatus?: 'pending' | 'already_exists';
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

          {/* Waiter badge — shown in "All Orders" view for context */}
          {showWaiterBadge && order.waiter?.name && (
            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 cursor-pointer" onClick={() => onViewDetails(order)}>
              <UserCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{order.waiter.name}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span>{order.total_items || order.items.length} items</span>
            <span>{new Date(order.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
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
          
          {/* Bill Button - Show for ready/delivered orders */}
          {['ready', 'delivered'].includes(order.status) && order.payment_status !== 'paid' && (
            isWaiter ? (
              billingStatus ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="w-full gap-2 font-medium border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500 cursor-default"
                >
                  <Receipt className="h-4 w-4" />
                  {billingStatus === 'already_exists' ? 'Bill Already in Billing' : 'Bill Sent — Pending Payment'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 font-medium border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendToBilling?.(order.id);
                  }}
                >
                  <Receipt className="h-4 w-4" />
                  Send to Billing
                </Button>
              )
            ) : (
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
            )
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
  currentEmployeeId,
  currentRole,
}: OrdersClientProps) {
  const router = useRouter();
  
  // Use server data directly - no client-side fetching
  const orders = serverOrders;
  const stats = serverStats;
  const totalCount = serverTotalCount;
  const hasMore = serverHasMore;
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Waiter-specific: default to showing only own orders
  const isWaiter = currentRole === 'waiter';
  const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(isWaiter);
  
  const [selectedOrder, setSelectedOrder] = useState<PortalOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  // Track orders that have been sent to billing (orderId -> 'pending' | 'already_exists')
  const [billedOrderIds, setBilledOrderIds] = useState<Map<string, 'pending' | 'already_exists'>>(new Map());
  
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
      // Waiter filter: when enabled, only show orders taken by the current waiter
      const matchesWaiter = !showMyOrdersOnly || !currentEmployeeId || order.waiter?.id === currentEmployeeId;
      return matchesSearch && matchesStatus && matchesType && matchesWaiter;
    });
  }, [orders, searchQuery, statusFilter, typeFilter, showMyOrdersOnly, currentEmployeeId]);

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
  // Uses shared ORDERS channel (deduplicated across all portal pages)
  useEffect(() => {
    let lastUpdateTime = Date.now();
    
    const callback = () => {
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
    };

    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      callback
    );

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      unsubscribe();
    };
  }, [router]);

  // Handle generate bill - redirect to billing page with order details
  const handleGenerateBill = (orderId: string) => {
    // Instant redirect to billing page
    router.push(`/portal/billing/${orderId}`);
  };

  // Handle send to billing - waiter sends order to billing queue
  const handleSendToBilling = async (orderId: string) => {
    try {
      const result = await sendOrderToBillingAction(orderId);
      if (result.success) {
        if (result.already_exists) {
          setBilledOrderIds(prev => new Map(prev).set(orderId, 'already_exists'));
          toast.info('Bill already in billing queue', {
            description: 'This order already has an active invoice.',
          });
        } else {
          setBilledOrderIds(prev => new Map(prev).set(orderId, 'pending'));
          toast.success('Bill sent to billing counter!', {
            description: 'The billing team will process the payment.',
          });
        }
      } else {
        toast.error(result.error || 'Failed to send to billing');
      }
    } catch {
      toast.error('Failed to send to billing');
    }
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
        {/* Waiter scope toggle — only visible for waiter role */}
        {isWaiter && (
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex-shrink-0">
            <button
              onClick={() => setShowMyOrdersOnly(true)}
              className={cn(
                'px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                showMyOrdersOnly
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : 'bg-transparent text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              <UserCircle className="h-3.5 w-3.5" />
              My Orders
            </button>
            <button
              onClick={() => setShowMyOrdersOnly(false)}
              className={cn(
                'px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-l border-zinc-200 dark:border-zinc-700',
                !showMyOrdersOnly
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                  : 'bg-transparent text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              All Orders
            </button>
          </div>
        )}
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
                onSendToBilling={handleSendToBilling}
                showWaiterBadge={isWaiter && !showMyOrdersOnly}
                isWaiter={isWaiter}
                billingStatus={billedOrderIds.get(order.id)}
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
        onSendToBilling={handleSendToBilling}
        isWaiter={isWaiter}
        billingStatus={selectedOrder ? billedOrderIds.get(selectedOrder.id) : undefined}
      />
    </>
  );
}
