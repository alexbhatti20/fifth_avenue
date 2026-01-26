'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
export interface RealtimeConfig {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

export interface CacheConfig {
  key: string;
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Get cached data or fetch from source
 */
export function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > cached.ttl;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

/**
 * Set cached data
 */
export function setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/**
 * Clear specific cache key or all cache
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Hook for real-time subscriptions with automatic cleanup
 */
export function useRealtimeSubscription<T>(
  config: RealtimeConfig,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    const channelName = `realtime_${config.table}_${Date.now()}`;
    
    // Use type assertions to work around Supabase SDK type issues
    const channel = (supabase.channel(channelName) as any)
      .on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter,
        },
        callback
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          }
        if (status === 'CHANNEL_ERROR') {
          }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, dependencies);

  return channelRef;
}

/**
 * Hook for fetching data with caching
 */
export function useCachedQuery<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { ttl = 5 * 60 * 1000, enabled = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(() => getCached<T>(queryKey));
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (invalidateCache = true) => {
    if (invalidateCache) {
      clearCache(queryKey);
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await queryFn();
      setData(result);
      setCache(queryKey, result, ttl);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [queryKey, queryFn, ttl, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) return;
    
    const cached = getCached<T>(queryKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      return;
    }
    
    refetch(false);
  }, [enabled, queryKey]);

  return { data, isLoading, error, refetch };
}

// Helper to check authentication
async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // First check Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    
    // Fallback: Check localStorage for portal auth (unified auth system)
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data');
      const userType = localStorage.getItem('user_type');
      if (userData && (userType === 'admin' || userType === 'employee')) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Hook for real-time orders with caching
 */
export function useRealtimeOrdersEnhanced() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    // Check authentication before making direct queries
    if (!(await isAuthenticated())) {
      setIsLoading(false);
      return;
    }

    const cached = getCached<any[]>('portal_orders');
    if (cached) {
      setOrders(cached);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setOrders(data || []);
      setCache('portal_orders', data || [], 2 * 60 * 1000); // 2 min cache
    } catch (error: any) {
      // Don't show toast for auth errors
      if (!error.message?.includes('JWT') && !error.message?.includes('401')) {
        toast.error('Failed to fetch orders');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useRealtimeSubscription<any>(
    { table: 'orders' },
    (payload) => {
      clearCache('portal_orders');
      
      if (payload.eventType === 'INSERT') {
        setOrders((prev) => [payload.new, ...prev]);
        toast.info('New order received!', { description: `Order #${payload.new.order_number}` });
      } else if (payload.eventType === 'UPDATE') {
        setOrders((prev) => prev.map((o) => o.id === payload.new.id ? payload.new : o));
      } else if (payload.eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
      }
    }
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, isLoading, refresh: () => fetchOrders() };
}

/**
 * Hook for real-time tables with caching
 */
export function useRealtimeTablesEnhanced() {
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    // Check authentication before making direct queries
    if (!(await isAuthenticated())) {
      setIsLoading(false);
      return;
    }

    const cached = getCached<any[]>('portal_tables');
    if (cached) {
      setTables(cached);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });

      if (error) throw error;
      
      setTables(data || []);
      setCache('portal_tables', data || [], 5 * 60 * 1000); // 5 min cache
    } catch (error: any) {
      } finally {
      setIsLoading(false);
    }
  }, []);

  useRealtimeSubscription<any>(
    { table: 'restaurant_tables' },
    (payload) => {
      clearCache('portal_tables');
      
      if (payload.eventType === 'UPDATE') {
        setTables((prev) => prev.map((t) => t.id === payload.new.id ? payload.new : t));
      }
    }
  );

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return { tables, isLoading, refresh: () => fetchTables() };
}

/**
 * Hook for real-time kitchen orders
 */
