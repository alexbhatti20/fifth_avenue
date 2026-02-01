-- =============================================
-- ADVANCED BILLING & INVOICE RPC FUNCTIONS
-- Fast, Production-Ready, Optimized
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- DROP EXISTING FUNCTIONS TO AVOID CONFLICTS
-- =============================================
DROP FUNCTION IF EXISTS get_billable_orders(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_order_for_billing(UUID);
DROP FUNCTION IF EXISTS validate_promo_code_for_billing(TEXT, UUID, DECIMAL);
-- Drop all versions of generate_advanced_invoice
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, INT, TEXT, UUID);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, INT);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT, DECIMAL);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_advanced_invoice(UUID);
DROP FUNCTION IF EXISTS get_invoice_details(UUID);
DROP FUNCTION IF EXISTS get_billing_dashboard_stats();
DROP FUNCTION IF EXISTS get_invoices_list(TEXT, DATE, DATE, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_customer_invoice_history(UUID);
DROP FUNCTION IF EXISTS mark_invoice_printed(UUID);
DROP FUNCTION IF EXISTS void_invoice(UUID, TEXT);
DROP FUNCTION IF EXISTS get_table_billing_info(UUID);

-- =============================================
-- HELPER: GET EMPLOYEE ID FROM AUTH USER
-- Creates or replaces the get_employee_id function
-- =============================================

CREATE OR REPLACE FUNCTION get_employee_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_employee_id() TO authenticated;

-- =============================================
-- 1. INVOICES TABLE ENHANCEMENTS
-- Add missing columns if they don't exist
-- =============================================

-- Add new columns to invoices table for advanced features
DO $$ 
BEGIN
    -- Add bill_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'bill_status') THEN
        ALTER TABLE invoices ADD COLUMN bill_status TEXT DEFAULT 'pending' CHECK (bill_status IN ('pending', 'generated', 'paid', 'void', 'refunded'));
    END IF;
    
    -- Add promo_code_id for tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'promo_code_id') THEN
        ALTER TABLE invoices ADD COLUMN promo_code_id UUID REFERENCES promo_codes(id);
    END IF;
    
    -- Add promo_code_value
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'promo_code_value') THEN
        ALTER TABLE invoices ADD COLUMN promo_code_value TEXT;
    END IF;
    
    -- Add void_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'void_reason') THEN
        ALTER TABLE invoices ADD COLUMN void_reason TEXT;
    END IF;
    
    -- Add voided_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'voided_by') THEN
        ALTER TABLE invoices ADD COLUMN voided_by UUID REFERENCES employees(id);
    END IF;
    
    -- Add voided_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'voided_at') THEN
        ALTER TABLE invoices ADD COLUMN voided_at TIMESTAMPTZ;
    END IF;
    
    -- Add service_charge if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'service_charge') THEN
        ALTER TABLE invoices ADD COLUMN service_charge DECIMAL(10, 2) DEFAULT 0;
    END IF;
    
    -- Add delivery_fee if not exists  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'delivery_fee') THEN
        ALTER TABLE invoices ADD COLUMN delivery_fee DECIMAL(10, 2) DEFAULT 0;
    END IF;
    
    -- Add table_session_id for tracking which table session
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'table_session_id') THEN
        ALTER TABLE invoices ADD COLUMN table_session_id UUID;
    END IF;
    
    -- Add brand_info JSONB for storing brand details on invoice
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'brand_info') THEN
        ALTER TABLE invoices ADD COLUMN brand_info JSONB DEFAULT '{
            "name": "ZOIRO Broast",
            "tagline": "Injected Broast - Saucy. Juicy. Crispy.",
            "address": "Main Branch, City",
            "phone": "+92 XXX XXXXXXX",
            "email": "info@zoiro.com",
            "ntn": "XXXXXXX",
            "logo_url": "/assets/logo.png"
        }'::jsonb;
    END IF;
    
    -- Add loyalty_points_used column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'loyalty_points_used') THEN
        ALTER TABLE invoices ADD COLUMN loyalty_points_used INT DEFAULT 0;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_bill_status ON invoices(bill_status);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_date ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_table_number ON invoices(table_number);

-- =============================================
-- 2. INVOICE RECORDS TABLE
-- Stores all invoice history for registered customers
-- =============================================

CREATE TABLE IF NOT EXISTS customer_invoice_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    order_id UUID REFERENCES orders(id),
    order_type TEXT,
    items JSONB,
    subtotal DECIMAL(10, 2),
    discount DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    payment_method TEXT,
    payment_status TEXT,
    promo_code_used TEXT,
    loyalty_points_used INT DEFAULT 0,
    loyalty_points_earned INT DEFAULT 0,
    billed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(customer_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_invoice_records_customer ON customer_invoice_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_records_invoice ON customer_invoice_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_records_date ON customer_invoice_records(billed_at DESC);

-- Enable RLS
ALTER TABLE customer_invoice_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "customer_invoice_records_select" ON customer_invoice_records;
CREATE POLICY "customer_invoice_records_select"
    ON customer_invoice_records FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "customer_invoice_records_insert" ON customer_invoice_records;
CREATE POLICY "customer_invoice_records_insert"
    ON customer_invoice_records FOR INSERT
    TO authenticated
    WITH CHECK (true);

GRANT SELECT, INSERT ON customer_invoice_records TO authenticated;

-- =============================================
-- 3. GET BILLABLE ORDERS
-- Returns all orders that need billing
-- =============================================

CREATE OR REPLACE FUNCTION get_billable_orders(
    p_order_type TEXT DEFAULT NULL,
    p_status_filter TEXT DEFAULT 'all',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_employee_id UUID;
BEGIN
    -- Try to get employee ID (fallback if auth_user_id not set)
    v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
    IF v_employee_id IS NULL THEN
        v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(order_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'order_type', o.order_type,
                    'status', o.status,
                    'payment_status', o.payment_status,
                    'customer_id', o.customer_id,
                    'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
                    'customer_phone', o.customer_phone,
                    'customer_email', o.customer_email,
                    'customer_address', o.customer_address,
                    'items', o.items,
                    'items_count', jsonb_array_length(o.items),
                    'subtotal', o.subtotal,
                    'discount', o.discount,
                    'tax', o.tax,
                    'delivery_fee', o.delivery_fee,
                    'total', o.total,
                    'table_number', o.table_number,
                    'waiter_id', o.waiter_id,
                    'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
                    'notes', o.notes,
                    'created_at', o.created_at,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_method_id', o.online_payment_method_id,
                    'online_payment_details', o.online_payment_details,
                    'is_registered_customer', o.customer_id IS NOT NULL,
                    'customer_loyalty_points', COALESCE((
                        SELECT SUM(points) FROM loyalty_points WHERE customer_id = o.customer_id
                    ), 0),
                    'has_invoice', EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
                ) as order_data,
                o.created_at
                FROM orders o
                WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
                AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
                AND (
                    p_status_filter = 'all' OR
                    (p_status_filter = 'pending_bill' AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)) OR
                    (p_status_filter = 'billed' AND EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id))
                )
                ORDER BY o.created_at DESC
                LIMIT p_limit
                OFFSET p_offset
            ) sub
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total_pending', COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
                'total_billed_today', (
                    SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURRENT_DATE
                ),
                'revenue_today', (
                    SELECT COALESCE(SUM(total), 0) FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND bill_status = 'paid'
                )
            )
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_billable_orders(TEXT, TEXT, INT, INT) TO authenticated;

