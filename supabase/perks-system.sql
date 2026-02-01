-- =============================================
-- ZOIRO BROAST - PERKS & LOYALTY SYSTEM
-- Advanced loyalty points, promo code allocation
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. PERKS SETTINGS TABLE
-- Global settings for loyalty & promo allocation
-- Cached by frontend, only refreshed on change
-- =============================================

CREATE TABLE IF NOT EXISTS perks_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default perks settings
INSERT INTO perks_settings (setting_key, setting_value, description) VALUES
    ('loyalty_points_per_order', '{"enabled": true, "min_order_amount": 500, "points_per_100": 10, "bonus_on_first_order": 50}', 'Points earned per order - 10 points per Rs. 100 spent'),
    ('loyalty_thresholds', '[
        {"points": 100, "promo_type": "percentage", "promo_value": 5, "promo_name": "Bronze Reward", "max_discount": 100},
        {"points": 250, "promo_type": "percentage", "promo_value": 10, "promo_name": "Silver Reward", "max_discount": 250},
        {"points": 500, "promo_type": "percentage", "promo_value": 15, "promo_name": "Gold Reward", "max_discount": 500},
        {"points": 1000, "promo_type": "fixed_amount", "promo_value": 200, "promo_name": "Platinum Reward", "max_discount": null}
    ]', 'Thresholds for auto-generating promo codes'),
    ('order_amount_bonuses', '[
        {"min_amount": 1000, "bonus_points": 20},
        {"min_amount": 2000, "bonus_points": 50},
        {"min_amount": 5000, "bonus_points": 100}
    ]', 'Bonus points for orders above certain amounts'),
    ('promo_expiry_days', '{"default": 30, "reward_codes": 60}', 'Days until promo codes expire'),
    ('dine_in_bonus', '{"enabled": true, "bonus_points": 5, "min_order_amount": 300}', 'Extra points for dine-in orders'),
    ('online_order_bonus', '{"enabled": true, "bonus_points": 10, "min_order_amount": 500}', 'Extra points for online/delivery orders')
ON CONFLICT (setting_key) DO NOTHING;

-- Index and RLS
CREATE INDEX IF NOT EXISTS idx_perks_settings_key ON perks_settings(setting_key);
ALTER TABLE perks_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perks_settings_select" ON perks_settings;
CREATE POLICY "perks_settings_select" ON perks_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "perks_settings_update" ON perks_settings;
CREATE POLICY "perks_settings_update" ON perks_settings FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "perks_settings_insert" ON perks_settings;
CREATE POLICY "perks_settings_insert" ON perks_settings FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON perks_settings TO authenticated;

-- =============================================
-- 2. CUSTOMER PROMO CODES TABLE
-- Auto-generated unique promo codes for customers
-- =============================================

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

CREATE INDEX IF NOT EXISTS idx_customer_promo_customer ON customer_promo_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_promo_code ON customer_promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_customer_promo_active ON customer_promo_codes(is_active, is_used);

ALTER TABLE customer_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_promo_select" ON customer_promo_codes;
CREATE POLICY "customer_promo_select" ON customer_promo_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "customer_promo_insert" ON customer_promo_codes;
CREATE POLICY "customer_promo_insert" ON customer_promo_codes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "customer_promo_update" ON customer_promo_codes;
CREATE POLICY "customer_promo_update" ON customer_promo_codes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "customer_promo_delete" ON customer_promo_codes;
CREATE POLICY "customer_promo_delete" ON customer_promo_codes FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_promo_codes TO authenticated;

-- =============================================
-- 3. LOYALTY POINTS HISTORY VIEW
-- Aggregated view of customer loyalty points
-- =============================================

