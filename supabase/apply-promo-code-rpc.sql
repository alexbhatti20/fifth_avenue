-- =============================================
-- APPLY PROMO CODE RPC
-- Advanced promo code validation and application
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. APPLY PROMO CODE (validates, calculates discount, and increments usage)
-- This function:
-- - Validates the promo code exists and is active
-- - Checks if it belongs to the customer (for reward codes) or is general
-- - Checks validity dates
-- - Checks usage limits
-- - Checks minimum order amount
-- - Calculates the discount amount
-- - Increments usage count atomically
-- - Marks as inactive if usage limit reached

DROP FUNCTION IF EXISTS apply_promo_code(TEXT, UUID, DECIMAL);
CREATE OR REPLACE FUNCTION apply_promo_code(
    p_code TEXT,
    p_customer_id UUID,
    p_order_amount DECIMAL
)
RETURNS JSON AS $$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL := 0;
    v_new_usage INT;
    v_is_exhausted BOOLEAN := false;
BEGIN
    -- Find the promo code with row lock for atomic update
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
    FOR UPDATE;  -- Lock the row to prevent race conditions

    -- Check if code exists
    IF v_promo IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid promo code',
            'error_code', 'NOT_FOUND'
        );
    END IF;

    -- Check if code is active
    IF NOT v_promo.is_active THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is no longer active',
            'error_code', 'INACTIVE'
        );
    END IF;

    -- Check customer-specific codes belong to the right customer
    IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is not available for your account',
            'error_code', 'WRONG_CUSTOMER'
        );
    END IF;

    -- Check validity dates
    IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is not yet active. Valid from: ' || TO_CHAR(v_promo.valid_from, 'DD Mon YYYY'),
            'error_code', 'NOT_YET_VALID'
        );
    END IF;

    IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code has expired on ' || TO_CHAR(v_promo.valid_until, 'DD Mon YYYY'),
            'error_code', 'EXPIRED'
        );
    END IF;

    -- Check usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code has already been fully used',
            'error_code', 'USAGE_EXHAUSTED'
        );
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required for this code',
            'error_code', 'MIN_ORDER_NOT_MET',
            'min_order_amount', v_promo.min_order_amount
        );
    END IF;

    -- Calculate discount based on promo type
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        -- Apply max discount cap if set
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSIF v_promo.promo_type = 'fixed' THEN
        v_discount := v_promo.value;
        -- Don't let discount exceed order amount
        IF v_discount > p_order_amount THEN
            v_discount := p_order_amount;
        END IF;
    ELSIF v_promo.promo_type = 'free_item' THEN
        -- Free item promos have a fixed value representing the item price
        v_discount := COALESCE(v_promo.value, 0);
    ELSE
        -- Unknown promo type, use value as fixed discount
        v_discount := COALESCE(v_promo.value, 0);
    END IF;

    -- Increment usage count
    v_new_usage := COALESCE(v_promo.current_usage, 0) + 1;
    
    -- Check if this usage exhausts the limit
    IF v_promo.usage_limit IS NOT NULL AND v_new_usage >= v_promo.usage_limit THEN
        v_is_exhausted := true;
    END IF;

    -- Update the promo code: increment usage and potentially deactivate
    UPDATE promo_codes
    SET 
        current_usage = v_new_usage,
        is_active = CASE WHEN v_is_exhausted THEN false ELSE is_active END,
        updated_at = NOW()
    WHERE id = v_promo.id;

    -- Return success with all details
    RETURN json_build_object(
        'success', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type::TEXT,
            'value', v_promo.value,
            'max_discount', v_promo.max_discount,
            'is_customer_reward', v_promo.customer_id IS NOT NULL
        ),
        'discount_amount', v_discount,
        'original_amount', p_order_amount,
        'final_amount', GREATEST(0, p_order_amount - v_discount),
        'usage_exhausted', v_is_exhausted,
        'message', CASE 
            WHEN v_promo.promo_type = 'percentage' THEN v_promo.value || '% discount applied!'
            WHEN v_promo.promo_type = 'fixed' THEN 'Rs. ' || v_discount || ' discount applied!'
            ELSE 'Promo code applied successfully!'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_promo_code(TEXT, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_promo_code(TEXT, UUID, DECIMAL) TO anon;


-- 2. PREVIEW PROMO CODE (validates without applying - no usage increment)
-- Use this to show the customer what discount they'll get before checkout

DROP FUNCTION IF EXISTS preview_promo_code(TEXT, UUID, DECIMAL);
CREATE OR REPLACE FUNCTION preview_promo_code(
    p_code TEXT,
    p_customer_id UUID,
    p_order_amount DECIMAL
)
RETURNS JSON AS $$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL := 0;
BEGIN
    -- Find the promo code (no lock needed for preview)
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code);

    -- Check if code exists
    IF v_promo IS NULL THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invalid promo code'
        );
    END IF;

    -- Check if code is active
    IF NOT v_promo.is_active THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is no longer active'
        );
    END IF;

    -- Check customer-specific codes belong to the right customer
    IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is not available for your account'
        );
    END IF;

    -- Check validity dates
    IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is not yet active'
        );
    END IF;

    IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code has expired'
        );
    END IF;

    -- Check usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code has already been used'
        );
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order of Rs. ' || v_promo.min_order_amount || ' required',
            'min_order_amount', v_promo.min_order_amount
        );
    END IF;

    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSIF v_promo.promo_type = 'fixed' THEN
        v_discount := LEAST(v_promo.value, p_order_amount);
    ELSE
        v_discount := COALESCE(v_promo.value, 0);
    END IF;

    -- Return preview result
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type::TEXT,
            'value', v_promo.value,
            'max_discount', v_promo.max_discount,
            'is_customer_reward', v_promo.customer_id IS NOT NULL
        ),
        'discount_amount', v_discount,
        'final_amount', GREATEST(0, p_order_amount - v_discount),
        'message', CASE 
            WHEN v_promo.promo_type = 'percentage' THEN 
                'You''ll save ' || v_promo.value || '%' || 
                CASE WHEN v_promo.max_discount IS NOT NULL THEN ' (up to Rs. ' || v_promo.max_discount || ')' ELSE '' END
            WHEN v_promo.promo_type = 'fixed' THEN 'You''ll save Rs. ' || v_discount
            ELSE v_promo.name || ' will be applied'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION preview_promo_code(TEXT, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION preview_promo_code(TEXT, UUID, DECIMAL) TO anon;


-- 3. REVERT PROMO CODE USAGE (if order fails/cancelled)
-- Call this if the order creation fails after applying promo

DROP FUNCTION IF EXISTS revert_promo_code_usage(UUID);
CREATE OR REPLACE FUNCTION revert_promo_code_usage(p_promo_id UUID)
RETURNS JSON AS $$
DECLARE
    v_promo RECORD;
BEGIN
    SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_id FOR UPDATE;
    
    IF v_promo IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;

    -- Decrement usage (but not below 0)
    UPDATE promo_codes
    SET 
        current_usage = GREATEST(0, COALESCE(current_usage, 1) - 1),
        is_active = true,  -- Reactivate if it was deactivated due to usage limit
        updated_at = NOW()
    WHERE id = p_promo_id;

    RETURN json_build_object('success', true, 'message', 'Promo code usage reverted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION revert_promo_code_usage(UUID) TO authenticated;


-- 4. Test queries
-- SELECT preview_promo_code('TESTCODE', 'customer-uuid', 500.00);
-- SELECT apply_promo_code('TESTCODE', 'customer-uuid', 500.00);
