'use client';

import { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
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
  Trash2,
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
import { DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  refreshWaiterTablesAction,
  claimTableForWaiterAction,
  deleteRestaurantTableAction,
  updateTableStatusAction,
  releaseTableAction,
} from '@/lib/actions';

// Import modular components
import {
  STATUS_CONFIG,
  WaiterTableCardV2,
  AddTableDialog,
  WaiterHistory,
} from '@/components/portal/tables';
import { EditTableDialog } from '@/components/portal/tables/EditTableDialog';
import { TableOrderDetailsDialog } from '@/components/portal/tables/TableOrderDetailsDialog';

// Import WaiterTable and order history types
import type { WaiterTable, WaiterStats, OrderHistoryItem } from '@/components/portal/tables/types';

// Props interface for SSR data
interface TablesClientProps {
  initialTables: WaiterTable[];
  initialHistory?: OrderHistoryItem[];
  initialStats?: WaiterStats | null;
  initialHistoryCount?: number;
  initialHasMore?: boolean;
}

// ==========================================
// TABLES CLIENT COMPONENT
// Advanced waiter/admin table management
// Three-dot menu for all roles
// Edit/Delete for admin/manager only
// ==========================================

export default function TablesClient({
  initialTables,
  initialHistory = [],
  initialStats = null,
  initialHistoryCount = 0,
  initialHasMore = false,
}: TablesClientProps) {
  const router = useRouter();
  const { employee, role } = usePortalAuth();

  // Initialize with SSR data
  const safeInitialTables = Array.isArray(initialTables) ? initialTables : [];
  const [tables, setTables] = useState<WaiterTable[]>(safeInitialTables);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isWaiter = role === 'waiter' || role === 'admin' || role === 'manager';
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // Add Table
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);

  // Edit Table Dialog
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [tableForEdit, setTableForEdit] = useState<WaiterTable | null>(null);

  // Order Details Sheet
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [tableForOrder, setTableForOrder] = useState<WaiterTable | null>(null);

  // Delete Confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [tableIdToDelete, setTableIdToDelete] = useState<string | null>(null);
  const [tableNumberToDelete, setTableNumberToDelete] = useState<number | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  // Patch a single table in state without touching the others
  const patchTable = useCallback((id: string, updates: Partial<WaiterTable>) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Fetch ALL tables (only for INSERT / DELETE / manual refresh)
  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await refreshWaiterTablesAction();
      if (result.success && result.tables) {
        setTables(result.tables as WaiterTable[]);
      } else if (result.error) {
        console.error('Error refreshing tables:', result.error);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Realtime — ONE subscription for the lifetime of the component.
  // We use a ref to hold the latest handler so we never need to
  // teardown/re-open the channel when fetchTables / patchTable references
  // change across renders.
  // ---------------------------------------------------------------------------
  const realtimeHandlerRef = useRef<(payload?: any) => void>(() => {});

  // Keep the ref current without triggering a re-subscribe
  useEffect(() => {
    realtimeHandlerRef.current = (payload?: any) => {
      const eventType: string = payload?.eventType ?? '';
      if (eventType === 'UPDATE' && payload?.new?.id) {
        // Surgical single-card patch — no full refetch
        patchTable(payload.new.id, {
          status: payload.new.status,
          current_customers: payload.new.current_customers,
          current_order_id: payload.new.current_order_id,
          assigned_waiter_id: payload.new.assigned_waiter_id,
          updated_at: payload.new.updated_at,
        } as Partial<WaiterTable>);
      } else if (eventType === 'INSERT' || eventType === 'DELETE') {
        // Table added/removed — must resync count
        fetchTables();
      }
      // Unknown / null events ignored — no wasted round-trips
    };
  }); // No deps — runs after every render to stay current

  // Subscribe ONCE on mount, unsubscribe on unmount — stable wrapper
  useEffect(() => {
    const stableHandler = (payload?: any) => realtimeHandlerRef.current(payload);

    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.TABLES,
      'restaurant_tables',
      stableHandler,
      { event: '*' }
    );

    return unsubscribe; // Clean teardown, ref-counted inside manager
  }, []); // ← empty: subscribe once, never re-subscribe

  // Claim table — optimistic patch, then navigate to take-order page
  const handleClaimTable = async (tableId: string) => {
    try {
      const result = await claimTableForWaiterAction(tableId);
      if (!result.success) throw new Error(result.error || 'Failed to claim table');
      toast.success(`Table ${result.table_number} is now yours!`, {
        description: 'Taking you to the order page…',
      });
      patchTable(tableId, { status: 'occupied', is_my_table: true } as Partial<WaiterTable>);
      router.push(`/portal/tables/${tableId}/take-order`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim table');
    }
  };

  // Update table status — optimistic patch only
  const handleUpdateStatus = async (tableId: string, status: string) => {
    // Optimistically update the single card immediately
    patchTable(tableId, { status } as Partial<WaiterTable>);
    try {
      const result = await updateTableStatusAction(tableId, status);
      if (!result.success) {
        // Revert — do a full sync to get real state back
        fetchTables();
        throw new Error(result.error || 'Failed to update status');
      }
      toast.success(`Table status updated to ${status}`);
      // No fetchTables() — optimistic patch already applied above
    } catch (error: any) {
      toast.error(error.message || 'Failed to update table status');
    }
  };

  // Release table — optimistic patch, revert on error
  const handleReleaseTable = async (tableId: string, setToCleaning: boolean = false) => {
    const newStatus = setToCleaning ? 'cleaning' : 'available';
    patchTable(tableId, { status: newStatus, is_my_table: false, current_order_id: null } as Partial<WaiterTable>);
    try {
      const result = await releaseTableAction(tableId, setToCleaning);
      if (!result.success) {
        fetchTables(); // Revert
        throw new Error(result.error || 'Failed to release table');
      }
      toast.success(`Table released${setToCleaning ? ' and set to cleaning' : ''}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to release table');
    }
  };

  // Edit table (Admin/Manager only)
  const handleEditTable = (table: WaiterTable) => {
    if (!isAdminOrManager) return;
    setTableForEdit(table);
    setIsEditTableOpen(true);
  };

  // Delete table (Admin/Manager only)
  const handleDeleteTableClick = (tableId: string) => {
    if (!isAdminOrManager) return;
    const table = tables.find((t) => t.id === tableId);
    if (table?.status === 'occupied') {
      toast.error('Cannot delete an occupied table. Please complete the order first.');
      return;
    }
    setTableIdToDelete(tableId);
    setTableNumberToDelete(table?.table_number ?? null);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!tableIdToDelete) return;
    startDeleteTransition(async () => {
      const result = await deleteRestaurantTableAction(tableIdToDelete);
      if (result.success) {
        toast.success(`Table ${result.table_number} deleted. History preserved.`);
        setIsDeleteConfirmOpen(false);
        setTableIdToDelete(null);
        fetchTables();
      } else {
        toast.error(result.error || 'Failed to delete table');
      }
    });
  };

  // View Order Details
  const handleViewOrderDetails = (table: WaiterTable) => {
    setTableForOrder(table);
    setIsOrderDetailsOpen(true);
  };

  // Send to Billing (from three-dot) â€” opens order details sheet with "Send" primed
  const handleSendToBilling = (table: WaiterTable) => {
    setTableForOrder(table);
    setIsOrderDetailsOpen(true);
  };

  // Filter tables
  const safeTables = Array.isArray(tables) ? tables : [];
  const filteredTables = safeTables.filter(
    (table) => statusFilter === 'all' || table.status === statusFilter
  );
  const myTables = safeTables.filter((t) => t.is_my_table);
  const availableTables = tables.filter((t) => t.status === 'available');

  const stats = useMemo(() => ({
    total: tables.length,
    available: availableTables.length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    myTables: myTables.length,
  }), [tables, availableTables, myTables]);

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
              {isAdminOrManager
                ? 'Manage tables â€” tap â‹® on any table for options'
                : 'Tap available tables to start taking orders â€” tap â‹® for more options'}
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
            {/* All roles can add a table (waiter: simple add, admin: full options) */}
            <Button
              size="sm"
              className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white flex-1 sm:flex-none shadow-md"
              onClick={() => setIsAddTableOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Table</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 mb-4 sm:mb-6">
        {statsConfig.map((stat) => (
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
                    router.push(`/portal/tables/${t.id}/take-order`);
                  }}
                  onViewDetails={(t) => {
                    router.push(`/portal/tables/${t.id}/take-order`);
                  }}
                  onGenerateBill={(orderId) => {
                    router.push(`/portal/billing?order=${orderId}`);
                  }}
                  onEditTable={isAdminOrManager ? handleEditTable : undefined}
                  onDeleteTable={isAdminOrManager ? handleDeleteTableClick : undefined}
                  onUpdateStatus={handleUpdateStatus}
                  onReleaseTable={handleReleaseTable}
                  onViewOrderDetails={handleViewOrderDetails}
                  onSendToBilling={handleSendToBilling}
                  isWaiter={isWaiter}
                  isAdmin={isAdminOrManager}
                  userRole={role || 'waiter'}
                />
              ))}
            </div>
          </DataTableWrapper>

          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
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
          <WaiterHistory
            initialHistory={initialHistory}
            initialStats={initialStats}
            initialTotalCount={initialHistoryCount}
            initialHasMore={initialHasMore}
          />
        </TabsContent>
      </Tabs>

      {/* Add Table Dialog â€” all roles can add */}
      <AddTableDialog
        open={isAddTableOpen}
        onOpenChange={setIsAddTableOpen}
        onTableCreated={fetchTables}
      />

      {/* Edit Table Dialog â€” Admin/Manager only */}
      {isAdminOrManager && (
        <EditTableDialog
          table={tableForEdit}
          open={isEditTableOpen}
          onOpenChange={setIsEditTableOpen}
          onTableUpdated={fetchTables}
        />
      )}

      {/* Order Details Sheet â€” all roles */}
      <TableOrderDetailsDialog
        table={tableForOrder}
        open={isOrderDetailsOpen}
        onOpenChange={setIsOrderDetailsOpen}
        onGenerateBill={(orderId) => {
          setIsOrderDetailsOpen(false);
          router.push(`/portal/billing?order=${orderId}`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Table {tableNumberToDelete}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the table from the floor plan.{' '}
              <strong>All order history for this table is preserved</strong> in the database and
              can still be accessed from the Orders and Reports sections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeletePending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeletePending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"
                />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {isDeletePending ? 'Deleting...' : 'Delete Table'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
