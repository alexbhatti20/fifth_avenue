-- =============================================
-- CUSTOMER ORDER CREATION RPC FUNCTIONS
-- These functions use SECURITY DEFINER to bypass RLS
-- while still validating that the customer exists
-- =============================================

-- Drop ALL existing versions of these functions (any signature)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all create_customer_order functions
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'create_customer_order' 
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
    -- Drop all record_promo_usage functions
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'record_promo_usage' 
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
    -- Drop all deduct_loyalty_points functions
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'deduct_loyalty_points' 
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
    -- Drop all create_customer_notification functions
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'create_customer_notification' 
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- =============================================
-- CREATE CUSTOMER ORDER
-- Main function to create an order bypassing RLS
-- =============================================
CREATE OR REPLACE FUNCTION create_customer_order(
    p_customer_id UUID,
    p_order_number TEXT,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_customer_address TEXT,
    p_order_type TEXT,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_tax NUMERIC,
    p_delivery_fee NUMERIC,
    p_discount NUMERIC,
    p_total NUMERIC,
    p_payment_method TEXT,
    p_payment_status TEXT,
    p_table_number INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_transaction_id TEXT DEFAULT NULL,
    p_online_payment_method_id UUID DEFAULT NULL,
    p_online_payment_details JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_customer_exists BOOLEAN;
BEGIN
    -- Validate customer exists
    SELECT EXISTS(SELECT 1 FROM customers WHERE id = p_customer_id) INTO v_customer_exists;
    
    IF NOT v_customer_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Customer not found'
        );
    END IF;

    -- Validate order type
    IF p_order_type NOT IN ('online', 'walk-in', 'dine-in') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid order type'
        );
    END IF;

    -- Validate payment method
    IF p_payment_method NOT IN ('cash', 'card', 'online', 'wallet') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid payment method'
        );
    END IF;

    -- Create the order
    INSERT INTO orders (
        customer_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        order_type,
        items,
        subtotal,
        tax,
        delivery_fee,
        discount,
        total,
        payment_method,
        payment_status,
        status,
        table_number,
        notes,
        transaction_id,
        online_payment_method_id,
        online_payment_details,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        p_order_number,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_customer_address,
        p_order_type::order_type,
        p_items,
        p_subtotal,
        p_tax,
        p_delivery_fee,
        p_discount,
        p_total,
        p_payment_method::payment_method,
        COALESCE(p_payment_status, 'pending'),
        'pending'::order_status,
        p_table_number,
        p_notes,
        p_transaction_id,
        p_online_payment_method_id,
        p_online_payment_details,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- Create initial order status history
    INSERT INTO order_status_history (order_id, status, notes, created_at)
    VALUES (v_order_id, 'pending', 'Order placed by customer', NOW());

    -- Return success with order ID
    RETURN jsonb_build_object(
        'success', true,
        'id', v_order_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- =============================================
-- RECORD PROMO CODE USAGE
-- Records when a customer uses a promo code
-- =============================================
CREATE OR REPLACE FUNCTION record_promo_usage(
    p_customer_id UUID,
    p_deal_id UUID,
    p_order_id UUID,
    p_discount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO promo_code_usage (
        customer_id,
        deal_id,
        order_id,
        discount_applied,
        created_at
    ) VALUES (
        p_customer_id,
        p_deal_id,
        p_order_id,
        p_discount,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- =============================================
-- DEDUCT LOYALTY POINTS
-- Deducts loyalty points when used for an order
-- =============================================
CREATE OR REPLACE FUNCTION deduct_loyalty_points(
    p_customer_id UUID,
    p_order_id UUID,
    p_points INTEGER,
    p_order_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO loyalty_points (
        customer_id,
        order_id,
        points,
        type,
        description,
        created_at
    ) VALUES (
        p_customer_id,
        p_order_id,
        -p_points, -- Negative for deduction
        'redeemed',
        'Redeemed ' || p_points || ' points for order ' || p_order_number,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- =============================================
-- CREATE CUSTOMER NOTIFICATION
-- Creates a notification for a customer
-- =============================================
CREATE OR REPLACE FUNCTION create_customer_notification(
    p_customer_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO notifications (
        user_type,
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        created_at
    ) VALUES (
        'customer',
        p_customer_id,
        p_title,
        p_message,
        p_type,
        p_reference_id,
        FALSE,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_customer_order TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_promo_usage TO authenticated, anon;
GRANT EXECUTE ON FUNCTION deduct_loyalty_points TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_customer_notification TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION create_customer_order IS 'Creates a customer order bypassing RLS - validates customer exists';
COMMENT ON FUNCTION record_promo_usage IS 'Records promo code usage for an order';
COMMENT ON FUNCTION deduct_loyalty_points IS 'Deducts loyalty points when redeemed for an order';
COMMENT ON FUNCTION create_customer_notification IS 'Creates a notification for a customer';
