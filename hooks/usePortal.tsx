'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { useRouter } from 'next/navigation';
import type {
  Employee,
  EmployeeRole,
  DashboardStats,
  RestaurantTable,
  Order,
  OrderAdvanced,
  OrdersAdvancedResponse,
  OrdersStats,
  Notification,
  WaiterDashboard,
} from '@/types/portal';
import { hasPermission } from '@/types/portal';
import { clearPermissionsCache } from '@/lib/permissions';
import {
  getCurrentEmployee,
  getAdminDashboardStats,
  getTablesStatus,
  getOrders,
  getKitchenOrders,
  getMyNotifications,
  getWaiterDashboard,
  markNotificationsRead as markRead,
} from '@/lib/portal-queries';
// Server Actions for hidden API calls (no Network tab visibility)
import {
  fetchOrdersAdvancedServer,
  fetchOrdersStatsServer,
  updateOrderStatusQuickServer,
} from '@/lib/actions';

// =============================================
// PORTAL AUTH HOOK - Re-exported from context
// =============================================

// This hook now re-exports from the PortalProvider context
// to prevent duplicate API calls across components
export { usePortalAuthContext as usePortalAuth } from '@/components/portal/PortalProvider';
import { usePortalAuthContext } from '@/components/portal/PortalProvider';

// Legacy interface for type compatibility
export interface UsePortalAuthReturn {
  employee: Employee | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: EmployeeRole | null;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
  fastLogout: () => void;
  refreshEmployee: () => Promise<void>;
  isBlocked: boolean;
  blockReason: string | null;
}

// =============================================
// REALTIME DASHBOARD HOOK
// =============================================

interface UseDashboardOptions {
  initialStats?: DashboardStats | null;
}

interface UseDashboardReturn {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAdminDashboard(options?: UseDashboardOptions): UseDashboardReturn {
  // Use initial data from SSR if provided
  const [stats, setStats] = useState<DashboardStats | null>(options?.initialStats || null);
  const [isLoading, setIsLoading] = useState(!options?.initialStats);
  const [error, setError] = useState<Error | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await getAdminDashboardStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial load if we have SSR data
    if (!options?.initialStats) {
      loadStats();
    }

    // Listen to orders via shared ORDERS channel (deduplicated across all portal pages)
    const unsubOrders = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      loadStats
    );
    // Attendance + tables on a separate lightweight channel (only dashboard needs these)
    const unsubMeta = realtimeManager.subscribeMultiple(
      CHANNEL_NAMES.DASHBOARD_META,
      [
        { table: 'restaurant_tables' },
        { table: 'attendance' },
      ],
      loadStats
    );

    return () => {
      unsubOrders();
      unsubMeta();
    };
  }, [loadStats, options?.initialStats]);

  return { stats, isLoading, error, refresh: loadStats };
}

// =============================================
// REALTIME TABLES HOOK
// =============================================

interface UseTablesOptions {
  initialTables?: RestaurantTable[];
}

interface UseTablesReturn {
  tables: RestaurantTable[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRealtimeTables(options?: UseTablesOptions): UseTablesReturn {
  // Use initial data from SSR if provided
  const [tables, setTables] = useState<RestaurantTable[]>(options?.initialTables || []);
  const [isLoading, setIsLoading] = useState(!options?.initialTables?.length);
  const [error, setError] = useState<Error | null>(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await getTablesStatus();
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial load if we have SSR data
    if (!options?.initialTables?.length) {
      loadTables();
    }

    // Use deduplicated realtime subscription
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.TABLES,
      'restaurant_tables',
      loadTables
    );

    return () => {
      unsubscribe();
    };
  }, [loadTables, options?.initialTables?.length]);

  return { tables, isLoading, error, refresh: loadTables };
}

// =============================================
// REALTIME ORDERS HOOK
// =============================================

interface UseOrdersOptions {
  status?: string;
  orderType?: string;
  limit?: number;
  // SSR Support
  initialOrders?: Order[];
}

interface UseOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRealtimeOrders(filters?: UseOrdersOptions): UseOrdersReturn {
  // Use initial data from SSR if provided
  const [orders, setOrders] = useState<Order[]>(filters?.initialOrders || []);
  const [isLoading, setIsLoading] = useState(!filters?.initialOrders?.length);
  const [error, setError] = useState<Error | null>(null);
  
