import { supabase } from './supabase';

// Realtime channels - only for per-entity subscriptions that need unique filters
const channels = {
  riderAssignments: null as any,
};

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
  if (channels.riderAssignments) {
    channels.riderAssignments.unsubscribe();
    channels.riderAssignments = null;
  }
}
