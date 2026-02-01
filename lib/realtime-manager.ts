// =============================================
// REALTIME SUBSCRIPTION MANAGER
// Prevents duplicate channel subscriptions across components
// =============================================

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SubscriptionEntry {
  channel: RealtimeChannel;
  refCount: number;
  callbacks: Set<() => void>;
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

  /**
   * Subscribe to a channel with deduplication
   * If the channel already exists, increments ref count and adds callback
   * Otherwise creates a new subscription
   */
  subscribe(
    channelName: string,
    table: string,
    callback: () => void,
    filter?: string
  ): () => void {
    const existing = this.subscriptions.get(channelName);

    if (existing) {
      // Channel already exists, just add the callback
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
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          // Call all registered callbacks
          const entry = this.subscriptions.get(channelName);
          if (entry) {
            entry.callbacks.forEach((cb) => {
              try {
                cb();
              } catch (e) {
                // Silently handle callback errors
              }
            });
          }
        }
      )
      .subscribe();

    const callbacks = new Set<() => void>();
    callbacks.add(callback);

    this.subscriptions.set(channelName, {
      channel,
      refCount: 1,
      callbacks,
    });

    return () => this.unsubscribe(channelName, callback);
  }

  /**
   * Subscribe to multiple tables on one channel
   */
  subscribeMultiple(
    channelName: string,
    tables: Array<{ table: string; filter?: string }>,
    callback: () => void
  ): () => void {
    const existing = this.subscriptions.get(channelName);

    if (existing) {
      existing.refCount++;
      existing.callbacks.add(callback);
      return () => this.unsubscribe(channelName, callback);
    }

    // Create new channel with multiple table subscriptions
    let channel = supabase.channel(channelName);

    tables.forEach(({ table, filter }) => {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          const entry = this.subscriptions.get(channelName);
          if (entry) {
            entry.callbacks.forEach((cb) => {
              try {
                cb();
              } catch (e) {
                // Silently handle callback errors
              }
            });
          }
        }
      );
    });

    channel.subscribe();

    const callbacks = new Set<() => void>();
    callbacks.add(callback);

    this.subscriptions.set(channelName, {
      channel,
      refCount: 1,
      callbacks,
    });

    return () => this.unsubscribe(channelName, callback);
  }

  /**
   * Unsubscribe from a channel
   * Only removes channel when ref count reaches 0
   */
  private unsubscribe(channelName: string, callback: () => void): void {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    entry.callbacks.delete(callback);
    entry.refCount--;

    if (entry.refCount <= 0) {
      // No more subscribers, clean up the channel
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

// Helper hooks for common subscriptions
export const CHANNEL_NAMES = {
  ORDERS: 'managed-orders',
  TABLES: 'managed-tables',
  DASHBOARD: 'managed-dashboard',
  KITCHEN: 'managed-kitchen',
  DELIVERY: 'managed-delivery',
  NOTIFICATIONS: 'managed-notifications',
} as const;
