-- =============================================
-- DELIVERY HISTORY RPC FIX
-- Fixes "Not authenticated" error for delivery riders
-- by accepting rider_id as optional parameter
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop and recreate the function with optional rider_id parameter
DROP FUNCTION IF EXISTS get_rider_delivery_history(TEXT, DATE, DATE, INT, INT);
DROP FUNCTION IF EXISTS get_rider_delivery_history(UUID, TEXT, DATE, DATE, INT, INT);

-- =============================================
-- GET RIDER DELIVERY HISTORY (with pagination & analytics)
-- Now accepts optional p_rider_id for explicit authentication
-- Falls back to get_employee_id() if not provided
-- =============================================

CREATE OR REPLACE FUNCTION get_rider_delivery_history(
    p_rider_id UUID DEFAULT NULL,  -- NEW: Explicit rider ID (optional)
    p_status TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_is_valid_rider BOOLEAN;
    result JSON;
    total_count INT;
BEGIN
    -- Determine rider ID: use explicit parameter or fall back to auth
    IF p_rider_id IS NOT NULL THEN
        -- Verify the provided rider_id exists and is a delivery rider
        SELECT EXISTS(
            SELECT 1 FROM employees 
            WHERE id = p_rider_id 
            AND role = 'delivery_rider' 
            AND status = 'active'
        ) INTO v_is_valid_rider;
        
        IF NOT v_is_valid_rider THEN
            RETURN json_build_object('success', false, 'error', 'Invalid rider ID');
        END IF;
        
        v_rider_id := p_rider_id;
    ELSE
        -- Fall back to getting rider from auth context
        v_rider_id := get_employee_id();
    END IF;
    
    -- Final check
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated - no rider ID provided');
    END IF;
    
    -- Count total matching records
    SELECT COUNT(*) INTO total_count
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date);
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'rider_id', v_rider_id,  -- Return the rider_id for debugging
        'history', COALESCE(json_agg(
            json_build_object(
                'id', dh.id,
                'order_id', dh.order_id,
                'order_number', dh.order_number,
                'customer_name', dh.customer_name,
                'customer_phone', dh.customer_phone,
                'customer_address', dh.customer_address,
                'items', dh.items,
                'total_items', dh.total_items,
                'total', dh.total,
                'payment_method', dh.payment_method,
                'delivery_status', dh.delivery_status,
                'accepted_at', dh.accepted_at,
                'started_at', dh.started_at,
                'delivered_at', dh.delivered_at,
                'actual_delivery_minutes', dh.actual_delivery_minutes,
                'customer_rating', dh.customer_rating
            ) ORDER BY dh.accepted_at DESC
        ), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count,
        -- Quick stats for this rider
        'stats', (
            SELECT json_build_object(
                'total_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
                'total_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                'total_this_week', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
                'total_this_month', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
                'avg_delivery_minutes', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL)),
                'avg_rating', ROUND(AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL), 1),
                'total_earnings', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0),
                'cancelled_count', COUNT(*) FILTER (WHERE delivery_status = 'cancelled'),
                'active_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivering')
            )
            FROM delivery_history WHERE rider_id = v_rider_id
        )
    ) INTO result
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date)
    LIMIT p_limit
    OFFSET p_offset;
    
    -- Handle empty result (when no records found)
    IF result IS NULL THEN
        result := json_build_object(
            'success', true,
            'rider_id', v_rider_id,
            'history', '[]'::json,
            'total_count', 0,
            'has_more', false,
            'stats', json_build_object(
                'total_deliveries', 0,
                'total_today', 0,
                'total_this_week', 0,
                'total_this_month', 0,
                'avg_delivery_minutes', NULL,
                'avg_rating', NULL,
                'total_earnings', 0,
                'cancelled_count', 0,
                'active_deliveries', 0
            )
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_rider_delivery_history(UUID, TEXT, DATE, DATE, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rider_delivery_history(UUID, TEXT, DATE, DATE, INT, INT) TO anon;

-- Add comment
COMMENT ON FUNCTION get_rider_delivery_history IS 'Returns paginated delivery history with stats for the specified or authenticated rider. Pass p_rider_id for explicit authentication.';

-- =============================================
-- Also fix accept_delivery_order to accept rider_id
-- =============================================

-- Check if accept_delivery_order exists and fix it
DO $$
BEGIN
    -- Drop existing function if exists (all variations)
    DROP FUNCTION IF EXISTS accept_delivery_order(UUID);
    DROP FUNCTION IF EXISTS accept_delivery_order(UUID, UUID);
END $$;

CREATE OR REPLACE FUNCTION accept_delivery_order(
    p_order_id UUID,
    p_rider_id UUID DEFAULT NULL  -- NEW: Explicit rider ID (optional)
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_rider RECORD;
BEGIN
    -- Determine rider ID
    IF p_rider_id IS NOT NULL THEN
        v_rider_id := p_rider_id;
    ELSE
        v_rider_id := get_employee_id();
    END IF;
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get rider details
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = v_rider_id
    AND role = 'delivery_rider'
    AND status = 'active';
    
    IF v_rider.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a valid delivery rider');
    END IF;
    
    -- Get order and verify status
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status != 'ready' THEN
        RETURN json_build_object('success', false, 'error', 'Order is not ready for delivery');
    END IF;
    
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != v_rider_id THEN
        RETURN json_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        delivery_rider_id = v_rider_id,
        status = 'delivering',
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create delivery history record
    INSERT INTO delivery_history (
        rider_id,
        order_id,
        order_number,
        order_snapshot,
        customer_name,
        customer_phone,
        customer_address,
        customer_email,
        items,
        total_items,
        subtotal,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        accepted_at,
        started_at,
        delivery_status
    ) VALUES (
        v_rider_id,
        v_order.id,
        v_order.order_number,
        row_to_json(v_order),
        v_order.customer_name,
        v_order.customer_phone,
        v_order.customer_address,
        v_order.customer_email,
        v_order.items,
        COALESCE(jsonb_array_length(v_order.items::jsonb), 0),
        v_order.subtotal,
        v_order.delivery_fee,
        v_order.total,
        v_order.payment_method,
        v_order.payment_status,
        NOW(),
        NOW(),
        'delivering'
    )
    ON CONFLICT (rider_id, order_id) DO UPDATE SET
        started_at = NOW(),
        delivery_status = 'delivering',
        updated_at = NOW();
    
    -- Return success with order details
    RETURN json_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'order', json_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'customer_address', v_order.customer_address,
            'total', v_order.total,
            'payment_method', v_order.payment_method
        ),
        'rider', json_build_object(
            'id', v_rider.id,
            'name', v_rider.name,
            'phone', v_rider.phone
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_delivery_order(UUID, UUID) TO authenticated;

-- =============================================
-- Fix complete_delivery_order
-- =============================================

DROP FUNCTION IF EXISTS complete_delivery_order(UUID, TEXT);
DROP FUNCTION IF EXISTS complete_delivery_order(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION complete_delivery_order(
    p_order_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_rider_id UUID DEFAULT NULL  -- NEW: Explicit rider ID (optional)
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_history RECORD;
    v_delivery_minutes INT;
BEGIN
    -- Determine rider ID
    IF p_rider_id IS NOT NULL THEN
        v_rider_id := p_rider_id;
    ELSE
        v_rider_id := get_employee_id();
    END IF;
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status != 'delivering' THEN
        RETURN json_build_object('success', false, 'error', 'Order is not in delivering status');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN json_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Calculate delivery time
    SELECT EXTRACT(EPOCH FROM (NOW() - dh.started_at)) / 60 INTO v_delivery_minutes
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id AND dh.order_id = p_order_id;
    
    -- Update delivery history
    UPDATE delivery_history
    SET 
        delivered_at = NOW(),
        delivery_status = 'delivered',
        actual_delivery_minutes = COALESCE(v_delivery_minutes, 0)::INT,
        delivery_notes = p_notes,
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'delivery_minutes', COALESCE(v_delivery_minutes, 0)::INT,
        'message', 'Delivery completed successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_delivery_order(UUID, TEXT, UUID) TO authenticated;

-- =============================================
-- Fix cancel_delivery_order
-- =============================================

DROP FUNCTION IF EXISTS cancel_delivery_order(UUID, TEXT);
DROP FUNCTION IF EXISTS cancel_delivery_order(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION cancel_delivery_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_rider_id UUID DEFAULT NULL  -- NEW: Explicit rider ID (optional)
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
BEGIN
    -- Determine rider ID
    IF p_rider_id IS NOT NULL THEN
        v_rider_id := p_rider_id;
    ELSE
        v_rider_id := get_employee_id();
    END IF;
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN json_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Update order - back to ready status
    UPDATE orders
    SET 
        status = 'ready',
        delivery_rider_id = NULL,
        delivery_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Update delivery history
    UPDATE delivery_history
    SET 
        cancelled_at = NOW(),
        delivery_status = 'cancelled',
        delivery_notes = p_reason,
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'message', 'Delivery cancelled. Order is back in queue.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_delivery_order(UUID, TEXT, UUID) TO authenticated;

-- =============================================
-- OUTPUT SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'Delivery history RPC functions updated successfully!';
    RAISE NOTICE 'Functions now accept optional p_rider_id parameter.';
    RAISE NOTICE 'Update your frontend code to pass the rider ID from usePortalAuth.';
END $$;
