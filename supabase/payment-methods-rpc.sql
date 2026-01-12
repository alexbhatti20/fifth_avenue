-- =============================================
-- PAYMENT METHODS MANAGEMENT RPC
-- For managing online payment methods (JazzCash, EasyPaisa, Bank Account)
-- Admin only for CRUD, public for fetching active methods
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_active_payment_methods();
DROP FUNCTION IF EXISTS get_all_payment_methods();
DROP FUNCTION IF EXISTS create_payment_method(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS update_payment_method(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS delete_payment_method(UUID);
DROP FUNCTION IF EXISTS toggle_payment_method_status(UUID, BOOLEAN);

-- =============================================
-- CREATE PAYMENT METHODS TABLE IF NOT EXISTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    method_type TEXT NOT NULL CHECK (method_type IN ('jazzcash', 'easypaisa', 'bank')),
    method_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    bank_name TEXT, -- Only for bank accounts
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON public.payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON public.payment_methods(display_order);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public can view active payment methods" ON public.payment_methods;
CREATE POLICY "Public can view active payment methods" ON public.payment_methods
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admin can manage payment methods" ON public.payment_methods
    FOR ALL USING (is_manager_or_admin());

-- =============================================
-- 1. GET ACTIVE PAYMENT METHODS (Public/Customer facing)
-- Returns only active methods for customers to see
-- =============================================

CREATE OR REPLACE FUNCTION get_active_payment_methods()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'method_type', pm.method_type,
                    'method_name', pm.method_name,
                    'account_number', pm.account_number,
                    'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name,
                    'display_order', pm.display_order
                ) ORDER BY pm.display_order, pm.method_name
            )
            FROM payment_methods pm
            WHERE pm.is_active = true
        ), '[]'::json),
        'fetched_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. GET ALL PAYMENT METHODS (Admin only)
-- Returns all methods including inactive ones
-- =============================================

CREATE OR REPLACE FUNCTION get_all_payment_methods()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin and manager can access all payment methods.'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'method_type', pm.method_type,
                    'method_name', pm.method_name,
                    'account_number', pm.account_number,
                    'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name,
                    'is_active', pm.is_active,
                    'display_order', pm.display_order,
                    'created_at', pm.created_at,
                    'updated_at', pm.updated_at
                ) ORDER BY pm.display_order, pm.method_name
            )
            FROM payment_methods pm
        ), '[]'::json),
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM payment_methods),
            'active', (SELECT COUNT(*) FROM payment_methods WHERE is_active = true),
            'inactive', (SELECT COUNT(*) FROM payment_methods WHERE is_active = false),
            'jazzcash', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'jazzcash' AND is_active = true),
            'easypaisa', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'easypaisa' AND is_active = true),
            'bank', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'bank' AND is_active = true)
        ),
        'fetched_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. CREATE PAYMENT METHOD (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION create_payment_method(
    p_method_type TEXT,
    p_method_name TEXT,
    p_account_number TEXT,
    p_account_holder_name TEXT,
    p_bank_name TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true,
    p_display_order INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_new_id UUID;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Validate method type
    IF p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type. Must be jazzcash, easypaisa, or bank');
    END IF;
    
    -- Validate required fields
    IF p_method_name IS NULL OR TRIM(p_method_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Method name is required');
    END IF;
    
    IF p_account_number IS NULL OR TRIM(p_account_number) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account number is required');
    END IF;
    
    IF p_account_holder_name IS NULL OR TRIM(p_account_holder_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account holder name is required');
    END IF;
    
    -- Bank name required for bank type
    IF p_method_type = 'bank' AND (p_bank_name IS NULL OR TRIM(p_bank_name) = '') THEN
        RETURN json_build_object('success', false, 'error', 'Bank name is required for bank accounts');
    END IF;
    
    -- Insert new payment method
    INSERT INTO payment_methods (
        method_type,
        method_name,
        account_number,
        account_holder_name,
        bank_name,
        is_active,
        display_order
    ) VALUES (
        p_method_type,
        TRIM(p_method_name),
        TRIM(p_account_number),
        TRIM(p_account_holder_name),
        NULLIF(TRIM(p_bank_name), ''),
        p_is_active,
        p_display_order
    )
    RETURNING id INTO v_new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', v_new_id,
        'message', 'Payment method created successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. UPDATE PAYMENT METHOD (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION update_payment_method(
    p_id UUID,
    p_method_type TEXT DEFAULT NULL,
    p_method_name TEXT DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_display_order INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Check if payment method exists
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    -- Validate method type if provided
    IF p_method_type IS NOT NULL AND p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type');
    END IF;
    
    -- Update payment method
    UPDATE payment_methods SET
        method_type = COALESCE(p_method_type, method_type),
        method_name = COALESCE(NULLIF(TRIM(p_method_name), ''), method_name),
        account_number = COALESCE(NULLIF(TRIM(p_account_number), ''), account_number),
        account_holder_name = COALESCE(NULLIF(TRIM(p_account_holder_name), ''), account_holder_name),
        bank_name = CASE 
            WHEN p_bank_name IS NOT NULL THEN NULLIF(TRIM(p_bank_name), '')
            ELSE bank_name 
        END,
        is_active = COALESCE(p_is_active, is_active),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Payment method updated successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. DELETE PAYMENT METHOD (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION delete_payment_method(p_id UUID)
RETURNS JSON AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Check if payment method exists
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    -- Delete payment method
    DELETE FROM payment_methods WHERE id = p_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Payment method deleted successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. TOGGLE PAYMENT METHOD STATUS (Admin only)
-- Quick toggle for active/inactive status
-- =============================================

CREATE OR REPLACE FUNCTION toggle_payment_method_status(
    p_id UUID,
    p_is_active BOOLEAN
)
RETURNS JSON AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE payment_methods 
    SET is_active = p_is_active, updated_at = NOW()
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'is_active', p_is_active,
        'message', CASE WHEN p_is_active THEN 'Payment method activated' ELSE 'Payment method deactivated' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION get_active_payment_methods() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_all_payment_methods() TO authenticated;
GRANT EXECUTE ON FUNCTION create_payment_method(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_payment_method(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_payment_method(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_payment_method_status(UUID, BOOLEAN) TO authenticated;

-- Add comments
COMMENT ON TABLE payment_methods IS 'Stores online payment method details (JazzCash, EasyPaisa, Bank accounts) configured by admin';
COMMENT ON FUNCTION get_active_payment_methods IS 'Get active payment methods for customer checkout';
COMMENT ON FUNCTION get_all_payment_methods IS 'Admin: Get all payment methods with stats';
COMMENT ON FUNCTION create_payment_method IS 'Admin: Create a new payment method';
COMMENT ON FUNCTION update_payment_method IS 'Admin: Update an existing payment method';
COMMENT ON FUNCTION delete_payment_method IS 'Admin: Delete a payment method';
COMMENT ON FUNCTION toggle_payment_method_status IS 'Admin: Quick toggle payment method active status';
