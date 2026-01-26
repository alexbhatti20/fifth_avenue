'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  FileSpreadsheet,
  FileText,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { 
  getSalesAnalytics, 
  getCategorySalesReport, 
  getEmployeePerformanceReport,
  getInventoryReport,
  type CategorySales,
  type EmployeePerformance,
  type InventoryReport as InventoryReportType,
} from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Chart placeholder component
function BarChartPlaceholder({ data, title }: { data: { label: string; value: number }[]; title: string }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {data.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(item.value / maxValue) * 100}%` }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="w-full bg-primary rounded-t-sm min-h-[4px]"
              />
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Sales Report Component
function SalesReport({ dateRange }: { dateRange: string }) {
  const [salesData, setSalesData] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<CategorySales[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, [dateRange]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        
        const [sales, categories] = await Promise.all([
          getSalesAnalytics(startDate, endDate, 'day'),
          getCategorySalesReport(startDate, endDate),
        ]);

        // Calculate aggregated stats from daily sales
        const totalSales = sales?.reduce((sum, day) => sum + (day.total_sales || 0), 0) || 0;
        const totalOrders = sales?.reduce((sum, day) => sum + (day.order_count || 0), 0) || 0;
        const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

        setSalesData({
          totalSales,
          totalOrders,
          avgOrderValue,
          growth: 0, // Would need comparison data
          dailyData: (sales || []).map((day) => ({
            label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
            value: day.total_sales || 0,
          })),
        });

        setCategoryData(categories || []);
      } catch (error) {
        
        toast.error('Failed to load sales data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange, getDateRange]);

  if (isLoading) {
    return <div className="h-96 flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const categoryChartData = categoryData.map((cat) => ({
    label: cat.category,
    value: cat.total_sales,
  }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Sales"
          value={`Rs. ${(salesData?.totalSales || 0).toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Orders"
          value={salesData?.totalOrders || 0}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg. Order Value"
          value={`Rs. ${(salesData?.avgOrderValue || 0).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatsCard
          title="Categories"
          value={categoryData.length}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {salesData?.dailyData?.length > 0 && (
          <BarChartPlaceholder data={salesData.dailyData} title="Sales Trend" />
        )}
        {categoryChartData.length > 0 && (
          <BarChartPlaceholder data={categoryChartData} title="Sales by Category" />
        )}
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTableWrapper isLoading={false} isEmpty={categoryData.length === 0} emptyMessage="No category data available">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Items Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryData.map((cat, index) => (
                  <TableRow key={cat.category_id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{cat.category}</TableCell>
                    <TableCell className="text-right">{cat.order_count}</TableCell>
                    <TableCell className="text-right">{cat.items_sold}</TableCell>
                    <TableCell className="text-right">Rs. {cat.total_sales.toLocaleString()}</TableCell>
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

// Employee Report Component
function EmployeeReport({ dateRange }: { dateRange: string }) {
  const [employees, setEmployees] = useState<EmployeePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }, [dateRange]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        const data = await getEmployeePerformanceReport(startDate, endDate);
        setEmployees(data || []);
      } catch (error) {
        
        toast.error('Failed to load employee data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange, getDateRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Employee Performance</CardTitle>
        <CardDescription>Performance metrics for the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTableWrapper isLoading={isLoading} isEmpty={employees.length === 0} emptyMessage="No employee data available">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.employee_id}>
                  <TableCell className="font-medium">{emp.employee_name}</TableCell>
                  <TableCell className="capitalize">{emp.role.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right">{emp.orders_handled}</TableCell>
                  <TableCell className="text-right">Rs. {(emp.total_sales || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        emp.attendance_rate >= 95 ? 'bg-green-500/10 text-green-500' :
                        emp.attendance_rate >= 85 ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      )}
                    >
                      {emp.attendance_rate || 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableWrapper>
      </CardContent>
    </Card>
  );
}

// Inventory Report Component
function InventoryReportView() {
  const [report, setReport] = useState<InventoryReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getInventoryReport();
        setReport(data);
      } catch (error) {
        
        toast.error('Failed to load inventory data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Items"
          value={report?.total_items || 0}
          icon={<Package className="h-5 w-5" />}
        />
        <StatsCard
          title="Low Stock"
          value={report?.low_stock_count || 0}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
        />
        <StatsCard
          title="Out of Stock"
          value={report?.out_of_stock || 0}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
        />
        <StatsCard
          title="Total Value"
          value={`Rs. ${(report?.total_value || 0).toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      {/* Category Breakdown */}
      {report?.categories && report.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Low Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.categories.map((cat) => (
                  <TableRow key={cat.category}>
                    <TableCell className="font-medium capitalize">{cat.category}</TableCell>
                    <TableCell className="text-right">{cat.item_count}</TableCell>
                    <TableCell className="text-right">Rs. {(cat.total_value || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {cat.low_stock > 0 ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                          {cat.low_stock}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">0</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alerts */}
      {report?.low_stock_items && report.low_stock_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Low Stock Items
            </CardTitle>
            <CardDescription>Items that need restocking</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.low_stock_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right">{item.min_quantity} {item.unit}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          item.quantity === 0
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-yellow-500/10 text-yellow-500'
                        )}
                      >
                        {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main Reports Page
export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('month');

  const handleExport = (format: 'pdf' | 'excel') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  return (
    <>
      <SectionHeader
        title="Reports & Analytics"
        description="View detailed reports and business analytics"
        action={
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Sales
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" /> Employees
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" /> Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="employees">
          <EmployeeReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryReportView />
        </TabsContent>
      </Tabs>
    </>
  );
}
