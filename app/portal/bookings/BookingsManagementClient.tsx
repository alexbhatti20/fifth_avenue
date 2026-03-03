'use client';

// =============================================
// PORTAL BOOKINGS MANAGEMENT â€” FULL CRUD
// Admin / Manager: Create Â· Read Â· Edit Â· Cancel Â· Delete
// =============================================

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  CalendarDays, Users, Clock, Phone, Mail, RefreshCw, Plus,
  X, Ban, Search, Loader2, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getAdminReservationsAction,
  cancelTableReservationAction,
  toggleOnlineBookingAction,
  createTableReservationAction,
  updateReservationStatusAction,
  deleteReservationAction,
  getTablesForBookingAction,
  type AdminReservation,
  type TableForBooking,
} from '@/lib/actions';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  initialReservations: AdminReservation[];
  initialTotal: number;
  initialBookingEnabled: boolean;
  prefillCustomerName?: string;
  prefillCustomerPhone?: string;
  prefillCustomerEmail?: string;
}

// â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_META: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  confirmed: { label: 'Confirmed', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700', dotClass: 'bg-emerald-500' },
  pending:   { label: 'Pending',   badgeClass: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700', dotClass: 'bg-amber-400' },
  arrived:   { label: 'Arrived',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700', dotClass: 'bg-blue-500' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-100 text-red-600 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800', dotClass: 'bg-red-500' },
  expired:   { label: 'Expired',   badgeClass: 'bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700', dotClass: 'bg-zinc-400' },
};

function todayIso() { return new Date().toISOString().slice(0, 10); }