CREATE OR REPLACE VIEW customer_loyalty_summary AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    c.email as customer_email,
    COALESCE(SUM(lp.points), 0) as total_points,
    COALESCE(SUM(CASE WHEN lp.type = 'earned' THEN lp.points ELSE 0 END), 0) as earned_points,
    COALESCE(SUM(CASE WHEN lp.type = 'redeemed' THEN ABS(lp.points) ELSE 0 END), 0) as redeemed_points,
    COALESCE(SUM(CASE WHEN lp.type = 'bonus' THEN lp.points ELSE 0 END), 0) as bonus_points,
    COUNT(DISTINCT lp.order_id) as orders_with_points,
    MAX(lp.created_at) as last_points_activity
FROM customers c
LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.email;

-- =============================================
-- 4. GET ALL PERKS SETTINGS (CACHED)
-- Returns all settings in one call for caching
-- =============================================

DROP FUNCTION IF EXISTS get_all_perks_settings();
CREATE OR REPLACE FUNCTION get_all_perks_settings()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_object_agg(setting_key, json_build_object(
            'value', setting_value,
            'description', description,
            'is_active', is_active,
            'updated_at', updated_at
        ))
        FROM perks_settings
        WHERE is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_all_perks_settings() TO authenticated;

-- =============================================
-- 5. UPDATE PERKS SETTING
-- =============================================

DROP FUNCTION IF EXISTS update_perks_setting(TEXT, JSONB, TEXT);
CREATE OR REPLACE FUNCTION update_perks_setting(
    p_setting_key TEXT,
    p_setting_value JSONB,
    p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_emp_id UUID;
BEGIN
    -- Get employee ID for audit
    v_emp_id := (auth.jwt() -> 'user_metadata' ->> 'employee_id')::UUID;
    
    UPDATE perks_settings
    SET 
        setting_value = p_setting_value,
        description = COALESCE(p_description, description),
        updated_by = v_emp_id,
        updated_at = NOW()
    WHERE setting_key = p_setting_key;
    
    IF NOT FOUND THEN
        INSERT INTO perks_settings (setting_key, setting_value, description, updated_by)
        VALUES (p_setting_key, p_setting_value, p_description, v_emp_id);
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'setting_key', p_setting_key,
        'message', 'Setting updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_perks_setting(TEXT, JSONB, TEXT) TO authenticated;

-- =============================================
-- 6. GENERATE CUSTOMER PROMO CODE
-- Auto-generates unique promo for customer
-- IMPORTANT: Prevents duplicate promo codes for same threshold
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
    -- Check if this customer already has a promo code for this points threshold (regardless of status)
    IF EXISTS (
        SELECT 1 FROM customer_promo_codes 
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
    
    -- Generate unique code: ZOIRO-CUST-<random>
    v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    
    -- Check uniqueness and regenerate if needed
    WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_code) OR
          EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code) LOOP
        v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    END LOOP;
    
    -- Insert into customer_promo_codes
    INSERT INTO customer_promo_codes (
        customer_id, code, promo_type, value, max_discount,
        name, description, loyalty_points_required, expires_at
    ) VALUES (
        p_customer_id, v_code, p_promo_type, p_promo_value, p_max_discount,
        p_promo_name, 'Loyalty reward for ' || v_customer_name || ' - ' || p_points_required || ' points',
        p_points_required, NOW() + (v_expiry_days || ' days')::INTERVAL
    ) RETURNING id INTO v_new_promo_id;
    
    -- Also create in main promo_codes table with customer_id and loyalty_points_required
    -- This allows the promo to be validated in billing flow
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_customer_promo_code(UUID, INT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;

-- =============================================
-- 7. CHECK AND AWARD LOYALTY PROMO
-- Called after earning points to check thresholds
-- IMPORTANT: Each threshold awards only ONE promo code per customer EVER
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
    
    -- Get ALL thresholds ever awarded to this customer (regardless of is_active, is_used, or expired status)
    -- This ensures each threshold promo is only awarded ONCE per customer lifetime
    SELECT ARRAY_AGG(DISTINCT loyalty_points_required)
    INTO v_already_awarded
    FROM customer_promo_codes
    WHERE customer_id = p_customer_id;
    
    v_already_awarded := COALESCE(v_already_awarded, '{}');
    
    -- Get loyalty thresholds settings
    SELECT setting_value
    INTO v_thresholds
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_thresholds IS NULL OR jsonb_typeof(v_thresholds) != 'array' THEN
        RETURN json_build_object('success', true, 'promos_awarded', 0, 'message', 'No thresholds configured');
    END IF;
    
    -- Check each threshold
    FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds)
    LOOP
        -- If customer has enough points and hasn't EVER been awarded this threshold promo
        IF v_total_points >= (v_threshold->>'points')::INT 
           AND NOT ((v_threshold->>'points')::INT = ANY(v_already_awarded)) THEN
            
            -- Generate promo code
            SELECT generate_customer_promo_code(
                p_customer_id,
                (v_threshold->>'points')::INT,
                v_threshold->>'promo_type',
                v_threshold->>'promo_name',
                (v_threshold->>'promo_value')::DECIMAL,
                (v_threshold->>'max_discount')::DECIMAL
            ) INTO v_promo_result;
            
            -- Only add if generation was successful
            IF (v_promo_result->>'success')::BOOLEAN = true THEN
                v_awarded_promos := array_append(v_awarded_promos, v_promo_result);
            END IF;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'total_points', v_total_points,
        'promos_awarded', COALESCE(array_length(v_awarded_promos, 1), 0),
        'awarded', COALESCE(array_length(v_awarded_promos, 1), 0) > 0,
        'new_promos', v_awarded_promos,
        -- Include first promo details for easy access (most cases award 1 promo at a time)
        'promo_code', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'code' ELSE NULL END,
        'promo_type', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'promo_type' ELSE NULL END,
        'value', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'value')::DECIMAL ELSE NULL END,
        'max_discount', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'max_discount')::DECIMAL ELSE NULL END,
        'expires_at', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'expires_at' ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_and_award_loyalty_promo(UUID) TO authenticated;

