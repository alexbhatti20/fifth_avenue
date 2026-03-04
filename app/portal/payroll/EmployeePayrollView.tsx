'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Download, FileText, Calendar, TrendingUp, DollarSign,
  Clock, CheckCircle2, AlertCircle, Banknote, CreditCard,
  Building, User, Mail, Phone, BadgeCheck, ArrowUpRight,
  ChevronDown, ChevronUp, Loader2, RefreshCw, Eye, Award,
  Briefcase, CalendarDays, Info, Star, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getMyPayslipsAction } from '@/lib/actions';
import { openPayslipPDF } from '@/lib/payroll-pdf';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MyPayslip {
  id: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  bonuses: number;
  deductions: number;
  tax_amount: number;
  net_salary: number;
  status: 'pending' | 'approved' | 'paid';
  payment_method?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

interface MyEmployee {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  salary: number;
  hired_date?: string;
  date_of_birth?: string;
  blood_group?: string;
  address?: string;
  bank_details?: Record<string, any> | null;
}

interface CompanyInfo {
  name?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  address?: string;
  ntn?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  `Rs. ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return d; }
};

const fmtMonthYear = (start: string, end: string) => {
  try {
    const s = new Date(start);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[s.getMonth()]} ${s.getFullYear()}`;
  } catch { return start; }
};

const fmtShortDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
};

const roleFmt = (r: string) =>
  r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    icon: <Clock className="h-3 w-3" />,
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: <CheckCircle2 className="h-3 w-3" />,
    dot: 'bg-blue-500',
  },
  paid: {
    label: 'Paid',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: <CheckCircle2 className="h-3 w-3" />,
    dot: 'bg-emerald-500',
  },
} as const;

const PAYMENT_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
};

// ─────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, gradient, delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="relative overflow-hidden border-0 shadow-sm">
        <div className={cn('absolute inset-0 opacity-5', gradient)} />
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-xl sm:text-2xl font-bold">{value}</p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </div>
            <div className={cn('p-2.5 rounded-xl', gradient, 'bg-opacity-15')}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Monthly Timeline Card
// ─────────────────────────────────────────────

