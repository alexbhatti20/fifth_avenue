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
  Flame,
  Star,
  TrendingUp,
  Sparkles,
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
import { subscribeToRiderAssignments } from '@/lib/realtime';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import {
  playNotificationSound,
  showNotificationWithSound,
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '@/lib/notification-sound';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
// FIX #18: Import shared timer for performance
import { useSharedTimer, getElapsedMinutes } from '@/lib/shared-timer';
import type { Order } from '@/types/portal';
import type { DeliveryOrderServer } from '@/lib/server-queries';

// FIX #19: CSS animations moved to globals.css to eliminate dynamic injection
// Previously injected gradientShift and pulse-ring animations are now in app/globals.css

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

interface DeliveryClientProps {
  initialOrders: DeliveryOrderServer[];
}

// ==========================================
// PREMIUM UTILITY COMPONENTS
// ==========================================

// Premium Stats Card - Mobile Optimized (No heavy animations)
function PremiumStatsCard({
  title,
  value,
  icon,
  gradient = 'from-primary via-orange-500 to-primary',
  subValue,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  gradient?: string;
  subValue?: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        padding: '2px',
        background: 'linear-gradient(90deg, #ff6b35, #f72585)',
      }}
    >
      <div className="relative rounded-[14px] bg-white dark:bg-zinc-950 p-3 sm:p-4 h-full">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p
              className="text-xl sm:text-2xl md:text-3xl font-bold mt-0.5 sm:mt-1"
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
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" />}
                {trend === 'down' && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500 rotate-180" />}
                {subValue}
              </p>
            )}
          </div>
          <div
            className="p-2 sm:p-2.5 rounded-xl flex-shrink-0"
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

// Order Timer with enhanced visual indicators
// FIX #18: Using shared timer to reduce setInterval instances
function DeliveryTimer({ createdAt }: { createdAt: string }) {
  // Use shared timer - returns seconds, convert to minutes
  const elapsedSeconds = useSharedTimer(createdAt);
  const elapsed = Math.floor(elapsedSeconds / 60); // Convert to minutes

  const isUrgent = elapsed > 30;
  const isLate = elapsed > 45;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-sm px-3 py-1 rounded-xl',
        isLate ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' :
        isUrgent ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' :
        'bg-green-500/10 text-green-600 border-green-500/30'
      )}
    >
      <Timer className="h-3.5 w-3.5 mr-1.5" />
      {elapsed} min
      {isLate && <Flame className="h-3 w-3 ml-1 text-red-500" />}
    </Badge>
  );
}

