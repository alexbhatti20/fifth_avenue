import { 
  getAttendanceStatsServer, 
  getTodayAttendanceServer,
  getAttendanceSummaryServer,
  getAbsentEmployeesTodayServer,
  getAllLeaveRequestsServer,
  getPendingLeaveCountServer,
  getAttendanceHistoryServer
} from '@/lib/server-queries';
import AttendanceClient from './AttendanceClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AttendancePage() {
  // Fetch all data server-side (hidden from browser Network tab, fast SSR)
  const [
    stats, 
    todayAttendance, 
    attendanceSummary,
    absentEmployees,
    leaveRequests,
    pendingLeaveCount,
    attendanceHistory
  ] = await Promise.all([
    getAttendanceStatsServer(),
    getTodayAttendanceServer(),
    getAttendanceSummaryServer(),
    getAbsentEmployeesTodayServer(),
    getAllLeaveRequestsServer('pending'),
    getPendingLeaveCountServer(),
    getAttendanceHistoryServer()
  ]);

  return (
    <AttendanceClient 
      initialStats={stats} 
      initialTodayAttendance={todayAttendance}
      initialAttendanceSummary={attendanceSummary}
      initialAbsentEmployees={absentEmployees}
      initialLeaveRequests={leaveRequests}
      initialPendingLeaveCount={pendingLeaveCount}
      initialAttendanceHistory={attendanceHistory}
    />
  );
}

