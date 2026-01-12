'use client';

import { motion } from 'framer-motion';
import {
  Receipt,
  DollarSign,
  CreditCard,
  Banknote,
  TrendingUp,
  Clock,
  Utensils,
  ShoppingBag,
  User,
  Percent,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BillingStats } from './types';

// ==========================================
// ANIMATED STATS CARD
// ==========================================

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  delay?: number;
  trend?: 'up' | 'down' | null;
  subValue?: string;
  gradient?: string;
}

export function AnimatedStatsCard({
  title,
  value,
  icon,
  delay = 0,
  trend,
  subValue,
  gradient = 'linear-gradient(90deg, #C8102E, #dc2626, #ef4444, #C8102E)',
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="relative rounded-xl overflow-hidden"
      style={{
        padding: '2px',
        background: gradient,
        backgroundSize: '300% 300%',
        animation: 'gradientShift 4s ease infinite',
      }}
    >
      <div className="relative rounded-[10px] bg-white dark:bg-zinc-950 p-4 h-full">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        {trend && (
          <div className={cn(
            'absolute bottom-2 right-2 text-xs font-medium',
            trend === 'up' ? 'text-green-500' : 'text-red-500'
          )}>
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// BILLING DASHBOARD STATS
// ==========================================

interface BillingDashboardStatsProps {
  stats: BillingStats | null;
  isLoading: boolean;
}

export function BillingDashboardStats({ stats, isLoading }: BillingDashboardStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24 mb-2" />
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AnimatedStatsCard
        title="Today's Revenue"
        value={`Rs. ${stats.today.total_revenue.toLocaleString()}`}
        icon={<TrendingUp className="h-5 w-5 text-green-500" />}
        delay={0}
        subValue={`${stats.today.invoices_count} invoices`}
      />
      <AnimatedStatsCard
        title="Pending Orders"
        value={stats.pending_orders}
        icon={<Clock className="h-5 w-5 text-yellow-500" />}
        delay={0.1}
        subValue="Awaiting billing"
        gradient="linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)"
      />
      <AnimatedStatsCard
        title="Cash Received"
        value={`Rs. ${stats.today.cash_revenue.toLocaleString()}`}
        icon={<Banknote className="h-5 w-5 text-green-500" />}
        delay={0.2}
        gradient="linear-gradient(90deg, #22c55e, #4ade80, #22c55e)"
      />
      <AnimatedStatsCard
        title="Card/Online"
        value={`Rs. ${(stats.today.card_revenue + stats.today.online_revenue).toLocaleString()}`}
        icon={<CreditCard className="h-5 w-5 text-blue-500" />}
        delay={0.3}
        gradient="linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)"
      />
    </div>
  );
}

// ==========================================
// QUICK STATS ROW
// ==========================================

interface QuickStatsRowProps {
  stats: BillingStats | null;
}

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
        <CardContent className="p-3 flex items-center gap-2">
          <Utensils className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Dine-in</p>
            <p className="font-bold text-blue-700 dark:text-blue-300">{stats.today.dine_in_count}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900">
        <CardContent className="p-3 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-purple-500" />
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400">Online</p>
            <p className="font-bold text-purple-700 dark:text-purple-300">{stats.today.online_count}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
        <CardContent className="p-3 flex items-center gap-2">
          <User className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400">Walk-in</p>
            <p className="font-bold text-amber-700 dark:text-amber-300">{stats.today.walk_in_count}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
        <CardContent className="p-3 flex items-center gap-2">
          <Percent className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-xs text-green-600 dark:text-green-400">Discounts</p>
            <p className="font-bold text-green-700 dark:text-green-300">Rs. {stats.today.total_discount_given.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-900">
        <CardContent className="p-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-pink-500" />
          <div>
            <p className="text-xs text-pink-600 dark:text-pink-400">Tips</p>
            <p className="font-bold text-pink-700 dark:text-pink-300">Rs. {stats.today.total_tips.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-50 dark:bg-zinc-950/30 border-zinc-200 dark:border-zinc-800">
        <CardContent className="p-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-zinc-500" />
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Avg Bill</p>
            <p className="font-bold text-zinc-700 dark:text-zinc-300">Rs. {Math.round(stats.today.avg_invoice_value || 0).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// CSS Animation for gradient
if (typeof window !== 'undefined') {
  const styleId = 'billing-gradient-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(style);
  }
}
