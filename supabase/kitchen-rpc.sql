-- =============================================
-- KITCHEN DISPLAY SYSTEM (KDS) OPTIMIZED RPC FUNCTIONS
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing function to recreate with better structure
DROP FUNCTION IF EXISTS get_kitchen_orders_v2();

-- =============================================
-- Optimized Kitchen Orders RPC
-- Returns active orders for kitchen display:
-- - Dine-in orders: confirmed (auto-confirmed on creation) + preparing
-- - Online orders: confirmed (after payment verification) + preparing
-- - All 'ready' orders within last 30 minutes
-- NOTE: 'pending' online orders are NOT shown - they need confirmation first
-- =============================================
CREATE OR REPLACE FUNCTION get_kitchen_orders_v2()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(order_data ORDER BY priority, created_at) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'table_number', o.table_number,
                'items', o.items,
                'status', o.status,
                'notes', o.notes,
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'subtotal', o.subtotal,
                'total', o.total,
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'created_at', o.created_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                -- Waiter info
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', e.id, 'name', e.name)
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                -- Table details for dine-in orders
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'current_customers', rt.current_customers,
                        'assigned_waiter', CASE WHEN rt.assigned_waiter_id IS NOT NULL THEN (
                            SELECT json_build_object('id', ew.id, 'name', ew.name)
                            FROM employees ew WHERE ew.id = rt.assigned_waiter_id
                        ) ELSE NULL END
                    )
                    FROM restaurant_tables rt WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                -- Priority: confirmed > preparing > ready, older first
                'priority', CASE o.status 
                    WHEN 'confirmed' THEN 1
                    WHEN 'preparing' THEN 2
                    WHEN 'ready' THEN 3
                    ELSE 4
                END,
                -- Time calculations
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'prep_elapsed_seconds', CASE 
                    WHEN o.kitchen_started_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at))::INT 
                    ELSE NULL 
                END,
                -- Item count for quick view
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                )
            ) AS order_data,
            CASE o.status 
                WHEN 'confirmed' THEN 1
                WHEN 'preparing' THEN 2
                WHEN 'ready' THEN 3
                ELSE 4
            END AS priority,
            o.created_at
        FROM orders o
        WHERE o.created_at >= CURRENT_DATE
          AND (
              -- Show confirmed and preparing orders
              o.status IN ('confirmed', 'preparing')
              -- Show ready orders only for last 30 minutes
              OR (o.status = 'ready' AND o.kitchen_completed_at >= NOW() - INTERVAL '30 minutes')
          )
          -- Exclude cancelled orders
          AND o.status != 'cancelled'
    ) sub;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kitchen_orders_v2() TO authenticated;

-- =============================================
-- Get single order details for kitchen (with full table info)
-- =============================================
CREATE OR REPLACE FUNCTION get_kitchen_order_detail(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_type', o.order_type,
        'table_number', o.table_number,
        'items', o.items,
        'status', o.status,
        'notes', o.notes,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_email', o.customer_email,
        'customer_address', o.customer_address,
        'subtotal', o.subtotal,
        'discount', o.discount,
        'tax', o.tax,
        'delivery_fee', o.delivery_fee,
        'total', o.total,
        'payment_method', o.payment_method,
        'payment_status', o.payment_status,
        'created_at', o.created_at,
        'kitchen_started_at', o.kitchen_started_at,
        'kitchen_completed_at', o.kitchen_completed_at,
        'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
            SELECT json_build_object('id', e.id, 'name', e.name, 'phone', e.phone)
            FROM employees e WHERE e.id = o.waiter_id
        ) ELSE NULL END,
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
            FROM restaurant_tables rt WHERE rt.table_number = o.table_number
            LIMIT 1
        ) ELSE NULL END,
        'status_history', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'status', sh.status,
                    'changed_at', sh.changed_at,
                    'changed_by', (SELECT name FROM employees WHERE id = sh.changed_by)
                ) ORDER BY sh.changed_at DESC
            ), '[]'::json)
            FROM order_status_history sh WHERE sh.order_id = o.id
        )
    ) INTO result
    FROM orders o
    WHERE o.id = p_order_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kitchen_order_detail(UUID) TO authenticated;

-- =============================================
-- Update order status from kitchen with notification
-- =============================================
CREATE OR REPLACE FUNCTION update_kitchen_order_status(
    p_order_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
    result JSON;
BEGIN
    -- Get current employee
    emp_id := get_employee_id();
    
    -- Update order
    UPDATE orders
    SET status = p_status::order_status,
        prepared_by = emp_id,
        kitchen_started_at = CASE WHEN p_status = 'preparing' THEN NOW() ELSE kitchen_started_at END,
        kitchen_completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE kitchen_completed_at END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;
    
    IF order_record IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Insert status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, p_status::order_status, emp_id);
    
    -- Create notification for waiter if order is ready
    IF p_status = 'ready' AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, user_type, title, message, type, data)
        VALUES (
            order_record.waiter_id,
            'employee',
            'Order Ready',
            'Order #' || order_record.order_number || ' is ready for pickup',
            'order',
            json_build_object(
                'order_id', order_record.id,
                'order_number', order_record.order_number,
                'table_number', order_record.table_number
            )::jsonb
        );
    END IF;
    
    -- Return updated order
    result := json_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', p_status,
        'updated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_kitchen_order_status(UUID, TEXT) TO authenticated;

