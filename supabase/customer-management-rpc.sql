-- ============================================
-- CUSTOMER MANAGEMENT SYSTEM
-- Admin/Manager can view and manage customers
-- Includes ban/unban functionality
-- Run this in Supabase SQL Editor
-- ============================================

-- Add ban columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES employees(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unbanned_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unbanned_by UUID REFERENCES employees(id);

-- Index for faster banned customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_is_banned ON customers(is_banned);

-- ============================================
-- 1. GET ALL CUSTOMERS WITH STATS (Admin/Manager)
-- Returns comprehensive customer data with order stats
-- ============================================
DROP FUNCTION IF EXISTS get_all_customers_admin(INT, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_all_customers_admin(
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_search TEXT DEFAULT NULL,
    p_filter TEXT DEFAULT 'all' -- 'all', 'active', 'banned'
)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    is_verified BOOLEAN,
    is_banned BOOLEAN,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    total_orders BIGINT,
    total_spending DECIMAL,
    online_orders BIGINT,
    dine_in_orders BIGINT,
    takeaway_orders BIGINT,
    last_order_date TIMESTAMPTZ,
    loyalty_points INTEGER,
    total_invoices BIGINT,
    total_invoice_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        c.created_at,
        -- Order statistics
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        os.last_order_date,
        -- Loyalty points
        COALESCE(lp.points, 0)::INTEGER AS loyalty_points,
        -- Invoice stats
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount
    FROM customers c
    -- Order stats subquery
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_orders,
            SUM(total) AS total_spending,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders,
            MAX(o.created_at) AS last_order_date
        FROM orders o
        WHERE o.customer_id = c.id
    ) os ON true
    -- Loyalty points subquery
    LEFT JOIN LATERAL (
        SELECT SUM(lpt.points) AS points
        FROM loyalty_points lpt
        WHERE lpt.customer_id = c.id
    ) lp ON true
    -- Invoice stats subquery
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir
        WHERE cir.customer_id = c.id
    ) inv ON true
    WHERE 
        -- Search filter
        (p_search IS NULL OR 
         c.name ILIKE '%' || p_search || '%' OR 
         c.email ILIKE '%' || p_search || '%' OR 
         c.phone ILIKE '%' || p_search || '%')
        -- Ban filter
        AND (
            p_filter = 'all' 
            OR (p_filter = 'active' AND (c.is_banned IS NULL OR c.is_banned = false))
            OR (p_filter = 'banned' AND c.is_banned = true)
        )
    ORDER BY c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. GET CUSTOMER DETAIL WITH FULL HISTORY
-- Returns detailed customer info with recent orders
-- ============================================
DROP FUNCTION IF EXISTS get_customer_detail_admin(UUID);
CREATE OR REPLACE FUNCTION get_customer_detail_admin(p_customer_id UUID)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    is_verified BOOLEAN,
    is_banned BOOLEAN,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_by_name TEXT,
    unbanned_at TIMESTAMPTZ,
    unbanned_by_name TEXT,
    created_at TIMESTAMPTZ,
    favorites JSONB,
    -- Stats
    total_orders BIGINT,
    total_spending DECIMAL,
    average_order_value DECIMAL,
    online_orders BIGINT,
    dine_in_orders BIGINT,
    takeaway_orders BIGINT,
    -- Loyalty
    loyalty_points INTEGER,
    lifetime_points INTEGER,
    -- Invoice
    total_invoices BIGINT,
    total_invoice_amount DECIMAL,
    -- Recent orders
    recent_orders JSONB,
    -- Recent invoices
    recent_invoices JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        banned_emp.name::TEXT AS banned_by_name,
        c.unbanned_at,
        unbanned_emp.name::TEXT AS unbanned_by_name,
        c.created_at,
        COALESCE(c.favorites, '[]'::jsonb) AS favorites,
        -- Order statistics
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.avg_order, 0) AS average_order_value,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        -- Loyalty
        COALESCE(lp.current_points, 0)::INTEGER AS loyalty_points,
        COALESCE(lp.lifetime_points, 0)::INTEGER AS lifetime_points,
        -- Invoice stats
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount,
        -- Recent orders (last 10)
        COALESCE(ro.orders, '[]'::jsonb) AS recent_orders,
        -- Recent invoices (last 10)
        COALESCE(ri.invoices, '[]'::jsonb) AS recent_invoices
    FROM customers c
    LEFT JOIN employees banned_emp ON c.banned_by = banned_emp.id
    LEFT JOIN employees unbanned_emp ON c.unbanned_by = unbanned_emp.id
    -- Order stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_orders,
            SUM(total) AS total_spending,
            AVG(total) AS avg_order,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders
        FROM orders o
        WHERE o.customer_id = c.id
    ) os ON true
    -- Loyalty points
    LEFT JOIN LATERAL (
        SELECT 
            SUM(lpt.points) AS current_points,
            SUM(ABS(lpt.points)) AS lifetime_points
        FROM loyalty_points lpt
        WHERE lpt.customer_id = c.id
    ) lp ON true
    -- Invoice stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir
        WHERE cir.customer_id = c.id
    ) inv ON true
    -- Recent orders
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                'total', o.total,
                'items', o.items,
                'payment_method', o.payment_method,
                'created_at', o.created_at
            ) ORDER BY o.created_at DESC
        ) AS orders
        FROM (
            SELECT ord.* FROM orders ord
            WHERE ord.customer_id = c.id 
            ORDER BY ord.created_at DESC 
            LIMIT 10
        ) o
    ) ro ON true
    -- Recent invoices
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', i.id,
                'invoice_number', i.invoice_number,
                'order_type', i.order_type,
                'total', i.total,
                'payment_method', i.payment_method,
                'loyalty_points_earned', i.loyalty_points_earned,
                'billed_at', i.billed_at
            ) ORDER BY i.billed_at DESC
        ) AS invoices
        FROM (
            SELECT cir.* FROM customer_invoice_records cir
            WHERE cir.customer_id = c.id 
            ORDER BY cir.billed_at DESC 
            LIMIT 10
        ) i
    ) ri ON true
    WHERE c.id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. BAN CUSTOMER
