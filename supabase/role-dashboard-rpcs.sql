-- =============================================
-- ROLE-BASED DASHBOARD RPC FUNCTIONS
-- Created: February 1, 2026
-- Updated: February 1, 2026 - Added date filtering (today/month/year/custom)
-- Purpose: Provide stats for each employee role dashboard
-- =============================================

-- =============================================
-- DROP EXISTING FUNCTIONS FIRST
-- =============================================
DROP FUNCTION IF EXISTS get_waiter_dashboard_stats(UUID);
DROP FUNCTION IF EXISTS get_waiter_dashboard_stats(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_kitchen_orders();
DROP FUNCTION IF EXISTS get_rider_dashboard_stats(UUID);
DROP FUNCTION IF EXISTS get_rider_dashboard_stats(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_billing_dashboard_stats_enhanced();
DROP FUNCTION IF EXISTS get_billing_dashboard_stats_enhanced(DATE, DATE);
DROP FUNCTION IF EXISTS get_employee_dashboard_stats(UUID);
DROP FUNCTION IF EXISTS get_employee_dashboard_stats(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_admin_dashboard_stats(DATE, DATE);
DROP FUNCTION IF EXISTS get_manager_dashboard_stats();
DROP FUNCTION IF EXISTS get_hourly_sales_today();
DROP FUNCTION IF EXISTS get_hourly_sales(DATE, DATE);
DROP FUNCTION IF EXISTS get_tables_status();
DROP FUNCTION IF EXISTS get_billing_stats();
DROP FUNCTION IF EXISTS get_billing_stats(DATE, DATE);

-- =============================================
-- 0. ADMIN/MANAGER DASHBOARD STATS (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
        ),
        'total_sales_today', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
              AND status NOT IN ('cancelled')
        ),
        'total_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
        ),
        'total_orders_today', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
        ),
        'completed_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ),
        'cancelled_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'cancelled'
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE status IN ('pending', 'confirmed', 'preparing')
        ),
        'avg_order_value', (
            SELECT COALESCE(AVG(total), 0)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
        ),
        'active_tables', (
            SELECT COUNT(*)
            FROM restaurant_tables
            WHERE status = 'occupied'
        ),
        'total_tables', (
            SELECT COUNT(*)
            FROM restaurant_tables
        ),
        'active_employees', (
            SELECT COUNT(*)
            FROM employees
            WHERE status = 'active'
        ),
        'present_today', (
            SELECT COUNT(*)
            FROM attendance
            WHERE date = CURRENT_DATE
              AND check_in IS NOT NULL
        ),
        'low_inventory_count', (
            SELECT COUNT(*)
            FROM inventory
            WHERE quantity <= min_quantity
        ),
        'date_range', json_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 0.1 HOURLY SALES (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_hourly_sales(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_is_single_day BOOLEAN := (p_start_date = p_end_date);
BEGIN
    IF v_is_single_day THEN
        -- Single day: show hourly breakdown
        WITH hourly_data AS (
            SELECT 
                EXTRACT(HOUR FROM created_at)::int AS hour,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) = p_start_date
              AND status NOT IN ('cancelled')
            GROUP BY EXTRACT(HOUR FROM created_at)
        ),
        all_hours AS (
            SELECT generate_series(0, 23) AS hour
        ),
        combined AS (
            SELECT 
                ah.hour,
                COALESCE(hd.sales, 0) AS sales,
                COALESCE(hd.orders, 0) AS orders
            FROM all_hours ah
            LEFT JOIN hourly_data hd ON ah.hour = hd.hour
            ORDER BY ah.hour
        )
        SELECT json_build_object(
            'type', 'hourly',
            'data', (SELECT json_agg(json_build_object('hour', hour, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'peak_hour', (SELECT hour FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date - 1 AND status NOT IN ('cancelled')),
                'previous_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date - 1)
            )
        ) INTO result;
    ELSE
        -- Multiple days: show daily breakdown
        WITH daily_data AS (
            SELECT 
                DATE(created_at) AS date,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        ),
        all_days AS (
            SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date
        ),
        combined AS (
            SELECT 
                ad.date,
                COALESCE(dd.sales, 0) AS sales,
                COALESCE(dd.orders, 0) AS orders
            FROM all_days ad
            LEFT JOIN daily_data dd ON ad.date = dd.date
            ORDER BY ad.date
        )
        SELECT json_build_object(
            'type', 'daily',
            'data', (SELECT json_agg(json_build_object('date', date, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'best_day', (SELECT date FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_period_sales', (
                    SELECT COALESCE(SUM(total), 0) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                      AND status NOT IN ('cancelled')
                ),
                'previous_period_orders', (
                    SELECT COUNT(*) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                )
            )
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias for backward compatibility
CREATE OR REPLACE FUNCTION get_hourly_sales_today()
RETURNS JSON AS $$
BEGIN
    RETURN get_hourly_sales(CURRENT_DATE, CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 0.2 TABLES STATUS (For Admin Dashboard)
-- =============================================
CREATE OR REPLACE FUNCTION get_tables_status()
RETURNS SETOF JSON AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', t.id,
        'table_number', t.table_number,
        'capacity', t.capacity,
        'status', t.status,
        'current_order_id', t.current_order_id,
        'assigned_waiter_id', t.assigned_waiter_id,
        'assigned_waiter_name', e.name,
        'section', t.section
    )
    FROM restaurant_tables t
    LEFT JOIN employees e ON t.assigned_waiter_id = e.id
    ORDER BY t.table_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 0.3 BILLING STATS (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_billing_stats(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_bills', COALESCE((
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ), 0),
        'total_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ), 0),
        'cash_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method = 'cash'
              AND status = 'delivered'
        ), 0),
        'card_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method = 'card'
              AND status = 'delivered'
        ), 0),
        'online_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method IN ('online', 'upi', 'wallet')
              AND status = 'delivered'
        ), 0),
        'pending_bills', COALESCE((
            SELECT COUNT(*)
            FROM orders
            WHERE status = 'ready'
        ), 0),
        'date_range', json_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 1. WAITER DASHBOARD STATS (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_waiter_dashboard_stats(
    p_employee_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'orders_count', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'orders_today', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'tips_total', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND tip_amount IS NOT NULL
    ), 0),
    'tips_today', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
        AND tip_amount IS NOT NULL
    ), 0),
    'active_tables', COALESCE((
      SELECT COUNT(*)
      FROM restaurant_tables
      WHERE assigned_waiter_id = p_employee_id
        AND status = 'occupied'
    ), 0),
    'total_sales', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'avg_order_value', COALESCE((
      SELECT AVG(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================
-- 2. KITCHEN DASHBOARD STATS (Already exists, but ensure)
-- =============================================
CREATE OR REPLACE FUNCTION get_kitchen_orders()
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'order_type', o.order_type,
    'items', o.items,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'notes', o.notes,
    'priority', CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 30 THEN 'urgent'
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 15 THEN 'high'
      ELSE 'normal'
    END
  )
  FROM orders o
  WHERE o.status IN ('confirmed', 'preparing', 'ready')
    AND DATE(o.created_at) = CURRENT_DATE
  ORDER BY 
    CASE o.status 
      WHEN 'confirmed' THEN 1 
      WHEN 'preparing' THEN 2 
      WHEN 'ready' THEN 3 
    END,
    o.created_at ASC;
END;
$$;

-- =============================================
-- 3. DELIVERY RIDER DASHBOARD STATS (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_rider_dashboard_stats(
    p_rider_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'total_deliveries_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'pending_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND status IN ('assigned', 'picked_up')
    ), 0),
    'completed', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'completed_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'delivered'
    ), 0),
    'total_tips', COALESCE((
      SELECT SUM(tip_amount)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'avg_delivery_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - picked_up_at))/60)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND delivered_at IS NOT NULL
        AND picked_up_at IS NOT NULL
    ), 25),
    'total_earnings', COALESCE((
      SELECT SUM(delivery_fee + COALESCE(tip_amount, 0))
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'pending_orders', (
      SELECT json_agg(json_build_object(
        'id', dh.id,
        'order_id', dh.order_id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_address', o.customer_address,
        'total', o.total,
        'status', dh.status,
        'created_at', dh.created_at
      ))
      FROM delivery_history dh
      JOIN orders o ON o.id = dh.order_id
      WHERE dh.rider_id = p_rider_id
        AND dh.status IN ('assigned', 'picked_up')
      ORDER BY dh.created_at ASC
    ),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================
-- 4. BILLING STAFF DASHBOARD STATS ENHANCED (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_billing_dashboard_stats_enhanced(
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_bills', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'total_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'cash_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method = 'cash'
        AND status = 'delivered'
    ), 0),
    'card_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method = 'card'
        AND status = 'delivered'
    ), 0),
    'online_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method IN ('online', 'upi', 'wallet')
        AND status = 'delivered'
    ), 0),
    'pending_bills', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'ready'
    ), 0),
    'avg_bill_amount', COALESCE((
      SELECT AVG(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================
-- 5. GENERIC EMPLOYEE STATS (WITH DATE FILTER)
-- =============================================
CREATE OR REPLACE FUNCTION get_employee_dashboard_stats(
    p_employee_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_employee RECORD;
  v_start DATE := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Employee not found');
  END IF;
  
  SELECT json_build_object(
    'days_working', COALESCE(
      EXTRACT(DAY FROM (CURRENT_DATE - v_employee.hired_date::date)), 0
    ),
    'attendance_count', COALESCE((
      SELECT COUNT(*)
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= v_start
        AND DATE(check_in) <= v_end
    ), 0),
    'attendance_this_month', COALESCE((
      SELECT COUNT(*)
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= DATE_TRUNC('month', CURRENT_DATE)
        AND DATE(check_in) <= CURRENT_DATE
    ), 0),
    'total_days_in_range', (v_end - v_start + 1),
    'on_time_percentage', COALESCE((
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE is_late = false)::numeric / NULLIF(COUNT(*), 0)) * 100
      )
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= v_start
        AND DATE(check_in) <= v_end
    ), 100),
    'status', v_employee.status,
    'role', v_employee.role,
    'date_range', json_build_object(
        'start_date', v_start,
        'end_date', v_end
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_sales(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_sales_today() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_billing_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_waiter_dashboard_stats(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kitchen_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rider_dashboard_stats(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billing_dashboard_stats_enhanced(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_dashboard_stats(UUID, DATE, DATE) TO authenticated;
