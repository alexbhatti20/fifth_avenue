'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
  Activity,
  Receipt,
  Truck,
  MapPin,
  CheckCircle2,
  Timer,
  Utensils,
  Calendar,
  Star,
  BadgeCheck,
  Wallet,
  Package,
  Flame,
  TrendingDown,
  Wifi,
  Store,
  Zap,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatsCard, SectionHeader, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth, useAdminDashboard, useRealtimeOrders, useRealtimeTables } from '@/hooks/usePortal';
import { getSalesAnalytics, getHourlySalesToday, getHourlySalesAdvanced, type HourlySalesAdvanced } from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import type { SalesAnalytics, HourlySales, Order } from '@/types/portal';

// Advanced Sales Chart with beautiful visualization
function SalesChart({ 
  data, 
  summary, 
  comparison 
}: { 
  data: HourlySales[]; 
  summary?: HourlySalesAdvanced['summary'];
  comparison?: HourlySalesAdvanced['comparison'];
}) {
  const maxSales = Math.max(...data.map(d => d.sales), 1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'bar' | 'area'>('bar');
  
  // Calculate gradient points for area chart
  const getAreaPath = () => {
    const width = 100 / data.length;
    const points = data.map((item, i) => {
      const x = (i * width) + (width / 2);
      const y = 100 - ((item.sales / maxSales) * 100);
      return `${x},${y}`;
    });
    return `M ${width / 2},100 L ${points.join(' L ')} L ${100 - width / 2},100 Z`;
  };
  
  // Get time period badges
  const getTimePeriodBadge = (hour: number) => {
    if (hour >= 6 && hour < 11) return { label: 'Morning', color: 'bg-amber-500/20 text-amber-600' };
    if (hour >= 11 && hour < 15) return { label: 'Lunch', color: 'bg-orange-500/20 text-orange-600' };
    if (hour >= 15 && hour < 18) return { label: 'Afternoon', color: 'bg-blue-500/20 text-blue-600' };
    if (hour >= 18 && hour < 22) return { label: 'Dinner', color: 'bg-purple-500/20 text-purple-600' };
    return { label: 'Off-Peak', color: 'bg-zinc-500/20 text-zinc-600' };
  };
  
  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-4">
        {/* Header with Summary Stats */}
        {summary && (
          <div className="space-y-4">
            {/* Main Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {/* Total Sales Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <DollarSign className="h-4 w-4 text-green-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Sales</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  Rs. {summary.total_sales?.toLocaleString() || 0}
                </p>
                {comparison && comparison.growth_vs_yesterday !== 0 && (
                  <div className={cn(
                    'flex items-center gap-1 mt-1 text-xs font-medium',
                    comparison.growth_vs_yesterday > 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {comparison.growth_vs_yesterday > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(comparison.growth_vs_yesterday).toFixed(1)}%
                  </div>
                )}
              </motion.div>
              
              {/* Total Orders Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <ShoppingBag className="h-4 w-4 text-blue-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Orders</p>
                <p className="text-lg sm:text-2xl font-bold">{summary.total_orders || 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  Avg: Rs. {summary.avg_order_value?.toLocaleString() || 0}
                </p>
              </motion.div>
              
              {/* Peak Hour Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Flame className="h-4 w-4 text-orange-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Peak Hour</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {summary.peak_hour_label || 'N/A'}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  Rs. {summary.peak_sales?.toLocaleString() || 0}
                </p>
              </motion.div>
              
              {/* Busiest Period Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Zap className="h-4 w-4 text-purple-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Busiest Period</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {summary.busiest_period || 'N/A'}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  Now: {summary.current_hour !== undefined ? 
                    (summary.current_hour === 0 ? '12 AM' : 
                     summary.current_hour < 12 ? `${summary.current_hour} AM` : 
                     summary.current_hour === 12 ? '12 PM' : 
                     `${summary.current_hour - 12} PM`) : 'N/A'}
                </p>
              </motion.div>
            </div>
            
            {/* Comparison Row */}
            {comparison && (comparison.yesterday_same_hour > 0 || comparison.last_week_same_day > 0) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-2 sm:gap-4 p-2 sm:p-3 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Yesterday (same time):</span>
                  <span className="font-semibold">Rs. {comparison.yesterday_same_hour?.toLocaleString() || 0}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-border" />
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Last week:</span>
                  <span className="font-semibold">Rs. {comparison.last_week_same_day?.toLocaleString() || 0}</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
        
        {/* Chart View Toggle */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Hourly breakdown</p>
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('bar')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'bar' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('area')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'area' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              <Activity className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        
        {/* Chart */}
        <div className="relative h-44 sm:h-56">
          {viewMode === 'area' ? (
            /* Area Chart View */
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.2" />
              ))}
              
              {/* Area fill */}
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                d={getAreaPath()}
                fill="url(#areaGradient)"
              />
              
              {/* Line */}
              <motion.polyline
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                points={data.map((item, i) => {
                  const width = 100 / data.length;
                  const x = (i * width) + (width / 2);
                  const y = 100 - ((item.sales / maxSales) * 100);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="0.5"
              />
              
              {/* Data points */}
              {data.map((item, i) => {
                const width = 100 / data.length;
                const x = (i * width) + (width / 2);
                const y = 100 - ((item.sales / maxSales) * 100);
                const isCurrentHour = item.is_current;
                const isPeak = item.is_peak;
                
                return (
                  <g key={i}>
                    {(isCurrentHour || isPeak || hoveredIndex === i) && (
                      <motion.circle
                        initial={{ r: 0 }}
                        animate={{ r: isCurrentHour || isPeak ? 1.5 : 1 }}
                        cx={x}
                        cy={y}
                        fill={isPeak ? '#f97316' : isCurrentHour ? 'hsl(var(--primary))' : 'hsl(var(--primary))'}
                        className="cursor-pointer"
                      />
                    )}
                    {/* Invisible larger hit area */}
                    <rect
                      x={x - width / 2}
                      y={0}
                      width={width}
                      height={100}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Bar Chart View */
            <div className="flex items-end gap-0.5 sm:gap-1 h-full">
              {data.map((item, index) => {
                const heightPercent = (item.sales / maxSales) * 100;
                const isCurrentHour = item.is_current;
                const isPeak = item.is_peak;
                const isHovered = hoveredIndex === index;
                const timePeriod = getTimePeriodBadge(item.hour);
                
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div
                        className="flex-1 flex flex-col items-center gap-1 cursor-pointer group h-full"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <div className="relative w-full h-full flex items-end justify-center">
                          {/* Peak indicator */}
                          {isPeak && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute -top-6 left-1/2 -translate-x-1/2 z-10"
                            >
                              <div className="relative">
                                <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 drop-shadow-lg" />
                                <motion.div
                                  animate={{ scale: [1, 1.3, 1] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                  className="absolute inset-0 bg-orange-500/30 rounded-full blur-sm -z-10"
                                />
                              </div>
                            </motion.div>
                          )}
                          
                          {/* Bar with gradient */}
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ 
                              height: `${Math.max(heightPercent, 2)}%`,
                              opacity: 1,
                            }}
                            transition={{ delay: index * 0.02, duration: 0.4, ease: "easeOut" }}
                            className={cn(
                              'w-full rounded-t-md min-h-[4px] transition-all duration-200 relative overflow-hidden',
                              isCurrentHour 
                                ? 'bg-gradient-to-t from-primary to-primary/70 shadow-lg shadow-primary/30 ring-2 ring-primary/50' 
                                : isPeak 
                                  ? 'bg-gradient-to-t from-orange-600 to-orange-400'
                                  : isHovered
                                    ? 'bg-gradient-to-t from-primary/90 to-primary/60'
                                    : 'bg-gradient-to-t from-primary/50 to-primary/30 group-hover:from-primary/70 group-hover:to-primary/50',
                            )}
                          >
                            {/* Shine effect */}
                            {(isCurrentHour || isPeak) && (
                              <motion.div
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                              />
                            )}
                          </motion.div>
                          
                          {/* Current hour pulse indicator */}
                          {isCurrentHour && (
                            <motion.div
                              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="absolute -bottom-1 w-2 h-2 bg-primary rounded-full"
                            />
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="p-0 overflow-hidden max-w-[220px]" sideOffset={8}>
                      {/* Tooltip Header */}
                      <div className={cn(
                        'px-3 py-2 border-b',
                        isCurrentHour ? 'bg-primary/10' : isPeak ? 'bg-orange-500/10' : 'bg-zinc-100 dark:bg-zinc-800'
                      )}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-sm">{item.hour_label || `${item.hour}:00`}</span>
                          <div className="flex gap-1">
                            {isCurrentHour && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                <motion.div
                                  animate={{ opacity: [1, 0.5, 1] }}
                                  transition={{ repeat: Infinity, duration: 1 }}
                                  className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"
                                />
                                Now
                              </Badge>
                            )}
                            {isPeak && (
                              <Badge className="bg-orange-500 text-[10px] px-1.5 py-0 h-5">
                                <Flame className="h-2.5 w-2.5 mr-0.5" />
                                Peak
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] mt-1', timePeriod.color)}>
                          {timePeriod.label}
                        </Badge>
                      </div>
                      
                      {/* Tooltip Content */}
                      <div className="px-3 py-2 space-y-2">
                        {/* Main Stats */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-500/10 rounded-md p-1.5">
                            <p className="text-[10px] text-muted-foreground">Sales</p>
                            <p className="text-xs font-bold text-green-600">Rs. {item.sales?.toLocaleString() || 0}</p>
                          </div>
                          <div className="bg-blue-500/10 rounded-md p-1.5">
                            <p className="text-[10px] text-muted-foreground">Orders</p>
                            <p className="text-xs font-bold text-blue-600">{item.orders || 0}</p>
                          </div>
                        </div>
                        
                        {item.avg_order_value !== undefined && item.avg_order_value > 0 && (
                          <div className="flex justify-between text-xs py-1 border-t">
                            <span className="text-muted-foreground">Avg Order</span>
                            <span className="font-semibold">Rs. {item.avg_order_value?.toLocaleString() || 0}</span>
                          </div>
                        )}
                        
                        {/* Order type breakdown */}
                        {(item.dine_in_sales || item.online_sales || item.walk_in_sales) && (
                          <div className="space-y-1.5 pt-1 border-t">
                            <p className="text-[10px] text-muted-foreground font-medium">By Order Type</p>
                            {item.dine_in_sales !== undefined && item.dine_in_sales > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs">
                                  <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
                                    <Utensils className="h-3 w-3 text-amber-600" />
                                  </div>
                                  Dine-in
                                </span>
                                <span className="text-xs font-medium">Rs. {item.dine_in_sales?.toLocaleString()}</span>
                              </div>
                            )}
                            {item.online_sales !== undefined && item.online_sales > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs">
                                  <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                                    <Wifi className="h-3 w-3 text-blue-600" />
                                  </div>
                                  Online
                                </span>
                                <span className="text-xs font-medium">Rs. {item.online_sales?.toLocaleString()}</span>
                              </div>
                            )}
                            {item.walk_in_sales !== undefined && item.walk_in_sales > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs">
                                  <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                                    <Store className="h-3 w-3 text-purple-600" />
                                  </div>
                                  Walk-in
                                </span>
                                <span className="text-xs font-medium">Rs. {item.walk_in_sales?.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Percentage bar */}
                        {item.percentage_of_day !== undefined && item.percentage_of_day > 0 && (
                          <div className="pt-1 border-t">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-muted-foreground">Share of daily sales</span>
                              <span className="font-semibold">{item.percentage_of_day.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percentage_of_day}%` }}
                                className={cn(
                                  'h-full rounded-full',
                                  isPeak ? 'bg-orange-500' : 'bg-primary'
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          
          {/* Hour labels - shown below chart */}
          <div className="absolute -bottom-5 left-0 right-0 flex justify-between px-1">
            {['12A', '6A', '12P', '6P', '11P'].map((label, i) => (
              <span key={i} className="text-[9px] sm:text-[10px] text-muted-foreground">{label}</span>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-4 mt-2 border-t text-xs">
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2.5 h-2.5 rounded-sm bg-primary shadow-sm shadow-primary/50"
            />
            <span className="text-muted-foreground">Current Hour</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-orange-600 to-orange-400" />
            <span className="text-muted-foreground">Peak Hour</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-primary/50 to-primary/30" />
            <span className="text-muted-foreground">Regular</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Recent Orders component
function RecentOrders({ orders }: { orders: Order[] }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500',
    confirmed: 'bg-blue-500/10 text-blue-500',
    preparing: 'bg-orange-500/10 text-orange-500',
    ready: 'bg-green-500/10 text-green-500',
    delivering: 'bg-purple-500/10 text-purple-500',
    delivered: 'bg-green-500/10 text-green-500',
    cancelled: 'bg-red-500/10 text-red-500',
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">#{order.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer_name} • {order.items.length} items
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge className={cn('capitalize', statusColors[order.status])}>
                {order.status}
              </Badge>
              <p className="text-sm font-semibold mt-1">
                Rs. {order.total.toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Tables Overview component
function TablesOverview({ tables }: { tables: any[] }) {
  const statusColors: Record<string, string> = {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    reserved: 'bg-yellow-500',
    cleaning: 'bg-blue-500',
    out_of_service: 'bg-zinc-500',
  };

  return (
    <div className="grid grid-cols-3 xs:grid-cols-4 gap-1.5 sm:gap-2">
      {tables.slice(0, 8).map((table) => (
        <motion.div
          key={table.id}
          whileHover={{ scale: 1.05 }}
          className={cn(
            'aspect-square rounded-lg flex flex-col items-center justify-center relative p-1',
            'bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent',
            table.status === 'occupied' && 'border-red-500/50',
            table.status === 'reserved' && 'border-yellow-500/50'
          )}
        >
          <span className="text-base sm:text-lg font-bold">{table.table_number}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">{table.capacity} seats</span>
          <div className={cn('absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full', statusColors[table.status])} />
        </motion.div>
      ))}
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const { stats, isLoading: statsLoading } = useAdminDashboard();
  const { orders, isLoading: ordersLoading } = useRealtimeOrders({ limit: 10 });
  const { tables } = useRealtimeTables();
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([]);
  const [salesSummary, setSalesSummary] = useState<HourlySalesAdvanced['summary'] | undefined>();
  const [comparison, setComparison] = useState<HourlySalesAdvanced['comparison'] | undefined>();

  useEffect(() => {
    // Try to get advanced data first
    getHourlySalesAdvanced().then(data => {
      if (data?.hourly_data) {
        setHourlySales(data.hourly_data);
        setSalesSummary(data.summary);
        setComparison(data.comparison);
      } else {
        // Fall back to simple data
        getHourlySalesToday().then(setHourlySales);
      }
    });
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title="Today's Sales"
          value={`Rs. ${(stats?.total_sales_today || 0).toLocaleString()}`}
          change="+12% from yesterday"
          changeType="positive"
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Today's Orders"
          value={stats?.total_orders_today || 0}
          change={`${stats?.pending_orders || 0} pending`}
          changeType="neutral"
          icon={<ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Active Tables"
          value={`${stats?.active_tables || 0}/${stats?.total_tables || 0}`}
          change={`${Math.round(((stats?.active_tables || 0) / (stats?.total_tables || 1)) * 100)}% occupancy`}
          changeType="neutral"
          icon={<LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Present Today"
          value={`${stats?.present_today || 0}/${stats?.active_employees || 0}`}
          change="Staff attendance"
          changeType="neutral"
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      </div>

      {/* Charts & Orders Row */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Today's Sales Analytics
            </CardTitle>
            <CardDescription>Real-time hourly breakdown with insights</CardDescription>
          </CardHeader>
          <CardContent>
            {hourlySales.length > 0 ? (
              <SalesChart data={hourlySales} summary={salesSummary} comparison={comparison} />
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tables Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              Tables Status
            </CardTitle>
            <CardDescription>Live table occupancy</CardDescription>
          </CardHeader>
          <CardContent>
            <TablesOverview tables={tables} />
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {[
                { status: 'available', color: 'bg-green-500' },
                { status: 'occupied', color: 'bg-red-500' },
                { status: 'reserved', color: 'bg-yellow-500' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-1 text-xs">
                  <div className={cn('w-2 h-2 rounded-full', item.color)} />
                  <span className="capitalize">{item.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders & Alerts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Recent Orders
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Latest orders across all channels</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTableWrapper isLoading={ordersLoading} isEmpty={orders.length === 0}>
              <RecentOrders orders={orders} />
            </DataTableWrapper>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.low_inventory_count > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Low Inventory Alert
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.low_inventory_count} items below minimum stock
                </p>
              </div>
            )}
            {stats?.pending_orders > 5 && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  High Order Volume
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pending_orders} orders pending
                </p>
              </div>
            )}
            {(!stats?.low_inventory_count && (stats?.pending_orders || 0) <= 5) && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  All Systems Normal
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No critical alerts at this time
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Waiter Dashboard
function WaiterDashboard() {
  const { employee } = usePortalAuth();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title="Orders Today"
          value={employee?.total_orders_taken || 0}
          change="Keep it up!"
          changeType="positive"
          icon={<ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Tips Earned"
          value={`Rs. ${(employee?.total_tips || 0).toLocaleString()}`}
          change="Today's tips"
          changeType="positive"
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Active Tables"
          value="0"
          change="Assigned to you"
          changeType="neutral"
          icon={<LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Days Working"
          value={employee?.hired_date ? Math.floor((Date.now() - new Date(employee.hired_date).getTime()) / (1000 * 60 * 60 * 24)) : 0}
          change={`Since ${employee?.hired_date ? new Date(employee.hired_date).toLocaleDateString() : 'N/A'}`}
          changeType="neutral"
          icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <ShoppingBag className="h-6 w-6" />
              <span>New Order</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <LayoutGrid className="h-6 w-6" />
              <span>View Tables</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Clock className="h-6 w-6" />
              <span>Mark Attendance</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span>Exchange Table</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Kitchen Dashboard
function KitchenDashboard() {
  const { orders, isLoading } = useRealtimeOrders({ status: 'confirmed' });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Pending Orders"
          value={orders.filter(o => o.status === 'pending').length}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatsCard
          title="In Progress"
          value={orders.filter(o => o.status === 'preparing').length}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatsCard
          title="Ready for Pickup"
          value={orders.filter(o => o.status === 'ready').length}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kitchen Queue</CardTitle>
          <CardDescription>Orders waiting to be prepared</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTableWrapper isLoading={isLoading} isEmpty={orders.length === 0} emptyMessage="No orders in queue">
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">#{order.order_number}</span>
                    <Badge variant="outline">{order.order_type}</Badge>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-sm">
                        {item.quantity}x {item.name}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1">Start</Button>
                    <Button size="sm" variant="outline" className="flex-1">Ready</Button>
                  </div>
                </div>
              ))}
            </div>
          </DataTableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

// Billing Staff Dashboard
function BillingDashboard() {
  const { employee } = usePortalAuth();
  const router = useRouter();
  const [todayStats, setTodayStats] = useState({
    total_bills: 0,
    total_amount: 0,
    cash_amount: 0,
    card_amount: 0,
    online_amount: 0,
    pending_bills: 0,
  });
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    // Fetch billing stats
    const fetchStats = async () => {
      try {
        const { data } = await import('@/lib/supabase').then(m => m.createClient().rpc('get_billing_dashboard_stats'));
        if (data?.success) {
          setTodayStats({
            total_bills: data.total_bills_today || 0,
            total_amount: data.total_revenue_today || 0,
            cash_amount: data.cash_total || 0,
            card_amount: data.card_total || 0,
            online_amount: data.online_total || 0,
            pending_bills: data.pending_bills || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching billing stats:', err);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    // Fetch pending orders awaiting billing using RPC
    const fetchPendingOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const supabase = (await import('@/lib/supabase')).createClient();
        
        // Try new optimized RPC first
        const { data, error } = await supabase.rpc('get_billing_pending_orders', {
          p_limit: 5
        });
        
        if (!error && data?.success) {
          setPendingOrders(data.orders || []);
        } else {
          // Fallback to older RPC
          const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_billable_orders', {
            p_order_type: null,
            p_status_filter: 'pending_bill',
            p_limit: 5,
            p_offset: 0,
          });
          
          if (!fallbackError && fallbackData?.success) {
            setPendingOrders(fallbackData.orders || []);
          }
        }
      } catch (err) {
        console.error('Error fetching pending orders:', err);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    fetchPendingOrders();
  }, []);

  const handleGenerateBill = (orderId: string) => {
    router.push(`/portal/billing/${orderId}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Bills Today"
          value={todayStats.total_bills}
          change={`${todayStats.pending_bills} pending`}
          changeType="neutral"
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatsCard
          title="Today's Collection"
          value={`Rs. ${todayStats.total_amount.toLocaleString()}`}
          change="Total collected"
          changeType="positive"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Cash Payments"
          value={`Rs. ${todayStats.cash_amount.toLocaleString()}`}
          change="Cash transactions"
          changeType="neutral"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatsCard
          title="Digital Payments"
          value={`Rs. ${(todayStats.card_amount + todayStats.online_amount).toLocaleString()}`}
          change="Card + Online"
          changeType="neutral"
          icon={<BadgeCheck className="h-5 w-5" />}
        />
      </div>

      {/* Orders Awaiting Bill */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Orders Awaiting Bill
              </CardTitle>
              <CardDescription>Ready orders that need billing</CardDescription>
            </div>
            <Link href="/portal/billing">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>All orders have been billed!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-semibold">#{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name || 'Walk-in'} • {order.order_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-lg">Rs. {order.total?.toLocaleString()}</p>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
                        Awaiting Bill
                      </Badge>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleGenerateBill(order.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Receipt className="h-4 w-4 mr-1" />
                      Generate Bill
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
          <CardDescription>Frequently used billing operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/portal/billing">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Receipt className="h-6 w-6" />
                <span>Generate Bill</span>
              </Button>
            </Link>
            <Link href="/portal/orders">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <ShoppingBag className="h-6 w-6" />
                <span>View Orders</span>
              </Button>
            </Link>
            <Link href="/portal/tables">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <LayoutGrid className="h-6 w-6" />
                <span>Table Status</span>
              </Button>
            </Link>
            <Link href="/portal/attendance">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Attendance</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Cash</span>
              </div>
              <span className="font-semibold">Rs. {todayStats.cash_amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Card</span>
              </div>
              <span className="font-semibold">Rs. {todayStats.card_amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span>Online</span>
              </div>
              <span className="font-semibold">Rs. {todayStats.online_amount.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Delivery Rider Dashboard
function DeliveryDashboard() {
  const { employee } = usePortalAuth();
  const [stats, setStats] = useState({
    total_deliveries_today: 0,
    pending_deliveries: 0,
    completed_today: 0,
    total_tips: 0,
    avg_delivery_time: 0,
  });

  useEffect(() => {
    // Fetch delivery stats
    const fetchStats = async () => {
      try {
        const supabase = (await import('@/lib/supabase')).createClient();
        // Get today's deliveries for this rider
        const today = new Date().toISOString().split('T')[0];
        const { data: deliveries } = await supabase
          .from('delivery_history')
          .select('*')
          .eq('rider_id', employee?.id)
          .gte('created_at', today);
        
        if (deliveries) {
          setStats({
            total_deliveries_today: deliveries.length,
            pending_deliveries: deliveries.filter(d => d.status === 'assigned' || d.status === 'picked_up').length,
            completed_today: deliveries.filter(d => d.status === 'delivered').length,
            total_tips: deliveries.reduce((sum, d) => sum + (d.tip_amount || 0), 0),
            avg_delivery_time: 0, // Would calculate from actual data
          });
        }
      } catch (err) {
        console.error('Error fetching delivery stats:', err);
      }
    };
    if (employee?.id) fetchStats();
  }, [employee?.id]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Deliveries"
          value={stats.total_deliveries_today}
          change={`${stats.completed_today} completed`}
          changeType="positive"
          icon={<Truck className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending"
          value={stats.pending_deliveries}
          change="Ready for pickup"
          changeType="neutral"
          icon={<Package className="h-5 w-5" />}
        />
        <StatsCard
          title="Tips Earned"
          value={`Rs. ${stats.total_tips.toLocaleString()}`}
          change="Today's tips"
          changeType="positive"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg Time"
          value={`${stats.avg_delivery_time || 25} min`}
          change="Per delivery"
          changeType="neutral"
          icon={<Timer className="h-5 w-5" />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/portal/delivery">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Package className="h-6 w-6" />
                <span>My Deliveries</span>
              </Button>
            </Link>
            <Link href="/portal/orders?type=online">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <ShoppingBag className="h-6 w-6" />
                <span>Pickup Queue</span>
              </Button>
            </Link>
            <Link href="/portal/attendance">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Attendance</span>
              </Button>
            </Link>
            <Button variant="outline" className="h-20 flex-col gap-2" disabled>
              <MapPin className="h-6 w-6" />
              <span>Navigation</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Status */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Completed</span>
              </div>
              <span className="font-bold text-green-600">{stats.completed_today}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span>In Progress</span>
              </div>
              <span className="font-bold text-yellow-600">{stats.pending_deliveries}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Generic Staff Dashboard (for 'other' roles)
function GenericDashboard() {
  const { employee } = usePortalAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
              {employee?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{employee?.name || 'Staff Member'}</h2>
              <p className="text-muted-foreground capitalize">{employee?.role?.replace('_', ' ') || 'Team Member'}</p>
              <Badge variant="outline" className="mt-1">
                ID: {employee?.employee_id || 'N/A'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Days Working"
          value={employee?.hired_date ? Math.floor((Date.now() - new Date(employee.hired_date).getTime()) / (1000 * 60 * 60 * 24)) : 0}
          change={`Since ${employee?.hired_date ? new Date(employee.hired_date).toLocaleDateString() : 'N/A'}`}
          changeType="neutral"
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatsCard
          title="This Month"
          value={`${employee?.attendance_this_month || 0} days`}
          change="Attendance"
          changeType="neutral"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatsCard
          title="Performance"
          value="Good"
          change="Keep it up!"
          changeType="positive"
          icon={<Star className="h-5 w-5" />}
        />
        <StatsCard
          title="Status"
          value={employee?.status || 'Active'}
          change="Account status"
          changeType="neutral"
          icon={<BadgeCheck className="h-5 w-5" />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/portal/attendance">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Attendance</span>
              </Button>
            </Link>
            <Link href="/portal/settings">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Users className="h-6 w-6" />
                <span>My Profile</span>
              </Button>
            </Link>
            <Link href="/portal/notifications">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <AlertTriangle className="h-6 w-6" />
                <span>Notifications</span>
              </Button>
            </Link>
            <Link href="/portal/perks">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Star className="h-6 w-6" />
                <span>My Perks</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Dashboard Page
export default function DashboardPage() {
  const { role, employee, isLoading } = usePortalAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Render role-specific dashboard
  switch (role) {
    case 'admin':
    case 'manager':
      return (
        <>
          <SectionHeader
            title="Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Admin'}! Here's what's happening today.`}
          />
          <AdminDashboard />
        </>
      );
    case 'waiter':
      return (
        <>
          <SectionHeader
            title="My Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Waiter'}! Your performance and quick actions.`}
          />
          <WaiterDashboard />
        </>
      );
    case 'kitchen_staff':
      return (
        <>
          <SectionHeader
            title="Kitchen Dashboard"
            description={`${greeting}! Orders queue and kitchen status.`}
          />
          <KitchenDashboard />
        </>
      );
    case 'billing_staff':
      return (
        <>
          <SectionHeader
            title="Billing Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Cashier'}! Today's billing overview.`}
          />
          <BillingDashboard />
        </>
      );
    case 'delivery_rider':
      return (
        <>
          <SectionHeader
            title="Delivery Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Rider'}! Your deliveries and performance.`}
          />
          <DeliveryDashboard />
        </>
      );
    default:
      // For 'other' or any unknown role
      return (
        <>
          <SectionHeader
            title="Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Team Member'}! Welcome to ZOIRO Staff Portal.`}
          />
          <GenericDashboard />
        </>
      );
  }
}