-- =============================================
-- 4. GET ORDER FOR BILLING (DETAILED)
-- Returns complete order details for invoice generation
-- =============================================

CREATE OR REPLACE FUNCTION get_order_for_billing(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_customer RECORD;
    v_table RECORD;
    v_waiter RECORD;
    v_existing_invoice RECORD;
    v_customer_json JSON := NULL;
    v_table_json JSON := NULL;
    v_waiter_json JSON := NULL;
    v_invoice_json JSON := NULL;
    result JSON;
BEGIN
    -- Get order
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if invoice already exists
    SELECT * INTO v_existing_invoice FROM invoices WHERE order_id = p_order_id;
    IF FOUND THEN
        v_invoice_json := json_build_object(
            'id', v_existing_invoice.id,
            'invoice_number', v_existing_invoice.invoice_number,
            'total', v_existing_invoice.total,
            'status', v_existing_invoice.payment_status,
            'created_at', v_existing_invoice.created_at
        );
    END IF;
    
    -- Get customer details if registered
    IF v_order.customer_id IS NOT NULL THEN
        SELECT c.id, c.name, c.phone, c.email, c.address, c.is_verified,
               COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) as loyalty_points,
               CASE 
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 1000 THEN 'platinum'
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 500 THEN 'gold'
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 250 THEN 'silver'
                   ELSE 'bronze'
               END as loyalty_tier,
               COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = c.id), 0)::INT as total_orders,
               COALESCE((SELECT SUM(total) FROM orders WHERE customer_id = c.id AND payment_status = 'paid'), 0) as total_spent
        INTO v_customer
        FROM customers c
        WHERE c.id = v_order.customer_id;
        
        IF FOUND THEN
            v_customer_json := json_build_object(
                'id', v_customer.id,
                'name', v_customer.name,
                'phone', v_customer.phone,
                'email', v_customer.email,
                'address', v_customer.address,
                'is_verified', v_customer.is_verified,
                'loyalty_points', COALESCE(v_customer.loyalty_points, 0),
                'loyalty_tier', COALESCE(v_customer.loyalty_tier, 'bronze'),
                'total_orders', v_customer.total_orders,
                'total_spent', v_customer.total_spent
            );
        END IF;
    END IF;
    
    -- Default customer JSON if not found
    IF v_customer_json IS NULL THEN
        v_customer_json := json_build_object(
            'name', COALESCE(v_order.customer_name, 'Walk-in Customer'),
            'phone', v_order.customer_phone,
            'email', v_order.customer_email,
            'address', v_order.customer_address,
            'is_registered', false
        );
    END IF;
    
    -- Get table details if dine-in
    IF v_order.table_number IS NOT NULL THEN
        SELECT * INTO v_table FROM restaurant_tables WHERE table_number = v_order.table_number;
        IF FOUND THEN
            v_table_json := json_build_object(
                'id', v_table.id,
                'table_number', v_table.table_number,
                'capacity', v_table.capacity,
                'section', v_table.section,
                'floor', v_table.floor,
                'current_customers', v_table.current_customers
            );
        END IF;
    END IF;
    
    -- Get waiter details
    IF v_order.waiter_id IS NOT NULL THEN
        SELECT id, name, phone, employee_id INTO v_waiter FROM employees WHERE id = v_order.waiter_id;
        IF FOUND THEN
            v_waiter_json := json_build_object(
                'id', v_waiter.id,
                'name', v_waiter.name,
                'employee_id', v_waiter.employee_id
            );
        END IF;
    END IF;
    
    -- Build final result
    SELECT json_build_object(
        'success', true,
        'order', json_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'order_type', v_order.order_type,
            'status', v_order.status,
            'payment_status', v_order.payment_status,
            'items', v_order.items,
            'items_count', jsonb_array_length(COALESCE(v_order.items, '[]'::jsonb)),
            'subtotal', v_order.subtotal,
            'discount', v_order.discount,
            'tax', v_order.tax,
            'delivery_fee', v_order.delivery_fee,
            'total', v_order.total,
            'notes', v_order.notes,
            'created_at', v_order.created_at,
            'transaction_id', v_order.transaction_id,
            'online_payment_method_id', v_order.online_payment_method_id,
            'online_payment_details', v_order.online_payment_details
        ),
        'customer', v_customer_json,
        'table', v_table_json,
        'waiter', v_waiter_json,
        'existing_invoice', v_invoice_json,
        'brand_info', (
            SELECT brand_info FROM invoices LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_order_for_billing(UUID) TO authenticated;

-- =============================================
-- 5. VALIDATE PROMO CODE FOR BILLING (ADVANCED)
-- Comprehensive promo code validation
-- =============================================

CREATE OR REPLACE FUNCTION validate_promo_code_for_billing(
    p_code TEXT,
    p_customer_id UUID DEFAULT NULL,
    p_order_amount DECIMAL(10, 2) DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_promo RECORD;
    v_usage_count INT;
    v_discount_value DECIMAL(10, 2);
    v_customer_usage INT;
BEGIN
    -- Find promo code
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false, 
            'error', 'Promo code not found',
            'error_code', 'NOT_FOUND'
        );
    END IF;
    
    -- Check if code is expired
    IF v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code is not yet active',
            'error_code', 'NOT_ACTIVE_YET',
            'valid_from', v_promo.valid_from
        );
    END IF;
    
    IF v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code has expired',
            'error_code', 'EXPIRED',
            'expired_at', v_promo.valid_until
        );
    END IF;
    
    -- Check global usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code usage limit reached',
            'error_code', 'LIMIT_REACHED',
            'usage_limit', v_promo.usage_limit,
            'current_usage', v_promo.current_usage
        );
    END IF;
    
    -- Check customer-specific usage if customer provided
    IF p_customer_id IS NOT NULL THEN
        -- Check if promo is customer-specific
        IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
            RETURN json_build_object(
                'valid', false,
                'error', 'This promo code is not for this customer',
                'error_code', 'CUSTOMER_MISMATCH'
            );
        END IF;
        
        -- Check per-customer usage limit
        IF v_promo.usage_per_customer IS NOT NULL THEN
            SELECT COUNT(*) INTO v_customer_usage
            FROM invoices i
            WHERE i.customer_id = p_customer_id
            AND i.promo_code_id = v_promo.id;
            
            IF v_customer_usage >= v_promo.usage_per_customer THEN
                RETURN json_build_object(
                    'valid', false,
                    'error', 'You have already used this promo code maximum times',
                    'error_code', 'CUSTOMER_LIMIT_REACHED',
                    'usage_per_customer', v_promo.usage_per_customer,
                    'customer_usage', v_customer_usage
                );
            END IF;
        END IF;
    END IF;
    
    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required',
            'error_code', 'MIN_ORDER_NOT_MET',
            'min_order_amount', v_promo.min_order_amount,
            'current_amount', p_order_amount
        );
    END IF;
    
    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount_value := ROUND(p_order_amount * (v_promo.value / 100), 2);
        IF v_promo.max_discount IS NOT NULL THEN
            v_discount_value := LEAST(v_discount_value, v_promo.max_discount);
        END IF;
    ELSIF v_promo.promo_type = 'fixed_amount' THEN
        v_discount_value := LEAST(v_promo.value, p_order_amount);
    ELSE
        v_discount_value := 0;
    END IF;
    
    -- Return success with promo details
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type,
            'value', v_promo.value,
            'discount_amount', v_discount_value,
            'max_discount', v_promo.max_discount,
            'min_order_amount', v_promo.min_order_amount,
            'usage_left', CASE WHEN v_promo.usage_limit IS NOT NULL 
                          THEN v_promo.usage_limit - v_promo.current_usage 
                          ELSE NULL END
        ),
        'discount_amount', v_discount_value
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_promo_code_for_billing(TEXT, UUID, DECIMAL) TO authenticated;

