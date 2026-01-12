-- =============================================
-- DELIVERY RIDER COMPLETE HISTORY RPC
-- Fetches ALL online orders assigned to a delivery rider
-- with complete details and comprehensive stats
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_rider_complete_history(UUID, TEXT, DATE, DATE, INT, INT);
DROP FUNCTION IF EXISTS get_rider_orders_history(UUID, TEXT, DATE, DATE, INT, INT);

-- =============================================
-- GET RIDER COMPLETE HISTORY
-- Fetches online orders directly from orders table
-- Returns all orders assigned to the rider with full details
-- =============================================

CREATE OR REPLACE FUNCTION get_rider_complete_history(
    p_rider_id UUID,              -- Rider ID (required)
    p_status TEXT DEFAULT NULL,   -- Filter by order status (pending, delivering, delivered, cancelled)
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_is_valid_rider BOOLEAN;
    v_result JSONB;
    v_total_count INT;
    v_orders JSONB;
    v_stats JSONB;
BEGIN
    -- Validate rider exists and is a delivery_rider
    SELECT EXISTS(
        SELECT 1 FROM employees 
        WHERE id = p_rider_id 
        AND role = 'delivery_rider'
    ) INTO v_is_valid_rider;
    
    IF NOT v_is_valid_rider THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Invalid or non-existent delivery rider ID'
        );
    END IF;
    
    -- Count total matching orders
    SELECT COUNT(*) INTO v_total_count
    FROM orders o
    WHERE o.delivery_rider_id = p_rider_id
      AND o.order_type = 'online'
      AND (p_status IS NULL OR o.status::TEXT = p_status)
      AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date);
    
    -- Get orders with all details
    SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
    INTO v_orders
    FROM (
        SELECT jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'status', o.status,
            'order_type', o.order_type,
            
            -- Customer details
            'customer', jsonb_build_object(
                'id', o.customer_id,
                'name', o.customer_name,
                'email', o.customer_email,
                'phone', o.customer_phone,
                'address', o.customer_address
            ),
            
            -- Items with details
            'items', o.items,
            'total_items', COALESCE(jsonb_array_length(o.items), 0),
            
            -- Financial details
            'subtotal', o.subtotal,
            'tax', o.tax,
            'delivery_fee', o.delivery_fee,
            'discount', o.discount,
            'total', o.total,
            
            -- Payment info
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'transaction_id', o.transaction_id,
            
            -- Delivery info
            'delivery_address', o.customer_address,
            'delivery_instructions', o.notes,
            'estimated_delivery_time', o.estimated_delivery_time,
            
            -- Timestamps
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'confirmed_at', o.confirmed_at,
            'preparing_started_at', o.preparing_started_at,
            'ready_at', o.ready_at,
            'delivery_started_at', o.delivery_started_at,
            'delivered_at', o.delivered_at,
            'cancelled_at', o.cancelled_at,
            
            -- Calculate delivery duration in minutes
            'delivery_duration_minutes', 
                CASE 
                    WHEN o.delivered_at IS NOT NULL AND o.delivery_started_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (o.delivered_at - o.delivery_started_at)) / 60
                    ELSE NULL 
                END,
            
            -- Notes
            'notes', o.notes,
            'cancellation_reason', o.cancellation_reason
            
        ) AS order_data
        FROM orders o
        WHERE o.delivery_rider_id = p_rider_id
          AND o.order_type = 'online'
          AND (p_status IS NULL OR o.status::TEXT = p_status)
          AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) sub;
    
    -- Calculate comprehensive stats
    SELECT jsonb_build_object(
        -- Delivery counts
        'total_assigned', COUNT(*),
        'total_delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
        'total_delivering', COUNT(*) FILTER (WHERE status = 'delivering' OR status = 'out_for_delivery'),
        'total_cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'total_returned', COUNT(*) FILTER (WHERE status = 'returned'),
        
        -- Today's stats
        'today_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
        'today_assigned', COUNT(*) FILTER (WHERE created_at::DATE = CURRENT_DATE),
        'today_cancelled', COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_at::DATE = CURRENT_DATE),
        
        -- This week stats
        'week_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
        'week_assigned', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        
        -- This month stats
        'month_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
        'month_assigned', COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)),
        
        -- Financial stats
        'total_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0),
        'today_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0),
        'week_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
        'month_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
        'avg_order_value', ROUND(AVG(total) FILTER (WHERE status = 'delivered'), 2),
        
        -- Delivery fee stats
        'total_delivery_fees', COALESCE(SUM(delivery_fee) FILTER (WHERE status = 'delivered'), 0),
        'today_delivery_fees', COALESCE(SUM(delivery_fee) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0),
        
        -- Time stats (average delivery time in minutes)
        'avg_delivery_minutes', ROUND(
            AVG(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        'fastest_delivery_minutes', ROUND(
            MIN(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        'slowest_delivery_minutes', ROUND(
            MAX(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        
        -- Payment method breakdown
        'cash_orders', COUNT(*) FILTER (WHERE payment_method = 'cash' AND status = 'delivered'),
        'card_orders', COUNT(*) FILTER (WHERE payment_method = 'card' AND status = 'delivered'),
        'online_payment_orders', COUNT(*) FILTER (WHERE payment_method = 'online' AND status = 'delivered'),
        'wallet_orders', COUNT(*) FILTER (WHERE payment_method = 'wallet' AND status = 'delivered'),
        
        -- Cash to collect (COD orders delivered)
        'cash_to_collect_today', COALESCE(
            SUM(total) FILTER (WHERE payment_method = 'cash' AND status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 
            0
        ),
        
        -- Success rate
        'success_rate', CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
            ELSE 0 
        END
    ) INTO v_stats
    FROM orders
    WHERE delivery_rider_id = p_rider_id
      AND order_type = 'online';
    
    -- Build final result
    v_result := jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        'orders', v_orders,
        'total_count', v_total_count,
        'page_size', p_limit,
        'page_offset', p_offset,
        'has_more', (p_offset + p_limit) < v_total_count,
        'stats', v_stats,
        'filters_applied', jsonb_build_object(
            'status', p_status,
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_rider_complete_history(UUID, TEXT, DATE, DATE, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rider_complete_history(UUID, TEXT, DATE, DATE, INT, INT) TO anon;

-- Add comment
COMMENT ON FUNCTION get_rider_complete_history IS 'Returns complete delivery history for a rider from orders table with comprehensive stats';

-- =============================================
-- GET RIDER DASHBOARD STATS (Quick stats only)
-- For dashboard cards - fast query
-- =============================================

CREATE OR REPLACE FUNCTION get_rider_dashboard_stats(
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    -- Validate rider
    IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_rider_id AND role = 'delivery_rider') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid rider');
    END IF;
    
    SELECT jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        
        -- Today
        'today', jsonb_build_object(
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
            'active', COUNT(*) FILTER (WHERE status IN ('delivering', 'out_for_delivery')),
            'earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0),
            'cash_collected', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND payment_method = 'cash' AND delivered_at::DATE = CURRENT_DATE), 0)
        ),
        
        -- This week
        'this_week', jsonb_build_object(
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
            'earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'), 0)
        ),
        
        -- This month
        'this_month', jsonb_build_object(
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
            'earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)
        ),
        
        -- All time
        'all_time', jsonb_build_object(
            'total_delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
            'total_cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
            'total_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0),
            'success_rate', CASE 
                WHEN COUNT(*) > 0 
                THEN ROUND((COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
                ELSE 100 
            END
        ),
        
        -- Performance
        'performance', jsonb_build_object(
            'avg_delivery_minutes', ROUND(
                AVG(EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60) 
                FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
            )
        )
    ) INTO v_stats
    FROM orders
    WHERE delivery_rider_id = p_rider_id
      AND order_type = 'online';
    
    RETURN v_stats;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_rider_dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rider_dashboard_stats(UUID) TO anon;

COMMENT ON FUNCTION get_rider_dashboard_stats IS 'Returns quick dashboard stats for delivery rider';

-- =============================================
-- GET RIDER CURRENT ACTIVE DELIVERIES
-- Shows orders currently being delivered
-- =============================================

CREATE OR REPLACE FUNCTION get_rider_active_deliveries(
    p_rider_id UUID
)
RETURNS JSONB AS $$
BEGIN
    -- Validate rider
    IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_rider_id AND role = 'delivery_rider') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid rider');
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        'active_orders', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'status', o.status,
                    'customer_name', o.customer_name,
                    'customer_phone', o.customer_phone,
                    'customer_address', o.customer_address,
                    'items', o.items,
                    'total_items', COALESCE(jsonb_array_length(o.items), 0),
                    'total', o.total,
                    'payment_method', o.payment_method,
                    'payment_status', o.payment_status,
                    'notes', o.notes,
                    'delivery_started_at', o.delivery_started_at,
                    'minutes_elapsed', EXTRACT(EPOCH FROM (NOW() - o.delivery_started_at)) / 60
                ) ORDER BY o.delivery_started_at
            ), '[]'::jsonb)
            FROM orders o
            WHERE o.delivery_rider_id = p_rider_id
              AND o.order_type = 'online'
              AND o.status IN ('delivering', 'out_for_delivery')
        ),
        'count', (
            SELECT COUNT(*)
            FROM orders
            WHERE delivery_rider_id = p_rider_id
              AND order_type = 'online'
              AND status IN ('delivering', 'out_for_delivery')
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_rider_active_deliveries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rider_active_deliveries(UUID) TO anon;

COMMENT ON FUNCTION get_rider_active_deliveries IS 'Returns current active deliveries for a rider';

-- =============================================
-- SUMMARY
-- =============================================
-- Functions created:
-- 1. get_rider_complete_history(rider_id, status?, start_date?, end_date?, limit?, offset?)
--    - Returns ALL online orders assigned to rider from orders table
--    - Includes full order details, customer info, items, timestamps
--    - Includes comprehensive stats (earnings, counts, time analytics)
--
-- 2. get_rider_dashboard_stats(rider_id)
--    - Quick stats for dashboard cards
--    - Today, this week, this month, all time
--
-- 3. get_rider_active_deliveries(rider_id)
--    - Current orders being delivered
--    - Real-time tracking data
-- =============================================
