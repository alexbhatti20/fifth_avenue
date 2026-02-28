'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  Download,
  Clock,
  CheckSquare,
  Square,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings2,
  Calendar,
  FileCode2,
  FileJson,
  Layers,
  Info,
  Play,
  Trash2,
  History,
  ToggleLeft,
  ToggleRight,
  Users,
  CreditCard,
  UtensilsCrossed,
  Users2,
  Package,
  LayoutGrid,
  Tag,
  Bell,
  BarChart2,
  ShoppingBag,
  Repeat,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Employee } from '@/types/portal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TableInfo {
  name: string;
  label: string;
  description: string;
  row_count: number;
  category: string;
}

interface BackupRecord {
  id: string;
  timestamp: string;
  tables: string[];
  format: 'sql' | 'json';
  totalRecords: number;
  filename: string;
  status: 'success' | 'error';
  error?: string;
}

type ScheduleMode  = 'interval' | 'one-time';
type IntervalUnit  = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

interface AutoSchedule {
  enabled: boolean;
  mode: ScheduleMode;
  // ── Interval ──────────────────────────────────────────────────────────────
  intervalValue: number;     // e.g. 6
  intervalUnit: IntervalUnit;
  time: string;              // HH:MM  (for day / week / month alignment)
  weekday: number;           // 0 = Sun … 6 = Sat
  monthDay: number;          // 1 – 28
  // ── One-Time ──────────────────────────────────────────────────────────────
  oneTimeISO: string;        // ISO datetime string
  // ── Common ────────────────────────────────────────────────────────────────
  format: 'sql' | 'json';
  selectAll: boolean;
  selectedTables: string[];
  nextRun?: string;
  lastRun?: string;
  runCount: number;
  // legacy compat
  frequency?: 'hourly' | 'daily' | 'weekly';
}

const DEFAULT_SCHEDULE: AutoSchedule = {
  enabled: false,
  mode: 'interval',
  intervalValue: 24,
  intervalUnit: 'hours',
  time: '03:00',
  weekday: 1,
  monthDay: 1,
  oneTimeISO: '',
  format: 'sql',
  selectAll: true,
  selectedTables: [],
  runCount: 0,
};

// Ensures any schedule loaded from localStorage (which may be missing new fields) is valid
function normalizeSchedule(raw: Partial<AutoSchedule>): AutoSchedule {
  return { ...DEFAULT_SCHEDULE, ...raw };
}

const LS_HISTORY  = 'zoiro_backup_history';
const LS_SCHEDULE = 'zoiro_backup_schedule';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m1 = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
  if (m1) return decodeURIComponent(m1[2]);
  const m2 = document.cookie.match(/(^| )auth_token=([^;]+)/);
  if (m2) return decodeURIComponent(m2[2]);
  try { return localStorage.getItem('sb_access_token'); } catch { return null; }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function nextRunTime(schedule: AutoSchedule): string {
  const now = new Date();

  if (schedule.mode === 'one-time') return schedule.oneTimeISO || now.toISOString();
  // ── interval mode ──────────────────────────────────────────────────────────
  const { intervalValue = 24, intervalUnit = 'hours', time = '03:00' } = schedule;
  const [hh, mm] = time.split(':').map(Number);

  if (intervalUnit === 'minutes') {
    return new Date(now.getTime() + intervalValue * 60_000).toISOString();
  }
  if (intervalUnit === 'hours') {
    return new Date(now.getTime() + intervalValue * 3_600_000).toISOString();
  }

  // For day-aligned units, find the next occurrence at HH:MM
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm);

  if (intervalUnit === 'days') {
    if (next <= now) next.setDate(next.getDate() + intervalValue);
  } else if (intervalUnit === 'weeks') {
    const target = schedule.weekday ?? 1;
    let daysAhead = (target - now.getDay() + 7) % 7;
    if (daysAhead === 0 && next <= now) daysAhead = 7;
    next.setDate(now.getDate() + daysAhead);
  } else if (intervalUnit === 'months') {
    const target = Math.min(schedule.monthDay ?? 1, 28);
    next.setDate(target);
    if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(target); }
  }

  return next.toISOString();
}

// ── Data Groups (business-level groupings, no technical names shown) ──────────

interface DataGroup {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tables: string[];
}

