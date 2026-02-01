'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  QrCode,
  UserCheck,
  UserX,
  BarChart3,
  Download,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  Send,
  CalendarDays,
  Users,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  XCircle as XCircleIcon,
  CalendarRange,
  Briefcase,
  Coffee,
  Heart,
  Baby,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth, useCountdown } from '@/hooks/usePortal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Employee, AttendanceStatus } from '@/types/portal';
import type { 
  AttendanceStatsServer, 
  TodayAttendanceServer,
  AttendanceSummaryServer,
  AbsentEmployeeServer,
  LeaveRequestServer,
  LeaveBalanceServer
} from '@/lib/server-queries';

// Server-side API helper - all RPC calls go through this
async function attendanceApi(action: string, params: Record<string, any> = {}) {
  const res = await fetch('/api/portal/attendance/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params })
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'API call failed');
  }
  return json.data;
}

// Status configurations
const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  present: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Present', icon: <CheckCircle className="h-4 w-4" /> },
  absent: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Absent', icon: <XCircle className="h-4 w-4" /> },
  late: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Late', icon: <AlertTriangle className="h-4 w-4" /> },
  half_day: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Half Day', icon: <Clock className="h-4 w-4" /> },
  on_leave: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'On Leave', icon: <Calendar className="h-4 w-4" /> },
};

const LEAVE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  annual: { label: 'Annual Leave', icon: <CalendarDays className="h-4 w-4" />, color: 'text-blue-500' },
  sick: { label: 'Sick Leave', icon: <Heart className="h-4 w-4" />, color: 'text-red-500' },
  casual: { label: 'Casual Leave', icon: <Coffee className="h-4 w-4" />, color: 'text-orange-500' },
  emergency: { label: 'Emergency', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600' },
  unpaid: { label: 'Unpaid Leave', icon: <Briefcase className="h-4 w-4" />, color: 'text-gray-500' },
  maternity: { label: 'Maternity Leave', icon: <Baby className="h-4 w-4" />, color: 'text-pink-500' },
  paternity: { label: 'Paternity Leave', icon: <Baby className="h-4 w-4" />, color: 'text-cyan-500' },
  other: { label: 'Other', icon: <HelpCircle className="h-4 w-4" />, color: 'text-gray-400' },
};

const LEAVE_STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'Pending', bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-600' },
  approved: { label: 'Approved', bgColor: 'bg-green-500/10', textColor: 'text-green-600' },
  rejected: { label: 'Rejected', bgColor: 'bg-red-500/10', textColor: 'text-red-600' },
  cancelled: { label: 'Cancelled', bgColor: 'bg-gray-500/10', textColor: 'text-gray-600' },
};

// Props for SSR support
interface AttendanceClientProps {
  initialStats: AttendanceStatsServer | null;
  initialTodayAttendance: TodayAttendanceServer[];
  initialAttendanceSummary: AttendanceSummaryServer[];
  initialAbsentEmployees: AbsentEmployeeServer[];
  initialLeaveRequests: LeaveRequestServer[];
  initialPendingLeaveCount: number;
  initialAttendanceHistory?: any[];
}

