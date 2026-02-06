'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Calendar, Download, FileText, Check, Clock,
  MoreVertical, Search, Plus, Users, RefreshCw, Eye, Banknote,
  CreditCard, Building, Trash2, TrendingUp, TrendingDown,
  Mail, UserCircle, Edit, AlertTriangle,
  CheckCircle2, Wallet, BarChart3, CircleDollarSign,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import {
  createPayslipAction, updatePayslipAction, deletePayslipAction,
  updateEmployeeSalaryAction, bulkPayPayslipsAction, bulkDeletePayslipsAction,
  getPayslipDetailAction,
} from '@/lib/actions';
import { openPayslipPDF } from '@/lib/payroll-pdf';
import type {
  PayslipServer, PayrollDashboardServer, PayrollEmployeeServer,
  PayslipsPaginatedServer, PayslipDetailServer,
} from '@/lib/server-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// =============================================
// TYPES
// =============================================

interface PayrollClientProps {
  initialDashboard: PayrollDashboardServer | null;
  initialEmployees: PayrollEmployeeServer[];
  initialPayslips: PayslipsPaginatedServer;
}

// =============================================
// CONSTANTS
// =============================================

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Pending', icon: <Clock className="h-3 w-3" /> },
  approved: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Approved', icon: <Check className="h-3 w-3" /> },
  paid: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Paid', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer', icon: <Building className="h-4 w-4" /> },
  { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'cheque', label: 'Cheque', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'jazzcash', label: 'JazzCash', icon: <Wallet className="h-4 w-4" /> },
  { value: 'easypaisa', label: 'EasyPaisa', icon: <Wallet className="h-4 w-4" /> },
];

const fmtCurrency = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
};

// =============================================
// GENERATE PAYSLIP DIALOG
// =============================================