-- =============================================
-- 6. GENERATE ADVANCED INVOICE
-- Complete invoice generation with all features
-- =============================================

CREATE OR REPLACE FUNCTION generate_advanced_invoice(
    p_order_id UUID,
    p_payment_method TEXT DEFAULT 'cash',
    p_manual_discount DECIMAL(10, 2) DEFAULT 0,
    p_tip DECIMAL(10, 2) DEFAULT 0,
    p_service_charge DECIMAL(10, 2) DEFAULT 0,
    p_promo_code TEXT DEFAULT NULL,
    p_loyalty_points_used INT DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_biller_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_employee_id UUID;
    v_order RECORD;
    v_customer RECORD;
    v_customer_found BOOLEAN := FALSE;
    v_customer_id UUID := NULL;
    v_customer_name TEXT := NULL;
    v_customer_phone TEXT := NULL;
    v_customer_email TEXT := NULL;
    v_customer_loyalty_points INT := 0;
    v_promo RECORD;
    v_promo_id UUID := NULL;
    v_promo_discount DECIMAL(10, 2) := 0;
    v_points_discount DECIMAL(10, 2) := 0;
    v_total_discount DECIMAL(10, 2) := 0;
    v_tax DECIMAL(10, 2);
    v_final_total DECIMAL(10, 2);
    v_points_earned INT := 0;
    v_new_invoice_id UUID;
    v_invoice_number TEXT;
    v_table_session_id UUID;
    v_brand_info JSONB;
    -- Reward promo code variables
    v_reward_promo_code TEXT := NULL;
    v_reward_promo_generated BOOLEAN := FALSE;
    v_total_customer_points INT := 0;
    -- Effective payment method (auto-detect online orders)
    v_effective_payment_method TEXT;
BEGIN
    -- Use explicitly passed biller_id first, then try auth lookup, then fallback
    IF p_biller_id IS NOT NULL THEN
        v_employee_id := p_biller_id;
    ELSE
        -- Try to get employee ID from auth (may be NULL if auth_user_id not set)
        v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
        
        -- If no employee found by auth_user_id, try to get any active admin/manager
        IF v_employee_id IS NULL THEN
            v_employee_id := (
                SELECT id FROM employees 
                WHERE role::TEXT IN ('admin', 'manager') 
                AND status = 'active' 
                LIMIT 1
            );
        END IF;
    END IF;
    
    -- Get order with lock
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if invoice already exists
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        RETURN json_build_object('success', false, 'error', 'Invoice already exists for this order');
    END IF;
    
    -- Determine effective payment method (auto-detect online orders by transaction_id)
    IF v_order.transaction_id IS NOT NULL THEN
        v_effective_payment_method := 'online';
    ELSE
        v_effective_payment_method := p_payment_method;
    END IF;
    
    -- Get customer if registered
    IF v_order.customer_id IS NOT NULL THEN
        SELECT c.*, 
               COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) as loyalty_points
        INTO v_customer
        FROM customers c
        WHERE c.id = v_order.customer_id;
        
        IF FOUND THEN
            v_customer_found := TRUE;
            v_customer_id := v_customer.id;
            v_customer_name := v_customer.name;
            v_customer_phone := v_customer.phone;
            v_customer_email := v_customer.email;
            v_customer_loyalty_points := COALESCE(v_customer.loyalty_points, 0);
        END IF;
    END IF;
    
    -- Validate and apply promo code
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT * INTO v_promo
        FROM promo_codes
        WHERE UPPER(code) = UPPER(p_promo_code)
        AND is_active = true
        AND valid_from <= NOW()
        AND valid_until >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit);
        
        IF FOUND THEN
            -- Store promo ID
            v_promo_id := v_promo.id;
            
            -- Calculate promo discount
            IF v_promo.promo_type = 'percentage' THEN
                v_promo_discount := ROUND(v_order.subtotal * (v_promo.value / 100), 2);
                IF v_promo.max_discount IS NOT NULL THEN
                    v_promo_discount := LEAST(v_promo_discount, v_promo.max_discount);
                END IF;
            ELSE
                v_promo_discount := LEAST(v_promo.value, v_order.subtotal);
            END IF;
            
            -- Update promo usage in promo_codes table
            UPDATE promo_codes
            SET current_usage = current_usage + 1,
                updated_at = NOW(),
                is_active = CASE WHEN usage_limit IS NOT NULL AND current_usage + 1 >= usage_limit THEN false ELSE is_active END
            WHERE id = v_promo.id;
            
            -- ALSO mark as used in customer_promo_codes if this is a customer-specific promo
            IF v_promo.customer_id IS NOT NULL THEN
                UPDATE customer_promo_codes
                SET is_used = true, 
                    used_at = NOW(), 
                    used_on_order_id = p_order_id, 
                    is_active = false
                WHERE code = UPPER(p_promo_code) AND customer_id = v_promo.customer_id;
            END IF;
        END IF;
    END IF;
    
    -- Apply loyalty points discount (10 points = Rs. 1)
    IF p_loyalty_points_used > 0 AND v_customer_found THEN
        IF v_customer_loyalty_points >= p_loyalty_points_used THEN
            v_points_discount := ROUND(p_loyalty_points_used * 0.1, 2);
            
            -- Deduct points by inserting a negative redemption record
            INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
            VALUES (v_customer_id, p_order_id, -p_loyalty_points_used, 'redeemed', 'Redeemed for bill discount');
        END IF;
    END IF;
    
    -- Calculate totals
    v_total_discount := p_manual_discount + v_promo_discount + v_points_discount;
    v_tax := ROUND((v_order.subtotal - v_total_discount) * 0.05, 2); -- 5% GST
    v_final_total := v_order.subtotal - v_total_discount + v_tax + p_service_charge + v_order.delivery_fee + p_tip;
    
    -- Calculate loyalty points earned (1 point per Rs. 100 spent)
    IF v_customer_found THEN
        v_points_earned := FLOOR(v_final_total / 100);
    END IF;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Generate table session ID if dine-in
    IF v_order.order_type = 'dine-in' THEN
        v_table_session_id := gen_random_uuid();
    END IF;
    
    -- Get brand info
    v_brand_info := '{
        "name": "ZOIRO Broast",
        "tagline": "Injected Broast - Saucy. Juicy. Crispy.",
        "address": "Main Branch, City Center",
        "phone": "+92 300 1234567",
        "email": "info@zoiro.com",
        "ntn": "1234567-8",
        "strn": "12-34-5678-901-23",
        "logo_url": "/assets/logo.png",
        "website": "www.zoiro.com"
    }'::jsonb;
    
    -- Create invoice
    INSERT INTO invoices (
        invoice_number,
        order_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        items,
        subtotal,
        discount,
        discount_details,
        tax,
        service_charge,
        delivery_fee,
        tip,
        total,
        payment_method,
        payment_status,
        bill_status,
        promo_code_id,
        promo_code_value,
        loyalty_points_earned,
        loyalty_points_used,
        table_number,
        table_session_id,
        served_by,
        billed_by,
        brand_info,
        notes
    ) VALUES (
        v_invoice_number,
        p_order_id,
        v_customer_id,
        COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
        COALESCE(v_customer_phone, v_order.customer_phone),
        COALESCE(v_customer_email, v_order.customer_email),
        v_order.order_type,
        v_order.items,
        v_order.subtotal,
        v_total_discount,
        json_build_object(
            'manual_discount', p_manual_discount,
            'promo_discount', v_promo_discount,
            'promo_code', p_promo_code,
            'points_discount', v_points_discount,
            'points_used', p_loyalty_points_used
        ),
        v_tax,
        p_service_charge,
        v_order.delivery_fee,
        p_tip,
        v_final_total,
        v_effective_payment_method,
        'paid',
        'paid',
        v_promo_id,
        p_promo_code,
        v_points_earned,
        p_loyalty_points_used,
        v_order.table_number,
        v_table_session_id,
        v_order.waiter_id,
        v_employee_id,
        v_brand_info,
        p_notes
    ) RETURNING id INTO v_new_invoice_id;
    
    -- Award loyalty points to customer (insert new record, not upsert)
    IF v_customer_found AND v_points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
        VALUES (v_customer_id, p_order_id, v_points_earned, 'earned', 'Earned from bill payment - Invoice #' || v_invoice_number);
    END IF;
    
    -- Always calculate total points if customer found (needed for response)
    IF v_customer_found THEN
        SELECT COALESCE(SUM(points), 0)::INT
        INTO v_total_customer_points
        FROM loyalty_points
        WHERE customer_id = v_customer_id;
        
        -- Auto-award promo codes for loyalty thresholds
        -- This runs directly without relying on external functions
        BEGIN
            DECLARE
                v_threshold_settings JSONB;
                v_threshold JSONB;
                v_expiry_days INT := 60;
                v_already_awarded INT[];
                v_threshold_points INT;
                v_new_code TEXT;
            BEGIN
                -- Check if perks_settings table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perks_settings') THEN
                    
                    -- Get thresholds already awarded to this customer from promo_codes table
                    SELECT ARRAY_AGG(DISTINCT loyalty_points_required)
                    INTO v_already_awarded
                    FROM promo_codes
                    WHERE customer_id = v_customer_id 
                      AND loyalty_points_required IS NOT NULL;
                    
                    v_already_awarded := COALESCE(v_already_awarded, ARRAY[]::INT[]);
                    
                    -- Get loyalty thresholds from settings
                    SELECT setting_value INTO v_threshold_settings
                    FROM perks_settings
                    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
                    
                    -- Get expiry days from settings
                    BEGIN
                        SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
                        INTO v_expiry_days
                        FROM perks_settings
                        WHERE setting_key = 'promo_expiry_days';
                    EXCEPTION WHEN OTHERS THEN
                        v_expiry_days := 60;
                    END;
                    
                    -- Process thresholds if configured
                    IF v_threshold_settings IS NOT NULL AND jsonb_typeof(v_threshold_settings) = 'array' THEN
                        FOR v_threshold IN SELECT value FROM jsonb_array_elements(v_threshold_settings) AS value ORDER BY (value->>'points')::INT DESC
                        LOOP
                            v_threshold_points := (v_threshold->>'points')::INT;
                            
                            -- Check if customer qualifies and hasn't already received this threshold promo
                            IF v_total_customer_points >= v_threshold_points 
                               AND NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                                
                                -- Generate unique promo code
                                v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                
                                -- Ensure code is unique
                                WHILE EXISTS (SELECT 1 FROM promo_codes WHERE code = v_new_code) LOOP
                                    v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                END LOOP;
                                
                                -- Insert into promo_codes table (single table for all promo codes)
                                INSERT INTO promo_codes (
                                    code, name, description, promo_type, value, max_discount,
                                    valid_from, valid_until, usage_limit, current_usage, is_active, 
                                    customer_id, loyalty_points_required
                                ) VALUES (
                                    v_new_code, 
                                    COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                                    'Loyalty reward for reaching ' || v_threshold_points || ' points',
                                    COALESCE(v_threshold->>'promo_type', 'percentage')::promo_type, 
                                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10), 
                                    (v_threshold->>'max_discount')::DECIMAL,
                                    NOW(), 
                                    NOW() + (v_expiry_days || ' days')::INTERVAL,
                                    1, 0, true, 
                                    v_customer_id, v_threshold_points
                                );
                                
                                -- Set reward info for response
                                v_reward_promo_code := v_new_code;
                                v_reward_promo_generated := TRUE;
                                
                                -- Award highest eligible threshold first, exit after one
                                EXIT;
                            END IF;
                        END LOOP;
                    END IF;
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- Don't fail invoice generation if promo award fails
            -- Just continue without awarding promo
            NULL;
        END;
    END IF;
    
    -- Store in customer invoice records if registered
    IF v_customer_found THEN
        INSERT INTO customer_invoice_records (
            customer_id, invoice_id, invoice_number, order_id, order_type,
            items, subtotal, discount, tax, total,
            payment_method, payment_status, promo_code_used,
            loyalty_points_used, loyalty_points_earned
        ) VALUES (
            v_customer_id, v_new_invoice_id, v_invoice_number, p_order_id, v_order.order_type,
            v_order.items, v_order.subtotal, v_total_discount, v_tax, v_final_total,
            p_payment_method, 'paid', p_promo_code,
            p_loyalty_points_used, v_points_earned
        );
    END IF;
    
    -- Update order status
    UPDATE orders
    SET status = 'delivered',
        payment_status = 'paid',
        payment_method = p_payment_method::payment_method,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Add tip to waiter if applicable
    IF p_tip > 0 AND v_order.waiter_id IS NOT NULL THEN
        UPDATE employees
        SET total_tips = COALESCE(total_tips, 0) + p_tip,
            updated_at = NOW()
        WHERE id = v_order.waiter_id;
        
        -- Insert into waiter tips table if exists
        BEGIN
            INSERT INTO waiter_tips (waiter_id, order_id, invoice_id, tip_amount, date)
            VALUES (v_order.waiter_id, p_order_id, v_new_invoice_id, p_tip, CURRENT_DATE);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END IF;
    
    -- Free up table if dine-in
    IF v_order.order_type = 'dine-in' AND v_order.table_number IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'cleaning',
            current_order_id = NULL,
            current_customers = 0,
            assigned_waiter_id = NULL,
            updated_at = NOW()
        WHERE table_number = v_order.table_number;
    END IF;
    
    -- Add to order status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, 'delivered'::order_status, v_employee_id, 'Bill generated - Invoice #' || v_invoice_number);
    
    -- Return success with invoice details
    RETURN json_build_object(
        'success', true,
        'invoice_id', v_new_invoice_id,
        'invoice_number', v_invoice_number,
        'customer', json_build_object(
            'id', v_customer_id,
            'name', COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
            'is_registered', v_customer_found,
            'points_earned', v_points_earned,
            'total_points', v_total_customer_points
        ),
        'totals', json_build_object(
            'subtotal', v_order.subtotal,
            'discount', v_total_discount,
            'tax', v_tax,
            'service_charge', p_service_charge,
            'delivery_fee', v_order.delivery_fee,
            'tip', p_tip,
            'total', v_final_total
        ),
        'discount_breakdown', json_build_object(
            'manual', p_manual_discount,
            'promo', v_promo_discount,
            'promo_code', p_promo_code,
            'points', v_points_discount
        ),
        'reward_promo', json_build_object(
            'generated', v_reward_promo_generated,
            'code', v_reward_promo_code
        ),
        'message', CASE WHEN v_reward_promo_generated 
            THEN 'Invoice generated successfully! Customer earned a reward promo code: ' || v_reward_promo_code
            ELSE 'Invoice generated successfully'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_advanced_invoice(UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, INT, TEXT, UUID) TO authenticated;

-- =============================================
-- 7. GET INVOICE DETAILS (FOR PRINT)
-- Returns complete invoice details for printing
-- =============================================

CREATE OR REPLACE FUNCTION get_invoice_details(p_invoice_id UUID)
RETURNS JSON AS $$
DECLARE
    v_invoice RECORD;
    v_order RECORD;
    v_waiter_id UUID := NULL;
    v_waiter_name TEXT := NULL;
    v_waiter_employee_id TEXT := NULL;
    v_biller_id UUID := NULL;
    v_biller_name TEXT := NULL;
    v_biller_employee_id TEXT := NULL;
    v_order_id UUID := NULL;
    v_order_number TEXT := NULL;
    v_order_created_at TIMESTAMPTZ := NULL;
BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    
    IF v_invoice IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    -- Get order details
    IF v_invoice.order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM orders WHERE id = v_invoice.order_id;
        v_order_id := v_order.id;
        v_order_number := v_order.order_number;
        v_order_created_at := v_order.created_at;
    END IF;
    
    -- Get waiter details
    IF v_invoice.served_by IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_waiter_id, v_waiter_name, v_waiter_employee_id 
        FROM employees WHERE id = v_invoice.served_by;
    END IF;
    
    -- Get biller details
    IF v_invoice.billed_by IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_biller_id, v_biller_name, v_biller_employee_id 
        FROM employees WHERE id = v_invoice.billed_by;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'invoice', json_build_object(
            'id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'order_type', v_invoice.order_type,
            'customer_name', v_invoice.customer_name,
            'customer_phone', v_invoice.customer_phone,
            'customer_email', v_invoice.customer_email,
            'items', v_invoice.items,
            'subtotal', v_invoice.subtotal,
            'discount', v_invoice.discount,
            'discount_details', v_invoice.discount_details,
            'tax', v_invoice.tax,
            'service_charge', v_invoice.service_charge,
            'delivery_fee', v_invoice.delivery_fee,
            'tip', v_invoice.tip,
            'total', v_invoice.total,
            'payment_method', v_invoice.payment_method,
            'payment_status', v_invoice.payment_status,
            'table_number', v_invoice.table_number,
            'loyalty_points_earned', v_invoice.loyalty_points_earned,
            'printed', v_invoice.printed,
            'printed_at', v_invoice.printed_at,
            'notes', v_invoice.notes,
            'created_at', v_invoice.created_at
        ),
        'brand', v_invoice.brand_info,
        'waiter', CASE WHEN v_waiter_id IS NOT NULL THEN json_build_object(
            'id', v_waiter_id,
            'name', v_waiter_name,
            'employee_id', v_waiter_employee_id
        ) ELSE NULL END,
        'billed_by', CASE WHEN v_biller_id IS NOT NULL THEN json_build_object(
            'id', v_biller_id,
            'name', v_biller_name,
            'employee_id', v_biller_employee_id
        ) ELSE NULL END,
        'order', CASE WHEN v_order_id IS NOT NULL THEN json_build_object(
            'id', v_order_id,
            'order_number', v_order_number,
            'order_type', v_order.order_type,
            'table_number', v_order.table_number,
            'created_at', v_order_created_at,
            'transaction_id', v_order.transaction_id,
            'online_payment_method_id', v_order.online_payment_method_id,
            'online_payment_details', v_order.online_payment_details
        ) ELSE NULL END,
        'transaction_id', CASE WHEN v_order.transaction_id IS NOT NULL THEN v_order.transaction_id ELSE NULL END,
        'online_payment_details', CASE WHEN v_order.online_payment_details IS NOT NULL THEN v_order.online_payment_details ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_invoice_details(UUID) TO authenticated;

-- =============================================
-- 8. GET BILLING DASHBOARD STATS
-- Returns comprehensive billing statistics
-- =============================================

CREATE OR REPLACE FUNCTION get_billing_dashboard_stats()
RETURNS JSON AS $$
BEGIN
    -- No authorization check - protected by RLS and frontend auth
    RETURN json_build_object(
        'success', true,
        'today', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(total), 0),
                'invoices_count', COUNT(*),
                'cash_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0),
                'card_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0),
                'online_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'online'), 0),
                'avg_invoice_value', ROUND(AVG(total), 2),
                'total_discount_given', COALESCE(SUM(discount), 0),
                'total_tips', COALESCE(SUM(tip), 0),
                'dine_in_count', COUNT(*) FILTER (WHERE order_type = 'dine-in'),
                'online_count', COUNT(*) FILTER (WHERE order_type = 'online'),
                'walk_in_count', COUNT(*) FILTER (WHERE order_type = 'walk-in')
            )
            FROM invoices
            WHERE DATE(created_at) = CURRENT_DATE
            AND bill_status = 'paid'
        ),
        'this_week', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(daily_total), 0),
                'invoices_count', COALESCE(SUM(daily_count), 0),
                'avg_daily_revenue', ROUND(AVG(daily_total), 2)
            )
            FROM (
                SELECT DATE(created_at) as day, SUM(total) as daily_total, COUNT(*) as daily_count
                FROM invoices
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                AND bill_status = 'paid'
                GROUP BY DATE(created_at)
            ) daily
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ),
        'recent_invoices', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', i.id,
                    'invoice_number', i.invoice_number,
                    'customer_name', i.customer_name,
                    'total', i.total,
                    'payment_method', i.payment_method,
                    'created_at', i.created_at
                ) ORDER BY i.created_at DESC
            ), '[]'::json)
            FROM (
                SELECT * FROM invoices
                WHERE DATE(created_at) = CURRENT_DATE
                ORDER BY created_at DESC
                LIMIT 5
            ) i
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_billing_dashboard_stats() TO authenticated;

