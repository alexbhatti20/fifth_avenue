// =============================================
// REALTIME SUBSCRIPTION MANAGER
// Prevents duplicate channel subscriptions across components.
// All portal Realtime goes through this singleton so that
// Supabase never opens more than ONE Postgres subscription
// per logical table, no matter how many React components
// are mounted.
// =============================================

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Callback receives the Realtime payload so consumers can
// inspect eventType / new / old when needed.  Existing
// callbacks that ignore the argument keep working.
type RealtimeCallback = (payload?: any) => void;

interface SubscriptionEntry {
  channel: RealtimeChannel;
  refCount: number;
  callbacks: Set<RealtimeCallback>;
}

class RealtimeSubscriptionManager {
  private subscriptions = new Map<string, SubscriptionEntry>();
  private static instance: RealtimeSubscriptionManager;

  private constructor() {}

  static getInstance(): RealtimeSubscriptionManager {
    if (!RealtimeSubscriptionManager.instance) {
      RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
    }
    return RealtimeSubscriptionManager.instance;
  }

  // ---- internal helper to fan-out to all callbacks ----
  private notifyAll(channelName: string, payload?: any): void {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;
    entry.callbacks.forEach((cb) => {
      try {
        cb(payload);
      } catch (_) {
        // Silently handle callback errors
      }
    });
  }

  /**
   * Subscribe to a channel with deduplication.
   * If the channel already exists, increments ref count and adds callback.
   * Otherwise creates a new Postgres subscription.
   *
   * @param channelName  Unique logical channel name (use CHANNEL_NAMES constants)
   * @param table        Postgres table to listen on
   * @param callback     Invoked with the Realtime payload on every change
   * @param options      Optional event type and server-side filter
   */
  subscribe(
    channelName: string,
    table: string,
    callback: RealtimeCallback,
    options?: { filter?: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*' }
  ): () => void {
    const existing = this.subscriptions.get(channelName);

    if (existing) {
      // Channel already exists – just piggy-back
      existing.refCount++;
      existing.callbacks.add(callback);
      return () => this.unsubscribe(channelName, callback);
    }

    // Create new channel subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: options?.event || '*',
          schema: 'public',
          table,
          ...(options?.filter ? { filter: options.filter } : {}),
        },
        (payload) => this.notifyAll(channelName, payload)
      )
      .subscribe();

    const callbacks = new Set<RealtimeCallback>();
    callbacks.add(callback);

    this.subscriptions.set(channelName, {
      channel,
      refCount: 1,
      callbacks,
    });

    return () => this.unsubscribe(channelName, callback);
  }

  /**
   * Subscribe to multiple tables on one Supabase channel.
   * All callbacks receive every event from any of the tables.
   */
  subscribeMultiple(
    channelName: string,
    tables: Array<{ table: string; filter?: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*' }>,
    callback: RealtimeCallback
  ): () => void {
    const existing = this.subscriptions.get(channelName);

    if (existing) {
      existing.refCount++;
      existing.callbacks.add(callback);
      return () => this.unsubscribe(channelName, callback);
    }

    // Create new channel with multiple table subscriptions
    let channel = supabase.channel(channelName);

    tables.forEach(({ table, filter, event }) => {
      channel = channel.on(
        'postgres_changes',
        {
          event: event || '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => this.notifyAll(channelName, payload)
      );
    });

    channel.subscribe();

    const callbacks = new Set<RealtimeCallback>();
    callbacks.add(callback);

    this.subscriptions.set(channelName, {
      channel,
      refCount: 1,
      callbacks,
    });

    return () => this.unsubscribe(channelName, callback);
  }

  /**
   * Unsubscribe from a channel.
   * Only removes the underlying Postgres subscription when ref count reaches 0.
   */
  private unsubscribe(channelName: string, callback: RealtimeCallback): void {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    entry.callbacks.delete(callback);
    entry.refCount--;

    if (entry.refCount <= 0) {
      // No more subscribers – tear down the channel
      supabase.removeChannel(entry.channel);
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Get current subscription count (for debugging)
   */
  getActiveSubscriptions(): number {
    return this.subscriptions.size;
  }

  /**
   * Force cleanup all subscriptions
   */
  cleanup(): void {
    this.subscriptions.forEach((entry) => {
      supabase.removeChannel(entry.channel);
    });
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const realtimeManager = RealtimeSubscriptionManager.getInstance();

// Shared channel names – every portal component MUST use these
// instead of creating ad-hoc channel names.
export const CHANNEL_NAMES = {
  /** All order-related changes (orders table, event *) */
  ORDERS: 'managed-orders',
  /** Restaurant tables status */
  TABLES: 'managed-tables',
  /** Dashboard aggregate refresh (attendance + meta tables) */
  DASHBOARD_META: 'managed-dashboard-meta',
  /** Waiter-specific tables (waiter_tips) */
  WAITER: 'managed-waiter',
  /** Notifications for the logged-in employee */
  NOTIFICATIONS: 'managed-notifications',
} as const;
