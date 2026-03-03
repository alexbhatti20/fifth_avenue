// =============================================
// PORTAL BOOKINGS MANAGEMENT PAGE — SSR
// Admin / Manager only
// =============================================

import { Suspense } from 'react';
import { getAuthenticatedClient } from '@/lib/server-queries';
import { getOnlineBookingSettingServer } from '@/lib/server-queries';
import BookingsManagementClient from './BookingsManagementClient';
import type { AdminReservation } from '@/lib/actions';
import { Loader2 } from 'lucide-react';

async function getInitialReservations(): Promise<{
  reservations: AdminReservation[];
  total: number;
}> {
  try {
    const client = await getAuthenticatedClient();
    const { data, error } = await client.rpc('get_all_reservations_for_admin', {
      p_status: null,
      p_date: null,
      p_limit: 50,
      p_offset: 0,
    });
    if (error) return { reservations: [], total: 0 };
    return {
      reservations: data?.reservations ?? [],
      total: data?.total ?? 0,
    };
  } catch {
    return { reservations: [], total: 0 };
  }
}

export default async function BookingsPage() {
  const [{ reservations, total }, bookingSetting] = await Promise.all([
    getInitialReservations(),
    getOnlineBookingSettingServer(),
  ]);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading bookings…
      </div>
    }>
      <BookingsManagementClient
        initialReservations={reservations}
        initialTotal={total}
        initialBookingEnabled={bookingSetting.enabled}
      />
    </Suspense>
  );
}