-- =============================================
-- Get kitchen stats
-- =============================================
CREATE OR REPLACE FUNCTION get_kitchen_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        -- Pending online orders (waiting for confirmation from Orders page)
        'pending_count', (SELECT COUNT(*) FROM orders WHERE status = 'pending' AND created_at >= CURRENT_DATE),
        -- Confirmed orders (ready to start preparing)
        'confirmed_count', (SELECT COUNT(*) FROM orders WHERE status = 'confirmed' AND created_at >= CURRENT_DATE),
        -- Currently being prepared
        'preparing_count', (SELECT COUNT(*) FROM orders WHERE status = 'preparing' AND created_at >= CURRENT_DATE),
        -- Ready for pickup/delivery (last 30 mins)
        'ready_count', (SELECT COUNT(*) FROM orders WHERE status = 'ready' AND kitchen_completed_at >= NOW() - INTERVAL '30 minutes'),
        -- Total orders today
        'total_today', (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE),
        -- Completed today
        'completed_today', (SELECT COUNT(*) FROM orders WHERE status IN ('delivered', 'ready') AND created_at >= CURRENT_DATE),
        -- Average prep time in minutes
        'avg_prep_time_mins', (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (kitchen_completed_at - kitchen_started_at)) / 60)::numeric, 1)
            FROM orders 
            WHERE kitchen_started_at IS NOT NULL 
                AND kitchen_completed_at IS NOT NULL 
                AND created_at >= CURRENT_DATE
        ),
        -- Orders in last hour
        'orders_this_hour', (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '1 hour'),
        -- Active kitchen orders (what kitchen sees: confirmed + preparing)
        'active_kitchen_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('confirmed', 'preparing') 
            AND created_at >= CURRENT_DATE
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kitchen_stats() TO authenticated;

-- =============================================
-- FIX: Update create_dine_in_order to auto-confirm
-- Dine-in orders should be 'confirmed' immediately
-- Online orders stay 'pending' until payment verification
-- =============================================
CREATE OR REPLACE FUNCTION create_dine_in_order(
    p_table_id UUID,
    p_customer_count INTEGER,
    p_items JSONB,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_phone VARCHAR(20) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_send_confirmation BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_order_id UUID;
    table_num INTEGER;
    calculated_subtotal DECIMAL(10, 2);
    calculated_total DECIMAL(10, 2);
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    -- Check if waiter can take orders
    IF NOT can_take_orders() THEN
        RAISE EXCEPTION 'Not authorized to take orders';
    END IF;
    
    -- Get table number
    SELECT table_number INTO table_num FROM restaurant_tables WHERE id = p_table_id;
    
    -- Calculate totals from items
    SELECT COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INTEGER), 0)
    INTO calculated_subtotal
    FROM jsonb_array_elements(p_items) as item;
    
    calculated_total := calculated_subtotal; -- Add tax/delivery logic if needed
    
    -- Create order with AUTO-CONFIRMED status for dine-in
    INSERT INTO orders (
        customer_id, customer_name, customer_phone,
        order_type, items, subtotal, total,
        payment_method, table_number, notes,
        waiter_id, assigned_to, can_cancel_until,
        status  -- Explicitly set status to confirmed
    ) VALUES (
        p_customer_id,
        COALESCE(p_customer_name, 'Walk-in Customer'),
        COALESCE(p_customer_phone, ''),
        'dine-in',
        p_items,
        calculated_subtotal,
        calculated_total,
        'cash',
        table_num,
        p_notes,
        emp_id,
        emp_id,
        NOW() + INTERVAL '5 minutes',
        'confirmed'  -- Auto-confirmed for dine-in orders
    ) RETURNING id INTO new_order_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (new_order_id, 'confirmed'::order_status, emp_id, 'Auto-confirmed dine-in order');
    
    -- Update table
    UPDATE restaurant_tables
    SET status = 'occupied',
        current_order_id = new_order_id,
        current_customers = p_customer_count,
        assigned_waiter_id = emp_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Update employee stats
    UPDATE employees
    SET total_orders_taken = total_orders_taken + 1,
        updated_at = NOW()
    WHERE id = emp_id;
    
    -- Insert table history
    INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
    VALUES (p_table_id, new_order_id, emp_id, p_customer_count, NOW());
    
    RETURN json_build_object(
        'success', true,
        'order_id', new_order_id,
        'order_number', (SELECT order_number FROM orders WHERE id = new_order_id),
        'status', 'confirmed',
        'send_confirmation', p_send_confirmation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_dine_in_order(UUID, INTEGER, JSONB, UUID, VARCHAR, VARCHAR, TEXT, BOOLEAN) TO authenticated;