function MonthCard({
  payslip, index, onDownload,
}: {
  payslip: MyPayslip;
  index: number;
  onDownload: (p: MyPayslip) => void;
}) {
  const cfg = STATUS_CONFIG[payslip.status] ?? STATUS_CONFIG.pending;
  const month = fmtMonthYear(payslip.period_start, payslip.period_end);
  const overtimePay = payslip.base_salary > 0
    ? (payslip.base_salary / 30 / 8) * payslip.overtime_hours * payslip.overtime_rate
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="group"
    >
      <Card className={cn(
        'relative overflow-hidden border transition-all duration-200 cursor-default',
        payslip.status === 'paid'
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
          : payslip.status === 'approved'
            ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'
            : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10',
      )}>
        {/* Paid watermark */}
        {payslip.status === 'paid' && (
          <div className="absolute top-2 right-2 opacity-10">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{month}</p>
              <p className="text-lg font-bold mt-0.5">{fmtCurrency(payslip.net_salary)}</p>
            </div>
            <Badge variant="outline" className={cn('text-xs flex items-center gap-1 h-5', cfg.color)}>
              {cfg.icon} {cfg.label}
            </Badge>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Base Salary</span>
              <span className="font-medium text-foreground">{fmtCurrency(payslip.base_salary)}</span>
            </div>
            {payslip.bonuses > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Bonuses</span>
                <span className="font-medium text-emerald-600">+{fmtCurrency(payslip.bonuses)}</span>
              </div>
            )}
            {overtimePay > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Overtime</span>
                <span className="font-medium text-blue-600">+{fmtCurrency(overtimePay)}</span>
              </div>
            )}
            {(payslip.deductions + payslip.tax_amount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Deductions</span>
                <span className="font-medium text-rose-500">-{fmtCurrency(payslip.deductions + payslip.tax_amount)}</span>
              </div>
            )}
          </div>

          {payslip.status === 'paid' && payslip.paid_at && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-emerald-500/20">
              Paid {fmtShortDate(payslip.paid_at)}
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 mt-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDownload(payslip)}
          >
            <Download className="h-3 w-3 mr-1" /> Download Slip
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Payslip Detail Dialog (read-only full breakdown)
// ─────────────────────────────────────────────

function PayslipDetailDialog({
  payslip,
  employee,
  open,
  onOpenChange,
  onDownload,
}: {
  payslip: MyPayslip | null;
  employee: MyEmployee | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDownload: (p: MyPayslip) => void;
}) {
  if (!payslip || !employee) return null;

  const cfg = STATUS_CONFIG[payslip.status] ?? STATUS_CONFIG.pending;
  const overtimePay = payslip.base_salary > 0
    ? (payslip.base_salary / 30 / 8) * payslip.overtime_hours * payslip.overtime_rate
    : 0;
  const totalEarnings = payslip.base_salary + overtimePay + payslip.bonuses;
  const totalDeductions = payslip.deductions + payslip.tax_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Payslip – {fmtMonthYear(payslip.period_start, payslip.period_end)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn('flex items-center gap-1', cfg.color)}>
              {cfg.icon} {cfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {fmtShortDate(payslip.period_start)} – {fmtShortDate(payslip.period_end)}
            </span>
          </div>

          {/* Earnings */}
          <div className="space-y-2 bg-muted/40 rounded-lg p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Earnings</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Salary</span>
              <span className="font-medium">{fmtCurrency(payslip.base_salary)}</span>
            </div>
            {overtimePay > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Overtime ({payslip.overtime_hours}h × {payslip.overtime_rate}x)
                </span>
                <span className="font-medium text-blue-600">+{fmtCurrency(overtimePay)}</span>
              </div>
            )}
            {payslip.bonuses > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonuses</span>
                <span className="font-medium text-emerald-600">+{fmtCurrency(payslip.bonuses)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total Earnings</span>
              <span>{fmtCurrency(totalEarnings)}</span>
            </div>
          </div>

          {/* Deductions */}
          {totalDeductions > 0 && (
            <div className="space-y-2 bg-rose-500/5 rounded-lg p-3 border border-rose-500/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deductions</p>
              {payslip.deductions > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="font-medium text-rose-500">-{fmtCurrency(payslip.deductions)}</span>
                </div>
              )}
              {payslip.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium text-rose-500">-{fmtCurrency(payslip.tax_amount)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold text-rose-500">
                <span>Total Deductions</span>
                <span>-{fmtCurrency(totalDeductions)}</span>
              </div>
            </div>
          )}

          {/* Net */}
          <div className="flex items-center justify-between bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Net Salary</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {fmtCurrency(payslip.net_salary)}
            </span>
          </div>

          {/* Payment info */}
          {payslip.payment_method && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium">{PAYMENT_LABEL[payslip.payment_method] ?? payslip.payment_method}</span>
            </div>
          )}
          {payslip.paid_at && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid On</span>
              <span className="font-medium">{fmtShortDate(payslip.paid_at)}</span>
            </div>
          )}
          {payslip.notes && (
            <div className="text-sm bg-muted/40 rounded p-2">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p>{payslip.notes}</p>
            </div>
          )}

          <Button className="w-full" onClick={() => onDownload(payslip)}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF Payslip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

interface EmployeePayrollViewProps {
  currentEmployee: { role: string; name?: string; email?: string };
  initialData?: {
    employee: any;
    payslips: any[];
    company: any;
  } | null;
}

export default function EmployeePayrollView({ currentEmployee, initialData }: EmployeePayrollViewProps) {
  const [employee, setEmployee] = useState<MyEmployee | null>(
    initialData?.employee ?? null
  );
  const [payslips, setPayslips] = useState<MyPayslip[]>(
    Array.isArray(initialData?.payslips) ? initialData!.payslips : []
  );
  const [company, setCompany] = useState<CompanyInfo>(
    initialData?.company ?? {}
  );
  const [loading, setLoading] = useState(!initialData);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [detailPayslip, setDetailPayslip] = useState<MyPayslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showAllSlips, setShowAllSlips] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyPayslipsAction();
      if (data && !('error' in (data as any))) {
        setEmployee(data.employee ?? null);
        setPayslips(Array.isArray(data.payslips) ? data.payslips : []);
        setCompany(data.company ?? {});
      } else {
        toast.error('Could not load payroll data');
      }
    } catch {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadPDF = async (payslip: MyPayslip) => {
    if (!employee) return;
    setDownloading(payslip.id);
    try {
      await openPayslipPDF({
        employeeName: employee.name,
        employeeId: employee.employee_id,
        employeeRole: employee.role,
        employeeEmail: employee.email,
        employeePhone: employee.phone,
        employeeAddress: employee.address,
        employeeBankDetails: employee.bank_details,
        employeeHiredDate: employee.hired_date,
        employeeDateOfBirth: employee.date_of_birth,
        employeeBloodGroup: employee.blood_group,
        employeeAvatarUrl: employee.avatar_url,
        employeeSalary: employee.salary,
        payslipId: payslip.id,
        periodStart: payslip.period_start,
        periodEnd: payslip.period_end,
        baseSalary: payslip.base_salary,
        overtimeHours: payslip.overtime_hours,
        overtimeRate: payslip.overtime_rate,
        bonuses: payslip.bonuses,
        deductions: payslip.deductions,
        taxAmount: payslip.tax_amount,
        netSalary: payslip.net_salary,
        status: payslip.status,
        paymentMethod: payslip.payment_method,
        paidAt: payslip.paid_at,
        notes: payslip.notes,
        createdAt: payslip.created_at,
        companyName: company.name,
        companyTagline: company.tagline,
        companyEmail: company.email,
        companyPhone: company.phone,
        companyAddress: company.address,
        companyNtn: company.ntn,
        companyLogoUrl: '/assets/zoiro-logo.png',
      });
    } catch {
      toast.error('Error generating PDF');
    } finally {
      setDownloading(null);
    }
  };

  // ── Derived stats ──
  const paidPayslips = payslips.filter(p => p.status === 'paid');
  const totalEarned = paidPayslips.reduce((s, p) => s + p.net_salary, 0);
  const lastPayslip = payslips[0] ?? null;
  const avgSalary = paidPayslips.length
    ? Math.round(paidPayslips.reduce((s, p) => s + p.net_salary, 0) / paidPayslips.length)
    : 0;

  const displayedPayslips = showAllSlips ? payslips : payslips.slice(0, 6);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-1 -right-1"
          >
            <Loader2 className="h-5 w-5 text-primary" />
          </motion.div>
        </div>
        <div className="text-center">
          <p className="font-semibold">Loading your payroll</p>
          <p className="text-sm text-muted-foreground">Fetching your salary records...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-8">

        {/* ── Hero / Profile Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl"
        >
          {/* Gradient bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
          <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-transparent to-red-900/10" />
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-red-500/5" />
          <div className="absolute -bottom-6 left-20 w-24 h-24 rounded-full bg-white/3" />

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-white/10 shadow-xl">
                  <AvatarImage src={employee?.avatar_url || ''} alt={employee?.name} />
                  <AvatarFallback className="bg-red-900/40 text-white text-2xl font-bold">
                    {employee?.name?.charAt(0).toUpperCase() ?? 'E'}
                  </AvatarFallback>
                </Avatar>
                {/* Shield badge */}
                <div className="absolute -bottom-1 -right-1 bg-white/10 backdrop-blur rounded-full p-1">
                  <Shield className="h-3.5 w-3.5 text-white/70" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{employee?.name ?? 'Employee'}</h1>
                  <Badge className="bg-white/10 text-white border-white/20 text-xs">
                    {roleFmt(employee?.role ?? currentEmployee.role)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {employee?.employee_id && (
                    <span className="flex items-center gap-1 text-white/60 text-xs">
                      <BadgeCheck className="h-3 w-3" /> ID: {employee.employee_id}
                    </span>
                  )}
                  {employee?.email && (
                    <span className="flex items-center gap-1 text-white/60 text-xs">
                      <Mail className="h-3 w-3" /> {employee.email}
                    </span>
                  )}
                  {employee?.phone && (
                    <span className="flex items-center gap-1 text-white/60 text-xs">
                      <Phone className="h-3 w-3" /> {employee.phone}
                    </span>
                  )}
                  {employee?.hired_date && (
                    <span className="flex items-center gap-1 text-white/60 text-xs">
                      <CalendarDays className="h-3 w-3" /> Joined {fmtDate(employee.hired_date).split(',')[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Current Salary pill */}
              <div className="shrink-0">
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 text-right">
                  <p className="text-xs text-white/60 uppercase tracking-wider">Monthly Salary</p>
                  <p className="text-2xl font-bold text-white mt-0.5">
                    {fmtCurrency(employee?.salary ?? 0)}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs text-emerald-400">Active Employee</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Page label */}
            <div className="mt-5 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-white/40" />
              <span className="text-white/40 text-sm font-medium">My Payroll — Read Only</span>
              <Info className="h-3.5 w-3.5 text-white/30" />
            </div>
          </div>
        </motion.div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Current Salary"
            value={fmtCurrency(employee?.salary ?? 0)}
            sub="Monthly base"
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
            gradient="bg-emerald-500"
            delay={0}
          />
          <StatCard
            label="Total Earned"
            value={fmtCurrency(totalEarned)}
            sub={`${paidPayslips.length} paid payslip${paidPayslips.length !== 1 ? 's' : ''}`}
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
            gradient="bg-blue-500"
            delay={0.05}
          />
          <StatCard
            label="Last Net Pay"
            value={lastPayslip ? fmtCurrency(lastPayslip.net_salary) : '—'}
            sub={lastPayslip ? fmtMonthYear(lastPayslip.period_start, lastPayslip.period_end) : undefined}
            icon={<Banknote className="h-5 w-5 text-violet-600" />}
            gradient="bg-violet-500"
            delay={0.1}
          />
          <StatCard
            label="Avg. Monthly Pay"
            value={avgSalary > 0 ? fmtCurrency(avgSalary) : '—'}
            sub="Based on paid slips"
            icon={<BarChart className="h-5 w-5 text-rose-600" />}
            gradient="bg-rose-500"
            delay={0.15}
          />
        </div>

        {/* ── Monthly Overview Grid ── */}
        {payslips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Monthly Overview
              </h2>
              <span className="text-xs text-muted-foreground">{payslips.length} payslip{payslips.length !== 1 ? 's' : ''} total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {displayedPayslips.map((p, i) => (
                <MonthCard
                  key={p.id}
                  payslip={p}
                  index={i}
                  onDownload={handleDownloadPDF}
                />
              ))}
            </div>
            {payslips.length > 6 && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAllSlips(v => !v)}
                >
                  {showAllSlips
                    ? <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
                    : <><ChevronDown className="h-3 w-3 mr-1" /> Show All {payslips.length} Months</>}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Payslip Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  All Payslips
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={fetchData}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {payslips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Wallet className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No payslips yet</p>
                  <p className="text-xs mt-1">Your payslips will appear here once processed</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs text-right">Base Salary</TableHead>
                        <TableHead className="text-xs text-right">Overtime</TableHead>
                        <TableHead className="text-xs text-right">Bonuses</TableHead>
                        <TableHead className="text-xs text-right">Deductions</TableHead>
                        <TableHead className="text-xs text-right">Tax</TableHead>
                        <TableHead className="text-xs text-right font-semibold">Net Pay</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payslips.map((p, i) => {
                        const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
                        const overtimePay = p.base_salary > 0
                          ? (p.base_salary / 30 / 8) * p.overtime_hours * p.overtime_rate
                          : 0;
                        const isDownloading = downloading === p.id;

                        return (
                          <motion.tr
                            key={p.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className="group hover:bg-muted/40 transition-colors"
                          >
                            <TableCell className="py-2.5">
                              <div>
                                <p className="text-xs font-semibold">
                                  {fmtMonthYear(p.period_start, p.period_end)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtShortDate(p.period_start)} – {fmtShortDate(p.period_end)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-mono">
                              {fmtCurrency(p.base_salary)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-mono">
                              {overtimePay > 0
                                ? <span className="text-blue-600">+{fmtCurrency(overtimePay)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-mono">
                              {p.bonuses > 0
                                ? <span className="text-emerald-600">+{fmtCurrency(p.bonuses)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-mono">
                              {p.deductions > 0
                                ? <span className="text-rose-500">-{fmtCurrency(p.deductions)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-mono">
                              {p.tax_amount > 0
                                ? <span className="text-rose-500">-{fmtCurrency(p.tax_amount)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className="text-sm font-bold">{fmtCurrency(p.net_salary)}</span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className={cn('text-xs flex items-center gap-1 w-fit', cfg.color)}>
                                {cfg.icon} {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                              {p.payment_method ? (PAYMENT_LABEL[p.payment_method] ?? p.payment_method) : '—'}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1 justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => { setDetailPayslip(p); setIsDetailOpen(true); }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-primary hover:text-primary"
                                      onClick={() => handleDownloadPDF(p)}
                                      disabled={isDownloading}
                                    >
                                      {isDownloading
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Download className="h-3.5 w-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Download PDF Payslip</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Bank Details Card ── */}
        {employee?.bank_details && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  Bank Details on File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {Object.entries(employee.bank_details).map(([k, v]) =>
                    v ? (
                      <div key={k}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {k.replace(/_/g, ' ')}
                        </p>
                        <p className="font-medium">{String(v)}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Footer Notice ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground"
        >
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            This is a read-only view of your personal payroll records.
            For any discrepancies or queries, please contact your manager or HR admin.
            All payslip PDFs are generated with the company&apos;s official branding and are valid for official use.
          </p>
        </motion.div>

      </div>

      {/* Detail Dialog */}
      <PayslipDetailDialog
        payslip={detailPayslip}
        employee={employee}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onDownload={handleDownloadPDF}
      />
    </TooltipProvider>
  );
}

// ─── tiny standalone icon (avoid extra lucide import) ───
function BarChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="17" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
