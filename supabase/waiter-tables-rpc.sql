-- =============================================
-- WAITER TABLES & ORDER RPC FUNCTIONS
-- Advanced, Fast, Production-Ready
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- DROP EXISTING FUNCTIONS TO AVOID CONFLICTS
-- =============================================
DROP FUNCTION IF EXISTS claim_table_for_waiter(UUID);
DROP FUNCTION IF EXISTS get_tables_for_waiter();
DROP FUNCTION IF EXISTS lookup_customer(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_waiter_dine_in_order(UUID, JSONB, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_waiter_order_history(DATE, INT, INT);
DROP FUNCTION IF EXISTS release_table(UUID);
DROP FUNCTION IF EXISTS release_table(UUID, DECIMAL);
DROP FUNCTION IF EXISTS release_table(UUID, DECIMAL(10,2));
DROP FUNCTION IF EXISTS release_table(UUID, NUMERIC);
DROP FUNCTION IF EXISTS get_menu_for_ordering();
DROP FUNCTION IF EXISTS add_items_to_order(UUID, JSONB);

-- =============================================
-- 1. WAITER ORDER HISTORY TABLE
-- Stores complete order history for each waiter
-- =============================================

-- Drop if exists for clean slate
DROP TABLE IF EXISTS waiter_order_history CASCADE;

CREATE TABLE waiter_order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Waiter reference
    waiter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Order reference
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    
    -- Table info
    table_id UUID REFERENCES restaurant_tables(id),
    table_number INT,
    
    -- Customer details
    customer_id UUID REFERENCES customers(id),
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    customer_count INT DEFAULT 1,
    is_registered_customer BOOLEAN DEFAULT false,
    
    -- Order snapshot
    items JSONB NOT NULL,
    total_items INT DEFAULT 0,
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Payment info
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Invoice
    invoice_number TEXT,
    
    -- Timestamps
    order_taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    order_confirmed_at TIMESTAMPTZ,
    order_completed_at TIMESTAMPTZ,
    
    -- Status
    order_status TEXT DEFAULT 'pending',
    
    -- Email tracking
    confirmation_email_sent BOOLEAN DEFAULT false,
    confirmation_email_sent_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(waiter_id, order_id)
);

-- Create indexes
CREATE INDEX idx_waiter_history_waiter ON waiter_order_history(waiter_id);
CREATE INDEX idx_waiter_history_order ON waiter_order_history(order_id);
CREATE INDEX idx_waiter_history_table ON waiter_order_history(table_id);
CREATE INDEX idx_waiter_history_date ON waiter_order_history(order_taken_at DESC);
CREATE INDEX idx_waiter_history_waiter_date ON waiter_order_history(waiter_id, order_taken_at DESC);

-- Enable RLS
ALTER TABLE waiter_order_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "waiter_history_select"
    ON waiter_order_history FOR SELECT
    TO authenticated
    USING (
        waiter_id = get_employee_id() OR 
        EXISTS (
            SELECT 1 FROM employees e 
            WHERE e.id = get_employee_id() 
            AND e.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "waiter_history_insert"
    ON waiter_order_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "waiter_history_update"
    ON waiter_order_history FOR UPDATE
    TO authenticated
    USING (waiter_id = get_employee_id())
    WITH CHECK (waiter_id = get_employee_id());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON waiter_order_history TO authenticated;

-- Enable realtime
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE waiter_order_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. CLAIM TABLE RPC (FAST)
-- First waiter to click claims the table
-- Atomic transaction with race condition handling
-- =============================================

CREATE OR REPLACE FUNCTION claim_table_for_waiter(
    p_table_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    v_waiter_record RECORD;
    v_table_record RECORD;
BEGIN
    -- Get current waiter
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate waiter role
    SELECT * INTO v_waiter_record FROM employees 
    WHERE id = v_waiter_id 
      AND role IN ('waiter', 'admin', 'manager')
      AND status = 'active'
      AND portal_enabled = true;
    
    IF v_waiter_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as waiter');
    END IF;
    
    -- Get and lock the table (FOR UPDATE NOWAIT fails immediately if locked)
    BEGIN
        SELECT * INTO v_table_record FROM restaurant_tables 
        WHERE id = p_table_id
        FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
        RETURN json_build_object('success', false, 'error', 'Table is being claimed by another waiter');
    END;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Check if table is available
    IF v_table_record.status != 'available' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Table is not available. Current status: ' || v_table_record.status
        );
    END IF;
    
    -- Check if already assigned to another waiter
    IF v_table_record.assigned_waiter_id IS NOT NULL AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table already assigned to another waiter');
    END IF;
    
    -- Claim the table
    UPDATE restaurant_tables
    SET 
        assigned_waiter_id = v_waiter_id,
        status = 'occupied',
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table_record.table_number,
        'capacity', v_table_record.capacity,
        'waiter', json_build_object(
            'id', v_waiter_record.id,
            'name', v_waiter_record.name
        ),
        'claimed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_table_for_waiter(UUID) TO authenticated;

-- =============================================
-- 3. GET TABLES FOR WAITER (FAST)
-- Returns all tables with waiter-specific info
-- =============================================

CREATE OR REPLACE FUNCTION get_tables_for_waiter()
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    result JSON;
BEGIN
    v_waiter_id := get_employee_id();
    
    SELECT json_build_object(
        'success', true,
        'tables', COALESCE(json_agg(
            json_build_object(
                'id', t.id,
                'table_number', t.table_number,
                'capacity', t.capacity,
                'section', t.section,
                'floor', t.floor,
                'status', t.status,
                'current_customers', t.current_customers,
                'current_order_id', t.current_order_id,
                'assigned_waiter_id', t.assigned_waiter_id,
                'is_my_table', t.assigned_waiter_id = v_waiter_id,
                'assigned_waiter', CASE WHEN t.assigned_waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', e.id, 'name', e.name)
                    FROM employees e WHERE e.id = t.assigned_waiter_id
                ) ELSE NULL END,
                'current_order', CASE WHEN t.current_order_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', o.id,
                        'order_number', o.order_number,
                        'status', o.status,
                        'total', o.total,
                        'items_count', jsonb_array_length(o.items),
                        'created_at', o.created_at
                    )
                    FROM orders o WHERE o.id = t.current_order_id
                ) ELSE NULL END,
                'reserved_by', t.reserved_by,
                'reservation_time', t.reservation_time,
                'updated_at', t.updated_at
            ) ORDER BY t.table_number
        ), '[]'::json),
        'my_tables_count', (
            SELECT COUNT(*) FROM restaurant_tables 
            WHERE assigned_waiter_id = v_waiter_id AND status = 'occupied'
        ),
        'available_count', (
            SELECT COUNT(*) FROM restaurant_tables WHERE status = 'available'
        ),
        'total_count', (SELECT COUNT(*) FROM restaurant_tables)
    ) INTO result
    FROM restaurant_tables t;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_tables_for_waiter() TO authenticated;

