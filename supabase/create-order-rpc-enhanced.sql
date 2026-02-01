-- =============================================
-- ENHANCED CREATE PORTAL ORDER RPC
-- Full customer history tracking for registered customers
-- Complete business record keeping
-- Multi-table support
-- =============================================

-- Drop existing function
DROP FUNCTION IF EXISTS create_portal_order(JSON);

-- Create enhanced version
CREATE OR REPLACE FUNCTION create_portal_order(
    p_order_data JSON
)
RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_customer_id UUID;
    v_customer_type TEXT;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_customer_email TEXT;
    v_customer_address TEXT;
    v_table_id UUID;
    v_table_ids UUID[];
    v_table_number INT;
    v_table_numbers TEXT := '';
    v_order_type TEXT;
    v_items JSON;
    v_item RECORD;
    v_subtotal NUMERIC := 0;
    v_tax NUMERIC := 0;
    v_total NUMERIC := 0;
    v_notes TEXT;
    v_employee_id UUID;
    v_employee_name TEXT;
    v_loyalty_points_earned INT := 0;
    v_tid UUID;
    v_item_count INT := 0;
    v_total_quantity INT := 0;
BEGIN
    -- Extract order data
    v_customer_type := COALESCE(p_order_data->>'customer_type', 'walk-in');
    v_customer_name := p_order_data->>'customer_name';
    v_customer_phone := COALESCE(NULLIF(p_order_data->>'customer_phone', ''), '0000000000');
    v_customer_email := NULLIF(p_order_data->>'customer_email', '');
    v_customer_address := NULLIF(p_order_data->>'customer_address', '');
    v_customer_id := NULLIF(p_order_data->>'customer_id', '')::UUID;
    v_table_id := NULLIF(p_order_data->>'table_id', '')::UUID;
    v_order_type := COALESCE(p_order_data->>'order_type', 'walk-in');
    v_items := p_order_data->'items';
    v_notes := NULLIF(p_order_data->>'notes', '');
    v_employee_id := NULLIF(p_order_data->>'employee_id', '')::UUID;

    -- Parse table_ids array if provided (for multi-table support)
    -- Use text comparison since JSON doesn't support != operator
    IF p_order_data->>'table_ids' IS NOT NULL 
       AND p_order_data->>'table_ids' != 'null' 
       AND p_order_data->>'table_ids' != '[]' THEN
        SELECT array_agg(elem::text::uuid)
        INTO v_table_ids
        FROM json_array_elements_text(p_order_data->'table_ids') elem;
    ELSIF v_table_id IS NOT NULL THEN
        v_table_ids := ARRAY[v_table_id];
    END IF;

    -- Get employee name for record keeping
    IF v_employee_id IS NOT NULL THEN
        SELECT name INTO v_employee_name FROM employees WHERE id = v_employee_id;
    END IF;

    -- Get table numbers for all selected tables
    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        SELECT string_agg(table_number::text, ', ' ORDER BY table_number)
        INTO v_table_numbers
        FROM restaurant_tables
        WHERE id = ANY(v_table_ids);
        
        -- Get first table number for the order
        SELECT table_number INTO v_table_number 
        FROM restaurant_tables 
        WHERE id = v_table_ids[1];
    END IF;

    -- Validate customer name
    IF v_customer_name IS NULL OR TRIM(v_customer_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Customer name is required'
        );
    END IF;

    -- Validate items
    IF v_items IS NULL OR json_array_length(v_items) = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order must have at least one item'
        );
    END IF;

    -- Generate order number with better format
    SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(
               (SELECT COUNT(*)::INT + 1 
                FROM orders 
                WHERE DATE(created_at) = CURRENT_DATE), 
               1
           )::TEXT, 4, '0')
    INTO v_order_number;

    -- Calculate totals from items and count
    v_item_count := json_array_length(v_items);
    FOR v_item IN SELECT * FROM json_array_elements(v_items)
    LOOP
        v_subtotal := v_subtotal + (
            COALESCE((v_item.value->>'price')::NUMERIC, 0) * 
            COALESCE((v_item.value->>'quantity')::INT, 1)
        );
        v_total_quantity := v_total_quantity + COALESCE((v_item.value->>'quantity')::INT, 1);
    END LOOP;

    -- Calculate tax (16% GST)
    v_tax := ROUND(v_subtotal * 0.16, 2);
    v_total := v_subtotal + v_tax;

    -- Calculate loyalty points (1 point per 100 spent)
    v_loyalty_points_earned := FLOOR(v_total / 100);

    -- Generate order ID
    v_order_id := gen_random_uuid();

    -- Create the order with full details
    -- Status is determined by order type:
    -- - Online orders: 'pending' (need manual confirmation before kitchen)
    -- - Dine-in/Takeaway/Walk-in: 'preparing' (directly in kitchen, ready to prepare)
    INSERT INTO orders (
        id,
        order_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        order_type,
        table_number,
        status,
        payment_status,
        payment_method,
        items,
        subtotal,
        tax,
        total,
        notes,
        waiter_id,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        v_customer_id,
        TRIM(v_customer_name),
        v_customer_phone,
        v_customer_email,
        v_customer_address,
        v_order_type::order_type,
        v_table_number,
        CASE 
            WHEN v_order_type = 'online' THEN 'pending'::order_status 
            ELSE 'preparing'::order_status  -- Dine-in, takeaway, walk-in go directly to kitchen
        END,
        'pending',
        'cash'::payment_method,
        v_items,
        v_subtotal,
        v_tax,
        v_total,
        v_notes,
        v_employee_id,
        NOW(),
        NOW()
    );

    -- Update ALL selected tables status if dine-in
    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        FOREACH v_tid IN ARRAY v_table_ids
        LOOP
            UPDATE restaurant_tables 
            SET status = 'occupied',
                current_order_id = v_order_id,
                updated_at = NOW()
            WHERE id = v_tid;
        END LOOP;
    END IF;

    -- =============================================
    -- REGISTERED CUSTOMER HISTORY TRACKING
    -- =============================================
    IF v_customer_id IS NOT NULL THEN
        -- Add loyalty points
        IF v_loyalty_points_earned > 0 THEN
            INSERT INTO loyalty_points (
                id,
                customer_id, 
                order_id, 
                points, 
                type, 
                description, 
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_customer_id, 
                v_order_id, 
                v_loyalty_points_earned, 
                'earned', 
                'Points earned from order ' || v_order_number || ' (Rs. ' || v_total::text || ')', 
                NOW()
            );
        END IF;

        -- Update customer's last order info and stats (if columns exist)
        UPDATE customers
        SET 
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- =============================================
    -- BUSINESS RECORD KEEPING - Order Activity Log
    -- Store detailed order creation log for business analytics
    -- =============================================
    BEGIN
        INSERT INTO order_activity_log (
            id,
            order_id,
            action,
            action_by,
            action_by_name,
            details,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_order_id,
            'created',
            v_employee_id,
            v_employee_name,
            json_build_object(
                'order_number', v_order_number,
                'customer_type', v_customer_type,
                'customer_id', v_customer_id,
                'customer_name', v_customer_name,
                'customer_phone', v_customer_phone,
                'customer_email', v_customer_email,
                'order_type', v_order_type,
                'table_numbers', v_table_numbers,
                'item_count', v_item_count,
                'total_quantity', v_total_quantity,
                'subtotal', v_subtotal,
                'tax', v_tax,
                'total', v_total,
                'loyalty_points_earned', v_loyalty_points_earned,
                'created_via', 'portal'
            ),
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- order_activity_log table doesn't exist, skip
        NULL;
    END;

    -- Return success with comprehensive details
    RETURN json_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'customer_id', v_customer_id,
        'customer_type', v_customer_type,
        'customer_name', v_customer_name,
        'order_type', v_order_type,
        'table_numbers', v_table_numbers,
        'item_count', v_item_count,
        'total_quantity', v_total_quantity,
        'subtotal', v_subtotal,
        'tax', v_tax,
        'total', v_total,
        'loyalty_points_earned', v_loyalty_points_earned,
        'employee_name', v_employee_name,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_portal_order(JSON) TO authenticated;

-- Comment
COMMENT ON FUNCTION create_portal_order IS 'Create order with full customer history tracking and business record keeping. Supports multi-table selection.';

-- =============================================
-- CREATE ORDER ACTIVITY LOG TABLE (if not exists)
-- For comprehensive business record keeping
-- =============================================
CREATE TABLE IF NOT EXISTS order_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'cancelled', 'completed', 'paid'
    action_by UUID REFERENCES employees(id),
    action_by_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_order_activity_log_order_id ON order_activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_activity_log_action ON order_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_order_activity_log_created_at ON order_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_order_activity_log_action_by ON order_activity_log(action_by);

-- RLS for order_activity_log
ALTER TABLE order_activity_log ENABLE ROW LEVEL SECURITY;


-- =============================================
-- CUSTOMER ORDER HISTORY VIEW (for registered customers)
-- =============================================
CREATE OR REPLACE VIEW customer_order_history AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    c.email as customer_email,
    COUNT(o.id) as total_orders,
    SUM(o.total) as total_spent,
    MAX(o.created_at) as last_order_date,
    MIN(o.created_at) as first_order_date,
    COALESCE(
        (SELECT SUM(
            CASE WHEN lp.type IN ('earned', 'bonus') THEN lp.points ELSE -lp.points END
        ) FROM loyalty_points lp WHERE lp.customer_id = c.id),
        0
    ) as loyalty_points,
    CASE 
        WHEN COALESCE((SELECT SUM(CASE WHEN lp.type IN ('earned', 'bonus') THEN lp.points ELSE -lp.points END) 
                       FROM loyalty_points lp WHERE lp.customer_id = c.id), 0) >= 5000 THEN 'platinum'
        WHEN COALESCE((SELECT SUM(CASE WHEN lp.type IN ('earned', 'bonus') THEN lp.points ELSE -lp.points END) 
                       FROM loyalty_points lp WHERE lp.customer_id = c.id), 0) >= 2000 THEN 'gold'
        WHEN COALESCE((SELECT SUM(CASE WHEN lp.type IN ('earned', 'bonus') THEN lp.points ELSE -lp.points END) 
                       FROM loyalty_points lp WHERE lp.customer_id = c.id), 0) >= 500 THEN 'silver'
        ELSE 'bronze'
    END as loyalty_tier
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.email;

-- Grant access to the view
GRANT SELECT ON customer_order_history TO authenticated;

COMMENT ON VIEW customer_order_history IS 'Aggregated customer order history with loyalty information';
