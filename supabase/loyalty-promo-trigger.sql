-- =============================================
-- AUTOMATIC LOYALTY PROMO CODE GENERATION TRIGGER
-- Automatically awards promo codes when customers earn points
-- This ensures promos are awarded even if bills aren't generated immediately
-- Updated: Uses BOTH customer_promo_codes AND promo_codes tables for compatibility
-- =============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS loyalty_points_award_promo_trigger ON loyalty_points;
DROP FUNCTION IF EXISTS award_loyalty_promo_on_points_insert();

-- =============================================
-- MAIN TRIGGER FUNCTION - Calls check_and_award_loyalty_promo
-- =============================================
CREATE OR REPLACE FUNCTION award_loyalty_promo_on_points_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Only process when points are earned (not redeemed/adjusted/bonus)
    IF NEW.type != 'earned' THEN
        RETURN NEW;
    END IF;
    
    -- Skip if no customer_id
    IF NEW.customer_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Call the existing check_and_award_loyalty_promo function
    -- This function handles all the threshold logic and promo generation
    BEGIN
        SELECT check_and_award_loyalty_promo(NEW.customer_id) INTO v_result;
        
        -- Log success if promos were awarded
        IF (v_result->>'awarded')::BOOLEAN = true THEN
            RAISE NOTICE 'Auto-awarded % promo code(s) to customer % after earning points', 
                v_result->>'promos_awarded', NEW.customer_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Don't fail the points insertion if promo award fails
        RAISE WARNING 'Failed to auto-award loyalty promo to customer %: %', NEW.customer_id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on loyalty_points table
-- Fires AFTER INSERT on each row
CREATE TRIGGER loyalty_points_award_promo_trigger
    AFTER INSERT ON loyalty_points
    FOR EACH ROW
    EXECUTE FUNCTION award_loyalty_promo_on_points_insert();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION award_loyalty_promo_on_points_insert() TO authenticated;