-- =============================================
-- 4. LOOKUP CUSTOMER BY PHONE/EMAIL
-- Checks if customer is registered online
-- =============================================

CREATE OR REPLACE FUNCTION lookup_customer(
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Search by phone first, then email, then name
    SELECT * INTO v_customer FROM customers
    WHERE 
        (p_phone IS NOT NULL AND phone = p_phone) OR
        (p_email IS NOT NULL AND email = p_email) OR
        (p_name IS NOT NULL AND LOWER(name) = LOWER(p_name))
    ORDER BY 
        CASE WHEN phone = p_phone THEN 0 ELSE 1 END,
        CASE WHEN email = p_email THEN 0 ELSE 1 END
    LIMIT 1;
    
    IF v_customer IS NULL THEN
        RETURN json_build_object(
            'found', false,
            'message', 'Customer not found in system'
        );
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'customer', json_build_object(
            'id', v_customer.id,
            'name', v_customer.name,
            'phone', v_customer.phone,
            'email', v_customer.email,
            'address', v_customer.address,
            'loyalty_points', v_customer.loyalty_points,
            'total_orders', v_customer.total_orders,
            'is_verified', v_customer.is_verified,
            'created_at', v_customer.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION lookup_customer(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- 5. CREATE DINE-IN ORDER (ADVANCED)
-- Creates order with full waiter history tracking
-- =============================================

CREATE OR REPLACE FUNCTION create_waiter_dine_in_order(
    p_table_id UUID,
    p_items JSONB,
    p_customer_count INT DEFAULT 1,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash',
    p_send_email BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    v_waiter_record RECORD;
    v_table_record RECORD;
    v_customer_record RECORD;
    v_new_order_id UUID;
    v_order_number TEXT;
    v_invoice_number TEXT;
    v_subtotal DECIMAL(10, 2);
    v_tax DECIMAL(10, 2);
    v_total DECIMAL(10, 2);
    v_total_items INT;
    v_history_id UUID;
    v_is_registered BOOLEAN := false;
BEGIN
    -- Get current waiter
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate waiter
    SELECT * INTO v_waiter_record FROM employees 
    WHERE id = v_waiter_id 
      AND role IN ('waiter', 'admin', 'manager')
      AND status = 'active';
    
    IF v_waiter_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as waiter');
    END IF;
    
    -- Get table
    SELECT * INTO v_table_record FROM restaurant_tables 
    WHERE id = p_table_id
    FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Validate table is assigned to this waiter or available
    IF v_table_record.assigned_waiter_id IS NOT NULL 
       AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table is assigned to another waiter');
    END IF;
    
    -- If customer details provided, look up registered customer
    IF p_customer_phone IS NOT NULL OR p_customer_email IS NOT NULL THEN
        SELECT * INTO v_customer_record FROM customers
        WHERE 
            (p_customer_phone IS NOT NULL AND phone = p_customer_phone) OR
            (p_customer_email IS NOT NULL AND email = p_customer_email)
        LIMIT 1;
        
        IF v_customer_record IS NOT NULL THEN
            v_is_registered := true;
            -- Use registered customer details
            p_customer_id := v_customer_record.id;
            p_customer_name := COALESCE(p_customer_name, v_customer_record.name);
            p_customer_email := COALESCE(p_customer_email, v_customer_record.email);
            p_customer_phone := COALESCE(p_customer_phone, v_customer_record.phone);
        END IF;
    END IF;
    
    -- Calculate totals
    SELECT 
        COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT), 0)
    INTO v_subtotal, v_total_items
    FROM jsonb_array_elements(p_items) AS item;
    
    v_tax := ROUND(v_subtotal * 0.05, 2); -- 5% tax
    v_total := v_subtotal + v_tax;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM orders WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Create order
    INSERT INTO orders (
        customer_id, customer_name, customer_phone, customer_email,
        order_type, status, items, 
        subtotal, tax, total,
        payment_method, payment_status,
        table_number, notes,
        waiter_id, assigned_to,
        can_cancel_until
    ) VALUES (
        p_customer_id,
        COALESCE(p_customer_name, 'Walk-in Customer'),
        p_customer_phone,
        p_customer_email,
        'dine-in',
        'confirmed',
        p_items,
        v_subtotal,
        v_tax,
        v_total,
        p_payment_method,
        CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_table_record.table_number,
        p_notes,
        v_waiter_id,
        v_waiter_id,
        NOW() + INTERVAL '5 minutes'
    )
    RETURNING id, order_number INTO v_new_order_id, v_order_number;
    
    -- Update table
    UPDATE restaurant_tables
    SET 
        status = 'occupied',
        current_order_id = v_new_order_id,
        current_customers = p_customer_count,
        assigned_waiter_id = v_waiter_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Insert into waiter history
    INSERT INTO waiter_order_history (
        waiter_id, order_id, order_number,
        table_id, table_number,
        customer_id, customer_name, customer_phone, customer_email, customer_count,
        is_registered_customer,
        items, total_items, subtotal, tax, total,
        payment_method, payment_status,
        invoice_number,
        order_status, order_confirmed_at
    ) VALUES (
        v_waiter_id, v_new_order_id, v_order_number,
        p_table_id, v_table_record.table_number,
        p_customer_id, p_customer_name, p_customer_phone, p_customer_email, p_customer_count,
        v_is_registered,
        p_items, v_total_items, v_subtotal, v_tax, v_total,
        p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_invoice_number,
        'confirmed', NOW()
    )
    RETURNING id INTO v_history_id;
    
    -- Insert into table_history if exists
    BEGIN
        INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
        VALUES (p_table_id, v_new_order_id, v_waiter_id, p_customer_count, NOW());
    EXCEPTION WHEN undefined_table THEN
        NULL; -- Table history doesn't exist, skip
    END;
    
    -- Add to order status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (v_new_order_id, 'confirmed'::order_status, v_waiter_id, 'Order created by waiter');
    
    -- Update employee stats
    UPDATE employees
    SET 
        total_orders_taken = COALESCE(total_orders_taken, 0) + 1,
        updated_at = NOW()
    WHERE id = v_waiter_id;
    
    -- Update customer stats if registered
    IF v_is_registered AND p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET 
            total_orders = COALESCE(total_orders, 0) + 1,
            total_spent = COALESCE(total_spent, 0) + v_total,
            loyalty_points = COALESCE(loyalty_points, 0) + FLOOR(v_total / 10),
            updated_at = NOW()
        WHERE id = p_customer_id;
    END IF;
    
    -- Create notification for kitchen
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    SELECT 
        e.id, 'employee', 'New Dine-in Order',
        'Order #' || v_order_number || ' - Table ' || v_table_record.table_number,
        'order',
        jsonb_build_object(
            'order_id', v_new_order_id,
            'order_number', v_order_number,
            'table_number', v_table_record.table_number,
            'items_count', v_total_items
        )
    FROM employees e
    WHERE e.role IN ('kitchen_staff', 'admin', 'manager')
      AND e.status = 'active'
      AND e.portal_enabled = true;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'order_id', v_new_order_id,
        'order_number', v_order_number,
        'invoice_number', v_invoice_number,
        'history_id', v_history_id,
        'table', json_build_object(
            'id', p_table_id,
            'table_number', v_table_record.table_number
        ),
        'customer', json_build_object(
            'id', p_customer_id,
            'name', p_customer_name,
            'email', p_customer_email,
            'phone', p_customer_phone,
            'is_registered', v_is_registered
        ),
        'order', json_build_object(
            'subtotal', v_subtotal,
            'tax', v_tax,
            'total', v_total,
            'items_count', v_total_items,
            'payment_method', p_payment_method
        ),
        'send_email', p_send_email AND p_customer_email IS NOT NULL,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_waiter_dine_in_order(UUID, JSONB, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- =============================================
-- 6. GET WAITER ORDER HISTORY
-- Returns waiter's own order history with stats
-- =============================================

CREATE OR REPLACE FUNCTION get_waiter_order_history(
    p_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    result JSON;
    total_count INT;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Count total
    SELECT COUNT(*) INTO total_count
    FROM waiter_order_history h
    WHERE h.waiter_id = v_waiter_id
      AND (p_date IS NULL OR h.order_taken_at::DATE = p_date);
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'history', COALESCE(json_agg(
            json_build_object(
                'id', h.id,
                'order_id', h.order_id,
                'order_number', h.order_number,
                'invoice_number', h.invoice_number,
                'table_number', h.table_number,
                'customer_name', h.customer_name,
                'customer_phone', h.customer_phone,
                'is_registered_customer', h.is_registered_customer,
                'customer_count', h.customer_count,
                'items', h.items,
                'total_items', h.total_items,
                'subtotal', h.subtotal,
                'tax', h.tax,
                'total', h.total,
                'tip_amount', h.tip_amount,
                'payment_method', h.payment_method,
                'payment_status', h.payment_status,
                'order_status', h.order_status,
                'order_taken_at', h.order_taken_at,
                'order_completed_at', h.order_completed_at
            ) ORDER BY h.order_taken_at DESC
        ), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count,
        'stats', (
            SELECT json_build_object(
                'total_orders', COUNT(*),
                'orders_today', COUNT(*) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE),
                'orders_this_week', COUNT(*) FILTER (WHERE order_taken_at >= CURRENT_DATE - INTERVAL '7 days'),
                'total_sales', COALESCE(SUM(total), 0),
                'sales_today', COALESCE(SUM(total) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0),
                'total_tips', COALESCE(SUM(tip_amount), 0),
                'tips_today', COALESCE(SUM(tip_amount) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0),
                'avg_order_value', ROUND(AVG(total), 2),
                'total_customers', COALESCE(SUM(customer_count), 0),
                'customers_today', COALESCE(SUM(customer_count) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0)
            )
            FROM waiter_order_history WHERE waiter_id = v_waiter_id
        )
    ) INTO result
    FROM waiter_order_history h
    WHERE h.waiter_id = v_waiter_id
      AND (p_date IS NULL OR h.order_taken_at::DATE = p_date)
    LIMIT p_limit
    OFFSET p_offset;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_waiter_order_history(DATE, INT, INT) TO authenticated;

-- =============================================
-- 7. RELEASE TABLE
-- Waiter releases table after billing
-- =============================================

CREATE OR REPLACE FUNCTION release_table(
    p_table_id UUID,
    p_tip_amount DECIMAL(10, 2) DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    v_table_record RECORD;
    v_order_id UUID;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get table
    SELECT * INTO v_table_record FROM restaurant_tables 
    WHERE id = p_table_id FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Validate ownership
    IF v_table_record.assigned_waiter_id != v_waiter_id THEN
        -- Check if manager/admin
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_waiter_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to release this table');
        END IF;
    END IF;
    
    v_order_id := v_table_record.current_order_id;
    
    -- Update order to delivered/completed
    IF v_order_id IS NOT NULL THEN
        UPDATE orders
        SET 
            status = 'delivered',
            payment_status = 'paid',
            updated_at = NOW()
        WHERE id = v_order_id;
        
        -- Add to order status history
        INSERT INTO order_status_history (order_id, status, changed_by, notes)
        VALUES (v_order_id, 'delivered'::order_status, v_waiter_id, 'Table released, bill paid');
        
        -- Update waiter history
        UPDATE waiter_order_history
        SET 
            order_status = 'completed',
            order_completed_at = NOW(),
            payment_status = 'paid',
            tip_amount = p_tip_amount,
            updated_at = NOW()
        WHERE order_id = v_order_id AND waiter_id = v_waiter_id;
    END IF;
    
    -- Update table_history if exists
    BEGIN
        UPDATE table_history
        SET 
            closed_at = NOW(),
            total_bill = (SELECT total FROM orders WHERE id = v_order_id),
            tip_amount = p_tip_amount
        WHERE table_id = p_table_id AND order_id = v_order_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;
    
    -- Release the table
    UPDATE restaurant_tables
    SET 
        status = 'cleaning',
        current_order_id = NULL,
        current_customers = 0,
        assigned_waiter_id = NULL,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Update waiter tips
    IF p_tip_amount > 0 THEN
        UPDATE employees
        SET 
            total_tips = COALESCE(total_tips, 0) + p_tip_amount,
            updated_at = NOW()
        WHERE id = v_waiter_id;
        
        -- Insert into waiter_tips if exists
        BEGIN
            INSERT INTO waiter_tips (waiter_id, order_id, tip_amount, date)
            VALUES (v_waiter_id, v_order_id, p_tip_amount, CURRENT_DATE)
            ON CONFLICT (waiter_id, date) DO UPDATE
            SET tip_amount = waiter_tips.tip_amount + p_tip_amount;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table_record.table_number,
        'order_id', v_order_id,
        'tip_amount', p_tip_amount,
        'new_status', 'cleaning',
        'message', 'Table released successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION release_table(UUID, DECIMAL) TO authenticated;

-- =============================================
-- 8. GET MENU ITEMS FOR ORDERING
-- Returns all active menu items with deals
-- =============================================

CREATE OR REPLACE FUNCTION get_menu_for_ordering()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'categories', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'icon', c.icon,
                    'items_count', (
                        SELECT COUNT(*) FROM menu_items m 
                        WHERE m.category_id = c.id AND m.status = 'available'
                    )
                ) ORDER BY c.display_order, c.name
            ), '[]'::json)
            FROM categories c WHERE c.status = 'active'
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'slug', m.slug,
                    'description', m.description,
                    'price', m.price,
                    'category_id', m.category_id,
                    'category_name', c.name,
                    'image_url', m.image_url,
                    'status', m.status,
                    'is_featured', m.is_featured,
                    'spicy_level', m.spicy_level,
                    'is_vegetarian', m.is_vegetarian,
                    'prep_time', m.prep_time
                ) ORDER BY m.name
            ), '[]'::json)
            FROM menu_items m
            JOIN categories c ON c.id = m.category_id
            WHERE m.status = 'available'
        ),
        'deals', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', d.id,
                    'name', d.name,
                    'description', d.description,
                    'deal_type', d.deal_type,
                    'discount_type', d.discount_type,
                    'discount_value', d.discount_value,
                    'original_price', d.original_price,
                    'deal_price', d.deal_price,
                    'image_url', d.image_url,
                    'items', d.items,
                    'is_active', d.is_active,
                    'valid_from', d.valid_from,
                    'valid_until', d.valid_until
                ) ORDER BY d.name
            ), '[]'::json)
            FROM deals d
            WHERE d.is_active = true
              AND (d.valid_from IS NULL OR d.valid_from <= NOW())
              AND (d.valid_until IS NULL OR d.valid_until >= NOW())
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_menu_for_ordering() TO authenticated;

