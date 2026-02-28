-- =============================================================
-- ZOIRO BROAST HUB — backup_read_table RPC
-- SECURITY DEFINER: bypasses RLS so admin/manager can back up
-- every table regardless of individual RLS policies.
-- The function verifies the caller is admin or manager itself.
-- =============================================================

CREATE OR REPLACE FUNCTION backup_read_table(
  p_table_name text,
  p_limit      int DEFAULT 1000,
  p_offset     int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_result jsonb;
BEGIN
  -- 1. Verify the caller is an active admin or manager
  SELECT role INTO v_role
  FROM employees
  WHERE auth_user_id = auth.uid()
    AND status = 'active';

  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'permission denied: admin or manager access required';
  END IF;

  -- 2. Allowlist every known Zoiro table (prevents SQL injection)
  IF p_table_name NOT IN (
    'customers','employees','menu_categories','menu_items','meals','deals',
    'orders','order_status_history','reviews','site_content','otp_codes',
    'audit_logs','notifications','loyalty_points','promo_code_usage',
    'payment_records','payslips','inventory','inventory_transactions',
    'attendance','employee_documents','employee_payroll','attendance_codes',
    'restaurant_tables','table_history','table_exchange_requests','invoices',
    'loyalty_transactions','promo_codes','website_content','push_tokens',
    'reports_archive','waiter_tips','order_cancellations','two_fa_setup',
    'employee_licenses','deal_items','delivery_history','waiter_order_history',
    'customer_invoice_records','perks_settings','customer_promo_codes',
    'review_helpful_votes','password_reset_otps','password_reset_rate_limits',
    'payment_methods','inventory_suppliers','inventory_categories',
    'inventory_purchase_orders','inventory_alerts','order_activity_log',
    'leave_requests','leave_balances','maintenance_mode','contact_messages'
  ) THEN
    RAISE EXCEPTION 'table not permitted for backup: %', p_table_name;
  END IF;

  -- 3. Read the page of rows (bypasses RLS via SECURITY DEFINER)
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb)
     FROM (SELECT * FROM %I LIMIT %s OFFSET %s) t',
    p_table_name, p_limit, p_offset
  )
  INTO v_result;

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION backup_read_table(text, int, int) TO authenticated;