-- Admin/Manager can ban a customer
-- ============================================
DROP FUNCTION IF EXISTS ban_customer(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION ban_customer(
    p_customer_id UUID,
    p_reason TEXT,
    p_banned_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Get customer info
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF v_customer.is_banned = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is already banned');
    END IF;
    
    -- Ban the customer
    UPDATE customers SET
        is_banned = true,
        ban_reason = p_reason,
        banned_at = NOW(),
        banned_by = p_banned_by,
        unbanned_at = NULL,
        unbanned_by = NULL
    WHERE id = p_customer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Customer banned successfully',
        'customer_name', v_customer.name,
        'customer_email', v_customer.email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. UNBAN CUSTOMER
-- Admin/Manager can unban a customer
-- ============================================
DROP FUNCTION IF EXISTS unban_customer(UUID, UUID);
CREATE OR REPLACE FUNCTION unban_customer(
    p_customer_id UUID,
    p_unbanned_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Get customer info
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF v_customer.is_banned = false OR v_customer.is_banned IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is not banned');
    END IF;
    
    -- Unban the customer
    UPDATE customers SET
        is_banned = false,
        unbanned_at = NOW(),
        unbanned_by = p_unbanned_by
    WHERE id = p_customer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Customer unbanned successfully',
        'customer_name', v_customer.name,
        'customer_email', v_customer.email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. GET CUSTOMER STATS SUMMARY
-- For dashboard overview
-- ============================================
DROP FUNCTION IF EXISTS get_customers_stats();
CREATE OR REPLACE FUNCTION get_customers_stats()
RETURNS TABLE (
    total_customers BIGINT,
    active_customers BIGINT,
    banned_customers BIGINT,
    verified_customers BIGINT,
    customers_this_month BIGINT,
    total_spending DECIMAL,
    average_order_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_customers,
        COUNT(*) FILTER (WHERE c.is_banned IS NULL OR c.is_banned = false)::BIGINT AS active_customers,
        COUNT(*) FILTER (WHERE c.is_banned = true)::BIGINT AS banned_customers,
        COUNT(*) FILTER (WHERE c.is_verified = true)::BIGINT AS verified_customers,
        COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', NOW()))::BIGINT AS customers_this_month,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS total_spending,
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS average_order_value
    FROM customers c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_customers_admin(INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_detail_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ban_customer(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unban_customer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customers_stats() TO authenticated;

-- ============================================
-- ENABLE REALTIME FOR CUSTOMERS TABLE
-- Required for real-time ban detection
-- ============================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
EXCEPTION
    WHEN duplicate_object THEN
        -- Table already in publication, ignore
        NULL;
END $$;
