// =============================================
// ZOIRO BROAST HUB - BACKUP TABLES LIST API
// Returns all public tables with row counts & FK info
// Admin / Manager access only
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';

// ── Friendly name & category map for every Zoiro table ──────────────────────
// Maps technical DB table name → { label, category, description }
const TABLE_META: Record<string, { label: string; category: string; description: string }> = {
  // Customers
  customers:               { label: 'Customer Records',          category: 'Customers & Loyalty', description: 'All registered customer profiles & contact info' },
  loyalty_points:          { label: 'Loyalty Points',            category: 'Customers & Loyalty', description: 'Points balance per customer' },
  loyalty_transactions:    { label: 'Loyalty Transactions',      category: 'Customers & Loyalty', description: 'History of points earned & redeemed' },
  reviews:                 { label: 'Customer Reviews',          category: 'Customers & Loyalty', description: 'Ratings and feedback left by customers' },
  review_helpful_votes:    { label: 'Review Votes',              category: 'Customers & Loyalty', description: 'Helpful/unhelpful votes on reviews' },
  customer_promo_codes:    { label: 'Customer Promo Codes',      category: 'Customers & Loyalty', description: 'Promo codes assigned to specific customers' },
  customer_invoice_records:{ label: 'Customer Invoice History',  category: 'Customers & Loyalty', description: 'Invoice records linked to customers' },
  perks_settings:          { label: 'Perks & Loyalty Settings',  category: 'Customers & Loyalty', description: 'Configuration for the loyalty/perks system' },

  // Orders & Billing
  orders:                  { label: 'Order Records',             category: 'Orders & Billing', description: 'All customer orders (dine-in, online, walk-in)' },
  order_status_history:    { label: 'Order Status History',      category: 'Orders & Billing', description: 'Timeline of status changes per order' },
  order_cancellations:     { label: 'Cancelled Orders',          category: 'Orders & Billing', description: 'Orders that were cancelled with reasons' },
  order_activity_log:      { label: 'Order Activity Log',        category: 'Orders & Billing', description: 'Detailed action log for every order event' },
  invoices:                { label: 'Invoices',                  category: 'Orders & Billing', description: 'Generated invoices for orders' },
  payment_records:         { label: 'Payment Records',           category: 'Orders & Billing', description: 'All payment transactions made' },
  payment_methods:         { label: 'Payment Methods',           category: 'Orders & Billing', description: 'Saved payment methods (card, wallet, etc.)' },
  waiter_tips:             { label: 'Waiter Tips',               category: 'Orders & Billing', description: 'Tips received by waiters per order' },

  // Menu & Deals
  menu_categories:         { label: 'Menu Categories',           category: 'Menu & Deals', description: 'Categories like Burgers, Drinks, Sides, etc.' },
  menu_items:              { label: 'Menu Items',                category: 'Menu & Deals', description: 'Individual dishes/drinks listed on the menu' },
  meals:                   { label: 'Meal Combos',               category: 'Menu & Deals', description: 'Combo meal configurations' },
  deals:                   { label: 'Active Deals',              category: 'Menu & Deals', description: 'Discount deals currently running' },
  deal_items:              { label: 'Deal Item Linkage',         category: 'Menu & Deals', description: 'Which menu items belong to which deal' },
  promo_codes:             { label: 'Promo Codes',               category: 'Menu & Deals', description: 'All discount promo codes' },
  promo_code_usage:        { label: 'Promo Code Usage',          category: 'Menu & Deals', description: 'Record of when & by whom promo codes were used' },

  // Restaurant Operations
  restaurant_tables:       { label: 'Restaurant Tables',         category: 'Restaurant Operations', description: 'Physical table layout and status' },
  table_history:           { label: 'Table History',             category: 'Restaurant Operations', description: 'Past sessions and usage per table' },
  table_exchange_requests: { label: 'Table Swap Requests',       category: 'Restaurant Operations', description: 'Requests to move customers between tables' },
  delivery_history:        { label: 'Delivery History',          category: 'Restaurant Operations', description: 'Record of all delivery trips made' },
  waiter_order_history:    { label: 'Waiter Order History',      category: 'Restaurant Operations', description: 'Orders handled by each waiter' },

  // Staff & HR
  employees:               { label: 'Employee Records',          category: 'Staff & HR', description: 'All staff profiles, roles & portal access' },
  attendance:              { label: 'Staff Attendance',          category: 'Staff & HR', description: 'Daily check-in/check-out records' },
  attendance_codes:        { label: 'Attendance QR Codes',       category: 'Staff & HR', description: 'QR/pin codes used for attendance marking' },
  leave_requests:          { label: 'Leave Requests',            category: 'Staff & HR', description: 'Staff leave applications and approvals' },
  leave_balances:          { label: 'Leave Balances',            category: 'Staff & HR', description: 'Remaining leave days per employee' },
  employee_documents:      { label: 'Employee Documents',        category: 'Staff & HR', description: 'Uploaded contracts, IDs & certificates' },
  employee_payroll:        { label: 'Employee Payroll',          category: 'Staff & HR', description: 'Salary and payroll configuration per employee' },
  payslips:                { label: 'Payslips',                  category: 'Staff & HR', description: 'Generated monthly payslips' },
  employee_licenses:       { label: 'Employee Licenses',         category: 'Staff & HR', description: 'Driving licenses and professional certs' },

  // Inventory
  inventory:               { label: 'Inventory Stock',           category: 'Inventory', description: 'Current stock levels of all ingredients & supplies' },
  inventory_transactions:  { label: 'Stock Movements',          category: 'Inventory', description: 'History of stock additions & removals' },
  inventory_suppliers:     { label: 'Suppliers',                 category: 'Inventory', description: 'Supplier contact & pricing details' },
  inventory_categories:    { label: 'Inventory Categories',      category: 'Inventory', description: 'Groupings like Vegetables, Dairy, Packaging, etc.' },
  inventory_purchase_orders:{ label: 'Purchase Orders',          category: 'Inventory', description: 'Orders placed with suppliers' },
  inventory_alerts:        { label: 'Low Stock Alerts',          category: 'Inventory', description: 'Triggered alerts when stock falls below threshold' },

  // Website & Content
  site_content:            { label: 'Site Content',              category: 'Website & Content', description: 'Editable content blocks for the website' },
  website_content:         { label: 'Website Pages Content',     category: 'Website & Content', description: 'Page-level content for the public website' },

  // System & Security
  otp_codes:               { label: 'Verification Codes (OTP)',  category: 'System & Security', description: 'One-time password codes for login & verification' },
  two_fa_setup:            { label: 'Two-Factor Auth Setup',     category: 'System & Security', description: '2FA configurations per user' },
  password_reset_otps:     { label: 'Password Reset Codes',      category: 'System & Security', description: 'Codes sent for password reset requests' },
  password_reset_rate_limits:{ label: 'Password Reset Limits',   category: 'System & Security', description: 'Rate limiting records for reset attempts' },
  push_tokens:             { label: 'Push Notification Tokens',  category: 'System & Security', description: 'Device tokens for sending push notifications' },
  audit_logs:              { label: 'Audit Logs',                category: 'System & Security', description: 'Full record of who did what in the portal' },
  notifications:           { label: 'Notifications',             category: 'System & Security', description: 'In-app notifications sent to staff & customers' },
  contact_messages:        { label: 'Contact Messages',          category: 'System & Security', description: 'Messages submitted via the contact form' },
  maintenance_mode:        { label: 'Maintenance Mode Settings', category: 'System & Security', description: 'Controls whether the site is in maintenance mode' },
  reports_archive:         { label: 'Reports Archive',           category: 'System & Security', description: 'Saved/exported report snapshots' },
};

