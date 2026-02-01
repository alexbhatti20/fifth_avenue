import { 
  getSalesAnalyticsServerCached,
  getCategorySalesReportServer,
  getEmployeePerformanceReportServer,
  getInventoryReportServer,
} from '@/lib/server-queries';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

// Helper to get last 30 days date range (includes recent historical data)
function getDateRange() {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30); // Last 30 days
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}

export default async function ReportsPage() {
  const { startDate, endDate } = getDateRange();

  // Fetch all initial data server-side in parallel (hidden from Network tab)
  const [salesData, categoryData, employeeData, inventoryData] = await Promise.all([
    getSalesAnalyticsServerCached(startDate, endDate, 'day'),
    getCategorySalesReportServer(startDate, endDate),
    getEmployeePerformanceReportServer(startDate, endDate),
    getInventoryReportServer(),
  ]);

  return (
    <ReportsClient
      initialSalesData={salesData}
      initialCategoryData={categoryData}
      initialEmployeeData={employeeData}
      initialInventoryData={inventoryData}
    />
  );
}
