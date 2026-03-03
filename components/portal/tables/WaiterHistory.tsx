'use client';

import { useState, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  CheckCircle2,
  Banknote,
  CreditCard,
  Receipt,
  User,
  Phone,
  BadgeCheck,
  ShoppingBag,
  Star,
  Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DataTableWrapper } from '@/components/portal/PortalProvider';
import { refreshWaiterOrderHistoryAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import type { WaiterStats, OrderHistoryItem } from './types';

// =============================================
// WAITER HISTORY — ADVANCED (SSR-first)
// Shows only THIS waiter's orders — filtered server-side via RPC get_waiter_order_history
// Rich row: table, time/date, customer, items list, subtotal, tax, total, tip, payment
// =============================================

interface WaiterHistoryProps {
  initialHistory?: OrderHistoryItem[];
  initialStats?: WaiterStats | null;
  initialTotalCount?: number;
  initialHasMore?: boolean;
}

function fmt(n: number | undefined | null) {
  return (n ?? 0).toLocaleString();
}

function fullDatetime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-PK', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const PAYMENT_STYLE: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  card: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  online: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  preparing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

export function WaiterHistory({
  initialHistory = [],
  initialStats = null,
  initialTotalCount = 0,
  initialHasMore = false,
}: WaiterHistoryProps) {
  const [history, setHistory] = useState<OrderHistoryItem[]>(initialHistory);
  const [stats, setStats] = useState<WaiterStats | null>(initialStats);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const toggleExpand = (id: string) =>
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshWaiterOrderHistoryAction({ limit: 20, offset: 0 });
      if (result.success) {
        startTransition(() => {
          setHistory(result.history || []);
          setStats(result.stats || null);
          setTotalCount(result.total_count || 0);
          setHasMore(result.has_more || false);
        });
      }
    } catch (e) {
      console.error('Error refreshing waiter history:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refreshWaiterOrderHistoryAction({
        limit: 20,
        offset: history.length,
      });
      if (result.success) {
        startTransition(() => {
          setHistory((prev) => [...prev, ...(result.history || [])]);
          setHasMore(result.has_more || false);
        });
      }
    } catch (e) {
      console.error('Error loading more:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [hasMore, isRefreshing, history.length]);

  const statCards = [
    {
      label: "Today's Orders",
      value: stats?.orders_today ?? 0,
      icon: TrendingUp,
      gradient: 'from-red-500/10 to-orange-500/10 border-red-500/20',
      valueClass: 'bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent',
      prefix: '',
    },
    {
      label: "Today's Revenue",
      value: stats?.sales_today ?? 0,
      icon: DollarSign,
      gradient: 'from-emerald-500/10 to-green-500/10 border-emerald-500/20',
      valueClass: 'text-emerald-600',
      prefix: 'Rs. ',
    },
    {
      label: "Today's Tips",
      value: stats?.tips_today ?? 0,
      icon: Star,
      gradient: 'from-amber-500/10 to-yellow-500/10 border-amber-500/20',
      valueClass: 'text-amber-600',
      prefix: 'Rs. ',
    },
    {
      label: 'Guests Served',
      value: stats?.customers_today ?? 0,
      icon: Users,
      gradient: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20',
      valueClass: 'text-blue-600',
      prefix: '',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-red-500" />
            My Orders
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalCount > 0
              ? `Showing ${history.length} of ${totalCount} \u00b7 only your orders`
              : 'Only your orders are shown here'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className={cn('p-3 sm:p-4 rounded-xl border bg-gradient-to-br', s.gradient)}>
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-4 w-4 opacity-70 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{s.label}</span>
              </div>
              <p className={cn('text-2xl sm:text-3xl font-bold', s.valueClass)}>
                {s.prefix}{s.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly/lifetime badges */}
      {stats && (stats.total_orders || stats.total_sales) ? (
        <div className="flex gap-2 flex-wrap">
          {stats.total_orders != null && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              {stats.total_orders} total orders
            </Badge>
          )}
          {stats.total_sales != null && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Rs. {stats.total_sales.toLocaleString()} lifetime
            </Badge>
          )}
          {stats.orders_this_week != null && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {stats.orders_this_week} this week
            </Badge>
          )}
        </div>
      ) : null}

      {/* Order List */}
      <DataTableWrapper
        isLoading={false}
        isEmpty={history.length === 0}
        emptyMessage="No orders yet — place an order to see your history here"
      >
        <div className="space-y-3">
          <AnimatePresence>
            {history.map((order, index) => {
              const isExpanded = expandedOrders.has(order.id);
              const items: { name: string; quantity: number; unit_price?: number; total_price?: number }[] =
                Array.isArray(order.items) ? order.items : [];

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025, duration: 0.25 }}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      {/* ── Summary row (always visible) ── */}
                      <div
                        className="flex items-center justify-between gap-3 p-3 sm:p-4 cursor-pointer select-none"
                        onClick={() => toggleExpand(order.id)}
                      >
                        {/* Left */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {order.table_number}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm">#{order.order_number}</span>
                              {order.invoice_number && (
                                <span className="text-[10px] text-muted-foreground">· INV #{order.invoice_number}</span>
                              )}
                              {order.order_status && (
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize', STATUS_STYLE[order.order_status] ?? STATUS_STYLE.completed)}>
                                  {order.order_status}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              {order.is_registered_customer
                                ? <BadgeCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                                : <User className="h-3 w-3 shrink-0" />}
                              <span className="truncate max-w-[130px]">{order.customer_name || 'Walk-in Guest'}</span>
                              {order.customer_phone && (
                                <><span>·</span><Phone className="h-3 w-3 shrink-0" /><span>{order.customer_phone}</span></>
                              )}
                              {order.customer_count && order.customer_count > 1 && (
                                <><span>·</span><Users className="h-3 w-3 shrink-0" /><span>{order.customer_count} guests</span></>
                              )}
                            </div>
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              {fullDatetime(order.order_taken_at)}
                              <span className="opacity-60">({timeAgo(order.order_taken_at)})</span>
                            </p>
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-base sm:text-lg">Rs.&nbsp;{fmt(order.total)}</p>
                            {order.tip_amount > 0 && (
                              <p className="text-[10px] text-amber-600 font-medium">+Rs.&nbsp;{fmt(order.tip_amount)} tip</p>
                            )}
                            <div className="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                              {order.payment_method && (
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize flex items-center gap-0.5', PAYMENT_STYLE[order.payment_method] ?? PAYMENT_STYLE.cash)}>
                                  {order.payment_method === 'cash'
                                    ? <><Banknote className="h-2.5 w-2.5" />Cash</>
                                    : order.payment_method === 'card'
                                    ? <><CreditCard className="h-2.5 w-2.5" />Card</>
                                    : order.payment_method}
                                </span>
                              )}
                              {order.payment_status && (
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize',
                                  order.payment_status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700')}>
                                  {order.payment_status}
                                </span>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* ── Expanded breakdown ── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <Separator />
                            <div className="p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                              {/* Items */}
                              {items.length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Receipt className="h-3.5 w-3.5" />
                                    Order Items ({order.total_items})
                                  </p>
                                  <div className="space-y-1.5">
                                    {items.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-5 h-5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {item.quantity}
                                          </span>
                                          <span className="truncate">{item.name}</span>
                                        </div>
                                        <span className="font-medium shrink-0 ml-2">
                                          Rs.&nbsp;{fmt(item.total_price ?? (item.unit_price ? item.unit_price * item.quantity : undefined))}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">{order.total_items} item{order.total_items !== 1 ? 's' : ''} ordered</p>
                              )}

                              <Separator />

                              {/* Bill */}
                              <div className="space-y-1 text-sm">
                                {order.subtotal != null && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>Rs.&nbsp;{fmt(order.subtotal)}</span>
                                  </div>
                                )}
                                {order.tax != null && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Tax (5%)</span>
                                    <span>Rs.&nbsp;{fmt(order.tax)}</span>
                                  </div>
                                )}
                                {order.tip_amount > 0 && (
                                  <div className="flex justify-between text-amber-600">
                                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-current" />Tip</span>
                                    <span>Rs.&nbsp;{fmt(order.tip_amount)}</span>
                                  </div>
                                )}
                                <Separator />
                                <div className="flex justify-between font-bold text-base">
                                  <span>Total</span>
                                  <span className="text-red-600">Rs.&nbsp;{fmt(order.total)}</span>
                                </div>
                              </div>

                              {order.order_completed_at && (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  Completed at {fullDatetime(order.order_completed_at)}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {hasMore && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={handleLoadMore} disabled={isRefreshing}>
              {isRefreshing ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading&hellip;</>
              ) : (
                `Load More (${history.length} / ${totalCount})`
              )}
            </Button>
          </div>
        )}
      </DataTableWrapper>
    </div>
  );
}
