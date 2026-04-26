'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createTableReservationAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Utensils,
  MapPin,
  BadgeCheck,
  Flame,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BookingTable {
  id: string;
  table_number: number;
  capacity: number;
  section?: string | null;
  status: string;
  arrival_time?: string;
}

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
    label: 'GRAB IT',
    tableColor: 'bg-[#FFD200]',
    tableBorder: 'border-black',
    chairColor: 'bg-black',
    textColor: 'text-black',
    badgeBg: 'bg-[#FFD200]',
    badgeText: 'text-black',
    dotClass: 'bg-black animate-pulse',
    selectable: true,
  },
  occupied: {
    label: 'TAKEN',
    tableColor: 'bg-zinc-200',
    tableBorder: 'border-zinc-400',
    chairColor: 'bg-zinc-400',
    textColor: 'text-zinc-500',
    badgeBg: 'bg-zinc-100',
    badgeText: 'text-zinc-500',
    dotClass: 'bg-zinc-400',
    selectable: false,
  },
  reserved: {
    label: 'BOOKED',
    tableColor: 'bg-[#008A45]',
    tableBorder: 'border-black',
    chairColor: 'bg-black',
    textColor: 'text-white',
    badgeBg: 'bg-[#008A45]',
    badgeText: 'text-white',
    dotClass: 'bg-white',
    selectable: false,
  },
  cleaning: {
    label: 'POLISHING',
    tableColor: 'bg-[#ED1C24]',
    tableBorder: 'border-black',
    chairColor: 'bg-black',
    textColor: 'text-white',
    badgeBg: 'bg-[#ED1C24]',
    badgeText: 'text-white',
    dotClass: 'bg-white',
    selectable: false,
  },
  out_of_service: {
    label: 'GHOSTED',
    tableColor: 'bg-zinc-100',
    tableBorder: 'border-zinc-300',
    chairColor: 'bg-zinc-300',
    textColor: 'text-zinc-400',
    badgeBg: 'bg-zinc-50',
    badgeText: 'text-zinc-400',
    dotClass: 'bg-zinc-300',
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
        <div key={i} className={cn('absolute w-5 h-5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]', meta.chairColor, !meta.selectable && 'opacity-40')} style={{ left: x - 10, top: y - 10 }} />
      ))}
      <div className={cn('absolute inset-[20px] border-4 flex flex-col items-center justify-center select-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]', meta.tableColor, meta.tableBorder, !meta.selectable && 'opacity-60')}>
        <Utensils className={cn('h-4 w-4 mb-0.5', meta.textColor === 'text-white' ? 'opacity-50' : 'opacity-20')} />
        <span className={cn('font-bebas text-2xl leading-none', meta.textColor)}>{tableNumber}</span>
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

  const prefillName = searchParams?.get('name') ?? '';
  const prefillPhone = searchParams?.get('phone') ?? '';
  const prefillEmail = searchParams?.get('email') ?? '';

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

  function handleSelectTable(table: BookingTable) {
    const meta = getStatusMeta(table.status);
    if (!meta.selectable) return;
    setSelectedTable(table);
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

      setConfirmedData({ 
        ...result, 
        table_number: selectedTable.table_number, 
        party_size: form.partySize, 
        date: form.reservationDate, 
        time: form.arrivalTime, 
        customer_name: form.customerName, 
        address: form.customerAddress 
      });
      setStep('confirm');
      refreshTables();
    });
  }

  const grouped = tables.reduce((acc, t) => {
    const sec = t.section || 'THE FLOOR';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(t);
    return acc;
  }, {} as Record<string, BookingTable[]>);

  const availableCount = tables.filter(t => t.status === 'available').length;

  if (!bookingEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFD200] px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md bg-white border-8 border-black p-12 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
           <XCircle className="w-24 h-24 text-[#ED1C24] mx-auto mb-6" />
           <h2 className="font-bebas text-6xl text-black leading-none mb-4">SYSTEM DOWN</h2>
           <p className="font-caveat text-3xl text-black/60">The booking squad is currently off duty. Catch us later!</p>
           <Link href="/">
             <Button className="mt-8 bg-black text-white font-bebas text-2xl tracking-widest px-8 py-4 rounded-none">BACK TO STREETS</Button>
           </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Urban Hero ── */}
      <section className="relative pt-32 pb-12 overflow-hidden bg-[#FFD200]">
        <div 
          className="absolute inset-0 bg-[#008A45]"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 70% 100%)" }}
        />
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

        <div className="container mx-auto px-4 relative z-10 text-center lg:text-left">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-block bg-black text-white px-6 py-2 border-4 border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
            <span className="font-bebas text-2xl tracking-widest flex items-center gap-2">
              <MapPin className="w-6 h-6 text-[#FFD200]" /> VEHARI CITY
            </span>
          </motion.div>

          <h1 className="font-bebas text-7xl md:text-9xl text-black leading-[0.8] mb-8">
            RESERVE THE<br/>
            <span className="text-white drop-shadow-[6px_6px_0px_rgba(0,0,0,1)]">THRONE</span>
          </h1>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            <div className="bg-white border-4 border-black px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
               {isLive ? <Wifi className="w-6 h-6 text-[#008A45]" /> : <WifiOff className="w-6 h-6 text-[#ED1C24]" />}
               <span className="font-bebas text-xl tracking-widest">{isLive ? 'LIVE CONNECTED' : 'CONNECTING...'}</span>
            </div>
            <div className="bg-black text-white border-4 border-white px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
               <span className="font-bebas text-xl tracking-widest">{availableCount} TABLES GRAB-ABLE</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Floor Plan ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          {tables.length === 0 ? (
            <div className="text-center font-bebas text-4xl text-black/20 py-20">NO TABLES ON THE BLOCK.</div>
          ) : (
            <div className="space-y-16">
              {Object.entries(grouped).map(([section, sectionTables]) => (
                <div key={section}>
                  <div className="flex items-center gap-6 mb-12">
                    <h2 className="font-bebas text-5xl text-black leading-none whitespace-nowrap">{section}</h2>
                    <div className="flex-1 h-2 bg-black shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {sectionTables.map((table) => {
                      const meta = getStatusMeta(table.status);
                      return (
                        <motion.button
                          key={table.id}
                          onClick={() => handleSelectTable(table)}
                          disabled={!meta.selectable}
                          whileHover={meta.selectable ? { scale: 1.05, rotate: 1 } : {}}
                          className={cn(
                            'relative bg-white border-8 p-6 text-center shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all',
                            meta.selectable ? 'border-black hover:bg-[#FFD200]/5' : 'border-zinc-200 opacity-50'
                          )}
                        >
                          <TableTopView capacity={table.capacity} status={table.status} tableNumber={table.table_number} />
                          
                          <div className={cn('mt-6 inline-block px-4 py-1 border-4 border-black font-bebas text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]', meta.badgeBg, meta.badgeText)}>
                            {meta.label}
                          </div>

                          <div className="mt-4 flex items-center justify-center gap-2 font-source-sans font-black text-black/40 text-sm uppercase">
                            <Users className="h-4 w-4" /><span>{table.capacity} CREW</span>
                          </div>

                          {table.status === 'reserved' && table.arrival_time && (
                            <div className="mt-2 font-bebas text-lg text-[#ED1C24] flex items-center justify-center gap-2">
                              <Clock className="h-4 w-4" />{fmt12h(table.arrival_time)}
                            </div>
                          )}

                          {meta.selectable && (
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/5 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                               <div className="bg-[#ED1C24] text-white px-4 py-2 border-4 border-black font-bebas text-xl -rotate-6">GRAB IT!</div>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Legend Section ── */}
      <section className="py-12 bg-black border-t-8 border-white">
         <div className="container mx-auto px-4 flex flex-wrap justify-center gap-8">
            {(Object.entries(STATUS_META) as [string, typeof STATUS_META[string]][]).filter(([k]) => k !== 'out_of_service').map(([status, meta]) => (
              <div key={status} className="flex items-center gap-3">
                 <div className={cn('w-6 h-6 border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)]', meta.tableColor)} />
                 <span className="font-bebas text-xl text-white tracking-widest">{meta.label}</span>
              </div>
            ))}
         </div>
      </section>

      {/* ── Booking Dialog ── */}
      <AnimatePresence>
        {dialogOpen && selectedTable && (
          <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
            <DialogContent className="max-w-5xl w-full bg-white border-[10px] border-black rounded-none p-0 overflow-hidden shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] max-h-[95vh] flex flex-col">
              
              {step === 'form' ? (
                <div className="flex flex-col lg:flex-row flex-1 min-h-0">

                  {/* Left Panel — Branding & Stats */}
                  <div className="lg:w-80 flex-shrink-0 bg-[#008A45] p-8 flex flex-col gap-6 text-white border-r-[8px] border-black">
                    <div className="bg-black p-4 border-4 border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block mx-auto transform -rotate-2">
                       <span className="font-bebas text-4xl">FIFTH AVENUE</span>
                    </div>

                    <div className="text-center py-6 border-y-4 border-white/20">
                      <div className="font-bebas text-8xl leading-none">{selectedTable.table_number}</div>
                      <div className="font-bebas text-3xl text-[#FFD200] tracking-widest mt-2 uppercase">{selectedTable.section || 'THE FLOOR'}</div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { icon: Users, label: "CAPACITY", val: `${selectedTable.capacity} SEATS` },
                        { icon: Clock, label: "HOLD TIME", val: "10 MINS" },
                        { icon: Flame, label: "STATUS", val: "AVAILABLE" },
                      ].map((item, i) => (
                        <div key={i} className="bg-black/20 border-2 border-white/10 p-4 flex items-center gap-4">
                          <item.icon className="w-6 h-6 text-[#FFD200]" />
                          <div>
                            <p className="font-bebas text-sm opacity-60 tracking-widest leading-none mb-1">{item.label}</p>
                            <p className="font-bebas text-2xl leading-none">{item.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {autoFilled && (
                       <div className="mt-auto bg-[#FFD200] text-black p-4 border-4 border-black font-bebas text-xl flex items-center gap-2">
                          <BadgeCheck className="w-6 h-6" /> SQUAD RECOGNIZED
                       </div>
                    )}
                  </div>

                  {/* Right Panel — Form */}
                  <div className="flex-1 flex flex-col min-h-0 bg-white">
                    <div className="bg-[#FFD200] px-8 py-6 border-b-[8px] border-black flex items-center justify-between">
                       <h2 className="font-bebas text-5xl leading-none text-black">THE BOOKING FORM</h2>
                       <button onClick={handleCloseDialog} className="bg-black text-white p-2 border-4 border-white"><XCircle /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                      <form onSubmit={handleSubmit} className="space-y-8">
                        
                        <div className="grid md:grid-cols-2 gap-8">
                           <div className="space-y-2">
                              <Label className="font-bebas text-2xl">YOUR NAME</Label>
                              <Input placeholder="NAME ON THE STREET" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" required />
                           </div>
                           <div className="space-y-2">
                              <Label className="font-bebas text-2xl">PHONE NUMBER</Label>
                              <Input placeholder="DIGITS" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" required />
                           </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                           <div className="space-y-2">
                              <Label className="font-bebas text-2xl">RESERVATION DATE</Label>
                              <Input type="date" min={todayStr()} max={maxDateStr()} value={form.reservationDate} onChange={(e) => setForm((f) => ({ ...f, reservationDate: e.target.value }))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" required />
                           </div>
                           <div className="space-y-2">
                              <Label className="font-bebas text-2xl">ARRIVAL TIME</Label>
                              <Input type="time" value={form.arrivalTime} onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" required />
                           </div>
                        </div>

                        <div className="space-y-4">
                           <Label className="font-bebas text-2xl">SQUAD SIZE ({form.partySize} PEOPLE)</Label>
                           <div className="flex items-center gap-6 h-20 bg-zinc-50 border-4 border-black p-4">
                              <button type="button" onClick={() => setForm((f) => ({ ...f, partySize: Math.max(1, f.partySize - 1) }))} className="w-12 h-12 bg-black text-white font-black text-3xl flex items-center justify-center hover:bg-[#ED1C24] transition-colors">−</button>
                              <div className="flex-1 h-4 bg-zinc-200 border-2 border-black relative">
                                 <div className="absolute top-0 left-0 h-full bg-[#008A45]" style={{ width: `${(form.partySize / selectedTable.capacity) * 100}%` }} />
                              </div>
                              <button type="button" onClick={() => setForm((f) => ({ ...f, partySize: Math.min(selectedTable.capacity, f.partySize + 1) }))} className="w-12 h-12 bg-black text-white font-black text-3xl flex items-center justify-center hover:bg-[#008A45] transition-colors">+</button>
                              <span className="font-bebas text-2xl w-20 text-center">MAX {selectedTable.capacity}</span>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <Label className="font-bebas text-2xl">SPECIAL VIBES / REQUESTS</Label>
                           <Textarea placeholder="CELEBRATION? PREFERRED SEATING? ALLERGIES?" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[100px] border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0 resize-none" />
                        </div>

                        <Button type="submit" disabled={isPending} className="w-full h-24 bg-black text-white rounded-none font-bebas text-5xl tracking-widest hover:bg-[#ED1C24] border-4 border-white shadow-[12px_12px_0px_0px_rgba(0,138,69,1)] hover:shadow-none transition-all">
                           {isPending ? "LOCKING IT..." : "LOCK THE TABLE"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-12 text-center bg-[#FFD200]">
                  <div className="w-32 h-32 mx-auto mb-8 bg-white border-8 border-black flex items-center justify-center transform -rotate-3 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                    <CheckCircle2 className="h-20 w-20 text-[#008A45]" />
                  </div>
                  <h2 className="font-bebas text-7xl text-black leading-none mb-4">SUCCESSFULLY GRABBED!</h2>
                  <p className="font-caveat text-4xl text-[#ED1C24] mb-12">The table is yours. Don't be late.</p>

                  <div className="bg-white border-8 border-black p-8 grid grid-cols-2 gap-8 text-left max-w-2xl mx-auto shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
                     <div className="space-y-4">
                        <ConfirmRow label="TABLE" value={`NO. ${confirmedData.table_number}`} />
                        <ConfirmRow label="DATE" value={confirmedData.date} />
                     </div>
                     <div className="space-y-4">
                        <ConfirmRow label="SQUAD" value={`${confirmedData.party_size} HEADS`} />
                        <ConfirmRow label="TIME" value={fmt12h(confirmedData.time)} />
                     </div>
                  </div>

                  <Button onClick={handleCloseDialog} className="mt-12 h-20 px-12 bg-black text-white rounded-none font-bebas text-4xl tracking-widest border-4 border-white shadow-[8px_8px_0px_0px_rgba(237,28,36,1)]">DONE</Button>
                </motion.div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bebas text-lg text-black/40 leading-none mb-1">{label}</p>
      <p className="font-bebas text-3xl text-black leading-none">{value}</p>
    </div>
  );
}
