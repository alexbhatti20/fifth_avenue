// Portal Dashboard - Server Component with SSR Data Fetching
// API calls happen on server - hidden from browser Network tab

import {
  getAdminDashboardStatsServer,
  getHourlySalesAdvancedServer,
  getTablesStatusServer,
  getRecentOrdersServer,
  getBillingStatsServer,
  getBillingPendingOrdersServer,
  getSSRCurrentEmployee,
  getWaiterDashboardStatsServer,
  getRiderDashboardStatsServer,
} from '@/lib/server-queries';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to get date range based on preset
function getDateRangeFromPreset(preset: string): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  switch (preset) {
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return { startDate: formatDate(weekAgo), endDate: formatDate(today) };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(monthStart), endDate: formatDate(today) };
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(yearStart), endDate: formatDate(today) };
    }
    default: // 'today'
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}

interface PageProps {
  searchParams: Promise<{ preset?: string; startDate?: string; endDate?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const VALID_PRESETS = ['today', 'yesterday', 'week', 'month', 'year'] as const;
  const rawPreset = params.preset || 'today';
  const preset = VALID_PRESETS.includes(rawPreset as (typeof VALID_PRESETS)[number]) ? rawPreset : 'today';
  
  // Get date range from preset or custom dates
  const dateRange = params.startDate && params.endDate
    ? { startDate: params.startDate, endDate: params.endDate }
    : getDateRangeFromPreset(preset);
  
  // For 'today' preset, don't pass dates (use optimized today-only RPCs)
  const useToday = preset === 'today';
  
  // Identify the current employee (cached — no extra DB round-trip if called again later)
  const currentEmployee = await getSSRCurrentEmployee();
  const empAny = currentEmployee as any;
  const isWaiter = empAny?.role === 'waiter';
  const isRider = empAny?.role === 'delivery_rider';

  // Fetch all dashboard data on the server (hidden from browser)
  const [
    stats,
    hourlySales,
    tables,
    orders,
    billingStats,
    pendingBillingOrders,
    waiterStats,
    riderStats,
  ] = await Promise.all([
    isWaiter || isRider
      ? Promise.resolve(null)
      : getAdminDashboardStatsServer(
          useToday ? undefined : dateRange.startDate,
          useToday ? undefined : dateRange.endDate
        ),
    isWaiter || isRider
      ? Promise.resolve(null)
      : getHourlySalesAdvancedServer(
          useToday ? undefined : dateRange.startDate,
          useToday ? undefined : dateRange.endDate
        ),
    isRider ? Promise.resolve([]) : getTablesStatusServer(),
    isRider ? Promise.resolve([]) : getRecentOrdersServer(10),
    getBillingStatsServer(),
    getBillingPendingOrdersServer(5),
    isWaiter && empAny?.id
      ? getWaiterDashboardStatsServer(empAny.id, dateRange.startDate, dateRange.endDate)
      : Promise.resolve(null),
    isRider && empAny?.id
      ? getRiderDashboardStatsServer(empAny.id, dateRange.startDate, dateRange.endDate)
      : Promise.resolve(null),
  ]);

  return (
    <DashboardClient
      initialStats={stats}
      initialHourlySales={hourlySales}
      initialTables={tables as any}
      initialOrders={orders as any}
      initialBillingStats={billingStats}
      initialPendingBillingOrders={pendingBillingOrders}
      initialWaiterStats={waiterStats}
      initialRiderStats={riderStats}
      currentPreset={preset}
      currentDateRange={dateRange}
    />
  );
}