const DATA_GROUPS: DataGroup[] = [
  {
    id: 'customers',
    label: 'Customer Data',
    description: 'Customer profiles, loyalty points, purchase history & reviews',
    icon: Users,
    tables: ['customers', 'customer_invoice_records', 'customer_promo_codes',
             'loyalty_points', 'loyalty_transactions', 'review_helpful_votes',
             'reviews', 'promo_code_usage'],
  },
  {
    id: 'orders',
    label: 'Order Records',
    description: 'All dine-in, online & walk-in orders with full status history',
    icon: ShoppingBag,
    tables: ['orders', 'order_status_history', 'order_cancellations',
             'order_activity_log', 'waiter_order_history', 'delivery_history'],
  },
  {
    id: 'payments',
    label: 'Payments & Billing',
    description: 'Payments, invoices, waiter tips, payslips & billing records',
    icon: CreditCard,
    tables: ['payment_records', 'invoices', 'waiter_tips', 'payment_methods', 'payslips'],
  },
  {
    id: 'menu',
    label: 'Menu & Deals',
    description: 'Menu items, categories, meals & special deals',
    icon: UtensilsCrossed,
    tables: ['menu_categories', 'menu_items', 'meals', 'deals', 'deal_items'],
  },
  {
    id: 'staff',
    label: 'Staff & HR',
    description: 'Employee records, attendance, payroll, leave & documents',
    icon: Users2,
    tables: ['employees', 'attendance', 'attendance_codes', 'employee_documents',
             'employee_payroll', 'employee_licenses', 'leave_requests', 'leave_balances'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Stock levels, suppliers, purchase orders & low-stock alerts',
    icon: Package,
    tables: ['inventory', 'inventory_transactions', 'inventory_suppliers',
             'inventory_categories', 'inventory_purchase_orders', 'inventory_alerts'],
  },
  {
    id: 'dining',
    label: 'Restaurant Tables',
    description: 'Dine-in table assignments, exchanges & seating history',
    icon: LayoutGrid,
    tables: ['restaurant_tables', 'table_history', 'table_exchange_requests'],
  },
  {
    id: 'promotions',
    label: 'Promotions & Perks',
    description: 'Promo codes and loyalty perk settings',
    icon: Tag,
    tables: ['promo_codes', 'perks_settings'],
  },
  {
    id: 'comms',
    label: 'Notifications & Messages',
    description: 'Push notifications, contact messages & push tokens',
    icon: Bell,
    tables: ['notifications', 'push_tokens', 'contact_messages'],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    description: 'Archived reports and analytics data exports',
    icon: BarChart2,
    tables: ['reports_archive'],
  },
  {
    id: 'system',
    label: 'System & Security',
    description: 'Audit logs, 2FA, password resets, maintenance & site content',
    icon: Shield,
    tables: ['audit_logs', 'otp_codes', 'two_fa_setup', 'password_reset_otps',
             'password_reset_rate_limits', 'maintenance_mode', 'site_content', 'website_content'],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface BackupClientProps {
  employee: Employee;
}

export default function BackupClient({ employee }: BackupClientProps) {
  // Tables
  const [tables, setTables]           = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing]   = useState(false);

  // Selection
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  // Options
  const [format, setFormat]           = useState<'sql' | 'json'>('sql');
  const [truncate, setTruncate]       = useState(false);
  const [onConflict, setOnConflict]   = useState<'nothing' | 'update'>('nothing');
  const [includeHeader, setIncludeHeader] = useState(true);

  // Generation
  const [generating, setGenerating]   = useState(false);
  const [progress, setProgress]       = useState<string | null>(null);

  // History
  const [history, setHistory]         = useState<BackupRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Schedule
  const [schedule, setSchedule]       = useState<AutoSchedule>(DEFAULT_SCHEDULE);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduleRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = employee.role === 'admin';

  // ── Load tables ─────────────────────────────────────────────────────────────

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError(null);
    setRpcMissing(false);
    try {
      const token = getToken();
      const res = await fetch('/api/backup/tables', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json() as {
        tables?: TableInfo[];
        grouped?: Record<string, TableInfo[]>;
        rpc_missing?: boolean;
        error?: string;
      };
      if (json.rpc_missing) {
        setRpcMissing(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTables(json.tables ?? []);
      setSelected(new Set((json.tables ?? []).map(t => t.name)));
    } catch (e) {
      setTablesError(String(e));
    } finally {
      setTablesLoading(false);
    }
  }, []);

  // ── Load stored data ─────────────────────────────────────────────────────────

  useEffect(() => {
    loadTables();
    try {
      const h = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]') as BackupRecord[];
      setHistory(h.slice(0, 50));
      const s = JSON.parse(localStorage.getItem(LS_SCHEDULE) || 'null') as Partial<AutoSchedule> | null;
      if (s) setSchedule(normalizeSchedule(s));
    } catch { /* ignore */ }
  }, [loadTables]);

  // ── Auto-schedule loop ────────────────────────────────────────────────────────

  // ── Interval / one-time timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (scheduleRef.current) clearTimeout(scheduleRef.current);
    if (!schedule.enabled) return;

    const nextISO = nextRunTime(schedule);
    if (!nextISO) return;
    const delay = Math.max(0, new Date(nextISO).getTime() - Date.now());

    scheduleRef.current = setTimeout(async () => {
      const tablesToUse = schedule.selectAll
        ? tables.map(t => t.name)
        : schedule.selectedTables;

      if (tablesToUse.length === 0) return;
      toast.info('Auto-backup running…');
      await runBackup(tablesToUse, schedule.format, false);

      if (schedule.mode === 'one-time') {
        // disable after single run
        setSchedule(prev => {
          const u = { ...prev, enabled: false, lastRun: new Date().toISOString(), runCount: (prev.runCount ?? 0) + 1 };
          localStorage.setItem(LS_SCHEDULE, JSON.stringify(u));
          return u;
        });
      } else {
        setSchedule(prev => {
          const u = { ...prev, lastRun: new Date().toISOString(), nextRun: nextRunTime(prev), runCount: (prev.runCount ?? 0) + 1 };
          localStorage.setItem(LS_SCHEDULE, JSON.stringify(u));
          return u;
        });
      }
    }, delay);

    return () => { if (scheduleRef.current) clearTimeout(scheduleRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.enabled, schedule.mode, schedule.intervalValue, schedule.intervalUnit,
      schedule.time, schedule.weekday, schedule.monthDay, schedule.oneTimeISO, tables]);

  // ── Backup execution ──────────────────────────────────────────────────────────

  const runBackup = useCallback(async (
    tablesToBackup: string[],
    fmt: 'sql' | 'json',
    showToasts = true,
  ) => {
    if (tablesToBackup.length === 0) {
      if (showToasts) toast.error('No tables selected');
      return;
    }
    setGenerating(true);
    setProgress(`Preparing backup for ${tablesToBackup.length} table(s)…`);

    const ts = new Date().toISOString();
    const filename = `zoiro-backup-${ts.slice(0, 10)}-${Date.now()}.${fmt}`;

    try {
      const token = getToken();
      setProgress('Fetching data from database…');

      const res = await fetch('/api/backup/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tables: tablesToBackup,
          format: fmt,
          truncate,
          onConflict,
          includeHeader,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      // Read blob and trigger download
      setProgress('Generating file…');
      const blob = await res.blob();
      const totalRecords = Number(res.headers.get('X-Backup-Records') || 0);
      const warnings     = res.headers.get('X-Backup-Errors') || '';

      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save to history
      const record: BackupRecord = {
        id: `${Date.now()}`,
        timestamp: ts,
        tables: tablesToBackup,
        format: fmt,
        totalRecords,
        filename,
        status: 'success',
      };
      setHistory(prev => {
        const updated = [record, ...prev].slice(0, 50);
        localStorage.setItem(LS_HISTORY, JSON.stringify(updated));
        return updated;
      });

      if (showToasts) {
        toast.success(
          `Backup downloaded – ${totalRecords.toLocaleString()} records across ${tablesToBackup.length} table(s)`,
        );
        if (warnings) toast.warning(`Warnings: ${warnings}`);
      }
    } catch (e) {
      const msg = String(e);
      const record: BackupRecord = {
        id: `${Date.now()}`,
        timestamp: ts,
        tables: tablesToBackup,
        format: fmt,
        totalRecords: 0,
        filename,
        status: 'error',
        error: msg,
      };
      setHistory(prev => {
        const updated = [record, ...prev].slice(0, 50);
        localStorage.setItem(LS_HISTORY, JSON.stringify(updated));
        return updated;
      });
      if (showToasts) toast.error(`Backup failed: ${msg}`);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }, [truncate, onConflict, includeHeader]);

  // ── Selection helpers ─────────────────────────────────────────────────────────

  const selectAll  = () => setSelected(new Set(tables.map(t => t.name)));
  const clearAll   = () => setSelected(new Set());

  // Group helpers — only show groups that have at least one loaded table
  const activeGroups = DATA_GROUPS.filter(g =>
    g.tables.some(tname => tables.find(t => t.name === tname)),
  );

  const getGroupTables = (g: DataGroup) =>
    g.tables.filter(tname => tables.find(t => t.name === tname));

  const getGroupRows = (g: DataGroup) =>
    g.tables.reduce((sum, tname) => {
      const found = tables.find(t => t.name === tname);
      return sum + (found?.row_count ?? 0);
    }, 0);

  const isGroupSelected = (g: DataGroup) => {
    const gt = getGroupTables(g);
    return gt.length > 0 && gt.every(tname => selected.has(tname));
  };

  const isGroupPartial = (g: DataGroup) => {
    const gt = getGroupTables(g);
    return gt.some(tname => selected.has(tname)) && !gt.every(tname => selected.has(tname));
  };

  const toggleGroup = (g: DataGroup) => {
    const gt = getGroupTables(g);
    const allSel = gt.every(tname => selected.has(tname));
    setSelected(prev => {
      const n = new Set(prev);
      allSel ? gt.forEach(tname => n.delete(tname)) : gt.forEach(tname => n.add(tname));
      return n;
    });
  };

  const selectedGroupCount = activeGroups.filter(g => isGroupSelected(g) || isGroupPartial(g)).length;

  // ── Schedule persist helper ───────────────────────────────────────────────────

  const saveSchedule = (s: AutoSchedule) => {
    const withNext =
      s.mode === 'one-time' ? { ...s, nextRun: s.oneTimeISO } :
                              { ...s, nextRun: nextRunTime(s) };
    setSchedule(withNext);
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(withNext));
    toast.success(s.enabled ? 'Auto-backup schedule saved & active' : 'Auto-backup disabled');
    setScheduleOpen(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedArray = Array.from(selected);
  const totalSelected = selectedArray.length;
  const selectedRows  = tables
    .filter(t => selected.has(t.name))
    .reduce((s, t) => s + t.row_count, 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-7 w-7 text-indigo-500" />
            Database Backup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate INSERT-ready SQL or JSON backups with full foreign-key ordering.
            <span className="ml-1 font-medium text-amber-500">
              {isAdmin ? 'Admin access' : 'Manager access'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-1" /> History ({history.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
            {schedule.enabled
              ? <ToggleRight className="h-4 w-4 mr-1 text-green-500" />
              : <ToggleLeft  className="h-4 w-4 mr-1 text-zinc-400" />}
            Auto-Backup
            {schedule.enabled && (
              <Badge variant="secondary" className="ml-1 text-[10px]">ON</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={loadTables} disabled={tablesLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', tablesLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-4 py-3 text-sm flex gap-2">
        <Info className="h-4 w-4 mt-0.5 text-indigo-600 shrink-0" />
        <span className="text-indigo-800 dark:text-indigo-300">
          Select the data groups you want to back up. SQL backups produce safe restore scripts that can
          re-insert all records in the correct order without duplicates.
          JSON is useful for inspecting data in spreadsheets or external tools.
        </span>
      </div>

      {/* ── RPC missing setup banner ── */}
      {rpcMissing && <RpcSetupBanner onRetry={loadTables} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Table selection ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tablesLoading ? (
              <>
                {[0,1,2,3].map(i => (
                  <div key={i} className="relative rounded-xl border bg-card py-3 px-4 overflow-hidden">
                    <div
                      className="absolute inset-0 -translate-x-full"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.07), transparent)',
                        animation: `shimmer ${1.1 + i * 0.07}s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-2.5 w-16 rounded-full bg-muted animate-pulse" />
                      <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-6 w-10 rounded-md bg-muted animate-pulse" />
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: 'Data Groups', value: activeGroups.length, icon: Layers, color: 'text-blue-500'  },
                  { label: 'Selected',    value: selectedGroupCount + ' groups', icon: CheckSquare, color: 'text-green-500' },
                  { label: 'Est. Records', value: selectedRows.toLocaleString(), icon: Database, color: 'text-purple-500' },
                  { label: 'Backups Made', value: history.filter(h => h.status === 'success').length, icon: CheckCircle2, color: 'text-emerald-500' },
                ].map(s => (
                  <Card key={s.label} className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <s.icon className={cn('h-4 w-4', s.color)} />
                    </div>
                    <div className="text-xl font-bold mt-1">{s.value}</div>
                  </Card>
                ))}
              </>
            )}
          </div>

          {/* Select all / clear */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="h-3.5 w-3.5 mr-1" /> Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Square className="h-3.5 w-3.5 mr-1" /> Clear All
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedGroupCount} / {activeGroups.length} selected · ~{selectedRows.toLocaleString()} records
            </span>
          </div>

          {/* Data group cards */}
          {tablesLoading ? (
            <div className="flex flex-col gap-4">
              {/* Animated top bar */}
              <div className="relative h-1 rounded-full overflow-hidden bg-muted">
                <div
                  className="absolute inset-y-0 left-0 w-1/2 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899, #6366f1)',
                    backgroundSize: '200% 100%',
                    animation: 'gradientSlide 1.4s linear infinite',
                  }}
                />
              </div>

              {/* Pulse label */}
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-indigo-400"
                      style={{ animation: `bounceDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
                    />
                  ))}
                </div>
                <span
                  className="text-sm font-medium"
                  style={{
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Scanning database…
                </span>
              </div>

              {/* Skeleton grid */}
              <style>{`
                @keyframes gradientSlide {
                  0%   { background-position: 200% center; }
                  100% { background-position: -200% center; }
                }
                @keyframes bounceDot {
                  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                  40%           { transform: scale(1.2); opacity: 1; }
                }
                @keyframes shimmer {
                  0%   { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
                }
              `}</style>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl border-2 border-border bg-card p-4 overflow-hidden"
                    style={{ opacity: 1 - i * 0.045 }}
                  >
                    {/* shimmer sweep */}
                    <div
                      className="absolute inset-0 -translate-x-full"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.08), transparent)',
                        animation: `shimmer ${1.2 + i * 0.05}s ease-in-out ${i * 0.08}s infinite`,
                      }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                      <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="mt-3 space-y-2">
                      <div
                        className="h-3.5 rounded-full bg-muted animate-pulse"
                        style={{ width: `${55 + (i % 4) * 12}%` }}
                      />
                      <div
                        className="h-2.5 rounded-full bg-muted/60 animate-pulse"
                        style={{ width: `${70 + (i % 3) * 10}%` }}
                      />
                      <div
                        className="h-2.5 rounded-full bg-muted/40 animate-pulse"
                        style={{ width: `${40 + (i % 5) * 8}%` }}
                      />
                    </div>
                    <div className="mt-3">
                      <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : tablesError ? (
            <div className="flex items-center justify-center h-40 text-destructive gap-2 rounded-xl border">
              <XCircle className="h-4 w-4" />
              {tablesError}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeGroups.map(g => {
                const sel     = isGroupSelected(g);
                const partial = isGroupPartial(g);
                const rows    = getGroupRows(g);
                const Icon    = g.icon;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className={cn(
                      'text-left rounded-xl border-2 p-4 transition-all hover:shadow-sm',
                      sel     && 'border-green-500 bg-green-50 dark:bg-green-950/20',
                      partial && 'border-amber-400 bg-amber-50 dark:bg-amber-950/20',
                      !sel && !partial && 'border-border bg-card hover:border-indigo-300',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn(
                        'rounded-lg p-2 shrink-0',
                        sel     ? 'bg-green-100 dark:bg-green-900/40'  :
                        partial ? 'bg-amber-100 dark:bg-amber-900/40'  :
                                  'bg-muted',
                      )}>
                        <Icon className={cn(
                          'h-4 w-4',
                          sel     ? 'text-green-600 dark:text-green-400' :
                          partial ? 'text-amber-600 dark:text-amber-400' :
                                    'text-muted-foreground',
                        )} />
                      </div>
                      <div className="shrink-0">
                        {sel ? (
                          <CheckSquare className="h-5 w-5 text-green-500" />
                        ) : partial ? (
                          <CheckSquare className="h-5 w-5 text-amber-400" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-sm leading-tight">{g.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{g.description}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge
                        variant={sel ? 'default' : 'secondary'}
                        className={cn(
                          'text-[10px]',
                          sel && 'bg-green-600 hover:bg-green-600',
                        )}
                      >
                        {rows.toLocaleString()} records
                      </Badge>
                      {partial && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">partial</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Options + Action ── */}
        <div className="flex flex-col gap-4">

          {/* Backup options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Backup Options
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Format */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Output Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['sql', 'json'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        format === f
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {f === 'sql'
                        ? <FileCode2 className="h-4 w-4" />
                        : <FileJson  className="h-4 w-4" />
                      }
                      <span className="uppercase font-semibold">{f}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* SQL-only options */}
              {format === 'sql' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">On Conflict</Label>
                    <Select
                      value={onConflict}
                      onValueChange={v => setOnConflict(v as 'nothing' | 'update')}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nothing">DO NOTHING (safe re-run)</SelectItem>
                        <SelectItem value="update">DO UPDATE (overwrite)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-medium">TRUNCATE before insert</Label>
                      <p className="text-[10px] text-muted-foreground">Clears existing rows first</p>
                    </div>
                    <Switch checked={truncate} onCheckedChange={setTruncate} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-medium">Include header comment</Label>
                      <p className="text-[10px] text-muted-foreground">Timestamp & table list at top</p>
                    </div>
                    <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
                  </div>
                </>
              )}

              {truncate && (
                <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    TRUNCATE will delete all existing rows before inserting — use with caution.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate button */}
          <Card className="border-indigo-200 dark:border-indigo-800">
            <CardContent className="pt-4 flex flex-col gap-3">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Selected tables</span>
                  <span className="font-medium">{totalSelected}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated records</span>
                  <span className="font-medium">{selectedRows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="font-medium uppercase">{format}</span>
                </div>
              </div>

              {/* ── Download button with animated gradient when generating ── */}
              <style>{`
                @keyframes gradientShift {
                  0%   { background-position: 0% 50%; }
                  50%  { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
                @keyframes progressPulse {
                  0%, 100% { opacity: 1; }
                  50%      { opacity: 0.7; }
                }
                @keyframes progressFill {
                  0%   { width: 5%; }
                  20%  { width: 35%; }
                  50%  { width: 60%; }
                  80%  { width: 85%; }
                  100% { width: 95%; }
                }
                @keyframes glowPulse {
                  0%, 100% { box-shadow: 0 0 8px 2px rgba(99,102,241,0.4); }
                  50%      { box-shadow: 0 0 18px 6px rgba(139,92,246,0.6); }
                }
              `}</style>

              {generating ? (
                <div className="flex flex-col gap-3">
                  {/* Animated gradient button (disabled look) */}
                  <div
                    className="w-full rounded-md px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-white cursor-not-allowed select-none"
                    style={{
                      background: 'linear-gradient(270deg, #6366f1, #8b5cf6, #ec4899, #6366f1)',
                      backgroundSize: '300% 300%',
                      animation: 'gradientShift 2.4s ease infinite, glowPulse 2s ease-in-out infinite',
                    }}
                  >
                    <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                    <span>{progress ?? 'Generating…'}</span>
                  </div>

                  {/* Progress track */}
                  <div className="flex flex-col gap-1.5">
                    <div className="relative h-2 rounded-full overflow-hidden bg-muted">
                      {/* base shimmer sweep */}
                      <div
                        className="absolute inset-0 -translate-x-full"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.12), transparent)',
                          animation: 'shimmer 1.4s ease-in-out infinite',
                        }}
                      />
                      {/* animated fill bar */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
                          backgroundSize: '200% 100%',
                          animation: 'progressFill 6s ease-in-out forwards, gradientSlide 1.4s linear infinite, progressPulse 1.4s ease-in-out infinite',
                        }}
                      />
                    </div>

                    {/* Bouncing dots + label */}
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                            style={{ animation: `bounceDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
                          />
                        ))}
                      </div>
                      <p
                        className="text-[10px] font-medium"
                        style={{
                          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {progress ?? 'Generating backup…'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={totalSelected === 0}
                  onClick={() => runBackup(selectedArray, format)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Schedule summary card */}
          {schedule.enabled && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-300">
                    {schedule.mode === 'interval' ? <Repeat className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    Auto-Backup Active
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}
                  >
                    {schedule.mode === 'interval' ? 'INTERVAL' : 'ONE-TIME'}
                  </span>
                </div>

                {schedule.mode === 'interval' && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Repeat</span>
                    <span className="font-medium">
                      Every {schedule.intervalValue} {schedule.intervalUnit}
                      {(['days','weeks','months'] as IntervalUnit[]).includes(schedule.intervalUnit)
                        ? ` at ${schedule.time}` : ''}
                    </span>
                  </div>
                )}

                {schedule.mode === 'one-time' && schedule.oneTimeISO && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Scheduled for</span>
                    <span className="font-medium">{fmtDate(schedule.oneTimeISO)}</span>
                  </div>
                )}

                {schedule.nextRun && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Next run</span>
                    <span>{fmtDate(schedule.nextRun)}</span>
                  </div>
                )}
                {schedule.lastRun && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Last run</span>
                    <span>{fmtDate(schedule.lastRun)}</span>
                  </div>
                )}
                {(schedule.runCount ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total runs</span>
                    <span className="font-medium">{schedule.runCount}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Security note */}
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4 text-xs text-muted-foreground flex gap-2">
              <Shield className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
              <span>
                Backup generation runs server-side. Files are streamed directly to your device and
                never stored on the server. Access is restricted to <strong>Admin</strong> and <strong>Manager</strong> roles only.
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── History Dialog ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Backup History
            </DialogTitle>
            <DialogDescription>
              Last {history.length} backups generated this session.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No backups yet.
              </div>
            ) : (
              <div className="divide-y">
                {history.map(rec => (
                  <div key={rec.id} className="px-2 py-3 flex items-start gap-3">
                    {rec.status === 'success'
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle      className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium font-mono truncate">{rec.filename}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtDate(rec.timestamp)} · {rec.tables.length} tables · {rec.totalRecords.toLocaleString()} records · <span className="uppercase">{rec.format}</span>
                      </p>
                      {rec.error && (
                        <p className="text-[10px] text-red-500 mt-0.5">{rec.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem(LS_HISTORY);
                  toast.success('History cleared');
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear History
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Auto-Schedule Dialog ── */}
      <AutoScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        schedule={schedule}
        tables={tables}
        onSave={saveSchedule}
      />
    </div>
  );
}

// ── Auto-Schedule Dialog ───────────────────────────────────────────────────────

function AutoScheduleDialog({
  open,
  onClose,
  schedule,
  tables,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  schedule: AutoSchedule;
  tables: TableInfo[];
  onSave: (s: AutoSchedule) => void;
}) {
  const [local, setLocal] = useState<AutoSchedule>(schedule);
  useEffect(() => { setLocal(schedule); }, [schedule, open]);

  const WEEKDAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // human-readable preview of the current config
  const previewText = (() => {
    if (local.mode === 'interval') {
      const u = local.intervalUnit;
      const v = local.intervalValue;
      if (u === 'minutes') return `Every ${v} minute${v !== 1 ? 's' : ''}`;
      if (u === 'hours')   return `Every ${v} hour${v !== 1 ? 's' : ''}`;
      if (u === 'days')    return `Every ${v} day${v !== 1 ? 's' : ''} at ${local.time}`;
      if (u === 'weeks')   return `Every ${WEEKDAY_LABELS[local.weekday]} at ${local.time}`;
      if (u === 'months')  return `Monthly on day ${local.monthDay} at ${local.time}`;
    }
    if (local.mode === 'one-time')
      return local.oneTimeISO ? `Once at ${fmtDate(local.oneTimeISO)}` : 'Choose a date & time';
    return '';
  })();

  const oneTimePast = local.mode === 'one-time' && local.oneTimeISO
    ? new Date(local.oneTimeISO) <= new Date()
    : false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            Advanced Auto-Backup
          </DialogTitle>
          <DialogDescription>
            Schedule automatic backups by interval or exact date/time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Enable Auto-Backup</p>
              <p className="text-xs text-muted-foreground truncate max-w-[230px]">{previewText}</p>
            </div>
            <Switch
              checked={local.enabled}
              onCheckedChange={v => setLocal(p => ({ ...p, enabled: v }))}
            />
          </div>

          {/* Mode tabs */}
          <Tabs value={local.mode} onValueChange={v => setLocal(p => ({ ...p, mode: v as ScheduleMode }))}>
            <TabsList className="grid grid-cols-2 w-full h-9">
              <TabsTrigger value="interval" className="flex items-center gap-1.5 text-xs">
                <Repeat className="h-3 w-3" /> Interval
              </TabsTrigger>
              <TabsTrigger value="one-time" className="flex items-center gap-1.5 text-xs">
                <CalendarClock className="h-3 w-3" /> One-Time
              </TabsTrigger>
            </TabsList>

            {/* ── Interval ────────────────────────────────── */}
            <TabsContent value="interval" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Every</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={local.intervalValue}
                    onChange={e => setLocal(p => ({ ...p, intervalValue: Math.max(1, Number(e.target.value)) }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Unit</Label>
                  <Select
                    value={local.intervalUnit}
                    onValueChange={v => setLocal(p => ({ ...p, intervalUnit: v as IntervalUnit }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Time — shown for day-aligned units */}
              {(['days','weeks','months'] as IntervalUnit[]).includes(local.intervalUnit) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">At time (24 h)</Label>
                  <Input
                    type="time"
                    value={local.time}
                    onChange={e => setLocal(p => ({ ...p, time: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              {/* Weekday buttons */}
              {local.intervalUnit === 'weeks' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Day of week</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLocal(p => ({ ...p, weekday: i }))}
                        className={cn(
                          'rounded-md py-1.5 text-[11px] font-bold transition-colors',
                          local.weekday === i
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground',
                        )}
                      >{d}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Month-day grid */}
              {local.intervalUnit === 'months' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Day of month</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setLocal(p => ({ ...p, monthDay: d }))}
                        className={cn(
                          'rounded text-[10px] py-1 font-semibold transition-colors',
                          local.monthDay === d
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground',
                        )}
                      >{d}</button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Day 29–31 are skipped on short months</p>
                </div>
              )}

              {/* Next run preview */}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {previewText}. Portal tab must stay open.
              </div>
            </TabsContent>

            {/* ── One-Time ──────────────────────────────── */}
            <TabsContent value="one-time" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={local.oneTimeISO ? local.oneTimeISO.slice(0, 16) : ''}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={e => {
                    try { setLocal(p => ({ ...p, oneTimeISO: new Date(e.target.value).toISOString() })); }
                    catch { /* invalid date */ }
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {local.oneTimeISO && !oneTimePast && (
                <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 flex gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Backup will run <strong>once</strong> at {fmtDate(local.oneTimeISO)}, then auto-backup disables automatically.
                </div>
              )}
              {local.oneTimeISO && oneTimePast && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  That time is in the past — pick a future date/time.
                </div>
              )}
              {!local.oneTimeISO && (
                <div className="rounded-md bg-muted border px-3 py-2 text-xs text-muted-foreground flex gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Pick an exact date and time above.
                </div>
              )}
            </TabsContent>

          </Tabs>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Format</Label>
            <Select value={local.format} onValueChange={v => setLocal(p => ({ ...p, format: v as 'sql' | 'json' }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sql">SQL (INSERT statements)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table scope */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Tables to include</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">All tables</span>
                <Switch checked={local.selectAll} onCheckedChange={v => setLocal(p => ({ ...p, selectAll: v }))} />
              </div>
            </div>
            {!local.selectAll && (
              <ScrollArea className="h-36 border rounded-md p-2">
                {DATA_GROUPS.map(g => {
                  const gt = g.tables.filter(tname => tables.find(t => t.name === tname));
                  if (gt.length === 0) return null;
                  const checked = gt.every(tname => local.selectedTables.includes(tname));
                  const Icon = g.icon;
                  return (
                    <div
                      key={g.id}
                      className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/50 px-1 rounded"
                      onClick={() => {
                        const allIn = gt.every(tname => local.selectedTables.includes(tname));
                        setLocal(p => ({
                          ...p,
                          selectedTables: allIn
                            ? p.selectedTables.filter(n => !gt.includes(n))
                            : [...new Set([...p.selectedTables, ...gt])],
                        }));
                      }}
                    >
                      {checked
                        ? <CheckSquare className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <Square      className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs font-medium">{g.label}</span>
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={local.mode === 'one-time' && (!local.oneTimeISO || oneTimePast)}
            onClick={() => onSave(local)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── RpcSetupBanner ─────────────────────────────────────────────────────────────

const SETUP_SQL = `-- Run this in your Supabase SQL Editor
-- Dashboard → https://supabase.com/dashboard/project/eqfeeiryzslccyivkphf/sql/new

CREATE OR REPLACE FUNCTION list_backup_tables()
RETURNS TABLE(table_name TEXT, row_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::TEXT, COALESCE(s.n_live_tup, 0)::BIGINT
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END; $$;
GRANT EXECUTE ON FUNCTION list_backup_tables() TO authenticated;

CREATE OR REPLACE FUNCTION get_fk_dependency_map()
RETURNS TABLE(child_table TEXT, parent_table TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT tc.table_name::TEXT, ccu.table_name::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.constraint_schema = ccu.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND tc.table_name <> ccu.table_name;
END; $$;
GRANT EXECUTE ON FUNCTION get_fk_dependency_map() TO authenticated;`;

function RpcSetupBanner({ onRetry }: { onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-base">
            One-time setup required for your Supabase project
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            The backup helper functions are not yet installed on your Supabase project&nbsp;
            <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded text-xs">eqfeeiryzslccyivkphf</code>.
            Copy the SQL below and run it once in your Supabase SQL Editor, then click Retry.
          </p>
        </div>
      </div>

      {/* Step guide */}
      <ol className="text-sm text-amber-700 dark:text-amber-400 list-decimal list-inside space-y-1 ml-1">
        <li>
          Open your Supabase dashboard →&nbsp;
          <a
            href="https://supabase.com/dashboard/project/eqfeeiryzslccyivkphf/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
          >
            SQL Editor for eqfeeiryzslccyivkphf ↗
          </a>
        </li>
        <li>Copy the SQL below and paste it into the editor</li>
        <li>Click <strong>Run</strong> in Supabase</li>
        <li>Come back here and click <strong>Retry</strong></li>
      </ol>

      {/* SQL block */}
      <div className="relative rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800">
          <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">SQL — paste into Supabase SQL Editor</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-800 dark:text-amber-200 transition-colors"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Database className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
        <pre className="text-[11px] font-mono leading-relaxed p-3 text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-56 overflow-y-auto">
          {SETUP_SQL}
        </pre>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onRetry}
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry — I ran the SQL
        </Button>
        <a
          href="https://supabase.com/dashboard/project/eqfeeiryzslccyivkphf/sql/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Open Supabase SQL Editor ↗
          </Button>
        </a>
      </div>
    </div>
  );
}
