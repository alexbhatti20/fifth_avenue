-- =============================================
-- DELIVERY HISTORY & RIDER RPC FUNCTIONS
-- Advanced, Fast, Production-Ready
-- Isolated data per delivery rider with analytics
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. CREATE DELIVERY HISTORY TABLE
-- Stores complete order snapshot for each delivery
-- Isolated per rider for data isolation
-- =============================================

-- Drop if exists for clean slate
DROP TABLE IF EXISTS delivery_history CASCADE;

CREATE TABLE delivery_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rider reference (owner of this history record)
    rider_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Order reference
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    
    -- Complete order snapshot at time of acceptance
    order_snapshot JSONB NOT NULL,
    
    -- Customer details (denormalized for fast access)
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    customer_email TEXT,
    
    -- Order details
    items JSONB NOT NULL,
    total_items INT NOT NULL DEFAULT 0,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Payment info
    payment_method TEXT,
    payment_status TEXT,
    
    -- Delivery lifecycle timestamps
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,  -- When rider started delivery
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Delivery status (separate from order status for history)
    delivery_status TEXT NOT NULL DEFAULT 'accepted' 
        CHECK (delivery_status IN ('accepted', 'delivering', 'delivered', 'cancelled', 'returned')),
    
    -- Analytics fields
    estimated_delivery_minutes INT,
    actual_delivery_minutes INT,
    distance_km DECIMAL(6, 2),
    delivery_notes TEXT,
    customer_rating INT CHECK (customer_rating >= 1 AND customer_rating <= 5),
    customer_feedback TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: One history per order per rider
    UNIQUE(rider_id, order_id)
);

-- Create indexes for fast queries
CREATE INDEX idx_delivery_history_rider ON delivery_history(rider_id);
CREATE INDEX idx_delivery_history_order ON delivery_history(order_id);
CREATE INDEX idx_delivery_history_status ON delivery_history(delivery_status);
CREATE INDEX idx_delivery_history_accepted_at ON delivery_history(accepted_at DESC);
CREATE INDEX idx_delivery_history_delivered_at ON delivery_history(delivered_at DESC);
CREATE INDEX idx_delivery_history_rider_date ON delivery_history(rider_id, accepted_at DESC);

