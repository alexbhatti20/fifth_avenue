-- =============================================
-- ORDERS PAGE - ADVANCED RPC FUNCTIONS
-- Optimized, Fast, Production-Ready
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing functions to recreate
DROP FUNCTION IF EXISTS get_orders_advanced(TEXT, TEXT, DATE, DATE, INT, INT);
DROP FUNCTION IF EXISTS get_order_full_details(UUID);
DROP FUNCTION IF EXISTS get_orders_stats();

-- =============================================
-- 1. Get All Orders with Full Details (Paginated)
-- Returns orders with:
--   - Customer full info (name, phone, email, address)
--   - Table details for dine-in
--   - Waiter info
--   - Delivery rider info
--   - Customer (registered) full profile
--   - Item count & calculated fields
-- =============================================
CREATE OR REPLACE FUNCTION get_orders_advanced(
    p_status TEXT DEFAULT NULL,
    p_order_type TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_count INT;
BEGIN
    -- Get total count first (for pagination)
    SELECT COUNT(*) INTO total_count
    FROM orders o
    WHERE (p_status IS NULL OR o.status::TEXT = p_status)
      AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
      AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date);

    -- Get orders with full details
    SELECT json_build_object(
        'orders', COALESCE(json_agg(order_data ORDER BY created_at DESC), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count
    ) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                
                -- Customer info (direct fields)
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'customer_email', o.customer_email,
                'customer_address', o.customer_address,
                
                -- Registered customer details (if customer_id exists)
                'customer', CASE WHEN o.customer_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', c.id,
                        'name', c.name,
                        'phone', c.phone,
                        'email', c.email,
                        'address', c.address
                    )
                    FROM customers c WHERE c.id = o.customer_id
                ) ELSE NULL END,
                
                -- Items
                'items', o.items,
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                ),
                
                -- Pricing
                'subtotal', o.subtotal,
                'discount', o.discount,
                'tax', o.tax,
                'delivery_fee', o.delivery_fee,
                'total', o.total,
                
                -- Payment
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'payment_proof_url', o.payment_proof_url,
                'transaction_id', o.transaction_id,
                'online_payment_method_id', o.online_payment_method_id,
                'online_payment_details', o.online_payment_details,
                
                -- Notes
                'notes', o.notes,
                'cancellation_reason', o.cancellation_reason,
                
                -- Table details (for dine-in)
                'table_number', o.table_number,
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'status', rt.status,
                        'current_customers', rt.current_customers
                    )
                    FROM restaurant_tables rt 
                    WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                
                -- Waiter info
                'waiter_id', o.waiter_id,
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                
                -- Kitchen staff
                'prepared_by', CASE WHEN o.prepared_by IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name
                    )
                    FROM employees e WHERE e.id = o.prepared_by
                ) ELSE NULL END,
                
                -- Delivery rider (for delivery orders)
                'delivery_rider_id', o.delivery_rider_id,
                'delivery_rider', CASE WHEN o.delivery_rider_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.delivery_rider_id
                ) ELSE NULL END,
                
                -- Timestamps
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                'delivery_started_at', o.delivery_started_at,
                'estimated_delivery_time', o.estimated_delivery_time,
                'delivered_at', o.delivered_at,
                'can_cancel_until', o.can_cancel_until,
                'customer_notified', o.customer_notified,
                
                -- Calculated fields
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'is_delayed', CASE 
                    WHEN o.status IN ('pending', 'confirmed') 
                        AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) > 300 -- 5 minutes
                    THEN true
                    WHEN o.status = 'preparing' 
                        AND o.kitchen_started_at IS NOT NULL
                        AND EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at)) > 900 -- 15 minutes
                    THEN true
                    ELSE false
                END,
                'can_cancel', o.status IN ('pending', 'confirmed') 
                    AND (o.can_cancel_until IS NULL OR o.can_cancel_until > NOW())
            ) AS order_data,
            o.created_at
        FROM orders o
        WHERE (p_status IS NULL OR o.status::TEXT = p_status)
          AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
          AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) sub;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_orders_advanced(TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated;

-- =============================================
-- 2. Get Single Order Full Details (for modal/details view)
-- Returns complete order with status history
-- =============================================
CREATE OR REPLACE FUNCTION get_order_full_details(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_type', o.order_type,
        'status', o.status,
        
        -- Customer info
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_email', o.customer_email,
        'customer_address', o.customer_address,
        
        -- Registered customer full details
        'customer', CASE WHEN o.customer_id IS NOT NULL THEN (
            SELECT json_build_object(
                'id', c.id,
                'name', c.name,
                'phone', c.phone,
                'email', c.email,
                'address', c.address
            )
            FROM customers c WHERE c.id = o.customer_id
        ) ELSE NULL END,
        
        -- Items with full details
        'items', o.items,
        'total_items', (
            SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
            FROM jsonb_array_elements(o.items::jsonb) AS item
        ),
        
        -- Pricing breakdown
        'subtotal', o.subtotal,
        'discount', o.discount,
        'tax', o.tax,
        'delivery_fee', o.delivery_fee,
        'total', o.total,
        
        -- Payment
        'payment_method', o.payment_method,
        'payment_status', o.payment_status,
        'payment_proof_url', o.payment_proof_url,
        'transaction_id', o.transaction_id,
        'online_payment_method_id', o.online_payment_method_id,
        'online_payment_details', o.online_payment_details,
        
        -- Notes
        'notes', o.notes,
        'cancellation_reason', o.cancellation_reason,
        
        -- Table details
        'table_number', o.table_number,
        'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
            SELECT json_build_object(
                'id', rt.id,
                'table_number', rt.table_number,
                'capacity', rt.capacity,
                'section', rt.section,
                'floor', rt.floor,
                'status', rt.status,
                'current_customers', rt.current_customers,
                'assigned_waiter', CASE WHEN rt.assigned_waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', ew.id, 'name', ew.name, 'phone', ew.phone)
                    FROM employees ew WHERE ew.id = rt.assigned_waiter_id
                ) ELSE NULL END
            )
            FROM restaurant_tables rt 
            WHERE rt.table_number = o.table_number
            LIMIT 1
        ) ELSE NULL END,
        
        -- Staff assignments
        'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'phone', e.phone,
                'avatar_url', e.avatar_url,
                'employee_id', e.employee_id
            )
            FROM employees e WHERE e.id = o.waiter_id
        ) ELSE NULL END,
        
        'prepared_by', CASE WHEN o.prepared_by IS NOT NULL THEN (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'phone', e.phone
            )
            FROM employees e WHERE e.id = o.prepared_by
        ) ELSE NULL END,
        
        'delivery_rider', CASE WHEN o.delivery_rider_id IS NOT NULL THEN (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'phone', e.phone,
                'avatar_url', e.avatar_url,
                'employee_id', e.employee_id
            )
            FROM employees e WHERE e.id = o.delivery_rider_id
        ) ELSE NULL END,
        
        -- All timestamps
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'kitchen_started_at', o.kitchen_started_at,
        'kitchen_completed_at', o.kitchen_completed_at,
        'delivery_started_at', o.delivery_started_at,
        'estimated_delivery_time', o.estimated_delivery_time,
        'delivered_at', o.delivered_at,
        'can_cancel_until', o.can_cancel_until,
        'customer_notified', o.customer_notified,
        
        -- Status history
        'status_history', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'status', sh.status,
                    'changed_at', sh.changed_at,
                    'changed_by_name', (SELECT name FROM employees WHERE id = sh.changed_by),
                    'notes', sh.notes
                ) ORDER BY sh.changed_at DESC
            ), '[]'::json)
            FROM order_status_history sh WHERE sh.order_id = o.id
        ),
        
        -- Calculated fields
        'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
        'prep_elapsed_seconds', CASE 
            WHEN o.kitchen_started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at))::INT 
            ELSE NULL 
        END,
        'delivery_elapsed_seconds', CASE 
            WHEN o.delivery_started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (NOW() - o.delivery_started_at))::INT 
            ELSE NULL 
        END,
        'can_cancel', o.status IN ('pending', 'confirmed') 
            AND (o.can_cancel_until IS NULL OR o.can_cancel_until > NOW())
    ) INTO result
    FROM orders o
    WHERE o.id = p_order_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_order_full_details(UUID) TO authenticated;

