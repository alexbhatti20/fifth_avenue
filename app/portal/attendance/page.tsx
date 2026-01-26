'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth, useCountdown } from '@/hooks/usePortal';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Employee, AttendanceStatus } from '@/types/portal';

const supabase = createClient();

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  present: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Present', icon: <CheckCircle className="h-4 w-4" /> },
  absent: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Absent', icon: <XCircle className="h-4 w-4" /> },
  late: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Late', icon: <AlertTriangle className="h-4 w-4" /> },
  half_day: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Half Day', icon: <Clock className="h-4 w-4" /> },
  on_leave: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'On Leave', icon: <Calendar className="h-4 w-4" /> },
};

// Mark Attendance Component (for employees)
function MarkAttendance() {
  const { employee } = usePortalAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);

  useEffect(() => {
    const checkTodayAttendance = async () => {
      if (!employee) return;

      const { data, error } = await supabase.rpc('get_my_today_attendance');
      
      if (!error && data?.success) {
        setTodayAttendance(data.attendance);
      }
    };

    checkTodayAttendance();
  }, [employee]);

  const handleMarkAttendance = async () => {
    if (!code.trim() || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('mark_attendance_with_code', {
        p_code: code,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Attendance marked successfully!');
        setCode('');
        // Use the attendance data returned from the RPC
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
        <CardDescription>Enter the 6-digit code shown on the attendance device</CardDescription>
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
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
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

// Generate Code Component (for admin/manager)
function GenerateAttendanceCode() {
  const [code, setCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryTime, setExpiryTime] = useState<string | null>(null);
  const { timeLeft, isExpired, formatted } = useCountdown(expiryTime);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_attendance_code');

      if (error) throw error;
      
      setCode(data.code);
      // Set expiry time 5 minutes from now
      const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      setExpiryTime(expiry);
      toast.success('Attendance code generated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isExpired && code) {
      setCode(null);
      setExpiryTime(null);
    }
  }, [isExpired, code]);

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
        {code ? (
          <div className="text-center py-6">
            <div className="text-5xl font-mono font-bold tracking-widest mb-4">
              {code}
            </div>
            <Progress value={(timeLeft / 300) * 100} className="h-2 mb-2" />
            <p className="text-muted-foreground">
              Expires in {formatted}
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Click the button below to generate a new attendance code
            </p>
            <Button onClick={handleGenerateCode} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Code'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Today's Attendance Overview
function TodayAttendance() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const { data, error } = await supabase.rpc('get_today_attendance');

        if (error) throw error;
        
        if (data?.success) {
          setAttendance(data.attendance || []);
        }
      } catch (error) {
        
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
    const interval = setInterval(fetchAttendance, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Today's Attendance
        </CardTitle>
        <CardDescription>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTableWrapper isLoading={isLoading} isEmpty={attendance.length === 0} emptyMessage="No attendance records today">
          <div className="space-y-3">
            {attendance.map((record) => {
              const config = STATUS_CONFIG[record.status as AttendanceStatus];
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
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
                      <p>In: {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      {record.check_out && (
                        <p className="text-muted-foreground">
                          Out: {new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <Badge className={cn('gap-1', config?.bgColor, config?.color)}>
                      {config?.icon}
                      {config?.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </DataTableWrapper>
      </CardContent>
    </Card>
  );
}

// Attendance History
function AttendanceHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const [year, month] = selectedMonth.split('-').map(Number);

        const { data, error } = await supabase.rpc('get_attendance_history', {
          p_year: year,
          p_month: month
        });

        if (error) throw error;
        
        if (data?.success) {
          setHistory(data.attendance || []);
        }
      } catch (error) {
        
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [selectedMonth]);

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
                      <TableCell>{new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell>
                        {record.check_out 
                          ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </TableCell>
                      <TableCell>{hours} hrs</TableCell>
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

// Main Attendance Page
export default function AttendancePage() {
  const { role } = usePortalAuth();
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    total: 0,
    attendanceRate: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!isAdminOrManager) return;
      
      try {
        const { data, error } = await supabase.rpc('get_attendance_stats');
        
        if (error) throw error;
        
        if (data?.success && data.stats) {
          setStats({
            present: data.stats.present || 0,
            absent: data.stats.absent || 0,
            late: data.stats.late || 0,
            onLeave: data.stats.on_leave || 0,
            total: data.stats.total || 0,
            attendanceRate: data.stats.attendance_rate || 0,
          });
        }
      } catch (error) {
        
      }
    };

    fetchStats();
  }, [isAdminOrManager]);

  return (
    <>
      <SectionHeader
        title="Attendance Management"
        description="Track employee attendance and work hours"
      />

      {/* Stats - only for admin/manager */}
      {isAdminOrManager && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        </div>
      )}

      <Tabs defaultValue={isAdminOrManager ? 'overview' : 'mark'} className="space-y-6">
        <TabsList>
          {!isAdminOrManager && <TabsTrigger value="mark">Mark Attendance</TabsTrigger>}
          {isAdminOrManager && (
            <>
              <TabsTrigger value="overview">Today's Overview</TabsTrigger>
              <TabsTrigger value="generate">Generate Code</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </>
          )}
        </TabsList>

        {!isAdminOrManager && (
          <TabsContent value="mark">
            <MarkAttendance />
          </TabsContent>
        )}

        {isAdminOrManager && (
          <>
            <TabsContent value="overview">
              <TodayAttendance />
            </TabsContent>

            <TabsContent value="generate">
              <div className="max-w-md">
                <GenerateAttendanceCode />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <AttendanceHistory />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