-- =============================================
-- 9. GET TABLE BILLING INFO
-- Returns table with current order for billing
-- =============================================

CREATE OR REPLACE FUNCTION get_table_billing_info(p_table_id UUID)
RETURNS JSON AS $$
DECLARE
    v_table RECORD;
    v_order RECORD;
    v_waiter RECORD;
BEGIN
    SELECT * INTO v_table FROM restaurant_tables WHERE id = p_table_id;
    
    IF v_table IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    IF v_table.status != 'occupied' THEN
        RETURN json_build_object('success', false, 'error', 'Table is not occupied');
    END IF;
    
    IF v_table.current_order_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active order on this table');
    END IF;
    
    -- Get order
    SELECT * INTO v_order FROM orders WHERE id = v_table.current_order_id;
    
    -- Get waiter
    IF v_table.assigned_waiter_id IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_waiter FROM employees WHERE id = v_table.assigned_waiter_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'table', json_build_object(
            'id', v_table.id,
            'table_number', v_table.table_number,
            'capacity', v_table.capacity,
            'current_customers', v_table.current_customers,
            'section', v_table.section,
            'floor', v_table.floor
        ),
        'order', json_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'items', v_order.items,
            'items_count', jsonb_array_length(v_order.items),
            'subtotal', v_order.subtotal,
            'tax', v_order.tax,
            'total', v_order.total,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'status', v_order.status,
            'created_at', v_order.created_at
        ),
        'waiter', CASE WHEN v_waiter.id IS NOT NULL THEN json_build_object(
            'id', v_waiter.id,
            'name', v_waiter.name,
            'employee_id', v_waiter.employee_id
        ) ELSE NULL END,
        'can_generate_bill', v_order.status IN ('confirmed', 'preparing', 'ready', 'delivered')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_table_billing_info(UUID) TO authenticated;

