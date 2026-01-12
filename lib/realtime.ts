import { supabase } from './supabase';

// Realtime channels - only for critical real-time needs
const channels = {
  orders: null as any,
  notifications: null as any,
};

// Subscribe to order updates (for admin/employee dashboards)
export function subscribeToOrders(
  callback: (payload: any) => void,
  filter?: { status?: string; customerId?: string }
) {
  if (channels.orders) {
    channels.orders.unsubscribe();
  }

  let query = supabase
    .channel('orders-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        // Apply client-side filter if needed
        const newRecord = payload.new as any;
        if (filter?.customerId && newRecord?.customer_id !== filter.customerId) {
          return;
        }
        if (filter?.status && newRecord?.status !== filter.status) {
          return;
        }
        callback(payload);
      }
    );

  channels.orders = query.subscribe();

  return () => {
    if (channels.orders) {
      channels.orders.unsubscribe();
      channels.orders = null;
    }
  };
}

// Subscribe to order status changes (for customer order tracking)
// This listens to both order_status_history AND direct order updates
export function subscribeToOrderStatus(
  orderId: string,
  callback: (status: string, payload: any) => void
) {
  const channel = supabase
    .channel(`order-status-${orderId}`)
    // Listen to status history inserts
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_status_history',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        callback(payload.new.status, payload);
      }
    )
    // Also listen to direct order updates (for assigned_to, etc.)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        if (payload.new?.status) {
          callback(payload.new.status, payload);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Subscribe to full order updates (for tracking page with all details)
export function subscribeToOrderUpdates(
  orderId: string,
  onStatusChange: (status: string) => void,
  onOrderUpdate: (order: any) => void
) {
  const channel = supabase
    .channel(`order-full-${orderId}`)
    // Listen to status history
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_status_history',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        onStatusChange(payload.new.status);
      }
    )
    // Listen to order updates
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        onOrderUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Subscribe to user notifications
export function subscribeToNotifications(
  userId: string,
  userType: 'customer' | 'employee',
  callback: (notification: any) => void
) {
  if (channels.notifications) {
    channels.notifications.unsubscribe();
  }

  channels.notifications = supabase
    .channel(`notifications-${userType}-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new.user_type === userType) {
          callback(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    if (channels.notifications) {
      channels.notifications.unsubscribe();
      channels.notifications = null;
    }
  };
}

// Subscribe to table status (for reception dashboard)
export function subscribeToTables(callback: (payload: any) => void) {
  const channel = supabase
    .channel('tables-channel')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurant_tables',
      },
      callback
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Subscribe to orders assigned to a specific delivery rider
// This listens for when an order is assigned OR when status changes to 'ready'
export function subscribeToRiderAssignments(
  riderId: string,
  onNewAssignment: (order: any) => void,
  onOrderUpdate: (order: any) => void
) {
  const channel = supabase
    .channel(`rider-assignments-${riderId}`)
    // Listen for orders being assigned to this rider
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `delivery_rider_id=eq.${riderId}`,
      },
      (payload) => {
        const oldRecord = payload.old as any;
        const newRecord = payload.new as any;
        
        // Check if this is a new assignment (delivery_rider_id was null before)
        if (!oldRecord?.delivery_rider_id && newRecord?.delivery_rider_id === riderId) {
          onNewAssignment(newRecord);
        } else {
          // Just an update to an existing assignment
          onOrderUpdate(newRecord);
        }
      }
    )
    // Also listen for INSERT if an order is created and directly assigned
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `delivery_rider_id=eq.${riderId}`,
      },
      (payload) => {
        onNewAssignment(payload.new);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Subscribe to all orders ready for delivery (for riders to pick from)
export function subscribeToReadyForDelivery(
  onOrderReady: (order: any) => void,
  onOrderUpdate: (order: any) => void
) {
  const channel = supabase
    .channel('ready-for-delivery')
    // Listen for orders becoming ready
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        
        // Check if status changed to 'ready' and is online/delivery order
        if (
          newRecord?.status === 'ready' &&
          oldRecord?.status !== 'ready' &&
          newRecord?.order_type === 'online'
        ) {
          onOrderReady(newRecord);
        } else if (
          newRecord?.status === 'ready' ||
          newRecord?.status === 'delivering' ||
          newRecord?.status === 'delivered'
        ) {
          onOrderUpdate(newRecord);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

// Cleanup all subscriptions
export function cleanupRealtimeSubscriptions() {
  if (channels.orders) {
    channels.orders.unsubscribe();
    channels.orders = null;
  }
  if (channels.notifications) {
    channels.notifications.unsubscribe();
    channels.notifications = null;
  }
}