  // Memoize filter values to prevent infinite re-renders
  const status = filters?.status;
  const orderType = filters?.orderType;
  const limit = filters?.limit;
  const hasInitialData = !!filters?.initialOrders?.length;

  const loadOrders = useCallback(async () => {
    try {
      const data = await getOrders({ status, orderType, limit });
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [status, orderType, limit]);

  useEffect(() => {
    // Skip initial load if we have SSR data
    if (!hasInitialData) {
      loadOrders();
    }

    // Use deduplicated realtime subscription
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      loadOrders
    );

    return () => {
      unsubscribe();
    };
  }, [loadOrders, status, hasInitialData]);

  return { orders, isLoading, error, refresh: loadOrders };
}

// =============================================
// KITCHEN ORDERS HOOK
// =============================================

export function useKitchenOrders(): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await getKitchenOrders();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    // Use shared ORDERS channel (same channel as orders page, dashboard, etc.)
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      loadOrders
    );

    return () => {
      unsubscribe();
    };
  }, [loadOrders]);

  return { orders, isLoading, error, refresh: loadOrders };
}

// =============================================
// ADVANCED REALTIME ORDERS HOOK (Optimized RPC)
// =============================================

interface UseOrdersAdvancedFilters {
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  // SSR Support: Initial data from server
  initialOrders?: OrderAdvanced[];
  initialStats?: OrdersStats | null;
  initialTotalCount?: number;
}

interface UseOrdersAdvancedReturn {
  orders: OrderAdvanced[];
  stats: OrdersStats | null;
  isLoading: boolean;
  isStatsLoading: boolean;
  error: Error | null;
  totalCount: number;
  hasMore: boolean;
  refresh: () => Promise<void>;
  refreshStats: () => Promise<void>;
  loadMore: () => Promise<void>;
  updateStatus: (orderId: string, status: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
}

export function useRealtimeOrdersAdvanced(filters?: UseOrdersAdvancedFilters): UseOrdersAdvancedReturn {
  // Use initial data from SSR if provided
  const [orders, setOrders] = useState<OrderAdvanced[]>(filters?.initialOrders || []);
  const [stats, setStats] = useState<OrdersStats | null>(filters?.initialStats || null);
  const [isLoading, setIsLoading] = useState(!filters?.initialOrders?.length);
  const [isStatsLoading, setIsStatsLoading] = useState(!filters?.initialStats);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(filters?.initialTotalCount || 0);
  // FIX #26: Initialize hasMore from SSR data if available
  const [hasMore, setHasMore] = useState(filters?.initialOrders ? (filters.initialOrders.length >= (filters?.limit || 50)) : false);
  const offsetRef = useRef(0);
  const filtersRef = useRef(filters);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  // FIX #1: Properly check for SSR data (orders OR stats)
  const hasInitialDataRef = useRef(!!(filters?.initialOrders?.length || filters?.initialStats));
  
  // Keep filters ref updated
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Load orders using Server Action (hidden from Network tab)
  const loadOrders = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        offsetRef.current = 0;
      }
      
      // Use Server Action instead of client-side call
      const response = await fetchOrdersAdvancedServer({
        status: filtersRef.current?.status,
        order_type: filtersRef.current?.orderType,
        date_from: filtersRef.current?.startDate,
        date_to: filtersRef.current?.endDate,
        offset: offsetRef.current,
        limit: filtersRef.current?.limit || 50,
      });
      
      if (!isMountedRef.current) return;
      
      if (reset) {
        setOrders(response.orders as OrderAdvanced[]);
      } else {
        setOrders(prev => [...prev, ...(response.orders as OrderAdvanced[])]);
      }
      
