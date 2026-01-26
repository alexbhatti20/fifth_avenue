'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import modular components
import {
  STATUS_CONFIG,
  WaiterTableCard,
  TakeOrderDialog,
  WaiterHistory,
  type WaiterTable,
} from '@/components/portal/tables';

const supabase = createClient();

// ==========================================
// MAIN TABLES PAGE
// Advanced waiter table management
// ==========================================

export default function TablesPage() {
  const router = useRouter();
  const { employee, role } = usePortalAuth();
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<WaiterTable | null>(null);
  const [isTakeOrderOpen, setIsTakeOrderOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isWaiter = role === 'waiter' || role === 'admin' || role === 'manager';

  // Fetch tables
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
      
      // Direct fallback
      const { data } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');
      setTables(data || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        () => fetchTables()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  // Filter tables
  const filteredTables = tables.filter(
    (table) => statusFilter === 'all' || table.status === statusFilter
  );

  const myTables = tables.filter((t) => t.is_my_table);
  const availableTables = tables.filter((t) => t.status === 'available');

  const stats = {
    total: tables.length,
    available: availableTables.length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    myTables: myTables.length,
  };

  return (
    <>
      {/* Header with Gradient */}
      <div className="mb-4 sm:mb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                Tables Management
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {isWaiter
                  ? 'Click on available tables to start taking orders'
                  : 'Manage restaurant tables and track occupancy'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchTables} className="flex-1 sm:flex-none">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {(role === 'admin' || role === 'manager') && (
                <Button size="sm" className="bg-gradient-to-r from-red-500 to-orange-500 text-white flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Table</span>
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4 mb-4 sm:mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 border-2">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Tables</p>
                  <p className="text-xl sm:text-3xl font-bold">{stats.total}</p>
                </div>
                <LayoutGrid className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-600">Available</p>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-600">{stats.available}</p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 border-2 border-red-200 dark:border-red-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-red-600">Occupied</p>
                  <p className="text-xl sm:text-3xl font-bold text-red-600">{stats.occupied}</p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200 dark:border-amber-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-amber-600">My Tables</p>
                  <p className="text-xl sm:text-3xl font-bold text-amber-600">{stats.myTables}</p>
                </div>
                <Star className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
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
        <div className="flex-1" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tables" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 p-1">
          <TabsTrigger
            value="tables"
            className="flex-1 sm:flex-none data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
          >
            <LayoutGrid className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Tables</span>
          </TabsTrigger>
          <TabsTrigger
            value="my-orders"
            className="flex-1 sm:flex-none data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
          >
            <History className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">My Orders</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables">
          <DataTableWrapper isLoading={isLoading} isEmpty={filteredTables.length === 0}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <AnimatePresence>
                {filteredTables.map((table, index) => (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <WaiterTableCard
                      table={table}
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </DataTableWrapper>

          {/* Status Legend */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap gap-4 mt-6 p-4 rounded-xl bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900/50"
          >
            <span className="text-sm font-medium">Status:</span>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn('w-3 h-3 rounded-full', cfg.color.replace('text', 'bg'))} />
                <span className="text-sm text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="my-orders">
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
