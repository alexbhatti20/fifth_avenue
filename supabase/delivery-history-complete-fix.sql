-- =============================================
-- DELIVERY HISTORY COMPLETE FIX
-- Ensures history is maintained when:
--   1. Admin assigns a rider to an order
--   2. Rider accepts an order
--   3. Rider completes delivery
--   4. Rider/Admin cancels delivery
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- DROP ALL EXISTING FUNCTIONS TO AVOID CONFLICTS
-- =============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all variations of these functions
    FOR r IN SELECT oid::regprocedure AS func_sig FROM pg_proc 
             WHERE proname IN ('accept_delivery_order', 'complete_delivery_order', 
                              'cancel_delivery_order', 'assign_delivery_rider',
                              'create_delivery_history_record')
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- =============================================
-- HELPER: CREATE DELIVERY HISTORY RECORD
-- Called by assign and accept functions
-- =============================================
CREATE OR REPLACE FUNCTION create_delivery_history_record(
    p_rider_id UUID,
    p_order_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get order details
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update delivery history
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
        delivery_status
    ) VALUES (
        p_rider_id,
        v_order.id,
        v_order.order_number,
        row_to_json(v_order)::jsonb,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.customer_address,
        v_order.customer_email,
        v_order.items,
        COALESCE(jsonb_array_length(v_order.items::jsonb), 0),
        COALESCE(v_order.subtotal, 0),
        COALESCE(v_order.delivery_fee, 0),
        COALESCE(v_order.total, 0),
        v_order.payment_method::TEXT,
        v_order.payment_status,
        NOW(),
        'accepted'
    )
    ON CONFLICT (rider_id, order_id) DO UPDATE SET
        order_snapshot = EXCLUDED.order_snapshot,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_address = EXCLUDED.customer_address,
        items = EXCLUDED.items,
        total = EXCLUDED.total,
        updated_at = NOW();
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating delivery history: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- ASSIGN DELIVERY RIDER (Admin assigns from Orders page)
-- Creates history record + updates order
-- =============================================
CREATE OR REPLACE FUNCTION assign_delivery_rider(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_rider RECORD;
BEGIN
    -- Validate rider
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = p_rider_id
      AND role = 'delivery_rider'
      AND status = 'active';
    
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive delivery rider');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.order_type != 'online' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only online orders can have delivery riders');
    END IF;
    
    IF v_order.status NOT IN ('ready', 'confirmed', 'preparing') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must be ready, confirmed or preparing to assign rider');
    END IF;
    
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != p_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Update order with rider assignment
    UPDATE orders
    SET 
        delivery_rider_id = p_rider_id,
        status = CASE WHEN status = 'ready' THEN 'delivering'::order_status ELSE status END,
        delivery_started_at = CASE WHEN status = 'ready' THEN NOW() ELSE delivery_started_at END,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create delivery history record
    PERFORM create_delivery_history_record(p_rider_id, p_order_id);
    
    -- Update history to 'delivering' if order was ready
    IF v_order.status = 'ready' THEN
        UPDATE delivery_history
        SET delivery_status = 'delivering',
            started_at = NOW(),
            updated_at = NOW()
        WHERE rider_id = p_rider_id AND order_id = p_order_id;
    END IF;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (
        p_order_id, 
        CASE WHEN v_order.status = 'ready' THEN 'delivering' ELSE v_order.status::TEXT END,
        'Assigned to rider: ' || v_rider.name,
        p_rider_id,
        NOW()
    );
    
    -- Create notification for rider
    INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
    VALUES (
        'employee',
        p_rider_id,
        '🚴 New Delivery Assigned!',
        'Order #' || v_order.order_number || ' - ' || v_order.customer_name || ' - Rs. ' || v_order.total,
        'delivery_assigned',
        p_order_id,
        FALSE,
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'rider', jsonb_build_object(
            'id', v_rider.id,
            'name', v_rider.name,
            'phone', v_rider.phone
        ),
        'message', 'Rider assigned successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- ACCEPT DELIVERY ORDER (Rider self-accepts)
-- For when rider picks from available orders
-- =============================================
CREATE OR REPLACE FUNCTION accept_delivery_order(
    p_order_id UUID,
    p_rider_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_rider RECORD;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate rider
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = v_rider_id
      AND role = 'delivery_rider'
      AND status = 'active';
    
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not a valid delivery rider');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status != 'ready' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for delivery');
    END IF;
    
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        delivery_rider_id = v_rider_id,
        status = 'delivering'::order_status,
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create delivery history record
    PERFORM create_delivery_history_record(v_rider_id, p_order_id);
    
    -- Update to delivering status
    UPDATE delivery_history
    SET delivery_status = 'delivering',
        started_at = NOW(),
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivering', 'Accepted by rider: ' || v_rider.name, v_rider_id, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'order', jsonb_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'customer_address', v_order.customer_address,
            'total', v_order.total,
            'payment_method', v_order.payment_method
        ),
        'rider', jsonb_build_object(
            'id', v_rider.id,
            'name', v_rider.name,
            'phone', v_rider.phone
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- COMPLETE DELIVERY ORDER
-- Marks order as delivered, updates history
-- =============================================
CREATE OR REPLACE FUNCTION complete_delivery_order(
    p_order_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_rider_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_delivery_minutes INT;
    v_history_exists BOOLEAN;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status NOT IN ('delivering'::order_status) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not in delivering status. Current: ' || v_order.status::TEXT);
    END IF;
    
    IF v_order.delivery_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No rider assigned to this order');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Calculate delivery time from order's delivery_started_at
    IF v_order.delivery_started_at IS NOT NULL THEN
        v_delivery_minutes := EXTRACT(EPOCH FROM (NOW() - v_order.delivery_started_at)) / 60;
    ELSE
        v_delivery_minutes := 0;
    END IF;
    
    -- Update order to delivered
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Check if history exists
    SELECT EXISTS(
        SELECT 1 FROM delivery_history 
        WHERE rider_id = v_rider_id AND order_id = p_order_id
    ) INTO v_history_exists;
    
    -- Create history if it doesn't exist (for orders assigned by admin before this fix)
    IF NOT v_history_exists THEN
        PERFORM create_delivery_history_record(v_rider_id, p_order_id);
    END IF;
    
    -- Update delivery history
    UPDATE delivery_history
    SET 
        delivered_at = NOW(),
        delivery_status = 'delivered',
        actual_delivery_minutes = v_delivery_minutes,
        delivery_notes = p_notes,
        started_at = COALESCE(started_at, v_order.delivery_started_at),
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivered', COALESCE(p_notes, 'Delivery completed'), v_rider_id, NOW());
    
    -- Create notification for customer
    IF v_order.customer_id IS NOT NULL THEN
        INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
        VALUES (
            'customer',
            v_order.customer_id,
            '📦 Order Delivered!',
            'Your order #' || v_order.order_number || ' has been delivered. Enjoy your meal!',
            'order_delivered',
            p_order_id,
            FALSE,
            NOW()
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'delivery_minutes', v_delivery_minutes,
        'message', 'Delivery completed successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- CANCEL DELIVERY ORDER
-- Cancels delivery, updates history, returns to queue
-- =============================================
CREATE OR REPLACE FUNCTION cancel_delivery_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_rider_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_history_exists BOOLEAN;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Update order - back to ready status
    UPDATE orders
    SET 
        status = 'ready',
        delivery_rider_id = NULL,
        delivery_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Check if history exists
    SELECT EXISTS(
        SELECT 1 FROM delivery_history 
        WHERE rider_id = v_rider_id AND order_id = p_order_id
    ) INTO v_history_exists;
    
    -- Update history if exists
    IF v_history_exists THEN
        UPDATE delivery_history
        SET 
            cancelled_at = NOW(),
            delivery_status = 'cancelled',
            delivery_notes = p_reason,
            updated_at = NOW()
        WHERE rider_id = v_rider_id AND order_id = p_order_id;
    END IF;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'ready', 'Delivery cancelled: ' || COALESCE(p_reason, 'No reason provided'), v_rider_id, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'message', 'Delivery cancelled. Order is back in queue.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
GRANT EXECUTE ON FUNCTION create_delivery_history_record(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_delivery_rider(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_delivery_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_delivery_order(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_delivery_order(UUID, TEXT, UUID) TO authenticated;

-- Also grant to anon for API calls
GRANT EXECUTE ON FUNCTION assign_delivery_rider(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION accept_delivery_order(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION complete_delivery_order(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION cancel_delivery_order(UUID, TEXT, UUID) TO anon;

-- =============================================
-- BACKFILL EXISTING ORDERS INTO DELIVERY HISTORY
-- For orders that were assigned before this fix
-- =============================================
DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
    v_order_status TEXT;
BEGIN
    -- Find all online orders with assigned riders that don't have history
    FOR r IN 
        SELECT o.id AS order_id, o.delivery_rider_id AS rider_id
        FROM orders o
        WHERE o.order_type = 'online'
          AND o.delivery_rider_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM delivery_history dh 
              WHERE dh.order_id = o.id AND dh.rider_id = o.delivery_rider_id
          )
    LOOP
        PERFORM create_delivery_history_record(r.rider_id, r.order_id);
        
        -- Get order status as text
        SELECT status::TEXT INTO v_order_status FROM orders WHERE id = r.order_id;
        
        -- Update status based on order status
        UPDATE delivery_history
        SET delivery_status = CASE 
                WHEN v_order_status = 'delivered' THEN 'delivered'
                WHEN v_order_status = 'cancelled' THEN 'cancelled'
                WHEN v_order_status = 'delivering' THEN 'delivering'
                ELSE 'accepted'
            END,
            delivered_at = (SELECT delivered_at FROM orders WHERE id = r.order_id),
            started_at = (SELECT delivery_started_at FROM orders WHERE id = r.order_id),
            updated_at = NOW()
        WHERE rider_id = r.rider_id AND order_id = r.order_id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Backfilled % delivery history records', v_count;
END $$;

-- =============================================
-- ADD COMMENTS
-- =============================================
COMMENT ON FUNCTION create_delivery_history_record IS 'Helper function to create a delivery history record for an order';
COMMENT ON FUNCTION assign_delivery_rider IS 'Admin assigns a delivery rider to an order (creates history)';
COMMENT ON FUNCTION accept_delivery_order IS 'Rider self-accepts an available order (creates history)';
COMMENT ON FUNCTION complete_delivery_order IS 'Marks delivery as completed (updates history with delivery time)';
COMMENT ON FUNCTION cancel_delivery_order IS 'Cancels delivery and returns order to queue (updates history)';

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Delivery history functions updated successfully!';
    RAISE NOTICE '✅ All existing orders backfilled into delivery_history';
    RAISE NOTICE '📋 Functions: assign_delivery_rider, accept_delivery_order, complete_delivery_order, cancel_delivery_order';
END $$;