-- =============================================
-- 8. CALCULATE LOYALTY POINTS FOR ORDER
-- Uses cached settings to calculate points
-- =============================================

DROP FUNCTION IF EXISTS calculate_order_loyalty_points(DECIMAL, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION calculate_order_loyalty_points(
    p_order_amount DECIMAL(10,2),
    p_order_type TEXT,
    p_is_first_order BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
    v_base_settings JSONB;
    v_order_bonuses JSONB;
    v_dine_in_bonus JSONB;
    v_online_bonus JSONB;
    v_base_points INT := 0;
    v_bonus_points INT := 0;
    v_order_bonus INT := 0;
    v_type_bonus INT := 0;
BEGIN
    -- Get settings
    SELECT setting_value INTO v_base_settings FROM perks_settings WHERE setting_key = 'loyalty_points_per_order' AND is_active = true;
    SELECT setting_value INTO v_order_bonuses FROM perks_settings WHERE setting_key = 'order_amount_bonuses' AND is_active = true;
    SELECT setting_value INTO v_dine_in_bonus FROM perks_settings WHERE setting_key = 'dine_in_bonus' AND is_active = true;
    SELECT setting_value INTO v_online_bonus FROM perks_settings WHERE setting_key = 'online_order_bonus' AND is_active = true;
    
    -- Calculate base points if enabled and min amount met
    IF v_base_settings IS NOT NULL 
       AND (v_base_settings->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_base_settings->>'min_order_amount')::DECIMAL, 0) THEN
        
        v_base_points := FLOOR(p_order_amount / 100) * COALESCE((v_base_settings->>'points_per_100')::INT, 10);
        
        -- First order bonus
        IF p_is_first_order THEN
            v_bonus_points := COALESCE((v_base_settings->>'bonus_on_first_order')::INT, 0);
        END IF;
    END IF;
    
    -- Calculate order amount bonuses (with array type check)
    IF v_order_bonuses IS NOT NULL AND jsonb_typeof(v_order_bonuses) = 'array' THEN
        SELECT COALESCE(MAX((bonus->>'bonus_points')::INT), 0)
        INTO v_order_bonus
        FROM jsonb_array_elements(v_order_bonuses) bonus
        WHERE p_order_amount >= (bonus->>'min_amount')::DECIMAL;
    END IF;
    
    -- Calculate order type bonus
    IF p_order_type = 'dine-in' AND v_dine_in_bonus IS NOT NULL 
       AND (v_dine_in_bonus->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_dine_in_bonus->>'min_order_amount')::DECIMAL, 0) THEN
        v_type_bonus := COALESCE((v_dine_in_bonus->>'bonus_points')::INT, 0);
    ELSIF p_order_type IN ('delivery', 'online') AND v_online_bonus IS NOT NULL
       AND (v_online_bonus->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_online_bonus->>'min_order_amount')::DECIMAL, 0) THEN
        v_type_bonus := COALESCE((v_online_bonus->>'bonus_points')::INT, 0);
    END IF;
    
    RETURN json_build_object(
        'base_points', v_base_points,
        'first_order_bonus', v_bonus_points,
        'order_amount_bonus', v_order_bonus,
        'order_type_bonus', v_type_bonus,
        'total_points', v_base_points + v_bonus_points + v_order_bonus + v_type_bonus
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_order_loyalty_points(DECIMAL, TEXT, BOOLEAN) TO authenticated;

-- =============================================
-- 9. USE CUSTOMER PROMO CODE
-- Marks promo as used and deletes if fully used
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
BEGIN
    -- Find the customer promo code
    SELECT * INTO v_promo
    FROM customer_promo_codes
    WHERE code = UPPER(p_code)
    AND customer_id = p_customer_id
    AND is_active = true
    AND is_used = false
    AND expires_at > NOW();
    
    IF v_promo IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found, expired, or already used');
    END IF;
    
    -- Mark as used
    UPDATE customer_promo_codes
    SET is_used = true, used_at = NOW(), used_on_order_id = p_order_id, is_active = false
    WHERE id = v_promo.id;
    
    -- Update main promo_codes table
    UPDATE promo_codes
    SET current_usage = usage_limit, is_active = false, updated_at = NOW()
    WHERE code = UPPER(p_code);
    
    RETURN json_build_object(
        'success', true,
        'promo_type', v_promo.promo_type,
        'value', v_promo.value,
        'max_discount', v_promo.max_discount,
        'message', 'Promo code applied successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION use_customer_promo_code(TEXT, UUID, UUID) TO authenticated;

-- =============================================
-- 10. GET CUSTOMER PROMO CODES
-- =============================================

DROP FUNCTION IF EXISTS get_customer_promo_codes(UUID);
CREATE OR REPLACE FUNCTION get_customer_promo_codes(p_customer_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json)
        FROM (
            SELECT 
                id, code, promo_type, value, max_discount, name, description,
                loyalty_points_required, is_used, used_at, expires_at, is_active, created_at,
                CASE WHEN expires_at < NOW() THEN true ELSE false END as is_expired
            FROM customer_promo_codes
            WHERE customer_id = p_customer_id
            ORDER BY created_at DESC
        ) cp
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_customer_promo_codes(UUID) TO authenticated;

-- =============================================
-- 11. GET CUSTOMER LOYALTY SUMMARY
-- =============================================

DROP FUNCTION IF EXISTS get_customer_loyalty_summary(UUID);
CREATE OR REPLACE FUNCTION get_customer_loyalty_summary(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
    v_summary RECORD;
    v_recent_points JSON;
    v_available_promos JSON;
BEGIN
    -- Get summary
    SELECT * INTO v_summary FROM customer_loyalty_summary WHERE customer_id = p_customer_id;
    
    -- Get recent points activity
    SELECT COALESCE(json_agg(lp), '[]'::json)
    INTO v_recent_points
    FROM (
        SELECT points, type, description, created_at
        FROM loyalty_points
        WHERE customer_id = p_customer_id
        ORDER BY created_at DESC
        LIMIT 10
    ) lp;
    
    -- Get available promos
    SELECT COALESCE(json_agg(cp), '[]'::json)
    INTO v_available_promos
    FROM (
        SELECT code, name, promo_type, value, max_discount, expires_at
        FROM customer_promo_codes
        WHERE customer_id = p_customer_id 
        AND is_active = true 
        AND is_used = false 
        AND expires_at > NOW()
    ) cp;
    
    RETURN json_build_object(
        'customer_id', p_customer_id,
        'customer_name', v_summary.customer_name,
        'total_points', COALESCE(v_summary.total_points, 0),
        'earned_points', COALESCE(v_summary.earned_points, 0),
        'redeemed_points', COALESCE(v_summary.redeemed_points, 0),
        'bonus_points', COALESCE(v_summary.bonus_points, 0),
        'orders_with_points', COALESCE(v_summary.orders_with_points, 0),
        'last_activity', v_summary.last_points_activity,
        'recent_points', v_recent_points,
        'available_promos', v_available_promos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_customer_loyalty_summary(UUID) TO authenticated;

-- =============================================
-- 12. CLEANUP EXPIRED PROMO CODES (CRON)
-- Cleans up promo_codes table
-- =============================================

DROP FUNCTION IF EXISTS cleanup_expired_customer_promos();
CREATE OR REPLACE FUNCTION cleanup_expired_customer_promos()
RETURNS JSON AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Deactivate expired promo codes
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE valid_until < NOW() AND is_active = true;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'deactivated_count', v_count,
        'message', 'Expired promo codes cleaned up'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_expired_customer_promos() TO authenticated;

-- =============================================
-- 13. GET ALL CUSTOMERS WITH LOYALTY INFO
-- For admin perks management - Returns complete loyalty data
-- Uses loyalty_points table (transaction log style) with SUM aggregation
-- =============================================

DROP FUNCTION IF EXISTS get_all_customers_loyalty(INT, INT, TEXT);
CREATE OR REPLACE FUNCTION get_all_customers_loyalty(
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_search TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'customers', COALESCE(json_agg(c ORDER BY total_points DESC), '[]'::json),
            'total', (SELECT COUNT(*) FROM customers
                      WHERE p_search IS NULL 
                         OR name ILIKE '%' || p_search || '%'
                         OR phone ILIKE '%' || p_search || '%'
                         OR email ILIKE '%' || p_search || '%')
        )
        FROM (
            SELECT 
                cust.id as customer_id, 
                cust.name as customer_name, 
                cust.phone as customer_phone, 
                cust.email as customer_email,
                cust.created_at as member_since,
                -- Calculate total points from loyalty_points transaction log
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id
                ), 0)::INT as total_points,
                -- Current balance (same as total for now since we track transactions)
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id
                ), 0)::INT as current_balance,
                -- Calculate tier based on total points using CASE
                CASE 
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 1000 THEN 'platinum'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 500 THEN 'gold'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 250 THEN 'silver'
                    ELSE 'bronze'
                END as tier,
                -- Earned points (type = 'earned' or 'bonus')
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp 
                    WHERE lp.customer_id = cust.id AND lp.type IN ('earned', 'bonus')
                ), 0)::INT as total_points_earned,
                -- Redeemed points (type = 'redeemed', stored as negative)
                COALESCE((
                    SELECT ABS(SUM(lp.points)) FROM loyalty_points lp 
                    WHERE lp.customer_id = cust.id AND lp.type = 'redeemed'
                ), 0)::INT as total_points_redeemed,
                -- Order stats
                COALESCE((
                    SELECT COUNT(*) FROM orders o WHERE o.customer_id = cust.id
                ), 0)::INT as total_transactions,
                (SELECT MIN(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as first_transaction,
                (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as last_transaction,
                -- Active promos count from promo_codes table
                (SELECT COUNT(*) FROM promo_codes pc 
                 WHERE pc.customer_id = cust.id AND pc.is_active = true 
                 AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit)
                 AND pc.valid_until > NOW()) as active_promos
            FROM customers cust
            WHERE p_search IS NULL 
               OR cust.name ILIKE '%' || p_search || '%'
               OR cust.phone ILIKE '%' || p_search || '%'
               OR cust.email ILIKE '%' || p_search || '%'
            ORDER BY (SELECT COALESCE(SUM(lp.points), 0) FROM loyalty_points lp WHERE lp.customer_id = cust.id) DESC
            LIMIT p_limit OFFSET p_offset
        ) c
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_all_customers_loyalty(INT, INT, TEXT) TO authenticated;

-- =============================================
-- 14. CHECK PROMO CODE DETAILS
-- Validates a promo code and returns full details
-- =============================================

DROP FUNCTION IF EXISTS check_promo_code_details(TEXT, UUID);
CREATE OR REPLACE FUNCTION check_promo_code_details(
    p_code TEXT,
    p_customer_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_customer_promo RECORD;
    v_general_promo RECORD;
    v_is_valid BOOLEAN := false;
    v_error_message TEXT := NULL;
    v_promo_source TEXT := NULL;
    v_result JSON;
BEGIN
    -- First check customer-specific promo codes
    IF p_customer_id IS NOT NULL THEN
        SELECT * INTO v_customer_promo
        FROM customer_promo_codes
        WHERE UPPER(code) = UPPER(p_code);
        
        IF v_customer_promo IS NOT NULL THEN
            -- Found in customer promos
            v_promo_source := 'customer_reward';
            
            IF v_customer_promo.customer_id != p_customer_id THEN
                v_error_message := 'This promo code belongs to another customer';
            ELSIF v_customer_promo.is_used THEN
                v_error_message := 'This promo code has already been used';
            ELSIF v_customer_promo.expires_at < NOW() THEN
                v_error_message := 'This promo code has expired';
            ELSIF NOT v_customer_promo.is_active THEN
                v_error_message := 'This promo code is no longer active';
            ELSE
                v_is_valid := true;
            END IF;
            
            RETURN json_build_object(
                'found', true,
                'valid', v_is_valid,
                'error', v_error_message,
                'source', v_promo_source,
                'promo', json_build_object(
                    'id', v_customer_promo.id,
                    'code', v_customer_promo.code,
                    'name', v_customer_promo.name,
                    'description', v_customer_promo.description,
                    'promo_type', v_customer_promo.promo_type,
                    'value', v_customer_promo.value,
                    'max_discount', v_customer_promo.max_discount,
                    'loyalty_points_required', v_customer_promo.loyalty_points_required,
                    'is_used', v_customer_promo.is_used,
                    'used_at', v_customer_promo.used_at,
                    'expires_at', v_customer_promo.expires_at,
                    'is_active', v_customer_promo.is_active,
                    'created_at', v_customer_promo.created_at
                )
            );
        END IF;
    END IF;
    
    -- Check general promo codes
    SELECT * INTO v_general_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code);
    
    IF v_general_promo IS NULL THEN
        RETURN json_build_object(
            'found', false,
            'valid', false,
            'error', 'Promo code not found',
            'source', NULL,
            'promo', NULL
        );
    END IF;
    
    v_promo_source := 'general';
    
    IF NOT v_general_promo.is_active THEN
        v_error_message := 'This promo code is no longer active';
    ELSIF v_general_promo.valid_from > NOW() THEN
        v_error_message := 'This promo code is not yet active';
    ELSIF v_general_promo.valid_until < NOW() THEN
        v_error_message := 'This promo code has expired';
    ELSIF v_general_promo.usage_limit IS NOT NULL AND v_general_promo.current_usage >= v_general_promo.usage_limit THEN
        v_error_message := 'This promo code usage limit has been reached';
    ELSE
        v_is_valid := true;
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'valid', v_is_valid,
        'error', v_error_message,
        'source', v_promo_source,
        'promo', json_build_object(
            'id', v_general_promo.id,
            'code', v_general_promo.code,
            'name', v_general_promo.name,
            'description', v_general_promo.description,
            'promo_type', v_general_promo.promo_type,
            'value', v_general_promo.value,
            'max_discount', v_general_promo.max_discount,
            'min_order_amount', v_general_promo.min_order_amount,
            'valid_from', v_general_promo.valid_from,
            'valid_until', v_general_promo.valid_until,
            'usage_limit', v_general_promo.usage_limit,
            'current_usage', v_general_promo.current_usage,
            'is_active', v_general_promo.is_active,
            'created_at', v_general_promo.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_promo_code_details(TEXT, UUID) TO authenticated;

-- =============================================
-- 15. GET ALL CUSTOMER PROMO CODES (ADMIN)
-- Returns all promo codes with customer info for admin portal
-- Fetches from BOTH customer_promo_codes AND promo_codes tables
-- Bypasses RLS with SECURITY DEFINER
-- =============================================

DROP FUNCTION IF EXISTS get_all_customer_promo_codes_admin(INT, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_all_customer_promo_codes_admin(
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0,
    p_filter TEXT DEFAULT 'all',  -- 'all', 'active', 'used', 'expired'
    p_search TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_total INT;
BEGIN
    -- Get total count from promo_codes table
    SELECT COUNT(*) INTO v_total
    FROM promo_codes pc
    LEFT JOIN customers c ON c.id = pc.customer_id
    WHERE (p_search IS NULL 
           OR c.name ILIKE '%' || p_search || '%'
           OR c.phone ILIKE '%' || p_search || '%'
           OR pc.code ILIKE '%' || p_search || '%')
      AND (p_filter = 'all'
           OR (p_filter = 'active' AND pc.is_active = true AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit) AND pc.valid_until > NOW())
           OR (p_filter = 'used' AND pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit)
           OR (p_filter = 'expired' AND pc.valid_until < NOW()));

    -- Get paginated results from promo_codes table
    SELECT COALESCE(json_agg(row_to_json(promo_row)), '[]'::json)
    INTO v_result
    FROM (
        SELECT 
            pc.id,
            pc.customer_id,
            COALESCE(c.name, 'All Customers') as customer_name,
            c.email as customer_email,
            c.phone as customer_phone,
            pc.code,
            pc.promo_type::TEXT as promo_type,
            pc.value,
            pc.max_discount,
            pc.name,
            pc.description,
            pc.usage_limit,
            pc.current_usage,
            pc.is_active,
            (pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit) as is_used,
            NULL::TIMESTAMPTZ as used_at,
            pc.valid_until as expires_at,
            pc.created_at,
            CASE 
                WHEN pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit THEN 'used'
                WHEN pc.valid_until < NOW() THEN 'expired'
                WHEN pc.is_active THEN 'active'
                ELSE 'inactive'
            END as status
        FROM promo_codes pc
        LEFT JOIN customers c ON c.id = pc.customer_id
        WHERE (p_search IS NULL 
               OR c.name ILIKE '%' || p_search || '%'
               OR c.phone ILIKE '%' || p_search || '%'
               OR pc.code ILIKE '%' || p_search || '%')
          AND (p_filter = 'all'
               OR (p_filter = 'active' AND pc.is_active = true AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit) AND pc.valid_until > NOW())
               OR (p_filter = 'used' AND pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit)
               OR (p_filter = 'expired' AND pc.valid_until < NOW()))
        ORDER BY pc.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) promo_row;

    RETURN json_build_object(
        'success', true,
        'promos', v_result,
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_all_customer_promo_codes_admin(INT, INT, TEXT, TEXT) TO authenticated;

-- =============================================
-- 16. DEACTIVATE CUSTOMER PROMO CODE (ADMIN)
-- Deactivates promo code by ID
-- =============================================

DROP FUNCTION IF EXISTS deactivate_customer_promo_admin(UUID);
CREATE OR REPLACE FUNCTION deactivate_customer_promo_admin(p_promo_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code deactivated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION deactivate_customer_promo_admin(UUID) TO authenticated;

-- =============================================
-- 17. ACTIVATE CUSTOMER PROMO CODE (ADMIN)
-- Reactivates a deactivated promo code by ID
-- =============================================

DROP FUNCTION IF EXISTS activate_customer_promo_admin(UUID);
CREATE OR REPLACE FUNCTION activate_customer_promo_admin(p_promo_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE promo_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code activated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION activate_customer_promo_admin(UUID) TO authenticated;

-- =============================================
-- 18. DELETE CUSTOMER PROMO CODE (ADMIN)
-- Permanently deletes a promo code by ID
-- =============================================

DROP FUNCTION IF EXISTS delete_customer_promo_admin(UUID);
CREATE OR REPLACE FUNCTION delete_customer_promo_admin(p_promo_id UUID)
RETURNS JSON AS $$
BEGIN
    DELETE FROM promo_codes
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_customer_promo_admin(UUID) TO authenticated;

-- =============================================
-- 19. BULK ACTIVATE PROMO CODES (ADMIN)
-- Activates multiple promo codes at once
-- =============================================

DROP FUNCTION IF EXISTS bulk_activate_promo_codes_admin(UUID[]);
CREATE OR REPLACE FUNCTION bulk_activate_promo_codes_admin(p_promo_ids UUID[])
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'activated_count', v_count,
        'message', v_count || ' promo codes activated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_activate_promo_codes_admin(UUID[]) TO authenticated;

-- =============================================
-- 20. BULK DEACTIVATE PROMO CODES (ADMIN)
-- Deactivates multiple promo codes at once
-- =============================================

DROP FUNCTION IF EXISTS bulk_deactivate_promo_codes_admin(UUID[]);
CREATE OR REPLACE FUNCTION bulk_deactivate_promo_codes_admin(p_promo_ids UUID[])
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deactivated_count', v_count,
        'message', v_count || ' promo codes deactivated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_deactivate_promo_codes_admin(UUID[]) TO authenticated;

-- =============================================
-- 21. BULK DELETE PROMO CODES (ADMIN)
-- Deletes multiple promo codes at once
-- =============================================

DROP FUNCTION IF EXISTS bulk_delete_promo_codes_admin(UUID[]);
CREATE OR REPLACE FUNCTION bulk_delete_promo_codes_admin(p_promo_ids UUID[])
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM promo_codes
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deleted_count', v_count,
        'message', v_count || ' promo codes deleted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_delete_promo_codes_admin(UUID[]) TO authenticated;

-- =============================================
-- 22. ACTIVATE/DEACTIVATE ALL PROMO CODES (ADMIN)
-- Activates or deactivates all promo codes based on filter
-- =============================================

DROP FUNCTION IF EXISTS toggle_all_promo_codes_admin(BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION toggle_all_promo_codes_admin(
    p_activate BOOLEAN,  -- true = activate, false = deactivate
    p_filter TEXT DEFAULT 'all'  -- 'all', 'expired', 'active', 'inactive'
)
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_filter = 'expired' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE valid_until < NOW();
    ELSIF p_filter = 'active' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE is_active = true;
    ELSIF p_filter = 'inactive' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE is_active = false;
    ELSE
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW();
    END IF;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'updated_count', v_count,
        'action', CASE WHEN p_activate THEN 'activated' ELSE 'deactivated' END,
        'message', v_count || ' promo codes ' || CASE WHEN p_activate THEN 'activated' ELSE 'deactivated' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_all_promo_codes_admin(BOOLEAN, TEXT) TO authenticated;

-- Done!
SELECT 'Perks system tables and functions created successfully!' as status;