-- =============================================
-- 3. Get Orders Statistics (for dashboard cards)
-- Returns real-time stats for orders page
-- =============================================
CREATE OR REPLACE FUNCTION get_orders_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        -- Today's stats
        'total_today', (
            SELECT COUNT(*) FROM orders WHERE created_at::DATE = CURRENT_DATE
        ),
        'pending_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'pending'
        ),
        'confirmed_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'confirmed'
        ),
        'preparing_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'preparing'
        ),
        'ready_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'ready'
        ),
        'delivering_count', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'delivering'
        ),
        'completed_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('delivered', 'ready') 
            AND created_at::DATE = CURRENT_DATE
        ),
        'cancelled_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'cancelled' 
            AND created_at::DATE = CURRENT_DATE
        ),
        
        -- Revenue stats
        'revenue_today', (
            SELECT COALESCE(SUM(total), 0) FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'avg_order_value', (
            SELECT COALESCE(AVG(total), 0)::INT FROM orders 
            WHERE created_at::DATE = CURRENT_DATE
        ),
        
        -- Order type breakdown
        'dine_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'dine-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'online_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'online' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'walk_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'walk-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        
        -- Alerts
        'delayed_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('pending', 'confirmed') 
            AND EXTRACT(EPOCH FROM (NOW() - created_at)) > 300
        ),
        'long_prep_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'preparing' 
            AND kitchen_started_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - kitchen_started_at)) > 900
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_orders_stats() TO authenticated;