-- Enable RLS
ALTER TABLE delivery_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Riders can only see their own history
CREATE POLICY "delivery_history_select_own"
    ON delivery_history FOR SELECT
    TO authenticated
    USING (
        rider_id = get_employee_id() OR 
        EXISTS (
            SELECT 1 FROM employees e 
            WHERE e.id = get_employee_id() 
            AND e.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "delivery_history_insert"
    ON delivery_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "delivery_history_update_own"
    ON delivery_history FOR UPDATE
    TO authenticated
    USING (rider_id = get_employee_id())
    WITH CHECK (rider_id = get_employee_id());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON delivery_history TO authenticated;

-- Enable realtime
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. ACCEPT DELIVERY ORDER RPC (FAST)
-- Atomic transaction that:
--   1. Updates order status to 'delivering'
--   2. Assigns rider to order
--   3. Creates delivery history record with full snapshot
--   4. Creates notification for rider
--   5. Logs to order_status_history
-- =============================================

CREATE OR REPLACE FUNCTION accept_delivery_order(
    p_order_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_rider_record RECORD;
    v_order_record RECORD;
    v_order_snapshot JSONB;
    v_total_items INT;
    v_history_id UUID;
BEGIN
    -- Get current rider (must be delivery_rider role)
    v_rider_id := get_employee_id();
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated as employee');
    END IF;
    
    -- Validate rider is delivery_rider and active
    SELECT * INTO v_rider_record FROM employees 
    WHERE id = v_rider_id 
      AND role = 'delivery_rider' 
      AND status = 'active'
      AND portal_enabled = true;
    
    IF v_rider_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as delivery rider');
    END IF;
    
    -- Get and lock the order (FOR UPDATE prevents race conditions)
    SELECT * INTO v_order_record FROM orders 
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate order status (must be ready)
    IF v_order_record.status != 'ready' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Order is not ready for delivery. Current status: ' || v_order_record.status
        );
    END IF;
    
    -- Validate order type (must be online)
    IF v_order_record.order_type != 'online' THEN
        RETURN json_build_object('success', false, 'error', 'Only online orders can be delivered');
    END IF;
    
    -- Check if order already assigned to another rider
    IF v_order_record.delivery_rider_id IS NOT NULL AND v_order_record.delivery_rider_id != v_rider_id THEN
        RETURN json_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Calculate total items
    SELECT COALESCE(SUM((item->>'quantity')::INT), 0) INTO v_total_items
    FROM jsonb_array_elements(v_order_record.items::jsonb) AS item;
    
    -- Build complete order snapshot
    v_order_snapshot := jsonb_build_object(
        'id', v_order_record.id,
        'order_number', v_order_record.order_number,
        'order_type', v_order_record.order_type,
        'status_at_acceptance', v_order_record.status,
        'customer_id', v_order_record.customer_id,
        'customer_name', v_order_record.customer_name,
        'customer_phone', v_order_record.customer_phone,
        'customer_email', v_order_record.customer_email,
        'customer_address', v_order_record.customer_address,
        'items', v_order_record.items,
        'subtotal', v_order_record.subtotal,
        'discount', v_order_record.discount,
        'tax', v_order_record.tax,
        'delivery_fee', v_order_record.delivery_fee,
        'total', v_order_record.total,
        'payment_method', v_order_record.payment_method,
        'payment_status', v_order_record.payment_status,
        'notes', v_order_record.notes,
        'created_at', v_order_record.created_at,
        'kitchen_started_at', v_order_record.kitchen_started_at,
        'kitchen_completed_at', v_order_record.kitchen_completed_at,
        'estimated_delivery_time', v_order_record.estimated_delivery_time
    );
    
    -- Update order: assign rider and change status to 'delivering'
    UPDATE orders
    SET 
        status = 'delivering',
        delivery_rider_id = v_rider_id,
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Insert into delivery_history
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
        delivery_status,
        started_at,
        estimated_delivery_minutes
    )
    VALUES (
        v_rider_id,
        p_order_id,
        v_order_record.order_number,
        v_order_snapshot,
        v_order_record.customer_name,
        v_order_record.customer_phone,
        v_order_record.customer_address,
        v_order_record.customer_email,
        v_order_record.items::jsonb,
        v_total_items,
        v_order_record.subtotal,
        COALESCE(v_order_record.delivery_fee, 0),
        v_order_record.total,
        v_order_record.payment_method,
        v_order_record.payment_status,
        'delivering',
        NOW(),
        EXTRACT(EPOCH FROM (v_order_record.estimated_delivery_time - NOW())) / 60
    )
    ON CONFLICT (rider_id, order_id) 
    DO UPDATE SET
        delivery_status = 'delivering',
        started_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_history_id;
    
    -- Add to order status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (
        p_order_id, 
        'delivering'::order_status, 
        v_rider_id, 
        'Accepted and started delivery by ' || v_rider_record.name
    );
    
    -- Create notification for rider
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (
        v_rider_id,
        'employee',
        'Delivery Started',
        'Order #' || v_order_record.order_number || ' is now in your queue',
        'delivery',
        jsonb_build_object(
            'order_id', p_order_id,
            'order_number', v_order_record.order_number,
            'history_id', v_history_id,
            'customer_name', v_order_record.customer_name,
            'customer_phone', v_order_record.customer_phone,
            'customer_address', v_order_record.customer_address,
            'total', v_order_record.total
        )
    );
    
    -- Return success with full details
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'history_id', v_history_id,
        'order_number', v_order_record.order_number,
        'new_status', 'delivering',
        'rider', json_build_object(
            'id', v_rider_record.id,
            'name', v_rider_record.name,
            'phone', v_rider_record.phone
        ),
        'order', json_build_object(
            'customer_name', v_order_record.customer_name,
            'customer_phone', v_order_record.customer_phone,
            'customer_address', v_order_record.customer_address,
            'total', v_order_record.total,
            'items_count', v_total_items,
            'payment_method', v_order_record.payment_method
        ),
        'accepted_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_delivery_order(UUID) TO authenticated;

-- =============================================
-- 3. COMPLETE DELIVERY RPC (FAST)
-- Marks order as delivered and updates history
-- =============================================

CREATE OR REPLACE FUNCTION complete_delivery_order(
    p_order_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_order_record RECORD;
    v_history_record RECORD;
    v_delivery_minutes INT;
BEGIN
    -- Get current rider
    v_rider_id := get_employee_id();
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order_record FROM orders 
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate rider owns this delivery
    IF v_order_record.delivery_rider_id != v_rider_id THEN
        RETURN json_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Validate status
    IF v_order_record.status != 'delivering' THEN
        RETURN json_build_object('success', false, 'error', 'Order is not in delivering status');
    END IF;
    
    -- Calculate actual delivery time
    SELECT * INTO v_history_record FROM delivery_history 
    WHERE order_id = p_order_id AND rider_id = v_rider_id;
    
    IF v_history_record IS NOT NULL AND v_history_record.started_at IS NOT NULL THEN
        v_delivery_minutes := EXTRACT(EPOCH FROM (NOW() - v_history_record.started_at)) / 60;
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Update delivery history
    UPDATE delivery_history
    SET 
        delivery_status = 'delivered',
        delivered_at = NOW(),
        actual_delivery_minutes = v_delivery_minutes,
        delivery_notes = COALESCE(p_notes, delivery_notes),
        updated_at = NOW()
    WHERE order_id = p_order_id AND rider_id = v_rider_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (
        p_order_id, 
        'delivered'::order_status, 
        v_rider_id, 
        COALESCE(p_notes, 'Delivered successfully')
    );
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order_record.order_number,
        'new_status', 'delivered',
        'delivery_minutes', v_delivery_minutes,
        'delivered_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_delivery_order(UUID, TEXT) TO authenticated;

-- =============================================
-- 4. GET RIDER DELIVERY HISTORY (with pagination & analytics)
-- Returns rider's own delivery history with statistics
-- =============================================

CREATE OR REPLACE FUNCTION get_rider_delivery_history(
    p_status TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    result JSON;
    total_count INT;
BEGIN
    -- Get current rider
    v_rider_id := get_employee_id();
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
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
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_rider_delivery_history(TEXT, DATE, DATE, INT, INT) TO authenticated;

-- =============================================
-- 5. GET ALL RIDERS ANALYTICS (for managers)
-- Returns analytics for all delivery riders
-- =============================================

CREATE OR REPLACE FUNCTION get_all_riders_analytics()
RETURNS JSON AS $$
DECLARE
    v_employee_id UUID;
    v_employee_role TEXT;
BEGIN
    -- Get current employee
    v_employee_id := get_employee_id();
    
    -- Verify admin/manager role
    SELECT role INTO v_employee_role FROM employees WHERE id = v_employee_id;
    
    IF v_employee_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Return all riders analytics
    RETURN json_build_object(
        'success', true,
        'riders', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'rider_id', e.id,
                    'name', e.name,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'status', e.status,
                    'stats', (
                        SELECT json_build_object(
                            'total_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
                            'deliveries_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                            'deliveries_this_week', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
                            'active_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivering'),
                            'avg_delivery_minutes', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL)),
                            'avg_rating', ROUND(AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL), 1),
                            'total_earnings', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0),
                            'cancelled_count', COUNT(*) FILTER (WHERE delivery_status = 'cancelled')
                        )
                        FROM delivery_history dh WHERE dh.rider_id = e.id
                    )
                ) ORDER BY e.name
            ), '[]'::json)
            FROM employees e
            WHERE e.role = 'delivery_rider'
              AND e.status = 'active'
        ),
        -- Overall stats
        'overall', (
            SELECT json_build_object(
                'total_deliveries_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                'total_active', COUNT(*) FILTER (WHERE delivery_status = 'delivering'),
                'avg_delivery_time', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL AND delivered_at::DATE = CURRENT_DATE)),
                'total_earnings_today', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0)
            )
            FROM delivery_history
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_riders_analytics() TO authenticated;

