'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatsCard, SectionHeader, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth, useRealtimeOrders, useRealtimeTables } from '@/hooks/usePortal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedClient } from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import type {
  DashboardStats,
  HourlySales,
  HourlySalesAdvanced,
  RestaurantTable,
  PortalOrder,
  BillingStats,
  BillingStatsServer,
  WaiterDashboardStats,
  RiderDashboardStats,
} from '@/lib/server-queries';

// Date range type
type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
  preset: DateRangePreset;
}

// Helper to get date ranges
function getDateRange(preset: DateRangePreset): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
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

// Date Range Picker Component - Uses router for SSR navigation
function DateRangePicker({ 
  currentPreset,
  currentDateRange
}: { 
  currentPreset: string;
  currentDateRange: { startDate: string; endDate: string };
}) {
  const router = useRouter();
  const [customStart, setCustomStart] = useState(currentDateRange.startDate);
  const [customEnd, setCustomEnd] = useState(currentDateRange.endDate);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const presets: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setIsCustomOpen(true);
      return;
    }
    // Navigate with URL params - triggers SSR refetch
    const url = preset === 'today' ? '/portal' : `/portal?preset=${preset}`;
    router.push(url);
  };

  const handleCustomApply = () => {
    router.push(`/portal?startDate=${customStart}&endDate=${customEnd}&preset=custom`);
    setIsCustomOpen(false);
  };

  const getDisplayText = () => {
    if (currentPreset === 'custom') {
      return `${currentDateRange.startDate} - ${currentDateRange.endDate}`;
    }
    return presets.find(p => p.value === currentPreset)?.label || 'Today';
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">{getDisplayText()}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {presets.filter(p => p.value !== 'custom').map((preset) => (
                <Button
                  key={preset.value}
                  variant={currentPreset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handlePresetChange(preset.value);
                    setIsCustomOpen(false);
                  }}
                >
                  {preset.label}
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
                className="w-full mt-3" 
                size="sm"
                onClick={handleCustomApply}
              >
                Apply Custom Range
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Props interface for server-provided data
interface DashboardClientProps {
  initialStats: DashboardStats | null;
  initialHourlySales: HourlySalesAdvanced | null;
  initialTables: RestaurantTable[];
  initialOrders: PortalOrder[];
  initialBillingStats: BillingStatsServer | null;
  initialPendingBillingOrders: { orders: any[]; pendingCount: number; onlineOrdersCount: number };
  initialWaiterStats: WaiterDashboardStats | null;
  initialRiderStats: RiderDashboardStats | null;
  currentPreset: string;
  currentDateRange: { startDate: string; endDate: string };
}