-- =============================================
-- 10. MARK INVOICE PRINTED
-- Updates invoice print status
-- =============================================

CREATE OR REPLACE FUNCTION mark_invoice_printed(p_invoice_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE invoices
    SET printed = true,
        printed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Invoice marked as printed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_invoice_printed(UUID) TO authenticated;

-- =============================================
-- 11. VOID INVOICE
-- Voids an invoice with reason
-- =============================================

CREATE OR REPLACE FUNCTION void_invoice(
    p_invoice_id UUID,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_employee_id UUID;
    v_invoice RECORD;
BEGIN
    -- Try to get employee ID (fallback if auth_user_id not set)
    v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
    IF v_employee_id IS NULL THEN
        v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
    END IF;
    
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    
    IF v_invoice IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    IF v_invoice.bill_status = 'void' THEN
        RETURN json_build_object('success', false, 'error', 'Invoice is already voided');
    END IF;
    
    UPDATE invoices
    SET bill_status = 'void',
        payment_status = 'refunded',
        void_reason = p_reason,
        voided_by = v_employee_id,
        voided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    -- Log audit
    INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES ('void_invoice', 'invoice', p_invoice_id, v_employee_id, 
            json_build_object('reason', p_reason, 'invoice_number', v_invoice.invoice_number));
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invoice voided successfully',
        'invoice_number', v_invoice.invoice_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION void_invoice(UUID, TEXT) TO authenticated;

-- =============================================
-- 12. GET RECENT INVOICES
-- Returns list of invoices with filters
-- =============================================

CREATE OR REPLACE FUNCTION get_recent_invoices(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_payment_method TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
    v_invoices JSON;
BEGIN
    SELECT COALESCE(json_agg(invoice_row ORDER BY created_at DESC), '[]'::json)
    INTO v_invoices
    FROM (
        SELECT 
            i.id,
            i.invoice_number,
            i.order_type,
            i.customer_name,
            i.customer_phone,
            i.customer_email,
            i.items,
            i.subtotal,
            i.discount,
            i.tax,
            i.service_charge,
            i.delivery_fee,
            i.tip,
            i.total,
            i.payment_method,
            i.payment_status,
            i.bill_status,
            i.table_number,
            i.printed as is_printed,
            i.promo_code_value,
            i.loyalty_points_earned,
            i.loyalty_points_used,
            CASE WHEN i.bill_status = 'void' THEN true ELSE false END as is_voided,
            i.void_reason,
            i.created_at,
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'table_number', o.table_number,
                'transaction_id', o.transaction_id,
                'online_payment_method_id', o.online_payment_method_id,
                'online_payment_details', o.online_payment_details
            ) as "order",
            o.transaction_id,
            o.online_payment_details,
            CASE WHEN i.customer_id IS NOT NULL THEN
                json_build_object(
                    'id', c.id,
                    'name', COALESCE(i.customer_name, c.name),
                    'phone', c.phone,
                    'email', c.email,
                    'is_registered', true,
                    'loyalty_tier', CASE 
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 1000 THEN 'platinum'
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 500 THEN 'gold'
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 250 THEN 'silver'
                        ELSE 'bronze'
                    END
                )
            ELSE
                json_build_object(
                    'name', i.customer_name,
                    'phone', i.customer_phone,
                    'is_registered', false
                )
            END as customer,
            CASE WHEN i.promo_code_id IS NOT NULL THEN
                json_build_object(
                    'id', pc.id,
                    'code', pc.code,
                    'name', pc.name
                )
            ELSE NULL END as promo_code
        FROM invoices i
        LEFT JOIN orders o ON i.order_id = o.id
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN promo_codes pc ON i.promo_code_id = pc.id
        WHERE 
            (p_start_date IS NULL OR i.created_at >= p_start_date)
            AND (p_end_date IS NULL OR i.created_at <= p_end_date)
            AND (p_payment_method IS NULL OR i.payment_method = p_payment_method)
        ORDER BY i.created_at DESC
        LIMIT p_limit
    ) invoice_row;
    
    RETURN v_invoices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_recent_invoices(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT) TO authenticated;

-- =============================================
-- 13. GET CUSTOMER INVOICE HISTORY
-- Returns invoice history for a registered customer
-- =============================================

CREATE OR REPLACE FUNCTION get_customer_invoice_history(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
    v_customer RECORD;
    v_invoices JSON;
    v_stats JSON;
BEGIN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- Get invoices
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', i.id,
            'invoice_number', i.invoice_number,
            'order_type', i.order_type,
            'items_count', jsonb_array_length(i.items),
            'subtotal', i.subtotal,
            'discount', i.discount,
            'total', i.total,
            'payment_method', i.payment_method,
            'created_at', i.created_at,
            'loyalty_points_earned', i.loyalty_points_earned
        ) ORDER BY i.created_at DESC
    ), '[]'::json)
    INTO v_invoices
    FROM invoices i
    WHERE i.customer_id = p_customer_id
    AND i.bill_status = 'paid';
    
    -- Get stats
    SELECT json_build_object(
        'total_invoices', COUNT(*),
        'total_spent', COALESCE(SUM(total), 0),
        'average_order', ROUND(AVG(total), 2),
        'total_points_earned', COALESCE(SUM(loyalty_points_earned), 0),
        'total_discounts', COALESCE(SUM(discount), 0),
        'favorite_payment', (
            SELECT payment_method 
            FROM invoices 
            WHERE customer_id = p_customer_id 
            GROUP BY payment_method 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )
    )
    INTO v_stats
    FROM invoices
    WHERE customer_id = p_customer_id
    AND bill_status = 'paid';
    
    RETURN json_build_object(
        'success', true,
        'customer', json_build_object(
            'id', v_customer.id,
            'name', v_customer.name,
            'phone', v_customer.phone,
            'email', v_customer.email,
            'loyalty_tier', CASE 
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 1000 THEN 'platinum'
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 500 THEN 'gold'
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 250 THEN 'silver'
                ELSE 'bronze'
            END,
            'loyalty_points', COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0)
        ),
        'stats', v_stats,
        'invoices', v_invoices
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_customer_invoice_history(UUID) TO authenticated;

