'use client';

// =============================================
// BOOK ONLINE CLIENT — Full realtime table booking UI
// Light theme · Red gradient · Top-down table view
// =============================================

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createTableReservationAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// ── Shared table shape (matches RPC output + server-queries) ─────────────────
export interface BookingTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  section?: string | null;
  floor: number;
  current_customers: number;
  reserved_by?: string | null;
  reservation_time?: string | null;
  reservation_notes?: string | null;
  reservation_id?: string | null;
  reserved_by_name?: string | null;
  reserved_by_phone?: string | null;
  reservation_date?: string | null;
  arrival_time?: string | null;
  party_size?: number | null;
  auto_release_at?: string | null;
}
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock,
  Users,
  CalendarDays,
  Phone,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Utensils,
  MapPin,
  Sparkles,
  Home,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BookOnlineClientProps {
  initialTables: BookingTable[];
  bookingEnabled: boolean;
}

interface BookingForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  reservationDate: string;
  arrivalTime: string;
  partySize: number;
  notes: string;
}

const emptyForm = (): BookingForm => ({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  reservationDate: '',
  arrivalTime: '',
  partySize: 2,
  notes: '',
});

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, {
  label: string; tableColor: string; tableBorder: string; chairColor: string;
  textColor: string; badgeBg: string; badgeText: string; dotClass: string; selectable: boolean;
}> = {
  available: {
    label: 'Available',
    tableColor: 'from-red-500 to-orange-500',
    tableBorder: 'border-red-300',
    chairColor: 'bg-red-400',
    textColor: 'text-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    dotClass: 'bg-emerald-500 animate-pulse',
    selectable: true,
  },
  occupied: {
    label: 'Occupied',
    tableColor: 'from-zinc-400 to-zinc-500',
    tableBorder: 'border-zinc-300',
    chairColor: 'bg-zinc-400',
    textColor: 'text-white',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    dotClass: 'bg-red-500',
    selectable: false,
  },
  reserved: {
    label: 'Reserved',
    tableColor: 'from-amber-400 to-yellow-500',
    tableBorder: 'border-amber-300',
    chairColor: 'bg-amber-400',
    textColor: 'text-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    dotClass: 'bg-amber-500',
    selectable: false,
  },
  cleaning: {
    label: 'Cleaning',
    tableColor: 'from-blue-400 to-sky-500',
    tableBorder: 'border-blue-300',
    chairColor: 'bg-blue-400',
    textColor: 'text-white',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    dotClass: 'bg-blue-500',
    selectable: false,
  },
  out_of_service: {
    label: 'Unavailable',
    tableColor: 'from-stone-300 to-stone-400',
    tableBorder: 'border-stone-200',
    chairColor: 'bg-stone-300',
    textColor: 'text-white',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-500',
    dotClass: 'bg-stone-400',
    selectable: false,
  },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.out_of_service;
}

// ── Top-down table visual ─────────────────────────────────────────────────────
function TableTopView({ capacity, status, tableNumber }: { capacity: number; status: string; tableNumber: number }) {
  const meta = getStatusMeta(status);
  const chairCount = Math.min(capacity, 8);
  const chairs = Array.from({ length: chairCount }, (_, i) => {
    const angle = (i / chairCount) * 2 * Math.PI - Math.PI / 2;
    const radius = 42;
    return { x: 55 + radius * Math.cos(angle), y: 55 + radius * Math.sin(angle), angle };
  });
  return (
    <div className="relative w-[110px] h-[110px] mx-auto">
      {chairs.map(({ x, y }, i) => (
        <div key={i} className={cn('absolute w-5 h-5 rounded-full border-2 border-white/70 shadow-sm', meta.chairColor, !meta.selectable && 'opacity-40')} style={{ left: x - 10, top: y - 10 }} />
      ))}
      <div className={cn('absolute inset-[20px] rounded-full border-2 bg-gradient-to-br shadow-inner flex flex-col items-center justify-center select-none', meta.tableColor, meta.tableBorder, !meta.selectable && 'opacity-60')}>
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
        </div>
        <Utensils className="h-4 w-4 text-white/50 mb-0.5" />
        <span className={cn('text-base font-extrabold leading-none', meta.textColor)}>{tableNumber}</span>
        <span className={cn('text-[9px] font-semibold opacity-70', meta.textColor)}>TABLE</span>
      </div>
    </div>
  );
}

