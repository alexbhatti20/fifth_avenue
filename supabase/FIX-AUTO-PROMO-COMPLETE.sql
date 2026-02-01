-- =============================================
-- COMPLETE FIX FOR AUTO PROMO CODE GENERATION
-- Run this ENTIRE file in Supabase SQL Editor
-- 
-- RULES:
-- 1. Each threshold = ONE promo code per customer LIFETIME
-- 2. Customer with 510 points at 500 threshold = gets promo ONCE
-- 3. When points increase to 600, 700, etc. - NO new promo for 500 threshold
-- 4. When promo is used, it's marked as used in BOTH tables
-- =============================================

-- Step 1: Ensure promo_codes table has required columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promo_codes' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE promo_codes ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_promo_codes_customer_id ON promo_codes(customer_id);
        RAISE NOTICE 'Added customer_id column to promo_codes table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promo_codes' AND column_name = 'loyalty_points_required'
    ) THEN
        ALTER TABLE promo_codes ADD COLUMN loyalty_points_required INT DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_promo_codes_loyalty_threshold ON promo_codes(customer_id, loyalty_points_required);
        RAISE NOTICE 'Added loyalty_points_required column to promo_codes table';
    END IF;
END $$;

-- Step 2: Ensure customer_promo_codes table exists
CREATE TABLE IF NOT EXISTS customer_promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    promo_type TEXT NOT NULL CHECK (promo_type IN ('percentage', 'fixed_amount')),
    value DECIMAL(10,2) NOT NULL,
    max_discount DECIMAL(10,2),
    name TEXT NOT NULL,
    description TEXT,
    loyalty_points_required INT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    used_on_order_id UUID REFERENCES orders(id),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Ensure perks_settings has loyalty_thresholds
INSERT INTO perks_settings (setting_key, setting_value, description) 
VALUES (
    'loyalty_thresholds', 
    '[{"points": 100, "promo_type": "percentage", "promo_value": 5, "promo_name": "Bronze Reward", "max_discount": 100}]'::jsonb, 
    'Thresholds for auto-generating promo codes'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Step 4: Drop and recreate generate_customer_promo_code function
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
        RAISE NOTICE 'Customer not found: %', p_customer_id;
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- SAFETY CHECK: Prevent duplicate threshold promo codes - check BOTH tables
    IF EXISTS (
        SELECT 1 FROM customer_promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) OR EXISTS (
        SELECT 1 FROM promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) THEN
        RAISE NOTICE 'Customer % already has promo for threshold %', p_customer_id, p_points_required;
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
    
    -- Generate unique code
    v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    
    -- Check uniqueness in BOTH tables
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
    
    -- ALSO insert into main promo_codes table WITH customer_id and loyalty_points_required
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
    
    RAISE NOTICE 'SUCCESS: Generated promo code % for customer % at % points', v_code, v_customer_name, p_points_required;
    
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
    RAISE WARNING 'ERROR generating promo: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_customer_promo_code(UUID, INT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;

-- Step 5: Drop and recreate check_and_award_loyalty_promo function
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
    v_threshold_points INT;
BEGIN
    RAISE NOTICE 'Checking promo eligibility for customer: %', p_customer_id;
    
    -- Get customer's current total points
    SELECT COALESCE(SUM(points), 0)::INT
    INTO v_total_points
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
    
    RAISE NOTICE 'Customer total points: %', v_total_points;
    
    -- Get ALL thresholds already awarded from BOTH tables
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
    RAISE NOTICE 'Already awarded thresholds: %', v_already_awarded;
    
    -- Get loyalty thresholds settings
    SELECT setting_value
    INTO v_thresholds
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_thresholds IS NULL THEN
        RAISE NOTICE 'No loyalty_thresholds setting found!';
        RETURN json_build_object(
            'success', false, 
            'error', 'No thresholds configured',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    IF jsonb_typeof(v_thresholds) != 'array' THEN
        RAISE NOTICE 'loyalty_thresholds is not an array: %', jsonb_typeof(v_thresholds);
        RETURN json_build_object(
            'success', false, 
            'error', 'Thresholds config is invalid',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    RAISE NOTICE 'Found % threshold(s) to check', jsonb_array_length(v_thresholds);
    
    -- Check each threshold
    FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds) ORDER BY (value->>'points')::INT ASC
    LOOP
        v_threshold_points := (v_threshold->>'points')::INT;
        RAISE NOTICE 'Checking threshold: % points (customer has: %)', v_threshold_points, v_total_points;
        
        IF v_total_points >= v_threshold_points THEN
            IF NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                RAISE NOTICE 'Customer qualifies for % points threshold - generating promo...', v_threshold_points;
                
                -- Generate promo code
                SELECT generate_customer_promo_code(
                    p_customer_id,
                    v_threshold_points,
                    COALESCE(v_threshold->>'promo_type', 'percentage'),
                    COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10),
                    (v_threshold->>'max_discount')::DECIMAL
                ) INTO v_promo_result;
                
                RAISE NOTICE 'Promo generation result: %', v_promo_result;
                
                IF v_promo_result IS NOT NULL AND (v_promo_result->>'success')::BOOLEAN = true THEN
                    v_awarded_promos := array_append(v_awarded_promos, v_promo_result);
                    v_already_awarded := array_append(v_already_awarded, v_threshold_points);
                END IF;
            ELSE
                RAISE NOTICE 'Customer already has promo for % points threshold', v_threshold_points;
            END IF;
        ELSE
            RAISE NOTICE 'Customer does not qualify for % points threshold (needs % more)', 
                v_threshold_points, v_threshold_points - v_total_points;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total promos awarded: %', COALESCE(array_length(v_awarded_promos, 1), 0);
    
    RETURN json_build_object(
        'success', true,
        'total_points', v_total_points,
        'promos_awarded', COALESCE(array_length(v_awarded_promos, 1), 0),
        'awarded', COALESCE(array_length(v_awarded_promos, 1), 0) > 0,
        'new_promos', v_awarded_promos,
        'promo_code', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'code' ELSE NULL END,
        'promo_type', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'promo_type' ELSE NULL END,
        'value', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'value')::DECIMAL ELSE NULL END,
        'max_discount', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'max_discount')::DECIMAL ELSE NULL END,
        'expires_at', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'expires_at' ELSE NULL END
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'check_and_award_loyalty_promo failed: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM, 'total_points', 0, 'awarded', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_and_award_loyalty_promo(UUID) TO authenticated;