-- =============================================
-- 14. GET BILLING DASHBOARD PENDING ORDERS
-- Optimized function specifically for billing dashboard
-- Returns pending orders that need billing
-- =============================================

DROP FUNCTION IF EXISTS get_billing_pending_orders(INT);

CREATE OR REPLACE FUNCTION get_billing_pending_orders(
    p_limit INT DEFAULT 10
)
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(order_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'order_type', o.order_type,
                    'status', o.status,
                    'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
                    'customer_phone', o.customer_phone,
                    'items', o.items,
                    'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)),
                    'total', o.total,
                    'table_number', o.table_number,
                    'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
                    'created_at', o.created_at,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_details', o.online_payment_details,
                    'is_registered_customer', o.customer_id IS NOT NULL,
                    'customer_loyalty_points', COALESCE((
                        SELECT SUM(points)::INT FROM loyalty_points WHERE customer_id = o.customer_id
                    ), 0)
                ) as order_data,
                o.created_at
                FROM orders o
                WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
                AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
                ORDER BY o.created_at DESC
                LIMIT p_limit
            ) sub
        ), '[]'::json),
        'pending_count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ),
        'online_orders_count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_billing_pending_orders(INT) TO authenticated;

-- =============================================
-- 15. GET NEW ONLINE ORDERS FOR NOTIFICATION
-- Returns new online orders for notification system
-- =============================================