// Min date = today; max = today + max_advance_days (14)
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function maxDateStr(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Convert HH:MM or HH:MM:SS (24-h) string → 12-h h:mm AM/PM */
function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BookOnlineClient({
  initialTables,
  bookingEnabled,
}: BookOnlineClientProps) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [tables, setTables] = useState<BookingTable[]>(initialTables);
  const [isLive, setIsLive] = useState(false);
  const [selectedTable, setSelectedTable] = useState<BookingTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BookingForm>(emptyForm());
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [confirmedData, setConfirmedData] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [autoFilled, setAutoFilled] = useState(false);

  // Read URL prefill params (from customer drawer deep link)
  const prefillName = searchParams?.get('name') ?? '';
  const prefillPhone = searchParams?.get('phone') ?? '';
  const prefillEmail = searchParams?.get('email') ?? '';

  // ── Realtime subscription ────────────────────────────────────────────────

  const refreshTables = useCallback(async () => {
    try {
      const res = await fetch('/api/booking/tables', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.tables) setTables(json.tables);
    } catch {
      // Ignore network errors silently
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('booking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        () => { refreshTables(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_reservations' },
        () => { refreshTables(); }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTables]);

  // ── Booking submit ───────────────────────────────────────────────────────

  function handleSelectTable(table: BookingTable) {
    const meta = getStatusMeta(table.status);
    if (!meta.selectable) return;
    setSelectedTable(table);
    // Priority: logged-in user > URL params > empty
    const detectedName = user?.name || prefillName;
    const detectedPhone = user?.phone || prefillPhone;
    const detectedEmail = user?.email || prefillEmail;
    const detectedAddress = user?.address || '';
    const hasAutoFill = !!(detectedName || detectedPhone || detectedEmail);
    setAutoFilled(hasAutoFill);
    setForm({
      ...emptyForm(),
      customerName: detectedName,
      customerPhone: detectedPhone,
      customerEmail: detectedEmail,
      customerAddress: detectedAddress,
    });
    setStep('form');
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setStep('form');
    setConfirmedData(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable) return;

    const { customerName, customerPhone, reservationDate, arrivalTime, partySize } = form;
    if (!customerName.trim() || !customerPhone.trim() || !reservationDate || !arrivalTime || !partySize) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    if (partySize > selectedTable.capacity) {
      toast({
        title: `Table too small`,
        description: `Table ${selectedTable.table_number} fits ${selectedTable.capacity} people.`,
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await createTableReservationAction({
        tableId: selectedTable.id,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        reservationDate: form.reservationDate,
        arrivalTime: form.arrivalTime,
        partySize: form.partySize,
        notes: form.notes || undefined,
      });

      if (!result.success) {
        toast({ title: 'Booking Failed', description: result.error ?? 'Something went wrong.', variant: 'destructive' });
        return;
      }

      setConfirmedData({ ...result, table_number: selectedTable.table_number, party_size: form.partySize, date: form.reservationDate, time: form.arrivalTime, customer_name: form.customerName, address: form.customerAddress });
      setStep('confirm');
      refreshTables();
    });
  }

  // ── Booking disabled ──────────────────────────────────────────────────────
  if (!bookingEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50 px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-800 mb-3">Bookings Unavailable</h1>
          <p className="text-zinc-500 text-lg">Online table booking is currently turned off. Please visit us in person or call to reserve a table.</p>
        </motion.div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  const availableCount = tables.filter((t) => t.status === 'available').length;

  // Group by section
  const grouped = tables.reduce<Record<string, BookingTable[]>>((acc, t) => {
    const key = t.section ?? (t.floor > 1 ? `Floor ${t.floor}` : 'Main Hall');
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50/60">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-red-200/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative pt-20 pb-8 px-4 text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold mb-4">
            <MapPin className="h-3 w-3" /> Zoiro Broast, Vehari
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-clip-text text-transparent">
            Book Your Table
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 text-zinc-500 text-base md:text-lg max-w-xl mx-auto">
            See every table in real-time. Pick yours and confirm instantly.
          </motion.p>

          {/* Live connection pill */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200 shadow-sm text-xs font-semibold text-zinc-600">
            {isLive ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-700">Live — updates automatically</span>
              </>
            ) : (
              <>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse" />
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-600">Connecting…</span>
              </>
            )}
            <button onClick={refreshTables} className="ml-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
          </motion.div>

          {/* Legend pills */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-5 flex justify-center flex-wrap gap-3">
            {(Object.entries(STATUS_META) as [string, typeof STATUS_META[string]][]).filter(([k]) => k !== 'out_of_service').map(([status, meta]) => {
              const count = tables.filter((t) => t.status === status).length;
              return (
                <div key={status} className="flex items-center gap-2 bg-white border border-zinc-100 rounded-full px-3 py-1 shadow-sm">
                  <span className={cn('h-2 w-2 rounded-full', meta.dotClass)} />
                  <span className="text-xs text-zinc-500">{meta.label}</span>
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', meta.badgeBg, meta.badgeText)}>{count}</span>
                </div>
              );
            })}
          </motion.div>

          {availableCount === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
              No tables available right now — check back soon or call us.
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Floor Plan ── */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        {tables.length === 0 ? (
          <div className="text-center text-zinc-400 py-20">No tables found.</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([section, sectionTables]) => (
              <div key={section}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gradient-to-r from-red-200 to-transparent" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">{section}</span>
                  <div className="flex-1 h-px bg-gradient-to-l from-red-200 to-transparent" />
                </div>
                <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
                  {sectionTables.map((table) => {
                    const meta = getStatusMeta(table.status);
                    return (
                      <motion.div key={table.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} whileHover={meta.selectable ? { y: -4, scale: 1.03 } : {}} whileTap={meta.selectable ? { scale: 0.97 } : {}}>
                        <button
                          onClick={() => handleSelectTable(table)}
                          disabled={!meta.selectable}
                          className={cn(
                            'w-full rounded-2xl bg-white border-2 p-4 text-center shadow-md transition-all duration-200 group',
                            meta.selectable
                              ? 'cursor-pointer hover:shadow-xl hover:shadow-red-200/40 border-red-100 hover:border-red-300'
                              : 'cursor-not-allowed border-zinc-100',
                          )}
                        >
                          <TableTopView capacity={table.capacity} status={table.status} tableNumber={table.table_number} />

                          <div className={cn('mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold', meta.badgeBg, meta.badgeText)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
                            {meta.label}
                          </div>

                          <div className="mt-1 flex items-center justify-center gap-1 text-xs text-zinc-400">
                            <Users className="h-3.5 w-3.5" /><span>up to {table.capacity}</span>
                          </div>

                          {table.status === 'reserved' && table.arrival_time && (
                            <div className="mt-1 text-[10px] text-amber-600 font-medium flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />{fmt12h(table.arrival_time)}
                            </div>
                          )}

                          {meta.selectable && (
                            <div className="mt-3 w-full py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-orange-500 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md shadow-red-300/40">
                              Tap to Book
                            </div>
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Booking Dialog ── */}
      <AnimatePresence>
        {dialogOpen && selectedTable && (
          <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
            <DialogContent className="max-w-4xl w-full bg-white border border-zinc-100 text-zinc-800 rounded-3xl p-0 overflow-hidden shadow-2xl shadow-red-200/40 max-h-[90vh] flex flex-col">
              {/* Top gradient bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />

              {step === 'form' ? (
                <div className="flex flex-col md:flex-row flex-1 min-h-0">

                  {/* ── LEFT PANEL — Table preview + booking summary ── */}
                  <div className="md:w-72 flex-shrink-0 bg-gradient-to-b from-red-600 to-orange-500 p-6 flex flex-col gap-5 text-white">
                    {/* Auto-fill badge */}
                    {autoFilled && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-2 text-xs font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
                        <span>Details auto-detected</span>
                        <BadgeCheck className="h-3.5 w-3.5 text-green-200" />
                      </motion.div>
                    )}

                    {/* Table visual */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <TableTopView capacity={selectedTable.capacity} status="available" tableNumber={selectedTable.table_number} />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/30">
                          Selected
                        </div>
                      </div>
                      <div className="text-center mt-3">
                        <p className="text-2xl font-extrabold">Table {selectedTable.table_number}</p>
                        <p className="text-white/70 text-sm">{selectedTable.section ?? 'Main Hall'}</p>
                      </div>
                    </div>

                    {/* Booking summary chips */}
                    <div className="space-y-2 mt-auto">
                      <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2.5 text-sm">
                        <Users className="h-4 w-4 flex-shrink-0 text-white/80" />
                        <div>
                          <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Capacity</p>
                          <p className="font-bold">Up to {selectedTable.capacity} guests</p>
                        </div>
                      </div>
                      {form.reservationDate && (
                        <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2.5 text-sm">
                          <CalendarDays className="h-4 w-4 flex-shrink-0 text-white/80" />
                          <div>
                            <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Date</p>
                            <p className="font-bold">{form.reservationDate}</p>
                          </div>
                        </div>
                      )}
                      {form.arrivalTime && (
                        <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2.5 text-sm">
                          <Clock className="h-4 w-4 flex-shrink-0 text-white/80" />
                          <div>
                            <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Arrival</p>
                            <p className="font-bold">{fmt12h(form.arrivalTime)}</p>
                          </div>
                        </div>
                      )}
                      {form.partySize > 0 && (
                        <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2.5 text-sm">
                          <Users className="h-4 w-4 flex-shrink-0 text-white/80" />
                          <div>
                            <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Guests</p>
                            <p className="font-bold">{form.partySize} {form.partySize === 1 ? 'person' : 'people'}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 bg-amber-400/30 border border-amber-300/40 rounded-xl px-3 py-2.5 text-[11px] mt-2">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-yellow-200" />
                        <span className="text-white/90">Table held <span className="font-bold">10 min</span> after arrival then auto-released.</span>
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT PANEL — Form ── */}
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 px-6 pt-5 pb-4 border-b border-red-100">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-sm font-extrabold shadow">{selectedTable.table_number}</span>
                          Reserve Table {selectedTable.table_number}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-sm mt-1">
                          Fill in your details below — all fields marked * are required.
                        </DialogDescription>
                      </DialogHeader>
                    </div>

                    {/* Form body */}
                    <div className="flex-1 overflow-y-auto p-6">
                      <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Auto-fill notice */}
                        {autoFilled && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                            <BadgeCheck className="h-4 w-4 flex-shrink-0" />
                            Your account details were auto-filled. You can edit any field before confirming.
                          </motion.div>
                        )}

                        {/* Name + Phone */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1">
                              <User className="h-3 w-3" />Name *
                              {autoFilled && form.customerName && <Sparkles className="h-2.5 w-2.5 text-orange-400" />}
                            </Label>
                            <Input placeholder="Your name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required className="border-zinc-200 focus:border-red-400" />
                          </div>
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1">
                              <Phone className="h-3 w-3" />Phone *
                              {autoFilled && form.customerPhone && <Sparkles className="h-2.5 w-2.5 text-orange-400" />}
                            </Label>
                            <Input placeholder="+92 300 1234567" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} required type="tel" className="border-zinc-200 focus:border-red-400" />
                          </div>
                        </div>

                        {/* Email + Address */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1">
                              <Mail className="h-3 w-3" />Email
                              {autoFilled && form.customerEmail && <Sparkles className="h-2.5 w-2.5 text-orange-400" />}
                            </Label>
                            <Input placeholder="you@example.com" type="email" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} className="border-zinc-200 focus:border-red-400" />
                          </div>
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1">
                              <Home className="h-3 w-3" />Address
                              {autoFilled && form.customerAddress && <Sparkles className="h-2.5 w-2.5 text-orange-400" />}
                            </Label>
                            <Input placeholder="Your address" value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} className="border-zinc-200 focus:border-red-400" />
                          </div>
                        </div>

                        {/* Date + Time */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1"><CalendarDays className="h-3 w-3" />Date *</Label>
                            <Input type="date" min={todayStr()} max={maxDateStr()} value={form.reservationDate} onChange={(e) => setForm((f) => ({ ...f, reservationDate: e.target.value }))} required className="border-zinc-200 focus:border-red-400" />
                          </div>
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold flex items-center gap-1"><Clock className="h-3 w-3" />Arrival Time *</Label>
                            <Input type="time" value={form.arrivalTime} onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))} required className="border-zinc-200 focus:border-red-400" />
                          </div>
                        </div>

                        {/* Guests stepper */}
                        <div>
                          <Label className="text-xs text-zinc-500 mb-2 block font-semibold flex items-center gap-1"><Users className="h-3 w-3" />Number of Guests *</Label>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setForm((f) => ({ ...f, partySize: Math.max(1, f.partySize - 1) }))} className="h-10 w-10 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center font-bold text-xl transition-colors">−</button>
                            <div className="flex-1 text-center">
                              <span className="text-zinc-800 font-extrabold text-3xl">{form.partySize}</span>
                              <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">{form.partySize === 1 ? 'person' : 'people'}</p>
                            </div>
                            <button type="button" onClick={() => setForm((f) => ({ ...f, partySize: Math.min(selectedTable.capacity, f.partySize + 1) }))} className="h-10 w-10 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center font-bold text-xl transition-colors">+</button>
                            <span className="text-zinc-400 text-xs">max {selectedTable.capacity}</span>
                          </div>
                          {/* Guest capacity bar */}
                          <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-300" style={{ width: `${(form.partySize / selectedTable.capacity) * 100}%` }} />
                          </div>
                        </div>

                        {/* Notes */}
                        <div>
                          <Label className="text-xs text-zinc-500 mb-1.5 block font-semibold">Special Requests (optional)</Label>
                          <Textarea placeholder="Dietary needs, celebrations, preferred seating, allergies…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="border-zinc-200 focus:border-red-400 resize-none" />
                        </div>

                        {/* Submit */}
                        <Button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold rounded-xl py-3 shadow-lg shadow-red-300/40 flex items-center justify-center gap-2">
                          {isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Confirming…</>
                          ) : (
                            <><span>Confirm Reservation</span><ChevronRight className="h-4 w-4" /></>
                          )}
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── CONFIRMATION STEP ── */
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-lg mx-auto">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-zinc-800">Booking Confirmed!</h2>
                    <p className="text-zinc-500 text-sm mt-1">Your table is reserved. We look forward to seeing you!</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <ConfirmRow icon={<Utensils className="h-4 w-4" />} label="Table" value={`Table ${confirmedData.table_number}`} />
                      <ConfirmRow icon={<User className="h-4 w-4" />} label="Name" value={confirmedData.customer_name || ''} />
                      <ConfirmRow icon={<CalendarDays className="h-4 w-4" />} label="Date" value={confirmedData.date} />
                      <ConfirmRow icon={<Clock className="h-4 w-4" />} label="Arrival" value={fmt12h(confirmedData.time)} />
                      <ConfirmRow icon={<Users className="h-4 w-4" />} label="Guests" value={`${confirmedData.party_size} people`} />
                      {confirmedData.address && <ConfirmRow icon={<Home className="h-4 w-4" />} label="Address" value={confirmedData.address} />}
                    </div>
                    {confirmedData.auto_release_at && (
                      <p className="text-[11px] text-amber-600 pt-2 border-t border-emerald-200">
                        ⏱ Table held until {new Date(confirmedData.auto_release_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })} — please arrive on time.
                      </p>
                    )}
                  </div>
                  <p className="text-zinc-500 text-sm text-center mt-4">We look forward to serving you at <span className="text-zinc-800 font-bold">Zoiro Broast</span>!</p>
                  <Button onClick={handleCloseDialog} className="w-full mt-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white rounded-xl font-semibold">Done</Button>
                </motion.div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Small helper ─────────────────────────────────────────────────────────────
function ConfirmRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-emerald-600">{icon}</span>
      <div>
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-zinc-800 font-bold text-sm">{value}</p>
      </div>
    </div>
  );
}
