'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  Clock,
  Timer,
  CheckCircle,
  AlertTriangle,
  Play,
  ChefHat,
  Bell,
  Volume2,
  VolumeX,
  RefreshCw,
  Package,
  Bike,
  MapPin,
  Phone,
  User,
  Hash,
  Eye,
  Coffee,
  Flame,
  Users,
  Building2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Zap,
  History,
  CalendarDays,
  Trophy,
  Target,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
// FIX #18: Import shared timer for performance
import { useSharedTimer } from '@/lib/shared-timer';
import type { KitchenOrder, KitchenStats } from '@/lib/server-queries';
import { SectionHeader } from '@/components/portal/PortalProvider';

// ── Authenticated API helpers (go through /api/portal/kitchen, never anon) ──
async function kitchenGET() {
  const res = await fetch('/api/portal/kitchen', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Kitchen API error: ${res.status}`);
  return res.json();
}
async function kitchenPOST(body: Record<string, unknown>) {
  const res = await fetch('/api/portal/kitchen', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Props interface for SSR data
interface KitchenClientProps {
  initialOrders: KitchenOrder[];
  initialStats: KitchenStats | null;
}

// FIX #19: CSS animations moved to globals.css to eliminate dynamic injection
// Previously injected gradientShift animation is now in app/globals.css

// Types (re-export from server-queries for local use)
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  image?: string;
}

interface TableDetails {
  id: string;
  table_number: number;
  capacity: number;
  section?: string;
  floor: number;
  current_customers: number;
  assigned_waiter?: { id: string; name: string; phone?: string };
}

// Animated Order Timer Component
// FIX #18: Using shared timer to reduce setInterval instances
function OrderTimer({
  createdAt,
  kitchenStartedAt,
  maxMinutes = 25,
  compact = false
}: {
  createdAt: string;
  kitchenStartedAt?: string;
  maxMinutes?: number;
  compact?: boolean;
}) {
  // Use shared timer instead of individual setInterval
  const elapsed = useSharedTimer(kitchenStartedAt || createdAt);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progress = Math.min((minutes / maxMinutes) * 100, 100);
  const isOverdue = minutes > maxMinutes;
  const isWarning = minutes > maxMinutes * 0.7;

  if (compact) {
    return (
      <div className={cn(
        'font-bebas text-lg px-3 py-1 border-2 border-black',
        isOverdue ? 'bg-[#ED1C24] text-white' : isWarning ? 'bg-[#FFD200] text-black' : 'bg-black text-[#FFD200]'
      )}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className={cn(
          'font-mono text-xl font-bold tabular-nums',
          isOverdue ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-green-500'
        )}
        animate={isOverdue ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </motion.div>
      <div className="w-20">
        <Progress
          value={progress}
          className={cn(
            'h-2',
            isOverdue && '[&>div]:bg-red-500',
            isWarning && !isOverdue && '[&>div]:bg-yellow-500'
          )}
        />
      </div>
    </div>
  );
}

// Order Type Badge
function OrderTypeBadge({ type, tableNumber }: { type: string; tableNumber?: number }) {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    'dine-in': {
      icon: <Coffee className="h-3 w-3" />,
      color: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
      label: tableNumber ? `Table ${tableNumber}` : 'Dine-in'
    },
    'online': {
      icon: <Bike className="h-3 w-3" />,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      label: 'Delivery'
    },
    'walk-in': {
      icon: <Package className="h-3 w-3" />,
      color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      label: 'Takeaway'
    },
  };

  const c = config[type] || config['walk-in'];

  return (
    <Badge variant="outline" className={cn('gap-1 font-source-sans font-black uppercase tracking-tighter rounded-none border-2 border-black', c.color)}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

// Kitchen Order Card - Premium White Card (Mobile Optimized)
function KitchenOrderCard({
  order,
  onStatusChange,
  onViewDetails,
}: {
  order: KitchenOrder;
  onStatusChange: (orderId: string, status: string) => void;
  onViewDetails: (order: KitchenOrder) => void;
}) {
  const statusLabels: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: <Clock className="h-4 w-4" />, label: 'Pending', color: 'text-amber-600' },
    confirmed: { icon: <Bell className="h-4 w-4" />, label: 'New', color: 'text-blue-600' },
    preparing: { icon: <Flame className="h-4 w-4" />, label: 'Cooking', color: 'text-orange-600' },
    ready: { icon: <CheckCircle className="h-4 w-4" />, label: 'Ready', color: 'text-green-600' },
  };

  const status = statusLabels[order.status] || statusLabels.pending;

  return (
    <div className="group relative">
      {/* Urban Card Content */}
      <Card className="relative overflow-hidden bg-white border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
        {/* Header - Clean White with Red Accents */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-black text-white border-b-4 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div
                className="min-w-[48px] sm:min-w-[56px] h-10 sm:h-12 px-2 border-2 border-[#FFD200] bg-black flex flex-col items-center justify-center text-[#FFD200]"
              >
                <span className="text-[8px] sm:text-[9px] font-bebas tracking-widest opacity-70">ORD</span>
                <span className="text-sm sm:text-base font-bebas font-bold leading-none">#{order.order_number}</span>
              </div>
              <div>
                <div className={cn('flex items-center gap-2 font-bebas text-lg tracking-wider uppercase', status.color)}>
                  {status.icon}
                  <span>{status.label}</span>
                </div>
                <p className="text-[10px] font-source-sans font-black text-white/60 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                  <Package className="h-3 w-3" />
                  {order.total_items || order.items?.length || 0} ITEMS
                </p>
              </div>
            </div>

            {/* Timer - Live */}
            <div className="text-right">
              <LiveTimer createdAt={order.created_at} />
            </div>
          </div>
        </div>

        {/* Order Type Badge */}
        <div className="px-4 py-2 flex items-center justify-between bg-white dark:bg-zinc-900">
          <OrderTypeBadge type={order.order_type} tableNumber={order.table_number} />
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            {order.customer_name}
          </p>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Order Items - Improved Design */}
          <div className="space-y-2">
            {order.items?.slice(0, 4).map((item, index) => (
              <motion.div
                key={`${item.id}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-2.5 bg-black/[0.03] border-2 border-black hover:border-[#ED1C24] hover:bg-black/[0.06] transition-colors group/item"
              >
                <div className="w-9 h-9 border-2 border-black flex items-center justify-center font-bebas text-lg bg-[#FFD200] text-black">
                  {item.quantity}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bebas text-xl text-black leading-none uppercase truncate group-hover/item:text-[#ED1C24] transition-colors">
                    {item.name}
                  </p>
                  {item.notes && (
                    <p className="text-[10px] font-source-sans font-black text-[#ED1C24] uppercase tracking-widest flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {item.notes}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
            {order.items?.length > 4 && (
              <motion.p
                className="text-[10px] font-source-sans font-black text-black/40 uppercase tracking-widest text-center py-2 bg-black/[0.03] border-2 border-black"
                whileHover={{ scale: 1.02 }}
              >
                +{order.items.length - 4} MORE ITEMS
              </motion.p>
            )}
          </div>

          {/* Special Instructions */}
          {order.notes && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 border-2 border-black bg-[#FFD200]/10"
            >
              <p className="text-[10px] font-source-sans font-black text-black/60 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> SPECIAL INSTRUCTIONS
              </p>
              <p className="text-sm font-bold">{order.notes}</p>
            </motion.div>
          )}

          {/* Table Details for Dine-in */}
          {order.order_type === 'dine-in' && order.table_details && (
            <div className="p-3 border-2 border-black bg-[#ED1C24]/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 border-2 border-black bg-black flex items-center justify-center">
                    <Coffee className="h-4 w-4 text-[#FFD200]" />
                  </div>
                  <div>
                    <span className="font-bebas text-lg tracking-wider text-black">Table {order.table_number}</span>
                    {order.table_details.section && (
                      <p className="text-[10px] font-source-sans font-black text-black/40 uppercase tracking-tighter leading-none">{order.table_details.section}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-bebas tracking-widest">
                    <Users className="h-3.5 w-3.5 text-[#ED1C24]" />
                    {order.table_details.current_customers}/{order.table_details.capacity}
                  </div>
                  {order.table_details.assigned_waiter && (
                    <p className="text-[10px] font-source-sans font-black text-black/40 uppercase tracking-tighter">
                      {order.table_details.assigned_waiter.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions - Better Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hover:bg-muted"
              onClick={() => onViewDetails(order)}
            >
              <Eye className="h-4 w-4" />
              Details
            </Button>

            <div className="flex-1">
              {order.status === 'pending' && (
                <Button
                  className="w-full bg-black text-[#FFD200] border-2 border-black rounded-none font-bebas tracking-widest hover:bg-[#FFD200] hover:text-black transition-all"
                  onClick={() => onStatusChange(order.id, 'confirmed')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  CONFIRM
                </Button>
              )}
              {order.status === 'confirmed' && (
                <Button
                  className="w-full bg-[#FFD200] text-black border-2 border-black rounded-none font-bebas tracking-widest hover:bg-black hover:text-[#FFD200] transition-all"
                  onClick={() => onStatusChange(order.id, 'preparing')}
                >
                  <Flame className="h-4 w-4 mr-2" />
                  START COOKING
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button
                  className="w-full bg-[#ED1C24] text-white border-2 border-black rounded-none font-bebas tracking-widest hover:bg-black hover:text-[#ED1C24] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  onClick={() => onStatusChange(order.id, 'ready')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  MARK READY
                </Button>
              )}
              {order.status === 'ready' && (
                <Button
                  variant="outline"
                  className="w-full text-white border-2 border-black bg-black font-bebas tracking-widest"
                  disabled
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  COMPLETED
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Live Timer Component - Calculates time in real-time from created_at
// FIX #18: Using shared timer to reduce setInterval instances
function LiveTimer({ createdAt, compact = false }: { createdAt: string; compact?: boolean }) {
  // Use shared timer instead of individual setInterval
  const elapsed = useSharedTimer(createdAt);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const isUrgent = minutes > 15;
  const isWarning = minutes > 10;

  if (compact) {
    return (
      <motion.span
        className={cn(
          'px-2.5 py-1 rounded-lg font-mono text-sm font-bold tabular-nums',
          isUrgent
            ? 'bg-red-500 text-white'
            : isWarning
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
        )}
        animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.8 }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </motion.span>
    );
  }

  return (
    <motion.div
      className={cn(
        'px-3 py-1.5 rounded-lg font-mono text-lg font-bold tabular-nums',
        isUrgent
          ? 'bg-red-500 text-white animate-pulse'
          : isWarning
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
            : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
      )}
      animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1 }}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </motion.div>
  );
}

// KDS Column View - Kanban Style with Animated Gradients
function KDSColumnView({
  orders,
  onStatusChange,
  onViewDetails,
}: {
  orders: KitchenOrder[];
  onStatusChange: (orderId: string, status: string) => void;
  onViewDetails: (order: KitchenOrder) => void;
}) {
  const columns = [
    {
      status: 'confirmed',
      title: 'New Orders',
      icon: <Bell className="h-5 w-5" />,
      headerGradient: 'bg-black',
      cardBorderGradient: ['#000', '#000', '#000'],
      accentColor: 'bg-[#FFD200] text-black',
      nextStatus: 'preparing',
      nextAction: 'Start Cooking'
    },
    {
      status: 'preparing',
      title: 'Cooking',
      icon: <Flame className="h-5 w-5" />,
      headerGradient: 'bg-black',
      cardBorderGradient: ['#000', '#000', '#000'],
      accentColor: 'bg-[#ED1C24] text-white',
      nextStatus: 'ready',
      nextAction: 'Mark Ready'
    },
    {
      status: 'ready',
      title: 'Ready',
      icon: <CheckCircle className="h-5 w-5" />,
      headerGradient: 'bg-black',
      cardBorderGradient: ['#000', '#000', '#000'],
      accentColor: 'bg-[#008A45] text-white',
      nextStatus: null,
      nextAction: null
    },
  ];

  const [mobileTab, setMobileTab] = useState<'confirmed' | 'preparing' | 'ready'>('confirmed');

  return (
    <div>
      {/* Mobile: tab selector for columns */}
      <div className="flex sm:hidden gap-1 mb-3 p-1 rounded-2xl bg-muted">
        {columns.map((col) => {
          const count = orders.filter(o => o.status === col.status).length;
          return (
            <button
              key={col.status}
              onClick={() => setMobileTab(col.status as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 border-2 border-black font-bebas text-sm tracking-widest transition-all uppercase',
                mobileTab === col.status
                  ? 'bg-[#FFD200] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black/40'
              )}
            >
              {col.icon}
              <span>{col.title}</span>
              {count > 0 && (
                <span className="min-w-[20px] h-[20px] bg-black text-[#FFD200] text-[10px] font-bold flex items-center justify-center px-1 ml-1">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:grid grid-cols-3 gap-4 h-[calc(100vh-300px)]">
        {columns.map((col) => {
          const columnOrders = orders.filter((o) => o.status === col.status);

          return (
            <motion.div
              key={col.status}
              className="flex flex-col border-4 border-black bg-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Urban Column Header */}
              <div className="px-4 py-4 flex items-center justify-between text-white bg-black border-b-4 border-black">
                <div className="flex items-center gap-2">
                  <div className="text-[#FFD200]">
                    {col.icon}
                  </div>
                  <span className="font-bebas text-2xl tracking-widest uppercase">{col.title}</span>
                </div>
                <div className="bg-[#FFD200] text-black px-3 py-1 font-bebas text-xl">
                  {columnOrders.length}
                </div>
              </div>

              {/* Orders Container */}
              <ScrollArea className="flex-1 p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {columnOrders.map((order) => {
                      return (
                        <motion.div
                          key={order.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, x: 100 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          className="relative group bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                          {/* Urban Card Content */}
                          <div className="relative p-4 bg-white">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={cn(
                                    'min-w-[48px] h-10 px-2 border-2 border-black flex items-center justify-center font-bebas text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
                                    col.accentColor
                                  )}
                                >
                                  <span className="truncate">#{order.order_number}</span>
                                </div>
                                <OrderTypeBadge type={order.order_type} tableNumber={order.table_number} />
                              </div>
                              <LiveTimer createdAt={order.created_at} compact />
                            </div>

                            {/* Customer */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                              <User className="h-3 w-3" />
                              <span className="truncate">{order.customer_name}</span>
                              <span className="ml-auto flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {order.total_items || order.items?.length || 0}
                              </span>
                            </div>

                            {/* Items */}
                            <div className="space-y-1.5 mb-3">
                              {order.items?.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                                  <span className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs text-white',
                                    col.accentColor
                                  )}>
                                    {item.quantity}
                                  </span>
                                  <span className="truncate flex-1 font-medium">{item.name}</span>
                                  {item.notes && (
                                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                                  )}
                                </div>
                              ))}
                              {order.items?.length > 3 && (
                                <p className="text-xs text-muted-foreground text-center py-1 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                                  +{order.items.length - 3} more items
                                </p>
                              )}
                            </div>

                            {/* Special notes indicator */}
                            {order.notes && (
                              <div className="mb-3 p-2.5 border-2 border-black bg-[#FFD200]/10">
                                <p className="text-[#ED1C24] text-[10px] font-source-sans font-black flex items-center gap-1 uppercase tracking-widest">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="truncate">{order.notes}</span>
                                </p>
                              </div>
                            )}

                            {/* Table info for dine-in */}
                            {order.order_type === 'dine-in' && order.table_number && (
                              <div className="mb-3 p-2.5 border-2 border-black bg-[#ED1C24]/5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 border-2 border-black bg-black flex items-center justify-center">
                                    <Coffee className="h-3 w-3 text-[#FFD200]" />
                                  </div>
                                  <span className="font-bebas text-sm tracking-widest text-black">
                                    Table {order.table_number}
                                  </span>
                                  {order.waiter && (
                                    <span className="text-[10px] font-source-sans font-black text-black/40 uppercase ml-auto">
                                      {order.waiter.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-shrink-0 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                onClick={() => onViewDetails(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {col.nextStatus && (
                                <Button
                                  size="sm"
                                  className={cn(
                                    'flex-1 text-white shadow-lg transition-all',
                                    col.accentColor,
                                    'hover:opacity-90 hover:shadow-xl hover:scale-105'
                                  )}
                                  onClick={() => onStatusChange(order.id, col.nextStatus!)}
                                >
                                  <ArrowRight className="h-4 w-4 mr-1.5" />
                                  {col.nextAction}
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {columnOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <ChefHat className="h-12 w-12 mb-3 opacity-40" />
                      </motion.div>
                      <p className="text-sm font-medium">No orders</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          );
        })}
      </div>

      {/* Mobile: single column based on selected tab */}
      <div className="sm:hidden">
        {columns
          .filter(col => col.status === mobileTab)
          .map((col) => {
            const columnOrders = orders.filter(o => o.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {columnOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 80 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="relative border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <div className="p-4 bg-white">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn('px-2.5 py-1 border-2 border-black flex items-center justify-center font-bebas text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]', col.accentColor)}>
                              #{order.order_number}
                            </div>
                            <OrderTypeBadge type={order.order_type} tableNumber={order.table_number} />
                          </div>
                          <LiveTimer createdAt={order.created_at} compact />
                        </div>
                        {/* Customer */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <User className="h-3 w-3" />
                          <span className="truncate">{order.customer_name}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {order.total_items || order.items?.length || 0}
                          </span>
                        </div>
                        {/* Items */}
                        <div className="space-y-1.5 mb-3">
                          {order.items?.slice(0, 4).map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                              <span className={cn('w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs text-white flex-shrink-0', col.accentColor)}>{item.quantity}</span>
                              <span className="truncate flex-1 font-medium">{item.name}</span>
                              {item.notes && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />}
                            </div>
                          ))}
                          {order.items?.length > 4 && (
                            <p className="text-xs text-muted-foreground text-center py-1 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">+{order.items.length - 4} more</p>
                          )}
                        </div>
                        {order.notes && (
                          <div className="mb-3 p-2 rounded-xl bg-orange-500/10 border border-orange-500/30">
                            <p className="text-orange-600 text-xs font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /><span className="truncate">{order.notes}</span></p>
                          </div>
                        )}
                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => onViewDetails(order)}><Eye className="h-4 w-4" /></Button>
                          {col.nextStatus && (
                            <Button size="sm" className={cn('flex-1 text-white shadow-lg', col.accentColor, 'hover:opacity-90')} onClick={() => onStatusChange(order.id, col.nextStatus!)}>
                              <ArrowRight className="h-4 w-4 mr-1" />{col.nextAction}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {columnOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ChefHat className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm font-medium">No orders here</p>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// Order Detail Modal
function OrderDetailModal({
  order,
  open,
  onClose,
  onStatusChange,
}: {
  order: KitchenOrder | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, status: string) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">Order #{order.order_number}</p>
              <p className="text-sm text-muted-foreground font-normal">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Order Info */}
          <div className="flex flex-wrap gap-2">
            <OrderTypeBadge type={order.order_type} tableNumber={order.table_number} />
            <Badge variant="outline" className="capitalize">{order.status}</Badge>
            <Badge variant="outline">{order.payment_method || 'N/A'}</Badge>
          </div>

          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium text-muted-foreground">Customer</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customer_phone}</span>
                </div>
              )}
              {order.customer_address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.customer_address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table Details for Dine-in */}
          {order.order_type === 'dine-in' && order.table_details && (
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-purple-600 flex items-center gap-2">
                  <Coffee className="h-4 w-4" />
                  Table Details
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Table</p>
                  <p className="font-bold text-lg">{order.table_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Guests</p>
                  <p className="font-bold text-lg">
                    {order.table_details.current_customers}/{order.table_details.capacity}
                  </p>
                </div>
                {order.table_details.section && (
                  <div>
                    <p className="text-muted-foreground">Section</p>
                    <p className="font-medium">{order.table_details.section}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Floor</p>
                  <p className="font-medium">{order.table_details.floor}</p>
                </div>
                {order.table_details.assigned_waiter && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Assigned Waiter</p>
                    <p className="font-medium">{order.table_details.assigned_waiter.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium text-muted-foreground">
                Items ({order.items?.length || 0})
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.items?.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold">
                    {item.quantity}x
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Rs. {item.price}</p>
                    {item.notes && (
                      <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Special Instructions */}
          {order.notes && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-orange-600 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Special Instructions
                </p>
                <p>{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between text-lg">
            <span className="font-medium">Total</span>
            <span className="font-bold">Rs. {order.total}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {order.status === 'confirmed' && (
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={() => { onStatusChange(order.id, 'preparing'); onClose(); }}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Cooking
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => { onStatusChange(order.id, 'ready'); onClose(); }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Ready
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Types for completed orders
interface CompletedOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  order_type: string;
  status: string;
  items: any[];
  total_items: number;
  subtotal: number;
  total: number;
  notes: string;
  table_number: number;
  created_at: string;
  kitchen_started_at: string;
  kitchen_completed_at: string;
  prepared_by: string;
  prepared_by_name: string;
  prep_time_minutes: number;
}

interface CompletedStats {
  total_completed: number;
  total_items_prepared: number;
  avg_prep_time_minutes: number;
  fastest_order_minutes: number;
  slowest_order_minutes: number;
  total_revenue: number;
}

type DateFilterType = 'today' | 'week' | 'month' | 'year' | 'custom';

// Helper to get date ranges
function getCompletedDateRange(preset: DateFilterType): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      return { startDate: formatDate(weekStart), endDate: formatDate(today) };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(monthStart), endDate: formatDate(today) };
    case 'year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(yearStart), endDate: formatDate(today) };
    default:
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}

// Completed Orders Tab Component
function CompletedOrdersTab() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [stats, setStats] = useState<CompletedStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const dateFilterOptions: { value: DateFilterType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  const fetchCompletedOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      let params: any = {
        filterType: dateFilter,
        limit: 100,
        offset: 0,
      };

      if (dateFilter === 'custom') {
        params.startDate = customStart;
        params.endDate = customEnd;
      }

      const postBody = {
        filterType: params.filterType,
        startDate: params.startDate,
        endDate: params.endDate,
        limit: params.limit,
        offset: params.offset,
      };
      const [ordersResult, statsResult] = await Promise.all([
        kitchenPOST({ action: 'completed_orders', ...postBody }),
        kitchenPOST({ action: 'completed_stats', ...postBody }),
      ]);

      if (ordersResult.success) {
        setOrders(ordersResult.data);
      }
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error fetching completed orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    fetchCompletedOrders();
  }, [fetchCompletedOrders]);

  const handleDateFilterChange = (filter: DateFilterType) => {
    if (filter === 'custom') {
      setIsCustomOpen(true);
      setDateFilter(filter);
      return;
    }
    setDateFilter(filter);
    setIsCustomOpen(false);
  };

  const handleCustomApply = () => {
    setDateFilter('custom');
    setIsCustomOpen(false);
  };

  const getDisplayText = () => {
    if (dateFilter === 'custom') {
      return `${customStart} - ${customEnd}`;
    }
    return dateFilterOptions.find(p => p.value === dateFilter)?.label || 'Today';
  };

  return (
    <div className="space-y-4">
      {/* Date Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 h-9">
              <CalendarDays className="h-4 w-4" />
              <span>{getDisplayText()}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {dateFilterOptions.filter(p => p.value !== 'custom').map((option) => (
                  <Button
                    key={option.value}
                    variant={dateFilter === option.value ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'w-full',
                      dateFilter === option.value && 'bg-gradient-to-r from-green-500 to-emerald-500'
                    )}
                    onClick={() => {
                      handleDateFilterChange(option.value);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Custom Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <Button
                  className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-500"
                  size="sm"
                  onClick={handleCustomApply}
                >
                  Apply Custom Range
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={fetchCompletedOrders} disabled={isLoading} className="h-9">
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
          >
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_completed}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
          >
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Items Made</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_items_prepared}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20"
          >
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <Timer className="h-4 w-4" />
              <span className="text-xs font-medium">Avg Time</span>
            </div>
            <p className="text-2xl font-bold">{stats.avg_prep_time_minutes || 0}<span className="text-sm font-normal ml-1">min</span></p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
          >
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Fastest</span>
            </div>
            <p className="text-2xl font-bold">{stats.fastest_order_minutes || 0}<span className="text-sm font-normal ml-1">min</span></p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20"
          >
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Slowest</span>
            </div>
            <p className="text-2xl font-bold">{stats.slowest_order_minutes || 0}<span className="text-sm font-normal ml-1">min</span></p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Revenue</span>
            </div>
            <p className="text-xl font-bold">Rs.{Number(stats.total_revenue || 0).toLocaleString()}</p>
          </motion.div>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        >
          <History className="h-16 w-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">No completed orders</p>
          <p className="text-sm">Completed orders will appear here</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-green-500/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Order Number & Status */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-[56px] h-12 px-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex flex-col items-center justify-center text-white shadow-lg">
                      <span className="text-[8px] text-white/80">ORD</span>
                      <span className="text-xs font-bold">#{order.order_number}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                        <OrderTypeBadge type={order.order_type} tableNumber={order.table_number} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {order.customer_name}
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <Package className="h-3 w-3" />
                        {order.total_items} items
                      </p>
                    </div>
                  </div>

                  {/* Prep Time & Timestamps */}
                  <div className="flex-1 flex flex-wrap items-center gap-3 sm:justify-end">
                    {order.prep_time_minutes !== null && (
                      <div className={cn(
                        'px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-1.5',
                        order.prep_time_minutes <= 10
                          ? 'bg-green-500/10 text-green-600'
                          : order.prep_time_minutes <= 20
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : 'bg-red-500/10 text-red-600'
                      )}>
                        <Timer className="h-3.5 w-3.5" />
                        {order.prep_time_minutes} min
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.kitchen_completed_at && new Date(order.kitchen_completed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="font-bold text-green-600">
                      Rs.{Number(order.total).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.items?.slice(0, 4).map((item: any, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium"
                    >
                      {item.quantity}x {item.name}
                    </span>
                  ))}
                  {order.items?.length > 4 && (
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-muted-foreground">
                      +{order.items.length - 4} more
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Enhanced Stats Card Component with animated lava gradients
function StatsCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  delay = 0,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  subtitle?: string;
  delay?: number;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative overflow-hidden bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-bebas tracking-widest text-black/40 uppercase leading-none">
            {title}
          </p>
          <p className="text-4xl font-bebas text-black leading-none tabular-nums">
            {value}
          </p>
        </div>
        <div className="p-2 bg-black text-[#FFD200] border-2 border-black">
          {icon}
        </div>
      </div>
      {subtitle && (
        <p className="text-[10px] font-source-sans font-black text-black/40 mt-3 uppercase tracking-tighter">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

// Main Kitchen Client Component (SSR-enabled)
export default function KitchenClient({ initialOrders, initialStats }: KitchenClientProps) {
  // Initialize state with SSR data
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [stats, setStats] = useState<KitchenStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState(false); // Start with false since we have SSR data
  const [viewMode, setViewMode] = useState<'cards' | 'kds' | 'completed'>('kds');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrderCountRef = useRef(initialOrders.filter(o => o.status === 'confirmed').length);

  // FIX #19: Removed dynamic CSS injection - styles now in globals.css

  const playNotificationSound = () => {
    try {
      // Create audio element if not exists
      if (!audioRef.current) {
        audioRef.current = new Audio('/notification.mp3');
      }
      audioRef.current.play().catch(() => {
        // Fallback: Use Web Audio API for a simple beep
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
      });
    } catch (e) {

    }
  };

  // Fetch orders using authenticated API route (never anon)
  const fetchOrders = useCallback(async () => {
    try {
      const result = await kitchenGET();
      if (result.success) {
        if (result.orders) setOrders(result.orders);
        if (result.stats) setStats(result.stats);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch kitchen orders');
    } finally {
      setIsLoading(false);
    }
  }, []);  // no deps — stable function reference

  // Real-time subscription via shared ORDERS channel (deduplicated across portal)
  useEffect(() => {
    const soundEnabledRef = soundEnabled; // capture for closure
    const callback = (payload?: any) => {
      fetchOrders();

      // Play sound for new orders
      if (payload?.eventType === 'INSERT' && soundEnabledRef) {
        playNotificationSound();
        toast.info('New order received!', {
          icon: <Bell className="h-4 w-4" />,
        });
      }
    };

    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      callback
    );

    return () => {
      unsubscribe();
    };
  }, [fetchOrders, soundEnabled]);

  // Check for new orders and play sound
  useEffect(() => {
    const confirmedCount = orders.filter(o => o.status === 'confirmed').length;
    if (confirmedCount > prevOrderCountRef.current && soundEnabled && prevOrderCountRef.current > 0) {
      playNotificationSound();
    }
    prevOrderCountRef.current = confirmedCount;
  }, [orders, soundEnabled]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update - immediately update the UI
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId
          ? { ...order, status: newStatus as KitchenOrder['status'] }
          : order
      )
    );

    // Also update stats optimistically
    setStats(prevStats => {
      if (!prevStats) return prevStats;
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return prevStats;

      const oldStatus = currentOrder.status;
      return {
        ...prevStats,
        [`${oldStatus}_count`]: Math.max(0, (prevStats as any)[`${oldStatus}_count`] - 1),
        [`${newStatus}_count`]: ((prevStats as any)[`${newStatus}_count`] || 0) + 1,
      };
    });

    try {
      const result = await kitchenPOST({ action: 'update_status', orderId, status: newStatus });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        newStatus === 'preparing' ? '🔥 Cooking started!' :
          newStatus === 'ready' ? '✅ Order ready!' :
            'Status updated!',
        { duration: 1500 }
      );
    } catch (error: any) {
      // Revert optimistic update on error
      fetchOrders();
      toast.error(error.message || 'Failed to update order');
    }
  };

  const handleViewDetails = (order: KitchenOrder) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const filteredOrders = orders.filter((order) =>
    statusFilter === 'all' || order.status === statusFilter
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <SectionHeader
        title="Kitchen Display"
        description={`Real-time order queue • ${orders.length} active orders`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'h-10 w-10 rounded-none border-2 border-black transition-all',
                soundEnabled ? 'bg-[#FFD200] text-black' : 'bg-black text-[#FFD200]'
              )}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            <Button
              onClick={fetchOrders}
              className="h-10 rounded-none border-2 border-black bg-black text-[#FFD200] font-bebas tracking-widest hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              REFRESH
            </Button>
          </div>
        }
      />

      {/* Enhanced Stats Grid - Animated Lava Gradient Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatsCard
          title="New Orders"
          value={stats?.confirmed_count || 0}
          icon={<Bell className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
          subtitle="Waiting to start"
          delay={0}
        />
        <StatsCard
          title="In Kitchen"
          value={stats?.preparing_count || 0}
          icon={<Flame className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
          subtitle="Being prepared"
          delay={0.5}
        />
        <StatsCard
          title="Ready"
          value={stats?.ready_count || 0}
          icon={<CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
          subtitle="For pickup/delivery"
          delay={1}
        />
        <StatsCard
          title="Avg. Prep Time"
          value={stats?.avg_prep_time_mins ? `${stats.avg_prep_time_mins}` : '0'}
          icon={<Timer className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
          subtitle="Minutes today"
          delay={1.5}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 items-stretch sm:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9 sm:h-10">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">New</SelectItem>
            <SelectItem value="preparing">Cooking</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="kds" className="gap-1.5 text-xs sm:text-sm">
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              KDS
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-1.5 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Done
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Orders Display */}
      {viewMode === 'completed' ? (
        <CompletedOrdersTab />
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <ChefHat className="h-12 w-12 text-muted-foreground" />
          </motion.div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 text-muted-foreground"
        >
          <Sparkles className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No orders in queue</p>
          <p className="text-sm">New orders will appear here instantly</p>
        </motion.div>
      ) : viewMode === 'kds' ? (
        <KDSColumnView
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          onViewDetails={handleViewDetails}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
                onViewDetails={handleViewDetails}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