// =============================================
// MARK ATTENDANCE COMPONENT (For Employees)
// =============================================
function MarkAttendance({ initialAttendance }: { initialAttendance?: any }) {
  const { employee } = usePortalAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(initialAttendance || null);

  // Only fetch if no initial data provided
  useEffect(() => {
    if (initialAttendance || !employee) return;

    const checkTodayAttendance = async () => {
      try {
        const data = await attendanceApi('get_my_today_attendance');
        if (data?.success) {
          setTodayAttendance(data.attendance);
        }
      } catch (error) {
        // Silently fail - not critical
      }
    };

    checkTodayAttendance();
  }, [employee, initialAttendance]);

  const handleMarkAttendance = async () => {
    if (!code.trim() || code.length !== 6) {
      toast.error('Please enter a valid 6-character code');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await attendanceApi('mark_attendance_with_code', { code });

      if (data?.success) {
        toast.success(data.message || 'Attendance marked successfully!');
        setCode('');
        setTodayAttendance(data.attendance);
      } else {
        toast.error(data?.message || 'Invalid or expired code');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <QrCode className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Mark Attendance</CardTitle>
        <CardDescription>Enter the 6-character code shown on the attendance device</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {todayAttendance ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg">Attendance Marked!</h3>
            <p className="text-muted-foreground mt-1">
              Check-in: {new Date(todayAttendance.check_in).toLocaleTimeString()}
            </p>
            {todayAttendance.check_out && (
              <p className="text-muted-foreground">
                Check-out: {new Date(todayAttendance.check_out).toLocaleTimeString()}
              </p>
            )}
            <Badge className={cn('mt-3', STATUS_CONFIG[todayAttendance.status as AttendanceStatus]?.bgColor)}>
              {STATUS_CONFIG[todayAttendance.status as AttendanceStatus]?.label}
            </Badge>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Attendance Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="Enter 6-character code"
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleMarkAttendance}
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? 'Verifying...' : 'Mark Attendance'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================
// GENERATE CODE COMPONENT (Admin/Manager)
// =============================================
function GenerateAttendanceCode() {
  const [code, setCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [validMinutes, setValidMinutes] = useState(5);
  const [expiryTime, setExpiryTime] = useState<string | null>(null);
  const [validFrom, setValidFrom] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const { timeLeft, isExpired, formatted } = useCountdown(expiryTime);

  // Fetch active code on mount
  useEffect(() => {
    const fetchActiveCode = async () => {
      try {
        const data = await attendanceApi('get_active_attendance_code', {});
        if (data?.has_active_code && data?.code) {
          // Set expiry based on time_left_seconds from server
          const expiry = new Date(Date.now() + (data.time_left_seconds * 1000)).toISOString();
          setExpiryTime(expiry);
          setValidFrom(data.valid_from);
          setValidUntil(data.valid_until);
          setCode(data.code);
        }
      } catch (error) {
        // Silent fail - no active code
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveCode();
  }, []);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const data = await attendanceApi('generate_attendance_code', { validMinutes });
      
      if (data?.success && data?.code) {
        // Set expiry FIRST, then code - order matters!
        const expiry = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();
        setExpiryTime(expiry);
        setValidFrom(data.valid_from);
        setValidUntil(data.valid_until);
        // Small delay to ensure expiry is set before code triggers render
        setTimeout(() => {
          setCode(data.code);
          toast.success('Attendance code generated: ' + data.code);
        }, 50);
      } else {
        toast.error(data?.error || 'Failed to generate code');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeCode = async () => {
    setIsRevoking(true);
    try {
      const data = await attendanceApi('revoke_attendance_code', {});
      if (data?.success) {
        setCode(null);
        setExpiryTime(null);
        setValidFrom(null);
        setValidUntil(null);
        toast.success('Attendance code revoked!');
      } else {
        toast.error(data?.error || 'Failed to revoke code');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsRevoking(false);
    }
  };

  // Clear code when expired - but only if we actually have an expiry set AND time has truly passed
  useEffect(() => {
    // Don't clear during initial load or if no code/expiry
    if (!code || !expiryTime) return;
    
    // Only clear if the expiry time has actually passed
    const expiryDate = new Date(expiryTime).getTime();
    const now = Date.now();
    if (now >= expiryDate) {
      setCode(null);
      setExpiryTime(null);
      setValidFrom(null);
      setValidUntil(null);
      toast.info('Attendance code has expired');
    }
  }, [isExpired, code, expiryTime]);

  // Calculate progress - handle case when validMinutes might not match server duration
  const progressValue = timeLeft > 0 ? Math.min(100, Math.max(0, (timeLeft / (validMinutes * 60)) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Generate Attendance Code
        </CardTitle>
        <CardDescription>
          Generate a one-time code for employees to mark attendance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-6">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Checking for active code...</p>
          </div>
        ) : code ? (
          <div className="text-center py-6 space-y-4">
            <div className="text-5xl font-mono font-bold tracking-widest mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent select-all">
              {code}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Valid from: <span className="font-medium">{validFrom}</span></p>
              <p>Valid until: <span className="font-medium">{validUntil}</span></p>
            </div>
            <Progress value={progressValue} className="h-2 mb-2" />
            <p className="text-muted-foreground">
              Expires in <span className="font-semibold text-primary">{formatted}</span>
            </p>
            <div className="flex gap-2 justify-center pt-4">
              <Button onClick={handleGenerateCode} disabled={isGenerating} variant="outline">
                {isGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    New Code
                  </>
                )}
              </Button>
              <Button onClick={handleRevokeCode} disabled={isRevoking} variant="destructive">
                {isRevoking ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Revoke
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground mb-4">
              Generate a code for employees to mark their attendance
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Label htmlFor="validMinutes">Valid for:</Label>
              <Select value={validMinutes.toString()} onValueChange={(v) => setValidMinutes(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateCode} disabled={isGenerating} size="lg">
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Generate Code
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================
// MANUAL ATTENDANCE MARKING (Admin/Manager)
// =============================================
function ManualAttendanceDialog({ employees, onClose, onSuccess }: { 
  employees: AbsentEmployeeServer[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    setIsSubmitting(true);
    try {
      const checkInTime = new Date(`${selectedDate}T${checkIn}:00`).toISOString();
      const checkOutTime = checkOut ? new Date(`${selectedDate}T${checkOut}:00`).toISOString() : null;

      const data = await attendanceApi('admin_mark_attendance', {
        employeeId: selectedEmployee,
        date: selectedDate,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        status: status,
        notes: notes || null
      });

      if (data?.success) {
        toast.success('Attendance marked successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(data?.error || 'Failed to mark attendance');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Mark Manual Attendance</DialogTitle>
        <DialogDescription>
          Manually mark or correct attendance for an employee
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Employee</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={emp.avatar_url} />
                      <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{emp.name}</span>
                    <Badge variant="outline" className="text-xs">{emp.role}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Check In</Label>
            <Input 
              type="time" 
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Check Out (Optional)</Label>
            <Input 
              type="time" 
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes (Optional)</Label>
          <Textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes..."
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Mark Attendance'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// =============================================
// TODAY'S ATTENDANCE OVERVIEW
// =============================================
function TodayAttendance({ 
  initialData, 
  absentEmployees,
  onRefresh 
}: { 
  initialData: TodayAttendanceServer[];
  absentEmployees: AbsentEmployeeServer[];
  onRefresh: () => void;
}) {
  const [attendance, setAttendance] = useState<TodayAttendanceServer[]>(initialData || []);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter attendance by search
  const filteredAttendance = attendance.filter(record => 
    record.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.employee?.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setAttendance(initialData);
  }, [initialData]);

  return (
    <div className="space-y-4">
      {/* Absent Employees Alert */}
      {absentEmployees.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {absentEmployees.length} Employee{absentEmployees.length > 1 ? 's' : ''} Not Checked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {absentEmployees.slice(0, 5).map((emp) => (
                <Badge key={emp.id} variant="outline" className="gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={emp.avatar_url} />
                    <AvatarFallback className="text-[8px]">{emp.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {emp.name}
                </Badge>
              ))}
              {absentEmployees.length > 5 && (
                <Badge variant="outline">+{absentEmployees.length - 5} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button variant="outline" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
              <Button onClick={() => setShowManualDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Mark Manual
              </Button>
              {showManualDialog && (
                <ManualAttendanceDialog 
                  employees={absentEmployees}
                  onClose={() => setShowManualDialog(false)}
                  onSuccess={onRefresh}
                />
              )}
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <DataTableWrapper 
            isLoading={false} 
            isEmpty={filteredAttendance.length === 0} 
            emptyMessage="No attendance records today"
          >
            <div className="space-y-3">
              {filteredAttendance.map((record) => {
                const config = STATUS_CONFIG[record.status as AttendanceStatus];
                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={record.employee?.avatar_url} />
                        <AvatarFallback>{record.employee?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{record.employee?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{record.employee?.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p className="flex items-center gap-1">
                          <span className="text-green-500">●</span>
                          {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {record.check_out && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <span className="text-red-500">●</span>
                            {new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <Badge className={cn('gap-1', config?.bgColor, config?.color)}>
                        {config?.icon}
                        {config?.label}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </DataTableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// ATTENDANCE SUMMARY BY EMPLOYEE
// =============================================
function AttendanceSummary({ initialData }: { initialData: AttendanceSummaryServer[] }) {
  const [summary, setSummary] = useState<AttendanceSummaryServer[]>(initialData || []);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const data = await attendanceApi('get_attendance_summary_by_employee', {
        year,
        month
      });

      if (data?.success) {
        setSummary(data.summary || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedMonth !== new Date().toISOString().slice(0, 7)) {
      fetchSummary();
    }
  }, [selectedMonth, fetchSummary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48"
        />
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTableWrapper isLoading={isLoading} isEmpty={summary.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Leave</TableHead>
                  <TableHead className="text-center">Half Day</TableHead>
                  <TableHead className="text-center">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((record) => (
                  <TableRow key={record.employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={record.employee.avatar_url} />
                          <AvatarFallback>{record.employee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{record.employee.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{record.employee.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        {record.present_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                        {record.late_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        {record.absent_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                        {record.leave_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                        {record.half_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {record.total_hours}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// ATTENDANCE HISTORY
// =============================================
function AttendanceHistory({ initialData }: { initialData?: any[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [history, setHistory] = useState<any[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [hasInitialData] = useState(!!initialData && initialData.length > 0);

  // Only fetch when month changes from initial (user action)
  useEffect(() => {
    // Skip if this is initial load with SSR data
    if (selectedMonth === currentMonth && hasInitialData) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const [year, month] = selectedMonth.split('-').map(Number);
        const data = await attendanceApi('get_attendance_history', {
          year,
          month
        });

        if (data?.success) {
          setHistory(data.attendance || []);
        }
      } catch (error) {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [selectedMonth, currentMonth, hasInitialData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48"
        />
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTableWrapper isLoading={isLoading} isEmpty={history.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => {
                  const config = STATUS_CONFIG[record.status as AttendanceStatus];
                  const hours = (record.check_out && record.check_in)
                      ? ((new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 3600000).toFixed(1)
                      : '-';
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={record.employee?.avatar_url} />
                            <AvatarFallback>{record.employee?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {record.employee?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell>
                        {record.check_out 
                          ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </TableCell>
                      <TableCell>{hours !== '-' ? `${hours}h` : '-'}</TableCell>
                      <TableCell>
                        <Badge className={cn('gap-1', config?.bgColor, config?.color)}>
                          {config?.icon}
                          {config?.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// LEAVE REQUEST FORM (Employee)
// =============================================
function LeaveRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState<LeaveBalanceServer | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const data = await attendanceApi('get_leave_balance');
        if (data?.success) {
          setBalance(data.balance);
        }
      } catch (error) {
        // Silent fail
      }
    };
    fetchBalance();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate || !reason.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await attendanceApi('create_leave_request', {
        leaveType,
        startDate,
        endDate,
        reason
      });

      if (data?.success) {
        toast.success('Leave request submitted successfully!');
        setStartDate('');
        setEndDate('');
        setReason('');
        onSuccess();
      } else {
        toast.error(data?.error || 'Failed to submit leave request');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Request Leave
        </CardTitle>
        <CardDescription>Submit a new leave request for approval</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Leave Balance */}
        {balance && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-blue-500/10 text-center">
              <p className="text-sm text-muted-foreground">Annual</p>
              <p className="text-2xl font-bold text-blue-600">{balance.annual.available}</p>
              <p className="text-xs text-muted-foreground">of {balance.annual.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 text-center">
              <p className="text-sm text-muted-foreground">Sick</p>
              <p className="text-2xl font-bold text-red-600">{balance.sick.available}</p>
              <p className="text-xs text-muted-foreground">of {balance.sick.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-500/10 text-center">
              <p className="text-sm text-muted-foreground">Casual</p>
              <p className="text-2xl font-bold text-orange-600">{balance.casual.available}</p>
              <p className="text-xs text-muted-foreground">of {balance.casual.total}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for your leave request..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// =============================================
// MY LEAVE REQUESTS (Employee)
// =============================================
function MyLeaveRequests({ initialData, onRefresh }: { initialData?: LeaveRequestServer[]; onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequestServer[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Only fetch on explicit refresh (not on mount if we have initial data)
  useEffect(() => {
    if (refreshCount === 0 && initialData && initialData.length >= 0) return;

    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const data = await attendanceApi('get_my_leave_requests', {
          year: new Date().getFullYear(),
          limit: 50
        });

        if (data?.success) {
          setRequests(data.requests || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [refreshCount, initialData]);

  // Trigger refresh
  const handleRefresh = () => {
    setRefreshCount(c => c + 1);
    onRefresh();
  };

  const handleCancel = async (requestId: string) => {
    try {
      const data = await attendanceApi('cancel_leave_request', { requestId });

      if (data?.success) {
        toast.success('Leave request cancelled');
        setRequests(prev => prev.map(r => 
          r.id === requestId ? { ...r, status: 'cancelled' as const } : r
        ));
      } else {
        toast.error(data?.error || 'Failed to cancel');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          My Leave Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTableWrapper isLoading={isLoading} isEmpty={requests.length === 0} emptyMessage="No leave requests yet">
          <div className="space-y-3">
            {requests.map((request) => {
              const typeConfig = LEAVE_TYPE_CONFIG[request.leave_type];
              const statusConfig = LEAVE_STATUS_CONFIG[request.status];
              
              return (
                <div 
                  key={request.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', typeConfig?.color === 'text-blue-500' ? 'bg-blue-500/10' : 'bg-gray-100')}>
                        {typeConfig?.icon}
                      </div>
                      <div>
                        <p className="font-medium">{typeConfig?.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                          <span className="ml-2">({request.total_days} day{request.total_days > 1 ? 's' : ''})</span>
                        </p>
                        <p className="text-sm mt-1 text-muted-foreground line-clamp-1">{request.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(statusConfig?.bgColor, statusConfig?.textColor)}>
                        {statusConfig?.label}
                      </Badge>
                      {request.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCancel(request.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  {request.review_notes && (
                    <div className="mt-2 p-2 rounded bg-muted text-sm">
                      <span className="font-medium">Note:</span> {request.review_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DataTableWrapper>
      </CardContent>
    </Card>
  );
}

// =============================================
// LEAVE REQUESTS MANAGEMENT (Admin/Manager)
// =============================================
function LeaveRequestsManagement({ initialData }: { initialData: LeaveRequestServer[] }) {
  const [requests, setRequests] = useState<LeaveRequestServer[]>(initialData || []);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestServer | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredRequests = statusFilter === 'all' 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const data = await attendanceApi('review_leave_request', {
        requestId: selectedRequest.id,
        status,
        reviewerNotes: reviewNotes || null
      });

      if (data?.success) {
        toast.success(`Leave request ${status}`);
        setRequests(prev => prev.map(r => 
          r.id === selectedRequest.id ? { ...r, status } : r
        ));
        setSelectedRequest(null);
        setReviewNotes('');
      } else {
        toast.error(data?.error || 'Failed to process request');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshRequests = async () => {
    try {
      const data = await attendanceApi('get_all_leave_requests', {
        statusFilter: null,
        year: new Date().getFullYear(),
        month: null
      });

      if (data?.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
            {requests.filter(r => r.status === 'pending').length} Pending
          </Badge>
        </div>
        <Button variant="outline" size="icon" onClick={refreshRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTableWrapper isLoading={false} isEmpty={filteredRequests.length === 0} emptyMessage="No leave requests">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const typeConfig = LEAVE_TYPE_CONFIG[request.leave_type];
                  const statusConfig = LEAVE_STATUS_CONFIG[request.status];
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={request.employee?.avatar_url} />
                            <AvatarFallback>{request.employee?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{request.employee?.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{request.employee?.role}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={typeConfig?.color}>{typeConfig?.icon}</span>
                          <span>{typeConfig?.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">{request.total_days} day(s)</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm line-clamp-2 max-w-xs">{request.reason}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(statusConfig?.bgColor, statusConfig?.textColor)}>
                          {statusConfig?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-600 hover:text-green-700"
                              onClick={() => {
                                setSelectedRequest(request);
                                handleReview('approved');
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <XCircleIcon className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(request)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableWrapper>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest && selectedRequest.status === 'pending'} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>
              Review and respond to {selectedRequest?.employee?.name}'s leave request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="font-medium">{LEAVE_TYPE_CONFIG[selectedRequest?.leave_type || 'other']?.label}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRequest && new Date(selectedRequest.start_date).toLocaleDateString()} - {selectedRequest && new Date(selectedRequest.end_date).toLocaleDateString()}
                <span className="ml-2">({selectedRequest?.total_days} days)</span>
              </p>
              <p className="text-sm mt-2">{selectedRequest?.reason}</p>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea 
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes for the employee..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleReview('rejected')}
              disabled={isProcessing}
            >
              Reject
            </Button>
            <Button 
              onClick={() => handleReview('approved')}
              disabled={isProcessing}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================
// MAIN ATTENDANCE CLIENT COMPONENT
// =============================================
export default function AttendanceClient({ 
  initialStats, 
  initialTodayAttendance,
  initialAttendanceSummary,
  initialAbsentEmployees,
  initialLeaveRequests,
  initialPendingLeaveCount,
  initialAttendanceHistory
}: AttendanceClientProps) {
  const { role, employee } = usePortalAuth();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  
  const [stats, setStats] = useState({
    present: initialStats?.present || 0,
    absent: initialStats?.absent || 0,
    late: initialStats?.late || 0,
    onLeave: initialStats?.on_leave || 0,
    total: initialStats?.total || 0,
    attendanceRate: initialStats?.attendance_rate || 0,
  });
  const [todayAttendance, setTodayAttendance] = useState(initialTodayAttendance);
  const [absentEmployees, setAbsentEmployees] = useState(initialAbsentEmployees);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(initialPendingLeaveCount);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh handler - uses API route (SSR) instead of direct Supabase calls
  const handleRefresh = useCallback(async () => {
    if (!isAdminOrManager) return;
    
    try {
      const res = await fetch('/api/portal/attendance/refresh');
      const data = await res.json();

      if (data.success) {
        if (data.stats) {
          setStats({
            present: data.stats.present || 0,
            absent: data.stats.absent || 0,
            late: data.stats.late || 0,
            onLeave: data.stats.on_leave || 0,
            total: data.stats.total || 0,
            attendanceRate: data.stats.attendance_rate || 0,
          });
        }

        if (data.todayAttendance) {
          setTodayAttendance(data.todayAttendance);
        }

        if (data.absentEmployees) {
          setAbsentEmployees(data.absentEmployees);
        }
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }
  }, [isAdminOrManager]);

  // Periodic refresh for admin/manager
  useEffect(() => {
    if (!isAdminOrManager) return;
    
    const interval = setInterval(handleRefresh, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [isAdminOrManager, handleRefresh]);

  // Determine default tab based on role
  const getDefaultTab = () => {
    if (isAdmin) return 'overview';
    if (isManager) return 'overview';
    return 'mark';
  };

  return (
    <>
      <SectionHeader
        title="Attendance Management"
        description={isAdminOrManager 
          ? "Manage employee attendance, leave requests, and view reports" 
          : "Mark your attendance and manage leave requests"
        }
      />

      {/* Stats Cards - only for admin/manager */}
      {isAdminOrManager && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatsCard
            title="Present Today"
            value={stats.present}
            change={`${stats.attendanceRate || 0}%`}
            changeType="positive"
            icon={<UserCheck className="h-5 w-5 text-green-500" />}
          />
          <StatsCard
            title="Absent"
            value={stats.absent}
            icon={<UserX className="h-5 w-5 text-red-500" />}
          />
          <StatsCard
            title="Late Arrivals"
            value={stats.late}
            icon={<Clock className="h-5 w-5 text-yellow-500" />}
          />
          <StatsCard
            title="On Leave"
            value={stats.onLeave}
            icon={<Calendar className="h-5 w-5 text-blue-500" />}
          />
          <StatsCard
            title="Pending Leaves"
            value={pendingLeaveCount}
            icon={<ClipboardCheck className="h-5 w-5 text-orange-500" />}
          />
        </div>
      )}

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList className="flex flex-wrap">
          {/* Employee tabs */}
          {!isAdmin && (
            <>
              <TabsTrigger value="mark">
                <QrCode className="h-4 w-4 mr-2" />
                Mark Attendance
              </TabsTrigger>
              <TabsTrigger value="my-leaves">
                <CalendarDays className="h-4 w-4 mr-2" />
                My Leaves
              </TabsTrigger>
            </>
          )}
          
          {/* Admin/Manager tabs */}
          {isAdminOrManager && (
            <>
              <TabsTrigger value="overview">
                <Users className="h-4 w-4 mr-2" />
                Today's Overview
              </TabsTrigger>
              <TabsTrigger value="generate">
                <QrCode className="h-4 w-4 mr-2" />
                Generate Code
              </TabsTrigger>
              <TabsTrigger value="summary">
                <BarChart3 className="h-4 w-4 mr-2" />
                Monthly Summary
              </TabsTrigger>
              <TabsTrigger value="history">
                <Calendar className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="leaves">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Leave Requests
                {pendingLeaveCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                    {pendingLeaveCount}
                  </Badge>
                )}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Employee Tabs Content */}
        {!isAdmin && (
          <>
            <TabsContent value="mark">
              <MarkAttendance initialAttendance={null} />
            </TabsContent>

            <TabsContent value="my-leaves">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LeaveRequestForm onSuccess={() => setRefreshKey(k => k + 1)} />
                <MyLeaveRequests key={refreshKey} initialData={initialLeaveRequests} onRefresh={() => {}} />
              </div>
            </TabsContent>
          </>
        )}

        {/* Admin/Manager Tabs Content */}
        {isAdminOrManager && (
          <>
            <TabsContent value="overview">
              <TodayAttendance 
                initialData={todayAttendance}
                absentEmployees={absentEmployees}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="generate">
              <div className="max-w-md">
                <GenerateAttendanceCode />
              </div>
            </TabsContent>

            <TabsContent value="summary">
              <AttendanceSummary initialData={initialAttendanceSummary} />
            </TabsContent>

            <TabsContent value="history">
              <AttendanceHistory initialData={initialAttendanceHistory} />
            </TabsContent>

            <TabsContent value="leaves">
              <LeaveRequestsManagement initialData={initialLeaveRequests} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
