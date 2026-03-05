-- ============================================
-- CUSTOMER ORDERS RPC FUNCTIONS
-- Run this in Supabase SQL Editor
-- Updated to include delivery rider phone number
-- Updated to include online payment details
-- ============================================

-- Drop existing functions to recreate
DROP FUNCTION IF EXISTS get_customer_orders_paginated(UUID, INT, INT, order_status);
DROP FUNCTION IF EXISTS get_order_details(UUID, UUID);
DROP FUNCTION IF EXISTS get_customer_payment_history(UUID, INT, INT, TEXT);

-- ============================================
-- 1. GET CUSTOMER ORDERS PAGINATED
-- Returns customer orders with delivery rider info and online payment details
-- Includes dine-in and takeaway orders linked to the customer
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_orders_paginated(
    p_customer_id UUID,
    p_limit INT DEFAULT 10,
    p_offset INT DEFAULT 0,
    p_status TEXT DEFAULT NULL   -- TEXT so callers don't need to cast
)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    order_type order_type,
    items JSONB,
    subtotal DECIMAL,
    discount DECIMAL,
    tax DECIMAL,
    delivery_fee DECIMAL,
    total DECIMAL,
    status order_status,
    payment_method payment_method,
    payment_status TEXT,
    customer_address TEXT,
    table_number INT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    assigned_to_name TEXT,
    assigned_to_phone TEXT,
    transaction_id TEXT,
    online_payment_method_id UUID,
    online_payment_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.order_type,
        o.items,
        o.subtotal,
        o.discount,
        o.tax,
        o.delivery_fee,
        o.total,
        o.status,
        o.payment_method,
        o.payment_status::TEXT,
        o.customer_address,
        o.table_number,
        o.created_at,
        o.delivered_at,
        e.name::TEXT,
        e.phone::TEXT,
        o.transaction_id,
        o.online_payment_method_id,
        o.online_payment_details
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    WHERE o.customer_id = p_customer_id
        AND (p_status IS NULL OR o.status::TEXT = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. GET CUSTOMER PAYMENT HISTORY
-- Returns customer's online and dine-in payment details as a timeline
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_payment_history(
    p_customer_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_payment_type TEXT DEFAULT NULL -- 'online', 'cash', 'dine_in', or null for all
)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    order_type order_type,
    total DECIMAL,
    subtotal DECIMAL,
    tax DECIMAL,
    delivery_fee DECIMAL,
    discount DECIMAL,
    payment_method payment_method,
    payment_status TEXT,
    transaction_id TEXT,
    online_payment_method_name TEXT,
    online_payment_account_holder TEXT,
    online_payment_account_number TEXT,
    online_payment_bank_name TEXT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    table_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.order_type,
        o.total,
        o.subtotal,
        o.tax,
        o.delivery_fee,
        o.discount,
        o.payment_method,
        o.payment_status::TEXT,
        o.transaction_id,
        COALESCE(
            (o.online_payment_details->>'method_name')::TEXT,
            pm.method_name
        ),
        COALESCE(
            (o.online_payment_details->>'account_holder_name')::TEXT,
            pm.account_holder_name
        ),
        COALESCE(
            (o.online_payment_details->>'account_number')::TEXT,
            pm.account_number
        ),
        COALESCE(
            (o.online_payment_details->>'bank_name')::TEXT,
            pm.bank_name
        ),
        o.created_at,
        o.delivered_at,
        o.table_number
    FROM orders o
    LEFT JOIN payment_methods pm ON o.online_payment_method_id = pm.id
    WHERE o.customer_id = p_customer_id
        AND (
            p_payment_type IS NULL
            OR (p_payment_type = 'online' AND o.payment_method NOT IN ('cash_on_delivery'))
            OR (p_payment_type = 'cash' AND o.payment_method = 'cash_on_delivery')
            OR (p_payment_type = 'dine_in' AND o.order_type = 'dine_in')
        )
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. GET ORDER DETAILS
-- Returns full order details with delivery rider info
-- ============================================
CREATE OR REPLACE FUNCTION get_order_details(p_order_id UUID, p_customer_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    order_type order_type,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items JSONB,
    subtotal DECIMAL,
    tax DECIMAL,
    delivery_fee DECIMAL,
    discount DECIMAL,
    total DECIMAL,
    payment_method payment_method,
    payment_status TEXT,
    status order_status,
    notes TEXT,
    assigned_to UUID,
    assigned_to_name TEXT,
    assigned_to_phone TEXT,
    waiter_name TEXT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    status_history JSONB,
    transaction_id TEXT,
    online_payment_method_id UUID,
    online_payment_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.order_type,
        o.customer_name::TEXT,
        o.customer_email::TEXT,
        o.customer_phone::TEXT,
        o.customer_address,
        o.items,
        o.subtotal,
        o.tax,
        o.delivery_fee,
        o.discount,
        o.total,
        o.payment_method,
        o.payment_status::TEXT,
        o.status,
        o.notes,
        o.assigned_to,
        e.name::TEXT,
        e.phone::TEXT,
        w.name::TEXT,
        o.created_at,
        o.delivered_at,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'status', h.status,
                    'notes', h.notes,
                    'created_at', h.created_at
                ) ORDER BY h.created_at DESC
            )
            FROM order_status_history h
            WHERE h.order_id = o.id
        ),
        o.transaction_id,
        o.online_payment_method_id,
        o.online_payment_details
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN employees w ON o.waiter_id = w.id
    WHERE o.id = p_order_id
        AND (p_customer_id IS NULL OR o.customer_id = p_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_customer_orders_paginated(UUID, INT, INT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_order_details(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_customer_payment_history(UUID, INT, INT, TEXT) TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION get_customer_orders_paginated IS 'Get customer orders with pagination and online payment details';
COMMENT ON FUNCTION get_customer_payment_history IS 'Get customer payment history timeline with transaction details';
COMMENT ON FUNCTION get_order_details IS 'Get full order details for a specific order';