-- =============================================
-- 4. Quick Status Update with Optimistic Support
-- Returns updated order for immediate UI refresh
-- =============================================
CREATE OR REPLACE FUNCTION update_order_status_quick(
    p_order_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    -- Get current employee (may be null for system updates)
    BEGIN
        emp_id := get_employee_id();
    EXCEPTION WHEN OTHERS THEN
        emp_id := NULL;
    END;

    -- Update order with timestamps based on status
    UPDATE orders
    SET 
        status = p_status::order_status,
        kitchen_started_at = CASE 
            WHEN p_status = 'preparing' AND kitchen_started_at IS NULL THEN NOW() 
            ELSE kitchen_started_at 
        END,
        kitchen_completed_at = CASE 
            WHEN p_status = 'ready' THEN NOW() 
            ELSE kitchen_completed_at 
        END,
        delivery_started_at = CASE 
            WHEN p_status = 'delivering' AND delivery_started_at IS NULL THEN NOW() 
            ELSE delivery_started_at 
        END,
        delivered_at = CASE 
            WHEN p_status = 'delivered' THEN NOW() 
            ELSE delivered_at 
        END,
        prepared_by = CASE 
            WHEN p_status IN ('preparing', 'ready') AND emp_id IS NOT NULL THEN emp_id 
            ELSE prepared_by 
        END,
        delivery_rider_id = CASE 
            WHEN p_status = 'delivering' AND emp_id IS NOT NULL THEN emp_id 
            ELSE delivery_rider_id 
        END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;

    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, p_status::order_status, emp_id, p_notes);

    -- Return success with key fields for UI update
    RETURN json_build_object(
        'success', true,
        'order_id', order_record.id,
        'new_status', p_status,
        'updated_at', order_record.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_order_status_quick(UUID, TEXT, TEXT) TO authenticated;

-- =============================================
-- 5. Get Available Delivery Riders
-- Returns delivery riders who are active and available
-- =============================================
CREATE OR REPLACE FUNCTION get_available_delivery_riders()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', e.id,
            'name', e.name,
            'phone', e.phone,
            'employee_id', e.employee_id,
            'avatar_url', e.avatar_url,
            'status', e.status,
            -- Count of current active deliveries
            'active_deliveries', (
                SELECT COUNT(*) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivering'
            ),
            -- Last delivery completed at
            'last_delivery_at', (
                SELECT MAX(delivered_at) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivered'
            ),
            -- Total deliveries today
            'deliveries_today', (
                SELECT COUNT(*) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivered'
                AND o.delivered_at::DATE = CURRENT_DATE
            )
        ) ORDER BY 
            -- Prioritize riders with fewer active deliveries
            (SELECT COUNT(*) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivering'),
            e.name
    ), '[]'::json) INTO result
    FROM employees e
    WHERE e.role::TEXT = 'delivery_rider'
      AND e.status = 'active'
      AND e.portal_enabled = true;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_delivery_riders() TO authenticated;

