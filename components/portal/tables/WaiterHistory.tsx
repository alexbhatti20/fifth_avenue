'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTableWrapper } from '@/components/portal/PortalProvider';
import { createClient } from '@/lib/supabase';
import type { WaiterStats, OrderHistoryItem } from './types';

const supabase = createClient();

// ==========================================
// WAITER HISTORY COMPONENT
// Shows waiter's order history with stats
// ==========================================

export function WaiterHistory() {
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [stats, setStats] = useState<WaiterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false); // Prevent duplicate fetches

  const fetchHistory = useCallback(async (force = false) => {
    // Skip if already fetched (unless forced refresh)
    if (hasFetchedRef.current && !force) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_waiter_order_history', {
        p_limit: 20,
        p_offset: 0,
      });

      if (error) throw error;

      if (data?.success) {
        setHistory(data.history || []);
        setStats(data.stats);
        hasFetchedRef.current = true;
      }
    } catch (error) {
      console.error('Error fetching waiter history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Orders History</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchHistory(true)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
            <p className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              {stats.orders_today || 0}
            </p>
            <p className="text-sm text-muted-foreground">Today&apos;s Orders</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
            <p className="text-3xl font-bold text-emerald-600">
              Rs. {(stats.sales_today || 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Today&apos;s Sales</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
            <p className="text-3xl font-bold text-amber-600">
              Rs. {(stats.tips_today || 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Today&apos;s Tips</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
            <p className="text-3xl font-bold text-blue-600">
              {stats.customers_today || 0}
            </p>
            <p className="text-sm text-muted-foreground">Customers Served</p>
          </div>
        </div>
      )}

      {/* History List */}
      <DataTableWrapper
        isLoading={isLoading}
        isEmpty={history.length === 0}
        emptyMessage="No orders yet today"
      >
        <div className="space-y-3">
          {history.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                  {order.table_number}
                </div>
                <div>
                  <p className="font-medium">#{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer_name || 'Walk-in'} • {order.total_items} items
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {order.is_registered_customer && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Registered
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {order.payment_method}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">Rs. {order.total?.toLocaleString()}</p>
                {order.tip_amount > 0 && (
                  <p className="text-sm text-amber-600">+Rs. {order.tip_amount} tip</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(order.order_taken_at).toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </DataTableWrapper>
    </div>
  );
}
