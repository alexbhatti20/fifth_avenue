'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
  getOrdersAdvanced,
  getOrdersStats,
  updateOrderStatusQuick,
  getKitchenOrders,
  getMyNotifications,
  getWaiterDashboard,
  markNotificationsRead as markRead,
} from '@/lib/portal-queries';

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

interface UseDashboardReturn {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAdminDashboard(): UseDashboardReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    loadStats();

    // Set up realtime subscriptions for orders
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Refresh stats on any order change
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadStats]);

  return { stats, isLoading, error, refresh: loadStats };
}

// =============================================
// REALTIME TABLES HOOK
// =============================================

interface UseTablesReturn {
  tables: RestaurantTable[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRealtimeTables(): UseTablesReturn {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    loadTables();

    // Subscribe to table changes
    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        () => {
          loadTables();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadTables]);

  return { tables, isLoading, error, refresh: loadTables };
}

// =============================================
// REALTIME ORDERS HOOK
// =============================================

interface UseOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRealtimeOrders(filters?: {
  status?: string;
  orderType?: string;
  limit?: number;
}): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Memoize filter values to prevent infinite re-renders
  const status = filters?.status;
  const orderType = filters?.orderType;
  const limit = filters?.limit;

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
    loadOrders();

    // Subscribe to order changes
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // Filter by status if needed
          if (status && payload.new) {
            if ((payload.new as Order).status !== status) {
              return;
            }
          }
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadOrders, status]);

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

    // Subscribe to order changes
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
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
  const [orders, setOrders] = useState<OrderAdvanced[]>([]);
  const [stats, setStats] = useState<OrdersStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const filtersRef = useRef(filters);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
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

  // Load orders using optimized RPC
  const loadOrders = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        offsetRef.current = 0;
      }
      
      const response = await getOrdersAdvanced({
        ...filtersRef.current,
        offset: offsetRef.current,
        limit: filtersRef.current?.limit || 50,
      });
      
      if (!isMountedRef.current) return;
      
      if (reset) {
        setOrders(response.orders);
      } else {
        setOrders(prev => [...prev, ...response.orders]);
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

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const statsData = await getOrdersStats();
      if (isMountedRef.current) {
        setStats(statsData);
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

  // Optimistic status update
  const updateStatus = useCallback(async (orderId: string, status: string, notes?: string) => {
    // Optimistic update
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: status as Order['status'], updated_at: new Date().toISOString() }
        : order
    ));

    // API call
    const result = await updateOrderStatusQuick(orderId, status, notes);
    
    if (!result.success) {
      // Revert on error
      loadOrders();
    } else {
      // Refresh stats after status change
      loadStats();
    }
    
    return result;
  }, [loadOrders, loadStats]);

  // Initial load - run only once
  useEffect(() => {
    loadOrders();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - load once on mount

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-advanced-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // Apply filters if set
          if (filtersRef.current?.status && payload.new) {
            if ((payload.new as Order).status !== filtersRef.current.status) {
              return;
            }
          }
          if (filtersRef.current?.orderType && payload.new) {
            if ((payload.new as Order).order_type !== filtersRef.current.orderType) {
              return;
            }
          }
          
          // Debounced refresh to avoid multiple rapid updates
          debouncedRefresh();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
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

    // Subscribe to relevant changes
    const channel = supabase
      .channel('waiter-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadDashboard();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        () => {
          loadDashboard();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_tips' },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadDashboard]);

  return { dashboard, isLoading, error, refresh: loadDashboard };
}

// =============================================
// NOTIFICATIONS HOOK
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { employee } = usePortalAuthContext();

  const loadNotifications = useCallback(async () => {
    if (!employee) return;
    
    try {
      const data = await getMyNotifications(50, false);
      setNotifications(data);
    } catch (err) {
      } finally {
      setIsLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    if (!employee) return;
    
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${employee.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          
          // Show browser notification if supported
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification((payload.new as Notification).title, {
              body: (payload.new as Notification).message,
              icon: '/assets/logo.png',
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [employee, loadNotifications]);

  const markAsRead = useCallback(async (ids: string[]) => {
    await markRead(ids);
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  }, [notifications, markAsRead]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
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
