'use client';

import { useState, useEffect } from 'react';
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
  Building,
  CreditCard,
  TrendingUp,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getEmployeeComplete } from '@/lib/portal-queries';
import { getEmployeePayrollSummaryAction } from '@/lib/actions';
import { ROLE_LABELS, ROLE_COLORS, STATUS_COLORS } from './EmployeeCard';
import type { Employee } from '@/types/portal';

interface EmployeeDetailSheetProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePortal: (id: string, enabled: boolean) => void;
  onDelete: (employee: Employee) => void;
}

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
  onTogglePortal,
  onDelete,
}: EmployeeDetailSheetProps) {
  const [details, setDetails] = useState<any>(null);
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open && employee) {
      setLoading(true);
      setActiveTab('overview');
      
      // Fetch complete employee details
      Promise.all([
        getEmployeeComplete(employee.id),
        getEmployeePayrollSummaryAction(employee.id),
      ]).then(([empDetails, payrollData]) => {
        setDetails(empDetails);
        setPayroll(payrollData);
        setLoading(false);
      }).catch((err) => {
        setLoading(false);
      });
    }
  }, [open, employee]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!employee) return null;

  const emp = details || employee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {/* Header */}
          <div className={cn(
            "p-6 relative",
            emp.status === 'blocked' ? 'bg-gradient-to-br from-red-500/20 to-red-600/10' :
            emp.status === 'active' ? 'bg-gradient-to-br from-primary/20 to-orange-500/10' :
            'bg-gradient-to-br from-zinc-500/20 to-zinc-600/10'
          )}>
            <SheetHeader className="pb-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
                  <AvatarImage src={emp.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-orange-500 text-white">
                    {emp.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-2xl">{emp.name}</SheetTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    <Badge className={cn('mr-2', ROLE_COLORS[emp.role])}>
                      {ROLE_LABELS[emp.role]}
                    </Badge>
                    <Badge className={cn('capitalize', STATUS_COLORS[emp.status])}>
                      {emp.status}
                    </Badge>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
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
              </div>
            </SheetHeader>
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-4">
              {emp.portal_enabled ? (
                <Unlock className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Portal Access</span>
              <Switch
                checked={emp.portal_enabled}
                onCheckedChange={(checked) => onTogglePortal(emp.id, checked)}
              />
            </div>
            <Separator orientation="vertical" className="h-6" />
            {!emp.portal_enabled ? (
              <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700" onClick={() => onTogglePortal(emp.id, true)}>
                <UserCheck className="h-4 w-4 mr-2" /> Unblock
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700" onClick={() => onTogglePortal(emp.id, false)}>
                <Ban className="h-4 w-4 mr-2" /> Block
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => onDelete(emp)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="payroll">Payroll</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="space-y-4 mt-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                  {/* Contact Information */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4" /> Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{emp.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{emp.phone}</span>
                      </div>
                      {emp.address && (
                        <div className="flex items-start gap-2 col-span-2">
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

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          Rs. {emp.salary?.toLocaleString() || '0'}
                        </p>
                        <p className="text-xs text-muted-foreground">Monthly Salary</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          Rs. {emp.total_tips?.toLocaleString() || '0'}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Tips</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {emp.total_orders_taken || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Orders Taken</p>
                      </CardContent>
                    </Card>
                  </div>

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
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4 mt-6">
                  {details?.documents && details.documents.length > 0 ? (
                    details.documents.map((doc: any) => (
                      <Card key={doc.id}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{doc.document_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                <span>•</span>
                                <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
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
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No documents uploaded</p>
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
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
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
                    </CardContent>
                  </Card>

                  {/* Payroll Summary */}
                  {payroll?.totals && (
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-green-600">
                                Rs. {payroll.totals.total_paid?.toLocaleString() || '0'}
                              </p>
                              <p className="text-xs text-muted-foreground">Total Paid</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500/30" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-orange-600">
                                Rs. {payroll.totals.total_pending?.toLocaleString() || '0'}
                              </p>
                              <p className="text-xs text-muted-foreground">Pending</p>
                            </div>
                            <Clock className="h-8 w-8 text-orange-500/30" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Payroll History */}
                  {payroll?.payroll_history && payroll.payroll_history.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Payment History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {payroll.payroll_history.slice(0, 6).map((record: any) => (
                          <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">
                                {new Date(record.year, record.month - 1).toLocaleDateString('en-US', {
                                  month: 'long', year: 'numeric'
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Base: Rs. {record.base_salary?.toLocaleString()} | Tips: Rs. {record.tips?.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">Rs. {record.total_amount?.toLocaleString()}</p>
                              <Badge className={record.paid ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'}>
                                {record.paid ? 'Paid' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-12">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No payroll records</p>
                    </div>
                  )}
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-6 mt-6">
                  {/* Attendance Stats */}
                  {details?.attendance_stats && (
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {details.attendance_stats.this_month || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">This Month</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {details.attendance_stats.total || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Days</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-2xl font-bold text-purple-600">
                            {details.attendance_stats.avg_hours || 0}h
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Hours/Day</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">View full attendance in Attendance module</p>
                    <Button variant="outline" className="mt-4">
                      View Full Attendance
                    </Button>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
