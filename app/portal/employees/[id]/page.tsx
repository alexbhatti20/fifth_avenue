'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { getEmployeeComplete, getEmployeePayrollSummary } from '@/lib/portal-queries';
import { 
  ROLE_LABELS, 
  ROLE_COLORS, 
  STATUS_COLORS,
  DeleteEmployeeDialog,
  BlockUnblockDialog,
} from '@/components/portal/employees';
import { usePortalAuth } from '@/hooks/usePortal';
import type { Employee } from '@/types/portal';

export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  
  const { employee: currentEmployee, isLoading: authLoading } = usePortalAuth();
  
  const [employee, setEmployee] = useState<any>(null);
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockDialogMode, setBlockDialogMode] = useState<'block' | 'unblock'>('block');

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (currentEmployee?.role === 'admin') return true;
    if (typeof window !== 'undefined') {
      const userType = localStorage.getItem('user_type');
      const userData = localStorage.getItem('user_data');
      if (userType === 'admin') return true;
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          return parsed.role === 'admin';
        } catch {}
      }
    }
    return false;
  }, [currentEmployee]);

  // Get current admin ID
  const currentAdminId = useMemo(() => {
    if (currentEmployee?.id) return currentEmployee.id;
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data');
      if (userData) {
        try {
          return JSON.parse(userData).id;
        } catch {}
      }
    }
    return undefined;
  }, [currentEmployee]);

  // Fetch employee details
  useEffect(() => {
    if (!authLoading && employeeId) {
      setLoading(true);
      
      Promise.all([
        getEmployeeComplete(employeeId),
        getEmployeePayrollSummary(employeeId),
      ]).then(([empDetails, payrollData]) => {
        if (!empDetails) {
          toast.error('Employee not found');
          router.push('/portal/employees');
          return;
        }
        setEmployee(empDetails);
        setPayroll(payrollData);
        setLoading(false);
      }).catch((err) => {
        console.error('Error fetching employee details:', err);
        toast.error('Failed to load employee details');
        setLoading(false);
      });
    }
  }, [employeeId, authLoading, router]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Show block/unblock dialog instead of direct toggle
  const handleToggleBlock = () => {
    if (!employee) return;
    setBlockDialogMode(employee.portal_enabled ? 'block' : 'unblock');
    setBlockDialogOpen(true);
  };

  const handleBlockUnblockSuccess = (updatedEmployee: Partial<Employee>) => {
    // Update local state immediately
    setEmployee((prev: any) => ({ 
      ...prev, 
      ...updatedEmployee,
    }));
  };

  const handleSuccess = () => {
    // Refresh the data
    if (employeeId) {
      Promise.all([
        getEmployeeComplete(employeeId),
        getEmployeePayrollSummary(employeeId),
      ]).then(([empDetails, payrollData]) => {
        setEmployee(empDetails);
        setPayroll(payrollData);
      });
    }
  };

  const handleDeleteSuccess = () => {
    toast.success('Employee deleted successfully');
    router.push('/portal/employees');
  };

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-40" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground mt-2">
            Only administrators can view employee details.
          </p>
          <Button className="mt-4" onClick={() => router.push('/portal')}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Employee Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The employee you're looking for doesn't exist.
          </p>
          <Button className="mt-4" onClick={() => router.push('/portal/employees')}>
            Back to Employees
          </Button>
        </div>
      </div>
    );
  }

  const emp = employee;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        className="gap-2" 
        onClick={() => router.push('/portal/employees')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Button>

      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className={cn(
          "p-6 relative",
          emp.status === 'blocked' ? 'bg-gradient-to-br from-red-500/20 to-red-600/10' :
          emp.status === 'active' ? 'bg-gradient-to-br from-primary/20 to-orange-500/10' :
          'bg-gradient-to-br from-zinc-500/20 to-zinc-600/10'
        )}>
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
              <AvatarImage src={emp.avatar_url || undefined} />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-orange-500 text-white">
                {emp.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold">{emp.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={cn('text-sm', ROLE_COLORS[emp.role])}>
                  {ROLE_LABELS[emp.role]}
                </Badge>
                <Badge className={cn('capitalize text-sm', STATUS_COLORS[emp.status])}>
                  {emp.status}
                </Badge>
              </div>
              
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(emp.employee_id, 'Employee ID')}
                >
                  <code className="font-mono mr-2">{emp.employee_id}</code>
                  <Copy className="h-3 w-3" />
                </Button>
                {emp.license_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(emp.license_id, 'License ID')}
                  >
                    <code className="font-mono mr-2 text-xs">{emp.license_id}</code>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Edit Button */}
            <Button variant="outline" onClick={() => router.push(`/portal/employees/${emp.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center gap-4 flex-wrap">
          {/* Portal Status Indicator */}
          <div className="flex items-center gap-2">
            {emp.portal_enabled ? (
              <Unlock className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">
              Portal: <span className={cn("font-medium", emp.portal_enabled ? "text-green-600" : "text-red-600")}>
                {emp.portal_enabled ? 'Active' : 'Disabled'}
              </span>
            </span>
          </div>
          <Separator orientation="vertical" className="h-6" />
          
          {/* Single Toggle Block/Unblock Button */}
          {!emp.portal_enabled ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={handleToggleBlock}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Unblock
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={handleToggleBlock}
            >
              <Ban className="h-4 w-4 mr-2" />
              Block
            </Button>
          )}
          
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </Card>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" /> Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{emp.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{emp.phone}</span>
                </div>
                {emp.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{emp.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Date of Birth</p>
                  <p className="font-medium">
                    {emp.date_of_birth 
                      ? new Date(emp.date_of_birth).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        }) 
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Blood Group</p>
                  <p className="font-medium flex items-center gap-1">
                    <Droplet className="h-3 w-3 text-red-500" />
                    {emp.blood_group || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hire Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {emp.hired_date 
                      ? new Date(emp.hired_date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        }) 
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last Login</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {emp.last_login 
                      ? new Date(emp.last_login).toLocaleString() 
                      : 'Never'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            {(emp.emergency_contact || emp.emergency_contact_name) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" /> Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="font-medium">{emp.emergency_contact_name || 'Not specified'}</p>
                  <p className="text-muted-foreground">{emp.emergency_contact || 'Not specified'}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {emp.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{emp.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-green-600">
                  Rs. {emp.salary?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-muted-foreground">Monthly Salary</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  Rs. {emp.total_tips?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-muted-foreground">Total Tips</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {emp.total_orders_taken || 0}
                </p>
                <p className="text-sm text-muted-foreground">Orders Taken</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-orange-600">
                  {emp.attendance_stats?.this_month || 0}
                </p>
                <p className="text-sm text-muted-foreground">Days This Month</p>
              </CardContent>
            </Card>
          </div>

          {/* License & Security */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" /> License Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">License ID</span>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {emp.license_id || emp.license?.license_id || 'Not assigned'}
                  </code>
                </div>
                {emp.license && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={emp.license.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}>
                        {emp.license.is_active ? 'Active' : 'Expired'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Activated</span>
                      <span>{emp.license.activated_at ? new Date(emp.license.activated_at).toLocaleDateString() : 'Not activated'}</span>
                    </div>
                    {emp.license.expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span>{new Date(emp.license.expires_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Two-Factor Auth</span>
                  <Badge className={emp.is_2fa_enabled ? 'bg-green-500/10 text-green-600' : 'bg-zinc-500/10 text-zinc-600'}>
                    {emp.is_2fa_enabled ? (
                      <><ShieldCheck className="h-3 w-3 mr-1" /> Enabled</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Disabled</>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Portal Access</span>
                  <Badge className={emp.portal_enabled ? 'bg-green-500/10 text-green-600' : 'bg-zinc-500/10 text-zinc-600'}>
                    {emp.portal_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Login</span>
                  <span>{emp.last_login ? new Date(emp.last_login).toLocaleString() : 'Never'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span>{emp.created_by ? 'Admin' : 'System'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4 mt-6">
          {/* Documents from employee_documents table (from RPC) */}
          {emp.employee_documents && emp.employee_documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emp.employee_documents.map((doc: any) => (
                <Card key={doc.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.document_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                          <span>•</span>
                          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {doc.verified && (
                          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                            <Verified className="h-3 w-3" /> Verified on {new Date(doc.verified_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.file_url && (
                        <>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.file_url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : emp.documents && emp.documents.length > 0 ? (
            /* Fallback to old documents field */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emp.documents.map((doc: any, index: number) => (
                <Card key={doc.id || index}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.document_name || doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{doc.document_type || doc.type}</Badge>
                          {doc.uploaded_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            </>
                          )}
                          {doc.verified && (
                            <>
                              <span>•</span>
                              <span className="text-green-600 flex items-center gap-1">
                                <Verified className="h-3 w-3" /> Verified
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(doc.file_url || doc.url) && (
                        <>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.file_url || doc.url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg">No documents uploaded</p>
            </div>
          )}
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-6 mt-6">
          {/* Bank Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Bank Name</p>
                <p className="font-medium">{emp.bank_details?.bank_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Account Number</p>
                <p className="font-medium">{emp.bank_details?.account_number || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">IBAN</p>
                <p className="font-medium">{emp.bank_details?.iban || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Branch Code</p>
                <p className="font-medium">{emp.bank_details?.branch_code || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Payment Frequency</p>
                <p className="font-medium capitalize">{emp.bank_details?.payment_frequency || 'Monthly'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tax ID</p>
                <p className="font-medium">{emp.bank_details?.tax_id || 'Not set'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payroll Summary */}
          {payroll?.totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        Rs. {payroll.totals.total_paid?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-orange-600">
                        Rs. {payroll.totals.total_pending?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        Rs. {payroll.totals.total_bonus?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Bonus</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-purple-600">
                        {payroll.totals.months_paid || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Months Paid</p>
                    </div>
                    <CalendarDays className="h-8 w-8 text-purple-500/30" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Current Year Summary */}
          {payroll?.current_year_summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> {payroll.current_year_summary.year} Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total Earned</p>
                  <p className="font-medium text-lg">Rs. {payroll.current_year_summary.total_earned?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Paid This Year</p>
                  <p className="font-medium text-lg text-green-600">Rs. {payroll.current_year_summary.total_paid?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pending This Year</p>
                  <p className="font-medium text-lg text-orange-600">Rs. {payroll.current_year_summary.total_pending?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Months Worked</p>
                  <p className="font-medium text-lg">{payroll.current_year_summary.months_worked || 0}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payroll History */}
          {payroll?.payroll_history && payroll.payroll_history.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payroll.payroll_history.map((record: any) => (
                  <div key={record.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {new Date(record.year, record.month - 1).toLocaleDateString('en-US', {
                          month: 'long', year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Base: Rs. {record.base_salary?.toLocaleString()} | Tips: Rs. {record.tips?.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">Rs. {record.total_amount?.toLocaleString()}</p>
                      <Badge className={record.paid ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'}>
                        {record.paid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16">
              <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg">No payroll records</p>
            </div>
          )}
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6 mt-6">
          {/* Attendance Stats */}
          {emp.attendance_stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {emp.attendance_stats.this_month || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">This Month</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {emp.attendance_stats.last_month || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Month</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {emp.attendance_stats.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-orange-600">
                    {emp.attendance_stats.late_count || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Late Days</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Last Check-in Info */}
          {emp.attendance_stats?.last_check_in && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Timer className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Check-in:</span>
                  <span className="font-medium">
                    {new Date(emp.attendance_stats.last_check_in).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Attendance Records */}
          {emp.recent_attendance && emp.recent_attendance.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Recent Attendance (Last 10 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {emp.recent_attendance.map((record: any) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-xs text-muted-foreground">
                          {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                        <p className="font-medium">
                          {new Date(record.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="text-sm">
                        <p>
                          <span className="text-muted-foreground">In:</span>{' '}
                          <span className="font-medium">
                            {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                        {record.check_out && (
                          <p>
                            <span className="text-muted-foreground">Out:</span>{' '}
                            <span className="font-medium">
                              {new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={cn(
                          record.status === 'present' && 'bg-green-500/10 text-green-600',
                          record.status === 'late' && 'bg-orange-500/10 text-orange-600',
                          record.status === 'absent' && 'bg-red-500/10 text-red-600',
                          record.status === 'on_leave' && 'bg-blue-500/10 text-blue-600'
                        )}
                      >
                        {record.status === 'on_leave' ? 'On Leave' : record.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg">No attendance records found</p>
            </div>
          )}

          <div className="text-center">
            <Button variant="outline" onClick={() => router.push('/portal/attendance')}>
              View Full Attendance History
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <DeleteEmployeeDialog
        employee={deleteDialogOpen ? emp : null}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        adminId={currentAdminId}
      />

      {/* Block/Unblock Dialog */}
      <BlockUnblockDialog
        employee={blockDialogOpen ? emp : null}
        mode={blockDialogMode}
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        onSuccess={handleBlockUnblockSuccess}
      />
    </div>
  );
}
