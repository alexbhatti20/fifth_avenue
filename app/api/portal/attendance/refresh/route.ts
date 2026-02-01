import { NextRequest, NextResponse } from 'next/server';
import { 
  getAttendanceStatsServer, 
  getTodayAttendanceServer,
  getAbsentEmployeesTodayServer 
} from '@/lib/server-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const [stats, todayAttendance, absentEmployees] = await Promise.all([
      getAttendanceStatsServer(),
      getTodayAttendanceServer(),
      getAbsentEmployeesTodayServer()
    ]);

    return NextResponse.json({
      success: true,
      stats,
      todayAttendance,
      absentEmployees
    });
  } catch (error: any) {
    console.error('Attendance refresh error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