function GeneratePayslipDialog({
  employees, open, onOpenChange, onGenerate, preSelectedEmployeeId,
}: {
  employees: PayrollEmployeeServer[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerate: (data: Record<string, any>) => Promise<void>;
  preSelectedEmployeeId?: string | null;
}) {
  const defaultForm = {
    employeeId: '', periodStart: '', periodEnd: '',
    baseSalary: 0, overtimeHours: 0, overtimeRate: 1.5,
    bonuses: 0, deductions: 0, taxAmount: 0,
    paymentMethod: 'bank_transfer', notes: '',
  };
  const [form, setForm] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate when dialog opens
  useEffect(() => {
    if (open) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];

      if (preSelectedEmployeeId) {
        const emp = employees.find(e => e.id === preSelectedEmployeeId);
        const salary = emp ? Number(emp.salary || emp.latest_payroll?.base_salary || 0) : 0;
        const bonus = emp?.latest_payroll?.bonus || 0;
        const deductions = emp?.latest_payroll?.deductions || 0;
        setForm({
          employeeId: preSelectedEmployeeId,
          periodStart: firstDay,
          periodEnd: lastDay,
          baseSalary: salary,
          overtimeHours: 0,
          overtimeRate: 1.5,
          bonuses: bonus,
          deductions: deductions,
          taxAmount: 0,
          paymentMethod: 'bank_transfer',
          notes: '',
        });
      } else {
        setForm({ ...defaultForm, periodStart: firstDay, periodEnd: lastDay });
      }
    } else {
      setForm(defaultForm);
    }
  }, [open, preSelectedEmployeeId]);

  const populateEmployee = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const salary = Number(emp.salary || emp.latest_payroll?.base_salary || 0);
    setForm(prev => ({
      ...prev,
      employeeId: empId,
      baseSalary: salary,
      bonuses: emp.latest_payroll?.bonus || 0,
      deductions: emp.latest_payroll?.deductions || 0,
    }));
  };

  const updateField = (field: string, value: any) => {
    if (field === 'employeeId') {
      populateEmployee(value);
      return;
    }
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectedEmp = useMemo(
    () => employees.find(e => e.id === form.employeeId),
    [form.employeeId, employees]
  );

  const overtimePay = form.baseSalary > 0
    ? (form.baseSalary / 30 / 8) * form.overtimeHours * form.overtimeRate
    : 0;
  const grossSalary = form.baseSalary + overtimePay + form.bonuses;
  const totalDeductions = form.deductions + form.taxAmount;
  const netSalary = grossSalary - totalDeductions;

  const handleSubmit = async () => {
    if (!form.employeeId || !form.periodStart || !form.periodEnd || form.baseSalary <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await onGenerate(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[92vh] overflow-y-auto sm:max-w-[680px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Generate Payslip
          </DialogTitle>
          <DialogDescription>Create a new payslip for an employee. Select an employee to auto-fill details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Employee *</Label>
            <Select value={form.employeeId} onValueChange={v => updateField('employeeId', v)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select employee to generate payslip" /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.status === 'active').map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{emp.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{emp.role?.replace(/_/g, ' ')}</Badge>
                      {emp.salary ? <span className="text-xs text-muted-foreground">{fmtCurrency(Number(emp.salary))}/mo</span> : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Info Card - shows when employee selected */}
          {selectedEmp && (
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-blue-200 dark:border-blue-700">
                  <AvatarImage src={selectedEmp.avatar_url || ''} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 text-sm font-bold">
                    {selectedEmp.name?.[0] || 'E'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{selectedEmp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmp.employee_id} • {selectedEmp.email}
                    {selectedEmp.phone && ` • ${selectedEmp.phone}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Current Salary</p>
                  <p className="text-sm font-bold text-primary">
                    {Number(selectedEmp.salary || 0) > 0 ? fmtCurrency(Number(selectedEmp.salary)) : 'Not set'}
                  </p>
                </div>
              </div>
              {selectedEmp.latest_payroll && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-blue-200/40 dark:border-blue-800/20">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    Last payroll: {selectedEmp.latest_payroll.month}/{selectedEmp.latest_payroll.year}
                    {' • '}{selectedEmp.latest_payroll.paid ? '✅ Paid' : '⏳ Unpaid'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Total paid: {fmtCurrency(selectedEmp.total_paid_amount)} ({selectedEmp.total_payslips} slips)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Period */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pay Period</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date *</Label>
                <Input type="date" value={form.periodStart} onChange={e => updateField('periodStart', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date *</Label>
                <Input type="date" value={form.periodEnd} onChange={e => updateField('periodEnd', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Earnings Section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> Earnings
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Base Salary *</Label>
                <Input type="number" value={form.baseSalary || ''} onChange={e => updateField('baseSalary', Number(e.target.value))} placeholder="0" className="font-medium" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bonuses / Allowances</Label>
                <Input type="number" value={form.bonuses || ''} onChange={e => updateField('bonuses', Number(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Overtime Hours</Label>
                <Input type="number" value={form.overtimeHours || ''} onChange={e => updateField('overtimeHours', Number(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Overtime Rate (×)</Label>
                <Input type="number" step="0.1" value={form.overtimeRate || ''} onChange={e => updateField('overtimeRate', Number(e.target.value))} placeholder="1.5" />
              </div>
            </div>
          </div>

          {/* Deductions Section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" /> Deductions
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Deductions</Label>
                <Input type="number" value={form.deductions || ''} onChange={e => updateField('deductions', Number(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tax Amount</Label>
                <Input type="number" value={form.taxAmount || ''} onChange={e => updateField('taxAmount', Number(e.target.value))} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Payment & Notes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => updateField('paymentMethod', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">{m.icon} {m.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Optional remarks..." rows={1} className="min-h-[38px] resize-none" />
              </div>
            </div>
          </div>

          {/* Salary Summary Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-100 via-zinc-50 to-white dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-950 border shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-center mb-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Gross Earnings</p>
                <p className="text-sm font-bold text-green-600">{fmtCurrency(grossSalary)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Deductions</p>
                <p className="text-sm font-bold text-red-500">{fmtCurrency(totalDeductions)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
                <p className="text-sm font-bold text-blue-500">{fmtCurrency(overtimePay)}</p>
              </div>
            </div>
            <Separator className="mb-3" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Net Salary</span>
              <span className={cn(
                'text-2xl font-bold',
                netSalary >= 0 ? 'text-green-600' : 'text-red-500'
              )}>{fmtCurrency(netSalary)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.employeeId || form.baseSalary <= 0} className="min-w-[140px]">
            {isSubmitting ? 'Generating...' : 'Generate Payslip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// PAYSLIP DETAILS / PREVIEW DIALOG
// =============================================

function PayslipDetailsDialog({
  payslip, open, onOpenChange, onMarkPaid, onDelete, onDownloadPDF, onSendEmail,
}: {
  payslip: PayslipServer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMarkPaid: (payslipId: string, method: string) => Promise<void>;
  onDelete: (payslipId: string) => Promise<void>;
  onDownloadPDF: (payslipId: string) => void;
  onSendEmail: (payslip: PayslipServer) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!payslip) return null;

  const status = STATUS_CONFIG[payslip.status] || STATUS_CONFIG.pending;
  const overtimePay = payslip.base_salary > 0
    ? (payslip.base_salary / 30 / 8) * payslip.overtime_hours * (payslip.overtime_rate || 1.5)
    : 0;

  return (
    <Dialog open={open} onOpenChange={v => { setConfirmDelete(false); onOpenChange(v); }}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Payslip Details
          </DialogTitle>
          <DialogDescription>
            {payslip.employee?.name} — {fmtDate(payslip.period_start)} to {fmtDate(payslip.period_end)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status + Quick Actions */}
          <div className="flex items-center justify-between">
            <Badge className={cn('gap-1 border', status.color)}>
              {status.icon} {status.label}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onDownloadPDF(payslip.id)}>
                <Download className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSendEmail(payslip)}>
                <Mail className="h-3.5 w-3.5 mr-1" /> Email
              </Button>
            </div>
          </div>

          {/* Employee Info */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={payslip.employee?.avatar_url || ''} />
                <AvatarFallback>{payslip.employee?.name?.[0] || 'E'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{payslip.employee?.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {payslip.employee?.role?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{payslip.employee?.employee_id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Salary Breakdown</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span>{fmtCurrency(payslip.base_salary)}</span>
              </div>
              {payslip.overtime_hours > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime ({payslip.overtime_hours}h × {payslip.overtime_rate}x)</span>
                  <span className="text-green-600">+{fmtCurrency(overtimePay)}</span>
                </div>
              )}
              {payslip.bonuses > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Bonuses</span><span>+{fmtCurrency(payslip.bonuses)}</span>
                </div>
              )}
              {payslip.deductions > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Deductions</span><span>-{fmtCurrency(payslip.deductions)}</span>
                </div>
              )}
              {payslip.tax_amount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Tax</span><span>-{fmtCurrency(payslip.tax_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Net Salary</span>
                <span className="text-green-600">{fmtCurrency(payslip.net_salary)}</span>
              </div>
            </div>
          </div>

          {/* Paid badge */}
          {payslip.paid_at && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Paid on {fmtDate(payslip.paid_at)}</span>
                {payslip.payment_method && (
                  <span>via {payslip.payment_method.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          )}

          {/* Payment method select for pending */}
          {payslip.status === 'pending' && (
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">{m.icon} {m.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {payslip.notes && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{payslip.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {payslip.status === 'pending' && !confirmDelete && (
            <Button variant="destructive" size="sm" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 sm:mr-auto">
              <Button
                variant="destructive" size="sm"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  await onDelete(payslip.id);
                  setIsProcessing(false);
                  onOpenChange(false);
                }}
              >
                Confirm Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {payslip.status === 'pending' && (
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                await onMarkPaid(payslip.id, paymentMethod);
                setIsProcessing(false);
                onOpenChange(false);
              }}
            >
              {isProcessing ? 'Processing...' : 'Mark as Paid'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// SALARY UPDATE DIALOG
// =============================================

function SalaryUpdateDialog({
  employee, open, onOpenChange, onUpdate,
}: {
  employee: PayrollEmployeeServer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdate: (empId: string, salary: number, freq?: string) => Promise<void>;
}) {
  const currentSalary = employee
    ? Number(employee.salary || employee.latest_payroll?.base_salary || 0)
    : 0;

  const [newSalary, setNewSalary] = useState(currentSalary);
  const [frequency, setFrequency] = useState('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync when employee changes
  const handleOpenChange = (v: boolean) => {
    if (v && employee) {
      setNewSalary(Number(employee.salary || employee.latest_payroll?.base_salary || 0));
      setFrequency(employee.latest_payroll?.payment_frequency || 'monthly');
    }
    onOpenChange(v);
  };

  if (!employee) return null;

  const diff = newSalary - currentSalary;
  const pctChange = currentSalary > 0 ? ((diff / currentSalary) * 100).toFixed(1) : '0';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" /> Update Salary
          </DialogTitle>
          <DialogDescription>
            {employee.name} — {employee.role?.replace(/_/g, ' ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border">
            <p className="text-xs text-muted-foreground mb-1">Current Salary</p>
            <p className="text-xl font-bold">{fmtCurrency(currentSalary)}</p>
          </div>

          <div className="space-y-2">
            <Label>New Salary *</Label>
            <Input
              type="number"
              value={newSalary || ''}
              onChange={e => setNewSalary(Number(e.target.value))}
              placeholder="Enter new salary"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newSalary > 0 && newSalary !== currentSalary && (
            <div className={cn(
              'p-3 rounded-lg border flex items-center gap-3',
              diff > 0
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200'
                : 'bg-red-50 dark:bg-red-900/10 border-red-200'
            )}>
              {diff > 0
                ? <TrendingUp className="h-5 w-5 text-green-600" />
                : <TrendingDown className="h-5 w-5 text-red-500" />
              }
              <div>
                <p className={cn('font-semibold text-sm', diff > 0 ? 'text-green-700' : 'text-red-600')}>
                  {diff > 0 ? '+' : ''}{fmtCurrency(diff)} ({diff > 0 ? '+' : ''}{pctChange}%)
                </p>
                <p className="text-xs text-muted-foreground">New Salary: {fmtCurrency(newSalary)}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            disabled={isSubmitting || newSalary <= 0}
            onClick={async () => {
              if (newSalary <= 0) { toast.error('Salary must be greater than 0'); return; }
              setIsSubmitting(true);
              await onUpdate(employee.id, newSalary, frequency);
              setIsSubmitting(false);
              handleOpenChange(false);
            }}
          >
            {isSubmitting ? 'Updating...' : 'Update Salary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// EMPLOYEE PAYROLL CARD
// =============================================

function EmployeePayrollCard({
  employee, onUpdateSalary, onGeneratePayslip,
}: {
  employee: PayrollEmployeeServer;
  onUpdateSalary: (emp: PayrollEmployeeServer) => void;
  onGeneratePayslip: (empId: string) => void;
}) {
  const salary = Number(employee.salary || employee.latest_payroll?.base_salary || 0);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={employee.avatar_url || ''} />
              <AvatarFallback>{employee.name?.[0] || 'E'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{employee.name}</p>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {employee.role?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {employee.employee_id} • {employee.email}
              </p>

              <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-[10px] text-muted-foreground">Salary</p>
                  <p className="text-sm font-bold text-primary">
                    {salary > 0 ? fmtCurrency(salary) : 'N/A'}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-[10px] text-muted-foreground">Total Paid</p>
                  <p className="text-sm font-bold text-green-600">
                    {fmtCurrency(employee.total_paid_amount)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-[10px] text-muted-foreground">Payslips</p>
                  <p className="text-sm font-bold">
                    {employee.total_payslips || 0}
                    {employee.pending_payslips > 0 && (
                      <span className="text-yellow-500 text-[10px] ml-1">
                        ({employee.pending_payslips} pending)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {employee.latest_payroll && (
                <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    Latest: {employee.latest_payroll.month}/{employee.latest_payroll.year}{' '}
                    • {employee.latest_payroll.payment_frequency}{' '}
                    • {employee.latest_payroll.paid ? '✅ Paid' : '⏳ Pending'}
                  </p>
                </div>
              )}

              {employee.bank_details && (employee.bank_details as any)?.bank_name && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  🏦 {(employee.bank_details as any).bank_name}
                  {(employee.bank_details as any).account_number &&
                    ` • ****${String((employee.bank_details as any).account_number).slice(-4)}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              variant="outline" size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onUpdateSalary(employee)}
            >
              <Edit className="h-3 w-3 mr-1" /> Update Salary
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onGeneratePayslip(employee.id)}
            >
              <Plus className="h-3 w-3 mr-1" /> Payslip
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =============================================
// PAYSLIP TABLE
// =============================================

function PayslipTableContent({
  payslips, isLoading, selectedIds, onToggleSelect, onViewDetails, onDownloadPDF,
}: {
  payslips: PayslipServer[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewDetails: (p: PayslipServer) => void;
  onDownloadPDF: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <DataTableWrapper
          isLoading={isLoading}
          isEmpty={payslips.length === 0}
          emptyMessage="No payslips found"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={payslips.length > 0 && payslips.every(p => selectedIds.has(p.id))}
                      onCheckedChange={checked =>
                        payslips.forEach(p => {
                          if (!!checked !== selectedIds.has(p.id)) onToggleSelect(p.id);
                        })
                      }
                    />
                  </TableHead>
                  <TableHead className="min-w-[150px]">Employee</TableHead>
                  <TableHead className="min-w-[160px]">Period</TableHead>
                  <TableHead className="text-right min-w-[100px]">Base</TableHead>
                  <TableHead className="text-right min-w-[100px]">Net Salary</TableHead>
                  <TableHead className="min-w-[90px]">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map(payslip => {
                  const st = STATUS_CONFIG[payslip.status] || STATUS_CONFIG.pending;
                  return (
                    <TableRow
                      key={payslip.id}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      onClick={() => onViewDetails(payslip)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(payslip.id)}
                          onCheckedChange={() => onToggleSelect(payslip.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={payslip.employee?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {payslip.employee?.name?.[0] || 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">
                              {payslip.employee?.name || 'Unknown'}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                              {payslip.employee?.role?.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs sm:text-sm whitespace-nowrap">
                          {fmtDate(payslip.period_start)} — {fmtDate(payslip.period_end)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">
                        {fmtCurrency(payslip.base_salary)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 text-xs sm:text-sm">
                        {fmtCurrency(payslip.net_salary)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('gap-1 text-[10px] sm:text-xs border', st.color)}>
                          {st.icon}
                          <span className="hidden sm:inline">{st.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setTimeout(() => onViewDetails(payslip), 0)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDownloadPDF(payslip.id)}>
                              <Download className="h-4 w-4 mr-2" /> Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DataTableWrapper>
      </CardContent>
    </Card>
  );
}

// =============================================
// MAIN PAYROLL CLIENT COMPONENT
// =============================================

export default function PayrollClient({
  initialDashboard,
  initialEmployees,
  initialPayslips,
}: PayrollClientProps) {
  const { employee, role } = usePortalAuth();
  const isAdmin = role === 'admin';

  // State
  const [dashboard, setDashboard] = useState<PayrollDashboardServer | null>(initialDashboard);
  const [employees, setEmployees] = useState<PayrollEmployeeServer[]>(initialEmployees);
  const [payslipsData, setPayslipsData] = useState<PayslipsPaginatedServer>(initialPayslips);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('payslips');

  // Dialogs
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateForEmployeeId, setGenerateForEmployeeId] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipServer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [salaryEmployee, setSalaryEmployee] = useState<PayrollEmployeeServer | null>(null);
  const [isSalaryOpen, setIsSalaryOpen] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Employee search
  const [empSearch, setEmpSearch] = useState('');

  // Computed
  const payslips = payslipsData.payslips || [];

  const filteredPayslips = useMemo(() => {
    return payslips.filter(p => {
      const matchSearch = !searchQuery || (p.employee?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payslips, searchQuery, statusFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e =>
      !empSearch ||
      e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.employee_id.toLowerCase().includes(empSearch.toLowerCase())
    );
  }, [employees, empSearch]);

  // ---- Handlers ----

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/payroll/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dashboard) setDashboard(data.dashboard);
        if (data.employees) setEmployees(data.employees);
        if (data.payslips) setPayslipsData(data.payslips);
        toast.success('Data refreshed');
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGeneratePayslip = async (data: Record<string, any>) => {
    const result = await createPayslipAction({
      employeeId: data.employeeId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      baseSalary: data.baseSalary,
      overtimeHours: data.overtimeHours,
      overtimeRate: data.overtimeRate,
      bonuses: data.bonuses,
      deductions: data.deductions,
      taxAmount: data.taxAmount,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      createdBy: employee?.id,
    });
    if (result.success) {
      toast.success(
        `Payslip generated for ${result.employeeName || 'employee'}! Net: ${fmtCurrency(result.netSalary || 0)}`
      );
      setIsGenerateOpen(false);
      refreshData();
    } else {
      toast.error(result.error || 'Failed to generate payslip');
    }
  };

  const handleMarkPaid = async (payslipId: string, paymentMethod: string) => {
    const result = await updatePayslipAction({ payslipId, status: 'paid', paymentMethod });
    if (result.success) {
      toast.success('Payslip marked as paid');
      refreshData();
    } else {
      toast.error(result.error || 'Failed to update payslip');
    }
  };

  const handleDelete = async (payslipId: string) => {
    const result = await deletePayslipAction(payslipId);
    if (result.success) {
      toast.success('Payslip deleted');
      refreshData();
    } else {
      toast.error(result.error || 'Failed to delete payslip');
    }
  };

  const handleUpdateSalary = async (empId: string, newSalary: number, freq?: string) => {
    const result = await updateEmployeeSalaryAction({
      employeeId: empId,
      newSalary,
      paymentFrequency: freq,
    });
    if (result.success) {
      toast.success(
        `Salary updated for ${result.employeeName}: ${fmtCurrency(result.oldSalary || 0)} → ${fmtCurrency(result.newSalary || 0)}`
      );
      refreshData();
    } else {
      toast.error(result.error || 'Failed to update salary');
    }
  };

  const handleBulkPay = async () => {
    const ids = Array.from(selectedIds);
    const pendingIds = ids.filter(id => payslips.find(p => p.id === id)?.status === 'pending');
    if (pendingIds.length === 0) { toast.error('No pending payslips selected'); return; }
    const result = await bulkPayPayslipsAction(pendingIds);
    if (result.success) {
      toast.success(`${result.paidCount} payslips marked as paid`);
      setSelectedIds(new Set());
      refreshData();
    } else {
      toast.error(result.error || 'Failed to bulk pay');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const result = await bulkDeletePayslipsAction(ids);
    if (result.success) {
      toast.success(`${result.deletedCount} payslips deleted`);
      setSelectedIds(new Set());
      refreshData();
    } else {
      toast.error(result.error || 'Failed to bulk delete');
    }
  };

  const handleDownloadPDF = async (payslipId: string) => {
    try {
      const detail: PayslipDetailServer | null = await getPayslipDetailAction(payslipId);
      if (!detail?.payslip || !detail?.employee) {
        toast.error('Failed to load payslip details for PDF');
        return;
      }
      await openPayslipPDF({
        employeeName: detail.employee.name,
        employeeId: detail.employee.employee_id,
        employeeRole: detail.employee.role,
        employeeEmail: detail.employee.email,
        employeePhone: detail.employee.phone,
        employeeAddress: detail.employee.address || undefined,
        employeeBankDetails: detail.employee.bank_details,
        employeeHiredDate: detail.employee.hired_date || undefined,
        employeeDateOfBirth: detail.employee.date_of_birth || undefined,
        employeeBloodGroup: detail.employee.blood_group || undefined,
        employeeAvatarUrl: detail.employee.avatar_url || undefined,
        employeeSalary: detail.employee.salary || undefined,
        payslipId: detail.payslip.id,
        periodStart: detail.payslip.period_start,
        periodEnd: detail.payslip.period_end,
        baseSalary: detail.payslip.base_salary,
        overtimeHours: detail.payslip.overtime_hours,
        overtimeRate: detail.payslip.overtime_rate,
        bonuses: detail.payslip.bonuses,
        deductions: detail.payslip.deductions,
        taxAmount: detail.payslip.tax_amount,
        netSalary: detail.payslip.net_salary,
        status: detail.payslip.status,
        paymentMethod: detail.payslip.payment_method || undefined,
        paidAt: detail.payslip.paid_at || undefined,
        notes: detail.payslip.notes || undefined,
        createdAt: detail.payslip.created_at,
        createdByName: detail.payslip.created_by_name || undefined,
        companyName: detail.company.name,
        companyTagline: detail.company.tagline,
        companyEmail: detail.company.email,
        companyPhone: detail.company.phone,
        companyAddress: detail.company.address,
        companyNtn: detail.company.ntn,
        companyLogoUrl: '/assets/zoiro-logo.png',
      });
    } catch {
      toast.error('Error generating PDF');
    }
  };

  const handleSendEmail = async (payslip: PayslipServer) => {
    if (!payslip.employee?.email) {
      toast.error('Employee email not available');
      return;
    }
    try {
      const res = await fetch('/api/payroll/send-slip-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payslipId: payslip.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Salary slip emailed to ${payslip.employee.email}`);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch {
      toast.error('Failed to send email');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Dashboard month-over-month change
  const momChange = dashboard && dashboard.paid_last_month > 0
    ? ((dashboard.paid_this_month - dashboard.paid_last_month) / dashboard.paid_last_month * 100).toFixed(1)
    : null;

  // ---- Render ----

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can access payroll management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <SectionHeader
        title="Payroll Management"
        description="Manage employee salaries, generate payslips, and process payments"
        icon={<CircleDollarSign className="h-6 w-6" />}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={refreshData} size="sm" className="h-8 sm:h-9" disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 sm:mr-2', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => setIsGenerateOpen(true)} size="sm" className="h-8 sm:h-9">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Generate Payslip</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      />

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <StatsCard
            title="Total Salary Budget"
            value={fmtCurrency(dashboard.total_salary_budget)}
            icon={<DollarSign className="h-5 w-5" />}
            change={`${dashboard.total_employees} active employees`}
          />
          <StatsCard
            title="Paid This Month"
            value={fmtCurrency(dashboard.paid_this_month)}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
            change={momChange ? `${Number(momChange) >= 0 ? '+' : ''}${momChange}% vs last month` : undefined}
            changeType={momChange && Number(momChange) >= 0 ? 'positive' : momChange ? 'negative' : 'neutral'}
          />
          <StatsCard
            title="Pending"
            value={fmtCurrency(dashboard.pending_amount)}
            icon={<Clock className="h-5 w-5 text-yellow-500" />}
            change={`${dashboard.pending_count} payslips`}
            changeType={dashboard.pending_count > 0 ? 'negative' : 'neutral'}
          />
          <StatsCard
            title="Avg Salary"
            value={fmtCurrency(dashboard.avg_salary)}
            icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
          />
          <StatsCard
            title="Payslips This Month"
            value={String(dashboard.payslips_this_month)}
            icon={<FileText className="h-5 w-5 text-purple-500" />}
            className="hidden lg:block"
          />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto h-auto flex-wrap">
            <TabsTrigger value="payslips" className="text-xs sm:text-sm flex-1 sm:flex-none gap-1">
              <FileText className="h-3.5 w-3.5" /> Payslips
            </TabsTrigger>
            <TabsTrigger value="employees" className="text-xs sm:text-sm flex-1 sm:flex-none gap-1">
              <Users className="h-3.5 w-3.5" /> Employees
            </TabsTrigger>
          </TabsList>

          {/* Payslip Filters */}
          {activeTab === 'payslips' && (
            <div className="flex gap-2 items-center flex-wrap">
              {selectedIds.size > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBulkPay}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Pay ({selectedIds.size})
                  </Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete ({selectedIds.size})
                  </Button>
                </div>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28 h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
            </div>
          )}

          {/* Employee Filters */}
          {activeTab === 'employees' && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="pl-10 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          )}
        </div>

        {/* Payslips Tab */}
        <TabsContent value="payslips">
          <PayslipTableContent
            payslips={filteredPayslips}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onViewDetails={p => { setSelectedPayslip(p); setIsDetailsOpen(true); }}
            onDownloadPDF={handleDownloadPDF}
          />
          {payslipsData.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {filteredPayslips.length} of {payslipsData.total_count} payslips
              </p>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(payslipsData.total_pages, 5) }, (_, i) => (
                  <Button
                    key={i}
                    variant={payslipsData.page === i + 1 ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-8 text-xs"
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => (
              <EmployeePayrollCard
                key={emp.id}
                employee={emp}
                onUpdateSalary={e => { setSalaryEmployee(e); setIsSalaryOpen(true); }}
                onGeneratePayslip={(empId) => { setGenerateForEmployeeId(empId); setIsGenerateOpen(true); }}
              />
            ))}
            {filteredEmployees.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No employees found
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GeneratePayslipDialog
        employees={employees}
        open={isGenerateOpen}
        onOpenChange={(v) => { setIsGenerateOpen(v); if (!v) setGenerateForEmployeeId(null); }}
        onGenerate={handleGeneratePayslip}
        preSelectedEmployeeId={generateForEmployeeId}
      />
      <PayslipDetailsDialog
        payslip={selectedPayslip}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
        onDownloadPDF={handleDownloadPDF}
        onSendEmail={handleSendEmail}
      />
      <SalaryUpdateDialog
        employee={salaryEmployee}
        open={isSalaryOpen}
        onOpenChange={setIsSalaryOpen}
        onUpdate={handleUpdateSalary}
      />
    </>
  );
}