      setTotalCount(response.total_count);
      setHasMore(response.has_more);
      setError(null);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []); // No dependencies - uses refs

  // Load stats using Server Action (hidden from Network tab)
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const result = await fetchOrdersStatsServer();
      if (isMountedRef.current && result.success) {
        setStats(result.data);
      }
    } catch (err) {
      } finally {
      if (isMountedRef.current) {
        setIsStatsLoading(false);
      }
    }
  }, []);

  // Debounced refresh for realtime updates
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadOrders();
      loadStats();
    }, 500); // 500ms debounce
  }, [loadOrders, loadStats]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      offsetRef.current += (filtersRef.current?.limit || 50);
      await loadOrders(false);
    }
  }, [hasMore, isLoading, loadOrders]);

  // Optimistic status update using Server Action (hidden from Network tab)
  const updateStatus = useCallback(async (orderId: string, status: string, notes?: string) => {
    // Optimistic update
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: status as Order['status'], updated_at: new Date().toISOString() }
        : order
    ));

    // Use Server Action instead of client-side call
    const result = await updateOrderStatusQuickServer(orderId, status, notes);
    
    if (!result.success) {
      // Revert on error
      loadOrders();
    } else {
      // Refresh both orders and stats after status change
      // This ensures filters are applied correctly (e.g., "active" filter)
      await Promise.all([loadOrders(), loadStats()]);
    }
    
    return result;
  }, [loadOrders, loadStats]);

  // Initial load - skip if we have SSR data
  useEffect(() => {
    if (!hasInitialDataRef.current) {
      loadOrders();
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - load once on mount

  // Real-time subscription via shared ORDERS channel (deduplicated)
  useEffect(() => {
    const callback = (payload?: any) => {
      // Apply client-side filters if set
      if (filtersRef.current?.status && payload?.new) {
        if ((payload.new as Order).status !== filtersRef.current.status) {
          return;
        }
      }
      if (filtersRef.current?.orderType && payload?.new) {
        if ((payload.new as Order).order_type !== filtersRef.current.orderType) {
          return;
        }
      }
      // Debounced refresh to avoid multiple rapid updates
      debouncedRefresh();
    };

    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      callback
    );

    return () => {
      unsubscribe();
    };
  }, [debouncedRefresh]);

  return {
    orders,
    stats,
    isLoading,
    isStatsLoading,
    error,
    totalCount,
    hasMore,
    refresh: () => loadOrders(),
    refreshStats: loadStats,
    loadMore,
    updateStatus,
  };
}

// =============================================
// WAITER DASHBOARD HOOK
// =============================================

interface UseWaiterDashboardReturn {
  dashboard: WaiterDashboard | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useWaiterDashboard(): UseWaiterDashboardReturn {
  const [dashboard, setDashboard] = useState<WaiterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await getWaiterDashboard();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    // Use shared ORDERS channel for order updates
    const unsubOrders = realtimeManager.subscribe(
      CHANNEL_NAMES.ORDERS,
      'orders',
      loadDashboard
    );
    // Use shared TABLES channel for table updates
    const unsubTables = realtimeManager.subscribe(
      CHANNEL_NAMES.TABLES,
      'restaurant_tables',
      loadDashboard
    );
    // Waiter tips on a dedicated lightweight channel
    const unsubTips = realtimeManager.subscribe(
      CHANNEL_NAMES.WAITER,
      'waiter_tips',
      loadDashboard
    );

    return () => {
      unsubOrders();
      unsubTables();
      unsubTips();
    };
  }, [loadDashboard]);

  return { dashboard, isLoading, error, refresh: loadDashboard };
}

// =============================================
// NOTIFICATIONS HOOK
// FIX #7: Use shared notifications from PortalProvider context
// to avoid duplicate subscriptions
// =============================================

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  // FIX #7: Use shared context instead of creating duplicate subscription
  const { 
    notifications, 
    unreadCount, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    refreshNotifications 
  } = usePortalAuthContext();
  
  const [isLoading] = useState(false);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    refresh: refreshNotifications,
  };
}

// =============================================
// COUNTDOWN TIMER HOOK
// =============================================

export function useCountdown(targetTime: string | null): {
  timeLeft: number;
  isExpired: boolean;
  formatted: string;
} {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const target = new Date(targetTime).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((target - now) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    intervalRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targetTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    isExpired: timeLeft <= 0,
    formatted: formatTime(timeLeft),
  };
}

// =============================================
// REQUEST NOTIFICATION PERMISSION
// =============================================

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}
