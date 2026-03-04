'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, usePerformanceMode } from '@/hooks/useReducedMotion';
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
  ThumbsUp,
  ThumbsDown,
  LayoutGrid,
  ClipboardList,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCog,
  BookOpen,
  MapPin,
  Navigation,
  LocateFixed,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Clock3,
  LogIn,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  initialMyLeaveRequests?: LeaveRequestServer[];
  initialMyLeaveBalance?: LeaveBalanceServer | null;
}

// =============================================
// MARK ATTENDANCE COMPONENT (For Employees)
// =============================================
function MarkAttendance({ initialAttendance }: { initialAttendance?: any }) {
  const { employee } = usePortalAuth();
  const [code, setCode]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(initialAttendance || null);

  // Geolocation state
  const [locationRequired, setLocationRequired] = useState<boolean | null>(null); // null = not fetched yet
  const [locationStatus, setLocationStatus]     = useState<'idle' | 'acquiring' | 'ready' | 'error' | 'denied'>('idle');
  const [locationCoords, setLocationCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError]       = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  // Fetch location requirement on mount
  useEffect(() => {
    attendanceApi('get_attendance_location', {})
      .then((d: any) => {
        const required = d?.location?.enabled === true || d?.configured === true;
        setLocationRequired(!!required);
        if (required) {
          startGPS();
        }
      })
      .catch(() => setLocationRequired(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startGPS() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('GPS not supported on this device');
      return;
    }
    setLocationStatus('acquiring');
    // High-accuracy continuous watch
    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('ready');
        setLocationError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationError('Location access denied. Please allow GPS in browser settings.');
        } else {
          setLocationStatus('error');
          setLocationError('Unable to get your location. Try moving near a window.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }

  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  // Only fetch today if no initial data
  useEffect(() => {
    if (initialAttendance || !employee) return;

    const checkTodayAttendance = async () => {
      try {
        const data = await attendanceApi('get_my_today_attendance');
        if (data?.success) {
          setTodayAttendance(data.attendance);
        }
      } catch {
        // Silently fail
      }
    };

    checkTodayAttendance();
  }, [employee, initialAttendance]);

  const handleMarkAttendance = async () => {
    if (!code.trim() || code.length !== 6) {
      toast.error('Please enter a valid 6-character code');
      return;
    }
    if (locationRequired && locationStatus !== 'ready') {
      toast.error('Waiting for GPS location. Please wait or allow location access.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = { code };
      if (locationCoords) {
        payload.latitude  = locationCoords.lat;
        payload.longitude = locationCoords.lng;
      }
      const data = await attendanceApi('mark_attendance_with_code', payload);

      if (data?.success) {
        toast.success(data.message || 'Attendance marked successfully!');
        setCode('');
        setTodayAttendance(data.attendance);
      } else if (data?.requires_location) {
        setLocationRequired(true);
        startGPS();
        toast.error('Location required — enabling GPS now. Please try again.');
      } else if (data?.location_error) {
        toast.error(data.message || 'You are outside the allowed premises area');
      } else {
        toast.error(data?.message || 'Invalid or expired code');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Location status badge
  const LocationBadge = () => {
    if (locationRequired === false || locationRequired === null) return null;
    const cfg: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
      idle:      { label: 'Location required',  icon: <MapPin className="h-3 w-3" />,                              cls: 'bg-zinc-500/10 text-zinc-600' },
      acquiring: { label: 'Getting location…',  icon: <Loader2 className="h-3 w-3 animate-spin" />,                cls: 'bg-amber-500/10 text-amber-600' },
      ready:     { label: 'Location verified',  icon: <CheckCircle className="h-3 w-3" />,                         cls: 'bg-green-500/10 text-green-600' },
      error:     { label: 'Location error',     icon: <AlertCircle className="h-3 w-3" />,                         cls: 'bg-red-500/10 text-red-600' },
      denied:    { label: 'Location denied',    icon: <AlertCircle className="h-3 w-3" />,                         cls: 'bg-red-500/10 text-red-600' },
    };
    const c = cfg[locationStatus] || cfg.idle;
    return (
      <div className="flex flex-col items-center gap-1">
        <Badge className={cn('flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border-0', c.cls)}>
          {c.icon} {c.label}
        </Badge>
        {locationCoords && locationStatus === 'ready' && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
          </p>
        )}
        {locationError && locationStatus !== 'ready' && (
          <p className="text-xs text-red-500 max-w-xs text-center">{locationError}</p>
        )}
        {(locationStatus === 'denied' || locationStatus === 'error') && (
          <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={startGPS}>
            Retry GPS
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <QrCode className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Mark Attendance</CardTitle>
        <CardDescription>Enter the 6-character code shared by your manager</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {todayAttendance ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg">Attendance Marked!</h3>
            <p className="text-muted-foreground mt-1">
              Check-in: {new Date(todayAttendance.check_in).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
            {todayAttendance.check_out && (
              <p className="text-muted-foreground">
                Check-out: {new Date(todayAttendance.check_out).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            )}
            <Badge className={cn('mt-3', STATUS_CONFIG[todayAttendance.status as AttendanceStatus]?.bgColor)}>
              {STATUS_CONFIG[todayAttendance.status as AttendanceStatus]?.label}
            </Badge>
          </div>
        ) : (
          <>
            {locationRequired && (
              <div className="flex justify-center pt-1 pb-2">
                <LocationBadge />
              </div>
            )}
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
              disabled={isSubmitting || code.length !== 6 || (locationRequired === true && locationStatus === 'denied')}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</>
              ) : locationRequired && locationStatus === 'acquiring' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Waiting for GPS…</>
              ) : (
                'Mark Attendance'
              )}
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
  const [notifSent, setNotifSent] = useState<boolean | null>(null); // null=not sent yet
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
    setNotifSent(null);
    try {
      const data = await attendanceApi('generate_attendance_code', { validMinutes });
      
      if (data?.success && data?.code) {
        const expiry = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();
        setExpiryTime(expiry);
        setValidFrom(data.valid_from);
        setValidUntil(data.valid_until);
        setTimeout(() => {
          setCode(data.code);
          toast.success('Code generated: ' + data.code + ' — Push notifications sent to all employees');
          setNotifSent(true);
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
        setNotifSent(null);
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
            {notifSent !== null && (
              <div className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
                notifSent
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-amber-500/10 text-amber-600'
              )}>
                {notifSent
                  ? <><CheckCircle className="h-3.5 w-3.5" /> Push notifications sent to all employees</>
                  : <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending notifications…</>
                }
              </div>
            )}
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
                          {new Date(record.check_in).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                        {record.check_out && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <span className="text-red-500">●</span>
                            {new Date(record.check_out).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
  const [history, setHistory]           = useState<any[]>(initialData || []);
  const [isLoading, setIsLoading]       = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [hasInitialData]                = useState(!!initialData && initialData.length > 0);

  useEffect(() => {
    if (selectedMonth === currentMonth && hasInitialData) return;
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const [year, month] = selectedMonth.split('-').map(Number);
        const data = await attendanceApi('get_attendance_history', { year, month });
        if (data?.success) setHistory(data.attendance || []);
      } catch { /* silent */ }
      finally { setIsLoading(false); }
    };
    fetchHistory();
  }, [selectedMonth, currentMonth, hasInitialData]);

  const filtered = history.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search || r.employee?.name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalHours = filtered.reduce((acc, r) => {
    if (r.check_in && r.check_out) return acc + (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
    return acc;
  }, 0);

  function handleExport() {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    const columns = [
      { label: 'Date' },
      { label: 'Day' },
      { label: 'Employee' },
      { label: 'Role' },
      { label: 'Check-In' },
      { label: 'Check-Out' },
      { label: 'Hours', type: 'number' as const },
      { label: 'Status' },
      { label: 'Notes' },
    ];
    const rows = filtered.map(r => {
      const ci = r.check_in  ? new Date(r.check_in)  : null;
      const co = r.check_out ? new Date(r.check_out) : null;
      const hours = ci && co ? ((co.getTime() - ci.getTime()) / 3600000).toFixed(2) : '';
      return {
        date:     new Date(r.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }),
        day:      new Date(r.date).toLocaleDateString('en-PK', { weekday: 'long' }),
        employee: r.employee?.name || '',
        role:     r.employee?.role || '',
        checkin:  ci ? ci.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        checkout: co ? co.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        hours,
        status:   r.status,
        notes:    r.notes || '',
      };
    });
    exportToExcel(
      columns.map((c, i) => ({ label: c.label, key: Object.keys(rows[0] || {})[i] || '', type: c.type })),
      rows,
      `attendance_${selectedMonth}`,
      monthName
    );
    toast.success(`Exported ${rows.length} records`);
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-8 w-40 text-sm"
        />
        <Input
          placeholder="Search employee…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-44 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {filtered.length} records · {totalHours.toFixed(1)}h total
            </span>
          )}
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTableWrapper isLoading={isLoading} isEmpty={filtered.length === 0}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead className="text-center">Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((record) => {
                    const config = STATUS_CONFIG[record.status as AttendanceStatus];
                    const ci = record.check_in  ? new Date(record.check_in)  : null;
                    const co = record.check_out ? new Date(record.check_out) : null;
                    const hours = ci && co
                      ? ((co.getTime() - ci.getTime()) / 3600000).toFixed(1)
                      : null;
                    const isWeekend = [0, 5].includes(new Date(record.date).getDay());
                    return (
                      <TableRow
                        key={record.id}
                        className={cn(
                          isWeekend && 'bg-rose-50/30 dark:bg-rose-950/10',
                          record.status === 'late'   && 'bg-amber-50/30 dark:bg-amber-950/10',
                          record.status === 'absent' && 'bg-red-50/30 dark:bg-red-950/10',
                        )}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {new Date(record.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                            </p>
                            <p className={cn('text-xs', isWeekend ? 'text-rose-500 font-semibold' : 'text-muted-foreground')}>
                              {new Date(record.date).toLocaleDateString('en-PK', { weekday: 'short' })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={record.employee?.avatar_url} />
                              <AvatarFallback className="text-[10px]">{record.employee?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium leading-none">{record.employee?.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{record.employee?.role}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-green-600 dark:text-green-400">
                          {ci ? ci.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-blue-600 dark:text-blue-400">
                          {co ? co.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {hours ? (
                            <span className={cn(
                              'text-sm font-semibold',
                              Number(hours) >= 8 ? 'text-green-600' : Number(hours) >= 4 ? 'text-amber-600' : 'text-red-500'
                            )}>
                              {hours}h
                            </span>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('gap-1 text-[10px]', config?.bgColor, config?.color)}>
                            {config?.icon}
                            {config?.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > 0 && (
                <div className="border-t px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                  <span>{filtered.length} records</span>
                  <span>Total hours: <strong className="text-foreground">{totalHours.toFixed(1)}h</strong></span>
                </div>
              )}
            </div>
          </DataTableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// LEAVE REQUEST FORM (Employee)
// =============================================
const LEAVE_BALANCE_META: Record<string, { color: string; bg: string; bar: string; icon: React.ReactNode }> = {
  annual:  { color: 'text-blue-600',   bg: 'bg-blue-500/10',   bar: 'bg-blue-500',   icon: <CalendarDays className="h-4 w-4" /> },
  sick:    { color: 'text-red-600',    bg: 'bg-red-500/10',    bar: 'bg-red-500',    icon: <Heart className="h-4 w-4" /> },
  casual:  { color: 'text-amber-600',  bg: 'bg-amber-500/10',  bar: 'bg-amber-500',  icon: <Coffee className="h-4 w-4" /> },
};

function LeaveRequestForm({ onSuccess, initialBalance }: { onSuccess: () => void; initialBalance?: LeaveBalanceServer | null }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [reason, setReason]       = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance]     = useState<LeaveBalanceServer | null>(initialBalance || null);
  const [balanceLoading, setBalanceLoading] = useState(!initialBalance);
  const [submitted, setSubmitted] = useState(false);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const data = await attendanceApi('get_leave_balance');
      if (data?.balance) setBalance(data.balance);
    } catch { /* silent */ }
    finally { setBalanceLoading(false); }
  }, []);

  // Only fetch if no initial balance was passed
  useEffect(() => { if (!initialBalance) fetchBalance(); }, [fetchBalance, initialBalance]);

  // Computed values
  const today = new Date().toISOString().split('T')[0];
  const totalDays = startDate && endDate
    ? Math.max(0, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;

  const selectedBalance: { available: number; total: number; used: number } | null =
    balance && ['annual', 'sick', 'casual'].includes(leaveType)
      ? (balance as any)[leaveType]
      : null;

  const insufficient = selectedBalance != null && totalDays > 0 && totalDays > selectedBalance.available;
  const balanceMeta  = LEAVE_BALANCE_META[leaveType];
  const canSubmit    = !!startDate && !!endDate && !!reason.trim() && !insufficient && totalDays > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const data = await attendanceApi('create_leave_request', { leaveType, startDate, endDate, reason });
      if (data?.success) {
        toast.success('Leave request submitted — awaiting admin approval');
        setStartDate(''); setEndDate(''); setReason('');
        setSubmitted(true);
        // Refresh balance after submit
        fetchBalance();
        onSuccess();
        setTimeout(() => setSubmitted(false), 4000);
      } else {
        toast.error(data?.error || 'Failed to submit leave request');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      {/* ── Balance tiles ── */}
      {balanceLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}
        </div>
      ) : balance ? (
        <div className="grid grid-cols-3 gap-3">
          {(['annual','sick','casual'] as const).map(type => {
            const b = (balance as any)[type] as { available: number; total: number; used: number };
            const m = LEAVE_BALANCE_META[type];
            const pct = b.total > 0 ? Math.round((b.available / b.total) * 100) : 0;
            const isSelected = leaveType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setLeaveType(type)}
                className={cn(
                  'relative rounded-xl p-3 text-left transition-all border-2',
                  isSelected ? `${m.bg} border-current ${m.color}` : 'border-transparent bg-muted/30 hover:bg-muted/50'
                )}
              >
                <div className={cn('flex items-center gap-1.5 mb-1', isSelected ? m.color : 'text-muted-foreground')}>
                  {m.icon}
                  <span className="text-[11px] font-semibold capitalize">{type}</span>
                </div>
                <div className={cn('text-2xl font-bold leading-none', isSelected ? m.color : 'text-foreground')}>
                  {b.available}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">of {b.total} days</div>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', m.bar)} style={{ width: `${pct}%` }} />
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className={cn('h-3.5 w-3.5', m.color)} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Form card ── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" />
            New Leave Request
          </CardTitle>
          <CardDescription className="text-xs">All requests require admin approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">

          {/* Leave type selector (for non-balance types) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="h-9">
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} min={today}
                onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(''); }}
                className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} min={startDate || today}
                onChange={e => setEndDate(e.target.value)}
                className="h-9" />
            </div>
          </div>

          {/* Live day summary */}
          {totalDays > 0 && (
            <div className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium border',
              insufficient
                ? 'bg-red-500/10 border-red-300 text-red-700 dark:text-red-400'
                : 'bg-green-500/10 border-green-300 text-green-700 dark:text-green-400'
            )}>
              <div className={cn('p-1.5 rounded-lg', insufficient ? 'bg-red-500/20' : 'bg-green-500/20')}>
                {insufficient ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <span className="font-bold">{totalDays} day{totalDays !== 1 ? 's' : ''} requested</span>
                {selectedBalance && (
                  <span className="text-xs ml-2 opacity-75">
                    {insufficient
                      ? `— exceeds available ${selectedBalance.available} days`
                      : `— ${selectedBalance.available - totalDays} days will remain`}
                  </span>
                )}
              </div>
              {selectedBalance && !insufficient && (
                <div className="text-right text-xs opacity-75 shrink-0">
                  <div>{selectedBalance.available} available</div>
                  <div>→ {selectedBalance.available - totalDays} after</div>
                </div>
              )}
            </div>
          )}

          {/* Insufficient warning */}
          {insufficient && selectedBalance && (
            <Alert className="border-red-300 bg-red-500/5">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs text-red-700 dark:text-red-400">
                You only have <strong>{selectedBalance.available} {leaveType} days</strong> available.
                Reduce your request to {selectedBalance.available} day{selectedBalance.available !== 1 ? 's' : ''} or choose a different leave type.
              </AlertDescription>
            </Alert>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Reason <span className="text-red-500">*</span></Label>
              <span className="text-[10px] text-muted-foreground">{reason.length}/500</span>
            </div>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              placeholder="Describe your reason for leave (e.g. family event, medical appointment)…"
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Success animation */}
          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-300 px-4 py-3"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Request submitted!</p>
                  <p className="text-xs text-green-600">Waiting for admin approval.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
        <CardFooter className="border-t pt-4 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => { setStartDate(''); setEndDate(''); setReason(''); setLeaveType('annual'); }}
            disabled={isSubmitting}
          >
            Clear
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
              : <><Send className="mr-2 h-4 w-4" />Submit Request</>}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// =============================================
// LEAVE BALANCE CARD (Employee)
// Shows SSR-fetched leave balance data
// =============================================
function LeaveBalanceCard({ balance }: { balance: LeaveBalanceServer }) {
  const leaveTypes = [
    { 
      key: 'annual', 
      label: 'Annual Leave', 
      data: balance.annual,
      icon: <CalendarDays className="h-4 w-4" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      key: 'sick', 
      label: 'Sick Leave', 
      data: balance.sick,
      icon: <Heart className="h-4 w-4" />,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    { 
      key: 'casual', 
      label: 'Casual Leave', 
      data: balance.casual,
      icon: <Coffee className="h-4 w-4" />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-5 w-5" />
          Leave Balance ({balance.year})
        </CardTitle>
        <CardDescription>
          Your available leave days for the current year
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {leaveTypes.map(({ key, label, data, icon, color, bgColor }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded', bgColor)}>
                    <span className={color}>{icon}</span>
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {data.available} / {data.total} days
                </span>
              </div>
              <Progress 
                value={data.total > 0 ? ((data.total - data.used) / data.total) * 100 : 0} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Used: {data.used} days</span>
                <span>Available: {data.available} days</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================
// MY LEAVE REQUESTS (Employee)
// =============================================
function MyLeaveRequests({ onRefresh }: { initialData?: LeaveRequestServer[]; onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequestServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestServer | null>(null);

  // Always fetch on mount and on explicit refresh
  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const data = await attendanceApi('get_my_leave_requests', {
          year: new Date().getFullYear(),
          limit: 50
        });
        if (data?.requests) setRequests(data.requests);
      } catch { /* silent */ }
      finally { setIsLoading(false); }
    };
    fetchRequests();
  }, [refreshCount]);

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Leave Requests
          </CardTitle>
          <CardDescription>
            View your leave request history and status
          </CardDescription>
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
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(request.id);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(request);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

      {/* Leave Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Leave Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (() => {
            const typeConfig = LEAVE_TYPE_CONFIG[selectedRequest.leave_type];
            const statusConfig = LEAVE_STATUS_CONFIG[selectedRequest.status];
            
            return (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={cn(statusConfig?.bgColor, statusConfig?.textColor, 'text-sm')}>
                    {statusConfig?.label}
                  </Badge>
                </div>

                {/* Leave Type */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={cn('p-2 rounded-lg', typeConfig?.color === 'text-blue-500' ? 'bg-blue-500/10' : 'bg-gray-100')}>
                    {typeConfig?.icon}
                  </div>
                  <div>
                    <p className="font-medium">{typeConfig?.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.total_days} day{selectedRequest.total_days > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.start_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.end_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedRequest.reason}</p>
                </div>

                {/* Approval/Rejection Details */}
                {(selectedRequest.status === 'approved' || selectedRequest.status === 'rejected') && (
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {selectedRequest.status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                      )}
                      {selectedRequest.status === 'approved' ? 'Approved' : 'Rejected'}
                    </p>
                    
                    {selectedRequest.reviewer && (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {selectedRequest.reviewer.name?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{selectedRequest.reviewer.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{selectedRequest.reviewer.role}</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedRequest.reviewed_at && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed on {new Date(selectedRequest.reviewed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    
                    {selectedRequest.review_notes && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Review Notes</p>
                        <p className="text-sm">{selectedRequest.review_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submitted Date */}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Submitted on {new Date(selectedRequest.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================
// LEAVE REQUESTS MANAGEMENT (Admin/Manager)
// =============================================
function LeaveRequestsManagement({ initialData }: { initialData: LeaveRequestServer[] }) {
  const [requests, setRequests] = useState<LeaveRequestServer[]>(initialData || []);
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestServer | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pendingList   = requests.filter(r => r.status === 'pending');
  const approvedList  = requests.filter(r => r.status === 'approved');
  const rejectedList  = requests.filter(r => r.status === 'rejected');
  const cancelledList = requests.filter(r => r.status === 'cancelled');

  const listByTab: Record<string, LeaveRequestServer[]> = {
    pending: pendingList,
    approved: approvedList,
    rejected: rejectedList,
    cancelled: cancelledList,
  };

  const handleReview = async (request: LeaveRequestServer, status: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const data = await attendanceApi('review_leave_request', {
        requestId: request.id,
        status,
        reviewerNotes: reviewNotes || null,
      });
      if (data?.success) {
        toast.success(`Leave request ${status}`);
        setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status } : r));
        setSelectedRequest(null);
        setReviewNotes('');
      } else {
        toast.error(data?.error || 'Failed to process request');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshRequests = async () => {
    setIsRefreshing(true);
    try {
      const data = await attendanceApi('get_all_leave_requests', {
        statusFilter: null,
        year: new Date().getFullYear(),
        month: null,
      });
      if (data?.success) setRequests(data.requests || []);
    } catch {
      // silent
    } finally {
      setIsRefreshing(false);
    }
  };

  const LeaveCard = ({ request }: { request: LeaveRequestServer }) => {
    const typeConfig = LEAVE_TYPE_CONFIG[request.leave_type];
    const statusCfg  = LEAVE_STATUS_CONFIG[request.status];
    return (
      <motion.div
        key={request.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={request.employee?.avatar_url} />
              <AvatarFallback>{request.employee?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{request.employee?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{request.employee?.role}</p>
            </div>
          </div>
          <Badge className={cn(statusCfg?.bgColor, statusCfg?.textColor, 'shrink-0')}>{statusCfg?.label}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <span className={typeConfig?.color}>{typeConfig?.icon}</span>
            <span>{typeConfig?.label}</span>
          </div>
          <div className="text-muted-foreground">
            {new Date(request.start_date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(request.end_date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
            <span className="ml-1 text-xs">({request.total_days}d)</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{request.reason}</p>
        {request.review_notes && (
          <div className="mt-2 p-2 rounded-lg bg-muted/50 text-xs">
            <span className="font-medium">Note: </span>{request.review_notes}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          {request.status === 'pending' ? (
            <>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleReview(request, 'approved')}
                disabled={isProcessing}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => { setSelectedRequest(request); setReviewNotes(''); }}
                disabled={isProcessing}
              >
                <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setSelectedRequest(request)}>
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leave Requests
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{requests.length} total requests this year</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshRequests} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingList.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 px-1 text-[9px] rounded-full">
                {pendingList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedList.length > 0 && (
              <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[9px] rounded-full bg-green-500/20 text-green-700 border-0">
                {approvedList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            {rejectedList.length > 0 && (
              <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[9px] rounded-full bg-red-500/20 text-red-700 border-0">
                {rejectedList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled
            {cancelledList.length > 0 && (
              <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[9px] rounded-full bg-zinc-500/20 text-zinc-600 border-0">
                {cancelledList.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {(['pending', 'approved', 'rejected', 'cancelled'] as const).map(tab => (
          <TabsContent key={tab} value={tab}>
            {listByTab[tab].length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mb-2 opacity-50" />
                <p className="text-muted-foreground">No {tab} leave requests</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {listByTab[tab].map(req => <LeaveCard key={req.id} request={req} />)}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject Dialog */}
      <Dialog
        open={!!selectedRequest && selectedRequest.status === 'pending'}
        onOpenChange={() => { setSelectedRequest(null); setReviewNotes(''); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Providing notes helps {selectedRequest?.employee?.name} understand the decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <p className="font-medium">{LEAVE_TYPE_CONFIG[selectedRequest?.leave_type || 'other']?.label}</p>
              <p className="text-muted-foreground">
                {selectedRequest && new Date(selectedRequest.start_date).toLocaleDateString()} –{' '}
                {selectedRequest && new Date(selectedRequest.end_date).toLocaleDateString()}
                {' '}({selectedRequest?.total_days} days)
              </p>
              <p className="text-muted-foreground">{selectedRequest?.reason}</p>
            </div>
            <div className="space-y-2">
              <Label>Rejection Reason <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Explain why this leave is being rejected..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && handleReview(selectedRequest, 'rejected')}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog for non-pending */}
      <Dialog
        open={!!selectedRequest && selectedRequest.status !== 'pending'}
        onOpenChange={() => setSelectedRequest(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (() => {
            const typeConfig = LEAVE_TYPE_CONFIG[selectedRequest.leave_type];
            const statusCfg = LEAVE_STATUS_CONFIG[selectedRequest.status];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedRequest.employee?.avatar_url} />
                      <AvatarFallback>{selectedRequest.employee?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedRequest.employee?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedRequest.employee?.role}</p>
                    </div>
                  </div>
                  <Badge className={cn(statusCfg?.bgColor, statusCfg?.textColor)}>{statusCfg?.label}</Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={typeConfig?.color}>{typeConfig?.icon}</span>
                    <span className="font-medium">{typeConfig?.label}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {new Date(selectedRequest.start_date).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(selectedRequest.end_date).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}
                    <span className="ml-2">({selectedRequest.total_days} days)</span>
                  </p>
                  <p>{selectedRequest.reason}</p>
                </div>
                {selectedRequest.review_notes && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Review Note</p>
                    <p>{selectedRequest.review_notes}</p>
                  </div>
                )}
                {selectedRequest.reviewed_at && (
                  <p className="text-xs text-muted-foreground">
                    Reviewed on {new Date(selectedRequest.reviewed_at).toLocaleDateString('en-PK', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
                    })}
                  </p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================
// EXCEL EXPORT HELPER (no package needed — SpreadsheetML)
// =============================================
function exportToExcel(columns: { label: string; key: string; type?: 'number' | 'string' }[], rows: Record<string, any>[], filename: string, sheetName = 'Attendance') {
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cell = (v: any, t = 'String') => `<Cell><Data ss:Type="${t}">${esc(v)}</Data></Cell>`;
  const headerRow = `<Row ss:StyleID="h">${columns.map(c => cell(c.label)).join('')}</Row>`;
  const dataRows = rows.map(row =>
    `<Row>${columns.map(c => {
      const v = row[c.key] ?? '';
      return cell(v, c.type === 'number' && !isNaN(Number(v)) ? 'Number' : 'String');
    }).join('')}</Row>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
  <Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="${esc(sheetName)}"><Table>${headerRow}${dataRows}</Table></Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================
// MY ATTENDANCE SHEET (Employee — full export)
// =============================================
type SheetMode = 'today' | 'week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

function MyAttendanceSheet() {
  const today = new Date();
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);

  const [mode, setMode]             = useState<SheetMode>('this_month');
  const [customStart, setCustomStart] = useState(fmt(today));
  const [customEnd, setCustomEnd]   = useState(fmt(today));
  const [statusFilter, setStatusFilter] = useState('all');
  const [records, setRecords]       = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Compute date range from mode
  function getRange(): { start: string; end: string; label: string } {
    const d = new Date();
    switch (mode) {
      case 'today':
        return { start: fmt(d), end: fmt(d), label: 'Today' };
      case 'week': {
        const day = d.getDay(); // 0=Sun
        const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        return { start: fmt(mon), end: fmt(sun), label: 'This Week' };
      }
      case 'this_month': {
        const s = new Date(d.getFullYear(), d.getMonth(), 1);
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return { start: fmt(s), end: fmt(e), label: d.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }) };
      }
      case 'last_month': {
        const s = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const e = new Date(d.getFullYear(), d.getMonth(), 0);
        return { start: fmt(s), end: fmt(e), label: 'Last Month' };
      }
      case 'this_year': {
        return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `Year ${d.getFullYear()}` };
      }
      case 'custom':
        return {
          start: customStart || fmt(d),
          end:   customEnd   || fmt(d),
          label: `${customStart} → ${customEnd}`,
        };
    }
  }

  const range = getRange();

  const fetchSheet = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await attendanceApi('get_my_attendance_sheet', {
        startDate: range.start,
        endDate:   range.end,
      });
      if (data?.success) {
        setRecords(data.attendance || []);
        setHasFetched(true);
      } else {
        toast.error(data?.error || 'Failed to fetch attendance sheet');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customStart, customEnd]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  // Filtered records
  const filtered = records.filter(r => statusFilter === 'all' || r.status === statusFilter);

  // Summary stats
  const stats = {
    total:    filtered.length,
    present:  filtered.filter(r => r.status === 'present').length,
    late:     filtered.filter(r => r.status === 'late').length,
    absent:   filtered.filter(r => r.status === 'absent').length,
    onLeave:  filtered.filter(r => r.status === 'on_leave').length,
    manual:   filtered.filter(r => r.is_manual).length,
    totalHours: filtered.reduce((acc, r) => {
      if (r.check_in && r.check_out) {
        return acc + (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
      }
      return acc;
    }, 0),
  };
  const attendanceRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  function handleExport() {
    const filename = `attendance_${range.start}_${range.end}`;
    const columns = [
      { label: 'Date',        key: 'date_str' },
      { label: 'Day',         key: 'day_str' },
      { label: 'Check-In',    key: 'checkin_str' },
      { label: 'Check-Out',   key: 'checkout_str' },
      { label: 'Hours',       key: 'hours',    type: 'number' as const },
      { label: 'Status',      key: 'status' },
      { label: 'Type',        key: 'type' },
      { label: 'Notes',       key: 'notes' },
    ];

    const rows = filtered.map(r => {
      const ci = r.check_in  ? new Date(r.check_in)  : null;
      const co = r.check_out ? new Date(r.check_out) : null;
      const hours = ci && co
        ? ((co.getTime() - ci.getTime()) / 3600000).toFixed(2)
        : '';
      return {
        date_str:    new Date(r.date).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        day_str:     new Date(r.date).toLocaleDateString('en-PK', { weekday: 'long' }),
        checkin_str: ci ? ci.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        checkout_str: co ? co.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        hours,
        status:      r.status,
        type:        r.is_manual ? 'Manual' : 'Auto',
        notes:       r.notes || '',
      };
    });

    exportToExcel(columns, rows, filename, 'Attendance Sheet');
    toast.success(`Exported ${rows.length} records to Excel`);
  }

  const MODE_OPTIONS: { value: SheetMode; label: string }[] = [
    { value: 'today',      label: 'Today' },
    { value: 'week',       label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_year',  label: 'This Year' },
    { value: 'custom',     label: 'Custom Range' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            My Attendance Sheet
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{range.label}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSheet}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Mode selector pills */}
      <div className="flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              mode === opt.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/50 border-transparent hover:border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom range picker */}
      {mode === 'custom' && (
        <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={customStart}
              max={customEnd || fmt(today)}
              onChange={e => setCustomStart(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              max={fmt(today)}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
        </div>
      )}

      {/* Status filter + stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          {[
            { label: 'Present', val: stats.present, cls: 'bg-green-500/10 text-green-700' },
            { label: 'Late',    val: stats.late,    cls: 'bg-amber-500/10 text-amber-700' },
            { label: 'Absent',  val: stats.absent,  cls: 'bg-red-500/10 text-red-700' },
            { label: `${stats.totalHours.toFixed(1)}h`, val: null, cls: 'bg-blue-500/10 text-blue-700' },
            { label: `${attendanceRate}%`,              val: null, cls: 'bg-purple-500/10 text-purple-700' },
          ].map((s, i) => (
            <span key={i} className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', s.cls)}>
              {s.val !== null ? `${s.val} ` : ''}{s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : !hasFetched || filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No attendance records</p>
              <p className="text-xs text-muted-foreground mt-1">for {range.label}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead className="w-24">Day</TableHead>
                    <TableHead className="w-28">Check-In</TableHead>
                    <TableHead className="w-28">Check-Out</TableHead>
                    <TableHead className="w-20 text-center">Hours</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-20 text-center">Type</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const cfg = STATUS_CONFIG[r.status as AttendanceStatus];
                    const ci  = r.check_in  ? new Date(r.check_in)  : null;
                    const co  = r.check_out ? new Date(r.check_out) : null;
                    const hours = ci && co
                      ? ((co.getTime() - ci.getTime()) / 3600000).toFixed(1)
                      : null;
                    const date = new Date(r.date);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 5; // Sun/Fri
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          'transition-colors',
                          isWeekend && 'bg-rose-50/40 dark:bg-rose-950/10',
                          r.status === 'absent'   && 'bg-red-50/40 dark:bg-red-950/10',
                          r.status === 'late'     && 'bg-amber-50/40 dark:bg-amber-950/10',
                          r.status === 'present'  && 'bg-green-50/20 dark:bg-green-950/5',
                        )}
                      >
                        <TableCell className="font-medium text-sm">
                          {date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className={cn('text-xs', isWeekend && 'text-rose-500 font-semibold')}>
                          {date.toLocaleDateString('en-PK', { weekday: 'long' })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {ci ? (
                            <span className="text-green-600 dark:text-green-400">
                              {ci.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {co ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              {co.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {hours ? (
                            <span className={cn(
                              'text-sm font-semibold',
                              Number(hours) >= 8 ? 'text-green-600' : Number(hours) >= 4 ? 'text-amber-600' : 'text-red-500'
                            )}>
                              {hours}h
                            </span>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px] px-2 py-0.5 gap-1', cfg?.bgColor, cfg?.color)}>
                            {cfg?.icon}
                            {cfg?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.is_manual ? (
                            <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-0">
                              Manual
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] px-1.5 py-0 bg-zinc-500/10 text-zinc-600 border-0">
                              Auto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {r.notes || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Footer summary */}
              <div className="border-t px-4 py-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>{filtered.length} records</span>
                <span className="flex items-center gap-3">
                  <span>Total: <strong className="text-foreground">{stats.totalHours.toFixed(1)}h</strong></span>
                  <span>Attendance: <strong className="text-foreground">{attendanceRate}%</strong></span>
                  {stats.manual > 0 && <span className="text-amber-600">{stats.manual} manual</span>}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// MANUAL ATTENDANCE REQUEST FORM (Employee)
// =============================================
function ManualAttendanceRequestForm({ onSuccess }: { onSuccess?: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!checkIn) {
      toast.error('Check-in time is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await attendanceApi('request_manual_attendance', {
        date: selectedDate,
        checkIn,
        checkOut: checkOut || null,
        status,
        notes: notes || null,
      });
      if (data?.success) {
        toast.success('Manual attendance request submitted — awaiting admin approval');
        setNotes('');
        onSuccess?.();
      } else {
        toast.error(data?.error || 'Failed to submit request');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-500" />
          Request Manual Attendance
        </CardTitle>
        <CardDescription>
          Submit a correction request — an admin or manager will review and approve it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Check In Time</Label>
            <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Check Out Time <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reason for Correction</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Briefly explain why you missed marking attendance..."
            rows={3}
          />
        </div>
        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Submit for Approval</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================
// PENDING MANUAL ATTENDANCE APPROVALS (Admin/Manager)
// =============================================
function PendingManualApprovals({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await attendanceApi('get_pending_manual_attendances');
      const list = data?.requests || [];
      setRequests(list);
      onCountChange?.(list.length);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const data = await attendanceApi('approve_manual_attendance', { attendanceId: id });
      if (data?.success) {
        toast.success('Attendance approved!');
        const next = requests.filter(r => r.id !== id);
        setRequests(next);
        onCountChange?.(next.length);
      } else {
        toast.error(data?.error || 'Failed to approve');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    try {
      const data = await attendanceApi('reject_manual_attendance', {
        attendanceId: rejectTarget.id,
        notes: rejectNotes || null,
      });
      if (data?.success) {
        toast.success('Request rejected');
        setRequests(prev => {
          const next = prev.filter(r => r.id !== rejectTarget.id);
          onCountChange?.(next.length);
          return next;
        });
        setRejectTarget(null);
        setRejectNotes('');
      } else {
        toast.error(data?.error || 'Failed to reject');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
          <p className="font-semibold text-lg">All Clear!</p>
          <p className="text-muted-foreground text-sm mt-1">No pending manual attendance requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((req) => {
          const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
          const isProcessing = processingId === req.id;
          return (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={req.employee?.avatar_url} />
                    <AvatarFallback className="bg-amber-500/20 text-amber-700 font-semibold">
                      {req.employee?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{req.employee?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{req.employee?.role}</p>
                  </div>
                </div>
                <Badge className="shrink-0 bg-amber-500/10 text-amber-700 border border-amber-300">Pending</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-medium">{new Date(req.date).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span className={cn('font-medium', config?.color)}>{config?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Check In: </span>
                  <span className="font-medium">
                    {req.check_in ? new Date(req.check_in).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Check Out: </span>
                  <span className="font-medium">
                    {req.check_out ? new Date(req.check_out).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                  </span>
                </div>
              </div>
              {req.request_notes && (
                <div className="mt-2 p-2 rounded-lg bg-white dark:bg-zinc-800/50 text-sm">
                  <span className="text-muted-foreground">Reason: </span>{req.request_notes}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(req.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ThumbsUp className="h-3.5 w-3.5 mr-1" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setRejectTarget(req)}
                  disabled={isProcessing}
                >
                  <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectNotes(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Reject attendance request from {rejectTarget?.employee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason (Optional)</Label>
            <Textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Provide a reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processingId}>
              {processingId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================
// EMPLOYEE ATTENDANCE GRID (School-style)
// =============================================
function EmployeeAttendanceGrid() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);
  const [gridData, setGridData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fmt12 = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

  const fetchGrid = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await attendanceApi('get_employee_attendance_grid', {
        year,
        month,
        employeeId: null,
      });
      if (data?.success) setGridData(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = gridData?.days_in_month || 31;
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const STATUS_CELL: Record<string, { bg: string; text: string; abbr: string }> = {
    present:  { bg: 'bg-green-500',  text: 'text-white', abbr: 'P' },
    absent:   { bg: 'bg-red-500',    text: 'text-white', abbr: 'A' },
    late:     { bg: 'bg-yellow-400', text: 'text-black', abbr: 'L' },
    half_day: { bg: 'bg-orange-400', text: 'text-white', abbr: 'H' },
    on_leave: { bg: 'bg-blue-500',   text: 'text-white', abbr: 'LV' },
  };

  const filteredEmployees = (gridData?.employees || []).filter((e: any) =>
    !searchTerm || e.emp_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-base min-w-40 text-center">{monthName}</span>
          <Button variant="outline" size="icon" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchGrid} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CELL).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]', val.bg, val.text)}>{val.abbr}</div>
            <span className="text-muted-foreground">{STATUS_CONFIG[key as keyof typeof STATUS_CONFIG]?.label || key}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-[10px] text-zinc-500">—</div>
          <span className="text-muted-foreground">No Record</span>
        </div>
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No employees found</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/80 text-left px-3 py-2.5 font-semibold min-w-[150px] border-b border-r border-border">Employee</th>
                  {dayNumbers.map(d => {
                    const dateObj = new Date(year, month - 1, d);
                    const isToday = isCurrentMonth && d === now.getDate();
                    const isFriday = dateObj.getDay() === 5;
                    const isSunday = dateObj.getDay() === 0;
                    return (
                      <th key={d} className={cn(
                        'px-1 py-2.5 text-center font-medium border-b border-border min-w-[36px]',
                        isToday && 'bg-primary/10 text-primary',
                        (isFriday || isSunday) && 'bg-rose-50 dark:bg-rose-950/20 text-rose-500'
                      )}>
                        <div className="font-bold">{d}</div>
                        <div className="text-[9px] text-muted-foreground">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 text-center font-semibold border-b border-l border-border min-w-[48px]">P</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-b border-border min-w-[48px]">A</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-b border-border min-w-[48px]">L</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp: any, empIdx: number) => {
                  const recordMap: Record<number, any> = {};
                  (emp.records || []).forEach((r: any) => { recordMap[r.day] = r; });
                  let presentCount = 0, absentCount = 0, lateCount = 0;
                  dayNumbers.forEach(d => {
                    const r = recordMap[d];
                    if (!r) absentCount++;
                    else if (r.status === 'present') presentCount++;
                    else if (r.status === 'late' || r.status === 'half_day') { presentCount++; lateCount++; }
                    else if (r.status === 'absent') absentCount++;
                  });
                  return (
                    <tr key={emp.emp_id} className={cn('hover:bg-muted/30', empIdx % 2 === 0 ? '' : 'bg-muted/10')}>
                      <td className="sticky left-0 z-10 bg-background border-r border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={emp.emp_avatar} />
                            <AvatarFallback className="text-[10px] font-semibold">{emp.emp_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium leading-tight truncate max-w-[100px]">{emp.emp_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{emp.emp_role}</p>
                          </div>
                        </div>
                      </td>
                      {dayNumbers.map(d => {
                        const dateObj = new Date(year, month - 1, d);
                        const isFuture = isCurrentMonth && d > now.getDate();
                        const isFriday = dateObj.getDay() === 5;
                        const isSunday = dateObj.getDay() === 0;
                        const r = recordMap[d];
                        const cellStyle = r ? STATUS_CELL[r.status] : null;

                        return (
                          <td key={d} className={cn(
                            'border border-border/50 text-center p-0.5',
                            (isFriday || isSunday) && 'bg-rose-50/50 dark:bg-rose-950/10',
                            isFuture && 'opacity-30',
                          )}>
                            {isFuture ? (
                              <div className="w-7 h-7 mx-auto" />
                            ) : r && cellStyle ? (
                              <div
                                title={`${r.status} — ${fmt12(r.check_in)}${r.check_out ? ' → ' + fmt12(r.check_out) : ''}`}
                                className={cn('w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-[10px] cursor-default', cellStyle.bg, cellStyle.text)}
                              >
                                {cellStyle.abbr}
                              </div>
                            ) : (
                              <div className="w-7 h-7 mx-auto rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-[10px]">—</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-l border-border px-2 py-1 text-center">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 text-[10px]">{presentCount}</Badge>
                      </td>
                      <td className="border border-border/50 px-2 py-1 text-center">
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 text-[10px]">{absentCount}</Badge>
                      </td>
                      <td className="border border-border/50 px-2 py-1 text-center">
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 text-[10px]">{lateCount}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// ATTENDANCE SETTINGS PANEL (Admin/Manager)
// =============================================
function AttendanceSettingsPanel() {
  // ---- Geofence state ----
  const [lat, setLat]             = useState('');
  const [lng, setLng]             = useState('');
  const [locName, setLocName]     = useState('Restaurant');
  const [radius, setRadius]       = useState(100);
  const [geoEnabled, setGeoEnabled] = useState(true);
  const [geoConfigured, setGeoConfigured] = useState(false);
  const [geoSaving, setGeoSaving] = useState(false);
  const [geoDetecting, setGeoDetecting] = useState(false);

  // ---- Time rules state ----
  const [ciEnabled, setCiEnabled]     = useState(true);
  const [ciOpens, setCiOpens]         = useState('07:00');
  const [ciLateAfter, setCiLateAfter] = useState('09:30');
  const [ciCloses, setCiCloses]       = useState('12:00');
  const [coEnabled, setCoEnabled]     = useState(false);
  const [coEarliest, setCoEarliest]   = useState('13:00');
  const [timeSaving, setTimeSaving]   = useState(false);
  const [timeConfigured, setTimeConfigured] = useState(false);

  // ---- Leave quota state ----
  const [annualDays, setAnnualDays]   = useState(14);
  const [sickDays, setSickDays]       = useState(10);
  const [casualDays, setCasualDays]   = useState(7);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaConfigured, setQuotaConfigured] = useState(false);
  const [applyToAll, setApplyToAll]   = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSettings = useCallback(async () => {
    setRefreshing(true);
    try {
      const [geoD, timeD, quotaD] = await Promise.all([
        fetch('/api/portal/attendance/actions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_attendance_location' }),
        }).then(r => r.json()),
        fetch('/api/portal/attendance/actions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_attendance_time_rules' }),
        }).then(r => r.json()),
        fetch('/api/portal/attendance/actions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_leave_quota_settings' }),
        }).then(r => r.json()),
      ]);
      // Geofence
      const loc = geoD?.data?.location;
      if (loc) {
        if (loc.latitude  != null) setLat(String(loc.latitude));
        if (loc.longitude != null) setLng(String(loc.longitude));
        if (loc.location_name)     setLocName(loc.location_name);
        if (loc.radius_meters)     setRadius(loc.radius_meters);
        if (loc.enabled != null)   setGeoEnabled(loc.enabled);
        setGeoConfigured(!!geoD.data.configured);
      }
      // Time rules
      const rules = timeD?.data?.rules;
      if (rules) {
        setTimeConfigured(!!timeD.data.configured);
        if (rules.check_in) {
          setCiEnabled(rules.check_in.enabled !== false);
          if (rules.check_in.opens_at)   setCiOpens(rules.check_in.opens_at);
          if (rules.check_in.late_after) setCiLateAfter(rules.check_in.late_after);
          if (rules.check_in.closes_at)  setCiCloses(rules.check_in.closes_at);
        }
        if (rules.check_out) {
          setCoEnabled(rules.check_out.enabled === true);
          if (rules.check_out.earliest_at) setCoEarliest(rules.check_out.earliest_at);
        }
      }
      // Leave quotas
      const q = quotaD?.data?.quotas;
      if (q) {
        if (q.annual  != null) setAnnualDays(q.annual);
        if (q.sick    != null) setSickDays(q.sick);
        if (q.casual  != null) setCasualDays(q.casual);
        setQuotaConfigured(!!quotaD.data.configured);
      }
    } catch {}
    finally { setRefreshing(false); setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleAutoDetect = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGeoDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setGeoDetecting(false);
        toast.success('GPS coordinates captured');
      },
      (err) => { toast.error('Could not get location: ' + err.message); setGeoDetecting(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSaveGeofence = async () => {
    const latN = parseFloat(lat), lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) { toast.error('Enter valid latitude and longitude'); return; }
    if (radius < 10 || radius > 5000) { toast.error('Radius must be between 10 m and 5000 m'); return; }
    setGeoSaving(true);
    try {
      const res = await fetch('/api/portal/attendance/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_attendance_location',
          latitude: latN, longitude: lngN,
          locationName: locName || 'Restaurant',
          radiusMeters: radius, enabled: geoEnabled,
        }),
      });
      const d = await res.json();
      if (d?.data?.success) { setGeoConfigured(true); toast.success('Geofence settings saved'); await fetchSettings(); }
      else toast.error(d?.data?.error || d?.error || 'Failed to save');
    } catch (err: any) { toast.error(err.message); }
    finally { setGeoSaving(false); }
  };

  const handleSaveTimeRules = async () => {
    setTimeSaving(true);
    try {
      const res = await fetch('/api/portal/attendance/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_attendance_time_rules',
          checkinEnabled: ciEnabled,
          checkinOpens: ciOpens,
          checkinLateAfter: ciLateAfter,
          checkinCloses: ciCloses,
          checkoutEnabled: coEnabled,
          checkoutEarliest: coEarliest,
        }),
      });
      const d = await res.json();
      if (d?.data?.success) { setTimeConfigured(true); toast.success('Time rules saved'); await fetchSettings(); }
      else toast.error(d?.data?.error || d?.error || 'Failed to save');
    } catch (err: any) { toast.error(err.message); }
    finally { setTimeSaving(false); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasValidCoords = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ─── REFRESH BUTTON ─── */}
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={fetchSettings} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* ─── CARD 1: GEOFENCE ─── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500/5 to-transparent border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 shrink-0">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Geofence / Location</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Employees can only mark attendance when physically within the allowed radius
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{geoEnabled ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={geoEnabled} onCheckedChange={setGeoEnabled} />
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs font-medium',
            geoConfigured ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          )}>
            {geoConfigured
              ? <><CheckCircle className="h-3.5 w-3.5 shrink-0" /> Configured &amp; {geoEnabled ? 'active' : 'disabled'} — {locName || 'Premises'} · {radius} m radius</>
              : <><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> No location set — attendance works without location check</>}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Auto-detect */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-sm font-medium">Auto-detect from this device</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use current GPS position as the premises location</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleAutoDetect} disabled={geoDetecting}>
              {geoDetecting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Detecting…</>
                : <><LocateFixed className="h-4 w-4 mr-2" />Detect GPS</>}
            </Button>
          </div>

          {/* Coords */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="geo-lat" className="text-xs">Latitude</Label>
              <Input id="geo-lat" value={lat} onChange={e => setLat(e.target.value)}
                placeholder="e.g. 31.5204" className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="geo-lng" className="text-xs">Longitude</Label>
              <Input id="geo-lng" value={lng} onChange={e => setLng(e.target.value)}
                placeholder="e.g. 74.3587" className="font-mono text-sm h-9" />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="geo-name" className="text-xs">Location Name</Label>
            <Input id="geo-name" value={locName} onChange={e => setLocName(e.target.value)}
              placeholder="e.g. Main Branch, Gulberg" className="h-9" />
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Allowed Radius</Label>
              <span className="text-sm font-mono font-bold text-primary">{radius} m</span>
            </div>
            <input
              type="range" min={10} max={500} step={5}
              value={Math.min(radius, 500)}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex items-center gap-2">
              <Input type="number" min={10} max={5000} step={10} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="h-8 w-24 font-mono text-sm" />
              <span className="text-xs text-muted-foreground">meters (10 – 5000)</span>
            </div>
            <div className="grid grid-cols-3 text-[10px] text-muted-foreground text-center">
              <span>50 m — very strict</span>
              <span>100 m — recommended</span>
              <span>500 m — loose</span>
            </div>
          </div>

          {/* Map preview */}
          {hasValidCoords && (
            <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 underline">
              <Navigation className="h-4 w-4" /> Preview on Google Maps ↗
            </a>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              When an employee enters the attendance code, their browser GPS is verified.
              If outside the <strong>{radius} m</strong> radius of <em>{locName || 'this location'}</em> the request is rejected.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleSaveGeofence} disabled={geoSaving || !lat || !lng} className="ml-auto">
            {geoSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Geofence</>}
          </Button>
        </CardFooter>
      </Card>

      {/* ─── CARD 2: TIME RULES ─── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-500/5 to-transparent border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 shrink-0">
                <Clock3 className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-base">Time Windows</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Control when employees can check in and check out, and when they are marked late
                </CardDescription>
              </div>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs font-medium',
            timeConfigured ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          )}>
            {timeConfigured
              ? <><CheckCircle className="h-3.5 w-3.5 shrink-0" /> Time windows configured &amp; active</>
              : <><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Using default times (late after 9:30 AM, no window enforcement)</>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">

          {/* ─ Check-in window ─ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <LogIn className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Check-In Window</p>
                  <p className="text-xs text-muted-foreground">When employees are allowed to check in</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{ciEnabled ? 'Enforced' : 'Off'}</span>
                <Switch checked={ciEnabled} onCheckedChange={setCiEnabled} />
              </div>
            </div>

            <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-4 transition-opacity', !ciEnabled && 'opacity-40 pointer-events-none')}>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Opens At
                </Label>
                <Input type="time" value={ciOpens} onChange={e => setCiOpens(e.target.value)} className="h-9 font-mono" />
                <p className="text-[10px] text-muted-foreground">Earliest allowed check-in</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" /> Late After
                </Label>
                <Input type="time" value={ciLateAfter} onChange={e => setCiLateAfter(e.target.value)} className="h-9 font-mono border-amber-300 focus:border-amber-400" />
                <p className="text-[10px] text-muted-foreground">Marked <strong className="text-amber-600">late</strong> after this time</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> Closes At
                </Label>
                <Input type="time" value={ciCloses} onChange={e => setCiCloses(e.target.value)} className="h-9 font-mono border-red-300 focus:border-red-400" />
                <p className="text-[10px] text-muted-foreground">Check-in rejected after this time</p>
              </div>
            </div>

            {ciEnabled && (
              <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Present: {ciOpens} – {ciLateAfter}</div>
                <div className="mx-1 text-muted-foreground">·</div>
                <div className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Late: {ciLateAfter} – {ciCloses}</div>
                <div className="mx-1 text-muted-foreground">·</div>
                <div className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Closed after {ciCloses}</div>
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* ─ Check-out window ─ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <LogOut className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Check-Out Window</p>
                  <p className="text-xs text-muted-foreground">Prevent early check-outs before shift ends</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{coEnabled ? 'Enforced' : 'Off'}</span>
                <Switch checked={coEnabled} onCheckedChange={setCoEnabled} />
              </div>
            </div>

            <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity', !coEnabled && 'opacity-40 pointer-events-none')}>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Earliest Check-Out
                </Label>
                <Input type="time" value={coEarliest} onChange={e => setCoEarliest(e.target.value)} className="h-9 font-mono" />
                <p className="text-[10px] text-muted-foreground">Check-out is blocked before this time</p>
              </div>
              <div className="flex items-end pb-1">
                {coEnabled && (
                  <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2 w-full">
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    Employees cannot check out before <strong>{coEarliest}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              These rules apply when employees mark attendance using the 6-digit code.
              Disabling a window removes enforcement — employees can check in/out at any time.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleSaveTimeRules} disabled={timeSaving} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white">
            {timeSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Time Rules</>}
          </Button>
        </CardFooter>
      </Card>

      {/* ─── CARD 3: LEAVE QUOTAS ─── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-500/5 to-transparent border-b pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 shrink-0">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">Leave Quotas</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Set how many leave days each employee is entitled to per year
              </CardDescription>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs font-medium',
            quotaConfigured
              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          )}>
            {quotaConfigured
              ? <><CheckCircle className="h-3.5 w-3.5 shrink-0" /> Custom quotas saved — Annual {annualDays} · Sick {sickDays} · Casual {casualDays} days</>
              : <><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Using system defaults — Annual 14 · Sick 10 · Casual 7 days</>}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">

          {/* Quota inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { key: 'annual',  label: 'Annual Leave', val: annualDays,  set: setAnnualDays,  color: 'text-blue-600',   bg: 'bg-blue-500/10',   icon: <CalendarDays className="h-4 w-4" /> },
              { key: 'sick',    label: 'Sick Leave',   val: sickDays,    set: setSickDays,    color: 'text-red-600',    bg: 'bg-red-500/10',    icon: <Heart className="h-4 w-4" /> },
              { key: 'casual',  label: 'Casual Leave', val: casualDays,  set: setCasualDays,  color: 'text-amber-600',  bg: 'bg-amber-500/10',  icon: <Coffee className="h-4 w-4" /> },
            ] as const).map(({ key, label, val, set, color, bg, icon }) => (
              <div key={key} className="space-y-2">
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl', bg)}>
                  <span className={color}>{icon}</span>
                  <span className={cn('text-xs font-semibold', color)}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
                    onClick={() => set(Math.max(0, val - 1))} disabled={val <= 0}>
                    −
                  </Button>
                  <Input
                    type="number" min={0} max={365} value={val}
                    onChange={e => set(Math.max(0, Math.min(365, Number(e.target.value))))}
                    className="h-9 text-center font-bold text-lg w-full"
                  />
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
                    onClick={() => set(Math.min(365, val + 1))}>
                    +
                  </Button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">{val} days / year</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/20">
              <Switch checked={applyToAll} onCheckedChange={setApplyToAll} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Apply to all existing employees</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Updates <strong>every employee's</strong> current leave balance to these values.
                  Disable to only set defaults for <em>new</em> employees.
                </p>
              </div>
            </div>
            {applyToAll && (
              <Alert className="border-amber-300 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                  This will overwrite the leave balance for <strong>all active employees</strong>.
                  Any custom individual adjustments will be reset.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button
            onClick={async () => {
              setQuotaSaving(true);
              try {
                const res = await fetch('/api/portal/attendance/actions', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'save_leave_quota_settings',
                    annualDays, sickDays, casualDays, applyToAll,
                  }),
                });
                const d = await res.json();
                if (d?.data?.success) {
                  setQuotaConfigured(true);
                  setApplyToAll(false);
                  toast.success(d.data.message || 'Leave quotas saved');
                  await fetchSettings();
                } else {
                  toast.error(d?.data?.error || d?.error || 'Failed to save');
                }
              } catch (err: any) { toast.error(err.message); }
              finally { setQuotaSaving(false); }
            }}
            disabled={quotaSaving}
            className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {quotaSaving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <><Save className="h-4 w-4 mr-2" />Save Quotas</>}
          </Button>
        </CardFooter>
      </Card>
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
  initialAttendanceHistory,
  initialMyLeaveRequests,
  initialMyLeaveBalance,
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
  const [pendingManualCount, setPendingManualCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch pending manual attendance count for badge
  useEffect(() => {
    if (!isAdminOrManager) return;
    attendanceApi('get_pending_manual_attendances', {})
      .then((d: any) => { if (d?.success) setPendingManualCount((d.requests || []).length); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Performance optimization for mobile
  const shouldReduceMotion = useReducedMotion();
  const { shouldReduce: lowEndDevice } = usePerformanceMode();
  const disableAnimations = shouldReduceMotion || lowEndDevice;
  const tabsListRef = useRef<HTMLDivElement>(null);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
          <StatsCard
            title="Present"
            value={stats.present}
            change={`${stats.attendanceRate || 0}%`}
            changeType="positive"
            icon={<UserCheck className="h-4 w-4 md:h-5 md:w-5 text-green-500" />}
          />
          <StatsCard
            title="Absent"
            value={stats.absent}
            icon={<UserX className="h-4 w-4 md:h-5 md:w-5 text-red-500" />}
          />
          <StatsCard
            title="Late"
            value={stats.late}
            icon={<Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />}
          />
          <StatsCard
            title="On Leave"
            value={stats.onLeave}
            icon={<Calendar className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
          />
          <StatsCard
            title="Pending"
            value={pendingLeaveCount}
            icon={<ClipboardCheck className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />}
          />
        </div>
      )}

      <Tabs defaultValue={getDefaultTab()} className="space-y-4 md:space-y-6">
        {/* Mobile-optimized horizontal scrolling tabs */}
        <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
          <div 
            ref={tabsListRef}
            className="overflow-x-auto scrollbar-hide pb-2 md:pb-0 -mb-2 md:mb-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <TabsList className="inline-flex w-max md:w-auto md:flex-wrap gap-1 p-1 bg-muted/50 md:bg-muted rounded-xl">
              {/* Employee tabs */}
              {!isAdmin && (
                <>
                  <TabsTrigger 
                    value="mark" 
                    className="min-w-max px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <QrCode className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Mark</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="my-leaves" 
                    className="min-w-max px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <CalendarDays className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">My Leaves</span>
                  </TabsTrigger>
                </>
              )}
              
              {/* Admin/Manager tabs */}
              {isAdminOrManager && (
                <>
                  <TabsTrigger 
                    value="overview" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <Users className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Today</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="generate" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <QrCode className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Code</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="summary" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <BarChart3 className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Summary</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <Calendar className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">History</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="leaves" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all relative"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Leaves</span>
                    {pendingLeaveCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full"
                      >
                        {pendingLeaveCount > 9 ? '9+' : pendingLeaveCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="grid" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <LayoutGrid className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Grid</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="approvals" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all relative"
                  >
                    <ClipboardList className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Approvals</span>
                    {pendingManualCount > 0 && (
                      <Badge 
                        className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white border-0"
                      >
                        {pendingManualCount > 9 ? '9+' : pendingManualCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="att-settings" 
                    className="min-w-max px-3 md:px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Settings</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
          {/* Fade gradient for scroll indication on mobile */}
          <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
        </div>

        {/* Employee Tabs Content */}
        {!isAdmin && (
          <>
            <TabsContent value="mark">
              <div className="space-y-8">
                {/* Check-in card */}
                <MarkAttendance initialAttendance={null} />

                {/* Full attendance sheet */}
                <div className="border-t pt-6">
                  <MyAttendanceSheet />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="my-leaves">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <LeaveRequestForm
                    initialBalance={initialMyLeaveBalance ?? null}
                    onSuccess={() => setRefreshKey(k => k + 1)}
                  />
                </div>
                <MyLeaveRequests key={refreshKey} onRefresh={() => {}} />
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

            <TabsContent value="grid">
              <EmployeeAttendanceGrid />
            </TabsContent>

            <TabsContent value="approvals">
              <PendingManualApprovals onCountChange={setPendingManualCount} />
            </TabsContent>

            <TabsContent value="att-settings">
              <AttendanceSettingsPanel />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