export function useRealtimeKitchenOrdersEnhanced() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    // Check authentication before making direct queries
    if (!(await isAuthenticated())) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      } finally {
      setIsLoading(false);
    }
  }, []);

  useRealtimeSubscription<any>(
    { table: 'orders', filter: 'status=in.(confirmed,preparing,ready)' },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        if (['confirmed', 'preparing', 'ready'].includes(payload.new.status)) {
          setOrders((prev) => [...prev, payload.new]);
          // Play notification sound
          playNotificationSound();
        }
      } else if (payload.eventType === 'UPDATE') {
        if (['confirmed', 'preparing', 'ready'].includes(payload.new.status)) {
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === payload.new.id);
            if (exists) {
              return prev.map((o) => o.id === payload.new.id ? payload.new : o);
            }
            return [...prev, payload.new];
          });
        } else {
          // Order status changed to something outside kitchen view
          setOrders((prev) => prev.filter((o) => o.id !== payload.new.id));
        }
      } else if (payload.eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
      }
    }
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      toast.success(`Order status updated to ${status}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return { orders, isLoading, refresh: fetchOrders, updateOrderStatus };
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications(employeeId?: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!employeeId) return;

    // Check authentication before making direct queries
    if (!(await isAuthenticated())) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('portal_notifications')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    } catch (error: any) {
      }
  }, [employeeId]);

  useRealtimeSubscription<any>(
    { 
      table: 'portal_notifications', 
      filter: employeeId ? `employee_id=eq.${employeeId}` : undefined 
    },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setNotifications((prev) => [payload.new, ...prev]);
        setUnreadCount((prev) => prev + 1);
        toast.info(payload.new.title, { description: payload.new.message });
        playNotificationSound();
      } else if (payload.eventType === 'UPDATE') {
        setNotifications((prev) => prev.map((n) => n.id === payload.new.id ? payload.new : n));
        setUnreadCount((prev) => {
          if (payload.new.is_read && !payload.old?.is_read) return prev - 1;
          return prev;
        });
      } else if (payload.eventType === 'DELETE') {
        setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        if (!payload.old.is_read) {
          setUnreadCount((prev) => prev - 1);
        }
      }
    },
    [employeeId]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('portal_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error: any) {
      }
  };

  const markAllAsRead = async () => {
    if (!employeeId) return;

    try {
      const { error } = await supabase
        .from('portal_notifications')
        .update({ is_read: true })
        .eq('employee_id', employeeId)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error: any) {
      }
  };

  return { 
    notifications, 
    unreadCount, 
    refresh: fetchNotifications, 
    markAsRead, 
    markAllAsRead 
  };
}

/**
 * Hook for real-time inventory alerts
 */
export function useInventoryAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useRealtimeSubscription<any>(
    { table: 'inventory_items', event: 'UPDATE' },
    (payload) => {
      const item = payload.new;
      if (item.current_stock <= item.min_stock && item.current_stock > 0) {
        toast.warning(`Low Stock: ${item.name}`, {
          description: `Only ${item.current_stock} ${item.unit} remaining`,
        });
        setAlerts((prev) => [...prev, { type: 'low_stock', item, timestamp: new Date() }]);
      } else if (item.current_stock === 0) {
        toast.error(`Out of Stock: ${item.name}`, {
          description: 'Item needs to be restocked immediately',
        });
        setAlerts((prev) => [...prev, { type: 'out_of_stock', item, timestamp: new Date() }]);
      }
    }
  );

  return { alerts, clearAlerts: () => setAlerts([]) };
}

/**
 * Hook for real-time delivery tracking
 */
export function useDeliveryTracking(orderId?: string) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<string>('pending');

  useRealtimeSubscription<any>(
    { 
      table: 'delivery_tracking', 
      filter: orderId ? `order_id=eq.${orderId}` : undefined 
    },
    (payload) => {
      if (payload.new.location) {
        setLocation(payload.new.location);
      }
      if (payload.new.status) {
        setStatus(payload.new.status);
      }
    },
    [orderId]
  );

  return { location, status };
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  try {
    const audio = new Audio('/assets/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Batch update helper
 */
export async function batchUpdate<T extends { id: string }>(
  table: string,
  items: T[],
  updateFn: (item: T) => Partial<T>
): Promise<void> {
  const updates = items.map((item) => ({
    ...updateFn(item),
    id: item.id,
  }));

  const { error } = await supabase.from(table).upsert(updates);
  if (error) throw error;
}

/**
 * Optimistic update helper
 */
export function useOptimisticUpdate<T extends { id: string }>() {
  const [pending, setPending] = useState<Map<string, Partial<T>>>(new Map());

  const optimisticUpdate = async (
    id: string,
    update: Partial<T>,
    apiCall: () => Promise<void>
  ) => {
    // Store optimistic update
    setPending((prev) => new Map(prev).set(id, update));

    try {
      await apiCall();
    } catch (error) {
      // Rollback on error
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      throw error;
    } finally {
      // Clear pending state after API call completes
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return { pending, optimisticUpdate };
}
