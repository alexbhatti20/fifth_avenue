import { 
  getAttendanceStatsServer, 
  getTodayAttendanceServer,
  getAttendanceSummaryServer,
  getAbsentEmployeesTodayServer,
  getAllLeaveRequestsServer,
  getPendingLeaveCountServer,
  getAttendanceHistoryServer,
  getMyLeaveRequestsServer,
  getLeaveBalanceServer,
  getSSRCurrentEmployee,
} from '@/lib/server-queries';
import AttendanceClient from './AttendanceClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AttendancePage() {
  // Get current employee to determine role-based data fetching
  const currentEmployee = await getSSRCurrentEmployee();
  const isAdminOrManager = currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager';

  // Fetch all data server-side (hidden from browser Network tab, fast SSR)
  const [
    stats, 
    todayAttendance, 
    attendanceSummary,
    absentEmployees,
    leaveRequests,
    pendingLeaveCount,
    attendanceHistory,
    myLeaveRequests,
    myLeaveBalance,
  ] = await Promise.all([
    getAttendanceStatsServer(),
    getTodayAttendanceServer(),
    getAttendanceSummaryServer(),
    getAbsentEmployeesTodayServer(),
    // For admin/manager: fetch all pending leave requests. For others: fetch empty array
    isAdminOrManager ? getAllLeaveRequestsServer('pending') : Promise.resolve([]),
    isAdminOrManager ? getPendingLeaveCountServer() : Promise.resolve(0),
    getAttendanceHistoryServer(),
    // For all employees: fetch their own leave requests with status details
    getMyLeaveRequestsServer(),
    // For all employees: fetch their leave balance
    getLeaveBalanceServer(),
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
      initialMyLeaveRequests={myLeaveRequests}
      initialMyLeaveBalance={myLeaveBalance}
    />
  );
}

