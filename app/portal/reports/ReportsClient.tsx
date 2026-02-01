'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Printer,
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
import type {
  SalesAnalyticsServer,
  CategorySalesServer,
  EmployeePerformanceServer,
  InventoryReportServer,
} from '@/lib/server-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Props for SSR data
interface ReportsClientProps {
  initialSalesData?: SalesAnalyticsServer[];
  initialCategoryData?: CategorySalesServer[];
  initialEmployeeData?: EmployeePerformanceServer[];
  initialInventoryData?: InventoryReportServer | null;
}

// ============================================
// EXPORT UTILITIES
// ============================================

interface ExportData {
  salesData: any;
  categoryData: CategorySales[];
  employeeData: EmployeePerformance[];
  inventoryData: InventoryReportServer | null;
  dateRange: string;
}

// Generate Excel/CSV export
function exportToExcel(data: ExportData) {
  const { salesData, categoryData, employeeData, inventoryData, dateRange } = data;
  const dateRangeLabel = getDateRangeLabel(dateRange);
  
  // Create workbook content with multiple sheets as CSV sections
  let csvContent = '';
  
  // Header with branding
  csvContent += 'ZOIRO BROAST - BUSINESS REPORT\n';
  csvContent += `Generated: ${new Date().toLocaleString()}\n`;
  csvContent += `Report Period: ${dateRangeLabel}\n`;
  csvContent += '\n';
  
  // Sales Summary
  csvContent += '=== SALES SUMMARY ===\n';
  csvContent += 'Metric,Value\n';
  csvContent += `Total Sales,Rs. ${(salesData?.totalSales || 0).toLocaleString()}\n`;
  csvContent += `Total Orders,${salesData?.totalOrders || 0}\n`;
  csvContent += `Average Order Value,Rs. ${(salesData?.avgOrderValue || 0).toLocaleString()}\n`;
  csvContent += '\n';
  
  // Daily Sales
  if (salesData?.dailyData?.length > 0) {
    csvContent += '=== DAILY SALES ===\n';
    csvContent += 'Day,Sales (Rs.)\n';
    salesData.dailyData.forEach((day: any) => {
      csvContent += `${day.label},${day.value}\n`;
    });
    csvContent += '\n';
  }
  
  // Category Performance
  if (categoryData.length > 0) {
    csvContent += '=== CATEGORY PERFORMANCE ===\n';
    csvContent += 'Category,Orders,Items Sold,Revenue (Rs.)\n';
    categoryData.forEach((cat) => {
      csvContent += `${cat.category},${cat.order_count},${cat.items_sold},${cat.total_sales}\n`;
    });
    csvContent += '\n';
  }
  
  // Employee Performance
  if (employeeData.length > 0) {
    csvContent += '=== EMPLOYEE PERFORMANCE ===\n';
    csvContent += 'Employee,Role,Orders Handled,Total Sales (Rs.),Attendance Rate\n';
    employeeData.forEach((emp) => {
      csvContent += `${emp.employee_name},${emp.role},${emp.orders_handled},${emp.total_sales},${emp.attendance_rate}%\n`;
    });
    csvContent += '\n';
  }
  
  // Inventory Summary
  if (inventoryData) {
    csvContent += '=== INVENTORY SUMMARY ===\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Total Items,${inventoryData.total_items}\n`;
    csvContent += `Low Stock Items,${inventoryData.low_stock_count}\n`;
    csvContent += `Out of Stock,${inventoryData.out_of_stock}\n`;
    csvContent += `Total Value,Rs. ${(inventoryData.total_value || 0).toLocaleString()}\n`;
    csvContent += '\n';
    
    if (inventoryData.low_stock_items?.length > 0) {
      csvContent += '=== LOW STOCK ITEMS ===\n';
      csvContent += 'Item Name,Current Qty,Min Qty,Unit\n';
      inventoryData.low_stock_items.forEach((item: any) => {
        csvContent += `${item.name},${item.quantity},${item.min_quantity},${item.unit}\n`;
      });
    }
  }
  
  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ZOIRO_Report_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Generate PDF using print
function exportToPDF(data: ExportData) {
  const { salesData, categoryData, employeeData, inventoryData, dateRange } = data;
  const dateRangeLabel = getDateRangeLabel(dateRange);
  const generatedDate = new Date().toLocaleString('en-US', { 
    dateStyle: 'full', 
    timeStyle: 'short' 
  });
  
  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Please allow popups for PDF export');
    return;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZOIRO Broast - Business Report</title>
      <style>
        @page {
          size: A4;
          margin: 15mm 12mm;
        }
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          color: #1f2937;
          line-height: 1.4;
          font-size: 11px;
          background: #fff;
        }
        
        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 20px;
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 50px;
          height: 50px;
          object-fit: contain;
          background: white;
          border-radius: 8px;
          padding: 4px;
        }
        .brand-name {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .brand-tagline {
          font-size: 10px;
          opacity: 0.9;
          margin-top: 2px;
        }
        .report-info {
          text-align: right;
          font-size: 10px;
        }
        .report-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .report-meta {
          opacity: 0.9;
          line-height: 1.5;
        }
        
        /* Stats Cards */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          border-left: 3px solid #dc2626;
        }
        .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #dc2626;
        }
        .stat-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        
        /* Sections */
        .section {
          margin-bottom: 18px;
          page-break-inside: avoid;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 2px solid #dc2626;
        }
        .section-icon {
          width: 20px;
          height: 20px;
          background: #dc2626;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
        }
        
        /* Charts */
        .chart-container {
          background: #f8fafc;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .chart-grid {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 120px;
          gap: 8px;
          padding: 10px 5px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .chart-bar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          max-width: 60px;
        }
        .chart-bar {
          width: 24px;
          background: linear-gradient(to top, #dc2626, #ef4444);
          border-radius: 3px 3px 0 0;
          min-height: 3px;
          transition: height 0.3s;
        }
        .chart-value {
          font-size: 8px;
          color: #374151;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .chart-label {
          font-size: 8px;
          color: #6b7280;
          margin-top: 6px;
          text-align: center;
        }
        
        /* Two Column Layout */
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        
        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          background: white;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        thead {
          background: #1f2937;
        }
        th {
          color: white;
          padding: 8px 10px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        tbody tr:nth-child(even) {
          background: #f8fafc;
        }
        tbody tr:hover {
          background: #fef2f2;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .font-semibold {
          font-weight: 600;
        }
        .text-red {
          color: #dc2626;
        }
        .text-green {
          color: #16a34a;
        }
        .text-amber {
          color: #d97706;
        }
        
        /* Badges */
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-danger {
          background: #fef2f2;
          color: #dc2626;
        }
        .badge-warning {
          background: #fffbeb;
          color: #d97706;
        }
        .badge-success {
          background: #f0fdf4;
          color: #16a34a;
        }
        
        /* Footer */
        .footer {
          margin-top: 25px;
          padding: 15px;
          background: #f8fafc;
          border-radius: 8px;
          text-align: center;
          font-size: 9px;
          color: #64748b;
          border-top: 3px solid #dc2626;
        }
        .footer-brand {
          font-weight: 700;
          color: #dc2626;
          font-size: 11px;
        }
        
        /* Print Button */
        .print-actions {
          position: fixed;
          top: 15px;
          right: 15px;
          display: flex;
          gap: 8px;
          z-index: 1000;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .btn-primary {
          background: #dc2626;
          color: white;
        }
        .btn-primary:hover {
          background: #b91c1c;
        }
        .btn-secondary {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        
        /* Print Styles */
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-actions { display: none !important; }
          .header { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .section { page-break-inside: avoid; }
          table { page-break-inside: avoid; }
        }
        
        /* Compact inventory stats */
        .inv-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 12px;
        }
        .inv-stat {
          text-align: center;
          padding: 10px;
          background: #f8fafc;
          border-radius: 6px;
        }
        .inv-stat-value {
          font-size: 16px;
          font-weight: 700;
        }
        .inv-stat-label {
          font-size: 8px;
          color: #64748b;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="print-actions">
        <button class="btn btn-primary" onclick="window.print()">
          <span>🖨️</span> Print / Save PDF
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
          <span>✕</span> Close
        </button>
      </div>
      
      <!-- Header -->
      <div class="header">
        <div class="logo-section">
          <img src="/assets/zoiro-logo.png" alt="ZOIRO" class="logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23dc2626%22 width=%2240%22 height=%2240%22 rx=%228%22/><text x=%2220%22 y=%2228%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2220%22 font-weight=%22bold%22>Z</text></svg>'"/>
          <div>
            <div class="brand-name">ZOIRO BROAST</div>
            <div class="brand-tagline">Injected Broast — Saucy. Juicy. Crispy.</div>
          </div>
        </div>
        <div class="report-info">
          <div class="report-title">📊 Business Analytics Report</div>
          <div class="report-meta">
            Period: <strong>${dateRangeLabel}</strong><br/>
            Generated: ${generatedDate}
          </div>
        </div>
      </div>
      
      <!-- Key Metrics -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">Rs. ${(salesData?.totalSales || 0).toLocaleString()}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${salesData?.totalOrders || 0}</div>
          <div class="stat-label">Orders Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">Rs. ${(salesData?.avgOrderValue || 0).toLocaleString()}</div>
          <div class="stat-label">Avg. Order Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${categoryData.length}</div>
          <div class="stat-label">Active Categories</div>
        </div>
      </div>
      
      <!-- Charts Section -->
      ${salesData?.dailyData?.length > 0 || categoryData.length > 0 ? `
      <div class="two-col">
        ${salesData?.dailyData?.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <div class="section-icon">📈</div>
            <div class="section-title">Sales Trend</div>
          </div>
          <div class="chart-container">
            <div class="chart-grid">
              ${salesData.dailyData.map((day: any) => {
                const maxVal = Math.max(...salesData.dailyData.map((d: any) => d.value));
                const height = maxVal > 0 ? Math.max((day.value / maxVal) * 100, 3) : 3;
                return `
                  <div class="chart-bar-wrapper">
                    <div class="chart-value">Rs.${day.value >= 1000 ? (day.value/1000).toFixed(1) + 'k' : day.value}</div>
                    <div class="chart-bar" style="height: ${height}px"></div>
                    <div class="chart-label">${day.label}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        ` : ''}
        
        ${categoryData.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <div class="section-icon">📦</div>
            <div class="section-title">Sales by Category</div>
          </div>
          <div class="chart-container">
            <div class="chart-grid">
              ${categoryData.slice(0, 8).map((cat) => {
                const maxVal = Math.max(...categoryData.map((c) => c.total_sales));
                const height = maxVal > 0 ? Math.max((cat.total_sales / maxVal) * 100, 3) : 3;
                return `
                  <div class="chart-bar-wrapper">
                    <div class="chart-value">Rs.${cat.total_sales >= 1000 ? (cat.total_sales/1000).toFixed(0) + 'k' : cat.total_sales}</div>
                    <div class="chart-bar" style="height: ${height}px"></div>
                    <div class="chart-label">${cat.category.length > 8 ? cat.category.substring(0, 7) + '…' : cat.category}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      <!-- Category Performance Table -->
      ${categoryData.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <div class="section-icon">🏷️</div>
          <div class="section-title">Category Performance Details</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px">#</th>
              <th>Category</th>
              <th class="text-center">Orders</th>
              <th class="text-center">Items Sold</th>
              <th class="text-right">Revenue</th>
              <th class="text-right">% Share</th>
            </tr>
          </thead>
          <tbody>
            ${categoryData.map((cat, i) => {
              const totalRev = categoryData.reduce((s, c) => s + c.total_sales, 0);
              const share = totalRev > 0 ? ((cat.total_sales / totalRev) * 100).toFixed(1) : '0';
              return `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="font-semibold">${cat.category}</td>
                <td class="text-center">${cat.order_count}</td>
                <td class="text-center">${cat.items_sold}</td>
                <td class="text-right font-semibold text-red">Rs. ${cat.total_sales.toLocaleString()}</td>
                <td class="text-right">${share}%</td>
              </tr>
            `}).join('')}
            <tr style="background: #fef2f2; font-weight: 600;">
              <td colspan="2">TOTAL</td>
              <td class="text-center">${categoryData.reduce((s, c) => s + c.order_count, 0)}</td>
              <td class="text-center">${categoryData.reduce((s, c) => s + c.items_sold, 0)}</td>
              <td class="text-right text-red">Rs. ${categoryData.reduce((s, c) => s + c.total_sales, 0).toLocaleString()}</td>
              <td class="text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <!-- Employee Performance -->
      ${employeeData.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <div class="section-icon">👥</div>
          <div class="section-title">Employee Performance</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px">#</th>
              <th>Employee Name</th>
              <th>Role</th>
              <th class="text-center">Orders</th>
              <th class="text-right">Sales Generated</th>
              <th class="text-center">Attendance</th>
            </tr>
          </thead>
          <tbody>
            ${employeeData.map((emp, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="font-semibold">${emp.employee_name}</td>
                <td><span class="badge badge-success">${emp.role}</span></td>
                <td class="text-center">${emp.orders_handled}</td>
                <td class="text-right font-semibold">Rs. ${emp.total_sales.toLocaleString()}</td>
                <td class="text-center">
                  <span class="badge ${emp.attendance_rate >= 90 ? 'badge-success' : emp.attendance_rate >= 70 ? 'badge-warning' : 'badge-danger'}">
                    ${emp.attendance_rate}%
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <!-- Inventory Overview -->
      ${inventoryData ? `
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📋</div>
          <div class="section-title">Inventory Overview</div>
        </div>
        
        <div class="inv-stats">
          <div class="inv-stat">
            <div class="inv-stat-value">${inventoryData.total_items}</div>
            <div class="inv-stat-label">Total Items</div>
          </div>
          <div class="inv-stat">
            <div class="inv-stat-value text-amber">${inventoryData.low_stock_count}</div>
            <div class="inv-stat-label">Low Stock</div>
          </div>
          <div class="inv-stat">
            <div class="inv-stat-value text-red">${inventoryData.out_of_stock}</div>
            <div class="inv-stat-label">Out of Stock</div>
          </div>
          <div class="inv-stat">
            <div class="inv-stat-value text-green">Rs. ${(inventoryData.total_value || 0).toLocaleString()}</div>
            <div class="inv-stat-label">Total Value</div>
          </div>
        </div>
        
        ${inventoryData.low_stock_items?.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th class="text-center">Current Stock</th>
              <th class="text-center">Min Required</th>
              <th class="text-center">Unit</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryData.low_stock_items.map((item: any) => `
              <tr>
                <td class="font-semibold">${item.name}</td>
                <td class="text-center ${item.quantity === 0 ? 'text-red font-semibold' : ''}">${item.quantity}</td>
                <td class="text-center">${item.min_quantity}</td>
                <td class="text-center">${item.unit}</td>
                <td class="text-center">
                  <span class="badge ${item.quantity === 0 ? 'badge-danger' : 'badge-warning'}">
                    ${item.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p style="text-align: center; color: #16a34a; padding: 15px;">✓ All inventory items are well stocked</p>'}
      </div>
      ` : ''}
      
      <!-- Footer -->
      <div class="footer">
        <div class="footer-brand">ZOIRO BROAST</div>
        <div style="margin: 6px 0;">Business Analytics Report — Confidential</div>
        <div>Generated automatically on ${generatedDate}</div>
        <div style="margin-top: 8px; font-size: 8px;">© ${new Date().getFullYear()} ZOIRO Broast. All Rights Reserved.</div>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

function getDateRangeLabel(range: string): string {
  const labels: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday', 
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
  };
  return labels[range] || range;
}

// Props for SSR data
interface ReportsClientProps {
  initialSalesData?: SalesAnalyticsServer[];
  initialCategoryData?: CategorySalesServer[];
  initialEmployeeData?: EmployeePerformanceServer[];
  initialInventoryData?: InventoryReportServer | null;
}

// Chart placeholder component
function BarChartPlaceholder({ data, title }: { data: { label: string; value: number }[]; title: string }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-around gap-3 h-48 px-2">
          {data.map((item, index) => {
            const heightPercent = (item.value / maxValue) * 100;
            const barHeight = Math.max((heightPercent / 100) * 160, 4); // 160px max height, min 4px
            return (
              <div key={index} className="flex flex-col items-center justify-end gap-1 h-full" style={{ minWidth: '32px', maxWidth: '48px' }}>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {item.value >= 1000 ? `${(item.value/1000).toFixed(0)}k` : item.value}
                </span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="w-6 bg-gradient-to-t from-primary to-primary/70 rounded-t-sm"
                  style={{ minHeight: '4px' }}
                />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Sales Report Component
function SalesReport({ 
  dateRange, 
  initialSalesData, 
  initialCategoryData,
  onDataChange,
}: { 
  dateRange: string;
  initialSalesData?: SalesAnalyticsServer[];
  initialCategoryData?: CategorySalesServer[];
  onDataChange?: (sales: any, categories: CategorySales[]) => void;
}) {
  const [salesData, setSalesData] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<CategorySales[]>((initialCategoryData || []) as CategorySales[]);
  const [isLoading, setIsLoading] = useState(false);
  
  // FIX #3: Track which date ranges we've already fetched - initialize with 'month' if we have SSR data
  const hasSSRData = !!(initialSalesData && initialSalesData.length > 0);
  const fetchedRangesRef = useRef<string>(hasSSRData ? 'month' : '');
  const initializedRef = useRef(false);

  // Initialize from SSR data - only run once
  useEffect(() => {
    if (initializedRef.current) return;
    if (initialSalesData && initialSalesData.length > 0 && dateRange === 'month') {
      initializedRef.current = true;
      const totalSales = initialSalesData.reduce((sum, day) => sum + (day.total_sales || 0), 0);
      const totalOrders = initialSalesData.reduce((sum, day) => sum + (day.order_count || 0), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

      const newSalesData = {
        totalSales,
        totalOrders,
        avgOrderValue,
        growth: 0,
        dailyData: initialSalesData.map((day) => ({
          label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
          value: day.total_sales || 0,
        })),
      };
      setSalesData(newSalesData);
      onDataChange?.(newSalesData, (initialCategoryData || []) as CategorySales[]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Skip fetch if we already have SSR data for this range
    if (fetchedRangesRef.current === dateRange) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        
        const [sales, categories] = await Promise.all([
          getSalesAnalytics(startDate, endDate, 'day'),
          getCategorySalesReport(startDate, endDate),
        ]);

        const totalSales = sales?.reduce((sum, day) => sum + (day.total_sales || 0), 0) || 0;
        const totalOrders = sales?.reduce((sum, day) => sum + (day.order_count || 0), 0) || 0;
        const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

        const newSalesData = {
          totalSales,
          totalOrders,
          avgOrderValue,
          growth: 0,
          dailyData: (sales || []).map((day) => ({
            label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
            value: day.total_sales || 0,
          })),
        };
        
        setSalesData(newSalesData);
        setCategoryData(categories || []);
        onDataChange?.(newSalesData, categories || []);
        fetchedRangesRef.current = dateRange;
      } catch (error) {
        toast.error('Failed to load sales data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, getDateRange]);

  if (isLoading && !salesData) {
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
          <DataTableWrapper isLoading={isLoading} isEmpty={categoryData.length === 0} emptyMessage="No category data available">
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
function EmployeeReport({ 
  dateRange, 
  initialData,
  onDataChange,
}: { 
  dateRange: string;
  initialData?: EmployeePerformanceServer[];
  onDataChange?: (data: EmployeePerformance[]) => void;
}) {
  const [employees, setEmployees] = useState<EmployeePerformance[]>((initialData || []) as EmployeePerformance[]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRangesRef = useRef<string>(dateRange === 'month' ? 'month' : '');

  // Notify parent of initial data (run once)
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      onDataChange?.((initialData || []) as EmployeePerformance[]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (fetchedRangesRef.current === dateRange) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        const data = await getEmployeePerformanceReport(startDate, endDate);
        setEmployees(data || []);
        onDataChange?.(data || []);
        fetchedRangesRef.current = dateRange;
      } catch (error) {
        toast.error('Failed to load employee data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
function InventoryReportView({ 
  initialData,
  onDataChange,
}: { 
  initialData?: InventoryReportServer | null;
  onDataChange?: (data: InventoryReportServer | null) => void;
}) {
  const [report, setReport] = useState<InventoryReportType | null>(initialData as InventoryReportType | null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const hasFetchedRef = useRef(!!initialData);

  // Notify parent of initial data (run once)
  useEffect(() => {
    if (initialData) {
      onDataChange?.(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getInventoryReport();
        setReport(data);
        onDataChange?.(data as InventoryReportServer | null);
        hasFetchedRef.current = true;
      } catch (error) {
        toast.error('Failed to load inventory data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

// Main Reports Client
export default function ReportsClient({
  initialSalesData,
  initialCategoryData,
  initialEmployeeData,
  initialInventoryData,
}: ReportsClientProps) {
  const [dateRange, setDateRange] = useState('month');
  
  // Track current data for export - initialize from SSR data
  const [currentSalesData, setCurrentSalesData] = useState<any>(() => {
    if (initialSalesData && initialSalesData.length > 0) {
      const totalSales = initialSalesData.reduce((sum, day) => sum + (day.total_sales || 0), 0);
      const totalOrders = initialSalesData.reduce((sum, day) => sum + (day.order_count || 0), 0);
      return {
        totalSales,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
        dailyData: initialSalesData.map((day) => ({
          label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
          value: day.total_sales || 0,
        })),
      };
    }
    return null;
  });
  const [currentCategoryData, setCurrentCategoryData] = useState<CategorySales[]>((initialCategoryData || []) as CategorySales[]);
  const [currentEmployeeData, setCurrentEmployeeData] = useState<EmployeePerformance[]>((initialEmployeeData || []) as EmployeePerformance[]);
  const [currentInventoryData, setCurrentInventoryData] = useState<InventoryReportServer | null>(initialInventoryData || null);

  // Memoize callbacks to prevent infinite loops
  const handleSalesDataChange = useCallback((sales: any, categories: CategorySales[]) => {
    setCurrentSalesData(sales);
    setCurrentCategoryData(categories);
  }, []);

  const handleEmployeeDataChange = useCallback((data: EmployeePerformance[]) => {
    setCurrentEmployeeData(data);
  }, []);

  const handleInventoryDataChange = useCallback((data: InventoryReportServer | null) => {
    setCurrentInventoryData(data);
  }, []);

  const handleExport = (format: 'pdf' | 'excel') => {
    const exportData: ExportData = {
      salesData: currentSalesData,
      categoryData: currentCategoryData,
      employeeData: currentEmployeeData,
      inventoryData: currentInventoryData,
      dateRange,
    };
    
    if (format === 'excel') {
      exportToExcel(exportData);
      toast.success('Excel report downloaded!');
    } else {
      exportToPDF(exportData);
      toast.success('PDF report opened in new tab - click Print to save');
    }
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

        <TabsContent value="sales" forceMount className="data-[state=inactive]:hidden">
          <SalesReport 
            dateRange={dateRange} 
            initialSalesData={initialSalesData}
            initialCategoryData={initialCategoryData}
            onDataChange={handleSalesDataChange}
          />
        </TabsContent>

        <TabsContent value="employees" forceMount className="data-[state=inactive]:hidden">
          <EmployeeReport 
            dateRange={dateRange} 
            initialData={initialEmployeeData}
            onDataChange={handleEmployeeDataChange}
          />
        </TabsContent>

        <TabsContent value="inventory" forceMount className="data-[state=inactive]:hidden">
          <InventoryReportView 
            initialData={initialInventoryData}
            onDataChange={handleInventoryDataChange}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
