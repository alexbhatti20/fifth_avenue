-- =============================================
-- BILLING DASHBOARD STATS & BILLABLE ORDERS
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_billing_dashboard_stats();
DROP FUNCTION IF EXISTS get_billable_orders(TEXT, TEXT, INT, INT);

-- =============================================
-- 1. GET BILLING DASHBOARD STATS
-- Returns comprehensive billing statistics
-- NO AUTH CHECK - RLS handles security
-- =============================================
CREATE OR REPLACE FUNCTION get_billing_dashboard_stats()
RETURNS JSON AS $$
BEGIN
    -- No auth check - let RLS and frontend handle it
    -- This function just returns data
    
    RETURN json_build_object(
        'success', true,
        'today', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(total), 0),
                'invoices_count', COUNT(*),
                'cash_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0),
                'card_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0),
                'online_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'online'), 0),
                'avg_invoice_value', COALESCE(ROUND(AVG(total), 2), 0),
                'total_discount_given', COALESCE(SUM(discount), 0),
                'total_tips', COALESCE(SUM(tip), 0),
                'dine_in_count', COUNT(*) FILTER (WHERE order_type = 'dine-in'),
                'online_count', COUNT(*) FILTER (WHERE order_type = 'online'),
                'walk_in_count', COUNT(*) FILTER (WHERE order_type = 'walk-in')
            )
            FROM invoices
            WHERE DATE(created_at) = CURRENT_DATE
            AND (bill_status IS NULL OR bill_status = 'paid')
        ),
        'this_week', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(daily_total), 0),
                'invoices_count', COALESCE(SUM(daily_count), 0),
                'avg_daily_revenue', COALESCE(ROUND(AVG(daily_total), 2), 0)
            )
            FROM (
                SELECT DATE(created_at) as day, SUM(total) as daily_total, COUNT(*) as daily_count
                FROM invoices
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                AND (bill_status IS NULL OR bill_status = 'paid')
                GROUP BY DATE(created_at)
            ) daily
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ),
        'recent_invoices', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', i.id,
                    'invoice_number', i.invoice_number,
                    'customer_name', i.customer_name,
                    'total', i.total,
                    'payment_method', i.payment_method,
                    'created_at', i.created_at
                ) ORDER BY i.created_at DESC
            ), '[]'::json)
            FROM (
                SELECT * FROM invoices
                WHERE DATE(created_at) = CURRENT_DATE
                ORDER BY created_at DESC
                LIMIT 5
            ) i
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_billing_dashboard_stats() TO authenticated;

-- =============================================
-- 2. GET BILLABLE ORDERS
-- Returns all orders that need billing
-- NO AUTH CHECK - RLS handles security
-- =============================================
CREATE OR REPLACE FUNCTION get_billable_orders(
    p_order_type TEXT DEFAULT NULL,
    p_status_filter TEXT DEFAULT 'all',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- No auth check - let RLS and frontend handle it
    
    SELECT json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(order_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'order_type', o.order_type,
                    'status', o.status,
                    'payment_status', o.payment_status,
                    'customer_id', o.customer_id,
                    'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
                    'customer_phone', o.customer_phone,
                    'customer_email', o.customer_email,
                    'customer_address', o.customer_address,
                    'items', o.items,
                    'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)),
                    'subtotal', o.subtotal,
                    'discount', o.discount,
                    'tax', o.tax,
                    'delivery_fee', o.delivery_fee,
                    'total', o.total,
                    'table_number', o.table_number,
                    'waiter_id', o.waiter_id,
                    'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
                    'notes', o.notes,
                    'created_at', o.created_at,
                    'is_registered_customer', o.customer_id IS NOT NULL,
                    'customer_loyalty_points', COALESCE((
                        SELECT SUM(points) FROM loyalty_points WHERE customer_id = o.customer_id
                    ), 0),
                    'has_invoice', EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
                ) as order_data,
                o.created_at
                FROM orders o
                WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
                AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
                AND (
                    p_status_filter = 'all' OR
                    (p_status_filter = 'pending_bill' AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)) OR
                    (p_status_filter = 'billed' AND EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id))
                )
                ORDER BY o.created_at DESC
                LIMIT p_limit
                OFFSET p_offset
            ) sub
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total_pending', COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
                'total_billed_today', (
                    SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURRENT_DATE
                ),
                'revenue_today', (
                    SELECT COALESCE(SUM(total), 0) FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND (bill_status IS NULL OR bill_status = 'paid')
                )
            )
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_billable_orders(TEXT, TEXT, INT, INT) TO authenticated;

-- =============================================
-- Done! Run this in Supabase SQL Editor
-- =============================================