DROP FUNCTION IF EXISTS get_new_online_orders(TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_new_online_orders(
    p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '5 minutes'
)
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'customer_name', COALESCE(o.customer_name, 'Online Customer'),
                    'customer_phone', o.customer_phone,
                    'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)),
                    'total', o.total,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_details', o.online_payment_details,
                    'created_at', o.created_at
                ) ORDER BY o.created_at DESC
            )
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.created_at >= p_since
            AND o.status = 'pending'
        ), '[]'::json),
        'count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.created_at >= p_since
            AND o.status = 'pending'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_new_online_orders(TIMESTAMPTZ) TO authenticated;

-- =============================================
-- Comments
-- =============================================

COMMENT ON FUNCTION get_billable_orders IS 'Returns all orders ready for billing with filters';
COMMENT ON FUNCTION get_order_for_billing IS 'Returns detailed order info for invoice generation';
COMMENT ON FUNCTION validate_promo_code_for_billing IS 'Comprehensive promo code validation';
COMMENT ON FUNCTION generate_advanced_invoice IS 'Creates complete invoice with all features';
COMMENT ON FUNCTION get_invoice_details IS 'Returns full invoice details for printing';
COMMENT ON FUNCTION get_billing_dashboard_stats IS 'Returns billing dashboard statistics';
COMMENT ON FUNCTION get_table_billing_info IS 'Returns table with order for billing';
COMMENT ON FUNCTION mark_invoice_printed IS 'Marks invoice as printed';
COMMENT ON FUNCTION void_invoice IS 'Voids an invoice with reason';
COMMENT ON FUNCTION get_recent_invoices IS 'Returns list of invoices with filters';
COMMENT ON FUNCTION get_customer_invoice_history IS 'Returns invoice history for registered customer';
COMMENT ON FUNCTION get_billing_pending_orders IS 'Optimized function for billing dashboard pending orders';
COMMENT ON FUNCTION get_new_online_orders IS 'Returns new online orders for notification system';