/** Convert HH:MM or HH:MM:SS (24-h) string → 12-h h:mm AM/PM */
function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function BookingsManagementClient({
  initialReservations,
  initialTotal,
  initialBookingEnabled,
  prefillCustomerName = '',
  prefillCustomerPhone = '',
  prefillCustomerEmail = '',
}: Props) {
  // List state
  const [reservations, setReservations] = useState<AdminReservation[]>(initialReservations);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, startLoading] = useTransition();

  // Booking toggle
  const [bookingEnabled, setBookingEnabled] = useState(initialBookingEnabled);
  const [isToggling, setIsToggling] = useState(false);

  // Available tables
  const [tables, setTables] = useState<TableForBooking[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // CREATE dialog
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, startCreate] = useTransition();
  const emptyCreate = useCallback(() => ({
    tableId: '',
    customerName: prefillCustomerName,
    customerPhone: prefillCustomerPhone,
    customerEmail: prefillCustomerEmail,
    reservationDate: todayIso(),
    arrivalTime: '',
    partySize: '2',
    notes: '',
  }), [prefillCustomerName, prefillCustomerPhone, prefillCustomerEmail]);
  const [createForm, setCreateForm] = useState(emptyCreate);

  // EDIT dialog
  const [editTarget, setEditTarget] = useState<AdminReservation | null>(null);
  const [isEditing, startEdit] = useTransition();
  const [editForm, setEditForm] = useState({
    status: 'confirmed' as AdminReservation['status'],
    reservationDate: '',
    arrivalTime: '',
    partySize: '',
    notes: '',
  });

  // Cancel / Delete confirmations
  const [cancelTarget, setCancelTarget] = useState<AdminReservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReservation | null>(null);
  const [isActioning, startAction] = useTransition();

  // Auto-open create dialog when navigated from customer drawer (?name=&phone=&email=)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const name  = params.get('name')  ?? '';
    const phone = params.get('phone') ?? '';
    const email = params.get('email') ?? '';
    if (phone) {
      setCreateForm((f) => ({
        ...f,
        customerName:  name  || f.customerName,
        customerPhone: phone,
        customerEmail: email || f.customerEmail,
      }));
      setShowCreate(true);
      loadTables();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReservations = useCallback((status?: string, date?: string) => {
    startLoading(async () => {
      const res = await getAdminReservationsAction({
        status: !status || status === 'all' ? undefined : status,
        date: date || undefined,
        limit: 200,
      });
      if (res.success) {
        setReservations(res.reservations);
        setTotal(res.total);
      } else {
        toast.error(res.error ?? 'Failed to load reservations');
      }
    });
  }, []);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    const res = await getTablesForBookingAction();
    setTablesLoading(false);
    if (res.success) setTables(res.tables);
  }, []);

  // ── Realtime: refresh table picker when the create dialog is open ──────────
  // Reuses the same managed-tables channel that TablesClient uses — no extra WS
  // connection is opened; the manager deduplicates via ref-counting.
  const loadTablesRef = useRef(loadTables);
  useEffect(() => { loadTablesRef.current = loadTables; }, [loadTables]);

  useEffect(() => {
    if (!showCreate) return; // only subscribe while dialog is open

    const handler = () => loadTablesRef.current();
    const unsubscribe = realtimeManager.subscribe(
      CHANNEL_NAMES.TABLES,
      'restaurant_tables',
      handler,
      { event: '*' },
    );

    return unsubscribe; // decrements ref count; channel torn down when no more listeners
  }, [showCreate]);

  // â”€â”€ Toggle booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleToggleBooking = async (val: boolean) => {
    setIsToggling(true);
    setBookingEnabled(val);
    const res = await toggleOnlineBookingAction(val);
    setIsToggling(false);
    if (res.success) {
      toast.success(`Online booking ${val ? 'enabled' : 'disabled'}`);
    } else {
      setBookingEnabled(!val);
      toast.error(res.error ?? 'Failed to update setting');
    }
  };

  // â”€â”€ CREATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openCreate = async () => {
    setCreateForm(emptyCreate());
    setShowCreate(true);
    await loadTables();
  };

  const handleCreate = () => {
    const f = createForm;
    if (!f.tableId) { toast.error('Select a table'); return; }
    if (!f.customerName.trim()) { toast.error('Customer name required'); return; }
    if (!f.customerPhone.trim()) { toast.error('Customer phone required'); return; }
    if (!f.reservationDate) { toast.error('Date required'); return; }
    if (!f.arrivalTime) { toast.error('Arrival time required'); return; }
    startCreate(async () => {
      const res = await createTableReservationAction({
        tableId: f.tableId,
        customerName: f.customerName.trim(),
        customerPhone: f.customerPhone.trim(),
        customerEmail: f.customerEmail.trim() || undefined,
        reservationDate: f.reservationDate,
        arrivalTime: f.arrivalTime,
        partySize: parseInt(f.partySize) || 2,
        notes: f.notes.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Reservation created â€” Table ${res.table_number}`);
        setShowCreate(false);
        fetchReservations(statusFilter, dateFilter);
      } else {
        toast.error(res.error ?? 'Failed to create reservation');
      }
    });
  };

  // â”€â”€ EDIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openEdit = (r: AdminReservation) => {
    setEditTarget(r);
    setEditForm({
      status: r.status,
      reservationDate: r.reservation_date,
      arrivalTime: r.arrival_time?.slice(0, 5) ?? '',
      partySize: String(r.party_size),
      notes: r.notes ?? '',
    });
  };

  const handleEdit = () => {
    if (!editTarget) return;
    startEdit(async () => {
      const res = await updateReservationStatusAction({
        reservationId: editTarget.id,
        status: editForm.status,
        notes: editForm.notes || undefined,
        arrivalTime: editForm.arrivalTime || undefined,
        reservationDate: editForm.reservationDate || undefined,
        partySize: parseInt(editForm.partySize) || undefined,
      });
      if (res.success) {
        toast.success('Reservation updated');
        setEditTarget(null);
        fetchReservations(statusFilter, dateFilter);
      } else {
        toast.error(res.error ?? 'Failed to update');
      }
    });
  };

  // â”€â”€ CANCEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const confirmCancel = () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setCancelTarget(null);
    startAction(async () => {
      const res = await cancelTableReservationAction(id);
      if (res.success) {
        toast.success('Reservation cancelled');
        fetchReservations(statusFilter, dateFilter);
      } else {
        toast.error(res.error ?? 'Failed to cancel');
      }
    });
  };

  // â”€â”€ DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startAction(async () => {
      const res = await deleteReservationAction(id);
      if (res.success) {
        toast.success('Reservation deleted');
        fetchReservations(statusFilter, dateFilter);
      } else {
        toast.error(res.error ?? 'Failed to delete');
      }
    });
  };

  // â”€â”€ Filtered + stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filtered = reservations.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customer_name.toLowerCase().includes(q) ||
      r.customer_phone.includes(q) ||
      String(r.table_number).includes(q) ||
      (r.customer_email ?? '').toLowerCase().includes(q)
    );
  });

  const stats = {
    total,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    pending:   reservations.filter((r) => r.status === 'pending').length,
    arrived:   reservations.filter((r) => r.status === 'arrived').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
            Bookings Management
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} total reservation{total !== 1 ? 's' : ''} â€” Create Â· Edit Â· Cancel Â· Delete
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-card shadow-sm">
            <Switch id="bk-toggle" checked={bookingEnabled} onCheckedChange={handleToggleBooking} disabled={isToggling} />
            <Label htmlFor="bk-toggle" className="text-xs font-semibold cursor-pointer select-none">
              <span className={bookingEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                {bookingEnabled ? 'Booking ON' : 'Booking OFF'}
              </span>
            </Label>
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchReservations(statusFilter, dateFilter)} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            size="sm"
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white shadow-md"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Booking
          </Button>
        </div>
      </div>

      {/* â”€â”€ Stat cards (clickable filters) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { label: 'Total',     key: 'all',       value: stats.total,     color: 'text-slate-700 dark:text-slate-200',   bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          { label: 'Confirmed', key: 'confirmed',  value: stats.confirmed, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
          { label: 'Pending',   key: 'pending',    value: stats.pending,   color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' },
          { label: 'Arrived',   key: 'arrived',    value: stats.arrived,   color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
          { label: 'Cancelled', key: 'cancelled',  value: stats.cancelled, color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' },
        ] as const).map((s) => (
          <button
            key={s.key}
            onClick={() => { setStatusFilter(s.key); fetchReservations(s.key, dateFilter); }}
            className={cn(
              'rounded-xl p-3 border text-left transition-all hover:scale-[1.02] hover:shadow-md',
              s.bg,
              statusFilter === s.key && 'ring-2 ring-offset-1 ring-orange-400 dark:ring-offset-zinc-900',
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-2xl font-extrabold', s.color)}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email, tableâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); fetchReservations(v, dateFilter); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <span className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', v.dotClass)} />
                  {v.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); fetchReservations(statusFilter, e.target.value); }}
          className="w-44"
        />

        {(statusFilter !== 'all' || dateFilter || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setDateFilter(''); setSearch(''); fetchReservations('all', ''); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* â”€â”€ List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loadingâ€¦
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold">No reservations found</p>
          <p className="text-sm mt-1 opacity-70">
            {statusFilter !== 'all' || dateFilter || search ? 'Try clearing the filters' : 'Click "New Booking" to create one'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
          <AnimatePresence initial={false}>
            {filtered.map((r, i) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.expired;
              const canEdit   = r.status !== 'expired';
              const canCancel = r.status === 'confirmed' || r.status === 'pending';
              const canDelete = r.status === 'cancelled' || r.status === 'expired';
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.3) }}
                  className="rounded-xl border bg-card shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Table badge */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex flex-col items-center justify-center text-white shadow">
                    <span className="text-[9px] font-bold opacity-75 uppercase tracking-widest">TBL</span>
                    <span className="text-xl font-extrabold leading-none">{r.table_number}</span>
                    {r.capacity && <span className="text-[9px] opacity-75">cap {r.capacity}</span>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{r.customer_name}</span>
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0 h-5 font-semibold border flex items-center gap-1', meta.badgeClass)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotClass)} />
                        {meta.label}
                      </Badge>
                      {r.section && <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{r.section}</span>}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{r.reservation_date} at {r.arrival_time ? fmt12h(r.arrival_time) : '—'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{r.party_size} guest{r.party_size !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{r.customer_phone}</span>
                      {r.customer_email && <span className="flex items-center gap-1 max-w-[200px] truncate"><Mail className="h-3.5 w-3.5 flex-shrink-0" />{r.customer_email}</span>}
                    </div>

                    {r.notes && <p className="text-xs text-muted-foreground italic">"{r.notes}"</p>}
                    {r.auto_release_at && canCancel && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Auto-releases {format(new Date(r.auto_release_at), 'MMM d, h:mm a')}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">Created {format(new Date(r.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    {canEdit && (
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                    )}
                    {canCancel && (
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={() => setCancelTarget(r)} disabled={isActioning}>
                        <Ban className="h-3.5 w-3.5 mr-1" />Cancel
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs border-zinc-300 text-zinc-500 hover:bg-zinc-50 hover:text-red-600 hover:border-red-300 dark:border-zinc-700" onClick={() => setDeleteTarget(r)} disabled={isActioning}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CREATE DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
            <DialogDescription>Create a table booking on behalf of a customer</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Table * <span className="text-muted-foreground font-normal">(live status)</span></Label>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Available
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1.5" />Reserved
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-1.5" />Occupied
                </span>
              </div>
              {tablesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 pl-1">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading live table status…
                </div>
              ) : tables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 pl-1">No tables configured.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-44 overflow-y-auto pr-1 py-1">
                  {tables.map((t) => {
                    const isAvailable = t.status === 'available';
                    const isSelected  = createForm.tableId === t.id;
                    const statusColor =
                      t.status === 'available' ? 'bg-emerald-500' :
                      t.status === 'reserved'   ? 'bg-amber-400'  : 'bg-red-500';

                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setCreateForm((f) => ({ ...f, tableId: t.id }))}
                        className={cn(
                          'relative flex flex-col items-center justify-center rounded-xl border-2 p-2 text-center transition-all duration-150 select-none',
                          isAvailable ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-not-allowed opacity-50',
                          isSelected
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-md ring-2 ring-orange-400 ring-offset-1 dark:ring-offset-zinc-900'
                            : isAvailable
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 hover:border-orange-300'
                            : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900',
                        )}
                      >
                        <span className={cn('absolute top-1.5 right-1.5 w-2 h-2 rounded-full', statusColor)} />
                        <span className={cn(
                          'text-lg font-extrabold leading-none',
                          isSelected ? 'text-orange-600 dark:text-orange-400' :
                          isAvailable ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'
                        )}>
                          {t.table_number}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground mt-0.5 flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />{t.capacity}
                        </span>
                        {t.section && (
                          <span className="text-[8px] text-muted-foreground/70 truncate max-w-full px-1">{t.section}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {createForm.tableId && (() => {
                const sel = tables.find((t) => t.id === createForm.tableId);
                return sel ? (
                  <p className="text-xs text-muted-foreground pl-1">
                    Selected: <span className="font-semibold text-foreground">Table {sel.table_number}</span>
                    {sel.section ? ` — ${sel.section}` : ''} · max {sel.capacity} guests
                  </p>
                ) : null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Customer Name *</Label>
                <Input placeholder="John Doe" value={createForm.customerName} onChange={(e) => setCreateForm((f) => ({ ...f, customerName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone *</Label>
                <Input placeholder="+92 300 0000000" value={createForm.customerPhone} onChange={(e) => setCreateForm((f) => ({ ...f, customerPhone: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">Email (optional)</Label>
                <Input type="email" placeholder="customer@email.com" value={createForm.customerEmail} onChange={(e) => setCreateForm((f) => ({ ...f, customerEmail: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date *</Label>
                <Input type="date" value={createForm.reservationDate} onChange={(e) => setCreateForm((f) => ({ ...f, reservationDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Arrival Time *</Label>
                <Input type="time" value={createForm.arrivalTime} onChange={(e) => setCreateForm((f) => ({ ...f, arrivalTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Guests</Label>
                <Input type="number" min={1} max={20} value={createForm.partySize} onChange={(e) => setCreateForm((f) => ({ ...f, partySize: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes (optional)</Label>
              <Textarea placeholder="Special requests, occasionâ€¦" rows={2} value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarDays className="h-4 w-4 mr-2" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• EDIT DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
            {editTarget && <DialogDescription>Table {editTarget.table_number} Â· {editTarget.customer_name}</DialogDescription>}
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as AdminReservation['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', v.dotClass)} />{v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date</Label>
                  <Input type="date" value={editForm.reservationDate} onChange={(e) => setEditForm((f) => ({ ...f, reservationDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Time</Label>
                  <Input type="time" value={editForm.arrivalTime} onChange={(e) => setEditForm((f) => ({ ...f, arrivalTime: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Guests</Label>
                  <Input type="number" min={1} max={20} value={editForm.partySize} onChange={(e) => setEditForm((f) => ({ ...f, partySize: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes</Label>
                <Textarea placeholder="Special requestsâ€¦" rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Close</Button>
            <Button onClick={handleEdit} disabled={isEditing} className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
              {isEditing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Cancel confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel reservation for <span className="font-semibold text-foreground">{cancelTarget?.customer_name}</span> at Table {cancelTarget?.table_number}?
              The table will be freed automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700 text-white">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* â”€â”€ Delete confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete the <span className="font-semibold">{deleteTarget?.status}</span> reservation for{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.customer_name}</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep record</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              <Trash2 className="h-4 w-4 mr-1.5" />Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