// Premium Live indicator dot
function LiveIndicator() {
  return (
    <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      Live Updates
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
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative mb-6 rounded-2xl overflow-hidden"
      style={{
        padding: '1.5px',
        background: status === 'denied'
          ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)'
          : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 3s ease infinite',
      }}
    >
      <div className={cn(
        "relative rounded-[14px] p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4",
        status === 'denied'
          ? 'bg-gradient-to-r from-red-50 via-orange-50 to-red-50 dark:from-red-950/80 dark:via-orange-950/80 dark:to-red-950/80'
          : 'bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/80 dark:via-purple-950/80 dark:to-blue-950/80'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl shadow-lg",
            status === 'denied'
              ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/25'
              : 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-purple-500/25'
          )}>
            {status === 'denied' ? (
              <BellOff className="h-5 w-5 text-white" />
            ) : (
              <Bell className="h-5 w-5 text-white animate-bounce" />
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {status === 'denied'
                ? 'Notifications are blocked'
                : 'Enable notifications'}
            </p>
            <p className="text-sm text-muted-foreground">
              {status === 'denied'
                ? 'Please enable in browser settings'
                : 'Get instant alerts for new orders'}
            </p>
          </div>
        </div>
        {status !== 'denied' && (
          <Button
            onClick={onEnable}
            className="gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 shadow-lg shadow-purple-500/25"
          >
            <Bell className="h-4 w-4" />
            Enable Notifications
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// PREMIUM ORDER CARDS
// ==========================================

// Premium Order Card for My Deliveries
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

  const gradientClass = isDelivering
    ? 'from-orange-500 via-red-500 to-orange-500'
    : 'from-blue-500 via-purple-500 to-blue-500';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        padding: '2px',
        background: `linear-gradient(90deg, ${isDelivering ? '#f97316, #ef4444, #f97316' : '#3b82f6, #8b5cf6, #3b82f6'})`,
        backgroundSize: '200% 200%',
        animation: 'gradientShift 3s ease infinite',
      }}
    >
      <Card className={cn(
        'border-0 rounded-[14px] transition-all',
        isDelivering
          ? 'bg-gradient-to-br from-orange-50/90 via-white to-red-50/90 dark:from-orange-950/90 dark:via-zinc-950 dark:to-red-950/90'
          : 'bg-gradient-to-br from-blue-50/90 via-white to-purple-50/90 dark:from-blue-950/90 dark:via-zinc-950 dark:to-purple-950/90'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'relative w-14 h-14 rounded-xl flex items-center justify-center shadow-lg',
                isDelivering
                  ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-blue-500/30'
              )}>
                {isDelivering && (
                  <span
                    className="absolute inset-0 rounded-xl bg-orange-400"
                    style={{ animation: 'pulse-ring 1.5s ease-out infinite' }}
                  />
                )}
                {isDelivering ? (
                  <Bike className="h-7 w-7 text-white relative z-10" />
                ) : (
                  <Package className="h-7 w-7 text-white relative z-10" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
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
                className="flex-1 rounded-xl"
                onClick={() => onViewDetails(order)}
              >
                Full Details
              </Button>
              <Button
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 border-0"
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
                className="flex-1 rounded-xl"
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
                className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 border-0"
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

// Premium Available Order Card (for unassigned orders)
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        padding: '2px',
        background: 'linear-gradient(90deg, #64748b, #94a3b8, #64748b)',
        backgroundSize: '200% 200%',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(90deg, #ff6b35, #f72585, #ff6b35)';
        e.currentTarget.style.animation = 'gradientShift 2s ease infinite';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(90deg, #64748b, #94a3b8, #64748b)';
        e.currentTarget.style.animation = 'none';
      }}
    >
      <Card className="border-0 rounded-[14px] transition-all bg-white dark:bg-zinc-950">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center shadow-inner">
                <Package className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">#{order.order_number}</CardTitle>
                <CardDescription className="text-sm">
                  {order.items.length} items • Rs. {order.total.toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <DeliveryTimer createdAt={order.created_at} />
          </div>
        </CardHeader>

        <CardContent className="pb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.customer_name}</span>
          </div>
          <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{order.customer_address || 'No address'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs rounded-lg font-medium",
                order.payment_method === 'cash'
                  ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                  : 'bg-green-500/10 text-green-600 border-green-500/30'
              )}
            >
              {order.payment_method === 'cash' ? 'Cash' : 'Paid Online'}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="pt-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl"
            onClick={() => onViewDetails(order)}
          >
            Details
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-xl bg-gradient-to-r from-primary via-orange-500 to-primary hover:opacity-90 shadow-lg shadow-orange-500/25 border-0"
            onClick={() => onAccept(order.id)}
          >
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center shadow-lg',
                isDelivering
                  ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-blue-500/30'
              )}
            >
              {isDelivering ? (
                <Bike className="h-7 w-7 text-white" />
              ) : (
                <Package className="h-7 w-7 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Order #{order.order_number}</DialogTitle>
              <DialogDescription>
                {isDelivering ? 'Currently being delivered' : 'Ready for pickup'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Timer */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
            <span className="font-medium">Time Since Order</span>
            <DeliveryTimer createdAt={order.created_at} />
          </div>

          {/* Customer Details */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
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
                    className="h-6 w-6 text-green-500 hover:text-green-600"
                    onClick={() => window.open(`tel:${order.customer_phone}`, '_blank')}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </h4>
            <p className="text-sm">{order.customer_address || 'No address provided'}</p>
            <Button
              variant="outline"
              className="w-full rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950"
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
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
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
              <span
                style={{
                  background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Rs. {order.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="font-semibold">Payment Method</span>
              </div>
              <Badge
                variant={order.payment_method === 'cash' ? 'outline' : 'default'}
                className={cn(
                  'text-sm rounded-lg',
                  order.payment_method === 'cash'
                    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                    : 'bg-green-500/10 text-green-600 border-green-500/30'
                )}
              >
                {order.payment_method === 'cash' ? 'Cash on Delivery' : 'Paid Online'}
              </Badge>
            </div>
            {order.payment_method === 'cash' && (
              <p className="text-sm text-yellow-600 mt-2 flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4" />
                Collect Rs. {order.total.toLocaleString()} from customer
              </p>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 border border-yellow-500/20">
              <h4 className="font-semibold text-yellow-600 flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" />
                Special Instructions
              </h4>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Close
          </Button>
          {onAction && isReady && (
            <Button
              onClick={() => onAction('accept', order.id)}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 border-0"
            >
              <Truck className="h-4 w-4 mr-2" />
              Accept & Start Delivery
            </Button>
          )}
          {onAction && isDelivering && (
            <Button
              onClick={() => onAction('deliver', order.id)}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 border-0"
            >
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
  const isFirstRender = useRef(true);

  const fetchHistory = useCallback(async (loadMore = false) => {
    // Prevent duplicate initial fetch
    if (isFirstRender.current && !loadMore) {
      isFirstRender.current = false;
    }

    try {
      setIsLoading(true);

      // Use authenticated API route — avoids client-side RPC permission issues
      const res = await fetch('/api/portal/delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'history',
          riderId,
          status: 'delivered',
          limit: 20,
          offset: loadMore ? offset : 0,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

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
      console.error('Error fetching delivery history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [riderId, offset]);

  // Fetch only once on mount - use a ref to track if we've fetched for this riderId
  const lastFetchedRiderId = useRef<string | null>(null);

  useEffect(() => {
    // Only fetch if riderId exists and we haven't fetched for this rider yet
    if (!riderId || lastFetchedRiderId.current === riderId) return;
    lastFetchedRiderId.current = riderId;
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]); // Only depend on riderId, not fetchHistory

  return (
    <div className="space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumStatsCard
          title="Today"
          value={stats?.total_today || 0}
          icon={<Zap className="h-5 w-5 text-green-500" />}
          gradient="from-green-500 via-emerald-500 to-green-500"
          subValue="deliveries"
        />
        <PremiumStatsCard
          title="This Week"
          value={stats?.total_this_week || 0}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          gradient="from-blue-500 via-cyan-500 to-blue-500"
          subValue="deliveries"
        />
        <PremiumStatsCard
          title="Total"
          value={stats?.total_deliveries || 0}
          icon={<Target className="h-5 w-5 text-purple-500" />}
          gradient="from-purple-500 via-pink-500 to-purple-500"
          subValue="all time"
        />
        <PremiumStatsCard
          title="Avg Time"
          value={stats?.avg_delivery_minutes ? `${stats.avg_delivery_minutes}m` : '-'}
          icon={<Timer className="h-5 w-5 text-amber-500" />}
          gradient="from-amber-500 via-orange-500 to-amber-500"
          subValue="per delivery"
        />
      </div>

      {/* Premium Earnings Card */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            padding: '2px',
            background: 'linear-gradient(90deg, #22c55e, #10b981, #22c55e)',
            backgroundSize: '200% 200%',
            animation: 'gradientShift 3s ease infinite',
          }}
        >
          <Card className="border-0 rounded-[14px] bg-gradient-to-br from-green-50/90 via-white to-emerald-50/90 dark:from-green-950/90 dark:via-zinc-950 dark:to-emerald-950/90">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Earnings</p>
                  <p
                    className="text-4xl font-bold mt-1"
                    style={{
                      background: 'linear-gradient(135deg, #22c55e, #10b981)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Rs. {stats.total_earnings?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  {stats.avg_rating && (
                    <div className="text-center p-3 rounded-xl bg-amber-500/10">
                      <p className="text-xl font-bold text-amber-500 flex items-center gap-1">
                        <Star className="h-5 w-5 fill-amber-500" /> {stats.avg_rating}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  )}
                  {stats.cancelled_count > 0 && (
                    <div className="text-center p-3 rounded-xl bg-red-500/10">
                      <p className="text-xl font-bold text-red-500">{stats.cancelled_count}</p>
                      <p className="text-xs text-muted-foreground">Cancelled</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* History List */}
      <DataTableWrapper
        isLoading={isLoading}
        isEmpty={deliveries.length === 0}
        emptyMessage="No deliveries completed yet"
      >
        <div className="space-y-3">
          {deliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative rounded-xl overflow-hidden"
              style={{ padding: '1.5px', background: 'linear-gradient(90deg, #22c55e50, #10b98150, #22c55e50)' }}
            >
              <div className="flex items-center justify-between p-4 rounded-[10px] bg-white dark:bg-zinc-950 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-base">#{delivery.order_number}</p>
                    <p className="text-sm text-muted-foreground">{delivery.customer_name}</p>
                    {delivery.actual_delivery_minutes && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {delivery.actual_delivery_minutes} mins
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="font-bold text-lg"
                    style={{
                      background: 'linear-gradient(135deg, #22c55e, #10b981)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Rs. {delivery.total?.toLocaleString()}
                  </p>
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
                    <p className="text-xs text-amber-500 flex items-center justify-end gap-1">
                      <Star className="h-3 w-3 fill-amber-500" /> {delivery.customer_rating}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Load More */}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full rounded-xl"
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
// MAIN DELIVERY CLIENT COMPONENT
// ==========================================

export default function DeliveryClient({ initialOrders }: DeliveryClientProps) {
  const { employee, role } = usePortalAuth();
  // Cast through unknown to avoid type mismatch (server type is subset of client type)
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders as unknown as DeliveryOrder[]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Fetch orders via authenticated API route (no direct DB access)
  const fetchOrders = useCallback(async () => {
    if (!riderId) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/delivery', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const orders = result?.data || [];

      // Store known orders
      orders.forEach((o: { id: string }) => knownOrdersRef.current.add(o.id));
      setOrders(orders);
      setLastUpdate(new Date());
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [riderId]);

  // Initialize known orders from initial data
  useEffect(() => {
    initialOrders.forEach((o) => knownOrdersRef.current.add(o.id));
  }, [initialOrders]);

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

    // Also subscribe to ready orders via shared ORDERS channel
    const unsubscribeReady = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      (payload?: any) => {
        if (payload?.eventType !== 'UPDATE') return;
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        
        // Check if status changed to 'ready' and is online/delivery order
        if (
          newRecord?.status === 'ready' &&
          oldRecord?.status !== 'ready' &&
          newRecord?.order_type === 'online'
        ) {
          if (!knownOrdersRef.current.has(newRecord.id)) {
            knownOrdersRef.current.add(newRecord.id);
            setOrders((prev) => [newRecord, ...prev]);
            playNotificationSound('new_order');
          }
          setLastUpdate(new Date());
        } else if (
          newRecord?.status === 'ready' ||
          newRecord?.status === 'delivering' ||
          newRecord?.status === 'delivered'
        ) {
          setOrders((prev) => {
            if (['delivered', 'cancelled'].includes(newRecord.status)) {
              return prev.filter((o: any) => o.id !== newRecord.id);
            }
            return prev.map((o: any) => (o.id === newRecord.id ? newRecord : o));
          });
          setLastUpdate(new Date());
        }
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

  // Accept/Start delivery via authenticated API route
  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/portal/delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', orderId, riderId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

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

  // Complete delivery via authenticated API route
  const handleDeliverOrder = async (orderId: string, notes?: string) => {
    try {
      const res = await fetch('/api/portal/delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', orderId, notes: notes || null, riderId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

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

  // Cancel delivery via authenticated API route
  const handleCancelDelivery = async (orderId: string, reason: string) => {
    try {
      const res = await fetch('/api/portal/delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', orderId, reason, riderId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

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
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                boxShadow: '0 8px 32px rgba(247, 37, 133, 0.3)',
              }}
            >
              <Truck className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #ff6b35, #f72585)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {isRider ? 'My Deliveries' : 'Delivery Management'}
                </span>
                <LiveIndicator />
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {isRider
                  ? 'View your assigned orders and make deliveries'
                  : 'Manage all delivery orders in real-time'}
                <span className="ml-2 opacity-60">
                  • Updated: {lastUpdate.toLocaleTimeString()}
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchOrders}
            disabled={isLoading}
            className="rounded-xl h-11 px-5"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Notification Permission Banner */}
      {isRider && (
        <NotificationBanner status={notificationStatus} onEnable={handleEnableNotifications} />
      )}

      {/* Premium Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {isRider ? (
          <>
            <PremiumStatsCard
              title="My Active Orders"
              value={stats.myActive}
              icon={<Target className="h-5 w-5 text-blue-500" />}
              gradient="from-blue-500 via-indigo-500 to-blue-500"
              subValue={stats.myActive > 0 ? 'orders assigned' : 'no orders'}
            />
            <PremiumStatsCard
              title="Available to Pick"
              value={stats.available}
              icon={<Package className="h-5 w-5 text-orange-500" />}
              gradient="from-orange-500 via-amber-500 to-orange-500"
              subValue={stats.available > 0 ? 'ready for pickup' : 'all picked'}
            />
            <PremiumStatsCard
              title="Total In Progress"
              value={stats.inProgress}
              icon={<Truck className="h-5 w-5 text-green-500" />}
              gradient="from-green-500 via-emerald-500 to-green-500"
              subValue="being delivered"
            />
          </>
        ) : (
          <>
            <PremiumStatsCard
              title="Ready for Pickup"
              value={stats.available}
              icon={<Package className="h-5 w-5 text-blue-500" />}
              gradient="from-blue-500 via-indigo-500 to-blue-500"
            />
            <PremiumStatsCard
              title="In Transit"
              value={stats.inProgress}
              icon={<Truck className="h-5 w-5 text-orange-500" />}
              gradient="from-orange-500 via-amber-500 to-orange-500"
            />
            <PremiumStatsCard
              title="Active Riders"
              value={new Set(allDeliveries.map((o) => o.delivery_rider_id).filter(Boolean)).size}
              icon={<Bike className="h-5 w-5 text-green-500" />}
              gradient="from-green-500 via-emerald-500 to-green-500"
            />
          </>
        )}
      </div>

      <Tabs defaultValue={isRider ? 'my-orders' : 'all'} className="space-y-6">
        {/* Premium Tabs */}
        <div
          className="inline-flex p-1 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,53,0.1), rgba(247,37,133,0.1))',
            border: '1px solid rgba(255,107,53,0.2)',
          }}
        >
          <TabsList className="grid grid-cols-3 w-full max-w-md bg-transparent p-0">
            {isRider && (
              <TabsTrigger
                value="my-orders"
                className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-lg transition-all duration-300"
              >
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">My Orders</span>
                {stats.myActive > 0 && (
                  <Badge
                    className="ml-1 h-5 px-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0"
                  >
                    {stats.myActive}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger
              value="all"
              className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-lg transition-all duration-300"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Available</span>
              {stats.available > 0 && (
                <Badge
                  className="ml-1 h-5 px-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0"
                >
                  {stats.available}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-lg transition-all duration-300"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* My Orders Tab (for riders) */}
        {isRider && (
          <TabsContent value="my-orders">
            <DataTableWrapper
              isLoading={isLoading}
              isEmpty={myAssignedOrders.length === 0}
              emptyMessage={
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16"
                >
                  <div
                    className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,107,53,0.1), rgba(247,37,133,0.1))',
                    }}
                  >
                    <Truck className="h-10 w-10 text-muted-foreground opacity-60" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No active deliveries</h3>
                  <p className="text-muted-foreground mb-6">
                    Accept an order from the Available tab to start delivering
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => document.querySelector('[value="all"]')?.dispatchEvent(new Event('click'))}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Browse Available Orders
                  </Button>
                </motion.div>
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div
                  className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.15))',
                  }}
                >
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-green-600">All caught up!</h3>
                <p className="text-muted-foreground">
                  No orders are waiting for delivery at the moment
                </p>
              </motion.div>
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