-- Step 6: Create the trigger
DROP TRIGGER IF EXISTS loyalty_points_award_promo_trigger ON loyalty_points;
DROP FUNCTION IF EXISTS award_loyalty_promo_on_points_insert();

CREATE OR REPLACE FUNCTION award_loyalty_promo_on_points_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Only process 'earned' type points
    IF NEW.type != 'earned' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.customer_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Call check_and_award_loyalty_promo
    BEGIN
        SELECT check_and_award_loyalty_promo(NEW.customer_id) INTO v_result;
        
        IF (v_result->>'awarded')::BOOLEAN = true THEN
            RAISE NOTICE 'TRIGGER: Auto-awarded % promo(s) to customer %', 
                v_result->>'promos_awarded', NEW.customer_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'TRIGGER ERROR: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER loyalty_points_award_promo_trigger
    AFTER INSERT ON loyalty_points
    FOR EACH ROW
    EXECUTE FUNCTION award_loyalty_promo_on_points_insert();

GRANT EXECUTE ON FUNCTION award_loyalty_promo_on_points_insert() TO authenticated;

-- =============================================
-- Step 7: USE CUSTOMER PROMO CODE FUNCTION
-- Marks promo as USED when customer applies it
-- Updates BOTH tables for consistency
-- =============================================
DROP FUNCTION IF EXISTS use_customer_promo_code(TEXT, UUID, UUID);
CREATE OR REPLACE FUNCTION use_customer_promo_code(
    p_code TEXT,
    p_customer_id UUID,
    p_order_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_promo RECORD;
    v_promo_code TEXT;
BEGIN
    v_promo_code := UPPER(TRIM(p_code));
    
    -- Find the customer promo code (check if not already used)
    SELECT * INTO v_promo
    FROM customer_promo_codes
    WHERE code = v_promo_code
    AND customer_id = p_customer_id
    AND is_used = false;
    
    IF v_promo IS NULL THEN
        -- Check if it exists but is already used
        IF EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_promo_code AND customer_id = p_customer_id AND is_used = true) THEN
            RETURN json_build_object('success', false, 'error', 'This promo code has already been used');
        END IF;
        -- Check if expired
        IF EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_promo_code AND customer_id = p_customer_id AND expires_at < NOW()) THEN
            RETURN json_build_object('success', false, 'error', 'This promo code has expired');
        END IF;
        RETURN json_build_object('success', false, 'error', 'Promo code not found or does not belong to this customer');
    END IF;
    
    -- Check if expired
    IF v_promo.expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'This promo code has expired');
    END IF;
    
    -- Mark as USED in customer_promo_codes table
    UPDATE customer_promo_codes
    SET 
        is_used = true, 
        used_at = NOW(), 
        used_on_order_id = p_order_id, 
        is_active = false
    WHERE id = v_promo.id;
    
    -- Mark as USED in main promo_codes table
    UPDATE promo_codes
    SET 
        current_usage = COALESCE(usage_limit, 1),  -- Set to max usage
        is_active = false, 
        updated_at = NOW()
    WHERE code = v_promo_code;
    
    RAISE NOTICE 'Promo code % marked as USED for customer % on order %', v_promo_code, p_customer_id, p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'promo_type', v_promo.promo_type,
        'value', v_promo.value,
        'max_discount', v_promo.max_discount,
        'code', v_promo_code,
        'message', 'Promo code applied successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error using promo code: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION use_customer_promo_code(TEXT, UUID, UUID) TO authenticated;