-- =============================================
-- 6. CANCEL DELIVERY RPC
-- For cancelling an accepted delivery
-- =============================================

CREATE OR REPLACE FUNCTION cancel_delivery_order(
    p_order_id UUID,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_rider_id UUID;
    v_order_record RECORD;
BEGIN
    -- Get current rider
    v_rider_id := get_employee_id();
    
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    IF v_order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate rider owns this delivery or is manager
    IF v_order_record.delivery_rider_id != v_rider_id THEN
        -- Check if manager/admin
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_rider_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to cancel this delivery');
        END IF;
    END IF;
    
    -- Update order back to ready status (unassign rider)
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
        delivery_status = 'cancelled',
        cancelled_at = NOW(),
        delivery_notes = p_reason,
        updated_at = NOW()
    WHERE order_id = p_order_id AND rider_id = v_order_record.delivery_rider_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, 'ready'::order_status, v_rider_id, 'Delivery cancelled: ' || COALESCE(p_reason, 'No reason provided'));
    
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', 'ready',
        'message', 'Delivery cancelled. Order is back in queue.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cancel_delivery_order(UUID, TEXT) TO authenticated;

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE delivery_history IS 'Stores delivery history per rider with complete order snapshots for analytics and isolation';
COMMENT ON FUNCTION accept_delivery_order IS 'Fast atomic RPC: Assigns order to rider, updates status to delivering, creates history record';
COMMENT ON FUNCTION complete_delivery_order IS 'Marks delivery as completed, calculates delivery time, updates all records';
COMMENT ON FUNCTION get_rider_delivery_history IS 'Returns paginated delivery history with stats for the authenticated rider';
COMMENT ON FUNCTION get_all_riders_analytics IS 'Manager function: Returns analytics for all delivery riders';
COMMENT ON FUNCTION cancel_delivery_order IS 'Cancels delivery and returns order to ready queue';