-- =============================================
-- 16. QUICK BILL GENERATION (OPTIMIZED)
-- Fast bill generation with minimal overhead
-- For instant billing from Orders page
-- =============================================

DROP FUNCTION IF EXISTS generate_quick_bill(UUID, UUID);

CREATE OR REPLACE FUNCTION generate_quick_bill(
    p_order_id UUID,
    p_biller_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_invoice_number TEXT;
    v_invoice_id UUID;
    v_tax DECIMAL(10, 2);
    v_final_total DECIMAL(10, 2);
    v_effective_payment_method TEXT;
BEGIN
    -- Get order with lock (fast lookup)
    SELECT id, order_number, customer_id, customer_name, customer_phone, customer_email,
           order_type, items, subtotal, discount, delivery_fee, total, 
           payment_status, transaction_id, table_number
    INTO v_order 
    FROM orders 
    WHERE id = p_order_id 
    FOR UPDATE SKIP LOCKED;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found or locked');
    END IF;
    
    -- Check if invoice already exists
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        -- Return existing invoice info
        SELECT id, invoice_number INTO v_invoice_id, v_invoice_number 
        FROM invoices WHERE order_id = p_order_id;
        RETURN json_build_object(
            'success', true, 
            'invoice_id', v_invoice_id,
            'invoice_number', v_invoice_number,
            'message', 'Invoice already exists'
        );
    END IF;
    
    -- Auto-detect payment method for online orders
    IF v_order.transaction_id IS NOT NULL THEN
        v_effective_payment_method := 'online';
    ELSE
        v_effective_payment_method := 'cash';
    END IF;
    
    -- Simple calculations (no promo, no loyalty, no extras)
    v_tax := ROUND(COALESCE(v_order.subtotal, v_order.total * 0.95) * 0.05, 2); -- 5% GST
    v_final_total := COALESCE(v_order.subtotal, v_order.total * 0.95) - COALESCE(v_order.discount, 0) + v_tax + COALESCE(v_order.delivery_fee, 0);
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Generate invoice ID
    v_invoice_id := gen_random_uuid();
    
    -- Create invoice (minimal fields for speed)
    INSERT INTO invoices (
        id,
        invoice_number,
        order_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        items,
        subtotal,
        discount,
        tax,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        bill_status,
        billed_by,
        table_number,
        created_at
    ) VALUES (
        v_invoice_id,
        v_invoice_number,
        p_order_id,
        v_order.customer_id,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.customer_email,
        v_order.order_type,
        v_order.items,
        COALESCE(v_order.subtotal, v_order.total * 0.95),
        COALESCE(v_order.discount, 0),
        v_tax,
        COALESCE(v_order.delivery_fee, 0),
        v_final_total,
        v_effective_payment_method::payment_method,
        'pending',
        'generated',
        p_biller_id,
        v_order.table_number,
        NOW()
    );
    
    -- Update order status (payment_status stays as-is, just mark updated)
    UPDATE orders 
    SET updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'total', v_final_total,
        'tax', v_tax,
        'subtotal', COALESCE(v_order.subtotal, v_order.total * 0.95),
        'discount', COALESCE(v_order.discount, 0),
        'delivery_fee', COALESCE(v_order.delivery_fee, 0),
        'payment_method', v_effective_payment_method,
        'order_number', v_order.order_number,
        'order_type', v_order.order_type,
        'customer_name', COALESCE(v_order.customer_name, 'Walk-in Customer'),
        'customer_phone', v_order.customer_phone,
        'items', v_order.items,
        'table_number', v_order.table_number,
        'message', 'Bill generated successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_quick_bill(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION generate_quick_bill IS 'Fast bill generation for instant billing from Orders page. Skips promo/loyalty calculations.';