function getMeta(tableName: string): { label: string; category: string; description: string } {
  return TABLE_META[tableName] ?? {
    label: tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    category: 'Other',
    description: '',
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authClient = createAuthenticatedClient(token);

    // Verify role
    let employeeRole: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const { data } = await authClient.rpc('get_employee_by_auth_user', {
          p_auth_user_id: payload.sub,
        });
        const emp = (data as { data?: { role?: string } })?.data;
        employeeRole = emp?.role ?? null;
      }
    } catch { /* ignore */ }

    if (!employeeRole || !['admin', 'manager'].includes(employeeRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dataClient = authClient;

    // Query tables from the correct Supabase project using the list_backup_tables() RPC.
    // If the RPC hasn't been applied yet, return rpc_missing so the UI shows setup instructions.
    let tables: Array<{ name: string; row_count: number; category: string }> = [];
    let rpcMissing = false;

    const { data: rpcData, error: rpcError } = await dataClient.rpc('list_backup_tables') as {
      data: Array<{ table_name: string; row_count: number }> | null;
      error: { message?: string; code?: string } | null;
    };

    if (rpcData) {
      tables = rpcData.map(t => {
        const meta = getMeta(t.table_name);
        return {
          name: t.table_name,
          label: meta.label,
          description: meta.description,
          row_count: t.row_count,
          category: meta.category,
        };
      });
    } else {
      // RPC not found — signal the UI to show setup instructions
      const errMsg = (rpcError as { message?: string } | null)?.message ?? '';
      if (
        errMsg.includes('function') ||
        errMsg.includes('does not exist') ||
        errMsg.includes('Could not find') ||
        (rpcError as { code?: string } | null)?.code === '42883'
      ) {
        rpcMissing = true;
      } else {
        console.error('[backup/tables] RPC error:', rpcError);
        return NextResponse.json(
          { error: `Database error: ${errMsg}` },
          { status: 500 },
        );
      }
    }

    if (rpcMissing) {
      return NextResponse.json(
        {
          rpc_missing: true,
          error:
            'The list_backup_tables() function is not yet applied to your Supabase project. ' +
            'Go to your Supabase dashboard → SQL Editor and run the contents of ' +
            'supabase/backup-helper-rpcs.sql on project eqfeeiryzslccyivkphf.',
        },
        { status: 503 },
      );
    }

    // Group by category
    const grouped: Record<string, typeof tables> = {};
    for (const t of tables) {
      (grouped[t.category] ||= []).push(t);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({
      tables,
      grouped,
      total: tables.length,
    });
  } catch (e) {
    console.error('[backup/tables] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
