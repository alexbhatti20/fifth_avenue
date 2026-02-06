import { supabase } from './supabase';

// Realtime channels - only for per-entity subscriptions that need unique filters
const channels = {
  orders: null as any,
  riderAssignments: null as any,
};

// Subscribe to order updates (for customer order tracking page)
export function subscribeToOrders(
  callback: (payload: any) => void,
  filter?: { status?: string; customerId?: string }
) {
  if (channels.orders) {
    channels.orders.unsubscribe();
  }

  channels.orders = supabase
    .channel('customer-orders-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        ...(filter?.customerId ? { filter: `customer_id=eq.${filter.customerId}` } : {}),
      },
      (payload) => {
        // Apply client-side status filter if needed
        const newRecord = payload.new as any;
        if (filter?.status && newRecord?.status !== filter.status) {
          return;
        }
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    if (channels.orders) {
      channels.orders.unsubscribe();
      channels.orders = null;
    }
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

// Cleanup all subscriptions
export function cleanupRealtimeSubscriptions() {
  if (channels.orders) {
    channels.orders.unsubscribe();
    channels.orders = null;
  }
  if (channels.riderAssignments) {
    channels.riderAssignments.unsubscribe();
    channels.riderAssignments = null;
  }
}
