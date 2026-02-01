'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Calendar,
  Download,
  FileText,
  Check,
  Clock,
  MoreVertical,
  Search,
  Plus,
  Users,
  RefreshCw,
  Eye,
  Banknote,
  CreditCard,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { 
  getPayslips, 
  createPayslip, 
  updatePayslipStatus,
  getPayrollSummary,
  getAllEmployees,
  type Payslip,
  type PayrollSummary as PayrollSummaryType,
} from '@/lib/portal-queries';
import type { Employee } from '@/types/portal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PayrollClientProps {
  initialPayslips: Payslip[];
  initialEmployees: Employee[];
  initialSummary: PayrollSummaryType | null;
}

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500', label: 'Pending', icon: <Clock className="h-3 w-3" /> },
  approved: { color: 'bg-blue-500/10 text-blue-500', label: 'Approved', icon: <Check className="h-3 w-3" /> },
  paid: { color: 'bg-green-500/10 text-green-500', label: 'Paid', icon: <Check className="h-3 w-3" /> },
};

// Generate Payslip Dialog
function GeneratePayslipDialog({
  employees,
  open,
  onOpenChange,
  onGenerate,
}: {
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    overtimeHours: number;
    bonuses: number;
    deductions: number;
    taxAmount: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [baseSalary, setBaseSalary] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [bonuses, setBonuses] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default period (current month)
  useEffect(() => {
    if (open) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setPeriodStart(firstDay.toISOString().split('T')[0]);
      setPeriodEnd(lastDay.toISOString().split('T')[0]);
    }
  }, [open]);

  // Update salary when employee changes
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp?.salary) {
        setBaseSalary(Number(emp.salary));
      }
    }
  }, [selectedEmployeeId, employees]);

  const calculateNetSalary = () => {
    const overtimePay = (baseSalary / 30 / 8) * overtimeHours * 1.5;
    return baseSalary + overtimePay + bonuses - deductions - taxAmount;
  };

  const handleSubmit = async () => {
    if (!selectedEmployeeId || !periodStart || !periodEnd || baseSalary <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await onGenerate({
        employeeId: selectedEmployeeId,
        periodStart,
        periodEnd,
        baseSalary,
        overtimeHours,
        bonuses,
        deductions,
        taxAmount,
        notes: notes || undefined,
      });
      // Reset form
      setSelectedEmployeeId('');
      setBaseSalary(0);
      setOvertimeHours(0);
      setBonuses(0);
      setDeductions(0);
      setTaxAmount(0);
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Payslip</DialogTitle>
          <DialogDescription>Create a new payslip for an employee</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} - {emp.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start *</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Period End *</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Salary */}
          <div className="space-y-2">
            <Label>Base Salary *</Label>
            <Input
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(Number(e.target.value))}
              placeholder="Enter base salary"
            />
          </div>

          {/* Overtime */}
          <div className="space-y-2">
            <Label>Overtime Hours</Label>
            <Input
              type="number"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(Number(e.target.value))}
              placeholder="0"
            />
          </div>

          {/* Bonuses & Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bonuses</Label>
              <Input
                type="number"
                value={bonuses}
                onChange={(e) => setBonuses(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Deductions</Label>
              <Input
                type="number"
                value={deductions}
                onChange={(e) => setDeductions(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Tax */}
          <div className="space-y-2">
            <Label>Tax Amount</Label>
            <Input
              type="number"
              value={taxAmount}
              onChange={(e) => setTaxAmount(Number(e.target.value))}
              placeholder="0"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          {/* Net Salary Preview */}
          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Net Salary</span>
              <span className="text-xl font-bold text-green-600">
                Rs. {calculateNetSalary().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Generating...' : 'Generate Payslip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Payslip Details Dialog
function PayslipDetailsDialog({
  payslip,
  open,
  onOpenChange,
  onMarkPaid,
}: {
  payslip: Payslip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkPaid: (payslipId: string, paymentMethod: string) => Promise<void>;
}) {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!payslip) return null;

  const status = STATUS_CONFIG[payslip.status] || STATUS_CONFIG.pending;

  const handleMarkPaid = async () => {
    setIsProcessing(true);
    try {
      await onMarkPaid(payslip.id, paymentMethod);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
          <DialogDescription>
            {payslip.employee?.name} - {new Date(payslip.period_start).toLocaleDateString()} to {new Date(payslip.period_end).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Badge */}
          <div className="flex justify-between items-center">
            <Badge className={cn('gap-1', status.color)}>
              {status.icon}
              {status.label}
            </Badge>
            {payslip.paid_at && (
              <span className="text-sm text-muted-foreground">
                Paid on {new Date(payslip.paid_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Employee Info */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <p className="text-xs text-muted-foreground mb-1">Employee</p>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{payslip.employee?.name?.[0] || 'E'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{payslip.employee?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{payslip.employee?.role}</p>
              </div>
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Breakdown</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span>Rs. {payslip.base_salary?.toLocaleString()}</span>
              </div>
              {payslip.overtime_hours > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime ({payslip.overtime_hours}h)</span>
                  <span>Rs. {((payslip.base_salary / 30 / 8) * payslip.overtime_hours * (payslip.overtime_rate || 1.5)).toLocaleString()}</span>
                </div>
              )}
              {payslip.bonuses > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Bonuses</span>
                  <span>+Rs. {payslip.bonuses.toLocaleString()}</span>
                </div>
              )}
              {payslip.deductions > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Deductions</span>
                  <span>-Rs. {payslip.deductions.toLocaleString()}</span>
                </div>
              )}
              {payslip.tax_amount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Tax</span>
                  <span>-Rs. {payslip.tax_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Net Salary</span>
                <span className="text-green-600">Rs. {payslip.net_salary?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selection (for pending payslips) */}
          {payslip.status === 'pending' && (
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Bank Transfer
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      Cash
                    </div>
                  </SelectItem>
                  <SelectItem value="cheque">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cheque
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          {payslip.notes && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{payslip.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {payslip.status === 'pending' && (
            <Button onClick={handleMarkPaid} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Mark as Paid'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Payroll Summary Component
function PayrollSummaryCard({ summary }: { summary: PayrollSummaryType | null }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatsCard
        title="Total Payroll"
        value={`Rs. ${(summary.total_payroll || 0).toLocaleString()}`}
        icon={<DollarSign className="h-5 w-5" />}
      />
      <StatsCard
        title="Pending"
        value={`Rs. ${(summary.pending_amount || 0).toLocaleString()}`}
        icon={<Clock className="h-5 w-5 text-yellow-500" />}
        change={`${summary.pending_count} payslips`}
      />
      <StatsCard
        title="Paid This Month"
        value={`Rs. ${(summary.paid_this_month || 0).toLocaleString()}`}
        icon={<Check className="h-5 w-5 text-green-500" />}
      />
      <StatsCard
        title="Active Employees"
        value={summary.employees_count || 0}
        icon={<Users className="h-5 w-5" />}
      />
    </div>
  );
}

// Main Payroll Client Component
export default function PayrollClient({
  initialPayslips,
  initialEmployees,
  initialSummary,
}: PayrollClientProps) {
  const { employee } = usePortalAuth();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees.filter(e => e.status === 'active'));
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips);
  const [summary, setSummary] = useState<PayrollSummaryType | null>(initialSummary);
  const [isLoading, setIsLoading] = useState(initialPayslips.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [payslipsData, employeesData, summaryData] = await Promise.all([
        getPayslips({ limit: 100 }),
        getAllEmployees(),
        getPayrollSummary(),
      ]);
      setPayslips(payslipsData);
      // Filter to active employees only
      setEmployees(employeesData.filter(e => e.status === 'active'));
      setSummary(summaryData);
    } catch (error) {
      
      toast.error('Failed to load payroll data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial fetch if we have server-provided data
    if (initialPayslips.length > 0) return;
    fetchData();
  }, [fetchData, initialPayslips.length]);

  const filteredPayslips = payslips.filter((payslip) => {
    const matchesSearch = (payslip.employee?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payslip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleGeneratePayslip = async (data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    overtimeHours: number;
    bonuses: number;
    deductions: number;
    taxAmount: number;
    notes?: string;
  }) => {
    const result = await createPayslip(data);
    if (result.success) {
      toast.success(`Payslip generated! Net salary: Rs. ${result.netSalary?.toLocaleString()}`);
      setIsGenerateOpen(false);
      fetchData(); // Refresh data
    } else {
      toast.error(result.error || 'Failed to generate payslip');
    }
  };

  const handleMarkPaid = async (payslipId: string, paymentMethod: string) => {
    const result = await updatePayslipStatus(payslipId, 'paid', paymentMethod);
    if (result.success) {
      toast.success('Payslip marked as paid');
      fetchData(); // Refresh data
    } else {
      toast.error(result.error || 'Failed to update payslip');
    }
  };

  return (
    <>
      <SectionHeader
        title="Payroll Management"
        description="Generate payslips and manage employee payments"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setIsGenerateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Payslip
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <PayrollSummaryCard summary={summary} />

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Payslips</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="all">
          <PayslipTable
            payslips={filteredPayslips}
            isLoading={isLoading}
            onViewDetails={(p) => { setSelectedPayslip(p); setIsDetailsOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="pending">
          <PayslipTable
            payslips={filteredPayslips.filter(p => p.status === 'pending')}
            isLoading={isLoading}
            onViewDetails={(p) => { setSelectedPayslip(p); setIsDetailsOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="paid">
          <PayslipTable
            payslips={filteredPayslips.filter(p => p.status === 'paid')}
            isLoading={isLoading}
            onViewDetails={(p) => { setSelectedPayslip(p); setIsDetailsOpen(true); }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GeneratePayslipDialog
        employees={employees}
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onGenerate={handleGeneratePayslip}
      />

      <PayslipDetailsDialog
        payslip={selectedPayslip}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onMarkPaid={handleMarkPaid}
      />
    </>
  );
}

// Payslip Table Component
function PayslipTable({
  payslips,
  isLoading,
  onViewDetails,
}: {
  payslips: Payslip[];
  isLoading: boolean;
  onViewDetails: (payslip: Payslip) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <DataTableWrapper isLoading={isLoading} isEmpty={payslips.length === 0} emptyMessage="No payslips found">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((payslip) => {
                const status = STATUS_CONFIG[payslip.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={payslip.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{payslip.employee?.name?.[0] || 'E'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{payslip.employee?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{payslip.employee?.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(payslip.period_start).toLocaleDateString()} - {new Date(payslip.period_end).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">Rs. {payslip.base_salary?.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      Rs. {payslip.net_salary?.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('gap-1', status.color)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewDetails(payslip)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableWrapper>
      </CardContent>
    </Card>
  );
}