-- =============================================
-- FIX: Update generate_customer_promo_code to also add customer_id to promo_codes
-- This ensures the promo is linked to customer in BOTH tables
-- =============================================
DROP FUNCTION IF EXISTS generate_customer_promo_code(UUID, INT, TEXT, TEXT, DECIMAL, DECIMAL);
CREATE OR REPLACE FUNCTION generate_customer_promo_code(
    p_customer_id UUID,
    p_points_required INT,
    p_promo_type TEXT,
    p_promo_name TEXT,
    p_promo_value DECIMAL(10,2),
    p_max_discount DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_code TEXT;
    v_expiry_days INT;
    v_new_promo_id UUID;
    v_customer_name TEXT;
BEGIN
    -- Get customer name
    SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id;
    
    IF v_customer_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- SAFETY CHECK: Prevent duplicate threshold promo codes
    -- Check BOTH tables for existing promo code for this points threshold
    IF EXISTS (
        SELECT 1 FROM customer_promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) OR EXISTS (
        SELECT 1 FROM promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Customer already has a promo code for this threshold',
            'threshold', p_points_required
        );
    END IF;
    
    -- Get expiry days from settings
    SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
    INTO v_expiry_days
    FROM perks_settings
    WHERE setting_key = 'promo_expiry_days';
    
    v_expiry_days := COALESCE(v_expiry_days, 60);
    
    -- Generate unique code: ZOIRO-<random>
    v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    
    -- Check uniqueness in BOTH tables and regenerate if needed
    WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_code) OR
          EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code) LOOP
        v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    END LOOP;
    
    -- Insert into customer_promo_codes table
    INSERT INTO customer_promo_codes (
        customer_id, code, promo_type, value, max_discount,
        name, description, loyalty_points_required, expires_at
    ) VALUES (
        p_customer_id, v_code, p_promo_type, p_promo_value, p_max_discount,
        p_promo_name, 'Loyalty reward for ' || v_customer_name || ' - ' || p_points_required || ' points',
        p_points_required, NOW() + (v_expiry_days || ' days')::INTERVAL
    ) RETURNING id INTO v_new_promo_id;
    
    -- ALSO insert into main promo_codes table with customer_id and loyalty_points_required
    -- This allows the promo code to be used in the regular billing flow
    INSERT INTO promo_codes (
        code, name, description, promo_type, value, max_discount,
        valid_from, valid_until, usage_limit, current_usage, is_active,
        customer_id, loyalty_points_required
    ) VALUES (
        v_code, p_promo_name, 
        'Personal loyalty reward for ' || v_customer_name,
        p_promo_type::promo_type, p_promo_value, p_max_discount,
        NOW(), NOW() + (v_expiry_days || ' days')::INTERVAL,
        1, 0, true,
        p_customer_id, p_points_required
    );
    
    RAISE NOTICE 'Generated promo code % for customer % at % points threshold', v_code, p_customer_id, p_points_required;
    
    RETURN json_build_object(
        'success', true,
        'promo_id', v_new_promo_id,
        'code', v_code,
        'promo_type', p_promo_type,
        'value', p_promo_value,
        'max_discount', p_max_discount,
        'expires_at', NOW() + (v_expiry_days || ' days')::INTERVAL,
        'message', 'Promo code generated for customer'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to generate promo code for customer %: %', p_customer_id, SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_customer_promo_code(UUID, INT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;

-- =============================================
-- FIX: Update check_and_award_loyalty_promo to check BOTH tables
-- =============================================
DROP FUNCTION IF EXISTS check_and_award_loyalty_promo(UUID);
CREATE OR REPLACE FUNCTION check_and_award_loyalty_promo(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
    v_total_points INT;
    v_thresholds JSONB;
    v_threshold JSONB;
    v_promo_result JSON;
    v_already_awarded INT[];
    v_awarded_promos JSON[] := '{}';
BEGIN
    -- Get customer's current total points
    SELECT COALESCE(SUM(points), 0)::INT
    INTO v_total_points
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
    
    -- Get ALL thresholds ever awarded to this customer from BOTH tables
    -- This ensures each threshold promo is only awarded ONCE per customer lifetime
    SELECT ARRAY_AGG(DISTINCT threshold)
    INTO v_already_awarded
    FROM (
        SELECT loyalty_points_required as threshold 
        FROM customer_promo_codes 
        WHERE customer_id = p_customer_id AND loyalty_points_required IS NOT NULL
        UNION
        SELECT loyalty_points_required as threshold 
        FROM promo_codes 
        WHERE customer_id = p_customer_id AND loyalty_points_required IS NOT NULL
    ) combined;
    
    v_already_awarded := COALESCE(v_already_awarded, '{}');
    
    -- Get loyalty thresholds settings
    SELECT setting_value
    INTO v_thresholds
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_thresholds IS NULL OR jsonb_typeof(v_thresholds) != 'array' THEN
        RETURN json_build_object(
            'success', true, 
            'promos_awarded', 0, 
            'message', 'No thresholds configured',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    -- Check each threshold (from lowest to highest)
    FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds) ORDER BY (value->>'points')::INT ASC
    LOOP
        -- If customer has enough points and hasn't EVER been awarded this threshold promo
        IF v_total_points >= (v_threshold->>'points')::INT 
           AND NOT ((v_threshold->>'points')::INT = ANY(v_already_awarded)) THEN
            
            -- Generate promo code
            SELECT generate_customer_promo_code(
                p_customer_id,
                (v_threshold->>'points')::INT,
                COALESCE(v_threshold->>'promo_type', 'percentage'),
                COALESCE(v_threshold->>'promo_name', (v_threshold->>'points')::TEXT || ' Points Reward'),
                COALESCE((v_threshold->>'promo_value')::DECIMAL, 10),
                (v_threshold->>'max_discount')::DECIMAL
            ) INTO v_promo_result;
            
            -- Only add if generation was successful
            IF v_promo_result IS NOT NULL AND (v_promo_result->>'success')::BOOLEAN = true THEN
                v_awarded_promos := array_append(v_awarded_promos, v_promo_result);
                -- Update already_awarded to prevent duplicate processing in same call
                v_already_awarded := array_append(v_already_awarded, (v_threshold->>'points')::INT);
            END IF;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'total_points', v_total_points,
        'promos_awarded', COALESCE(array_length(v_awarded_promos, 1), 0),
        'awarded', COALESCE(array_length(v_awarded_promos, 1), 0) > 0,
        'new_promos', v_awarded_promos,
        -- Include first promo details for easy access
        'promo_code', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'code' ELSE NULL END,
        'promo_type', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'promo_type' ELSE NULL END,
        'value', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'value')::DECIMAL ELSE NULL END,
        'max_discount', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'max_discount')::DECIMAL ELSE NULL END,
        'expires_at', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'expires_at' ELSE NULL END
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'check_and_award_loyalty_promo failed for customer %: %', p_customer_id, SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM, 'total_points', 0, 'awarded', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_and_award_loyalty_promo(UUID) TO authenticated;

-- =============================================
-- COMMENTS & DOCUMENTATION
-- =============================================
COMMENT ON FUNCTION award_loyalty_promo_on_points_insert() IS 
'Trigger function that automatically calls check_and_award_loyalty_promo when points are earned.
Only fires for "earned" type points (not redeemed/adjusted/bonus).
Uses the existing promo generation system for consistency.';

COMMENT ON TRIGGER loyalty_points_award_promo_trigger ON loyalty_points IS
'Automatically awards loyalty promo codes whenever points are earned. 
This ensures promos are awarded for ALL order types including dine-in/walk-in.';

COMMENT ON FUNCTION check_and_award_loyalty_promo(UUID) IS
'Checks customer points against configured thresholds and awards ALL eligible promo codes.
Checks BOTH customer_promo_codes AND promo_codes tables to prevent duplicates.
Returns JSON with awarded promo details.';

COMMENT ON FUNCTION generate_customer_promo_code(UUID, INT, TEXT, TEXT, DECIMAL, DECIMAL) IS
'Generates a unique promo code for a customer who reached a loyalty threshold.
Inserts into BOTH customer_promo_codes AND promo_codes tables for compatibility.
Prevents duplicate codes for same threshold.';
