// /api/booking/tables — Public JSON endpoint for client-side table refresh
// (Called from BookOnlineClient when realtime events arrive)
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase.rpc('get_tables_for_booking');
    if (error) throw error;
    return NextResponse.json({
      tables: data?.tables ?? [],
      booking_enabled: data?.booking_enabled ?? false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