-- =============================================
-- 9. ADD ITEMS TO EXISTING ORDER
-- For adding more items to a table's current order
-- =============================================

CREATE OR REPLACE FUNCTION add_items_to_order(
    p_order_id UUID,
    p_new_items JSONB
)
RETURNS JSON AS $$
DECLARE
    v_waiter_id UUID;
    v_order_record RECORD;
    v_updated_items JSONB;
    v_new_subtotal DECIMAL(10, 2);
    v_new_tax DECIMAL(10, 2);
    v_new_total DECIMAL(10, 2);
    v_new_items_count INT;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order_record FROM orders 
    WHERE id = p_order_id FOR UPDATE;
    
    IF v_order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate waiter owns this order
    IF v_order_record.waiter_id != v_waiter_id THEN
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_waiter_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to modify this order');
        END IF;
    END IF;
    
    -- Validate order status
    IF v_order_record.status NOT IN ('pending', 'confirmed', 'preparing') THEN
        RETURN json_build_object('success', false, 'error', 'Cannot add items to this order. Status: ' || v_order_record.status);
    END IF;
    
    -- Merge items
    v_updated_items := v_order_record.items || p_new_items;
    
    -- Recalculate totals
    SELECT 
        COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT), 0)
    INTO v_new_subtotal, v_new_items_count
    FROM jsonb_array_elements(v_updated_items) AS item;
    
    v_new_tax := ROUND(v_new_subtotal * 0.05, 2);
    v_new_total := v_new_subtotal + v_new_tax;
    
    -- Update order
    UPDATE orders
    SET 
        items = v_updated_items,
        subtotal = v_new_subtotal,
        tax = v_new_tax,
        total = v_new_total,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Update waiter history
    UPDATE waiter_order_history
    SET 
        items = v_updated_items,
        total_items = v_new_items_count,
        subtotal = v_new_subtotal,
        tax = v_new_tax,
        total = v_new_total,
        updated_at = NOW()
    WHERE order_id = p_order_id AND waiter_id = v_waiter_id;
    
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'items_count', v_new_items_count,
        'subtotal', v_new_subtotal,
        'tax', v_new_tax,
        'total', v_new_total,
        'message', 'Items added successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_items_to_order(UUID, JSONB) TO authenticated;

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE waiter_order_history IS 'Stores complete order history per waiter with customer and billing details';
COMMENT ON FUNCTION claim_table_for_waiter IS 'Atomic function to claim available table for waiter';
COMMENT ON FUNCTION get_tables_for_waiter IS 'Returns all tables with waiter-specific information';
COMMENT ON FUNCTION lookup_customer IS 'Searches for registered customer by phone/email/name';
COMMENT ON FUNCTION create_waiter_dine_in_order IS 'Creates dine-in order with full tracking and customer lookup';
COMMENT ON FUNCTION get_waiter_order_history IS 'Returns paginated order history with statistics for waiter';
COMMENT ON FUNCTION release_table IS 'Releases table after billing, records tips';
COMMENT ON FUNCTION get_menu_for_ordering IS 'Returns all menu items and deals for order creation';
COMMENT ON FUNCTION add_items_to_order IS 'Adds items to existing order';