// Advanced Sales Chart with beautiful visualization
function SalesChart({ 
  data, 
  summary, 
  comparison,
  isDaily = false
}: { 
  data: (HourlySales & { date?: string })[]; 
  summary?: HourlySalesAdvanced['summary'] & { best_day?: string };
  comparison?: HourlySalesAdvanced['comparison'] & { previous_period_sales?: number; previous_period_orders?: number };
  isDaily?: boolean;
}) {
  const maxSales = Math.max(...data.map(d => d.sales), 1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'bar' | 'area'>('bar');
  const shouldReduceMotion = useReducedMotion();
  
  // Format date for display
  const formatDateLabel = (dateStr: string, short = false) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (short) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  // Get label for bar/chart
  const getItemLabel = (item: typeof data[0], index: number) => {
    if (isDaily && item.date) {
      return formatDateLabel(item.date, data.length > 14);
    }
    return item.hour_label || `${item.hour}:00`;
  };
  
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
  
  // Find best performing day
  const bestDayIndex = isDaily ? data.reduce((best, item, i) => 
    item.sales > (data[best]?.sales || 0) ? i : best, 0
  ) : -1;
  
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
              
              {/* Peak Hour / Best Day Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Flame className="h-4 w-4 text-orange-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {isDaily ? 'Best Day' : 'Peak Hour'}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {isDaily 
                    ? (summary.best_day ? formatDateLabel(summary.best_day, true) : 'N/A')
                    : (summary.peak_hour_label || 'N/A')
                  }
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {isDaily 
                    ? `Best: Rs. ${data[bestDayIndex]?.sales?.toLocaleString() || 0}`
                    : `Rs. ${summary.peak_sales?.toLocaleString() || 0}`
                  }
                </p>
              </motion.div>
              
              {/* Busiest Period / Period Stats Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-xl p-3 sm:p-4"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Zap className="h-4 w-4 text-purple-500 mb-1" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {isDaily ? 'Days in Period' : 'Busiest Period'}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {isDaily ? `${data.length} days` : (summary.busiest_period || 'N/A')}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {isDaily 
                    ? `Avg/day: Rs. ${Math.round((summary.total_sales || 0) / (data.length || 1)).toLocaleString()}`
                    : `Now: ${summary.current_hour !== undefined ? 
                        (summary.current_hour === 0 ? '12 AM' : 
                         summary.current_hour < 12 ? `${summary.current_hour} AM` : 
                         summary.current_hour === 12 ? '12 PM' : 
                         `${summary.current_hour - 12} PM`) : 'N/A'}`
                  }
                </p>
              </motion.div>
            </div>
            
            {/* Comparison Row */}
            {comparison && !isDaily && (comparison.yesterday_same_hour > 0 || comparison.last_week_same_day > 0) && (
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
                          <span className="font-bold text-sm">
                            {isDaily 
                              ? formatDateLabel(item.date, false)
                              : (item.hour_label || `${item.hour}:00`)
                            }
                          </span>
                          <div className="flex gap-1">
                            {isCurrentHour && !isDaily && (
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
                                {isDaily ? 'Best' : 'Peak'}
                              </Badge>
                            )}
                            {isDaily && index === bestDayIndex && !isPeak && (
                              <Badge className="bg-orange-500 text-[10px] px-1.5 py-0 h-5">
                                <Flame className="h-2.5 w-2.5 mr-0.5" />
                                Best
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!isDaily && (
                          <Badge variant="outline" className={cn('text-[10px] mt-1', timePeriod.color)}>
                            {timePeriod.label}
                          </Badge>
                        )}
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
                              <span className="text-muted-foreground">
                                {isDaily ? 'Share of period' : 'Share of daily sales'}
                              </span>
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
            {isDaily ? (
              // Show date labels for daily data
              data.length > 0 ? (
                <>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                    {formatDateLabel(data[0]?.date, true)}
                  </span>
                  {data.length > 4 && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {formatDateLabel(data[Math.floor(data.length / 2)]?.date, true)}
                    </span>
                  )}
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                    {formatDateLabel(data[data.length - 1]?.date, true)}
                  </span>
                </>
              ) : null
            ) : (
              ['12A', '6A', '12P', '6P', '11P'].map((label, i) => (
                <span key={i} className="text-[9px] sm:text-[10px] text-muted-foreground">{label}</span>
              ))
            )}
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
function RecentOrders({ orders }: { orders: PortalOrder[] }) {
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
function TablesOverview({ tables }: { tables: RestaurantTable[] }) {
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

// Admin Dashboard with SSR data and Date Filter
function AdminDashboard({ 
  initialStats, 
  initialHourlySales, 
  initialTables, 
  initialOrders,
  currentPreset,
  currentDateRange
}: {
  initialStats: DashboardStats | null;
  initialHourlySales: HourlySalesAdvanced | null;
  initialTables: RestaurantTable[];
  initialOrders: PortalOrder[];
  currentPreset: string;
  currentDateRange: { startDate: string; endDate: string };
}) {
  // Use SSR data directly - no client-side fetching
  const stats = initialStats;
  const hourlySalesData = initialHourlySales;
  
  // Pass SSR data to hooks to prevent duplicate fetch
  const { orders: realtimeOrders, isLoading: ordersLoading } = useRealtimeOrders({ 
    limit: 10,
    initialOrders: initialOrders as any[]
  });
  const { tables: realtimeTables } = useRealtimeTables({ initialTables: initialTables as any[] });
  
  // Use real-time data if available, otherwise fall back to initial
  const orders = realtimeOrders.length > 0 ? realtimeOrders : initialOrders;
  const tables = realtimeTables.length > 0 ? realtimeTables : initialTables;

  // Extract data - SQL returns { type, data, summary, comparison }
  const isDaily = (hourlySalesData as any)?.type === 'daily';
  const hourlySales = (hourlySalesData as any)?.data || hourlySalesData?.hourly_data || [];
  const salesSummary = hourlySalesData?.summary;
  const comparison = hourlySalesData?.comparison;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Filter */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {currentPreset === 'today' ? 'Live data' : `${currentDateRange.startDate} to ${currentDateRange.endDate}`}
        </div>
        <DateRangePicker currentPreset={currentPreset} currentDateRange={currentDateRange} />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title={currentPreset === 'today' ? "Today's Sales" : "Total Sales"}
          value={`Rs. ${(currentPreset === 'today' ? stats?.total_sales_today : stats?.total_sales || stats?.total_sales_today || 0).toLocaleString()}`}
          change={currentPreset === 'today' ? "+12% from yesterday" : `${currentPreset === 'month' ? 'This month' : currentPreset === 'year' ? 'This year' : 'Selected period'}`}
          changeType="positive"
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title={currentPreset === 'today' ? "Today's Orders" : "Total Orders"}
          value={(currentPreset === 'today' ? stats?.total_orders_today : stats?.total_orders || stats?.total_orders_today || 0)}
          change={`${stats?.pending_orders || 0} pending now`}
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
              {isDaily ? 'Daily Sales Analytics' : "Today's Sales Analytics"}
            </CardTitle>
            <CardDescription>
              {isDaily ? 'Daily breakdown for selected period' : 'Real-time hourly breakdown with insights'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hourlySales.length > 0 ? (
              <SalesChart data={hourlySales} summary={salesSummary} comparison={comparison} isDaily={isDaily} />
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
            <TablesOverview tables={tables as any} />
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
            <DataTableWrapper isLoading={ordersLoading && initialOrders.length === 0} isEmpty={orders.length === 0}>
              <RecentOrders orders={orders as any} />
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
            {stats?.low_inventory_count && stats.low_inventory_count > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Low Inventory Alert
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.low_inventory_count} items below minimum stock
                </p>
              </div>
            )}
            {stats?.pending_orders && stats.pending_orders > 5 && (
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

// Waiter Dashboard with Date Filter
function WaiterDashboard({
  initialStats,
  currentPreset,
  currentDateRange,
}: {
  initialStats: WaiterDashboardStats | null;
  currentPreset: string;
  currentDateRange: { startDate: string; endDate: string };
}) {
  // Use SSR data directly — completely avoids the client-side RPC permission error.
  // When the waiter changes the date range, DateRangePicker calls router.push() which
  // triggers a full SSR reload, delivering fresh initialStats.
  const stats = {
    orders_count: initialStats?.orders_count ?? 0,
    orders_today: initialStats?.orders_today ?? 0,
    tips_total: initialStats?.tips_total ?? 0,
    tips_today: initialStats?.tips_today ?? 0,
    active_tables: initialStats?.active_tables ?? 0,
    total_sales: initialStats?.total_sales ?? 0,
  };

  const isToday = currentPreset === 'today';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Filter */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {isToday ? 'Live data' : `${currentDateRange.startDate} to ${currentDateRange.endDate}`}
        </div>
        <DateRangePicker currentPreset={currentPreset} currentDateRange={currentDateRange} />
      </div>
      
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title={isToday ? "Orders Today" : "Total Orders"}
          value={isToday ? stats.orders_today : stats.orders_count}
          change="Keep it up!"
          changeType="positive"
          icon={<ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title={isToday ? "Tips Today" : "Total Tips"}
          value={isToday ? `Rs. ${stats.tips_today.toLocaleString()}` : `Rs. ${stats.tips_total.toLocaleString()}`}
          change={isToday ? "Today's tips" : "Selected period"}
          changeType="positive"
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Active Tables"
          value={stats.active_tables}
          change="Assigned to you"
          changeType="neutral"
          icon={<LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Total Sales"
          value={`Rs. ${stats.total_sales.toLocaleString()}`}
          change="Your orders value"
          changeType="positive"
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/portal/orders/create">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <ShoppingBag className="h-6 w-6" />
                <span>New Order</span>
              </Button>
            </Link>
            <Link href="/portal/tables">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <LayoutGrid className="h-6 w-6" />
                <span>View Tables</span>
              </Button>
            </Link>
            <Link href="/portal/attendance">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Mark Attendance</span>
              </Button>
            </Link>
            <Link href="/portal/orders">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Activity className="h-6 w-6" />
                <span>My Orders</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Kitchen Dashboard
function KitchenDashboard() {
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchKitchenData = async () => {
      try {
        // Fetch kitchen orders (confirmed, preparing, ready)
        const { data, error } = await getAuthenticatedClient().rpc('get_kitchen_orders');
        
        if (data && !error) {
          const kitchenOrders = data || [];
          setOrders(kitchenOrders);
          setStats({
            pending: kitchenOrders.filter((o: any) => o.status === 'confirmed').length,
            preparing: kitchenOrders.filter((o: any) => o.status === 'preparing').length,
            ready: kitchenOrders.filter((o: any) => o.status === 'ready').length,
          });
        }
      } catch (err) {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchKitchenData();
    
    // Use shared ORDERS channel (deduplicated – no extra Postgres subscription)
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      fetchKitchenData
    );
    
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="New Orders"
          value={isLoading ? '...' : stats.pending}
          change="Waiting to start"
          changeType={stats.pending > 5 ? 'negative' : 'neutral'}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatsCard
          title="In Progress"
          value={isLoading ? '...' : stats.preparing}
          change="Currently cooking"
          changeType="neutral"
          icon={<Activity className="h-5 w-5" />}
        />
        <StatsCard
          title="Ready"
          value={isLoading ? '...' : stats.ready}
          change="For pickup/delivery"
          changeType="positive"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-orange-500" />
                Kitchen Queue
              </CardTitle>
              <CardDescription>Orders waiting to be prepared</CardDescription>
            </div>
            <Link href="/portal/kitchen">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <DataTableWrapper isLoading={isLoading} isEmpty={orders.length === 0} emptyMessage="No orders in queue">
            <div className="space-y-3">
              {orders.filter(o => o.status === 'confirmed').slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">#{order.order_number}</span>
                    <Badge variant="outline">{order.order_type}</Badge>
                  </div>
                  <div className="space-y-1">
                    {order.items?.slice(0, 3).map((item, i) => (
                      <p key={i} className="text-sm">
                        {item.quantity}x {item.name}
                      </p>
                    ))}
                    {order.items && order.items.length > 3 && (
                      <p className="text-sm text-muted-foreground">+{order.items.length - 3} more items</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href="/portal/kitchen" className="flex-1">
                      <Button size="sm" className="w-full">Start Cooking</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </DataTableWrapper>
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/portal/kitchen">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Utensils className="h-6 w-6" />
                <span>Kitchen View</span>
              </Button>
            </Link>
            <Link href="/portal/orders">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <ShoppingBag className="h-6 w-6" />
                <span>All Orders</span>
              </Button>
            </Link>
            <Link href="/portal/attendance">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Attendance</span>
              </Button>
            </Link>
            <Link href="/portal/inventory">
              <Button variant="outline" className="h-20 w-full flex-col gap-2">
                <Package className="h-6 w-6" />
                <span>Inventory</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Billing Staff Dashboard with SSR data
function BillingDashboard({
  initialBillingStats,
  initialPendingOrders
}: {
  initialBillingStats: BillingStatsServer | null;
  initialPendingOrders: { orders: PortalOrder[]; pendingCount: number; onlineOrdersCount: number };
}) {
  const { employee } = usePortalAuth();
  const router = useRouter();
  
  // Map server stats to display format
  const mapStats = (stats: BillingStatsServer | null) => {
    if (!stats) return {
      total_bills: 0,
      total_amount: 0,
      cash_amount: 0,
      card_amount: 0,
      online_amount: 0,
      pending_bills: 0,
    };
    return {
      total_bills: stats.today?.orders_count ?? 0,
      total_amount: stats.today?.total_revenue ?? 0,
      cash_amount: stats.today?.cash_revenue ?? stats.cash_today ?? 0,
      card_amount: stats.today?.card_revenue ?? stats.card_today ?? 0,
      online_amount: stats.today?.online_revenue ?? stats.online_today ?? 0,
      pending_bills: stats.pending_count ?? stats.pending_orders ?? 0,
    };
  };
  
  const [todayStats, setTodayStats] = useState(mapStats(initialBillingStats));
  const [pendingOrders, setPendingOrders] = useState(initialPendingOrders.orders || []);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

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

// Delivery Rider Dashboard with Date Filter
// Delivery Rider Dashboard — fully SSR, no client-side Supabase calls
function DeliveryDashboard({
  initialStats,
  currentPreset,
  currentDateRange,
}: {
  initialStats: RiderDashboardStats | null;
  currentPreset: string;
  currentDateRange: { startDate: string; endDate: string };
}) {
  const stats = {
    total_deliveries: initialStats?.total_deliveries ?? 0,
    total_deliveries_today: initialStats?.total_deliveries_today ?? 0,
    pending_deliveries: initialStats?.pending_deliveries ?? 0,
    completed: initialStats?.completed ?? 0,
    completed_today: initialStats?.completed_today ?? 0,
    total_tips: initialStats?.total_tips ?? 0,
    avg_delivery_time: initialStats?.avg_delivery_time ?? 25,
    total_earnings: initialStats?.total_earnings ?? 0,
  };

  const isToday = currentPreset === 'today';

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {isToday ? 'Live data' : `${currentDateRange.startDate} to ${currentDateRange.endDate}`}
        </div>
        <DateRangePicker currentPreset={currentPreset} currentDateRange={currentDateRange} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={isToday ? "Today's Deliveries" : "Total Deliveries"}
          value={isToday ? stats.total_deliveries_today : stats.total_deliveries}
          change={`${isToday ? stats.completed_today : stats.completed} completed`}
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
          title={isToday ? "Tips Today" : "Total Tips"}
          value={`Rs. ${stats.total_tips.toLocaleString()}`}
          change={isToday ? "Today's tips" : "Selected period"}
          changeType="positive"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg Time"
          value={`${stats.avg_delivery_time} min`}
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
          value={employee?.attendance_this_month !== undefined ? `${employee.attendance_this_month} days` : 'View attendance'}
          change={employee?.attendance_this_month !== undefined ? "Attendance" : "Track in attendance page"}
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

// Main Dashboard Client Component
export default function DashboardClient({
  initialStats,
  initialHourlySales,
  initialTables,
  initialOrders,
  initialBillingStats,
  initialPendingBillingOrders,
  initialWaiterStats,
  initialRiderStats,
  currentPreset,
  currentDateRange,
}: DashboardClientProps) {
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
          <AdminDashboard 
            initialStats={initialStats}
            initialHourlySales={initialHourlySales}
            initialTables={initialTables}
            initialOrders={initialOrders}
            currentPreset={currentPreset}
            currentDateRange={currentDateRange}
          />
        </>
      );
    case 'waiter':
      return (
        <>
          <SectionHeader
            title="My Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Waiter'}! Your performance and quick actions.`}
          />
          <WaiterDashboard
            initialStats={initialWaiterStats}
            currentPreset={currentPreset}
            currentDateRange={currentDateRange}
          />
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
          <BillingDashboard 
            initialBillingStats={initialBillingStats}
            initialPendingOrders={initialPendingBillingOrders}
          />
        </>
      );
    case 'delivery_rider':
      return (
        <>
          <SectionHeader
            title="Delivery Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Rider'}! Your deliveries and performance.`}
          />
          <DeliveryDashboard
            initialStats={initialRiderStats}
            currentPreset={currentPreset}
            currentDateRange={currentDateRange}
          />
        </>
      );
    default:
      // For 'other' or any unknown role
      return (
        <>
          <SectionHeader
            title="Dashboard"
            description={`${greeting}, ${employee?.name?.split(' ')[0] || 'Team Member'}! Welcome to ZOIRO Injected Broast Staff Portal.`}
          />
          <GenericDashboard />
        </>
      );
  }
}
