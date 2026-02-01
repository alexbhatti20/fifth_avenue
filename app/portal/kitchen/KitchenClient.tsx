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
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
// FIX #18: Import shared timer for performance
import { useSharedTimer } from '@/lib/shared-timer';
import type { KitchenOrder, KitchenStats } from '@/lib/server-queries';
// Server Actions for hidden API calls
import {
  updateKitchenOrderStatusServer,
  fetchKitchenOrdersServer,
  fetchKitchenStatsServer,
} from '@/lib/actions';

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
        'font-mono text-sm font-bold px-2 py-1 rounded-md',
        isOverdue ? 'bg-red-500/20 text-red-500' : isWarning ? 'bg-yellow-500/20 text-yellow-600' : 'bg-green-500/20 text-green-600'
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
    <Badge variant="outline" className={cn('gap-1 font-medium', c.color)}>
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
      {/* Static Gradient Background */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 via-rose-500 to-orange-500 opacity-90"
      />
      
      {/* White Card Content */}
      <Card className="relative overflow-hidden bg-white dark:bg-zinc-900 m-1 rounded-xl shadow-lg">
        {/* Header - Clean White with Red Accents */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div 
                className="min-w-[48px] sm:min-w-[56px] h-10 sm:h-12 px-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex flex-col items-center justify-center text-white shadow-lg shadow-red-500/30"
              >
                <span className="text-[8px] sm:text-[9px] text-white/80 font-medium">ORD</span>
                <span className="text-[10px] sm:text-xs font-bold truncate max-w-full">#{order.order_number}</span>
              </div>
              <div>
                <div className={cn('flex items-center gap-2', status.color)}>
                  {status.icon}
                  <span className="font-semibold">{status.label}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Package className="h-3 w-3" />
                  {order.total_items || order.items?.length || 0} items
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
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors group/item"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-sm bg-gradient-to-br from-red-500 to-orange-500">
                  {item.quantity}x
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate group-hover/item:text-red-600 transition-colors">
                    {item.name}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-orange-600 flex items-center gap-1 truncate mt-0.5">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {item.notes}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
            {order.items?.length > 4 && (
              <motion.p 
                className="text-xs text-muted-foreground text-center py-1.5 bg-gray-50 dark:bg-zinc-800/50 rounded-lg"
                whileHover={{ scale: 1.02 }}
              >
                +{order.items.length - 4} more items
              </motion.p>
            )}
          </div>

          {/* Special Instructions */}
          {order.notes && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30"
            >
              <p className="text-xs font-bold text-orange-600 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> SPECIAL INSTRUCTIONS
              </p>
              <p className="text-sm font-medium">{order.notes}</p>
            </motion.div>
          )}

          {/* Table Details for Dine-in */}
          {order.order_type === 'dine-in' && order.table_details && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                    <Coffee className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-purple-700 dark:text-purple-400">Table {order.table_number}</span>
                    {order.table_details.section && (
                      <p className="text-xs text-muted-foreground">{order.table_details.section}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                    {order.table_details.current_customers}/{order.table_details.capacity}
                  </div>
                  {order.table_details.assigned_waiter && (
                    <p className="text-xs text-muted-foreground">
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
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/25"
                  onClick={() => onStatusChange(order.id, 'confirmed')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Order
                </Button>
              )}
              {order.status === 'confirmed' && (
                <Button
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/25"
                  onClick={() => onStatusChange(order.id, 'preparing')}
                >
                  <Flame className="h-4 w-4 mr-2" />
                  Start Cooking
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25"
                  onClick={() => onStatusChange(order.id, 'ready')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Ready
                </Button>
              )}
              {order.status === 'ready' && (
                <Button
                  variant="outline"
                  className="w-full text-green-600 border-green-500 bg-green-500/10"
                  disabled
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Ready!
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
      headerGradient: 'from-blue-500 via-indigo-500 to-blue-600',
      cardBorderGradient: ['#3b82f6', '#6366f1', '#4f46e5', '#3b82f6'],
      accentColor: 'bg-blue-500',
      nextStatus: 'preparing',
      nextAction: 'Start Cooking'
    },
    { 
      status: 'preparing', 
      title: 'Cooking', 
      icon: <Flame className="h-5 w-5" />,
      headerGradient: 'from-orange-500 via-red-500 to-orange-600',
      cardBorderGradient: ['#f97316', '#ef4444', '#ea580c', '#f97316'],
      accentColor: 'bg-orange-500',
      nextStatus: 'ready',
      nextAction: 'Mark Ready'
    },
    { 
      status: 'ready', 
      title: 'Ready', 
      icon: <CheckCircle className="h-5 w-5" />,
      headerGradient: 'from-green-500 via-emerald-500 to-green-600',
      cardBorderGradient: ['#22c55e', '#10b981', '#059669', '#22c55e'],
      accentColor: 'bg-green-500',
      nextStatus: null,
      nextAction: null
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 h-[calc(100vh-280px)]">
      {columns.map((col) => {
        const columnOrders = orders.filter((o) => o.status === col.status);
        
        return (
          <motion.div 
            key={col.status} 
            className="flex flex-col rounded-2xl overflow-hidden border-0 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Animated Column Header */}
            <motion.div 
              className={cn('px-4 py-4 flex items-center justify-between text-white bg-gradient-to-r', col.headerGradient)}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{ backgroundSize: '200% 200%' }}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: col.status === 'preparing' ? [0, 10, -10, 0] : 0 }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                >
                  {col.icon}
                </motion.div>
                <span className="font-bold text-lg">{col.title}</span>
              </div>
              <motion.div
                key={columnOrders.length}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="bg-white/25 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold"
              >
                {columnOrders.length}
              </motion.div>
            </motion.div>

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
                        className="relative group rounded-2xl p-[3px] overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${col.cardBorderGradient[0]}, ${col.cardBorderGradient[1]}, ${col.cardBorderGradient[2]})`,
                          backgroundSize: '200% 200%',
                          animation: 'gradientShift 3s ease infinite',
                        }}
                      >
                        {/* White Card Content */}
                        <div className="relative p-4 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <motion.div 
                                className={cn(
                                  'min-w-[48px] h-10 px-2 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md',
                                  col.accentColor
                                )}
                                whileHover={{ scale: 1.05 }}
                              >
                                <span className="truncate">#{order.order_number}</span>
                              </motion.div>
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
                            <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30">
                              <p className="text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span className="truncate">{order.notes}</span>
                              </p>
                            </div>
                          )}

                          {/* Table info for dine-in */}
                          {order.order_type === 'dine-in' && order.table_number && (
                            <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-purple-500 flex items-center justify-center">
                                  <Coffee className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                  Table {order.table_number}
                                </span>
                                {order.waiter && (
                                  <span className="text-xs text-muted-foreground ml-auto">
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
      whileHover={{ y: -4, scale: 1.02 }} 
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="h-full relative rounded-2xl p-[3px] overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #ef4444, #f97316, #f43f5e, #ea580c)',
        backgroundSize: '300% 300%',
        animation: `gradientShift 4s ease infinite ${delay}s`,
      }}
    >
      <Card className="overflow-hidden h-full border-0 shadow-lg bg-white dark:bg-zinc-900 rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <motion.div 
                key={String(value)}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex items-baseline gap-2"
              >
                <span className="text-4xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent tabular-nums">
                  {value}
                </span>
                {trend && (
                  <span className="text-sm font-medium text-orange-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {trend}
                  </span>
                )}
              </motion.div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <motion.div 
              className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-orange-500/30"
              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
              style={{
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite',
              }}
            >
              {icon}
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Main Kitchen Client Component (SSR-enabled)
export default function KitchenClient({ initialOrders, initialStats }: KitchenClientProps) {
  // Initialize state with SSR data
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [stats, setStats] = useState<KitchenStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState(false); // Start with false since we have SSR data
  const [viewMode, setViewMode] = useState<'cards' | 'kds'>('kds');
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

  // Fetch orders using Server Action (hidden from Network tab)
  const fetchOrders = useCallback(async () => {
    try {
      // Use Server Action instead of direct supabase call
      const result = await fetchKitchenOrdersServer();
      
      if (result.success && result.data) {
        setOrders(result.data);
      }
      
      // Fetch stats using Server Action
      const statsResult = await fetchKitchenStatsServer();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      } else {
        // Calculate stats from orders as fallback
        const currentOrders = orders;
        const confirmedCount = currentOrders.filter(o => o.status === 'confirmed').length;
        const preparingCount = currentOrders.filter(o => o.status === 'preparing').length;
        const readyCount = currentOrders.filter(o => o.status === 'ready').length;
        setStats({
          pending_count: 0,
          confirmed_count: confirmedCount,
          preparing_count: preparingCount,
          ready_count: readyCount,
          total_today: currentOrders.length,
          completed_today: 0,
          avg_prep_time_mins: null,
          orders_this_hour: 0,
        });
      }
    } catch (error) {
      
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('kitchen-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          
          fetchOrders();
          
          // Play sound for new orders
          if (payload.eventType === 'INSERT' && soundEnabled) {
            playNotificationSound();
            toast.info('New order received!', {
              icon: <Bell className="h-4 w-4" />,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      // Use Server Action instead of direct supabase call (hidden from Network tab)
      const result = await updateKitchenOrderStatusServer(orderId, newStatus);

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
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex-shrink-0">
                <ChefHat className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              Kitchen Display
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Real-time order queue • {orders.length} active orders
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn('h-8 w-8 sm:h-10 sm:w-10', !soundEnabled && 'text-muted-foreground')}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchOrders} className="h-8 sm:h-10">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid - Animated Lava Gradient Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
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
            <TabsTrigger value="kds" className="gap-2">
              <Zap className="h-4 w-4" />
              KDS View
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-2">
              <Package className="h-4 w-4" />
              Cards
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Orders Display */}
      {isLoading ? (
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