-- =============================================
-- 6. Assign Delivery Rider to Order
-- Only works when order status is 'ready' and order_type is 'online'
-- =============================================
CREATE OR REPLACE FUNCTION assign_delivery_rider(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSON AS $$
DECLARE
    order_record RECORD;
    rider_record RECORD;
BEGIN
    -- Get order
    SELECT * INTO order_record FROM orders WHERE id = p_order_id;
    
    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate order status (must be ready for delivery assignment)
    IF order_record.status != 'ready' THEN
        RETURN json_build_object('success', false, 'error', 'Order must be ready before assigning delivery rider');
    END IF;
    
    -- Validate order type (must be online order)
    IF order_record.order_type != 'online' THEN
        RETURN json_build_object('success', false, 'error', 'Only online orders can have delivery riders');
    END IF;
    
    -- Validate rider exists and is active delivery_rider
    SELECT * INTO rider_record FROM employees 
    WHERE id = p_rider_id 
      AND role::TEXT = 'delivery_rider' 
      AND status = 'active';
    
    IF rider_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or inactive delivery rider');
    END IF;
    
    -- Update order with delivery rider and change status to delivering
    UPDATE orders
    SET delivery_rider_id = p_rider_id,
        status = 'delivering',
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, 'delivering'::order_status, p_rider_id, 
            'Assigned to delivery rider: ' || rider_record.name);
    
    -- Create notification for rider
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (
        p_rider_id,
        'employee',
        'New Delivery Assignment',
        'Order #' || order_record.order_number || ' assigned to you for delivery',
        'order',
        json_build_object(
            'order_id', p_order_id,
            'order_number', order_record.order_number,
            'customer_name', order_record.customer_name,
            'customer_phone', order_record.customer_phone,
            'customer_address', order_record.customer_address
        )::jsonb
    );
    
    -- Return success with rider info
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'rider', json_build_object(
            'id', rider_record.id,
            'name', rider_record.name,
            'phone', rider_record.phone
        ),
        'new_status', 'delivering'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_delivery_rider(UUID, UUID) TO authenticated;

-- =============================================
-- Create indexes for better performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
-- Note: Removed idx_orders_created_date as DATE cast is not immutable
-- Use range queries instead: created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_number ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- =============================================
-- Enable realtime for orders if not already enabled
-- =============================================
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON FUNCTION get_orders_advanced IS 'Fetches orders with full details including customer, table, waiter, and delivery rider info. Supports pagination and filtering.';
COMMENT ON FUNCTION get_order_full_details IS 'Fetches complete order details with status history for order detail view.';
COMMENT ON FUNCTION get_orders_stats IS 'Real-time statistics for orders dashboard cards.';
COMMENT ON FUNCTION update_order_status_quick IS 'Fast status update with automatic timestamp management.';