-- =============================================
-- VERIFICATION QUERIES - Run these after the above
-- =============================================

-- Check trigger exists
SELECT 'Trigger exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES ✓' ELSE 'NO ✗' END as status
FROM pg_trigger WHERE tgname = 'loyalty_points_award_promo_trigger';

-- Check functions exist
SELECT 'check_and_award_loyalty_promo exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES ✓' ELSE 'NO ✗' END as status
FROM pg_proc WHERE proname = 'check_and_award_loyalty_promo';

SELECT 'generate_customer_promo_code exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES ✓' ELSE 'NO ✗' END as status
FROM pg_proc WHERE proname = 'generate_customer_promo_code';

-- Show current thresholds
SELECT 'Current thresholds:' as info, setting_value FROM perks_settings WHERE setting_key = 'loyalty_thresholds';

-- Show customers with points
SELECT 'Customers with points:' as info;
SELECT c.id, c.name, c.phone, COALESCE(SUM(lp.points), 0) as total_points
FROM customers c
LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
GROUP BY c.id, c.name, c.phone
HAVING COALESCE(SUM(lp.points), 0) > 0
ORDER BY total_points DESC
LIMIT 10;

-- =============================================
-- TEST: Award promos to ALL qualifying customers
-- This will check every customer and award any missing promos
-- =============================================
DO $$
DECLARE
    r RECORD;
    result JSON;
    awarded_count INT := 0;
BEGIN
    RAISE NOTICE '=== Starting bulk promo check for all customers ===';
    
    FOR r IN 
        SELECT c.id, c.name, COALESCE(SUM(lp.points), 0) as pts
        FROM customers c
        LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
        GROUP BY c.id, c.name
        HAVING COALESCE(SUM(lp.points), 0) > 0
    LOOP
        SELECT check_and_award_loyalty_promo(r.id) INTO result;
        IF (result->>'awarded')::BOOLEAN = true THEN
            awarded_count := awarded_count + (result->>'promos_awarded')::INT;
            RAISE NOTICE 'Awarded % promo(s) to % (% points)', 
                result->>'promos_awarded', r.name, r.pts;
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== Bulk check complete. Total promos awarded: % ===', awarded_count;
END $$;

-- Show all customer promo codes
SELECT 'Customer Promo Codes:' as info;
SELECT 
    cpc.code,
    cpc.name,
    c.name as customer_name,
    cpc.loyalty_points_required as threshold,
    cpc.value,
    cpc.promo_type,
    cpc.is_used,
    cpc.used_at,
    cpc.expires_at,
    cpc.created_at
FROM customer_promo_codes cpc
JOIN customers c ON c.id = cpc.customer_id
ORDER BY cpc.created_at DESC
LIMIT 20;

-- Show promo_codes with customer linkage
SELECT 'Promo Codes (with customer linkage):' as info;
SELECT 
    code,
    name,
    customer_id,
    loyalty_points_required,
    current_usage,
    usage_limit,
    is_active,
    valid_until
FROM promo_codes
WHERE customer_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
