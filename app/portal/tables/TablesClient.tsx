'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Plus,
  Users,
  RefreshCw,
  CheckCircle,
  History,
  Star,
  Sparkles,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { createClient } from '@/lib/supabase';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { cn, isNetworkError } from '@/lib/utils';
import { toast } from 'sonner';

// Import modular components
import {
  STATUS_CONFIG,
  WaiterTableCardV2,
  TakeOrderDialog,
  WaiterHistory,
} from '@/components/portal/tables';

// Import WaiterTable type from the component types to ensure compatibility
import type { WaiterTable } from '@/components/portal/tables/types';

const supabase = createClient();

// Props interface for SSR data
interface TablesClientProps {
  initialTables: WaiterTable[];
}

// ==========================================
// TABLES CLIENT COMPONENT
// Advanced waiter table management
// ==========================================

export default function TablesClient({ initialTables }: TablesClientProps) {
  const router = useRouter();
  const { employee, role } = usePortalAuth();
  // Initialize with SSR data - ensure array fallback with extra validation
  const safeInitialTables = Array.isArray(initialTables) ? initialTables : [];
  const [tables, setTables] = useState<WaiterTable[]>(safeInitialTables);
  const [isLoading, setIsLoading] = useState(false); // Start false since we have SSR data
  const [selectedTable, setSelectedTable] = useState<WaiterTable | null>(null);
  const [isTakeOrderOpen, setIsTakeOrderOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isWaiter = role === 'waiter' || role === 'admin' || role === 'manager';

  // Fetch tables (for refresh and real-time updates)
  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_tables_for_waiter');

      if (error) throw error;

      if (data?.success) {
        setTables(data.tables || []);
      } else {
        // Fallback to direct query
        const { data: tablesData } = await supabase
          .from('restaurant_tables')
          .select('*')
          .order('table_number');
        setTables(tablesData || []);
      }
    } catch (error) {
      if (isNetworkError(error)) {
        toast.error('Unable to connect. Please check your internet connection.');
      }
      // Direct fallback
      try {
        const { data } = await supabase
          .from('restaurant_tables')
          .select('*')
          .order('table_number');
        setTables(data || []);
      } catch {
        // Silent fallback failure
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up real-time subscription only (no initial fetch since we have SSR data)
  useEffect(() => {
    // Use deduplicated realtime subscription
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.TABLES,
      'restaurant_tables',
      fetchTables
    );

    return () => {
      unsubscribe();
    };
  }, [fetchTables]);

  // Claim table
  const handleClaimTable = async (tableId: string) => {
    try {
      const { data, error } = await supabase.rpc('claim_table_for_waiter', {
        p_table_id: tableId,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to claim table');
      }

      toast.success(`Table ${data.table_number} is now yours!`, {
        description: 'You can now take orders for this table',
      });

      // Open take order dialog
      const table = tables.find((t) => t.id === tableId);
      if (table) {
        setSelectedTable({ ...table, is_my_table: true });
        setIsTakeOrderOpen(true);
      }

      fetchTables();
    } catch (error: any) {
      
      toast.error(error.message || 'Failed to claim table');
    }
  };

  // Filter tables - with safe array check
  const safeTables = Array.isArray(tables) ? tables : [];
  const filteredTables = safeTables.filter(
    (table) => statusFilter === 'all' || table.status === statusFilter
  );

  const myTables = safeTables.filter((t) => t.is_my_table);
  const availableTables = tables.filter((t) => t.status === 'available');

  // Memoize stats for performance
  const stats = useMemo(() => ({
    total: tables.length,
    available: availableTables.length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    myTables: myTables.length,
  }), [tables, availableTables, myTables]);

  // Stats card configurations
  const statsConfig = [
    {
      key: 'total',
      label: 'Total Tables',
      value: stats.total,
      icon: LayoutGrid,
      gradient: 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900',
      border: 'border-slate-200 dark:border-slate-700',
      iconColor: 'text-slate-500',
      textColor: 'text-slate-700 dark:text-slate-200',
    },
    {
      key: 'available',
      label: 'Available',
      value: stats.available,
      icon: CheckCircle,
      gradient: 'from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      iconColor: 'text-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'occupied',
      label: 'Occupied',
      value: stats.occupied,
      icon: Users,
      gradient: 'from-rose-50 to-red-100 dark:from-rose-900/30 dark:to-red-900/20',
      border: 'border-rose-200 dark:border-rose-800',
      iconColor: 'text-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      key: 'myTables',
      label: 'My Tables',
      value: stats.myTables,
      icon: Star,
      gradient: 'from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              Tables Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isWaiter
                ? 'Tap available tables to start taking orders'
                : 'Manage tables and track occupancy'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchTables}
              disabled={isLoading}
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className={cn("h-4 w-4 sm:mr-2", isLoading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {(role === 'admin' || role === 'manager') && (
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white flex-1 sm:flex-none shadow-md"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Table</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 mb-4 sm:mb-6">
        {statsConfig.map((stat, index) => (
          <div key={stat.key}>
            <Card className={cn(
              'overflow-hidden border bg-gradient-to-br backdrop-blur-sm transition-shadow duration-200 hover:shadow-md',
              stat.gradient,
              stat.border
            )}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className={cn("text-2xl sm:text-3xl font-bold mt-0.5", stat.textColor)}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={cn(
                    "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center",
                    "bg-white/60 dark:bg-black/20 shadow-inner"
                  )}>
                    <stat.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", stat.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4 sm:mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <SelectItem key={status} value={status}>
                <span className="flex items-center gap-2">
                  <span className={cfg.color}>{cfg.icon}</span>
                  {cfg.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger
            value="tables"
            className="flex-1 sm:flex-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm px-3 sm:px-4 py-2"
          >
            <LayoutGrid className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Tables</span>
          </TabsTrigger>
          <TabsTrigger
            value="my-orders"
            className="flex-1 sm:flex-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm px-3 sm:px-4 py-2"
          >
            <History className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">My Orders</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="mt-4">
          <DataTableWrapper isLoading={isLoading} isEmpty={filteredTables.length === 0}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {filteredTables.map((table, index) => (
                  <WaiterTableCardV2
                    key={table.id}
                    table={table}
                    index={index}
                    onClaimTable={handleClaimTable}
                    onTakeOrder={(t) => {
                      setSelectedTable(t);
                      setIsTakeOrderOpen(true);
                    }}
                    onViewDetails={(t) => setSelectedTable(t)}
                    onGenerateBill={(orderId) => {
                      router.push(`/portal/billing?order=${orderId}`);
                    }}
                    isWaiter={isWaiter}
                  />
                ))}
            </div>
          </DataTableWrapper>

          {/* Status Legend - Minimal */}
          <div
            className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-700"
          >
            <span className="text-xs font-medium text-slate-500">Legend:</span>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn('w-2.5 h-2.5 rounded-full', cfg.color.replace('text', 'bg'))} />
                <span className="text-xs text-slate-500">{cfg.label}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-orders" className="mt-4">
          <WaiterHistory />
        </TabsContent>
      </Tabs>

      {/* Take Order Dialog */}
      <TakeOrderDialog
        table={selectedTable}
        open={isTakeOrderOpen}
        onOpenChange={setIsTakeOrderOpen}
        onOrderComplete={fetchTables}
      />
    </>
  );
}
