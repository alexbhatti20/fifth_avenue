'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  Copy,
  Ban,
  UserCheck,
  Trash2,
  Lock,
  Unlock,
  Download,
  Eye,
  Verified,
  AlertTriangle,
  User,
  Heart,
  Droplet,
  CreditCard,
  CheckCircle,
  ArrowLeft,
  Edit,
  Shield,
  Key,
  ShieldCheck,
  XCircle,
  TrendingUp,
  Timer,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  ROLE_LABELS, 
  ROLE_COLORS, 
  STATUS_COLORS,
  DeleteEmployeeDialog,
  BlockUnblockDialog,
} from '@/components/portal/employees';
import { getEmployeeComplete, getEmployeePayrollSummary } from '@/lib/portal-queries';
import type { Employee } from '@/types/portal';

interface EmployeeDetailsClientProps {
  employee: any;
  payroll: any;
  isAdmin: boolean;
  employeeId?: string; // For client-side fallback fetching
}

export default function EmployeeDetailsClient({
  employee: initialEmployee,
  payroll: initialPayroll,
  isAdmin,
  employeeId,
}: EmployeeDetailsClientProps) {
  const router = useRouter();
  const [employee, setEmployee] = useState(initialEmployee);
  const [payroll, setPayroll] = useState(initialPayroll);
  // Show loading if SSR data is missing/empty and we have an employeeId to fetch
  const needsClientFetch = !initialEmployee || (typeof initialEmployee === 'object' && !initialEmployee?.name);
  const [loading, setLoading] = useState(needsClientFetch && !!employeeId);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockDialogMode, setBlockDialogMode] = useState<'block' | 'unblock'>('block');

  // Client-side fallback: fetch data if SSR didn't provide it
  useEffect(() => {
    async function fetchClientSide() {
      // Check if we need to fetch - SSR data missing or empty
      const needsFetch = !initialEmployee || (typeof initialEmployee === 'object' && !initialEmployee?.name);
      
      if (needsFetch && employeeId) {
        console.log('[Client] SSR data missing or empty, fetching client-side for:', employeeId);
        setLoading(true);
        try {
          const [empData, payrollData] = await Promise.all([
            getEmployeeComplete(employeeId),
            getEmployeePayrollSummary(employeeId),
          ]);
          
          console.log('[Client] Fetched employee data:', empData);
          console.log('[Client] Fetched payroll data:', payrollData);
          
          if (empData && empData.name) {
            setEmployee(empData);
            setPayroll(payrollData);
          } else {
            // If client-side fetch also fails, redirect to employees list
            console.error('[Client] Employee data invalid:', empData);
            toast.error('Employee not found or access denied');
            router.push('/portal/employees');
          }
        } catch (error) {
          console.error('[Client] Fetch error:', error);
          toast.error('Failed to load employee data');
          router.push('/portal/employees');
        } finally {
          setLoading(false);
        }
      }
    }
    
    fetchClientSide();
  }, [initialEmployee, employeeId, router]);

  // Helper functions
  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleBlockUnblock = () => {
    const isBlocked = !employee.portal_enabled;
    setBlockDialogMode(isBlocked ? 'unblock' : 'block');
    setBlockDialogOpen(true);
  };

  const handleBlockUnblockSuccess = (updatedEmployee: any) => {
    setEmployee((prev: any) => ({
      ...prev,
      ...updatedEmployee,
    }));
    router.refresh();
  };

  const handleDeleteSuccess = () => {
    toast.success('Employee deleted successfully');
    router.push('/portal/employees');
  };

  // Show loading state while fetching client-side
  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/portal/employees')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading employee data...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <User className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Employee not found</p>
          <Button
            variant="outline"
            onClick={() => router.push('/portal/employees')}
          >
            Back to Employees
          </Button>
        </div>
      </div>
    );
  }

  // Debug: Log employee data to console
  console.log('[Render] Employee data:', JSON.stringify(employee, null, 2));

  const isBlocked = !employee.portal_enabled;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/portal/employees')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
      </div>

      {/* Employee Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex justify-center md:justify-start">
              <Avatar className="h-24 w-24">
                <AvatarImage src={employee.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {getInitials(employee.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{employee.name}</h1>
                    {employee.is_2fa_enabled && (
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={ROLE_COLORS[employee.role as keyof typeof ROLE_COLORS] as any}>
                      {ROLE_LABELS[employee.role as keyof typeof ROLE_LABELS]}
                    </Badge>
                    <Badge variant={STATUS_COLORS[employee.status as keyof typeof STATUS_COLORS] as any}>
                      {employee.status}
                    </Badge>
                    {isBlocked && (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" />
                        Blocked
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/portal/employees/${employee.id}/edit`)}
                      className="gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant={isBlocked ? 'default' : 'outline'}
                      size="sm"
                      onClick={handleBlockUnblock}
                      className="gap-2"
                    >
                      {isBlocked ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Unblock
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Block
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-medium">{employee.employee_id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(employee.employee_id, 'Employee ID')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{employee.phone}</span>
                </div>
              </div>

              {/* Block Reason */}
              {isBlocked && employee.block_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">Block Reason</p>
                      <p className="text-sm text-muted-foreground mt-1">{employee.block_reason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Detailed Information */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Hire Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatDate(employee.hired_date)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Base Salary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ${employee.salary ? Number(employee.salary).toFixed(2) : '0.00'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Portal Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {employee.portal_enabled ? (
                    <>
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-red-600" />
                      Disabled
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Stats */}
          {(employee.total_orders_taken > 0 || employee.total_tips > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{employee.total_orders_taken}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tips</p>
                    <p className="text-2xl font-bold">
                      ${employee.total_tips ? Number(employee.total_tips).toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {employee.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {employee.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Personal Tab */}
        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-base font-medium mt-1">{employee.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-base font-medium mt-1">{employee.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-base font-medium mt-1">{employee.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="text-base font-medium mt-1">{formatDate(employee.date_of_birth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Droplet className="h-4 w-4" />
                    Blood Group
                  </label>
                  <p className="text-base font-medium mt-1">{employee.blood_group || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-base font-medium mt-1">{employee.address || 'N/A'}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Emergency Contact</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-base font-medium mt-1">
                      {employee.emergency_contact_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-base font-medium mt-1">
                      {employee.emergency_contact || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
                  <p className="text-base font-medium mt-1">{employee.employee_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div className="mt-1">
                    <Badge variant={ROLE_COLORS[employee.role as keyof typeof ROLE_COLORS] as any}>
                      {ROLE_LABELS[employee.role as keyof typeof ROLE_LABELS]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant={STATUS_COLORS[employee.status as keyof typeof STATUS_COLORS] as any}>
                      {employee.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hire Date</label>
                  <p className="text-base font-medium mt-1">{formatDate(employee.hired_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">License ID</label>
                  <p className="text-base font-medium mt-1">{employee.license_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                  <p className="text-base font-medium mt-1">{formatDate(employee.last_login)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Permissions</h3>
                <div className="bg-muted/50 rounded-lg p-4">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(employee.permissions || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payroll ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Base Salary</label>
                      <p className="text-2xl font-bold mt-1">
                        ${payroll.payroll_settings?.base_salary || employee.salary ? 
                          Number(payroll.payroll_settings?.base_salary || employee.salary).toFixed(2) : 
                          '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Frequency</label>
                      <p className="text-base font-medium mt-1 capitalize">
                        {payroll.payroll_settings?.payment_frequency || 'Monthly'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Paid</label>
                      <p className="text-2xl font-bold mt-1 text-green-600">
                        ${Number(payroll.total_paid || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Pending Amount</label>
                      <p className="text-2xl font-bold mt-1 text-orange-600">
                        ${Number(payroll.pending_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {payroll.payroll_settings?.bank_details && 
                   Object.keys(payroll.payroll_settings.bank_details).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <CreditCard className="h-5 w-5" />
                          Bank Details
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          {payroll.payroll_settings.bank_details.account_number && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                              <p className="text-base font-medium mt-1">
                                {payroll.payroll_settings.bank_details.account_number}
                              </p>
                            </div>
                          )}
                          {payroll.payroll_settings.bank_details.bank_name && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                              <p className="text-base font-medium mt-1">
                                {payroll.payroll_settings.bank_details.bank_name}
                              </p>
                            </div>
                          )}
                          {payroll.payroll_settings.bank_details.account_holder_name && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Account Holder</label>
                              <p className="text-base font-medium mt-1">
                                {payroll.payroll_settings.bank_details.account_holder_name}
                              </p>
                            </div>
                          )}
                          {payroll.payroll_settings.bank_details.branch && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Branch</label>
                              <p className="text-base font-medium mt-1">
                                {payroll.payroll_settings.bank_details.branch}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {payroll.recent_payslips && payroll.recent_payslips.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Recent Payslips</h3>
                        <div className="space-y-2">
                          {payroll.recent_payslips.map((payslip: any) => (
                            <div
                              key={payslip.id}
                              className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                  <p className="font-medium">
                                    {formatDate(payslip.period_start)} - {formatDate(payslip.period_end)}
                                  </p>
                                  <Badge variant={payslip.status === 'paid' ? 'default' : 'secondary'}>
                                    {payslip.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Net Salary: ${Number(payslip.net_salary).toFixed(2)}
                                </p>
                              </div>
                              {payslip.status === 'paid' && (
                                <div className="text-sm text-muted-foreground">
                                  Paid: {formatDate(payslip.paid_at)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No payroll data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.documents && employee.documents.length > 0 ? (
                <div className="space-y-2">
                  {employee.documents.map((doc: any, index: number) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.name || `Document ${index + 1}`}</p>
                          <p className="text-sm text-muted-foreground">{doc.type || 'Unknown type'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.verified && (
                          <Badge variant="default" className="gap-1">
                            <Verified className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.url} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No documents uploaded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DeleteEmployeeDialog
        employee={employee}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />

      <BlockUnblockDialog
        employee={employee}
        mode={blockDialogMode}
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        onSuccess={handleBlockUnblockSuccess}
      />
    </div>
  );
}
