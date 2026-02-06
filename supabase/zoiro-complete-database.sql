-- ============================================================================
-- ZOIRO BROAST HUB - Complete Database SQL
-- Generated from live Supabase database
-- Contains: Extensions, Enums, Sequences, Functions (RPCs), Triggers
-- Only includes RPCs actively used in the website codebase
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";

-- ============================================================================
-- SECTION 2: CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'on_leave');
CREATE TYPE public.employee_role AS ENUM ('admin', 'manager', 'waiter', 'billing_staff', 'kitchen_staff', 'delivery_rider', 'other');
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'blocked', 'pending');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'paid', 'cancelled', 'refunded');
CREATE TYPE public.notification_type AS ENUM ('order', 'system', 'alert', 'promo', 'message', 'attendance');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
CREATE TYPE public.order_type AS ENUM ('online', 'walk-in', 'dine-in');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'online', 'wallet');
CREATE TYPE public.promo_type AS ENUM ('percentage', 'fixed_amount', 'free_item', 'loyalty_points');
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'reserved', 'cleaning', 'out_of_service');
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'cashier', 'reception', 'kitchen', 'waiter', 'billing_staff', 'kitchen_staff', 'delivery_rider', 'other');

-- ============================================================================
-- SECTION 3: SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;

-- ============================================================================
-- SECTION 4: HELPER / UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role = 'admin'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_employee()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() AND status = 'active'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('admin', 'manager')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles text[])
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
            AND role::TEXT = ANY(allowed_roles) 
            AND status = 'active'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_employee_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id
    FROM employees
    WHERE auth_user_id = auth.uid()
    AND status = 'active';
    
    RETURN emp_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_customer_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT id FROM customers 
        WHERE auth_user_id = auth.uid()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_employee_id(p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF p_employee_id IS NOT NULL THEN RETURN p_employee_id; END IF;
  RETURN get_employee_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_manager_or_admin(p_caller_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  caller_id UUID;
  caller_role VARCHAR;
BEGIN
  caller_id := COALESCE(p_caller_id, get_employee_id());
  IF caller_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role INTO caller_role FROM employees WHERE id = caller_id AND status = 'active';
  RETURN caller_role IN ('admin', 'manager');
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_table_availability(p_table_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_is_available BOOLEAN;
BEGIN
    SELECT status = 'available' INTO v_is_available
    FROM restaurant_tables
    WHERE id = p_table_id;
    
    RETURN COALESCE(v_is_available, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_slug(text_input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    slug TEXT;
BEGIN
    slug := lower(trim(text_input));
    slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
    slug := regexp_replace(slug, '\s+', '-', 'g');
    slug := regexp_replace(slug, '-+', '-', 'g');
    slug := trim(both '-' from slug);
    
    IF slug = '' OR slug IS NULL THEN
        slug := 'item-' || substr(md5(random()::text), 1, 8);
    END IF;
    
    RETURN slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_license_id()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'LIC-';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_delivery_history_record(p_rider_id uuid, p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO delivery_history (
        rider_id, order_id, order_number, order_snapshot,
        customer_name, customer_phone, customer_address, customer_email,
        items, total_items, subtotal, delivery_fee, total,
        payment_method, payment_status, accepted_at, delivery_status
    ) VALUES (
        p_rider_id, v_order.id, v_order.order_number,
        row_to_json(v_order)::jsonb,
        v_order.customer_name, v_order.customer_phone,
        v_order.customer_address, v_order.customer_email,
        v_order.items, COALESCE(jsonb_array_length(v_order.items::jsonb), 0),
        COALESCE(v_order.subtotal, 0), COALESCE(v_order.delivery_fee, 0),
        COALESCE(v_order.total, 0),
        v_order.payment_method::TEXT, v_order.payment_status,
        NOW(), 'accepted'
    )
    ON CONFLICT (rider_id, order_id) DO UPDATE SET
        order_snapshot = EXCLUDED.order_snapshot,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_address = EXCLUDED.customer_address,
        items = EXCLUDED.items,
        total = EXCLUDED.total,
        updated_at = NOW();
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating delivery history: %', SQLERRM;
    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_customer_promo_code(p_customer_id uuid, p_points_required integer, p_promo_type text, p_promo_name text, p_promo_value numeric, p_max_discount numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_code TEXT;
    v_expiry_days INT;
    v_new_promo_id UUID;
    v_customer_name TEXT;
BEGIN
    SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id;
    
    IF v_customer_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
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
    
    SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
    INTO v_expiry_days
    FROM perks_settings
    WHERE setting_key = 'promo_expiry_days';
    
    v_expiry_days := COALESCE(v_expiry_days, 60);
    
    v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    
    WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_code) OR
          EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code) LOOP
        v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    END LOOP;
    
    INSERT INTO customer_promo_codes (
        customer_id, code, promo_type, value, max_discount,
        name, description, loyalty_points_required, expires_at
    ) VALUES (
        p_customer_id, v_code, p_promo_type, p_promo_value, p_max_discount,
        p_promo_name, 'Loyalty reward for ' || v_customer_name || ' - ' || p_points_required || ' points',
        p_points_required, NOW() + (v_expiry_days || ' days')::INTERVAL
    ) RETURNING id INTO v_new_promo_id;
    
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
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hourly_sales(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    v_is_single_day BOOLEAN := (p_start_date = p_end_date);
BEGIN
    IF v_is_single_day THEN
        WITH hourly_data AS (
            SELECT 
                EXTRACT(HOUR FROM created_at)::int AS hour,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) = p_start_date
              AND status NOT IN ('cancelled')
            GROUP BY EXTRACT(HOUR FROM created_at)
        ),
        all_hours AS (
            SELECT generate_series(0, 23) AS hour
        ),
        combined AS (
            SELECT 
                ah.hour,
                COALESCE(hd.sales, 0) AS sales,
                COALESCE(hd.orders, 0) AS orders
            FROM all_hours ah
            LEFT JOIN hourly_data hd ON ah.hour = hd.hour
            ORDER BY ah.hour
        )
        SELECT json_build_object(
            'type', 'hourly',
            'data', (SELECT json_agg(json_build_object('hour', hour, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'peak_hour', (SELECT hour FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date - 1 AND status NOT IN ('cancelled')),
                'previous_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date - 1)
            )
        ) INTO result;
    ELSE
        WITH daily_data AS (
            SELECT 
                DATE(created_at) AS date,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        ),
        all_days AS (
            SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date
        ),
        combined AS (
            SELECT 
                ad.date,
                COALESCE(dd.sales, 0) AS sales,
                COALESCE(dd.orders, 0) AS orders
            FROM all_days ad
            LEFT JOIN daily_data dd ON ad.date = dd.date
            ORDER BY ad.date
        )
        SELECT json_build_object(
            'type', 'daily',
            'data', (SELECT json_agg(json_build_object('date', date, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'best_day', (SELECT date FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_period_sales', (
                    SELECT COALESCE(SUM(total), 0) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                      AND status NOT IN ('cancelled')
                ),
                'previous_period_orders', (
                    SELECT COUNT(*) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                )
            )
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_award_loyalty_promo(p_customer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_points INT;
    v_thresholds JSONB;
    v_threshold JSONB;
    v_promo_result JSON;
    v_already_awarded INT[];
    v_awarded_promos JSON[] := '{}';
    v_threshold_points INT;
BEGIN
    SELECT COALESCE(SUM(points), 0)::INT
    INTO v_total_points
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
    
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
    
    SELECT setting_value
    INTO v_thresholds
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_thresholds IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'No thresholds configured',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    IF jsonb_typeof(v_thresholds) != 'array' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Thresholds config is invalid',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds) ORDER BY (value->>'points')::INT ASC
    LOOP
        v_threshold_points := (v_threshold->>'points')::INT;
        
        IF v_total_points >= v_threshold_points THEN
            IF NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                SELECT generate_customer_promo_code(
                    p_customer_id,
                    v_threshold_points,
                    COALESCE(v_threshold->>'promo_type', 'percentage'),
                    COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10),
                    (v_threshold->>'max_discount')::DECIMAL
                ) INTO v_promo_result;
                
                IF v_promo_result IS NOT NULL AND (v_promo_result->>'success')::BOOLEAN = true THEN
                    v_awarded_promos := array_append(v_awarded_promos, v_promo_result);
                    v_already_awarded := array_append(v_already_awarded, v_threshold_points);
                END IF;
            END IF;
        END IF;
    END LOOP;
    
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
    RETURN json_build_object('success', false, 'error', SQLERRM, 'total_points', 0, 'awarded', false);
END;
$function$;

-- ============================================================================
-- SECTION 5: TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_employee_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.employee_id IS NULL THEN
        NEW.employee_id = 'EMP-' || LPAD(NEXTVAL('employee_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.invoice_number = 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_menu_item_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        base_slug := generate_slug(NEW.name);
        final_slug := base_slug;
        
        WHILE EXISTS (
            SELECT 1 FROM menu_items 
            WHERE slug = final_slug 
            AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        ) LOOP
            counter := counter + 1;
            final_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := final_slug;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_loyalty_promo_on_points_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSON;
BEGIN
    IF NEW.type != 'earned' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.customer_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    BEGIN
        SELECT check_and_award_loyalty_promo(NEW.customer_id) INTO v_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'TRIGGER ERROR: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, status, notes)
        VALUES (NEW.id, NEW.status, 'Status automatically updated to ' || NEW.status);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM pg_notify(
        'new_notification',
        json_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'user_type', NEW.user_type,
            'title', NEW.title,
            'type', NEW.type
        )::text
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM pg_notify(
            'order_status_changed',
            json_build_object(
                'order_id', NEW.id,
                'customer_id', NEW.customer_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'updated_at', NEW.updated_at
            )::text
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_cleanup_otps_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM otp_codes 
    WHERE email = NEW.email 
      AND (expires_at < NOW() OR is_used = TRUE OR id != NEW.id);
    
    RETURN NEW;
END;
$function$;

-- ============================================================================
-- SECTION 6: RPC FUNCTIONS (Used in Website)
-- ============================================================================

-- ==================== BATCH A: accept_* through complete_* ====================

CREATE OR REPLACE FUNCTION public.accept_delivery_order(p_order_id uuid, p_rider_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_rider RECORD;
BEGIN
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = v_rider_id AND role = 'delivery_rider' AND status = 'active';
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not a valid delivery rider');
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    IF v_order.status != 'ready' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for delivery');
    END IF;
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    UPDATE orders SET
        delivery_rider_id = v_rider_id,
        status = 'delivering'::order_status,
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    PERFORM create_delivery_history_record(v_rider_id, p_order_id);
    UPDATE delivery_history
    SET delivery_status = 'delivering', started_at = NOW(), updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivering', 'Accepted by rider: ' || v_rider.name, v_rider_id, NOW());
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'order', jsonb_build_object(
            'id', v_order.id, 'order_number', v_order.order_number,
            'customer_name', v_order.customer_name, 'customer_phone', v_order.customer_phone,
            'customer_address', v_order.customer_address, 'total', v_order.total,
            'payment_method', v_order.payment_method
        ),
        'rider', jsonb_build_object('id', v_rider.id, 'name', v_rider.name, 'phone', v_rider.phone)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_customer_promo_admin(p_promo_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE promo_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = p_promo_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    RETURN json_build_object('success', true, 'message', 'Promo code activated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_employee(emp_id uuid, user_auth_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE employees
    SET auth_user_id = user_auth_id, is_verified = true, status = 'active', updated_at = NOW()
    WHERE id = emp_id AND status = 'pending';
    RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_employee(p_employee_id uuid, p_enable_portal boolean DEFAULT true, p_activated_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_old_status TEXT;
  v_new_license_id TEXT;
BEGIN
  SELECT name, status::TEXT INTO v_employee_name, v_old_status
  FROM employees WHERE id = p_employee_id;
  IF v_employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;
  UPDATE employees SET
    status = 'active'::employee_status, portal_enabled = p_enable_portal, updated_at = NOW()
  WHERE id = p_employee_id;
  IF p_enable_portal THEN
    v_new_license_id := 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4));
    UPDATE employee_licenses SET expires_at = NOW() WHERE employee_id = p_employee_id;
    INSERT INTO employee_licenses (employee_id, license_id, is_used, expires_at)
    VALUES (p_employee_id, v_new_license_id, false, NOW() + INTERVAL '30 days');
    UPDATE employees SET license_id = v_new_license_id WHERE id = p_employee_id;
  END IF;
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
  VALUES ('activate_employee', 'employees', p_employee_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'active', 'portal_enabled', p_enable_portal),
    p_activated_by);
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" has been activated',
    'previous_status', v_old_status,
    'portal_enabled', p_enable_portal,
    'new_license_id', v_new_license_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee RECORD;
    v_license_updated BOOLEAN := FALSE;
BEGIN
    p_email := LOWER(TRIM(p_email));
    UPDATE employees
    SET auth_user_id = p_auth_user_id, status = 'active', portal_enabled = TRUE, updated_at = NOW()
    WHERE LOWER(email) = p_email
    RETURNING id, name, email, role, employee_id, permissions INTO v_employee;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Employee not found');
    END IF;
    IF p_license_id IS NOT NULL AND p_license_id != '' THEN
        UPDATE employee_licenses
        SET is_used = TRUE, activated_at = NOW()
        WHERE employee_id = v_employee.id AND license_id = UPPER(TRIM(p_license_id));
        v_license_updated := FOUND;
    ELSE
        UPDATE employee_licenses
        SET is_used = TRUE, activated_at = NOW()
        WHERE id = (
            SELECT id FROM employee_licenses
            WHERE employee_id = v_employee.id AND is_used = FALSE AND expires_at > NOW()
            ORDER BY expires_at ASC LIMIT 1
        );
        v_license_updated := FOUND;
    END IF;
    RETURN jsonb_build_object(
        'success', TRUE,
        'employee', jsonb_build_object(
            'id', v_employee.id, 'name', v_employee.name, 'email', v_employee.email,
            'role', v_employee.role::TEXT, 'employee_id', v_employee.employee_id,
            'permissions', v_employee.permissions
        ),
        'license_updated', v_license_updated
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_contact_message_reply(p_message_id uuid, p_reply_message text, p_replied_by uuid, p_send_via text DEFAULT 'email'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_email TEXT;
    v_name TEXT;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    IF p_reply_message IS NULL OR LENGTH(TRIM(p_reply_message)) < 5 THEN
        RETURN json_build_object('success', false, 'error', 'Reply message is required');
    END IF;
    SELECT email, name INTO v_email, v_name FROM contact_messages WHERE id = p_message_id;
    IF v_email IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Message not found');
    END IF;
    UPDATE contact_messages SET
        reply_message = TRIM(p_reply_message), replied_by = p_replied_by,
        replied_at = NOW(), reply_sent_via = p_send_via,
        status = 'replied', updated_at = NOW()
    WHERE id = p_message_id;
    RETURN json_build_object(
        'success', true, 'message', 'Reply saved', 'send_email', true,
        'recipient_email', v_email, 'recipient_name', v_name
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_item_id uuid, p_transaction_type text, p_quantity numeric, p_reason text DEFAULT NULL::text, p_unit_cost numeric DEFAULT NULL::numeric, p_reference_number text DEFAULT NULL::text, p_batch_number text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    item_record RECORD;
    new_quantity DECIMAL(10,2);
    actual_cost DECIMAL(10,2);
    qty_change DECIMAL(10,2);
BEGIN
    emp_id := get_employee_id();
    SELECT * INTO item_record FROM inventory WHERE id = p_item_id;
    IF item_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    CASE p_transaction_type
        WHEN 'purchase' THEN new_quantity := COALESCE(item_record.quantity, 0) + p_quantity; qty_change := p_quantity;
        WHEN 'usage' THEN new_quantity := COALESCE(item_record.quantity, 0) - p_quantity; qty_change := -p_quantity;
        WHEN 'waste' THEN new_quantity := COALESCE(item_record.quantity, 0) - p_quantity; qty_change := -p_quantity;
        WHEN 'return' THEN new_quantity := COALESCE(item_record.quantity, 0) + p_quantity; qty_change := p_quantity;
        WHEN 'transfer_in' THEN new_quantity := COALESCE(item_record.quantity, 0) + p_quantity; qty_change := p_quantity;
        WHEN 'transfer_out' THEN new_quantity := COALESCE(item_record.quantity, 0) - p_quantity; qty_change := -p_quantity;
        WHEN 'adjustment' THEN qty_change := p_quantity - COALESCE(item_record.quantity, 0); new_quantity := p_quantity;
        WHEN 'count' THEN qty_change := p_quantity - COALESCE(item_record.quantity, 0); new_quantity := p_quantity;
        ELSE RETURN json_build_object('success', false, 'error', 'Invalid transaction type');
    END CASE;
    IF new_quantity < 0 AND p_transaction_type NOT IN ('adjustment', 'count') THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient stock. Current: ' || COALESCE(item_record.quantity, 0));
    END IF;
    actual_cost := COALESCE(p_unit_cost, item_record.cost_per_unit, 0);
    UPDATE inventory SET
        quantity = new_quantity,
        last_restocked = CASE WHEN p_transaction_type IN ('purchase', 'return', 'transfer_in') THEN NOW() ELSE last_restocked END,
        updated_at = NOW()
    WHERE id = p_item_id;
    INSERT INTO inventory_transactions (
        inventory_id, type, transaction_type, quantity, quantity_change,
        previous_quantity, new_quantity, unit_cost, total_cost, notes, reason,
        created_by, performed_by, reference_number, batch_number, created_at
    ) VALUES (
        p_item_id, p_transaction_type, p_transaction_type, ABS(qty_change), qty_change,
        COALESCE(item_record.quantity, 0), new_quantity, actual_cost, ABS(qty_change) * actual_cost,
        p_reason, p_reason, emp_id, emp_id, p_reference_number, p_batch_number, NOW()
    );
    IF new_quantity <= 0 THEN
        INSERT INTO inventory_alerts (inventory_id, alert_type, message, created_at)
        VALUES (p_item_id, 'out_of_stock', item_record.name || ' is now out of stock', NOW())
        ON CONFLICT DO NOTHING;
    ELSIF new_quantity <= COALESCE(item_record.min_quantity, 10) THEN
        INSERT INTO inventory_alerts (inventory_id, alert_type, message, created_at)
        VALUES (p_item_id, 'low_stock', item_record.name || ' is running low (' || new_quantity || ' ' || item_record.unit || ' remaining)', NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN json_build_object('success', true, 'new_quantity', new_quantity, 'previous_quantity', COALESCE(item_record.quantity, 0), 'change', qty_change);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mark_attendance(p_employee_id uuid, p_date date, p_check_in timestamp with time zone, p_check_out timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status character varying DEFAULT 'present'::character varying, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result RECORD;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found');
    END IF;
    INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes, created_at, updated_at)
    VALUES (p_employee_id, p_date, p_check_in, p_check_out, p_status, p_notes, NOW(), NOW())
    ON CONFLICT (employee_id, date)
    DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
        status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW()
    RETURNING * INTO result;
    RETURN json_build_object('success', true, 'message', 'Attendance recorded successfully', 'attendance', row_to_json(result));
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_delivery_rider(p_order_id uuid, p_rider_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
    v_rider RECORD;
BEGIN
    SELECT id, name, phone INTO v_rider FROM employees
    WHERE id = p_rider_id AND role = 'delivery_rider' AND status = 'active';
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive delivery rider');
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    IF v_order.order_type != 'online' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only online orders can have delivery riders');
    END IF;
    IF v_order.status NOT IN ('ready', 'confirmed', 'preparing') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must be ready, confirmed or preparing to assign rider');
    END IF;
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != p_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    UPDATE orders SET
        delivery_rider_id = p_rider_id,
        status = CASE WHEN status = 'ready' THEN 'delivering'::order_status ELSE status END,
        delivery_started_at = CASE WHEN status = 'ready' THEN NOW() ELSE delivery_started_at END,
        updated_at = NOW()
    WHERE id = p_order_id;
    PERFORM create_delivery_history_record(p_rider_id, p_order_id);
    IF v_order.status = 'ready' THEN
        UPDATE delivery_history SET delivery_status = 'delivering', started_at = NOW(), updated_at = NOW()
        WHERE rider_id = p_rider_id AND order_id = p_order_id;
    END IF;
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, CASE WHEN v_order.status = 'ready' THEN 'delivering' ELSE v_order.status::TEXT END,
        'Assigned to rider: ' || v_rider.name, p_rider_id, NOW());
    INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
    VALUES ('employee', p_rider_id, 'New Delivery Assigned!',
        'Order #' || v_order.order_number || ' - ' || v_order.customer_name || ' - Rs. ' || v_order.total,
        'delivery_assigned', p_order_id, FALSE, NOW());
    RETURN jsonb_build_object('success', true, 'order_number', v_order.order_number,
        'rider', jsonb_build_object('id', v_rider.id, 'name', v_rider.name, 'phone', v_rider.phone),
        'message', 'Rider assigned successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_table_to_order(p_order_id uuid, p_table_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT check_table_availability(p_table_id) THEN RETURN FALSE; END IF;
    UPDATE orders SET table_id = p_table_id WHERE id = p_order_id;
    UPDATE restaurant_tables SET status = 'occupied', current_order_id = p_order_id, updated_at = NOW()
    WHERE id = p_table_id;
    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ban_customer(p_customer_id uuid, p_reason text, p_banned_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer RECORD;
BEGIN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    IF v_customer.is_banned = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is already banned');
    END IF;
    UPDATE customers SET
        is_banned = true, ban_reason = p_reason, banned_at = NOW(), banned_by = p_banned_by,
        unbanned_at = NULL, unbanned_by = NULL
    WHERE id = p_customer_id;
    RETURN jsonb_build_object('success', true, 'message', 'Customer banned successfully',
        'customer_name', v_customer.name, 'customer_email', v_customer.email);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_activate_promo_codes_admin(p_promo_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes SET is_active = true, updated_at = NOW() WHERE id = ANY(p_promo_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'activated_count', v_count, 'message', v_count || ' promo codes activated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_deactivate_promo_codes_admin(p_promo_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = ANY(p_promo_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'deactivated_count', v_count, 'message', v_count || ' promo codes deactivated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_delete_contact_messages(p_message_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Only admins can delete messages');
    END IF;
    IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No messages selected');
    END IF;
    DELETE FROM contact_messages WHERE id = ANY(p_message_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'deleted_count', v_deleted_count, 'message', v_deleted_count || ' message(s) deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_delete_payslips(p_payslip_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM payslips WHERE id = ANY(p_payslip_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'deleted_count', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_delete_promo_codes_admin(p_promo_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM promo_codes WHERE id = ANY(p_promo_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'deleted_count', v_count, 'message', v_count || ' promo codes deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_pay_payslips(p_payslip_ids uuid[], p_payment_method text DEFAULT 'bank_transfer'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE payslips SET status = 'paid', payment_method = p_payment_method, paid_at = NOW(), updated_at = NOW()
    WHERE id = ANY(p_payslip_ids) AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'paid_count', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_update_contact_status(p_message_ids uuid[], p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_updated_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    IF p_status NOT IN ('unread', 'read', 'replied', 'archived') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;
    IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No messages selected');
    END IF;
    UPDATE contact_messages SET status = p_status, updated_at = NOW() WHERE id = ANY(p_message_ids);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'updated_count', v_updated_count, 'message', v_updated_count || ' message(s) updated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_update_review_visibility(p_review_ids uuid[], p_is_visible boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    affected_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    UPDATE reviews SET is_visible = p_is_visible, updated_at = NOW() WHERE id = ANY(p_review_ids);
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'affected_count', affected_count, 'message', affected_count || ' reviews updated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_update_review_visibility_by_employee(p_review_ids uuid[], p_is_visible boolean, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role TEXT;
    v_affected INT;
BEGIN
    SELECT role INTO v_role FROM employees WHERE id = p_employee_id AND status = 'active';
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    UPDATE reviews SET is_visible = p_is_visible, updated_at = NOW() WHERE id = ANY(p_review_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN json_build_object('success', true, 'affected_count', v_affected);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_update_stock(p_items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    item JSONB;
    emp_id UUID;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    emp_id := get_employee_id();
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            PERFORM adjust_inventory_stock(
                (item->>'item_id')::UUID, 'count',
                (item->>'quantity')::DECIMAL,
                COALESCE(item->>'reason', 'Bulk inventory count')
            );
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;
    RETURN json_build_object('success', true, 'updated', success_count, 'errors', error_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_delivery_order(p_order_id uuid, p_reason text DEFAULT NULL::text, p_rider_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_history_exists BOOLEAN;
BEGIN
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    UPDATE orders SET status = 'ready', delivery_rider_id = NULL, delivery_started_at = NULL, updated_at = NOW()
    WHERE id = p_order_id;
    SELECT EXISTS(SELECT 1 FROM delivery_history WHERE rider_id = v_rider_id AND order_id = p_order_id) INTO v_history_exists;
    IF v_history_exists THEN
        UPDATE delivery_history SET cancelled_at = NOW(), delivery_status = 'cancelled',
            delivery_notes = p_reason, updated_at = NOW()
        WHERE rider_id = v_rider_id AND order_id = p_order_id;
    END IF;
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'ready', 'Delivery cancelled: ' || COALESCE(p_reason, 'No reason provided'), v_rider_id, NOW());
    RETURN jsonb_build_object('success', true, 'order_number', v_order.order_number, 'message', 'Delivery cancelled. Order is back in queue.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  request_record RECORD;
BEGIN
  emp_id := get_employee_id();
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id AND employee_id = emp_id;
  IF request_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Leave request not found'); END IF;
  IF request_record.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Can only cancel pending requests'); END IF;
  UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = p_request_id;
  RETURN json_build_object('success', true, 'message', 'Leave request cancelled');
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_employee_id uuid, p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  request_record RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id AND employee_id = emp_id;
  IF request_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Leave request not found'); END IF;
  IF request_record.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Can only cancel pending requests'); END IF;
  UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = p_request_id;
  RETURN json_build_object('success', true, 'message', 'Leave request cancelled');
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_customer_review_limit(p_customer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    review_count INTEGER;
    max_reviews INTEGER := 3;
BEGIN
    SELECT COUNT(*) INTO review_count FROM reviews
    WHERE customer_id = p_customer_id AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day';
    RETURN json_build_object('can_review', review_count < max_reviews, 'reviews_today', review_count,
        'max_reviews', max_reviews, 'remaining', GREATEST(0, max_reviews - review_count));
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_employee_exists(p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_cnic text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee RECORD;
    v_cnic_clean TEXT;
BEGIN
    IF p_email IS NOT NULL AND p_email != '' THEN
        SELECT id, name, email INTO v_employee FROM employees WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('exists', TRUE, 'field', 'email',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email));
        END IF;
    END IF;
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT id, name, phone INTO v_employee FROM employees
        WHERE REGEXP_REPLACE(phone, '\s', '', 'g') = REGEXP_REPLACE(p_phone, '\s', '', 'g') LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('exists', TRUE, 'field', 'phone',
                'employee', jsonb_build_object('name', v_employee.name, 'phone', v_employee.phone));
        END IF;
    END IF;
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        v_cnic_clean := REGEXP_REPLACE(p_cnic, '-', '', 'g');
        SELECT e.id, e.name, e.email INTO v_employee FROM employee_documents d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.document_type = 'cnic' AND d.document_name = v_cnic_clean LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('exists', TRUE, 'field', 'cnic',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email));
        END IF;
    END IF;
    RETURN jsonb_build_object('exists', FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_employee_portal_access(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, name, portal_enabled, block_reason INTO v_employee
  FROM employees WHERE LOWER(email) = LOWER(p_email);
  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('found', false, 'portal_enabled', false, 'block_reason', null);
  END IF;
  RETURN jsonb_build_object('found', true, 'portal_enabled', COALESCE(v_employee.portal_enabled, true), 'block_reason', v_employee.block_reason);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_promo_code_details(p_code text, p_customer_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer_promo RECORD;
    v_general_promo RECORD;
    v_is_valid BOOLEAN := false;
    v_error_message TEXT := NULL;
    v_promo_source TEXT := NULL;
BEGIN
    IF p_customer_id IS NOT NULL THEN
        SELECT * INTO v_customer_promo FROM customer_promo_codes WHERE UPPER(code) = UPPER(p_code);
        IF v_customer_promo IS NOT NULL THEN
            v_promo_source := 'customer_reward';
            IF v_customer_promo.customer_id != p_customer_id THEN v_error_message := 'This promo code belongs to another customer';
            ELSIF v_customer_promo.is_used THEN v_error_message := 'This promo code has already been used';
            ELSIF v_customer_promo.expires_at < NOW() THEN v_error_message := 'This promo code has expired';
            ELSIF NOT v_customer_promo.is_active THEN v_error_message := 'This promo code is no longer active';
            ELSE v_is_valid := true;
            END IF;
            RETURN json_build_object('found', true, 'valid', v_is_valid, 'error', v_error_message, 'source', v_promo_source,
                'promo', json_build_object('id', v_customer_promo.id, 'code', v_customer_promo.code, 'name', v_customer_promo.name,
                    'description', v_customer_promo.description, 'promo_type', v_customer_promo.promo_type, 'value', v_customer_promo.value,
                    'max_discount', v_customer_promo.max_discount, 'loyalty_points_required', v_customer_promo.loyalty_points_required,
                    'is_used', v_customer_promo.is_used, 'used_at', v_customer_promo.used_at, 'expires_at', v_customer_promo.expires_at,
                    'is_active', v_customer_promo.is_active, 'created_at', v_customer_promo.created_at));
        END IF;
    END IF;
    SELECT * INTO v_general_promo FROM promo_codes WHERE UPPER(code) = UPPER(p_code);
    IF v_general_promo IS NULL THEN
        RETURN json_build_object('found', false, 'valid', false, 'error', 'Promo code not found', 'source', NULL, 'promo', NULL);
    END IF;
    v_promo_source := 'general';
    IF NOT v_general_promo.is_active THEN v_error_message := 'This promo code is no longer active';
    ELSIF v_general_promo.valid_from > NOW() THEN v_error_message := 'This promo code is not yet active';
    ELSIF v_general_promo.valid_until < NOW() THEN v_error_message := 'This promo code has expired';
    ELSIF v_general_promo.usage_limit IS NOT NULL AND v_general_promo.current_usage >= v_general_promo.usage_limit THEN v_error_message := 'This promo code usage limit has been reached';
    ELSE v_is_valid := true;
    END IF;
    RETURN json_build_object('found', true, 'valid', v_is_valid, 'error', v_error_message, 'source', v_promo_source,
        'promo', json_build_object('id', v_general_promo.id, 'code', v_general_promo.code, 'name', v_general_promo.name,
            'description', v_general_promo.description, 'promo_type', v_general_promo.promo_type, 'value', v_general_promo.value,
            'max_discount', v_general_promo.max_discount, 'min_order_amount', v_general_promo.min_order_amount,
            'valid_from', v_general_promo.valid_from, 'valid_until', v_general_promo.valid_until,
            'usage_limit', v_general_promo.usage_limit, 'current_usage', v_general_promo.current_usage,
            'is_active', v_general_promo.is_active, 'created_at', v_general_promo.created_at));
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_table_for_waiter(p_table_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_waiter_id UUID;
    v_waiter_record RECORD;
    v_table_record RECORD;
BEGIN
    v_waiter_id := get_employee_id();
    IF v_waiter_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
    SELECT * INTO v_waiter_record FROM employees
    WHERE id = v_waiter_id AND role IN ('waiter', 'admin', 'manager') AND status = 'active' AND portal_enabled = true;
    IF v_waiter_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authorized as waiter'); END IF;
    BEGIN
        SELECT * INTO v_table_record FROM restaurant_tables WHERE id = p_table_id FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
        RETURN json_build_object('success', false, 'error', 'Table is being claimed by another waiter');
    END;
    IF v_table_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Table not found'); END IF;
    IF v_table_record.status != 'available' THEN
        RETURN json_build_object('success', false, 'error', 'Table is not available. Current status: ' || v_table_record.status);
    END IF;
    IF v_table_record.assigned_waiter_id IS NOT NULL AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table already assigned to another waiter');
    END IF;
    UPDATE restaurant_tables SET assigned_waiter_id = v_waiter_id, status = 'occupied', updated_at = NOW()
    WHERE id = p_table_id;
    RETURN json_build_object('success', true, 'table_id', p_table_id, 'table_number', v_table_record.table_number,
        'capacity', v_table_record.capacity,
        'waiter', json_build_object('id', v_waiter_record.id, 'name', v_waiter_record.name), 'claimed_at', NOW());
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_customer_promos()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INT := 0;
BEGIN
    UPDATE promo_codes SET is_active = false, updated_at = NOW()
    WHERE valid_until < NOW() AND is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'deactivated_count', v_count, 'message', 'Expired promo codes cleaned up');
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_all_favorites(p_customer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE customers SET favorites = '[]'::jsonb, updated_at = NOW() WHERE id = p_customer_id;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_delivery_order(p_order_id uuid, p_notes text DEFAULT NULL::text, p_rider_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_delivery_minutes INT;
    v_history_exists BOOLEAN;
BEGIN
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    IF v_rider_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;
    IF v_order.status NOT IN ('delivering'::order_status) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not in delivering status. Current: ' || v_order.status::TEXT);
    END IF;
    IF v_order.delivery_rider_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No rider assigned to this order'); END IF;
    IF v_order.delivery_rider_id != v_rider_id THEN RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you'); END IF;
    IF v_order.delivery_started_at IS NOT NULL THEN
        v_delivery_minutes := EXTRACT(EPOCH FROM (NOW() - v_order.delivery_started_at)) / 60;
    ELSE v_delivery_minutes := 0;
    END IF;
    UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
    SELECT EXISTS(SELECT 1 FROM delivery_history WHERE rider_id = v_rider_id AND order_id = p_order_id) INTO v_history_exists;
    IF NOT v_history_exists THEN PERFORM create_delivery_history_record(v_rider_id, p_order_id); END IF;
    UPDATE delivery_history SET delivered_at = NOW(), delivery_status = 'delivered',
        actual_delivery_minutes = v_delivery_minutes, delivery_notes = p_notes,
        started_at = COALESCE(started_at, v_order.delivery_started_at), updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivered', COALESCE(p_notes, 'Delivery completed'), v_rider_id, NOW());
    IF v_order.customer_id IS NOT NULL THEN
        INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
        VALUES ('customer', v_order.customer_id, 'Order Delivered!',
            'Your order #' || v_order.order_number || ' has been delivered. Enjoy your meal!',
            'order_delivered', p_order_id, FALSE, NOW());
    END IF;
    RETURN jsonb_build_object('success', true, 'order_number', v_order.order_number,
        'delivery_minutes', v_delivery_minutes, 'message', 'Delivery completed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ==================== END BATCH A ====================

-- ==================== BATCH B: create_* through delete_* ====================

CREATE OR REPLACE FUNCTION public.create_contact_message(p_name text, p_email text, p_message text, p_phone text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_message_id uuid;
    v_customer_id uuid;
BEGIN
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN
        RETURN json_build_object('success', false, 'error', 'Name is required (min 2 characters)');
    END IF;
    IF p_email IS NULL OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object('success', false, 'error', 'Valid email is required');
    END IF;
    IF p_message IS NULL OR LENGTH(TRIM(p_message)) < 10 THEN
        RETURN json_build_object('success', false, 'error', 'Message is required (min 10 characters)');
    END IF;
    SELECT id INTO v_customer_id FROM customers WHERE LOWER(email) = LOWER(TRIM(p_email)) LIMIT 1;
    INSERT INTO contact_messages (name, email, phone, subject, message, ip_address, user_agent, customer_id, status)
    VALUES (TRIM(p_name), LOWER(TRIM(p_email)), NULLIF(TRIM(p_phone), ''), NULLIF(TRIM(p_subject), ''),
        TRIM(p_message), p_ip_address::inet, p_user_agent, v_customer_id, 'unread')
    RETURNING id INTO v_message_id;
    RETURN json_build_object('success', true, 'message_id', v_message_id,
        'message', 'Your message has been sent successfully. We will get back to you within 24 hours.');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to send message: ' || SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_order(p_customer_id uuid, p_order_number text, p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text, p_order_type text, p_items jsonb, p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_discount numeric, p_total numeric, p_payment_method text, p_payment_status text, p_table_number integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_transaction_id text DEFAULT NULL::text, p_online_payment_method_id uuid DEFAULT NULL::uuid, p_online_payment_details jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order_id UUID;
    v_customer_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM customers WHERE id = p_customer_id) INTO v_customer_exists;
    IF NOT v_customer_exists THEN RETURN jsonb_build_object('success', false, 'error', 'Customer not found'); END IF;
    IF p_order_type NOT IN ('online', 'walk-in', 'dine-in') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order type');
    END IF;
    IF p_payment_method NOT IN ('cash', 'card', 'online', 'wallet') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method');
    END IF;
    INSERT INTO orders (
        customer_id, order_number, customer_name, customer_email, customer_phone, customer_address,
        order_type, items, subtotal, tax, delivery_fee, discount, total, payment_method, payment_status,
        status, table_number, notes, transaction_id, online_payment_method_id, online_payment_details,
        created_at, updated_at
    ) VALUES (
        p_customer_id, p_order_number, p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
        p_order_type::order_type, p_items, p_subtotal, p_tax, p_delivery_fee, p_discount, p_total,
        p_payment_method::payment_method, COALESCE(p_payment_status, 'pending'), 'pending'::order_status,
        p_table_number, p_notes, p_transaction_id, p_online_payment_method_id, p_online_payment_details, NOW(), NOW()
    ) RETURNING id INTO v_order_id;
    INSERT INTO order_status_history (order_id, status, notes, created_at)
    VALUES (v_order_id, 'pending', 'Order placed by customer', NOW());
    RETURN jsonb_build_object('success', true, 'id', v_order_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_employee_complete(p_employee_id text, p_name text, p_email text, p_phone text, p_cnic text, p_cnic_file_url text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_emergency_contact text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_blood_group text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_role user_role DEFAULT 'waiter'::user_role, p_permissions jsonb DEFAULT '{}'::jsonb, p_portal_enabled boolean DEFAULT true, p_base_salary numeric DEFAULT 25000, p_payment_frequency text DEFAULT 'monthly'::text, p_bank_details jsonb DEFAULT '{}'::jsonb, p_hired_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text, p_license_id text DEFAULT NULL::text, p_license_expires_days integer DEFAULT 7, p_documents jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_employee_id UUID;
    v_generated_emp_id TEXT;
    v_generated_license_id TEXT;
    v_current_month INT;
    v_current_year INT;
    v_doc JSONB;
    v_result JSONB;
BEGIN
    v_generated_emp_id := COALESCE(NULLIF(p_employee_id, ''),
        CASE p_role::TEXT
            WHEN 'admin' THEN 'ADM-' WHEN 'manager' THEN 'MGR-' WHEN 'waiter' THEN 'WTR-'
            WHEN 'billing_staff' THEN 'BIL-' WHEN 'kitchen_staff' THEN 'KIT-' WHEN 'delivery_rider' THEN 'DLR-'
            ELSE 'EMP-'
        END || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)));
    v_generated_license_id := COALESCE(NULLIF(p_license_id, ''),
        'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)));
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    INSERT INTO employees (
        employee_id, name, email, phone, role, status, permissions, salary, hired_date, license_id,
        avatar_url, address, emergency_contact, emergency_contact_name, date_of_birth, blood_group,
        portal_enabled, bank_details, notes, created_at, updated_at
    ) VALUES (
        v_generated_emp_id, p_name, LOWER(p_email), REGEXP_REPLACE(p_phone, '\s', '', 'g'),
        p_role, 'inactive', p_permissions, p_base_salary, p_hired_date, v_generated_license_id,
        p_avatar_url, p_address, p_emergency_contact, p_emergency_contact_name, p_date_of_birth,
        p_blood_group, p_portal_enabled, p_bank_details, p_notes, NOW(), NOW()
    ) RETURNING id INTO v_new_employee_id;
    INSERT INTO employee_licenses (employee_id, license_id, issued_at, is_used, expires_at)
    VALUES (v_new_employee_id, v_generated_license_id, NOW(), FALSE, NOW() + (p_license_expires_days || ' days')::INTERVAL);
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, file_type, uploaded_at, verified)
        VALUES (v_new_employee_id, 'cnic', REGEXP_REPLACE(p_cnic, '-', '', 'g'), COALESCE(p_cnic_file_url, ''),
            CASE WHEN p_cnic_file_url IS NOT NULL AND p_cnic_file_url != '' THEN 'image' ELSE 'text' END, NOW(), FALSE);
    END IF;
    IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
        INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, file_type, uploaded_at, verified)
        SELECT v_new_employee_id, doc->>'type', COALESCE(doc->>'number', doc->>'type'),
            COALESCE(doc->>'file_url', ''), COALESCE(doc->>'file_type', 'unknown'), NOW(), FALSE
        FROM jsonb_array_elements(p_documents) AS doc
        WHERE doc->>'type' != 'cnic' AND ((doc->>'number' IS NOT NULL AND doc->>'number' != '')
            OR (doc->>'file_url' IS NOT NULL AND doc->>'file_url' != ''));
    END IF;
    INSERT INTO employee_payroll (employee_id, month, year, base_salary, bonus, deductions, tips, total_amount, paid, created_at, updated_at)
    VALUES (v_new_employee_id, v_current_month, v_current_year, COALESCE(p_base_salary, 0), 0, 0, 0, COALESCE(p_base_salary, 0), FALSE, NOW(), NOW());
    SELECT jsonb_build_object('success', TRUE, 'data', jsonb_build_object(
        'employee', jsonb_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name,
            'email', e.email, 'phone', e.phone, 'role', e.role, 'status', e.status,
            'license_id', e.license_id, 'hired_date', e.hired_date, 'portal_enabled', e.portal_enabled,
            'avatar_url', e.avatar_url, 'created_at', e.created_at),
        'employee_id', v_generated_emp_id, 'license_id', v_generated_license_id,
        'license_expires_at', NOW() + (p_license_expires_days || ' days')::INTERVAL))
    INTO v_result FROM employees e WHERE e.id = v_new_employee_id;
    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Employee with this email, phone, or employee ID already exists');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_leave_request(p_leave_type character varying, p_start_date date, p_end_date date, p_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  emp_status VARCHAR;
  total_days INTEGER;
  balance_record RECORD;
  leave_available INTEGER;
  new_request RECORD;
BEGIN
  emp_id := get_employee_id();
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT status INTO emp_status FROM employees WHERE id = emp_id;
  IF emp_status != 'active' THEN RETURN json_build_object('success', false, 'error', 'Your account is not active'); END IF;
  IF p_start_date < CURRENT_DATE THEN RETURN json_build_object('success', false, 'error', 'Start date cannot be in the past'); END IF;
  IF p_end_date < p_start_date THEN RETURN json_build_object('success', false, 'error', 'End date must be after start date'); END IF;
  total_days := (p_end_date - p_start_date) + 1;
  IF EXISTS (SELECT 1 FROM leave_requests WHERE employee_id = emp_id AND status IN ('pending', 'approved')
    AND ((p_start_date BETWEEN start_date AND end_date) OR (p_end_date BETWEEN start_date AND end_date)
    OR (start_date BETWEEN p_start_date AND p_end_date))) THEN
    RETURN json_build_object('success', false, 'error', 'You have an overlapping leave request');
  END IF;
  IF p_leave_type IN ('annual', 'sick', 'casual') THEN
    SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
    IF balance_record IS NULL THEN INSERT INTO leave_balances (employee_id) VALUES (emp_id) RETURNING * INTO balance_record; END IF;
    CASE p_leave_type
      WHEN 'annual' THEN leave_available := balance_record.annual_leave - balance_record.annual_used;
      WHEN 'sick' THEN leave_available := balance_record.sick_leave - balance_record.sick_used;
      WHEN 'casual' THEN leave_available := balance_record.casual_leave - balance_record.casual_used;
      ELSE leave_available := 999;
    END CASE;
    IF total_days > leave_available THEN
      RETURN json_build_object('success', false, 'error', format('Insufficient %s leave balance. Available: %s days', p_leave_type, leave_available));
    END IF;
  END IF;
  INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status)
  VALUES (emp_id, p_leave_type, p_start_date, p_end_date, total_days, p_reason, 'pending')
  RETURNING * INTO new_request;
  RETURN json_build_object('success', true, 'message', 'Leave request submitted successfully', 'request', row_to_json(new_request));
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_leave_request(p_employee_id uuid, p_leave_type character varying, p_start_date date, p_end_date date, p_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  emp_status VARCHAR;
  total_days INTEGER;
  balance_record RECORD;
  leave_available INTEGER;
  new_request RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT status INTO emp_status FROM employees WHERE id = emp_id;
  IF emp_status != 'active' THEN RETURN json_build_object('success', false, 'error', 'Your account is not active'); END IF;
  IF p_start_date < CURRENT_DATE THEN RETURN json_build_object('success', false, 'error', 'Start date cannot be in the past'); END IF;
  IF p_end_date < p_start_date THEN RETURN json_build_object('success', false, 'error', 'End date must be after start date'); END IF;
  total_days := (p_end_date - p_start_date) + 1;
  IF EXISTS (SELECT 1 FROM leave_requests WHERE employee_id = emp_id AND status IN ('pending', 'approved')
    AND ((p_start_date BETWEEN start_date AND end_date) OR (p_end_date BETWEEN start_date AND end_date)
    OR (start_date BETWEEN p_start_date AND p_end_date))) THEN
    RETURN json_build_object('success', false, 'error', 'You have an overlapping leave request');
  END IF;
  IF p_leave_type IN ('annual', 'sick', 'casual') THEN
    SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
    IF balance_record IS NULL THEN INSERT INTO leave_balances (employee_id) VALUES (emp_id) RETURNING * INTO balance_record; END IF;
    CASE p_leave_type
      WHEN 'annual' THEN leave_available := balance_record.annual_leave - balance_record.annual_used;
      WHEN 'sick' THEN leave_available := balance_record.sick_leave - balance_record.sick_used;
      WHEN 'casual' THEN leave_available := balance_record.casual_leave - balance_record.casual_used;
      ELSE leave_available := 999;
    END CASE;
    IF total_days > leave_available THEN
      RETURN json_build_object('success', false, 'error', format('Insufficient %s leave balance. Available: %s days', p_leave_type, leave_available));
    END IF;
  END IF;
  INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status)
  VALUES (emp_id, p_leave_type, p_start_date, p_end_date, total_days, p_reason, 'pending')
  RETURNING * INTO new_request;
  RETURN json_build_object('success', true, 'message', 'Leave request submitted successfully', 'request', row_to_json(new_request));
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_user_type text, p_title text, p_message text, p_type text DEFAULT 'system'::text, p_data jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (p_user_id, p_user_type, p_title, p_message, p_type, p_data)
    RETURNING id INTO new_id;
    RETURN json_build_object('success', true, 'id', new_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_payslip(p_employee_id uuid, p_period_start date, p_period_end date, p_base_salary numeric, p_overtime_hours numeric DEFAULT 0, p_overtime_rate numeric DEFAULT 1.5, p_bonuses numeric DEFAULT 0, p_deductions numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    new_id UUID;
    net_salary DECIMAL;
    overtime_pay DECIMAL;
BEGIN
    IF NOT is_manager_or_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
    emp_id := get_employee_id();
    overtime_pay := (p_base_salary / 30 / 8) * p_overtime_hours * p_overtime_rate;
    net_salary := p_base_salary + overtime_pay + p_bonuses - p_deductions - p_tax_amount;
    INSERT INTO payslips (employee_id, period_start, period_end, base_salary, overtime_hours, overtime_rate,
        bonuses, deductions, tax_amount, net_salary, notes, created_by)
    VALUES (p_employee_id, p_period_start, p_period_end, p_base_salary, p_overtime_hours, p_overtime_rate,
        p_bonuses, p_deductions, p_tax_amount, net_salary, p_notes, emp_id)
    RETURNING id INTO new_id;
    RETURN json_build_object('success', true, 'id', new_id, 'net_salary', net_salary);
END;
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_customer_promo_admin(p_promo_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE promo_codes SET is_active = false, updated_at = NOW() WHERE id = p_promo_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Promo code not found'); END IF;
    RETURN json_build_object('success', true, 'message', 'Promo code deactivated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_review(p_review_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
    DELETE FROM reviews WHERE id = p_review_id;
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_review_by_employee(p_review_id uuid, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM employees WHERE id = p_employee_id AND status = 'active';
    IF v_role IS NULL OR v_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized - admin only');
    END IF;
    DELETE FROM reviews WHERE id = p_review_id;
    RETURN json_build_object('success', true);
END;
$function$;

-- NOTE: The following functions are referenced in code but do NOT exist in the database:
-- create_customer_promo_admin, create_customer_review, create_employee_with_documents,
-- create_order_complete, create_order_enhanced, create_promo_code_admin, create_reservation,
-- deactivate_employee, delete_contact_message, delete_employee_complete, delete_leave_request,
-- delete_notification, delete_payslip, delete_promo_code_admin, disable_2fa,
-- dismiss_inventory_alert, enable_2fa

-- ==================== END BATCH B ====================

-- ==================== BATCH C: generate_* through get_billing_* ====================

CREATE OR REPLACE FUNCTION public.generate_advanced_invoice(p_order_id uuid, p_payment_method text DEFAULT 'cash'::text, p_manual_discount numeric DEFAULT 0, p_tip numeric DEFAULT 0, p_service_charge numeric DEFAULT 0, p_promo_code text DEFAULT NULL::text, p_loyalty_points_used integer DEFAULT 0, p_notes text DEFAULT NULL::text, p_biller_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    v_reward_promo_code TEXT := NULL;
    v_reward_promo_generated BOOLEAN := FALSE;
    v_total_customer_points INT := 0;
    v_effective_payment_method TEXT;
BEGIN
    IF p_biller_id IS NOT NULL THEN
        v_employee_id := p_biller_id;
    ELSE
        v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
        IF v_employee_id IS NULL THEN
            v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
        END IF;
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN RETURN json_build_object('success', false, 'error', 'Order not found'); END IF;
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        RETURN json_build_object('success', false, 'error', 'Invoice already exists for this order');
    END IF;
    IF v_order.transaction_id IS NOT NULL THEN v_effective_payment_method := 'online';
    ELSE v_effective_payment_method := p_payment_method; END IF;
    IF v_order.customer_id IS NOT NULL THEN
        SELECT c.*, COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) as loyalty_points
        INTO v_customer FROM customers c WHERE c.id = v_order.customer_id;
        IF FOUND THEN
            v_customer_found := TRUE; v_customer_id := v_customer.id;
            v_customer_name := v_customer.name; v_customer_phone := v_customer.phone;
            v_customer_email := v_customer.email; v_customer_loyalty_points := COALESCE(v_customer.loyalty_points, 0);
        END IF;
    END IF;
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT * INTO v_promo FROM promo_codes
        WHERE UPPER(code) = UPPER(p_promo_code) AND is_active = true AND valid_from <= NOW() AND valid_until >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit);
        IF FOUND THEN
            v_promo_id := v_promo.id;
            IF v_promo.promo_type = 'percentage' THEN
                v_promo_discount := ROUND(v_order.subtotal * (v_promo.value / 100), 2);
                IF v_promo.max_discount IS NOT NULL THEN v_promo_discount := LEAST(v_promo_discount, v_promo.max_discount); END IF;
            ELSE v_promo_discount := LEAST(v_promo.value, v_order.subtotal); END IF;
            UPDATE promo_codes SET current_usage = current_usage + 1, updated_at = NOW(),
                is_active = CASE WHEN usage_limit IS NOT NULL AND current_usage + 1 >= usage_limit THEN false ELSE is_active END
            WHERE id = v_promo.id;
            IF v_promo.customer_id IS NOT NULL THEN
                UPDATE customer_promo_codes SET is_used = true, used_at = NOW(), used_on_order_id = p_order_id, is_active = false
                WHERE code = UPPER(p_promo_code) AND customer_id = v_promo.customer_id;
            END IF;
        END IF;
    END IF;
    IF p_loyalty_points_used > 0 AND v_customer_found THEN
        IF v_customer_loyalty_points >= p_loyalty_points_used THEN
            v_points_discount := ROUND(p_loyalty_points_used * 0.1, 2);
            INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
            VALUES (v_customer_id, p_order_id, -p_loyalty_points_used, 'redeemed', 'Redeemed for bill discount');
        END IF;
    END IF;
    v_total_discount := p_manual_discount + v_promo_discount + v_points_discount;
    v_tax := ROUND((v_order.subtotal - v_total_discount) * 0.05, 2);
    v_final_total := v_order.subtotal - v_total_discount + v_tax + p_service_charge + v_order.delivery_fee + p_tip;
    IF v_customer_found THEN v_points_earned := FLOOR(v_final_total / 100); END IF;
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    IF v_order.order_type = 'dine-in' THEN v_table_session_id := gen_random_uuid(); END IF;
    v_brand_info := '{"name":"ZOIRO Broast","tagline":"Injected Broast - Saucy. Juicy. Crispy.","address":"Main Branch, City Center","phone":"+92 300 1234567","email":"info@zoiro.com","ntn":"1234567-8","strn":"12-34-5678-901-23","logo_url":"/assets/logo.png","website":"www.zoiro.com"}'::jsonb;
    INSERT INTO invoices (
        invoice_number, order_id, customer_id, customer_name, customer_phone, customer_email,
        order_type, items, subtotal, discount, discount_details, tax, service_charge, delivery_fee, tip,
        total, payment_method, payment_status, bill_status, promo_code_id, promo_code_value,
        loyalty_points_earned, loyalty_points_used, table_number, table_session_id, served_by, billed_by, brand_info, notes
    ) VALUES (
        v_invoice_number, p_order_id, v_customer_id,
        COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
        COALESCE(v_customer_phone, v_order.customer_phone),
        COALESCE(v_customer_email, v_order.customer_email),
        v_order.order_type, v_order.items, v_order.subtotal, v_total_discount,
        json_build_object('manual_discount', p_manual_discount, 'promo_discount', v_promo_discount,
            'promo_code', p_promo_code, 'points_discount', v_points_discount, 'points_used', p_loyalty_points_used),
        v_tax, p_service_charge, v_order.delivery_fee, p_tip, v_final_total,
        v_effective_payment_method, 'paid', 'paid', v_promo_id, p_promo_code,
        v_points_earned, p_loyalty_points_used, v_order.table_number, v_table_session_id,
        v_order.waiter_id, v_employee_id, v_brand_info, p_notes
    ) RETURNING id INTO v_new_invoice_id;
    IF v_customer_found AND v_points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
        VALUES (v_customer_id, p_order_id, v_points_earned, 'earned', 'Earned from bill payment - Invoice #' || v_invoice_number);
    END IF;
    IF v_customer_found THEN
        SELECT COALESCE(SUM(points), 0)::INT INTO v_total_customer_points FROM loyalty_points WHERE customer_id = v_customer_id;
        BEGIN
            DECLARE
                v_threshold_settings JSONB; v_threshold JSONB; v_expiry_days INT := 60;
                v_already_awarded INT[]; v_threshold_points INT; v_new_code TEXT;
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perks_settings') THEN
                    SELECT ARRAY_AGG(DISTINCT loyalty_points_required) INTO v_already_awarded
                    FROM promo_codes WHERE customer_id = v_customer_id AND loyalty_points_required IS NOT NULL;
                    v_already_awarded := COALESCE(v_already_awarded, ARRAY[]::INT[]);
                    SELECT setting_value INTO v_threshold_settings FROM perks_settings
                    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
                    BEGIN
                        SELECT COALESCE((setting_value->>'reward_codes')::INT, 60) INTO v_expiry_days
                        FROM perks_settings WHERE setting_key = 'promo_expiry_days';
                    EXCEPTION WHEN OTHERS THEN v_expiry_days := 60; END;
                    IF v_threshold_settings IS NOT NULL AND jsonb_typeof(v_threshold_settings) = 'array' THEN
                        FOR v_threshold IN SELECT value FROM jsonb_array_elements(v_threshold_settings) AS value ORDER BY (value->>'points')::INT DESC
                        LOOP
                            v_threshold_points := (v_threshold->>'points')::INT;
                            IF v_total_customer_points >= v_threshold_points AND NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                                v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                WHILE EXISTS (SELECT 1 FROM promo_codes WHERE code = v_new_code) LOOP
                                    v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                END LOOP;
                                INSERT INTO promo_codes (code, name, description, promo_type, value, max_discount,
                                    valid_from, valid_until, usage_limit, current_usage, is_active, customer_id, loyalty_points_required)
                                VALUES (v_new_code, COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                                    'Loyalty reward for reaching ' || v_threshold_points || ' points',
                                    COALESCE(v_threshold->>'promo_type', 'percentage')::promo_type,
                                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10),
                                    (v_threshold->>'max_discount')::DECIMAL,
                                    NOW(), NOW() + (v_expiry_days || ' days')::INTERVAL, 1, 0, true, v_customer_id, v_threshold_points);
                                v_reward_promo_code := v_new_code; v_reward_promo_generated := TRUE;
                                EXIT;
                            END IF;
                        END LOOP;
                    END IF;
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
    IF v_customer_found THEN
        INSERT INTO customer_invoice_records (customer_id, invoice_id, invoice_number, order_id, order_type,
            items, subtotal, discount, tax, total, payment_method, payment_status, promo_code_used,
            loyalty_points_used, loyalty_points_earned)
        VALUES (v_customer_id, v_new_invoice_id, v_invoice_number, p_order_id, v_order.order_type,
            v_order.items, v_order.subtotal, v_total_discount, v_tax, v_final_total,
            p_payment_method, 'paid', p_promo_code, p_loyalty_points_used, v_points_earned);
    END IF;
    UPDATE orders SET status = 'delivered', payment_status = 'paid',
        payment_method = p_payment_method::payment_method, updated_at = NOW()
    WHERE id = p_order_id;
    IF p_tip > 0 AND v_order.waiter_id IS NOT NULL THEN
        UPDATE employees SET total_tips = COALESCE(total_tips, 0) + p_tip, updated_at = NOW() WHERE id = v_order.waiter_id;
        BEGIN INSERT INTO waiter_tips (waiter_id, order_id, invoice_id, tip_amount, date)
            VALUES (v_order.waiter_id, p_order_id, v_new_invoice_id, p_tip, CURRENT_DATE);
        EXCEPTION WHEN undefined_table THEN NULL; END;
    END IF;
    IF v_order.order_type = 'dine-in' AND v_order.table_number IS NOT NULL THEN
        UPDATE restaurant_tables SET status = 'cleaning', current_order_id = NULL,
            current_customers = 0, assigned_waiter_id = NULL, updated_at = NOW()
        WHERE table_number = v_order.table_number;
    END IF;
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, 'delivered'::order_status, v_employee_id, 'Bill generated - Invoice #' || v_invoice_number);
    RETURN json_build_object('success', true, 'invoice_id', v_new_invoice_id, 'invoice_number', v_invoice_number,
        'customer', json_build_object('id', v_customer_id,
            'name', COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
            'is_registered', v_customer_found, 'points_earned', v_points_earned, 'total_points', v_total_customer_points),
        'totals', json_build_object('subtotal', v_order.subtotal, 'discount', v_total_discount, 'tax', v_tax,
            'service_charge', p_service_charge, 'delivery_fee', v_order.delivery_fee, 'tip', p_tip, 'total', v_final_total),
        'discount_breakdown', json_build_object('manual', p_manual_discount, 'promo', v_promo_discount,
            'promo_code', p_promo_code, 'points', v_points_discount),
        'reward_promo', json_build_object('generated', v_reward_promo_generated, 'code', v_reward_promo_code),
        'message', CASE WHEN v_reward_promo_generated
            THEN 'Invoice generated successfully! Customer earned a reward promo code: ' || v_reward_promo_code
            ELSE 'Invoice generated successfully' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_attendance_code(p_valid_minutes integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID; emp_role TEXT; new_code VARCHAR(6);
    valid_from_time TIME; valid_until_time TIME; current_uid UUID; current_time_local TIME;
BEGIN
    current_uid := auth.uid(); current_time_local := LOCALTIME;
    SELECT id, role INTO emp_id, emp_role FROM employees WHERE auth_user_id = current_uid AND status = 'active' LIMIT 1;
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found for auth user', 'debug_auth_uid', current_uid::TEXT);
    END IF;
    IF emp_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized - role is: ' || COALESCE(emp_role, 'NULL'));
    END IF;
    DELETE FROM attendance_codes WHERE valid_for_date < CURRENT_DATE
        OR (valid_for_date = CURRENT_DATE AND valid_until < current_time_local) OR is_active = false;
    new_code := UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    valid_from_time := current_time_local;
    valid_until_time := (current_time_local + (p_valid_minutes || ' minutes')::INTERVAL)::TIME;
    UPDATE attendance_codes SET is_active = false WHERE valid_for_date = CURRENT_DATE AND is_active = true;
    INSERT INTO attendance_codes (code, generated_by, valid_for_date, valid_from, valid_until, is_active, created_at)
    VALUES (new_code, emp_id, CURRENT_DATE, valid_from_time, valid_until_time, true, NOW());
    RETURN json_build_object('success', true, 'code', new_code, 'valid_from', valid_from_time,
        'valid_until', valid_until_time, 'expires_in_minutes', p_valid_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quick_bill(p_order_id uuid, p_biller_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order RECORD; v_invoice_number TEXT; v_invoice_id UUID;
    v_tax DECIMAL(10, 2); v_final_total DECIMAL(10, 2); v_effective_payment_method TEXT;
BEGIN
    SELECT id, order_number, customer_id, customer_name, customer_phone, customer_email,
        order_type, items, subtotal, discount, delivery_fee, total, payment_status, transaction_id, table_number
    INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE SKIP LOCKED;
    IF v_order IS NULL THEN RETURN json_build_object('success', false, 'error', 'Order not found or locked'); END IF;
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        SELECT id, invoice_number INTO v_invoice_id, v_invoice_number FROM invoices WHERE order_id = p_order_id;
        RETURN json_build_object('success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number, 'message', 'Invoice already exists');
    END IF;
    IF v_order.transaction_id IS NOT NULL THEN v_effective_payment_method := 'online';
    ELSE v_effective_payment_method := 'cash'; END IF;
    v_tax := ROUND(COALESCE(v_order.subtotal, v_order.total * 0.95) * 0.05, 2);
    v_final_total := COALESCE(v_order.subtotal, v_order.total * 0.95) - COALESCE(v_order.discount, 0) + v_tax + COALESCE(v_order.delivery_fee, 0);
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    v_invoice_id := gen_random_uuid();
    INSERT INTO invoices (id, invoice_number, order_id, customer_id, customer_name, customer_phone, customer_email,
        order_type, items, subtotal, discount, tax, delivery_fee, total, payment_method, payment_status,
        bill_status, billed_by, table_number, created_at)
    VALUES (v_invoice_id, v_invoice_number, p_order_id, v_order.customer_id, v_order.customer_name,
        v_order.customer_phone, v_order.customer_email, v_order.order_type, v_order.items,
        COALESCE(v_order.subtotal, v_order.total * 0.95), COALESCE(v_order.discount, 0), v_tax,
        COALESCE(v_order.delivery_fee, 0), v_final_total, v_effective_payment_method::payment_method,
        'pending', 'generated', p_biller_id, v_order.table_number, NOW());
    UPDATE orders SET updated_at = NOW() WHERE id = p_order_id;
    RETURN json_build_object('success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
        'total', v_final_total, 'tax', v_tax, 'subtotal', COALESCE(v_order.subtotal, v_order.total * 0.95),
        'discount', COALESCE(v_order.discount, 0), 'delivery_fee', COALESCE(v_order.delivery_fee, 0),
        'payment_method', v_effective_payment_method, 'order_number', v_order.order_number,
        'order_type', v_order.order_type, 'customer_name', COALESCE(v_order.customer_name, 'Walk-in Customer'),
        'customer_phone', v_order.customer_phone, 'items', v_order.items,
        'table_number', v_order.table_number, 'message', 'Bill generated successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_reorder_suggestions()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'item_id', i.id, 'item_name', i.name, 'sku', i.sku, 'supplier', i.supplier,
        'current_stock', i.quantity, 'reorder_point', COALESCE(i.reorder_point, i.min_quantity),
        'suggested_qty', COALESCE(i.max_quantity, 100) - COALESCE(i.quantity, 0),
        'estimated_cost', (COALESCE(i.max_quantity, 100) - COALESCE(i.quantity, 0)) * i.cost_per_unit,
        'lead_time_days', COALESCE(i.lead_time_days, 7),
        'priority', CASE WHEN i.quantity <= 0 THEN 'critical'
            WHEN i.quantity <= COALESCE(i.min_quantity, 0) * 0.5 THEN 'high' ELSE 'medium' END
    ) ORDER BY CASE WHEN i.quantity <= 0 THEN 0 WHEN i.quantity <= COALESCE(i.min_quantity, 0) * 0.5 THEN 1 ELSE 2 END,
        i.quantity / NULLIF(i.min_quantity, 0) ASC)
    INTO result FROM inventory i
    WHERE COALESCE(i.is_active, true) = true AND COALESCE(i.quantity, 0) <= COALESCE(i.reorder_point, i.min_quantity, 10);
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_absent_employees_today()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    SELECT json_build_object('success', true, 'date', CURRENT_DATE,
        'absent_employees', COALESCE(json_agg(json_build_object(
            'id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role,
            'email', e.email, 'phone', e.phone, 'avatar_url', e.avatar_url, 'hired_date', e.hired_date
        )), '[]'::json))
    INTO result FROM employees e
    WHERE e.status = 'active' AND e.role != 'admin'
    AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id AND a.date = CURRENT_DATE);
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_absent_employees_today(p_caller_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    SELECT json_build_object('success', true, 'date', CURRENT_DATE,
        'absent_employees', COALESCE(json_agg(json_build_object(
            'id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role,
            'email', e.email, 'phone', e.phone, 'avatar_url', e.avatar_url, 'hired_date', e.hired_date
        )), '[]'::json))
    INTO result FROM employees e
    WHERE e.status = 'active' AND e.role != 'admin'
    AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id AND a.date = CURRENT_DATE);
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_attendance_code()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE active_code RECORD; time_left_seconds INTEGER; current_time_local TIME;
BEGIN
    IF NOT is_manager_or_admin() THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    current_time_local := LOCALTIME;
    DELETE FROM attendance_codes WHERE valid_for_date < CURRENT_DATE
        OR (valid_for_date = CURRENT_DATE AND valid_until < current_time_local) OR is_active = false;
    SELECT code, valid_from, valid_until, created_at INTO active_code FROM attendance_codes
    WHERE valid_for_date = CURRENT_DATE AND is_active = true AND valid_until > current_time_local
    ORDER BY created_at DESC LIMIT 1;
    IF active_code IS NULL THEN RETURN json_build_object('success', true, 'has_active_code', false); END IF;
    time_left_seconds := EXTRACT(EPOCH FROM (active_code.valid_until - current_time_local))::INTEGER;
    RETURN json_build_object('success', true, 'has_active_code', true, 'code', active_code.code,
        'valid_from', active_code.valid_from, 'valid_until', active_code.valid_until, 'time_left_seconds', time_left_seconds);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_payment_methods()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    SELECT json_build_object('success', true,
        'methods', COALESCE((SELECT json_agg(json_build_object(
            'id', pm.id, 'method_type', pm.method_type, 'method_name', pm.method_name,
            'account_number', pm.account_number, 'account_holder_name', pm.account_holder_name,
            'bank_name', pm.bank_name, 'display_order', pm.display_order
        ) ORDER BY pm.display_order, pm.method_name) FROM payment_methods pm WHERE pm.is_active = true), '[]'::json),
        'fetched_at', NOW())
    INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    SELECT json_build_object(
        'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
        'total_sales_today', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status NOT IN ('cancelled')),
        'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date),
        'total_orders_today', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE),
        'completed_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status = 'delivered'),
        'cancelled_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status = 'cancelled'),
        'pending_orders', (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed', 'preparing')),
        'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
        'active_tables', (SELECT COUNT(*) FROM restaurant_tables WHERE status = 'occupied'),
        'total_tables', (SELECT COUNT(*) FROM restaurant_tables),
        'active_employees', (SELECT COUNT(*) FROM employees WHERE status = 'active'),
        'present_today', (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE AND check_in IS NOT NULL),
        'low_inventory_count', (SELECT COUNT(*) FROM inventory WHERE quantity <= min_quantity),
        'date_range', json_build_object('start_date', p_start_date, 'end_date', p_end_date)
    ) INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_reviews_advanced(p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_has_reply boolean DEFAULT NULL::boolean, p_sort_by text DEFAULT 'recent'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized. Only admin and manager can access reviews management.');
    END IF;
    SELECT json_build_object('success', true,
        'reviews', COALESCE((SELECT json_agg(review_data ORDER BY
            CASE WHEN p_sort_by = 'recent' THEN r.created_at END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'oldest' THEN r.created_at END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'rating_high' THEN r.rating END DESC NULLS LAST,
            CASE WHEN p_sort_by = 'rating_low' THEN r.rating END ASC NULLS LAST,
            CASE WHEN p_sort_by = 'helpful' THEN r.helpful_count END DESC NULLS LAST)
        FROM (SELECT json_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment,
            'review_type', COALESCE(r.review_type, 'overall'), 'images', COALESCE(r.images, '[]'::jsonb),
            'is_verified', COALESCE(r.is_verified, false), 'is_visible', COALESCE(r.is_visible, true),
            'helpful_count', COALESCE(r.helpful_count, 0), 'admin_reply', r.admin_reply,
            'replied_at', r.replied_at, 'replied_by', r.replied_by,
            'created_at', r.created_at, 'updated_at', r.updated_at, 'order_id', r.order_id,
            'customer', CASE WHEN r.customer_id IS NOT NULL THEN
                (SELECT json_build_object('id', c.id, 'name', COALESCE(c.name, 'Anonymous'), 'email', c.email,
                    'phone', c.phone, 'address', c.address, 'is_verified', COALESCE(c.is_verified, false),
                    'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id), 'member_since', c.created_at)
                FROM customers c WHERE c.id = r.customer_id)
                ELSE json_build_object('id', NULL, 'name', 'Anonymous', 'email', NULL, 'phone', NULL) END,
            'item', CASE WHEN r.item_id IS NOT NULL THEN
                (SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images->0,
                    'category_id', mi.category_id, 'price', mi.price, 'avg_rating', mi.rating, 'total_reviews', mi.total_reviews)
                FROM menu_items mi WHERE mi.id = r.item_id) ELSE NULL END,
            'meal', CASE WHEN r.meal_id IS NOT NULL THEN
                (SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images->0,
                    'price', COALESCE(m.original_price, m.price), 'avg_rating', m.rating, 'total_reviews', m.total_reviews)
                FROM meals m WHERE m.id = r.meal_id) ELSE NULL END,
            'order', CASE WHEN r.order_id IS NOT NULL THEN
                (SELECT json_build_object('id', o.id, 'order_number', o.order_number, 'total', o.total,
                    'order_type', o.order_type, 'created_at', o.created_at)
                FROM orders o WHERE o.id = r.order_id) ELSE NULL END
        ) AS review_data, r.created_at, r.rating, r.helpful_count
        FROM reviews r WHERE 1=1
        AND (p_status IS NULL OR p_status = 'all' OR (p_status = 'visible' AND r.is_visible = true)
            OR (p_status = 'hidden' AND r.is_visible = false) OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
            OR (p_status = 'replied' AND r.admin_reply IS NOT NULL) OR (p_status = 'verified' AND r.is_verified = true))
        AND (p_min_rating IS NULL OR r.rating >= p_min_rating) AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
        AND (p_has_reply IS NULL OR (p_has_reply = true AND r.admin_reply IS NOT NULL) OR (p_has_reply = false AND r.admin_reply IS NULL))
        LIMIT p_limit OFFSET p_offset) r), '[]'::json),
        'total_count', (SELECT COUNT(*) FROM reviews r WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR (p_status = 'visible' AND r.is_visible = true)
                OR (p_status = 'hidden' AND r.is_visible = false) OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
                OR (p_status = 'replied' AND r.admin_reply IS NOT NULL) OR (p_status = 'verified' AND r.is_verified = true))
            AND (p_min_rating IS NULL OR r.rating >= p_min_rating) AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
            AND (p_has_reply IS NULL OR (p_has_reply = true AND r.admin_reply IS NOT NULL) OR (p_has_reply = false AND r.admin_reply IS NULL))),
        'has_more', (SELECT COUNT(*) > (p_offset + p_limit) FROM reviews r WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR (p_status = 'visible' AND r.is_visible = true)
                OR (p_status = 'hidden' AND r.is_visible = false) OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
                OR (p_status = 'replied' AND r.admin_reply IS NOT NULL) OR (p_status = 'verified' AND r.is_verified = true))
            AND (p_min_rating IS NULL OR r.rating >= p_min_rating) AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
            AND (p_has_reply IS NULL OR (p_has_reply = true AND r.admin_reply IS NOT NULL) OR (p_has_reply = false AND r.admin_reply IS NULL)))
    ) INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_reviews_by_employee(p_employee_id uuid, p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON; v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM employees WHERE id = p_employee_id AND status = 'active';
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    SELECT json_build_object('success', true,
        'reviews', COALESCE((SELECT json_agg(review_data ORDER BY created_at DESC)
        FROM (SELECT r.id, json_build_object('id', c.id, 'name', COALESCE(c.name, 'Anonymous'), 'email', c.email, 'phone', c.phone) as customer,
            r.order_id,
            CASE WHEN r.item_id IS NOT NULL THEN (SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images[1]) FROM menu_items mi WHERE mi.id = r.item_id) ELSE NULL END as item,
            CASE WHEN r.meal_id IS NOT NULL THEN (SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images[1]) FROM meals m WHERE m.id = r.meal_id) ELSE NULL END as meal,
            r.rating, r.comment, r.images, r.is_verified, r.is_visible, r.admin_reply, r.replied_at, r.replied_by, r.helpful_count, r.created_at
        FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id
        WHERE (p_status IS NULL OR (p_status = 'all') OR (p_status = 'visible' AND r.is_visible = true) OR (p_status = 'hidden' AND r.is_visible = false)
            OR (p_status = 'verified' AND r.is_verified = true) OR (p_status = 'pending_reply' AND r.admin_reply IS NULL) OR (p_status = 'replied' AND r.admin_reply IS NOT NULL))
        AND (p_min_rating IS NULL OR r.rating >= p_min_rating) AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
        LIMIT p_limit) AS review_data), '[]'::json),
        'stats', (SELECT json_build_object('total', COUNT(*), 'visible', COUNT(*) FILTER (WHERE is_visible = true),
            'hidden', COUNT(*) FILTER (WHERE is_visible = false), 'verified', COUNT(*) FILTER (WHERE is_verified = true),
            'pending_reply', COUNT(*) FILTER (WHERE admin_reply IS NULL), 'replied', COUNT(*) FILTER (WHERE admin_reply IS NOT NULL),
            'avg_rating', ROUND(AVG(rating)::numeric, 1),
            'five_star', COUNT(*) FILTER (WHERE rating = 5), 'four_star', COUNT(*) FILTER (WHERE rating = 4),
            'three_star', COUNT(*) FILTER (WHERE rating = 3), 'two_star', COUNT(*) FILTER (WHERE rating = 2),
            'one_star', COUNT(*) FILTER (WHERE rating = 1)) FROM reviews)
    ) INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_employees()
 RETURNS TABLE(id uuid, employee_id text, email text, name text, phone text, role user_role, permissions jsonb, status text, is_verified boolean, avatar_url text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY SELECT e.id, e.employee_id, e.email, e.name, e.phone, e.role, e.permissions, e.status,
        e.is_verified, e.avatar_url, e.created_at FROM employees e ORDER BY e.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_leave_requests(p_status character varying DEFAULT NULL::character varying, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    SELECT json_build_object('success', true, 'requests', COALESCE(json_agg(json_build_object(
        'id', lr.id, 'employee_id', lr.employee_id, 'leave_type', lr.leave_type, 'start_date', lr.start_date,
        'end_date', lr.end_date, 'total_days', lr.total_days, 'reason', lr.reason, 'status', lr.status,
        'reviewed_by', lr.reviewed_by, 'reviewed_at', lr.reviewed_at, 'review_notes', lr.review_notes, 'created_at', lr.created_at,
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'email', e.email,
            'phone', e.phone, 'role', e.role, 'avatar_url', e.avatar_url),
        'reviewer', CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role) ELSE NULL END
    ) ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.created_at DESC), '[]'::json))
    INTO result FROM leave_requests lr INNER JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN employees r ON r.id = lr.reviewed_by
    WHERE EXTRACT(YEAR FROM lr.start_date) = p_year
    AND (p_status IS NULL OR lr.status = p_status)
    AND (p_month IS NULL OR EXTRACT(MONTH FROM lr.start_date) = p_month);
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_leave_requests(p_caller_id uuid, p_status character varying DEFAULT NULL::character varying, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    SELECT json_build_object('success', true, 'requests', COALESCE(json_agg(json_build_object(
        'id', lr.id, 'employee_id', lr.employee_id, 'leave_type', lr.leave_type, 'start_date', lr.start_date,
        'end_date', lr.end_date, 'total_days', lr.total_days, 'reason', lr.reason, 'status', lr.status,
        'reviewed_by', lr.reviewed_by, 'reviewed_at', lr.reviewed_at, 'review_notes', lr.review_notes, 'created_at', lr.created_at,
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'email', e.email,
            'phone', e.phone, 'role', e.role, 'avatar_url', e.avatar_url),
        'reviewer', CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role) ELSE NULL END
    ) ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.created_at DESC), '[]'::json))
    INTO result FROM leave_requests lr INNER JOIN employees e ON e.id = lr.employee_id
    LEFT JOIN employees r ON r.id = lr.reviewed_by
    WHERE EXTRACT(YEAR FROM lr.start_date) = p_year
    AND (p_status IS NULL OR lr.status = p_status)
    AND (p_month IS NULL OR EXTRACT(MONTH FROM lr.start_date) = p_month);
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_orders(p_status order_status DEFAULT NULL::order_status, p_order_type order_type DEFAULT NULL::order_type, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, order_number text, customer_id uuid, customer_name text, customer_phone text, status order_status, order_type order_type, total numeric, created_at timestamp with time zone, items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY SELECT o.id, o.order_number, o.customer_id, c.name as customer_name, c.phone as customer_phone,
        o.status, o.order_type, o.total, o.created_at, o.items
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    WHERE (p_status IS NULL OR o.status = p_status) AND (p_order_type IS NULL OR o.order_type = p_order_type)
    ORDER BY o.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_tables()
 RETURNS TABLE(id uuid, table_number integer, capacity integer, status text, current_order_id uuid, order_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY SELECT t.id, t.table_number, t.capacity, t.status, t.current_order_id, o.order_number
    FROM restaurant_tables t LEFT JOIN orders o ON o.id = t.current_order_id ORDER BY t.table_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_attendance_history(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE start_date DATE; end_date DATE; result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
    start_date := make_date(p_year, p_month, 1);
    end_date := (start_date + INTERVAL '1 month')::DATE;
    SELECT json_build_object('success', true, 'month', to_char(start_date, 'YYYY-MM'),
        'attendance', COALESCE(json_agg(json_build_object(
            'id', a.id, 'employee_id', a.employee_id, 'date', a.date, 'check_in', a.check_in,
            'check_out', a.check_out, 'status', a.status, 'notes', a.notes,
            'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name,
                'email', e.email, 'phone', e.phone, 'avatar_url', e.avatar_url, 'role', e.role,
                'status', e.status, 'hired_date', e.hired_date)
        ) ORDER BY a.date DESC, a.check_in DESC), '[]'::json))
    INTO result FROM attendance a INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date >= start_date AND a.date < end_date AND (p_employee_id IS NULL OR a.employee_id = p_employee_id);
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_audit_logs(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_employee_id uuid DEFAULT NULL::uuid, p_action_type text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
    SELECT json_agg(json_build_object('id', a.id, 'action', a.action, 'table_name', a.table_name,
        'record_id', a.record_id, 'old_values', a.old_values, 'new_values', a.new_values,
        'employee', (SELECT json_build_object('id', e.id, 'name', e.name, 'role', e.role) FROM employees e WHERE e.id = a.performed_by),
        'ip_address', a.ip_address, 'user_agent', a.user_agent, 'created_at', a.created_at)
    ORDER BY a.created_at DESC) INTO result FROM audit_logs a
    WHERE (p_start_date IS NULL OR DATE(a.created_at) >= p_start_date) AND (p_end_date IS NULL OR DATE(a.created_at) <= p_end_date)
    AND (p_employee_id IS NULL OR a.performed_by = p_employee_id) AND (p_action_type IS NULL OR a.action = p_action_type)
    LIMIT p_limit;
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_delivery_riders()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON;
BEGIN
    SELECT COALESCE(json_agg(json_build_object(
        'id', e.id, 'name', e.name, 'phone', e.phone, 'employee_id', e.employee_id,
        'avatar_url', e.avatar_url, 'status', e.status,
        'active_deliveries', (SELECT COUNT(*) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivering'),
        'last_delivery_at', (SELECT MAX(delivered_at) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivered'),
        'deliveries_today', (SELECT COUNT(*) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivered' AND o.delivered_at::DATE = CURRENT_DATE)
    ) ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivering'), e.name), '[]'::json)
    INTO result FROM employees e WHERE e.role::TEXT = 'delivery_rider' AND e.status = 'active' AND e.portal_enabled = true;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_billable_orders(p_order_type text DEFAULT NULL::text, p_status_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result JSON; v_employee_id UUID;
BEGIN
    v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
    IF v_employee_id IS NULL THEN
        v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
    END IF;
    SELECT json_build_object('success', true,
        'orders', COALESCE((SELECT json_agg(order_data ORDER BY created_at DESC)
        FROM (SELECT json_build_object('id', o.id, 'order_number', o.order_number, 'order_type', o.order_type, 'status', o.status,
            'payment_status', o.payment_status, 'customer_id', o.customer_id,
            'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'), 'customer_phone', o.customer_phone,
            'customer_email', o.customer_email, 'customer_address', o.customer_address,
            'items', o.items, 'items_count', jsonb_array_length(o.items),
            'subtotal', o.subtotal, 'discount', o.discount, 'tax', o.tax, 'delivery_fee', o.delivery_fee, 'total', o.total,
            'table_number', o.table_number, 'waiter_id', o.waiter_id,
            'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
            'notes', o.notes, 'created_at', o.created_at, 'payment_method', o.payment_method,
            'transaction_id', o.transaction_id, 'online_payment_method_id', o.online_payment_method_id,
            'online_payment_details', o.online_payment_details,
            'is_registered_customer', o.customer_id IS NOT NULL,
            'customer_loyalty_points', COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = o.customer_id), 0),
            'has_invoice', EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ) as order_data, o.created_at FROM orders o
        WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
        AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
        AND (p_status_filter = 'all'
            OR (p_status_filter = 'pending_bill' AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id))
            OR (p_status_filter = 'billed' AND EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)))
        ORDER BY o.created_at DESC LIMIT p_limit OFFSET p_offset) sub), '[]'::json),
        'stats', (SELECT json_build_object(
            'total_pending', COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
            'total_billed_today', (SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURRENT_DATE),
            'revenue_today', (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND bill_status = 'paid'))
        FROM orders o WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered'))
    ) INTO result;
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_billing_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN json_build_object('success', true,
        'today', (SELECT json_build_object(
            'total_revenue', COALESCE(SUM(total), 0), 'invoices_count', COUNT(*),
            'cash_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0),
            'card_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0),
            'online_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'online'), 0),
            'avg_invoice_value', ROUND(AVG(total), 2), 'total_discount_given', COALESCE(SUM(discount), 0),
            'total_tips', COALESCE(SUM(tip), 0),
            'dine_in_count', COUNT(*) FILTER (WHERE order_type = 'dine-in'),
            'online_count', COUNT(*) FILTER (WHERE order_type = 'online'),
            'walk_in_count', COUNT(*) FILTER (WHERE order_type = 'walk-in'))
        FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND bill_status = 'paid'),
        'this_week', (SELECT json_build_object(
            'total_revenue', COALESCE(SUM(daily_total), 0), 'invoices_count', COALESCE(SUM(daily_count), 0),
            'avg_daily_revenue', ROUND(AVG(daily_total), 2))
        FROM (SELECT DATE(created_at) as day, SUM(total) as daily_total, COUNT(*) as daily_count
            FROM invoices WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND bill_status = 'paid'
            GROUP BY DATE(created_at)) daily),
        'pending_orders', (SELECT COUNT(*) FROM orders o WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
        'recent_invoices', (SELECT COALESCE(json_agg(json_build_object(
            'id', i.id, 'invoice_number', i.invoice_number, 'customer_name', i.customer_name,
            'total', i.total, 'payment_method', i.payment_method, 'created_at', i.created_at)
        ORDER BY i.created_at DESC), '[]'::json) FROM (SELECT * FROM invoices WHERE DATE(created_at) = CURRENT_DATE ORDER BY created_at DESC LIMIT 5) i));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_billing_pending_orders(p_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN json_build_object('success', true,
        'orders', COALESCE((SELECT json_agg(order_data ORDER BY created_at DESC)
        FROM (SELECT json_build_object('id', o.id, 'order_number', o.order_number, 'order_type', o.order_type,
            'status', o.status, 'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
            'customer_phone', o.customer_phone, 'items', o.items,
            'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)), 'total', o.total,
            'table_number', o.table_number, 'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
            'created_at', o.created_at, 'payment_method', o.payment_method, 'transaction_id', o.transaction_id,
            'online_payment_details', o.online_payment_details,
            'is_registered_customer', o.customer_id IS NOT NULL,
            'customer_loyalty_points', COALESCE((SELECT SUM(points)::INT FROM loyalty_points WHERE customer_id = o.customer_id), 0)
        ) as order_data, o.created_at FROM orders o
        WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
        AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ORDER BY o.created_at DESC LIMIT p_limit) sub), '[]'::json),
        'pending_count', (SELECT COUNT(*)::INT FROM orders o WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
        'online_orders_count', (SELECT COUNT(*)::INT FROM orders o WHERE o.order_type = 'online'
            AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)));
END;
$function$;

-- NOTE: The following functions are referenced in code but do NOT exist in the database:
-- get_all_attendance, get_all_categories, get_all_customers, get_all_inventory,
-- get_all_menu_items, get_all_notifications, get_all_payslips, get_all_promo_codes,
-- get_attendance_by_employee, get_attendance_report

-- ==================== END BATCH C ====================

-- ==================== BATCH D: get_c* through get_i* ====================

CREATE OR REPLACE FUNCTION public.get_category_sales_report_v2(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'category', mc.name,
            'category_id', mc.id,
            'total_sales', COALESCE(sales.total, 0),
            'order_count', COALESCE(sales.order_count, 0),
            'items_sold', COALESCE(sales.items_sold, 0)
        )
        ORDER BY sales.total DESC NULLS LAST
    ) INTO result
    FROM menu_categories mc
    LEFT JOIN LATERAL (
        SELECT 
            SUM(
                COALESCE((item->>'subtotal')::decimal, 
                    (item->>'price')::decimal * COALESCE((item->>'quantity')::int, 1))
            ) as total,
            COUNT(DISTINCT o.id) as order_count,
            SUM(COALESCE((item->>'quantity')::int, 1)) as items_sold
        FROM orders o,
        jsonb_array_elements(o.items) as item
        JOIN menu_items mi ON mi.id = COALESCE(
            (item->>'menu_item_id')::uuid,
            (item->>'id')::uuid
        )
        WHERE mi.category_id = mc.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) sales ON true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_favorites(p_customer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_favorites jsonb;
  v_result jsonb := '[]'::jsonb;
  v_item record;
  v_menu_item record;
  v_deal record;
BEGIN
  -- Get favorites array
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Loop through favorites and fetch details
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_favorites)
  LOOP
    IF v_item.value->>'type' = 'menu_item' THEN
      SELECT 
        id, name, description, price, images, 
        is_available, is_featured, rating, category_id,
        (SELECT name FROM menu_categories WHERE id = menu_items.category_id) as category_name
      INTO v_menu_item
      FROM menu_items
      WHERE id = (v_item.value->>'id')::uuid;

      IF FOUND THEN
        v_result := v_result || jsonb_build_object(
          'id', v_menu_item.id,
          'type', 'menu_item',
          'name', v_menu_item.name,
          'description', v_menu_item.description,
          'price', v_menu_item.price,
          'image_url', COALESCE(v_menu_item.images->>0, ''),
          'is_available', v_menu_item.is_available,
          'is_featured', COALESCE(v_menu_item.is_featured, false),
          'rating', v_menu_item.rating,
          'category', v_menu_item.category_name,
          'added_at', v_item.value->>'added_at'
        );
      END IF;

    ELSIF v_item.value->>'type' = 'deal' THEN
      SELECT 
        id, name, description, original_price, discounted_price, 
        image_url, images, is_active, rating
      INTO v_deal
      FROM deals
      WHERE id = (v_item.value->>'id')::uuid;

      IF FOUND THEN
        v_result := v_result || jsonb_build_object(
          'id', v_deal.id,
          'type', 'deal',
          'name', v_deal.name,
          'description', v_deal.description,
          'price', v_deal.discounted_price,
          'original_price', v_deal.original_price,
          'image_url', COALESCE(v_deal.image_url, v_deal.images->>0, ''),
          'is_available', v_deal.is_active,
          'rating', v_deal.rating,
          'category', 'Deals',
          'added_at', v_item.value->>'added_at'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_promo_codes(p_customer_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_stats(p_customer_id uuid)
 RETURNS TABLE(total_orders integer, total_spent numeric, average_order_value numeric, loyalty_points integer, favorite_items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.id)::INT,
        COALESCE(SUM(o.total), 0),
        COALESCE(AVG(o.total), 0),
        COALESCE((SELECT SUM(CASE WHEN type = 'earned' THEN points ELSE -points END)::INT 
                  FROM loyalty_points WHERE customer_id = p_customer_id), 0),
        (
            SELECT jsonb_agg(
                jsonb_build_object('item_id', item_id, 'name', item_name, 'count', item_count)
            )
            FROM (
                SELECT 
                    (item->>'id')::UUID as item_id,
                    item->>'name' as item_name,
                    COUNT(*) as item_count
                FROM orders o2,
                     jsonb_array_elements(o2.items) as item
                WHERE o2.customer_id = p_customer_id
                    AND o2.status = 'delivered'
                GROUP BY item->>'id', item->>'name'
                ORDER BY item_count DESC
                LIMIT 5
            ) top_items
        )
    FROM orders o
    WHERE o.customer_id = p_customer_id
        AND o.status = 'delivered';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_delivery_orders()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    emp_role TEXT;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    emp_role := get_employee_role();
    
    SELECT json_agg(
        json_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'customer_name', o.customer_name,
            'customer_phone', o.customer_phone,
            'customer_address', o.customer_address,
            'items', o.items,
            'total', o.total,
            'status', o.status,
            'payment_status', o.payment_status,
            'delivery_started_at', o.delivery_started_at,
            'estimated_delivery_time', o.estimated_delivery_time,
            'created_at', o.created_at
        )
        ORDER BY o.created_at DESC
    ) INTO result
    FROM orders o
    WHERE o.order_type = 'online'
    AND (
        emp_role IN ('admin', 'manager') OR 
        o.delivery_rider_id = emp_id OR
        (o.delivery_rider_id IS NULL AND o.status = 'ready')
    )
    AND o.status IN ('ready', 'delivering');
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_alerts(p_unread_only boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', a.id,
            'item_id', a.inventory_id,
            'item_name', i.name,
            'alert_type', a.alert_type,
            'message', a.message,
            'is_read', a.is_read,
            'is_resolved', a.is_resolved,
            'created_at', a.created_at
        )
        ORDER BY a.created_at DESC
    ) INTO result
    FROM inventory_alerts a
    JOIN inventory i ON i.id = a.inventory_id
    WHERE (NOT p_unread_only OR (a.is_read = false AND a.is_resolved = false));
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_items()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', i.id,
            'name', i.name,
            'sku', COALESCE(i.sku, ''),
            'category', i.category,
            'unit', i.unit,
            'current_stock', COALESCE(i.quantity, 0),
            'min_stock', COALESCE(i.min_quantity, 0),
            'max_stock', COALESCE(i.max_quantity, 100),
            'cost_per_unit', COALESCE(i.cost_per_unit, 0),
            'supplier', COALESCE(i.supplier, ''),
            'last_restocked', i.last_restocked,
            'status', CASE 
                WHEN COALESCE(i.quantity, 0) <= 0 THEN 'out_of_stock'
                WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 0) THEN 'low_stock'
                ELSE 'in_stock'
            END,
            'notes', i.notes,
            'location', i.location,
            'barcode', i.barcode,
            'expiry_date', i.expiry_date,
            'is_active', COALESCE(i.is_active, true),
            'reorder_point', COALESCE(i.reorder_point, i.min_quantity, 10),
            'lead_time_days', COALESCE(i.lead_time_days, 7),
            'total_value', ROUND(COALESCE(i.quantity, 0) * COALESCE(i.cost_per_unit, 0), 2),
            'created_at', i.created_at,
            'updated_at', i.updated_at
        )
        ORDER BY i.name
    ) INTO result
    FROM inventory i
    WHERE COALESCE(i.is_active, true) = true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_report()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check if user is authenticated and is manager/admin
    -- OR if called from server-side (auth.uid() is null - server queries don't have session)
    IF auth.uid() IS NULL THEN
        -- Server-side call - authorization is handled at app level
        v_is_authorized := TRUE;
    ELSE
        -- Client-side call - check if user is manager or admin
        v_is_authorized := EXISTS (
            SELECT 1 FROM employees 
            WHERE auth_user_id = auth.uid() 
            AND status = 'active'
            AND role IN ('admin', 'manager')
        );
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_items', (SELECT COUNT(*) FROM inventory),
        'low_stock_count', (SELECT COUNT(*) FROM inventory WHERE quantity <= min_quantity),
        'out_of_stock', (SELECT COUNT(*) FROM inventory WHERE quantity = 0),
        'total_value', (SELECT COALESCE(SUM(quantity * cost_per_unit), 0) FROM inventory),
        'categories', (
            SELECT COALESCE(json_agg(cat_data), '[]'::json)
            FROM (
                SELECT 
                    json_build_object(
                        'category', category,
                        'item_count', COUNT(*),
                        'total_value', SUM(quantity * cost_per_unit),
                        'low_stock', COUNT(*) FILTER (WHERE quantity <= min_quantity)
                    ) as cat_data
                FROM inventory
                GROUP BY category
            ) cat_sub
        ),
        'low_stock_items', (
            SELECT COALESCE(json_agg(item_data), '[]'::json)
            FROM (
                SELECT 
                    json_build_object(
                        'id', id,
                        'name', name,
                        'quantity', quantity,
                        'min_quantity', min_quantity,
                        'unit', unit
                    ) as item_data
                FROM inventory
                WHERE quantity <= min_quantity
                ORDER BY (quantity / NULLIF(min_quantity, 0)) ASC
                LIMIT 10
            ) item_sub
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_suppliers()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', s.id,
            'name', s.name,
            'contact_person', s.contact_person,
            'email', s.email,
            'phone', s.phone,
            'address', s.address,
            'city', s.city,
            'payment_terms', s.payment_terms,
            'lead_time_days', s.lead_time_days,
            'rating', s.rating,
            'is_active', s.is_active,
            'items_count', (SELECT COUNT(*) FROM inventory WHERE supplier = s.name),
            'notes', s.notes,
            'created_at', s.created_at
        )
        ORDER BY s.name
    ) INTO result
    FROM inventory_suppliers s;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_transactions(p_item_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 100, p_transaction_type text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'item_id', t.inventory_id,
            'item_name', i.name,
            'item_sku', i.sku,
            'type', COALESCE(t.transaction_type, t.type),
            'quantity', COALESCE(t.quantity_change, t.quantity),
            'unit', i.unit,
            'unit_cost', t.unit_cost,
            'total_cost', t.total_cost,
            'reason', COALESCE(t.notes, t.reason),
            'reference_number', t.reference_number,
            'batch_number', t.batch_number,
            'performed_by', (SELECT name FROM employees WHERE id = COALESCE(t.created_by, t.performed_by)),
            'created_at', t.created_at
        )
        ORDER BY t.created_at DESC
    ) INTO result
    FROM inventory_transactions t
    JOIN inventory i ON i.id = t.inventory_id
    WHERE (p_item_id IS NULL OR t.inventory_id = p_item_id)
    AND (p_start_date IS NULL OR DATE(t.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(t.created_at) <= p_end_date)
    AND (p_transaction_type IS NULL OR COALESCE(t.transaction_type, t.type) = p_transaction_type)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- NOTE: The following get_c* through get_i* functions are referenced in code but do NOT exist in the database:
-- get_contact_messages, get_customer_by_email, get_customer_dashboard, get_customer_deals,
-- get_customer_invoices, get_customer_loyalty_points, get_customer_notifications,
-- get_customer_order_history, get_customer_promos_admin, get_daily_sales_report,
-- get_delivery_history, get_delivery_stats, get_employee_attendance, get_employee_by_email,
-- get_employee_dashboard, get_employee_details, get_employee_leave_balance,
-- get_employee_leave_requests, get_employee_payroll, get_employee_schedule,
-- get_hourly_sales_report, get_customer_by_id, get_customer_by_auth,
-- get_delivery_orders_for_rider, get_delivery_rider_stats, get_employee_by_id,
-- get_employee_payslips, get_daily_attendance_summary, get_inventory_categories,
-- get_inventory_dashboard, get_inventory_item

-- ==================== END BATCH D ====================

-- ==================== BATCH E: get_i* through get_w* ====================

CREATE OR REPLACE FUNCTION public.get_employee_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    emp_role TEXT;
BEGIN
    SELECT role::TEXT INTO emp_role
    FROM employees
    WHERE auth_user_id = auth.uid()
    AND status = 'active';
    RETURN emp_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoice_details(p_invoice_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_notifications(p_user_id uuid DEFAULT NULL::uuid, p_user_type text DEFAULT 'employee'::text, p_is_read boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    emp_id UUID;
BEGIN
    emp_id := COALESCE(p_user_id, get_employee_id());
    
    SELECT json_agg(
        json_build_object(
            'id', n.id,
            'title', n.title,
            'message', n.message,
            'type', n.type,
            'is_read', n.is_read,
            'data', n.data,
            'created_at', n.created_at
        )
        ORDER BY n.created_at DESC
    ) INTO result
    FROM notifications n
    WHERE n.user_id = emp_id
    AND n.user_type = p_user_type
    AND (p_is_read IS NULL OR n.is_read = p_is_read)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid, p_customer_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, order_number text, customer_name text, customer_email text, customer_phone text, customer_address text, items jsonb, subtotal numeric, tax numeric, delivery_fee numeric, discount numeric, total numeric, payment_method payment_method, payment_status text, status order_status, notes text, assigned_to uuid, assigned_to_name text, assigned_to_phone text, created_at timestamp with time zone, delivered_at timestamp with time zone, status_history jsonb, transaction_id text, online_payment_method_id uuid, online_payment_details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
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
    WHERE o.id = p_order_id
        AND (p_customer_id IS NULL OR o.customer_id = p_customer_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_payroll_summary(p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_payroll', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE (p_period_start IS NULL OR period_start >= p_period_start)
            AND (p_period_end IS NULL OR period_end <= p_period_end)
        ),
        'pending_count', (
            SELECT COUNT(*)
            FROM payslips
            WHERE status = 'pending'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'pending'
        ),
        'paid_this_month', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'paid'
            AND paid_at >= date_trunc('month', CURRENT_DATE)
        ),
        'employees_count', (
            SELECT COUNT(*)
            FROM employees
            WHERE status = 'active'
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_payslips(p_employee_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 100)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'employee_id', p.employee_id,
            'employee', (
                SELECT json_build_object(
                    'id', e.id, 
                    'name', e.name, 
                    'role', e.role, 
                    'employee_id', e.employee_id
                )
                FROM employees e WHERE e.id = p.employee_id
            ),
            'period_start', p.period_start,
            'period_end', p.period_end,
            'base_salary', p.base_salary,
            'overtime_hours', p.overtime_hours,
            'overtime_rate', p.overtime_rate,
            'bonuses', p.bonuses,
            'deductions', p.deductions,
            'tax_amount', p.tax_amount,
            'net_salary', p.net_salary,
            'status', p.status,
            'payment_method', p.payment_method,
            'paid_at', p.paid_at,
            'notes', p.notes,
            'created_at', p.created_at
        )
        ORDER BY p.period_end DESC
    ) INTO result
    FROM payslips p
    WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_start_date IS NULL OR p.period_start >= p_start_date)
    AND (p_end_date IS NULL OR p.period_end <= p_end_date)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_selling_items(p_limit integer DEFAULT 10, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(item_name text, item_type text, total_quantity bigint, total_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        item->>'name' as item_name,
        item->>'type' as item_type,
        SUM((item->>'quantity')::INT)::BIGINT as total_quantity,
        SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT) as total_revenue
    FROM orders o,
    LATERAL jsonb_array_elements(o.items) as item
    WHERE 
        (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
    GROUP BY item->>'name', item->>'type'
    ORDER BY total_quantity DESC
    LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_website_settings_internal()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT content INTO result
    FROM website_content
    WHERE key = 'settings'
    LIMIT 1;
    
    RETURN json_build_object(
        'success', true,
        'settings', result
    );
END;
$function$;

-- NOTE: The following get_i* through get_w* functions are referenced in code but do NOT exist in the database:
-- get_invoice_by_id, get_invoices, get_leave_requests, get_loyalty_points,
-- get_loyalty_points_history, get_menu_categories, get_menu_items, get_menu_items_by_category,
-- get_monthly_revenue, get_monthly_sales_report, get_my_customer_profile,
-- get_order_by_id, get_order_history, get_order_status_timeline, get_orders,
-- get_orders_by_status, get_orders_by_table, get_pending_orders, get_pending_reviews,
-- get_popular_items, get_promo_codes, get_promo_codes_admin, get_recent_orders,
-- get_reservations, get_reviews, get_sales_report, get_sales_trends,
-- get_table_orders, get_tables, get_top_customers, get_unread_notifications,
-- get_website_settings, get_weekly_sales_report, get_customer_loyalty_history

-- ==================== END BATCH E ====================

-- ==================== BATCH F: l* through z* ====================

CREATE OR REPLACE FUNCTION public.apply_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    FOR UPDATE;

    IF v_promo IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid promo code',
            'error_code', 'NOT_FOUND'
        );
    END IF;

    IF NOT v_promo.is_active THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is no longer active',
            'error_code', 'INACTIVE'
        );
    END IF;

    IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is not available for your account',
            'error_code', 'WRONG_CUSTOMER'
        );
    END IF;

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

    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code has already been fully used',
            'error_code', 'USAGE_EXHAUSTED'
        );
    END IF;

    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required for this code',
            'error_code', 'MIN_ORDER_NOT_MET',
            'min_order_amount', v_promo.min_order_amount
        );
    END IF;

    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSIF v_promo.promo_type = 'fixed' THEN
        v_discount := v_promo.value;
        IF v_discount > p_order_amount THEN
            v_discount := p_order_amount;
        END IF;
    ELSIF v_promo.promo_type = 'free_item' THEN
        v_discount := COALESCE(v_promo.value, 0);
    ELSE
        v_discount := COALESCE(v_promo.value, 0);
    END IF;

    v_new_usage := COALESCE(v_promo.current_usage, 0) + 1;
    
    IF v_promo.usage_limit IS NOT NULL AND v_new_usage >= v_promo.usage_limit THEN
        v_is_exhausted := true;
    END IF;

    UPDATE promo_codes
    SET 
        current_usage = v_new_usage,
        is_active = CASE WHEN v_is_exhausted THEN false ELSE is_active END,
        updated_at = NOW()
    WHERE id = v_promo.id;

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
$function$;

CREATE OR REPLACE FUNCTION public.link_google_auth_to_customer(p_customer_id uuid, p_auth_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE customers
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_customer_id
    AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_action(p_action text, p_table_name text, p_record_id uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    INSERT INTO audit_logs (
        action, table_name, record_id, old_values, new_values,
        performed_by, ip_address, user_agent
    ) VALUES (
        p_action, p_table_name, p_record_id, p_old_values, p_new_values,
        emp_id, p_ip_address, p_user_agent
    );
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_attendance_with_code(p_code character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    emp_status VARCHAR;
    code_record RECORD;
    attendance_record RECORD;
    new_status VARCHAR;
    action_type VARCHAR;
    message TEXT;
BEGIN
    emp_id := get_employee_id();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    
    SELECT status INTO emp_status FROM employees WHERE id = emp_id;
    IF emp_status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Your account is not active');
    END IF;
    
    SELECT * INTO code_record
    FROM attendance_codes
    WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND valid_for_date = CURRENT_DATE
    AND CURRENT_TIME BETWEEN valid_from AND valid_until;
    
    IF code_record IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
    END IF;
    
    SELECT * INTO attendance_record
    FROM attendance
    WHERE employee_id = emp_id
    AND date = CURRENT_DATE;
    
    IF attendance_record IS NOT NULL THEN
        IF attendance_record.check_out IS NOT NULL THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'You have already checked out today'
            );
        END IF;
        
        UPDATE attendance
        SET check_out = NOW(),
            updated_at = NOW()
        WHERE id = attendance_record.id
        RETURNING * INTO attendance_record;
        
        action_type := 'check_out';
        message := 'Checked out successfully at ' || to_char(NOW(), 'HH12:MI AM');
    ELSE
        new_status := CASE 
            WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'
            ELSE 'present'
        END;
        
        INSERT INTO attendance (
            employee_id, 
            date, 
            check_in, 
            status,
            created_at,
            updated_at
        )
        VALUES (
            emp_id,
            CURRENT_DATE,
            NOW(),
            new_status,
            NOW(),
            NOW()
        )
        RETURNING * INTO attendance_record;
        
        action_type := 'check_in';
        message := CASE 
            WHEN new_status = 'late' 
            THEN 'Checked in as LATE at ' || to_char(NOW(), 'HH12:MI AM')
            ELSE 'Checked in successfully at ' || to_char(NOW(), 'HH12:MI AM')
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'action', action_type,
        'message', message,
        'attendance', json_build_object(
            'id', attendance_record.id,
            'date', attendance_record.date,
            'check_in', attendance_record.check_in,
            'check_out', attendance_record.check_out,
            'status', attendance_record.status
        )
    );
END;
$function$;

-- mark_notifications_read (overload 1: employee-based)
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = ANY(p_notification_ids)
    AND user_id = get_employee_id();
    
    RETURN json_build_object('success', true);
END;
$function$;

-- mark_notifications_read (overload 2: user_id-based)
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_user_id uuid, p_notification_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count INT;
BEGIN
    IF p_notification_ids IS NULL THEN
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = p_user_id AND is_read = FALSE;
    ELSE
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = p_user_id AND id = ANY(p_notification_ids);
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_table(p_table_id uuid, p_tip_amount numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_waiter_id UUID;
    v_table_record RECORD;
    v_order_id UUID;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    SELECT * INTO v_table_record FROM restaurant_tables 
    WHERE id = p_table_id FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    IF v_table_record.assigned_waiter_id != v_waiter_id THEN
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_waiter_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to release this table');
        END IF;
    END IF;
    
    v_order_id := v_table_record.current_order_id;
    
    IF v_order_id IS NOT NULL THEN
        UPDATE orders
        SET 
            status = 'delivered',
            payment_status = 'paid',
            updated_at = NOW()
        WHERE id = v_order_id;
        
        INSERT INTO order_status_history (order_id, status, changed_by, notes)
        VALUES (v_order_id, 'delivered'::order_status, v_waiter_id, 'Table released, bill paid');
        
        UPDATE waiter_order_history
        SET 
            order_status = 'completed',
            order_completed_at = NOW(),
            payment_status = 'paid',
            tip_amount = p_tip_amount,
            updated_at = NOW()
        WHERE order_id = v_order_id AND waiter_id = v_waiter_id;
    END IF;
    
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
    
    UPDATE restaurant_tables
    SET 
        status = 'cleaning',
        current_order_id = NULL,
        current_customers = 0,
        assigned_waiter_id = NULL,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    IF p_tip_amount > 0 THEN
        UPDATE employees
        SET 
            total_tips = COALESCE(total_tips, 0) + p_tip_amount,
            updated_at = NOW()
        WHERE id = v_waiter_id;
        
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
$function$;

CREATE OR REPLACE FUNCTION public.reply_to_review(p_review_id uuid, p_reply text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET 
        admin_reply = p_reply, 
        replied_at = NOW(),
        updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reply_to_review_by_employee(p_review_id uuid, p_reply text, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE reviews
    SET admin_reply = p_reply, 
        replied_at = NOW(), 
        replied_by = p_employee_id,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true, 'replied_at', NOW());
END;
$function$;

-- review_leave_request (overload 1: auth-based)
CREATE OR REPLACE FUNCTION public.review_leave_request(p_request_id uuid, p_status character varying, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  reviewer_id UUID;
  request_record RECORD;
  emp_record RECORD;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  reviewer_id := get_employee_id();
  
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status. Use approved or rejected');
  END IF;
  
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id;
  
  IF request_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'This request has already been reviewed');
  END IF;
  
  UPDATE leave_requests
  SET status = p_status,
      reviewed_by = reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_request_id;
  
  IF p_status = 'approved' AND request_record.leave_type IN ('annual', 'sick', 'casual') THEN
    UPDATE leave_balances
    SET 
      annual_used = CASE WHEN request_record.leave_type = 'annual' THEN annual_used + request_record.total_days ELSE annual_used END,
      sick_used = CASE WHEN request_record.leave_type = 'sick' THEN sick_used + request_record.total_days ELSE sick_used END,
      casual_used = CASE WHEN request_record.leave_type = 'casual' THEN casual_used + request_record.total_days ELSE casual_used END,
      updated_at = NOW()
    WHERE employee_id = request_record.employee_id;
    
    INSERT INTO attendance (employee_id, date, status, notes)
    SELECT 
      request_record.employee_id,
      d::date,
      'on_leave',
      format('%s leave', request_record.leave_type)
    FROM generate_series(request_record.start_date, request_record.end_date, '1 day'::interval) d
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = EXCLUDED.notes;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', format('Leave request %s successfully', p_status)
  );
END;
$function$;

-- review_leave_request (overload 2: caller_id-based)
CREATE OR REPLACE FUNCTION public.review_leave_request(p_caller_id uuid, p_request_id uuid, p_status character varying, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  reviewer_id UUID;
  request_record RECORD;
BEGIN
  reviewer_id := resolve_employee_id(p_caller_id);
  IF NOT check_manager_or_admin(reviewer_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN RETURN json_build_object('success', false, 'error', 'Invalid status'); END IF;
  
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id;
  IF request_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Leave request not found'); END IF;
  IF request_record.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Already reviewed'); END IF;
  
  UPDATE leave_requests SET status = p_status, reviewed_by = reviewer_id, reviewed_at = NOW(), review_notes = p_notes, updated_at = NOW()
  WHERE id = p_request_id;
  
  IF p_status = 'approved' AND request_record.leave_type IN ('annual', 'sick', 'casual') THEN
    UPDATE leave_balances SET
      annual_used = CASE WHEN request_record.leave_type = 'annual' THEN annual_used + request_record.total_days ELSE annual_used END,
      sick_used = CASE WHEN request_record.leave_type = 'sick' THEN sick_used + request_record.total_days ELSE sick_used END,
      casual_used = CASE WHEN request_record.leave_type = 'casual' THEN casual_used + request_record.total_days ELSE casual_used END
    WHERE employee_id = request_record.employee_id;
    
    INSERT INTO attendance (employee_id, date, status, notes)
    SELECT request_record.employee_id, d::date, 'on_leave', format('%s leave', request_record.leave_type)
    FROM generate_series(request_record.start_date, request_record.end_date, '1 day'::interval) d
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = EXCLUDED.notes;
  END IF;
  
  RETURN json_build_object('success', true, 'message', format('Leave request %s', p_status));
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_customer_review(p_customer_id uuid, p_rating integer, p_comment text, p_review_type text DEFAULT 'overall'::text, p_item_id uuid DEFAULT NULL::uuid, p_meal_id uuid DEFAULT NULL::uuid, p_order_id uuid DEFAULT NULL::uuid, p_images jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    review_count INTEGER;
    max_reviews INTEGER := 3;
    new_review_id UUID;
    is_verified BOOLEAN := false;
    v_review_type TEXT;
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('success', false, 'error', 'Rating must be between 1 and 5');
    END IF;
    
    SELECT COUNT(*) INTO review_count FROM reviews
    WHERE customer_id = p_customer_id AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day';
    
    IF review_count >= max_reviews THEN
        RETURN json_build_object('success', false, 'error', 'Daily review limit reached.');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF p_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND customer_id = p_customer_id AND status::text = 'delivered') THEN
        is_verified := true;
    END IF;
    
    v_review_type := COALESCE(p_review_type, 'overall');
    v_item_id := NULL;
    v_meal_id := NULL;
    
    IF p_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        v_review_type := 'item';
        v_item_id := p_item_id;
    ELSIF p_meal_id IS NOT NULL AND EXISTS (SELECT 1 FROM meals WHERE id = p_meal_id) THEN
        v_review_type := 'meal';
        v_meal_id := p_meal_id;
    ELSE
        IF v_review_type NOT IN ('overall', 'service', 'delivery') THEN
            v_review_type := 'overall';
        END IF;
    END IF;
    
    INSERT INTO reviews (customer_id, order_id, item_id, meal_id, rating, comment, review_type, images, is_verified, is_visible)
    VALUES (p_customer_id, p_order_id, v_item_id, v_meal_id, p_rating, p_comment, v_review_type, COALESCE(p_images, '[]'::jsonb), is_verified, true)
    RETURNING id INTO new_review_id;
    
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true) WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true) WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Review submitted successfully', 'review_id', new_review_id, 'is_verified', is_verified, 'reviews_remaining', max_reviews - review_count - 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_employee_portal(p_employee_id uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name TEXT;
BEGIN
  UPDATE employees SET
    portal_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'portal_enabled', p_enabled,
    'message', 'Portal access ' || CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END || ' for ' || v_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.unban_customer(p_customer_id uuid, p_unbanned_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer RECORD;
BEGIN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF v_customer.is_banned = false OR v_customer.is_banned IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is not banned');
    END IF;
    
    UPDATE customers SET
        is_banned = false,
        unbanned_at = NOW(),
        unbanned_by = p_unbanned_by
    WHERE id = p_customer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Customer unbanned successfully',
        'customer_name', v_customer.name,
        'customer_email', v_customer.email
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_customer_profile(p_customer_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF p_phone IS NOT NULL AND EXISTS (
        SELECT 1 FROM customers 
        WHERE phone = p_phone AND id != p_customer_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'Phone number already in use';
        RETURN;
    END IF;

    UPDATE customers
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        address = COALESCE(p_address, address),
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Customer not found';
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_employee(p_employee_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_role user_role DEFAULT NULL::user_role, p_permissions jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSONB;
    v_old_avatar TEXT;
BEGIN
    SELECT avatar_url INTO v_old_avatar FROM employees WHERE id = p_employee_id;
    
    UPDATE employees
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        role = COALESCE(p_role, role),
        permissions = COALESCE(p_permissions, permissions),
        status = COALESCE(p_status::employee_status, status),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = p_employee_id
    RETURNING jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'name', name,
        'phone', phone,
        'role', role,
        'status', status,
        'avatar_url', avatar_url,
        'old_avatar_url', v_old_avatar,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_employee_complete(p_employee_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_data JSONB;
  v_updated BOOLEAN := false;
BEGIN
  SELECT jsonb_build_object(
    'name', name,
    'email', email,
    'phone', phone,
    'role', role::TEXT,
    'status', status::TEXT
  ) INTO v_old_data
  FROM employees WHERE id = p_employee_id;

  IF v_old_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  IF p_data->>'email' IS NOT NULL AND p_data->>'email' != v_old_data->>'email' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE email = p_data->>'email' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email already in use');
    END IF;
  END IF;

  IF p_data->>'phone' IS NOT NULL AND p_data->>'phone' != v_old_data->>'phone' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE phone = p_data->>'phone' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Phone number already in use');
    END IF;
  END IF;

  UPDATE employees SET
    name = COALESCE(p_data->>'name', name),
    email = COALESCE(p_data->>'email', email),
    phone = COALESCE(p_data->>'phone', phone),
    address = COALESCE(p_data->>'address', address),
    emergency_contact = COALESCE(p_data->>'emergency_contact', emergency_contact),
    emergency_contact_name = COALESCE(p_data->>'emergency_contact_name', emergency_contact_name),
    date_of_birth = CASE WHEN p_data->>'date_of_birth' IS NOT NULL THEN (p_data->>'date_of_birth')::DATE ELSE date_of_birth END,
    blood_group = COALESCE(p_data->>'blood_group', blood_group),
    avatar_url = COALESCE(p_data->>'avatar_url', avatar_url),
    notes = COALESCE(p_data->>'notes', notes),
    salary = CASE WHEN p_data ? 'salary' THEN (p_data->>'salary')::NUMERIC ELSE salary END,
    portal_enabled = CASE WHEN p_data ? 'portal_enabled' THEN (p_data->>'portal_enabled')::BOOLEAN ELSE portal_enabled END,
    permissions = CASE WHEN p_data ? 'permissions' THEN (p_data->'permissions')::JSONB ELSE permissions END,
    bank_details = CASE WHEN p_data ? 'bank_details' THEN (p_data->'bank_details')::JSONB ELSE bank_details END,
    updated_at = NOW()
  WHERE id = p_employee_id;

  v_updated := FOUND;

  RETURN jsonb_build_object(
    'success', v_updated,
    'message', CASE WHEN v_updated THEN 'Employee updated successfully' ELSE 'No changes made' END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_inventory_item(p_item_id uuid, p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT NULL::text, p_min_quantity numeric DEFAULT NULL::numeric, p_max_quantity numeric DEFAULT NULL::numeric, p_cost_per_unit numeric DEFAULT NULL::numeric, p_supplier text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date, p_reorder_point numeric DEFAULT NULL::numeric, p_lead_time_days integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    
    IF p_sku IS NOT NULL AND EXISTS (SELECT 1 FROM inventory WHERE sku = p_sku AND id != p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'SKU already exists');
    END IF;
    
    UPDATE inventory SET
        name = COALESCE(p_name, name),
        sku = COALESCE(p_sku, sku),
        category = COALESCE(p_category, category),
        unit = COALESCE(p_unit, unit),
        min_quantity = COALESCE(p_min_quantity, min_quantity),
        max_quantity = COALESCE(p_max_quantity, max_quantity),
        cost_per_unit = COALESCE(p_cost_per_unit, cost_per_unit),
        supplier = COALESCE(p_supplier, supplier),
        notes = COALESCE(p_notes, notes),
        location = COALESCE(p_location, location),
        barcode = COALESCE(p_barcode, barcode),
        expiry_date = COALESCE(p_expiry_date, expiry_date),
        reorder_point = COALESCE(p_reorder_point, reorder_point),
        lead_time_days = COALESCE(p_lead_time_days, lead_time_days),
        updated_at = NOW()
    WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_menu_item(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_images jsonb DEFAULT NULL::jsonb, p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE menu_items
    SET 
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'price', price,
        'is_available', is_available,
        'is_featured', is_featured,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN COALESCE(v_result, jsonb_build_object('success', false, 'message', 'Item not found'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_new_status order_status, p_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer_id UUID;
    v_status_message TEXT;
BEGIN
    UPDATE orders
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_order_id
    RETURNING customer_id INTO v_customer_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO order_status_history (order_id, status, notes)
    VALUES (p_order_id, p_new_status, p_notes);
    
    v_status_message := CASE p_new_status
        WHEN 'confirmed' THEN 'Your order has been confirmed'
        WHEN 'preparing' THEN 'Your order is being prepared'
        WHEN 'ready' THEN 'Your order is ready for pickup'
        WHEN 'out_for_delivery' THEN 'Your order is out for delivery'
        WHEN 'delivered' THEN 'Your order has been delivered'
        WHEN 'completed' THEN 'Your order is completed'
        WHEN 'cancelled' THEN 'Your order has been cancelled'
        ELSE 'Order status updated'
    END;
    
    INSERT INTO notifications (user_type, user_id, title, message, type)
    VALUES ('customer', v_customer_id, 'Order Update', v_status_message, 'order');
    
    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payslip_status(p_payslip_id uuid, p_status text, p_payment_method text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE payslips
    SET 
        status = p_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = p_payslip_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_table_status(p_table_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() AND NOT can_take_orders() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE restaurant_tables
    SET status = p_status::table_status,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid, p_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee_id UUID;
    v_invoice RECORD;
BEGIN
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
    
    INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES ('void_invoice', 'invoice', p_invoice_id, v_employee_id, 
            json_build_object('reason', p_reason, 'invoice_number', v_invoice.invoice_number));
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invoice voided successfully',
        'invoice_number', v_invoice.invoice_number
    );
END;
$function$;

-- NOTE: The following l* through z* functions are referenced in code but do NOT exist in the database:
-- mark_order_cancelled, mark_order_confirmed, mark_order_delivering, mark_order_preparing,
-- mark_order_ready, pay_invoice, portal_check_in, portal_check_out,
-- process_leave_request, redeem_loyalty_points, reset_table_status, save_website_settings,
-- search_customers, search_employees, search_inventory, search_orders,
-- toggle_customer_favorite, toggle_menu_item_availability,
-- toggle_review_visibility, toggle_review_visibility_by_employee,
-- update_employee_payroll, update_employee_permissions,
-- update_order_item_status, update_promo_code_admin, update_reservation_status,
-- verify_2fa, verify_customer_otp, can_take_orders

-- ==================== END BATCH F ====================


-- ==================== BATCH G: CREATE/DELETE/MISC FUNCTIONS ====================
-- Functions: activate_employee_account through get_attendance_summary_by_employee

CREATE OR REPLACE FUNCTION public.activate_employee_account(p_license_id character varying, p_auth_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    -- Find employee by license
    SELECT el.employee_id INTO emp_id
    FROM employee_licenses el
    WHERE el.license_id = p_license_id
    AND el.is_used = false
    AND el.expires_at > NOW();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired license ID'
        );
    END IF;
    
    -- Update employee
    UPDATE employees
    SET auth_user_id = p_auth_user_id,
        status = 'active',
        portal_enabled = true,
        updated_at = NOW()
    WHERE id = emp_id;
    
    -- Mark license as used
    UPDATE employee_licenses
    SET is_used = true,
        activated_at = NOW()
    WHERE license_id = p_license_id;
    
    RETURN json_build_object(
        'success', true,
        'employee_id', emp_id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_employee_document(p_employee_id uuid, p_document_type text, p_document_name text, p_file_url text, p_file_type text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_id UUID;
BEGIN
  -- Verify employee exists
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  INSERT INTO employee_documents (
    employee_id,
    document_type,
    document_name,
    file_url,
    file_type
  ) VALUES (
    p_employee_id,
    p_document_type,
    p_document_name,
    p_file_url,
    p_file_type
  ) RETURNING id INTO v_doc_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'message', 'Document added successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_order_by_waiter(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    -- Get order
    SELECT * INTO order_record
    FROM orders
    WHERE id = p_order_id;
    
    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if waiter owns this order
    IF order_record.waiter_id != emp_id THEN
        RETURN json_build_object('success', false, 'error', 'Not your order');
    END IF;
    
    -- Check time limit
    IF order_record.can_cancel_until < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Cancellation time limit exceeded');
    END IF;
    
    -- Cancel order
    UPDATE orders
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Insert cancellation record
    INSERT INTO order_cancellations (order_id, cancelled_by, reason)
    VALUES (p_order_id, emp_id, p_reason);
    
    -- Free up table if dine-in
    IF order_record.order_type = 'dine-in' AND order_record.table_number IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'available',
            current_order_id = NULL,
            current_customers = 0,
            assigned_waiter_id = NULL,
            updated_at = NOW()
        WHERE table_number = order_record.table_number;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_delivery(p_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE orders
    SET status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id
    AND delivery_rider_id = emp_id;
    
    -- Add status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, 'delivered', emp_id);
    
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_deal_with_items(p_name text, p_description text, p_code text, p_deal_type text, p_original_price numeric, p_discounted_price numeric, p_image_url text, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_is_active boolean, p_items jsonb)
 RETURNS TABLE(id uuid, code text, slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_deal_id UUID;
    v_code TEXT;
    v_slug TEXT;
    v_discount_percentage DECIMAL;
    v_item JSONB;
    v_image_url TEXT;
BEGIN
    -- Generate code if not provided (or empty)
    v_code := COALESCE(NULLIF(TRIM(p_code), ''), 'DEAL' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)));
    
    -- Generate slug from name
    v_slug := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := REGEXP_REPLACE(v_slug, '^-|-$', '', 'g');
    v_slug := v_slug || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
    
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Process image URL
    v_image_url := p_image_url;
    
    -- Insert the deal
    INSERT INTO deals (
        name, slug, description, code,
        original_price, discounted_price, discount_percentage,
        images, valid_from, valid_until, usage_limit, is_active
    ) VALUES (
        p_name, v_slug, p_description, v_code,
        p_original_price, p_discounted_price, v_discount_percentage,
        CASE WHEN v_image_url IS NOT NULL AND v_image_url != '' THEN jsonb_build_array(v_image_url) ELSE '[]'::jsonb END,
        p_valid_from, p_valid_until, p_usage_limit, p_is_active
    ) RETURNING deals.id INTO v_deal_id;
    
    -- Insert items into deal_items relational table
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                v_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            )
            ON CONFLICT (deal_id, menu_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT v_deal_id, v_code, v_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_dine_in_order(p_table_id uuid, p_customer_count integer, p_items jsonb, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name character varying DEFAULT NULL::character varying, p_customer_phone character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_send_confirmation boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    new_order_id UUID;
    table_num INTEGER;
    calculated_subtotal DECIMAL(10, 2);
    calculated_total DECIMAL(10, 2);
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    -- Check if waiter can take orders
    IF NOT can_take_orders() THEN
        RAISE EXCEPTION 'Not authorized to take orders';
    END IF;
    
    -- Get table number
    SELECT table_number INTO table_num FROM restaurant_tables WHERE id = p_table_id;
    
    -- Calculate totals from items
    SELECT COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INTEGER), 0)
    INTO calculated_subtotal
    FROM jsonb_array_elements(p_items) as item;
    
    calculated_total := calculated_subtotal;
    
    -- Create order with AUTO-CONFIRMED status for dine-in
    INSERT INTO orders (
        customer_id, customer_name, customer_phone,
        order_type, items, subtotal, total,
        payment_method, table_number, notes,
        waiter_id, assigned_to, can_cancel_until,
        status
    ) VALUES (
        p_customer_id,
        COALESCE(p_customer_name, 'Walk-in Customer'),
        COALESCE(p_customer_phone, ''),
        'dine-in',
        p_items,
        calculated_subtotal,
        calculated_total,
        'cash',
        table_num,
        p_notes,
        emp_id,
        emp_id,
        NOW() + INTERVAL '5 minutes',
        'confirmed'
    ) RETURNING id INTO new_order_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (new_order_id, 'confirmed'::order_status, emp_id, 'Auto-confirmed dine-in order');
    
    -- Update table
    UPDATE restaurant_tables
    SET status = 'occupied',
        current_order_id = new_order_id,
        current_customers = p_customer_count,
        assigned_waiter_id = emp_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Update employee stats
    UPDATE employees
    SET total_orders_taken = total_orders_taken + 1,
        updated_at = NOW()
    WHERE id = emp_id;
    
    -- Insert table history
    INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
    VALUES (p_table_id, new_order_id, emp_id, p_customer_count, NOW());
    
    RETURN json_build_object(
        'success', true,
        'order_id', new_order_id,
        'order_number', (SELECT order_number FROM orders WHERE id = new_order_id),
        'status', 'confirmed',
        'send_confirmation', p_send_confirmation
    );
END;
$function$;

-- create_employee overload 1
CREATE OR REPLACE FUNCTION public.create_employee(p_email text, p_name text, p_phone text, p_role user_role, p_permissions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee_id TEXT;
    v_result JSONB;
BEGIN
    INSERT INTO employees (email, name, phone, role, permissions, status)
    VALUES (p_email, p_name, p_phone, p_role, p_permissions, 'pending')
    RETURNING jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'email', email,
        'name', name,
        'phone', phone,
        'role', role,
        'status', status,
        'created_at', created_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$function$;

-- create_employee overload 2
CREATE OR REPLACE FUNCTION public.create_employee(p_name character varying, p_email character varying, p_phone character varying, p_role text, p_salary numeric, p_hired_date date, p_documents jsonb DEFAULT '[]'::jsonb, p_address text DEFAULT NULL::text, p_emergency_contact character varying DEFAULT NULL::character varying, p_emergency_contact_name character varying DEFAULT NULL::character varying, p_date_of_birth date DEFAULT NULL::date, p_blood_group character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_employee_id UUID;
    new_license_id TEXT;
    result JSON;
BEGIN
    -- Check if caller is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admin can create employees';
    END IF;
    
    -- Generate unique license ID
    new_license_id := generate_license_id();
    
    -- Ensure license is unique
    WHILE EXISTS (SELECT 1 FROM employee_licenses WHERE license_id = new_license_id) LOOP
        new_license_id := generate_license_id();
    END LOOP;
    
    -- Insert employee
    INSERT INTO employees (
        name, email, phone, role, salary, hired_date,
        address, emergency_contact, emergency_contact_name,
        date_of_birth, blood_group, notes,
        status, license_id, created_by, portal_enabled
    ) VALUES (
        p_name, p_email, p_phone, p_role::user_role, p_salary, p_hired_date,
        p_address, p_emergency_contact, p_emergency_contact_name,
        p_date_of_birth, p_blood_group, p_notes,
        'pending', new_license_id, get_employee_id(), false
    ) RETURNING id INTO new_employee_id;
    
    -- Create license record
    INSERT INTO employee_licenses (
        employee_id, license_id, expires_at
    ) VALUES (
        new_employee_id, new_license_id, NOW() + INTERVAL '7 days'
    );
    
    -- Insert documents if provided
    IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
        INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, file_type)
        SELECT 
            new_employee_id,
            doc->>'type',
            doc->>'name',
            doc->>'url',
            doc->>'fileType'
        FROM jsonb_array_elements(p_documents) as doc;
    END IF;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'employee_id', new_employee_id,
        'license_id', new_license_id,
        'employee', (
            SELECT row_to_json(e.*)
            FROM employees e
            WHERE e.id = new_employee_id
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_google_oauth_customer(p_auth_user_id uuid, p_email text, p_name text, p_phone text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_existing_customer_id uuid;
  v_existing_employee_id uuid;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));
  
  -- Check if email already exists as an employee
  SELECT id INTO v_existing_employee_id
  FROM employees
  WHERE lower(email) = p_email
  LIMIT 1;
  
  IF v_existing_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'This email is registered as an employee. Please use your employee credentials.';
  END IF;
  
  -- Check if customer already exists with this email
  SELECT id INTO v_existing_customer_id
  FROM customers
  WHERE lower(email) = p_email
  LIMIT 1;
  
  IF v_existing_customer_id IS NOT NULL THEN
    UPDATE customers
    SET auth_user_id = p_auth_user_id,
        updated_at = now()
    WHERE id = v_existing_customer_id
      AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
    
    RETURN v_existing_customer_id;
  END IF;
  
  -- Check if auth_user_id already linked
  SELECT id INTO v_existing_customer_id
  FROM customers
  WHERE auth_user_id = p_auth_user_id
  LIMIT 1;
  
  IF v_existing_customer_id IS NOT NULL THEN
    RETURN v_existing_customer_id;
  END IF;
  
  -- Create new customer
  INSERT INTO customers (
    email,
    name,
    phone,
    auth_user_id,
    is_verified,
    created_at,
    updated_at
  )
  VALUES (
    p_email,
    COALESCE(NULLIF(p_name, ''), split_part(p_email, '@', 1)),
    COALESCE(p_phone, ''),
    p_auth_user_id,
    true,
    now(),
    now()
  )
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_inventory_item(p_name text, p_sku text DEFAULT NULL::text, p_category text DEFAULT 'other'::text, p_unit text DEFAULT 'pcs'::text, p_quantity numeric DEFAULT 0, p_min_quantity numeric DEFAULT 10, p_max_quantity numeric DEFAULT 100, p_cost_per_unit numeric DEFAULT 0, p_supplier text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    new_item_id UUID;
    generated_sku TEXT;
BEGIN
    emp_id := get_employee_id();
    
    -- Generate SKU if not provided
    IF p_sku IS NULL OR p_sku = '' THEN
        generated_sku := UPPER(LEFT(REPLACE(p_name, ' ', ''), 3)) || '-' || TO_CHAR(NOW(), 'YYMMDDHH24MI');
    ELSE
        generated_sku := p_sku;
    END IF;
    
    -- Check for duplicate SKU
    IF EXISTS (SELECT 1 FROM inventory WHERE sku = generated_sku) THEN
        RETURN json_build_object('success', false, 'error', 'SKU already exists');
    END IF;
    
    INSERT INTO inventory (
        name, sku, category, unit, quantity, min_quantity, max_quantity,
        cost_per_unit, supplier, notes, location, barcode, expiry_date,
        is_active, created_by, created_at, updated_at
    ) VALUES (
        p_name, generated_sku, p_category, p_unit, p_quantity, p_min_quantity, p_max_quantity,
        p_cost_per_unit, p_supplier, p_notes, p_location, p_barcode, p_expiry_date,
        true, emp_id, NOW(), NOW()
    ) RETURNING id INTO new_item_id;
    
    -- Log initial stock transaction
    IF p_quantity > 0 THEN
        INSERT INTO inventory_transactions (
            inventory_id, transaction_type, quantity_change,
            unit_cost, total_cost, notes, created_by, created_at
        ) VALUES (
            new_item_id, 'initial', p_quantity,
            p_cost_per_unit, p_quantity * p_cost_per_unit,
            'Initial stock entry', emp_id, NOW()
        );
    END IF;
    
    RETURN json_build_object('success', true, 'id', new_item_id, 'sku', generated_sku);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_inventory_supplier(p_name text, p_contact_person text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text, p_lead_time_days integer DEFAULT 7, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO inventory_suppliers (
        name, contact_person, email, phone, address, city,
        payment_terms, lead_time_days, notes
    ) VALUES (
        p_name, p_contact_person, p_email, p_phone, p_address, p_city,
        p_payment_terms, p_lead_time_days, p_notes
    ) RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$function$;

-- create_menu_item_advanced overload 1
CREATE OR REPLACE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_is_spicy boolean DEFAULT false, p_is_vegetarian boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Item name is required');
    END IF;
    
    IF p_price IS NULL OR p_price < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid price is required');
    END IF;
    
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    
    WHILE EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    
    INSERT INTO menu_items (
        category_id, name, slug, description, price,
        images, is_available, is_featured, is_spicy, is_vegetarian, preparation_time
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price,
        p_images, p_is_available, p_is_featured, p_is_spicy, p_is_vegetarian, p_preparation_time
    )
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item created successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'slug', v_result.slug,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'created_at', v_result.created_at
        )
    );
END;
$function$;

-- create_menu_item_advanced overload 2
CREATE OR REPLACE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer, p_has_variants boolean DEFAULT false, p_size_variants jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Item name is required');
    END IF;
    
    IF p_price IS NULL OR p_price < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid price is required');
    END IF;
    
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    
    WHILE EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    
    INSERT INTO menu_items (
        category_id, name, slug, description, price,
        images, is_available, is_featured, preparation_time,
        has_variants, size_variants
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price,
        to_jsonb(p_images), p_is_available, p_is_featured, p_preparation_time,
        COALESCE(p_has_variants, false),
        CASE WHEN p_has_variants THEN p_size_variants ELSE NULL END
    )
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item created successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'slug', v_result.slug,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'has_variants', v_result.has_variants,
            'size_variants', v_result.size_variants,
            'created_at', v_result.created_at
        )
    );
END;
$function$;

-- create_menu_item_advanced overload 3
CREATE OR REPLACE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_sale_price numeric DEFAULT NULL::numeric, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_is_spicy boolean DEFAULT false, p_is_vegetarian boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Item name is required');
    END IF;
    
    IF p_price IS NULL OR p_price < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid price is required');
    END IF;
    
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    
    WHILE EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    
    INSERT INTO menu_items (
        category_id, name, slug, description, price, sale_price,
        images, is_available, is_featured, is_spicy, is_vegetarian, preparation_time
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price, p_sale_price,
        p_images, p_is_available, p_is_featured, p_is_spicy, p_is_vegetarian, p_preparation_time
    )
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item created successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'slug', v_result.slug,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'created_at', v_result.created_at
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_payment_method(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_display_order integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type. Must be jazzcash, easypaisa, or bank');
    END IF;
    
    IF p_method_name IS NULL OR TRIM(p_method_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Method name is required');
    END IF;
    
    IF p_account_number IS NULL OR TRIM(p_account_number) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account number is required');
    END IF;
    
    IF p_account_holder_name IS NULL OR TRIM(p_account_holder_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account holder name is required');
    END IF;
    
    IF p_method_type = 'bank' AND (p_bank_name IS NULL OR TRIM(p_bank_name) = '') THEN
        RETURN json_build_object('success', false, 'error', 'Bank name is required for bank accounts');
    END IF;
    
    INSERT INTO payment_methods (
        method_type, method_name, account_number, account_holder_name,
        bank_name, is_active, display_order
    ) VALUES (
        p_method_type, TRIM(p_method_name), TRIM(p_account_number),
        TRIM(p_account_holder_name), NULLIF(TRIM(p_bank_name), ''),
        p_is_active, p_display_order
    )
    RETURNING id INTO v_new_id;
    
    RETURN json_build_object('success', true, 'id', v_new_id, 'message', 'Payment method created successfully');
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_payment_method_internal(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_display_order integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_id UUID;
BEGIN
    IF p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type');
    END IF;
    
    INSERT INTO payment_methods (method_type, method_name, account_number, account_holder_name, bank_name, is_active, display_order)
    VALUES (p_method_type, p_method_name, p_account_number, p_account_holder_name, p_bank_name, p_is_active, p_display_order)
    RETURNING id INTO v_new_id;
    
    RETURN json_build_object('success', true, 'id', v_new_id, 'message', 'Payment method created');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_payslip_advanced(p_employee_id uuid, p_period_start date, p_period_end date, p_base_salary numeric, p_overtime_hours numeric DEFAULT 0, p_overtime_rate numeric DEFAULT 1.5, p_bonuses numeric DEFAULT 0, p_deductions numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_id UUID;
    v_net_salary DECIMAL;
    v_overtime_pay DECIMAL;
    v_emp_name TEXT;
BEGIN
    SELECT name INTO v_emp_name FROM employees WHERE id = p_employee_id AND status = 'active';
    IF v_emp_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found or inactive');
    END IF;

    v_overtime_pay := (p_base_salary / 30.0 / 8.0) * p_overtime_hours * p_overtime_rate;
    v_net_salary := p_base_salary + v_overtime_pay + p_bonuses - p_deductions - p_tax_amount;
    
    INSERT INTO payslips (
        employee_id, period_start, period_end, base_salary,
        overtime_hours, overtime_rate, bonuses, deductions,
        tax_amount, net_salary, status, payment_method, notes, created_by
    ) VALUES (
        p_employee_id, p_period_start, p_period_end, p_base_salary,
        p_overtime_hours, p_overtime_rate, p_bonuses, p_deductions,
        p_tax_amount, v_net_salary, 'pending', p_payment_method, p_notes, p_created_by
    )
    RETURNING id INTO new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', new_id,
        'net_salary', v_net_salary,
        'employee_name', v_emp_name
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_portal_order(p_order_data json)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

    IF p_order_data->>'table_ids' IS NOT NULL 
       AND p_order_data->>'table_ids' != 'null' 
       AND p_order_data->>'table_ids' != '[]' THEN
        SELECT array_agg(elem::text::uuid)
        INTO v_table_ids
        FROM json_array_elements_text(p_order_data->'table_ids') elem;
    ELSIF v_table_id IS NOT NULL THEN
        v_table_ids := ARRAY[v_table_id];
    END IF;

    IF v_employee_id IS NOT NULL THEN
        SELECT name INTO v_employee_name FROM employees WHERE id = v_employee_id;
    END IF;

    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        SELECT string_agg(table_number::text, ', ' ORDER BY table_number)
        INTO v_table_numbers
        FROM restaurant_tables
        WHERE id = ANY(v_table_ids);
        
        SELECT table_number INTO v_table_number 
        FROM restaurant_tables 
        WHERE id = v_table_ids[1];
    END IF;

    IF v_customer_name IS NULL OR TRIM(v_customer_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Customer name is required');
    END IF;

    IF v_items IS NULL OR json_array_length(v_items) = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Order must have at least one item');
    END IF;

    SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(
               (SELECT COUNT(*)::INT + 1 
                FROM orders 
                WHERE DATE(created_at) = CURRENT_DATE), 
               1
           )::TEXT, 4, '0')
    INTO v_order_number;

    v_item_count := json_array_length(v_items);
    FOR v_item IN SELECT * FROM json_array_elements(v_items)
    LOOP
        v_subtotal := v_subtotal + (
            COALESCE((v_item.value->>'price')::NUMERIC, 0) * 
            COALESCE((v_item.value->>'quantity')::INT, 1)
        );
        v_total_quantity := v_total_quantity + COALESCE((v_item.value->>'quantity')::INT, 1);
    END LOOP;

    v_tax := ROUND(v_subtotal * 0.16, 2);
    v_total := v_subtotal + v_tax;
    v_loyalty_points_earned := FLOOR(v_total / 100);
    v_order_id := gen_random_uuid();

    INSERT INTO orders (
        id, order_number, customer_id, customer_name, customer_phone,
        customer_email, customer_address, order_type, table_number,
        status, payment_status, payment_method, items, subtotal, tax, total,
        notes, waiter_id, created_at, updated_at
    ) VALUES (
        v_order_id, v_order_number, v_customer_id, TRIM(v_customer_name),
        v_customer_phone, v_customer_email, v_customer_address,
        v_order_type::order_type, v_table_number,
        CASE WHEN v_order_type = 'online' THEN 'pending'::order_status ELSE 'preparing'::order_status END,
        'pending', 'cash'::payment_method, v_items, v_subtotal, v_tax, v_total,
        v_notes, v_employee_id, NOW(), NOW()
    );

    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        FOREACH v_tid IN ARRAY v_table_ids
        LOOP
            UPDATE restaurant_tables 
            SET status = 'occupied', current_order_id = v_order_id, updated_at = NOW()
            WHERE id = v_tid;
        END LOOP;
    END IF;

    IF v_customer_id IS NOT NULL THEN
        IF v_loyalty_points_earned > 0 THEN
            INSERT INTO loyalty_points (id, customer_id, order_id, points, type, description, created_at)
            VALUES (gen_random_uuid(), v_customer_id, v_order_id, v_loyalty_points_earned, 'earned', 
                    'Points earned from order ' || v_order_number || ' (Rs. ' || v_total::text || ')', NOW());
        END IF;
        UPDATE customers SET updated_at = NOW() WHERE id = v_customer_id;
    END IF;

    BEGIN
        INSERT INTO order_activity_log (id, order_id, action, action_by, action_by_name, details, created_at)
        VALUES (gen_random_uuid(), v_order_id, 'created', v_employee_id, v_employee_name,
            json_build_object(
                'order_number', v_order_number, 'customer_type', v_customer_type,
                'customer_id', v_customer_id, 'customer_name', v_customer_name,
                'customer_phone', v_customer_phone, 'customer_email', v_customer_email,
                'order_type', v_order_type, 'table_numbers', v_table_numbers,
                'item_count', v_item_count, 'total_quantity', v_total_quantity,
                'subtotal', v_subtotal, 'tax', v_tax, 'total', v_total,
                'loyalty_points_earned', v_loyalty_points_earned, 'created_via', 'portal'
            ), NOW());
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    RETURN json_build_object(
        'success', true, 'order_id', v_order_id, 'order_number', v_order_number,
        'customer_id', v_customer_id, 'customer_type', v_customer_type,
        'customer_name', v_customer_name, 'order_type', v_order_type,
        'table_numbers', v_table_numbers, 'item_count', v_item_count,
        'total_quantity', v_total_quantity, 'subtotal', v_subtotal,
        'tax', v_tax, 'total', v_total, 'loyalty_points_earned', v_loyalty_points_earned,
        'employee_name', v_employee_name, 'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_waiter_dine_in_order(p_table_id uuid, p_items jsonb, p_customer_count integer DEFAULT 1, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_customer_email text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_send_email boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    SELECT * INTO v_waiter_record FROM employees 
    WHERE id = v_waiter_id AND role IN ('waiter', 'admin', 'manager') AND status = 'active';
    
    IF v_waiter_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as waiter');
    END IF;
    
    SELECT * INTO v_table_record FROM restaurant_tables WHERE id = p_table_id FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    IF v_table_record.assigned_waiter_id IS NOT NULL 
       AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table is assigned to another waiter');
    END IF;
    
    IF p_customer_phone IS NOT NULL OR p_customer_email IS NOT NULL THEN
        SELECT * INTO v_customer_record FROM customers
        WHERE (p_customer_phone IS NOT NULL AND phone = p_customer_phone) OR
              (p_customer_email IS NOT NULL AND email = p_customer_email)
        LIMIT 1;
        
        IF v_customer_record IS NOT NULL THEN
            v_is_registered := true;
            p_customer_id := v_customer_record.id;
            p_customer_name := COALESCE(p_customer_name, v_customer_record.name);
            p_customer_email := COALESCE(p_customer_email, v_customer_record.email);
            p_customer_phone := COALESCE(p_customer_phone, v_customer_record.phone);
        END IF;
    END IF;
    
    SELECT 
        COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT), 0)
    INTO v_subtotal, v_total_items
    FROM jsonb_array_elements(p_items) AS item;
    
    v_tax := ROUND(v_subtotal * 0.05, 2);
    v_total := v_subtotal + v_tax;
    
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM orders WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    INSERT INTO orders (
        customer_id, customer_name, customer_phone, customer_email,
        order_type, status, items, subtotal, tax, total,
        payment_method, payment_status, table_number, notes,
        waiter_id, assigned_to, can_cancel_until
    ) VALUES (
        p_customer_id, COALESCE(p_customer_name, 'Walk-in Customer'),
        p_customer_phone, p_customer_email, 'dine-in', 'confirmed',
        p_items, v_subtotal, v_tax, v_total, p_payment_method,
        CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_table_record.table_number, p_notes, v_waiter_id, v_waiter_id,
        NOW() + INTERVAL '5 minutes'
    )
    RETURNING id, order_number INTO v_new_order_id, v_order_number;
    
    UPDATE restaurant_tables
    SET status = 'occupied', current_order_id = v_new_order_id,
        current_customers = p_customer_count, assigned_waiter_id = v_waiter_id, updated_at = NOW()
    WHERE id = p_table_id;
    
    INSERT INTO waiter_order_history (
        waiter_id, order_id, order_number, table_id, table_number,
        customer_id, customer_name, customer_phone, customer_email, customer_count,
        is_registered_customer, items, total_items, subtotal, tax, total,
        payment_method, payment_status, invoice_number, order_status, order_confirmed_at
    ) VALUES (
        v_waiter_id, v_new_order_id, v_order_number, p_table_id, v_table_record.table_number,
        p_customer_id, p_customer_name, p_customer_phone, p_customer_email, p_customer_count,
        v_is_registered, p_items, v_total_items, v_subtotal, v_tax, v_total,
        p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_invoice_number, 'confirmed', NOW()
    )
    RETURNING id INTO v_history_id;
    
    BEGIN
        INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
        VALUES (p_table_id, v_new_order_id, v_waiter_id, p_customer_count, NOW());
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;
    
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (v_new_order_id, 'confirmed'::order_status, v_waiter_id, 'Order created by waiter');
    
    UPDATE employees
    SET total_orders_taken = COALESCE(total_orders_taken, 0) + 1, updated_at = NOW()
    WHERE id = v_waiter_id;
    
    IF v_is_registered AND p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_orders = COALESCE(total_orders, 0) + 1,
            total_spent = COALESCE(total_spent, 0) + v_total,
            loyalty_points = COALESCE(loyalty_points, 0) + FLOOR(v_total / 10),
            updated_at = NOW()
        WHERE id = p_customer_id;
    END IF;
    
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    SELECT e.id, 'employee', 'New Dine-in Order',
        'Order #' || v_order_number || ' - Table ' || v_table_record.table_number,
        'order',
        jsonb_build_object('order_id', v_new_order_id, 'order_number', v_order_number,
            'table_number', v_table_record.table_number, 'items_count', v_total_items)
    FROM employees e
    WHERE e.role IN ('kitchen_staff', 'admin', 'manager') AND e.status = 'active' AND e.portal_enabled = true;
    
    RETURN json_build_object(
        'success', true, 'order_id', v_new_order_id, 'order_number', v_order_number,
        'invoice_number', v_invoice_number, 'history_id', v_history_id,
        'table', json_build_object('id', p_table_id, 'table_number', v_table_record.table_number),
        'customer', json_build_object('id', p_customer_id, 'name', p_customer_name,
            'email', p_customer_email, 'phone', p_customer_phone, 'is_registered', v_is_registered),
        'order', json_build_object('subtotal', v_subtotal, 'tax', v_tax, 'total', v_total,
            'items_count', v_total_items, 'payment_method', p_payment_method),
        'send_email', p_send_email AND p_customer_email IS NOT NULL,
        'created_at', NOW()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO loyalty_points (
        customer_id, order_id, points, type, description, created_at
    ) VALUES (
        p_customer_id, p_order_id, -p_points, 'redeemed',
        'Redeemed ' || p_points || ' points for order ' || p_order_number, NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_customer_review(p_customer_id uuid, p_review_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    SELECT item_id, meal_id INTO v_item_id, v_meal_id
    FROM reviews WHERE id = p_review_id AND customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found or unauthorized');
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id AND customer_id = p_customer_id;
    
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items 
        SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true)
        WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals 
        SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true)
        WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Review deleted successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_deal_cascade(p_deal_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    DELETE FROM deals WHERE id = p_deal_id;
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE employees
    SET status = 'inactive', updated_at = NOW()
    WHERE id = p_employee_id;
    
    RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_employee_cascade(p_employee_id uuid, p_deleted_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_data JSONB;
  v_employee_name TEXT;
  v_documents_deleted INTEGER := 0;
  v_payroll_deleted INTEGER := 0;
  v_attendance_deleted INTEGER := 0;
BEGIN
  SELECT jsonb_build_object(
    'employee_id', employee_id, 'name', name, 'email', email, 'role', role::TEXT
  ), name INTO v_employee_data, v_employee_name
  FROM employees WHERE id = p_employee_id;

  IF v_employee_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  DELETE FROM employee_documents WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_documents_deleted = ROW_COUNT;

  DELETE FROM employee_payroll WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_payroll_deleted = ROW_COUNT;

  DELETE FROM attendance WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

  DELETE FROM employee_licenses WHERE employee_id = p_employee_id;
  UPDATE delivery_history SET rider_id = NULL WHERE rider_id = p_employee_id;
  DELETE FROM employees WHERE id = p_employee_id;

  INSERT INTO audit_logs (action, table_name, record_id, old_data, user_id)
  VALUES ('delete_employee', 'employees', p_employee_id, v_employee_data, p_deleted_by);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" deleted successfully',
    'deleted', jsonb_build_object(
      'documents', v_documents_deleted,
      'payroll_records', v_payroll_deleted,
      'attendance_records', v_attendance_deleted
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_inventory_item(p_item_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE inventory SET is_active = false, updated_at = NOW() WHERE id = p_item_id;
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_menu_item(p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_images JSONB;
    v_result JSONB;
BEGIN
    SELECT images INTO v_images FROM menu_items WHERE id = p_item_id;
    DELETE FROM menu_items WHERE id = p_item_id;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'images', COALESCE(v_images, '[]'::jsonb));
    ELSE
        RETURN jsonb_build_object('success', false, 'images', '[]'::jsonb);
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_payment_method(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    DELETE FROM payment_methods WHERE id = p_id;
    RETURN json_build_object('success', true, 'message', 'Payment method deleted successfully');
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_payment_method_internal(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    DELETE FROM payment_methods WHERE id = p_id;
    RETURN json_build_object('success', true, 'message', 'Payment method deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_payslip_advanced(p_payslip_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM payslips WHERE id = p_payslip_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;

    DELETE FROM payslips WHERE id = p_payslip_id;
    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_review_advanced(p_review_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT item_id, meal_id INTO v_item_id, v_meal_id FROM reviews WHERE id = p_review_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found');
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id;
    
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items 
        SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true)
        WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals 
        SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true)
        WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Review deleted successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_employee_report(p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'employee', json_build_object('id', e.id, 'name', e.name, 'role', e.role, 'hired_date', e.hired_date),
            'attendance', (
                SELECT json_build_object(
                    'present_days', COUNT(*) FILTER (WHERE status = 'present'),
                    'late_days', COUNT(*) FILTER (WHERE status = 'late'),
                    'absent_days', COUNT(*) FILTER (WHERE status = 'absent'),
                    'total_hours', SUM(hours_worked)
                )
                FROM attendance a WHERE a.employee_id = e.id AND a.date BETWEEN p_start_date AND p_end_date
            ),
            'performance', (
                SELECT json_build_object('orders_handled', COUNT(*), 'revenue_generated', SUM(total))
                FROM orders o
                WHERE (o.waiter_id = e.id OR o.assigned_to = e.id)
                AND DATE(o.created_at) BETWEEN p_start_date AND p_end_date
            ),
            'tips_earned', (
                SELECT COALESCE(SUM(tip_amount), 0)
                FROM waiter_tips wt WHERE wt.waiter_id = e.id AND wt.date BETWEEN p_start_date AND p_end_date
            )
        )
    ) INTO result
    FROM employees e WHERE e.status = 'active';
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice(p_order_id uuid, p_payment_method text, p_tip numeric DEFAULT 0, p_discount numeric DEFAULT 0, p_promo_code text DEFAULT NULL::text, p_loyalty_points_used integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    order_record RECORD;
    promo_record RECORD;
    loyalty_record RECORD;
    new_invoice_id UUID;
    promo_discount DECIMAL(10, 2) := 0;
    points_discount DECIMAL(10, 2) := 0;
    total_discount DECIMAL(10, 2);
    final_total DECIMAL(10, 2);
    points_earned INTEGER;
    result JSON;
BEGIN
    IF NOT can_access_billing() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    SELECT * INTO order_record FROM orders WHERE id = p_order_id;
    
    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF p_promo_code IS NOT NULL THEN
        SELECT * INTO promo_record FROM promo_codes
        WHERE code = p_promo_code AND is_active = true
        AND valid_from <= NOW() AND valid_until >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit);
        
        IF promo_record IS NOT NULL THEN
            IF promo_record.promo_type = 'percentage' THEN
                promo_discount := order_record.subtotal * (promo_record.value / 100);
                IF promo_record.max_discount IS NOT NULL THEN
                    promo_discount := LEAST(promo_discount, promo_record.max_discount);
                END IF;
            ELSE
                promo_discount := promo_record.value;
            END IF;
            UPDATE promo_codes SET current_usage = current_usage + 1, updated_at = NOW() WHERE id = promo_record.id;
        END IF;
    END IF;
    
    IF p_loyalty_points_used > 0 AND order_record.customer_id IS NOT NULL THEN
        SELECT * INTO loyalty_record FROM loyalty_points WHERE customer_id = order_record.customer_id;
        IF loyalty_record IS NOT NULL AND loyalty_record.points >= p_loyalty_points_used THEN
            points_discount := p_loyalty_points_used * 0.1;
            UPDATE loyalty_points SET points = points - p_loyalty_points_used, updated_at = NOW()
            WHERE customer_id = order_record.customer_id;
            INSERT INTO loyalty_transactions (customer_id, points_change, transaction_type, order_id, description, created_by)
            VALUES (order_record.customer_id, -p_loyalty_points_used, 'redeemed', p_order_id, 'Redeemed for order', emp_id);
        END IF;
    END IF;
    
    total_discount := p_discount + promo_discount + points_discount;
    final_total := order_record.subtotal - total_discount + p_tip;
    points_earned := FLOOR(final_total / 100);
    
    INSERT INTO invoices (
        order_id, customer_id, customer_name, customer_phone, customer_email,
        order_type, items, subtotal, discount, discount_details,
        tip, total, payment_method, payment_status,
        loyalty_points_earned, table_number, served_by, billed_by
    ) VALUES (
        p_order_id, order_record.customer_id, order_record.customer_name,
        order_record.customer_phone, order_record.customer_email,
        order_record.order_type, order_record.items, order_record.subtotal,
        total_discount,
        json_build_object('manual_discount', p_discount, 'promo_discount', promo_discount,
            'promo_code', p_promo_code, 'points_discount', points_discount, 'points_used', p_loyalty_points_used),
        p_tip, final_total, p_payment_method, 'paid',
        points_earned, order_record.table_number, order_record.waiter_id, emp_id
    ) RETURNING id INTO new_invoice_id;
    
    IF order_record.customer_id IS NOT NULL AND points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, points, lifetime_points)
        VALUES (order_record.customer_id, points_earned, points_earned)
        ON CONFLICT (customer_id) DO UPDATE
        SET points = loyalty_points.points + points_earned,
            lifetime_points = loyalty_points.lifetime_points + points_earned,
            tier = calculate_loyalty_tier(loyalty_points.lifetime_points + points_earned),
            updated_at = NOW();
        INSERT INTO loyalty_transactions (customer_id, points_change, transaction_type, order_id, description, created_by)
        VALUES (order_record.customer_id, points_earned, 'earned', p_order_id, 'Earned from order', emp_id);
    END IF;
    
    IF p_tip > 0 AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO waiter_tips (waiter_id, order_id, invoice_id, tip_amount, table_id, date)
        SELECT order_record.waiter_id, p_order_id, new_invoice_id, p_tip, rt.id, CURRENT_DATE
        FROM restaurant_tables rt WHERE rt.table_number = order_record.table_number;
        UPDATE employees SET total_tips = total_tips + p_tip, updated_at = NOW() WHERE id = order_record.waiter_id;
    END IF;
    
    UPDATE orders SET status = 'delivered', payment_status = 'paid',
        payment_method = p_payment_method::payment_method, updated_at = NOW()
    WHERE id = p_order_id;
    
    IF order_record.order_type = 'dine-in' AND order_record.table_number IS NOT NULL THEN
        UPDATE restaurant_tables SET status = 'cleaning', current_order_id = NULL,
            current_customers = 0, updated_at = NOW()
        WHERE table_number = order_record.table_number;
        UPDATE table_history SET closed_at = NOW(), total_bill = final_total, tip_amount = p_tip
        WHERE order_id = p_order_id;
    END IF;
    
    IF promo_record IS NOT NULL THEN
        INSERT INTO promo_code_usage (promo_code_id, customer_id, order_id, discount_applied)
        VALUES (promo_record.id, order_record.customer_id, p_order_id, promo_discount);
    END IF;
    
    SELECT json_build_object(
        'success', true, 'invoice_id', new_invoice_id,
        'invoice_number', (SELECT invoice_number FROM invoices WHERE id = new_invoice_id),
        'total', final_total, 'points_earned', points_earned
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_sales_report(p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),
        'summary', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(total), 0),
                'total_orders', COUNT(*),
                'avg_order_value', COALESCE(AVG(total), 0),
                'cancelled_orders', COUNT(*) FILTER (WHERE status = 'cancelled')
            ) FROM orders WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
        ),
        'by_order_type', (
            SELECT json_agg(json_build_object('type', order_type, 'count', cnt, 'revenue', revenue))
            FROM (
                SELECT order_type, COUNT(*) as cnt, SUM(total) as revenue
                FROM orders WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date AND status != 'cancelled'
                GROUP BY order_type
            ) t
        ),
        'by_payment_method', (
            SELECT json_agg(json_build_object('method', payment_method, 'count', cnt, 'revenue', revenue))
            FROM (
                SELECT payment_method, COUNT(*) as cnt, SUM(total) as revenue
                FROM orders WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date AND status != 'cancelled'
                GROUP BY payment_method
            ) t
        ),
        'top_items', (
            SELECT json_agg(item_stats ORDER BY total_sold DESC)
            FROM (
                SELECT item->>'name' as item_name, SUM((item->>'quantity')::int) as total_sold,
                    SUM((item->>'price')::decimal * (item->>'quantity')::int) as revenue
                FROM orders, jsonb_array_elements(items) as item
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date AND status != 'cancelled'
                GROUP BY item->>'name' LIMIT 10
            ) item_stats
        ),
        'daily_breakdown', (
            SELECT json_agg(json_build_object('date', date, 'revenue', revenue, 'orders', orders) ORDER BY date)
            FROM (
                SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
                FROM orders WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date AND status != 'cancelled'
                GROUP BY DATE(created_at)
            ) daily
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_reviews(p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 100)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'id', r.id,
            'customer', (SELECT json_build_object('id', c.id, 'name', c.name, 'email', c.email) FROM customers c WHERE c.id = r.customer_id),
            'order_id', r.order_id,
            'item', CASE WHEN r.item_id IS NOT NULL THEN
                (SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.image) FROM menu_items mi WHERE mi.id = r.item_id)
                ELSE NULL END,
            'meal', CASE WHEN r.meal_id IS NOT NULL THEN
                (SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.image) FROM meals m WHERE m.id = r.meal_id)
                ELSE NULL END,
            'rating', r.rating, 'comment', r.comment, 'images', r.images,
            'is_verified', r.is_verified, 'is_visible', r.is_visible,
            'admin_reply', r.admin_reply, 'replied_at', r.replied_at, 'created_at', r.created_at
        ) ORDER BY r.created_at DESC
    ) INTO result
    FROM reviews r
    WHERE (p_status IS NULL OR 
           (p_status = 'visible' AND r.is_visible = true) OR
           (p_status = 'hidden' AND r.is_visible = false) OR
           (p_status = 'verified' AND r.is_verified = true))
    AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
    AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_customer_promo_codes_admin(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_filter text DEFAULT 'all'::text, p_search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSON;
    v_total INT;
BEGIN
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

    SELECT COALESCE(json_agg(row_to_json(promo_row)), '[]'::json)
    INTO v_result
    FROM (
        SELECT 
            pc.id, pc.customer_id,
            COALESCE(c.name, 'All Customers') as customer_name,
            c.email as customer_email, c.phone as customer_phone,
            pc.code, pc.promo_type::TEXT as promo_type, pc.value, pc.max_discount,
            pc.name, pc.description, pc.usage_limit, pc.current_usage, pc.is_active,
            (pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit) as is_used,
            NULL::TIMESTAMPTZ as used_at, pc.valid_until as expires_at, pc.created_at,
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

    RETURN json_build_object('success', true, 'promos', v_result, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_customers_admin(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text)
 RETURNS TABLE(customer_id uuid, customer_name text, customer_email text, customer_phone text, customer_address text, is_verified boolean, is_banned boolean, ban_reason text, banned_at timestamp with time zone, created_at timestamp with time zone, total_orders bigint, total_spending numeric, online_orders bigint, dine_in_orders bigint, takeaway_orders bigint, last_order_date timestamp with time zone, loyalty_points integer, total_invoices bigint, total_invoice_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        c.created_at,
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        os.last_order_date,
        COALESCE(lp.points, 0)::INTEGER AS loyalty_points,
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount
    FROM customers c
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_orders, SUM(total) AS total_spending,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders,
            MAX(o.created_at) AS last_order_date
        FROM orders o WHERE o.customer_id = c.id
    ) os ON true
    LEFT JOIN LATERAL (
        SELECT SUM(lpt.points) AS points FROM loyalty_points lpt WHERE lpt.customer_id = c.id
    ) lp ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_invoices, SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir WHERE cir.customer_id = c.id
    ) inv ON true
    WHERE (p_search IS NULL OR c.name ILIKE '%' || p_search || '%' OR c.email ILIKE '%' || p_search || '%' OR c.phone ILIKE '%' || p_search || '%')
        AND (p_filter = 'all' OR (p_filter = 'active' AND (c.is_banned IS NULL OR c.is_banned = false))
            OR (p_filter = 'banned' AND c.is_banned = true))
    ORDER BY c.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_customers_loyalty(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
                cust.id as customer_id, cust.name as customer_name, 
                cust.phone as customer_phone, cust.email as customer_email,
                cust.created_at as member_since,
                COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0)::INT as total_points,
                COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0)::INT as current_balance,
                CASE 
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 1000 THEN 'platinum'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 500 THEN 'gold'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 250 THEN 'silver'
                    ELSE 'bronze'
                END as tier,
                COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id AND lp.type IN ('earned', 'bonus')), 0)::INT as total_points_earned,
                COALESCE((SELECT ABS(SUM(lp.points)) FROM loyalty_points lp WHERE lp.customer_id = cust.id AND lp.type = 'redeemed'), 0)::INT as total_points_redeemed,
                COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = cust.id), 0)::INT as total_transactions,
                (SELECT MIN(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as first_transaction,
                (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as last_transaction,
                (SELECT COUNT(*) FROM promo_codes pc WHERE pc.customer_id = cust.id AND pc.is_active = true 
                 AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit) AND pc.valid_until > NOW()) as active_promos
            FROM customers cust
            WHERE p_search IS NULL OR cust.name ILIKE '%' || p_search || '%'
               OR cust.phone ILIKE '%' || p_search || '%' OR cust.email ILIKE '%' || p_search || '%'
            ORDER BY (SELECT COALESCE(SUM(lp.points), 0) FROM loyalty_points lp WHERE lp.customer_id = cust.id) DESC
            LIMIT p_limit OFFSET p_offset
        ) c
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_deals_with_items()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', d.id, 'name', d.name, 'description', d.description, 'code', d.code, 'deal_type', d.deal_type,
            'original_price', d.original_price, 'discounted_price', d.discounted_price, 'discount_percentage', d.discount_percentage,
            'image_url', d.image_url, 'valid_from', d.valid_from, 'valid_until', d.valid_until,
            'usage_limit', d.usage_limit, 'usage_count', d.usage_count, 'is_active', d.is_active, 'is_featured', d.is_featured, 'created_at', d.created_at,
            'items', COALESCE((
                SELECT json_agg(json_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', di.quantity, 'image', m.images->0))
                FROM deal_items di JOIN menu_items m ON m.id = di.menu_item_id WHERE di.deal_id = d.id
            ), '[]'::json)
        ) ORDER BY d.created_at DESC
    ) INTO result FROM deals d;
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_payment_methods()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized. Only admin and manager can access all payment methods.');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id, 'method_type', pm.method_type, 'method_name', pm.method_name,
                    'account_number', pm.account_number, 'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name, 'is_active', pm.is_active, 'display_order', pm.display_order,
                    'created_at', pm.created_at, 'updated_at', pm.updated_at
                ) ORDER BY pm.display_order, pm.method_name
            ) FROM payment_methods pm
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
$function$;

CREATE OR REPLACE FUNCTION public.get_all_payment_methods_internal()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id, 'method_type', pm.method_type, 'method_name', pm.method_name,
                    'account_number', pm.account_number, 'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name, 'is_active', pm.is_active, 'display_order', pm.display_order,
                    'created_at', pm.created_at, 'updated_at', pm.updated_at
                ) ORDER BY pm.display_order, pm.method_name
            ) FROM payment_methods pm
        ), '[]'::json),
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM payment_methods),
            'active', (SELECT COUNT(*) FROM payment_methods WHERE is_active = true),
            'inactive', (SELECT COUNT(*) FROM payment_methods WHERE is_active = false),
            'jazzcash', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'jazzcash' AND is_active = true),
            'easypaisa', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'easypaisa' AND is_active = true),
            'bank', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'bank' AND is_active = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_perks_settings()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT json_object_agg(setting_key, json_build_object(
            'value', setting_value, 'description', description,
            'is_active', is_active, 'updated_at', updated_at
        ))
        FROM perks_settings WHERE is_active = true
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_review_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'total_reviews', (SELECT COUNT(*) FROM reviews),
        'visible_reviews', (SELECT COUNT(*) FROM reviews WHERE is_visible = true),
        'hidden_reviews', (SELECT COUNT(*) FROM reviews WHERE is_visible = false),
        'verified_reviews', (SELECT COUNT(*) FROM reviews WHERE is_verified = true),
        'average_rating', COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews), 0),
        'five_star', (SELECT COUNT(*) FROM reviews WHERE rating = 5),
        'four_star', (SELECT COUNT(*) FROM reviews WHERE rating = 4),
        'three_star', (SELECT COUNT(*) FROM reviews WHERE rating = 3),
        'two_star', (SELECT COUNT(*) FROM reviews WHERE rating = 2),
        'one_star', (SELECT COUNT(*) FROM reviews WHERE rating = 1),
        'pending_replies', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NULL),
        'total_replied', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NOT NULL),
        'this_week', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days'),
        'this_month', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '30 days'),
        'today', (SELECT COUNT(*) FROM reviews WHERE created_at >= CURRENT_DATE),
        'most_helpful', (SELECT MAX(helpful_count) FROM reviews),
        'avg_helpful', COALESCE((SELECT ROUND(AVG(helpful_count)::numeric, 1) FROM reviews WHERE helpful_count > 0), 0),
        'by_type', (
            SELECT json_object_agg(COALESCE(review_type, 'overall'), type_count)
            FROM (SELECT review_type, COUNT(*) as type_count FROM reviews GROUP BY review_type) t
        ),
        'recent_avg_rating', COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days'), 0),
        'previous_avg_rating', COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0)
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_users_for_maintenance_email()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    customer_count INTEGER;
    employee_count INTEGER;
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized - not admin');
    END IF;
    
    SELECT COUNT(*) INTO customer_count FROM customers WHERE email IS NOT NULL AND email != '' AND is_banned = false;
    SELECT COUNT(*) INTO employee_count FROM employees WHERE email IS NOT NULL AND email != '' AND status = 'active' AND role != 'admin';
    
    SELECT json_build_object(
        'success', true,
        'debug', json_build_object('customer_count', customer_count, 'employee_count', employee_count),
        'customers', COALESCE((
            SELECT json_agg(json_build_object('email', c.email, 'name', COALESCE(c.name, 'Customer')))
            FROM customers c WHERE c.email IS NOT NULL AND c.email != '' AND c.is_banned = false
        ), '[]'::json),
        'employees', COALESCE((
            SELECT json_agg(json_build_object('email', e.email, 'name', COALESCE(e.name, 'Employee')))
            FROM employees e WHERE e.email IS NOT NULL AND e.email != '' AND e.status = 'active' AND e.role != 'admin'
        ), '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_attendance_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    total_active INTEGER;
    present_count INTEGER;
    late_count INTEGER;
    on_leave_count INTEGER;
    absent_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    SELECT COUNT(*) INTO total_active FROM employees WHERE status = 'active';
    
    SELECT 
        COUNT(*) FILTER (WHERE status = 'present'),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'on_leave')
    INTO present_count, late_count, on_leave_count
    FROM attendance WHERE date = CURRENT_DATE;
    
    absent_count := total_active - present_count - late_count - on_leave_count;
    IF absent_count < 0 THEN absent_count := 0; END IF;
    
    RETURN json_build_object(
        'success', true,
        'stats', json_build_object(
            'total', total_active, 'present', present_count, 'late', late_count,
            'on_leave', on_leave_count, 'absent', absent_count,
            'attendance_rate', CASE WHEN total_active > 0 
                THEN ROUND(((present_count + late_count)::NUMERIC / total_active) * 100, 1)
                ELSE 0 END
        )
    );
END;
$function$;

-- get_attendance_summary_by_employee overload 1
CREATE OR REPLACE FUNCTION public.get_attendance_summary_by_employee(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  start_date DATE;
  end_date DATE;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + INTERVAL '1 month')::DATE;
  
  SELECT json_build_object(
    'success', true,
    'month', to_char(start_date, 'YYYY-MM'),
    'summary', COALESCE(json_agg(
      json_build_object(
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role, 'avatar_url', e.avatar_url),
        'present_days', COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
        'late_days', COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0),
        'absent_days', COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0),
        'leave_days', COALESCE(SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END), 0),
        'half_days', COALESCE(SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END), 0),
        'total_hours', COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(a.check_out, NOW()) - a.check_in)) / 3600)::NUMERIC, 1), 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  LEFT JOIN attendance a ON a.employee_id = e.id AND a.date >= start_date AND a.date < end_date
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_id, e.name, e.role, e.avatar_url
  ORDER BY e.name;
  
  RETURN result;
END;
$function$;

-- get_attendance_summary_by_employee overload 2
CREATE OR REPLACE FUNCTION public.get_attendance_summary_by_employee(p_caller_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  start_date DATE;
  end_date DATE;
  result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + INTERVAL '1 month')::DATE;
  
  SELECT json_build_object(
    'success', true,
    'month', to_char(start_date, 'YYYY-MM'),
    'summary', COALESCE(json_agg(
      json_build_object(
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role, 'avatar_url', e.avatar_url),
        'present_days', COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
        'late_days', COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0),
        'absent_days', COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0),
        'leave_days', COALESCE(SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END), 0),
        'half_days', COALESCE(SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END), 0),
        'total_hours', COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(a.check_out, NOW()) - a.check_in)) / 3600)::NUMERIC, 1), 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  LEFT JOIN attendance a ON a.employee_id = e.id AND a.date >= start_date AND a.date < end_date
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_id, e.name, e.role, e.avatar_url
  ORDER BY e.name;
  
  RETURN result;
END;
$function$;

-- ==================== END BATCH G ====================


-- ==================== BATCH H: GET FUNCTIONS (PART 1) ====================

CREATE OR REPLACE FUNCTION public.get_contact_message_by_id(p_message_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'message', (
            SELECT json_build_object(
                'id', cm.id,
                'name', cm.name,
                'email', cm.email,
                'phone', cm.phone,
                'subject', cm.subject,
                'message', cm.message,
                'status', cm.status,
                'priority', cm.priority,
                'ip_address', cm.ip_address,
                'user_agent', cm.user_agent,
                'reply_message', cm.reply_message,
                'replied_at', cm.replied_at,
                'reply_sent_via', cm.reply_sent_via,
                'created_at', cm.created_at,
                'updated_at', cm.updated_at,
                'replied_by', CASE 
                    WHEN cm.replied_by IS NOT NULL THEN (
                        SELECT json_build_object('id', e.id, 'name', e.name, 'role', e.role)
                        FROM employees e WHERE e.id = cm.replied_by
                    )
                    ELSE NULL
                END,
                'customer', CASE 
                    WHEN cm.customer_id IS NOT NULL THEN (
                        SELECT json_build_object(
                            'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone,
                            'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id)
                        )
                        FROM customers c WHERE c.id = cm.customer_id
                    )
                    ELSE NULL
                END
            )
            FROM contact_messages cm
            WHERE cm.id = p_message_id
        )
    ) INTO result;
    
    -- Mark as read if unread
    UPDATE contact_messages SET status = 'read', updated_at = NOW()
    WHERE id = p_message_id AND status = 'unread';
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_contact_message_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM contact_messages),
            'unread', (SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'),
            'read', (SELECT COUNT(*) FROM contact_messages WHERE status = 'read'),
            'replied', (SELECT COUNT(*) FROM contact_messages WHERE status = 'replied'),
            'archived', (SELECT COUNT(*) FROM contact_messages WHERE status = 'archived'),
            'urgent', (SELECT COUNT(*) FROM contact_messages WHERE priority = 'urgent' AND status != 'archived'),
            'high_priority', (SELECT COUNT(*) FROM contact_messages WHERE priority = 'high' AND status != 'archived'),
            'today', (SELECT COUNT(*) FROM contact_messages WHERE created_at >= CURRENT_DATE),
            'this_week', (SELECT COUNT(*) FROM contact_messages WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
            'avg_response_time_hours', (
                SELECT ROUND(EXTRACT(EPOCH FROM AVG(replied_at - created_at)) / 3600, 1)
                FROM contact_messages WHERE replied_at IS NOT NULL
            )
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_contact_messages_advanced(p_status text DEFAULT 'all'::text, p_sort_by text DEFAULT 'recent'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin and manager can access contact messages.'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'messages', COALESCE((
            SELECT json_agg(msg_data ORDER BY
                CASE WHEN p_sort_by = 'recent' THEN sub.created_at END DESC NULLS LAST,
                CASE WHEN p_sort_by = 'oldest' THEN sub.created_at END ASC NULLS LAST,
                CASE WHEN p_sort_by = 'priority' THEN 
                    CASE sub.priority 
                        WHEN 'urgent' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'normal' THEN 3 
                        ELSE 4 
                    END 
                END ASC NULLS LAST
            )
            FROM (
                SELECT json_build_object(
                    'id', cm.id,
                    'name', cm.name,
                    'email', cm.email,
                    'phone', cm.phone,
                    'subject', cm.subject,
                    'message', cm.message,
                    'status', cm.status,
                    'priority', cm.priority,
                    'reply_message', cm.reply_message,
                    'replied_at', cm.replied_at,
                    'reply_sent_via', cm.reply_sent_via,
                    'created_at', cm.created_at,
                    'updated_at', cm.updated_at,
                    -- Replied by employee info
                    'replied_by', CASE 
                        WHEN cm.replied_by IS NOT NULL THEN (
                            SELECT json_build_object(
                                'id', e.id,
                                'name', e.name,
                                'role', e.role
                            )
                            FROM employees e WHERE e.id = cm.replied_by
                        )
                        ELSE NULL
                    END,
                    -- Linked customer info
                    'customer', CASE 
                        WHEN cm.customer_id IS NOT NULL THEN (
                            SELECT json_build_object(
                                'id', c.id,
                                'name', c.name,
                                'email', c.email,
                                'phone', c.phone,
                                'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
                                'is_verified', COALESCE(c.is_verified, false)
                            )
                            FROM customers c WHERE c.id = cm.customer_id
                        )
                        ELSE NULL
                    END
                ) AS msg_data,
                cm.created_at,
                cm.priority
                FROM contact_messages cm
                WHERE 1=1
                -- Status filter
                AND (
                    p_status IS NULL 
                    OR p_status = 'all'
                    OR cm.status = p_status
                )
                -- Search filter
                AND (
                    p_search IS NULL 
                    OR p_search = ''
                    OR cm.name ILIKE '%' || p_search || '%'
                    OR cm.email ILIKE '%' || p_search || '%'
                    OR cm.phone ILIKE '%' || p_search || '%'
                    OR cm.subject ILIKE '%' || p_search || '%'
                    OR cm.message ILIKE '%' || p_search || '%'
                )
                ORDER BY cm.created_at DESC
                LIMIT p_limit
                OFFSET p_offset
            ) sub
        ), '[]'::json),
        'total_count', (
            SELECT COUNT(*)
            FROM contact_messages cm
            WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR cm.status = p_status)
            AND (
                p_search IS NULL 
                OR p_search = ''
                OR cm.name ILIKE '%' || p_search || '%'
                OR cm.email ILIKE '%' || p_search || '%'
                OR cm.message ILIKE '%' || p_search || '%'
            )
        ),
        'has_more', (
            SELECT COUNT(*) > (p_offset + p_limit)
            FROM contact_messages cm
            WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR cm.status = p_status)
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customer_by_auth_id(p_auth_user_id uuid)
 RETURNS TABLE(id uuid, auth_user_id uuid, name text, email text, phone text, address text, is_verified boolean, is_2fa_enabled boolean, favorites jsonb, is_banned boolean, ban_reason text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.auth_user_id,
    c.name::text,
    c.email::text,
    c.phone::text,
    c.address::text,
    c.is_verified,
    c.is_2fa_enabled,
    c.favorites,
    COALESCE(c.is_banned, false) as is_banned,
    c.ban_reason::text,
    c.created_at,
    c.updated_at
  FROM customers c
  WHERE c.auth_user_id = p_auth_user_id
  LIMIT 1;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customer_detail_admin(p_customer_id uuid)
 RETURNS TABLE(customer_id uuid, customer_name text, customer_email text, customer_phone text, customer_address text, is_verified boolean, is_banned boolean, ban_reason text, banned_at timestamp with time zone, banned_by_name text, unbanned_at timestamp with time zone, unbanned_by_name text, created_at timestamp with time zone, favorites jsonb, total_orders bigint, total_spending numeric, average_order_value numeric, online_orders bigint, dine_in_orders bigint, takeaway_orders bigint, loyalty_points integer, lifetime_points integer, total_invoices bigint, total_invoice_amount numeric, recent_orders jsonb, recent_invoices jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        banned_emp.name::TEXT AS banned_by_name,
        c.unbanned_at,
        unbanned_emp.name::TEXT AS unbanned_by_name,
        c.created_at,
        COALESCE(c.favorites, '[]'::jsonb) AS favorites,
        -- Order statistics
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.avg_order, 0) AS average_order_value,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        -- Loyalty
        COALESCE(lp.current_points, 0)::INTEGER AS loyalty_points,
        COALESCE(lp.lifetime_points, 0)::INTEGER AS lifetime_points,
        -- Invoice stats
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount,
        -- Recent orders (last 10)
        COALESCE(ro.orders, '[]'::jsonb) AS recent_orders,
        -- Recent invoices (last 10)
        COALESCE(ri.invoices, '[]'::jsonb) AS recent_invoices
    FROM customers c
    LEFT JOIN employees banned_emp ON c.banned_by = banned_emp.id
    LEFT JOIN employees unbanned_emp ON c.unbanned_by = unbanned_emp.id
    -- Order stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_orders,
            SUM(total) AS total_spending,
            AVG(total) AS avg_order,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders
        FROM orders o
        WHERE o.customer_id = c.id
    ) os ON true
    -- Loyalty points
    LEFT JOIN LATERAL (
        SELECT 
            SUM(lpt.points) AS current_points,
            SUM(ABS(lpt.points)) AS lifetime_points
        FROM loyalty_points lpt
        WHERE lpt.customer_id = c.id
    ) lp ON true
    -- Invoice stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir
        WHERE cir.customer_id = c.id
    ) inv ON true
    -- Recent orders
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                'total', o.total,
                'items', o.items,
                'payment_method', o.payment_method,
                'created_at', o.created_at
            ) ORDER BY o.created_at DESC
        ) AS orders
        FROM (
            SELECT ord.* FROM orders ord
            WHERE ord.customer_id = c.id 
            ORDER BY ord.created_at DESC 
            LIMIT 10
        ) o
    ) ro ON true
    -- Recent invoices
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', i.id,
                'invoice_number', i.invoice_number,
                'order_type', i.order_type,
                'total', i.total,
                'payment_method', i.payment_method,
                'loyalty_points_earned', i.loyalty_points_earned,
                'billed_at', i.billed_at
            ) ORDER BY i.billed_at DESC
        ) AS invoices
        FROM (
            SELECT cir.* FROM customer_invoice_records cir
            WHERE cir.customer_id = c.id 
            ORDER BY cir.billed_at DESC 
            LIMIT 10
        ) i
    ) ri ON true
    WHERE c.id = p_customer_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customer_orders_paginated(p_customer_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0, p_status order_status DEFAULT NULL::order_status)
 RETURNS TABLE(id uuid, order_number text, items jsonb, total numeric, status order_status, payment_method payment_method, payment_status text, customer_address text, created_at timestamp with time zone, delivered_at timestamp with time zone, assigned_to_name text, assigned_to_phone text, transaction_id text, online_payment_method_id uuid, online_payment_details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.items,
        o.total,
        o.status,
        o.payment_method,
        o.payment_status::TEXT,
        o.customer_address,
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
        AND (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customer_reviews(p_customer_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reviews', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'rating', r.rating,
                    'comment', r.comment,
                    'review_type', r.review_type,
                    'images', COALESCE(r.images, '[]'::jsonb),
                    'is_verified', r.is_verified,
                    'is_visible', r.is_visible,
                    'helpful_count', COALESCE(r.helpful_count, 0),
                    'item', CASE 
                        WHEN r.item_id IS NOT NULL THEN (
                            SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images->0)
                            FROM menu_items mi WHERE mi.id = r.item_id
                        )
                        ELSE NULL
                    END,
                    'meal', CASE 
                        WHEN r.meal_id IS NOT NULL THEN (
                            SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images->0)
                            FROM meals m WHERE m.id = r.meal_id
                        )
                        ELSE NULL
                    END,
                    'admin_reply', r.admin_reply,
                    'replied_at', r.replied_at,
                    'created_at', r.created_at
                )
                ORDER BY r.created_at DESC
            )
            FROM reviews r
            WHERE r.customer_id = p_customer_id
            LIMIT p_limit OFFSET p_offset
        ), '[]'::json),
        'total', (SELECT COUNT(*) FROM reviews WHERE customer_id = p_customer_id),
        'limit_info', check_customer_review_limit(p_customer_id)
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customers_stats()
 RETURNS TABLE(total_customers bigint, active_customers bigint, banned_customers bigint, verified_customers bigint, customers_this_month bigint, total_spending numeric, average_order_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_customers,
        COUNT(*) FILTER (WHERE c.is_banned IS NULL OR c.is_banned = false)::BIGINT AS active_customers,
        COUNT(*) FILTER (WHERE c.is_banned = true)::BIGINT AS banned_customers,
        COUNT(*) FILTER (WHERE c.is_verified = true)::BIGINT AS verified_customers,
        COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', NOW()))::BIGINT AS customers_this_month,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS total_spending,
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS average_order_value
    FROM customers c;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_deal_with_items(p_deal_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', d.id, 'name', d.name, 'description', d.description, 'code', d.code, 'deal_type', d.deal_type,
        'original_price', d.original_price, 'discounted_price', d.discounted_price, 'discount_percentage', d.discount_percentage,
        'image_url', d.image_url, 'valid_from', d.valid_from, 'valid_until', d.valid_until,
        'usage_limit', d.usage_limit, 'usage_count', d.usage_count, 'is_active', d.is_active, 'is_featured', d.is_featured, 'created_at', d.created_at,
        'items', COALESCE((
            SELECT json_agg(json_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', di.quantity, 'image', m.images->0))
            FROM deal_items di JOIN menu_items m ON m.id = di.menu_item_id WHERE di.deal_id = d.id
        ), '[]'::json)
    ) INTO result FROM deals d WHERE d.id = p_deal_id;
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_analytics(p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'employee', (
            SELECT row_to_json(e.*)
            FROM employees e
            WHERE e.id = p_employee_id
        ),
        'attendance_this_month', (
            SELECT json_build_object(
                'present_days', COUNT(*) FILTER (WHERE status = 'present'),
                'late_days', COUNT(*) FILTER (WHERE status = 'late'),
                'absent_days', COUNT(*) FILTER (WHERE status = 'absent'),
                'total_hours', SUM(hours_worked)
            )
            FROM attendance
            WHERE employee_id = p_employee_id
            AND date >= date_trunc('month', CURRENT_DATE)
        ),
        'orders_this_month', (
            SELECT COUNT(*)
            FROM orders
            WHERE (waiter_id = p_employee_id OR assigned_to = p_employee_id)
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'tips_this_month', (
            SELECT COALESCE(SUM(tip_amount), 0)
            FROM waiter_tips
            WHERE waiter_id = p_employee_id
            AND date >= date_trunc('month', CURRENT_DATE)
        ),
        'recent_orders', (
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'total', o.total,
                    'status', o.status,
                    'created_at', o.created_at
                )
                ORDER BY o.created_at DESC
            )
            FROM (
                SELECT * FROM orders
                WHERE waiter_id = p_employee_id OR assigned_to = p_employee_id
                ORDER BY created_at DESC
                LIMIT 10
            ) o
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_by_auth_user(p_auth_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id UUID;
  v_result JSONB;
BEGIN
  -- Get employee ID from auth_user_id
  SELECT id INTO v_employee_id
  FROM employees
  WHERE auth_user_id = p_auth_user_id;

  -- If employee not found, return null
  IF v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use the existing get_employee_complete function
  SELECT get_employee_complete(v_employee_id) INTO v_result;

  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_complete(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    -- Core employee data
    'id', e.id,
    'employee_id', e.employee_id,
    'auth_user_id', e.auth_user_id,
    'name', e.name,
    'email', e.email,
    'phone', e.phone,
    'role', e.role::TEXT,
    'status', e.status::TEXT,
    'avatar_url', e.avatar_url,
    'address', e.address,
    'emergency_contact', e.emergency_contact,
    'emergency_contact_name', e.emergency_contact_name,
    'date_of_birth', e.date_of_birth,
    'blood_group', e.blood_group,
    'hired_date', e.hired_date,
    'portal_enabled', e.portal_enabled,
    'permissions', e.permissions,
    'notes', e.notes,
    'last_login', e.last_login,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'created_by', e.created_by,
    'is_2fa_enabled', e.is_2fa_enabled,
    'license_id', e.license_id,
    'salary', e.salary,
    'total_tips', e.total_tips,
    'total_orders_taken', e.total_orders_taken,
    'bank_details', e.bank_details,
    'documents', e.documents,
    -- License info (from employee_licenses table)
    'license', (
      SELECT jsonb_build_object(
        'id', el.id,
        'license_id', el.license_id,
        'is_used', el.is_used,
        'activated_at', el.activated_at,
        'expires_at', el.expires_at,
        'issued_at', el.issued_at,
        'is_active', CASE 
          WHEN el.expires_at IS NULL THEN true
          WHEN el.expires_at > NOW() THEN true
          ELSE false
        END
      )
      FROM employee_licenses el
      WHERE el.employee_id = e.id
      ORDER BY el.issued_at DESC
      LIMIT 1
    ),
    -- Payroll info
    'payroll', jsonb_build_object(
      'salary', e.salary,
      'bank_details', e.bank_details,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'latest_payroll', (
        SELECT jsonb_build_object(
          'id', ep.id,
          'month', ep.month,
          'year', ep.year,
          'base_salary', ep.base_salary,
          'bonus', ep.bonus,
          'deductions', ep.deductions,
          'tips', ep.tips,
          'total_amount', ep.total_amount,
          'paid', ep.paid,
          'paid_at', ep.paid_at,
          'paid_by', ep.paid_by,
          'notes', ep.notes
        )
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id
        ORDER BY ep.year DESC, ep.month DESC
        LIMIT 1
      ),
      'pending_amount', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = false
      ), 0),
      'total_paid', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = true
      ), 0)
    ),
    -- Documents array (from employee_documents table)
    'employee_documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'document_type', ed.document_type,
        'document_name', ed.document_name,
        'file_url', ed.file_url,
        'file_type', ed.file_type,
        'uploaded_at', ed.uploaded_at,
        'verified', ed.verified,
        'verified_at', ed.verified_at,
        'verified_by', ed.verified_by
      ) ORDER BY ed.uploaded_at DESC)
      FROM employee_documents ed
      WHERE ed.employee_id = e.id
    ), '[]'::JSONB),
    -- Attendance stats
    'attendance_stats', jsonb_build_object(
      'this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'last_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ), 0),
      'total', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id
      ), 0),
      'late_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id AND a.status = 'late'
      ), 0),
      'last_check_in', (
        SELECT a.check_in FROM attendance a
        WHERE a.employee_id = e.id
        ORDER BY a.date DESC
        LIMIT 1
      )
    ),
    -- Recent attendance records
    'recent_attendance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'date', a.date,
        'check_in', a.check_in,
        'check_out', a.check_out,
        'status', a.status,
        'notes', a.notes
      ) ORDER BY a.date DESC)
      FROM (
        SELECT * FROM attendance 
        WHERE employee_id = e.id 
        ORDER BY date DESC 
        LIMIT 10
      ) a
    ), '[]'::JSONB)
  ) INTO v_result
  FROM employees e
  WHERE e.id = p_employee_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee not found', 'success', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_for_2fa(p_employee_id uuid)
 RETURNS TABLE(id uuid, email text, name text, phone text, role text, permissions jsonb, auth_user_id uuid, two_fa_secret text, is_2fa_enabled boolean, status text, portal_enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.email::TEXT,
        e.name::TEXT,
        e.phone::TEXT,
        e.role::TEXT,
        e.permissions,
        e.auth_user_id,
        e.two_fa_secret::TEXT,
        e.is_2fa_enabled,
        e.status::TEXT,
        COALESCE(e.portal_enabled, true) AS portal_enabled
    FROM employees e
    WHERE e.id = p_employee_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_leave_details(p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  balance_record RECORD;
  emp_record RECORD;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Get employee info
  SELECT * INTO emp_record FROM employees WHERE id = p_employee_id;
  IF emp_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  -- Get or create balance
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = p_employee_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (p_employee_id)
    RETURNING * INTO balance_record;
  END IF;
  
  -- Build complete response
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', emp_record.id,
      'employee_id', emp_record.employee_id,
      'name', emp_record.name,
      'role', emp_record.role,
      'avatar_url', emp_record.avatar_url
    ),
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used)
    ),
    'requests', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', id,
          'leave_type', leave_type,
          'start_date', start_date,
          'end_date', end_date,
          'total_days', total_days,
          'status', status,
          'created_at', created_at
        ) ORDER BY created_at DESC
      )
      FROM leave_requests
      WHERE employee_id = p_employee_id
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_leave_details(p_caller_id uuid, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  balance_record RECORD;
  emp_record RECORD;
  result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  SELECT * INTO emp_record FROM employees WHERE id = p_employee_id;
  IF emp_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Employee not found'); END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = p_employee_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (p_employee_id) RETURNING * INTO balance_record;
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object('id', emp_record.id, 'employee_id', emp_record.employee_id, 'name', emp_record.name, 'role', emp_record.role, 'avatar_url', emp_record.avatar_url),
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used)
    ),
    'requests', COALESCE((SELECT json_agg(json_build_object('id', id, 'leave_type', leave_type, 'start_date', start_date, 'end_date', end_date, 'total_days', total_days, 'status', status, 'created_at', created_at) ORDER BY created_at DESC) FROM leave_requests WHERE employee_id = p_employee_id AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_payroll_summary(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'employee', (
      SELECT jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'name', name,
        'email', email,
        'phone', phone,
        'role', role::TEXT,
        'status', status::TEXT,
        'avatar_url', avatar_url,
        'salary', salary,
        'bank_details', bank_details,
        'total_tips', total_tips,
        'total_orders_taken', total_orders_taken,
        'hired_date', hired_date,
        'address', address
      )
      FROM employees WHERE id = p_employee_id
    ),
    'payroll_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'month', month,
        'year', year,
        'base_salary', base_salary,
        'bonus', bonus,
        'deductions', deductions,
        'tips', tips,
        'total_amount', total_amount,
        'paid', paid,
        'paid_at', paid_at,
        'paid_by', paid_by,
        'notes', notes,
        'created_at', created_at
      ) ORDER BY year DESC, month DESC)
      FROM employee_payroll WHERE employee_id = p_employee_id
    ), '[]'::JSONB),
    'totals', (
      SELECT jsonb_build_object(
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'total_tips', COALESCE(SUM(tips), 0),
        'total_bonus', COALESCE(SUM(bonus), 0),
        'total_deductions', COALESCE(SUM(deductions), 0),
        'months_paid', COUNT(*) FILTER (WHERE paid = true),
        'months_pending', COUNT(*) FILTER (WHERE paid = false)
      )
      FROM employee_payroll WHERE employee_id = p_employee_id
    ),
    'current_year_summary', (
      SELECT jsonb_build_object(
        'year', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
        'total_earned', COALESCE(SUM(total_amount), 0),
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'months_worked', COUNT(*)
      )
      FROM employee_payroll 
      WHERE employee_id = p_employee_id 
      AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ),
    'attendance_summary', (
      SELECT jsonb_build_object(
        'this_month_days', COALESCE(COUNT(*), 0),
        'late_days_this_month', COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0)
      )
      FROM attendance
      WHERE employee_id = p_employee_id
      AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_performance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check authorization - allow server-side calls (auth.uid() is null)
    IF auth.uid() IS NULL THEN
        v_is_authorized := TRUE;
    ELSE
        v_is_authorized := EXISTS (
            SELECT 1 FROM employees 
            WHERE auth_user_id = auth.uid() 
            AND status = 'active'
            AND role IN ('admin', 'manager')
        );
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'employee_id', e.id,
            'employee_name', e.name,
            'role', e.role,
            'orders_handled', COALESCE(perf.orders_handled, 0),
            'total_sales', COALESCE(perf.total_sales, 0),
            'attendance_rate', COALESCE(att.attendance_rate, 0),
            'total_days', COALESCE(att.total_days, 0),
            'present_days', COALESCE(att.present_days, 0)
        )
        ORDER BY perf.orders_handled DESC NULLS LAST
    ) INTO result
    FROM employees e
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) as orders_handled,
            SUM(total) as total_sales
        FROM orders o
        WHERE o.assigned_to = e.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) perf ON true
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) as total_days,
            COUNT(*) FILTER (WHERE status IN ('present', 'late')) as present_days,
            ROUND(
                COUNT(*) FILTER (WHERE status IN ('present', 'late'))::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 1
            ) as attendance_rate
        FROM attendance a
        WHERE a.employee_id = e.id
        AND (p_start_date IS NULL OR a.date >= p_start_date)
        AND (p_end_date IS NULL OR a.date <= p_end_date)
    ) att ON true
    WHERE e.status = 'active';
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employee_profile_by_id(p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Fetch employee profile by ID
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', e.id,
      'auth_user_id', e.auth_user_id,
      'employee_id', e.employee_id,
      'name', e.name,
      'email', e.email,
      'phone', COALESCE(e.phone, ''),
      'address', COALESCE(e.address, ''),
      'emergency_contact', COALESCE(e.emergency_contact, ''),
      'avatar_url', COALESCE(e.avatar_url, ''),
      'role', e.role,
      'hired_date', e.hired_date,
      'is_2fa_enabled', COALESCE(e.is_2fa_enabled, false),
      'status', e.status,
      'portal_enabled', e.portal_enabled
    )
  ) INTO v_result
  FROM employees e
  WHERE e.id = p_employee_id;
  
  IF v_result IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employees_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object(
    'total', (SELECT COUNT(*) FROM employees),
    'active', (SELECT COUNT(*) FROM employees WHERE status = 'active'),
    'inactive', (SELECT COUNT(*) FROM employees WHERE status = 'inactive'),
    'pending', (SELECT COUNT(*) FROM employees WHERE status = 'pending'),
    'blocked', (SELECT COUNT(*) FROM employees WHERE status = 'blocked'),
    'portal_enabled', (SELECT COUNT(*) FROM employees WHERE portal_enabled = true),
    'by_role', (
      SELECT jsonb_object_agg(role::TEXT, cnt)
      FROM (
        SELECT role, COUNT(*) as cnt
        FROM employees
        GROUP BY role
      ) r
    ),
    'hired_this_month', (
      SELECT COUNT(*) FROM employees 
      WHERE DATE_TRUNC('month', hired_date) = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'present_today', (
      SELECT COUNT(DISTINCT employee_id) FROM attendance 
      WHERE date = CURRENT_DATE AND status = 'present'
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employees_paginated(p_page integer DEFAULT 1, p_limit integer DEFAULT 20, p_search text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS TABLE(employees jsonb, total_count integer, page integer, total_pages integer, has_next boolean, has_prev boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_employees JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Get total count first (for pagination)
  SELECT COUNT(*)::INTEGER INTO v_total
  FROM employees e
  WHERE 
    (p_search IS NULL OR p_search = '' OR 
      e.name ILIKE '%' || p_search || '%' OR
      e.email ILIKE '%' || p_search || '%' OR
      e.employee_id ILIKE '%' || p_search || '%' OR
      e.phone ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
    AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status);

  -- Get employees with all data in single query
  SELECT COALESCE(jsonb_agg(emp ORDER BY emp->>'created_at' DESC), '[]'::JSONB) INTO v_employees
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'employee_id', e.employee_id,
      'license_id', el.license_id,
      'name', e.name,
      'email', e.email,
      'phone', e.phone,
      'role', e.role::TEXT,
      'status', e.status::TEXT,
      'avatar_url', e.avatar_url,
      'portal_enabled', e.portal_enabled,
      'hired_date', e.hired_date,
      'salary', e.salary,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'last_login', e.last_login,
      'created_at', e.created_at,
      'attendance_this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.check_in) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'documents_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM employee_documents ed 
        WHERE ed.employee_id = e.id
      ), 0)
    ) as emp
    FROM employees e
    LEFT JOIN employee_licenses el ON el.employee_id = e.id
    WHERE 
      (p_search IS NULL OR p_search = '' OR 
        e.name ILIKE '%' || p_search || '%' OR
        e.email ILIKE '%' || p_search || '%' OR
        e.employee_id ILIKE '%' || p_search || '%' OR
        e.phone ILIKE '%' || p_search || '%')
      AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
      AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status)
    ORDER BY e.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) sub;

  RETURN QUERY SELECT 
    v_employees,
    v_total,
    p_page,
    CEIL(v_total::NUMERIC / p_limit)::INTEGER,
    (p_page * p_limit) < v_total,
    p_page > 1;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_employees_payroll_list()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(emp ORDER BY emp.name), '[]'::json) INTO result
    FROM (
        SELECT 
            e.id,
            e.name,
            e.email,
            e.phone,
            e.role,
            e.status,
            e.employee_id,
            e.salary,
            e.hired_date,
            e.avatar_url,
            e.bank_details,
            e.address,
            e.date_of_birth,
            e.blood_group,
            e.emergency_contact,
            e.emergency_contact_name,
            e.created_at,
            (SELECT json_build_object(
                'id', ep.id,
                'base_salary', ep.base_salary,
                'payment_frequency', ep.payment_frequency,
                'bank_details', ep.bank_details,
                'month', ep.month,
                'year', ep.year,
                'bonus', ep.bonus,
                'deductions', ep.deductions,
                'tips', ep.tips,
                'total_amount', ep.total_amount,
                'paid', ep.paid
            ) FROM employee_payroll ep 
            WHERE ep.employee_id = e.id 
            ORDER BY ep.year DESC, ep.month DESC LIMIT 1
            ) as latest_payroll,
            (SELECT COUNT(*) FROM payslips p WHERE p.employee_id = e.id) as total_payslips,
            (SELECT COUNT(*) FROM payslips p WHERE p.employee_id = e.id AND p.status = 'pending') as pending_payslips,
            (SELECT COALESCE(SUM(p.net_salary), 0) FROM payslips p WHERE p.employee_id = e.id AND p.status = 'paid') as total_paid_amount
        FROM employees e
        WHERE e.status = 'active'
    ) emp;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_expiring_items(p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'name', name,
            'sku', sku,
            'category', category,
            'current_stock', quantity,
            'unit', unit,
            'expiry_date', expiry_date,
            'days_until_expiry', expiry_date - CURRENT_DATE,
            'value_at_risk', quantity * cost_per_unit,
            'status', CASE 
                WHEN expiry_date < CURRENT_DATE THEN 'expired'
                WHEN expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
                ELSE 'warning'
            END
        )
        ORDER BY expiry_date ASC
    ) INTO result
    FROM inventory
    WHERE expiry_date IS NOT NULL
    AND expiry_date <= CURRENT_DATE + (p_days || ' days')::INTERVAL
    AND COALESCE(is_active, true) = true
    AND quantity > 0;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_hourly_sales_today()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN get_hourly_sales(CURRENT_DATE, CURRENT_DATE);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_inventory_movement_report(p_start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), p_end_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),
        'summary', json_build_object(
            'total_purchases', COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_usage', COALESCE(SUM(CASE WHEN transaction_type = 'usage' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_waste', COALESCE(SUM(CASE WHEN transaction_type = 'waste' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_adjustments', COALESCE(SUM(CASE WHEN transaction_type IN ('adjustment', 'count') THEN ABS(quantity_change) ELSE 0 END), 0),
            'purchase_value', COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN total_cost ELSE 0 END), 0),
            'usage_value', COALESCE(SUM(CASE WHEN transaction_type = 'usage' THEN total_cost ELSE 0 END), 0),
            'waste_value', COALESCE(SUM(CASE WHEN transaction_type = 'waste' THEN total_cost ELSE 0 END), 0)
        ),
        'by_category', (
            SELECT json_agg(json_build_object(
                'category', i.category,
                'purchases', COALESCE(SUM(CASE WHEN t.transaction_type = 'purchase' THEN ABS(t.quantity_change) ELSE 0 END), 0),
                'usage', COALESCE(SUM(CASE WHEN t.transaction_type = 'usage' THEN ABS(t.quantity_change) ELSE 0 END), 0),
                'waste', COALESCE(SUM(CASE WHEN t.transaction_type = 'waste' THEN ABS(t.quantity_change) ELSE 0 END), 0)
            ))
            FROM inventory_transactions t
            JOIN inventory i ON i.id = t.inventory_id
            WHERE DATE(t.created_at) BETWEEN p_start_date AND p_end_date
            GROUP BY i.category
        ),
        'daily_movement', (
            SELECT json_agg(json_build_object(
                'date', day,
                'purchases', COALESCE(purchases, 0),
                'usage', COALESCE(usage, 0),
                'waste', COALESCE(waste, 0)
            ) ORDER BY day)
            FROM (
                SELECT 
                    DATE(created_at) as day,
                    SUM(CASE WHEN transaction_type = 'purchase' THEN ABS(quantity_change) ELSE 0 END) as purchases,
                    SUM(CASE WHEN transaction_type = 'usage' THEN ABS(quantity_change) ELSE 0 END) as usage,
                    SUM(CASE WHEN transaction_type = 'waste' THEN ABS(quantity_change) ELSE 0 END) as waste
                FROM inventory_transactions
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                GROUP BY DATE(created_at)
            ) daily
        )
    ) INTO result
    FROM inventory_transactions
    WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_inventory_summary()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_items', COUNT(*),
        'total_value', COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)), 0),
        'low_stock_count', COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= COALESCE(min_quantity, 0)),
        'out_of_stock_count', COUNT(*) FILTER (WHERE quantity <= 0),
        'in_stock_count', COUNT(*) FILTER (WHERE quantity > COALESCE(min_quantity, 0)),
        'overstock_count', COUNT(*) FILTER (WHERE quantity > COALESCE(max_quantity, 100)),
        'categories', (
            SELECT json_agg(json_build_object(
                'category', category,
                'count', cnt,
                'value', val
            ))
            FROM (
                SELECT 
                    category, 
                    COUNT(*) as cnt,
                    COALESCE(SUM(quantity * cost_per_unit), 0) as val
                FROM inventory 
                WHERE COALESCE(is_active, true) = true
                GROUP BY category
            ) cats
        ),
        'expiring_soon', COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'),
        'expired', COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE)
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_inventory_value_by_category()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'category', category,
            'items_count', COUNT(*),
            'total_quantity', SUM(COALESCE(quantity, 0)),
            'total_value', SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)),
            'low_stock_items', COUNT(*) FILTER (WHERE quantity <= COALESCE(min_quantity, 0) AND quantity > 0),
            'out_of_stock_items', COUNT(*) FILTER (WHERE quantity <= 0)
        )
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true
    GROUP BY category
    ORDER BY SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)) DESC;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_kitchen_completed_orders(p_employee_id uuid DEFAULT NULL::uuid, p_filter_type text DEFAULT 'today'::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, order_number text, customer_name text, customer_phone text, order_type text, status text, items jsonb, total_items integer, subtotal numeric, total numeric, notes text, table_number integer, created_at timestamp with time zone, kitchen_started_at timestamp with time zone, kitchen_completed_at timestamp with time zone, prepared_by uuid, prepared_by_name text, prep_time_minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Calculate date range based on filter type
  CASE p_filter_type
    WHEN 'today' THEN
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
    WHEN 'week' THEN
      v_start_date := date_trunc('week', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'month' THEN
      v_start_date := date_trunc('month', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'year' THEN
      v_start_date := date_trunc('year', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'custom' THEN
      v_start_date := COALESCE(p_start_date, now() - interval '30 days');
      v_end_date := COALESCE(p_end_date, now());
    ELSE
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
  END CASE;

  RETURN QUERY
  SELECT 
    o.id,
    o.order_number::text,
    o.customer_name::text,
    o.customer_phone::text,
    o.order_type::text,
    o.status::text,
    o.items,
    COALESCE(jsonb_array_length(o.items), 0)::int as total_items,
    o.subtotal,
    o.total,
    o.notes,
    o.table_number,
    o.created_at,
    o.kitchen_started_at,
    o.kitchen_completed_at,
    o.prepared_by,
    e.name::text as prepared_by_name,
    CASE 
      WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at))::int / 60
      ELSE NULL
    END as prep_time_minutes
  FROM orders o
  LEFT JOIN employees e ON e.id = o.prepared_by
  WHERE 
    -- Filter by status (ready, delivered, or completed statuses)
    o.status IN ('ready', 'delivered', 'delivering')
    -- Filter by date range
    AND o.kitchen_completed_at >= v_start_date
    AND o.kitchen_completed_at < v_end_date
    -- Filter by employee if provided
    AND (p_employee_id IS NULL OR o.prepared_by = p_employee_id)
  ORDER BY o.kitchen_completed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_kitchen_completed_stats(p_employee_id uuid DEFAULT NULL::uuid, p_filter_type text DEFAULT 'today'::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_completed bigint, total_items_prepared bigint, avg_prep_time_minutes numeric, fastest_order_minutes integer, slowest_order_minutes integer, total_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Calculate date range based on filter type
  CASE p_filter_type
    WHEN 'today' THEN
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
    WHEN 'week' THEN
      v_start_date := date_trunc('week', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'month' THEN
      v_start_date := date_trunc('month', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'year' THEN
      v_start_date := date_trunc('year', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'custom' THEN
      v_start_date := COALESCE(p_start_date, now() - interval '30 days');
      v_end_date := COALESCE(p_end_date, now());
    ELSE
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
  END CASE;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_completed,
    COALESCE(SUM(jsonb_array_length(o.items)), 0)::bigint as total_items_prepared,
    ROUND(AVG(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60
        ELSE NULL
      END
    ), 1) as avg_prep_time_minutes,
    MIN(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN (EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60)::int
        ELSE NULL
      END
    ) as fastest_order_minutes,
    MAX(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN (EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60)::int
        ELSE NULL
      END
    ) as slowest_order_minutes,
    COALESCE(SUM(o.total), 0) as total_revenue
  FROM orders o
  WHERE 
    o.status IN ('ready', 'delivered', 'delivering')
    AND o.kitchen_completed_at >= v_start_date
    AND o.kitchen_completed_at < v_end_date
    AND (p_employee_id IS NULL OR o.prepared_by = p_employee_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_kitchen_orders()
 RETURNS SETOF json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'order_type', o.order_type,
    'items', o.items,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'notes', o.notes,
    'priority', CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 30 THEN 'urgent'
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 15 THEN 'high'
      ELSE 'normal'
    END
  )
  FROM orders o
  WHERE o.status IN ('confirmed', 'preparing', 'ready')
    AND DATE(o.created_at) = CURRENT_DATE
  ORDER BY 
    CASE o.status 
      WHEN 'confirmed' THEN 1 
      WHEN 'preparing' THEN 2 
      WHEN 'ready' THEN 3 
    END,
    o.created_at ASC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_kitchen_orders_v2()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(order_data ORDER BY priority, created_at) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'table_number', o.table_number,
                'items', o.items,
                'status', o.status,
                'notes', o.notes,
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'subtotal', o.subtotal,
                'total', o.total,
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'created_at', o.created_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                -- Waiter info
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', e.id, 'name', e.name)
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                -- Table details for dine-in orders
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'current_customers', rt.current_customers,
                        'assigned_waiter', CASE WHEN rt.assigned_waiter_id IS NOT NULL THEN (
                            SELECT json_build_object('id', ew.id, 'name', ew.name)
                            FROM employees ew WHERE ew.id = rt.assigned_waiter_id
                        ) ELSE NULL END
                    )
                    FROM restaurant_tables rt WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                -- Priority: confirmed > preparing > ready, older first
                'priority', CASE o.status 
                    WHEN 'confirmed' THEN 1
                    WHEN 'pending' THEN 2
                    WHEN 'preparing' THEN 3
                    ELSE 4
                END,
                -- Time calculations
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'prep_elapsed_seconds', CASE 
                    WHEN o.kitchen_started_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at))::INT 
                    ELSE NULL 
                END,
                -- Item count for quick view
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                )
            ) AS order_data,
            CASE o.status 
                WHEN 'confirmed' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'preparing' THEN 3
                ELSE 4
            END AS priority,
            o.created_at
        FROM orders o
        WHERE o.status IN ('confirmed', 'preparing', 'pending', 'ready')
            AND o.created_at >= CURRENT_DATE
            AND (o.status != 'ready' OR o.kitchen_completed_at >= NOW() - INTERVAL '30 minutes')
    ) sub;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_kitchen_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'pending_count', (SELECT COUNT(*) FROM orders WHERE status = 'pending' AND created_at >= CURRENT_DATE),
        'confirmed_count', (SELECT COUNT(*) FROM orders WHERE status = 'confirmed' AND created_at >= CURRENT_DATE),
        'preparing_count', (SELECT COUNT(*) FROM orders WHERE status = 'preparing' AND created_at >= CURRENT_DATE),
        'ready_count', (SELECT COUNT(*) FROM orders WHERE status = 'ready' AND kitchen_completed_at >= NOW() - INTERVAL '30 minutes'),
        'total_today', (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE),
        'completed_today', (SELECT COUNT(*) FROM orders WHERE status IN ('delivered', 'ready') AND created_at >= CURRENT_DATE),
        'avg_prep_time_mins', (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (kitchen_completed_at - kitchen_started_at)) / 60)::numeric, 1)
            FROM orders 
            WHERE kitchen_started_at IS NOT NULL 
                AND kitchen_completed_at IS NOT NULL 
                AND created_at >= CURRENT_DATE
        ),
        'orders_this_hour', (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '1 hour')
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_leave_balance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  balance_record RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
  
  IF balance_record IS NULL THEN
    -- Create default balance
    INSERT INTO leave_balances (employee_id) VALUES (emp_id)
    RETURNING * INTO balance_record;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'balance', json_build_object(
      'annual', json_build_object(
        'total', balance_record.annual_leave,
        'used', balance_record.annual_used,
        'available', balance_record.annual_leave - balance_record.annual_used
      ),
      'sick', json_build_object(
        'total', balance_record.sick_leave,
        'used', balance_record.sick_used,
        'available', balance_record.sick_leave - balance_record.sick_used
      ),
      'casual', json_build_object(
        'total', balance_record.casual_leave,
        'used', balance_record.casual_used,
        'available', balance_record.casual_leave - balance_record.casual_used
      ),
      'year', balance_record.year
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_leave_balance(p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  balance_record RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (emp_id) RETURNING * INTO balance_record;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used),
      'year', balance_record.year
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_low_stock_items()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'name', name,
            'sku', sku,
            'category', category,
            'current_stock', COALESCE(quantity, 0),
            'min_stock', COALESCE(min_quantity, 0),
            'reorder_point', COALESCE(reorder_point, min_quantity, 10),
            'unit', unit,
            'supplier', supplier,
            'cost_per_unit', cost_per_unit,
            'suggested_order_qty', COALESCE(max_quantity, 100) - COALESCE(quantity, 0),
            'estimated_cost', (COALESCE(max_quantity, 100) - COALESCE(quantity, 0)) * COALESCE(cost_per_unit, 0),
            'lead_time_days', COALESCE(lead_time_days, 7),
            'status', CASE 
                WHEN quantity <= 0 THEN 'out_of_stock'
                ELSE 'low_stock'
            END
        )
        ORDER BY 
            CASE WHEN quantity <= 0 THEN 0 ELSE 1 END,
            quantity ASC
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true
    AND (quantity <= 0 OR quantity <= COALESCE(min_quantity, 0));
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_customer_id uuid)
 RETURNS TABLE(total_points integer, redeemable_points integer, pending_points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'earned' THEN points ELSE -points END), 0)::INT as total,
        COALESCE(SUM(CASE WHEN type = 'earned' AND created_at < NOW() - INTERVAL '24 hours' THEN points 
                      WHEN type = 'redeemed' THEN -points ELSE 0 END), 0)::INT as redeemable,
        COALESCE(SUM(CASE WHEN type = 'earned' AND created_at >= NOW() - INTERVAL '24 hours' THEN points ELSE 0 END), 0)::INT as pending
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_maintenance_status()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    maint_record RECORD;
BEGIN
    -- Get the single maintenance mode row
    SELECT * INTO maint_record FROM maintenance_mode LIMIT 1;
    
    IF NOT FOUND THEN
        -- No record, return disabled
        RETURN json_build_object(
            'is_enabled', false,
            'reason_type', 'update',
            'custom_reason', null,
            'title', 'Maintenance Mode',
            'message', null,
            'estimated_restore_time', null,
            'show_timer', true,
            'show_progress', true
        );
    END IF;
    
    -- Build response
    SELECT json_build_object(
        'is_enabled', maint_record.is_enabled,
        'reason_type', maint_record.reason_type,
        'custom_reason', maint_record.custom_reason,
        'title', COALESCE(maint_record.title, 'We''ll Be Right Back'),
        'message', maint_record.message,
        'estimated_restore_time', maint_record.estimated_restore_time,
        'show_timer', COALESCE(maint_record.show_timer, true),
        'show_progress', COALESCE(maint_record.show_progress, true),
        'enabled_at', maint_record.enabled_at
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_menu_for_ordering()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.get_menu_management_data()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'items', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', mi.id,
                    'name', mi.name,
                    'description', mi.description,
                    'price', mi.price,
                    'category_id', mi.category_id,
                    'category', mc.name,
                    'images', mi.images,
                    'is_available', mi.is_available,
                    'is_featured', mi.is_featured,
                    'preparation_time', mi.preparation_time,
                    'tags', mi.tags,
                    'rating', mi.rating,
                    'total_reviews', mi.total_reviews,
                    'slug', mi.slug,
                    'created_at', mi.created_at,
                    'has_variants', COALESCE(mi.has_variants, false),
                    'size_variants', mi.size_variants
                )
                ORDER BY mi.created_at DESC
            )
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        ), '[]'::json),
        'categories', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'description', c.description,
                    'image_url', c.image_url,
                    'display_order', c.display_order,
                    'is_visible', c.is_visible,
                    'item_count', (SELECT COUNT(*) FROM menu_items WHERE category_id = c.id)
                )
                ORDER BY c.display_order
            )
            FROM menu_categories c
        ), '[]'::json),
        'stats', json_build_object(
            'total_items', (SELECT COUNT(*) FROM menu_items),
            'available_items', (SELECT COUNT(*) FROM menu_items WHERE is_available = true),
            'featured_items', (SELECT COUNT(*) FROM menu_items WHERE is_featured = true),
            'total_categories', (SELECT COUNT(*) FROM menu_categories),
            'visible_categories', (SELECT COUNT(*) FROM menu_categories WHERE is_visible = true),
            'items_with_variants', (SELECT COUNT(*) FROM menu_items WHERE has_variants = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


-- ==================== END BATCH H ====================


-- ==================== BATCH I: GET FUNCTIONS (PART 2) ====================

CREATE OR REPLACE FUNCTION public.get_my_leave_requests(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  result JSON;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', lr.id,
        'leave_type', lr.leave_type,
        'start_date', lr.start_date,
        'end_date', lr.end_date,
        'total_days', lr.total_days,
        'reason', lr.reason,
        'status', lr.status,
        'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at,
        'review_notes', lr.review_notes,
        'created_at', lr.created_at,
        'reviewer', CASE WHEN r.id IS NOT NULL THEN
          json_build_object('id', r.id, 'name', r.name, 'role', r.role)
        ELSE NULL END
      ) ORDER BY lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE lr.employee_id = emp_id
  AND EXTRACT(YEAR FROM lr.start_date) = p_year
  LIMIT p_limit;
  
  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_leave_requests(p_employee_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp_id UUID;
  result JSON;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object('id', lr.id, 'leave_type', lr.leave_type, 'start_date', lr.start_date, 'end_date', lr.end_date,
        'total_days', lr.total_days, 'reason', lr.reason, 'status', lr.status, 'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at, 'review_notes', lr.review_notes, 'created_at', lr.created_at,
        'reviewer', CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role) ELSE NULL END
      ) ORDER BY lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE lr.employee_id = emp_id AND EXTRACT(YEAR FROM lr.start_date) = p_year
  LIMIT p_limit;
  
  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_notifications(p_limit integer DEFAULT 50, p_unread_only boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    SELECT json_agg(
        json_build_object(
            'id', n.id,
            'title', n.title,
            'message', n.message,
            'type', n.type,
            'is_read', n.is_read,
            'data', n.data,
            'priority', n.priority,
            'created_at', n.created_at
        )
        ORDER BY n.created_at DESC
    ) INTO result
    FROM notifications n
    WHERE n.user_id = emp_id
    AND n.user_type = 'employee'
    AND (NOT p_unread_only OR n.is_read = false)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_today_attendance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'attendance', CASE WHEN a.id IS NOT NULL THEN
            json_build_object(
                'id', a.id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes
            )
        ELSE NULL END
    ) INTO result
    FROM (SELECT 1) dummy
    LEFT JOIN attendance a ON a.employee_id = emp_id AND a.date = CURRENT_DATE;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_order_creation_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_categories JSON;
    v_items JSON;
    v_tables JSON;
    v_deals JSON;
BEGIN
    -- Get active categories from menu_categories
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'description', c.description,
            'display_order', c.display_order,
            'is_visible', c.is_visible
        ) ORDER BY c.display_order, c.name
    ), '[]'::json)
    INTO v_categories
    FROM menu_categories c
    WHERE c.is_visible = true;

    -- Get available menu items with category info
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', m.id,
            'name', m.name,
            'slug', m.slug,
            'description', m.description,
            'price', m.price,
            'category_id', m.category_id,
            'category_name', c.name,
            'images', m.images,
            'is_available', m.is_available,
            'is_featured', m.is_featured,
            'preparation_time', m.preparation_time
        ) ORDER BY c.display_order, c.name, m.name
    ), '[]'::json)
    INTO v_items
    FROM menu_items m
    LEFT JOIN menu_categories c ON m.category_id = c.id
    WHERE m.is_available = true;

    -- Get tables with current status from restaurant_tables
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', t.id,
            'table_number', t.table_number,
            'capacity', t.capacity,
            'status', t.status,
            'current_order_id', t.current_order_id,
            'section', t.section
        ) ORDER BY t.table_number
    ), '[]'::json)
    INTO v_tables
    FROM restaurant_tables t
    WHERE t.status IN ('available', 'occupied', 'reserved');

    -- Get active deals
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', d.id,
            'name', d.name,
            'description', d.description,
            'discount_percentage', d.discount_percentage,
            'discount_amount', d.discount_amount,
            'minimum_order_amount', d.minimum_order_amount,
            'valid_from', d.valid_from,
            'valid_until', d.valid_until,
            'is_active', d.is_active,
            'discounted_price', d.discounted_price,
            'original_price', d.original_price
        )
    ), '[]'::json)
    INTO v_deals
    FROM deals d
    WHERE d.is_active = true 
    AND (d.valid_from IS NULL OR d.valid_from <= NOW())
    AND (d.valid_until IS NULL OR d.valid_until >= NOW());

    RETURN json_build_object(
        'success', true,
        'categories', v_categories,
        'items', v_items,
        'tables', v_tables,
        'deals', v_deals,
        'fetched_at', NOW()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_order_for_billing(p_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.get_orders_advanced(p_status text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    total_count INT;
BEGIN
    -- Get total count first (for pagination)
    SELECT COUNT(*) INTO total_count
    FROM orders o
    WHERE (p_status IS NULL OR o.status::TEXT = p_status)
      AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
      AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date);

    -- Get orders with full details
    SELECT json_build_object(
        'orders', COALESCE(json_agg(order_data ORDER BY created_at DESC), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count
    ) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                
                -- Customer info (direct fields)
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'customer_email', o.customer_email,
                'customer_address', o.customer_address,
                
                -- Registered customer details (if customer_id exists)
                'customer', CASE WHEN o.customer_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', c.id,
                        'name', c.name,
                        'phone', c.phone,
                        'email', c.email,
                        'address', c.address
                    )
                    FROM customers c WHERE c.id = o.customer_id
                ) ELSE NULL END,
                
                -- Items
                'items', o.items,
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                ),
                
                -- Pricing
                'subtotal', o.subtotal,
                'discount', o.discount,
                'tax', o.tax,
                'delivery_fee', o.delivery_fee,
                'total', o.total,
                
                -- Payment
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'payment_proof_url', o.payment_proof_url,
                'transaction_id', o.transaction_id,
                'online_payment_method_id', o.online_payment_method_id,
                'online_payment_details', o.online_payment_details,
                
                -- Notes
                'notes', o.notes,
                'cancellation_reason', o.cancellation_reason,
                
                -- Table details (for dine-in)
                'table_number', o.table_number,
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'status', rt.status,
                        'current_customers', rt.current_customers
                    )
                    FROM restaurant_tables rt 
                    WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                
                -- Waiter info
                'waiter_id', o.waiter_id,
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                
                -- Kitchen staff
                'prepared_by', CASE WHEN o.prepared_by IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name
                    )
                    FROM employees e WHERE e.id = o.prepared_by
                ) ELSE NULL END,
                
                -- Delivery rider (for delivery orders)
                'delivery_rider_id', o.delivery_rider_id,
                'delivery_rider', CASE WHEN o.delivery_rider_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.delivery_rider_id
                ) ELSE NULL END,
                
                -- Timestamps
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                'delivery_started_at', o.delivery_started_at,
                'estimated_delivery_time', o.estimated_delivery_time,
                'delivered_at', o.delivered_at,
                'can_cancel_until', o.can_cancel_until,
                'customer_notified', o.customer_notified,
                
                -- Calculated fields
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'is_delayed', CASE 
                    WHEN o.status IN ('pending', 'confirmed') 
                        AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) > 300 -- 5 minutes
                    THEN true
                    WHEN o.status = 'preparing' 
                        AND o.kitchen_started_at IS NOT NULL
                        AND EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at)) > 900 -- 15 minutes
                    THEN true
                    ELSE false
                END,
                'can_cancel', o.status IN ('pending', 'confirmed') 
                    AND (o.can_cancel_until IS NULL OR o.can_cancel_until > NOW())
            ) AS order_data,
            o.created_at
        FROM orders o
        WHERE (p_status IS NULL OR o.status::TEXT = p_status)
          AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
          AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) sub;

    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_orders_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_today', (
            SELECT COUNT(*) FROM orders WHERE created_at::DATE = CURRENT_DATE
        ),
        'pending_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'pending'
        ),
        'confirmed_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'confirmed'
        ),
        'preparing_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'preparing'
        ),
        'ready_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'ready'
        ),
        'delivering_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'delivering'
        ),
        'completed_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('delivered', 'ready') 
            AND created_at::DATE = CURRENT_DATE
        ),
        'cancelled_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'cancelled' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'revenue_today', (
            SELECT COALESCE(SUM(total), 0) FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'avg_order_value', (
            SELECT COALESCE(AVG(total), 0)::INT FROM orders 
            WHERE created_at::DATE = CURRENT_DATE
        ),
        'dine_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'dine-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'online_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'online' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'walk_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'walk-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'delayed_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('pending', 'confirmed') 
            AND EXTRACT(EPOCH FROM (NOW() - created_at)) > 300
        ),
        'long_prep_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'preparing' 
            AND kitchen_started_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - kitchen_started_at)) > 900
        )
    ) INTO result;

    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_payroll_dashboard()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_payroll', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
        ),
        'total_paid', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips WHERE status = 'paid'
        ),
        'pending_count', (
            SELECT COUNT(*) FROM payslips WHERE status = 'pending'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips WHERE status = 'pending'
        ),
        'paid_this_month', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
            WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)
        ),
        'paid_last_month', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
            WHERE status = 'paid'
            AND paid_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
            AND paid_at < date_trunc('month', CURRENT_DATE)
        ),
        'total_employees', (
            SELECT COUNT(*) FROM employees WHERE status = 'active'
        ),
        'total_salary_budget', (
            SELECT COALESCE(SUM(salary), 0) FROM employees WHERE status = 'active' AND salary IS NOT NULL
        ),
        'payslips_this_month', (
            SELECT COUNT(*) FROM payslips
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'avg_salary', (
            SELECT COALESCE(ROUND(AVG(salary), 2), 0) FROM employees WHERE status = 'active' AND salary IS NOT NULL
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_payslip_detail(p_payslip_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'payslip', (
            SELECT json_build_object(
                'id', p.id,
                'period_start', p.period_start,
                'period_end', p.period_end,
                'base_salary', p.base_salary,
                'overtime_hours', p.overtime_hours,
                'overtime_rate', p.overtime_rate,
                'bonuses', p.bonuses,
                'deductions', p.deductions,
                'tax_amount', p.tax_amount,
                'net_salary', p.net_salary,
                'status', p.status,
                'payment_method', p.payment_method,
                'paid_at', p.paid_at,
                'notes', p.notes,
                'created_at', p.created_at,
                'created_by_name', (SELECT cb.name FROM employees cb WHERE cb.id = p.created_by)
            ) FROM payslips p WHERE p.id = p_payslip_id
        ),
        'employee', (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'email', e.email,
                'phone', e.phone,
                'role', e.role,
                'employee_id', e.employee_id,
                'hired_date', e.hired_date,
                'salary', e.salary,
                'bank_details', e.bank_details,
                'avatar_url', e.avatar_url,
                'address', e.address,
                'date_of_birth', e.date_of_birth,
                'blood_group', e.blood_group
            ) FROM employees e 
            JOIN payslips p ON p.employee_id = e.id 
            WHERE p.id = p_payslip_id
        ),
        'company', json_build_object(
            'name', 'ZOIRO Broast',
            'tagline', 'Injected Broast - Saucy. Juicy. Crispy.',
            'email', 'info@zoiro.com',
            'phone', '+92 XXX XXXXXXX',
            'address', 'Main Branch, City',
            'ntn', 'XXXXXXX',
            'logo_url', '/assets/logo.png'
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_payslips_advanced(p_employee_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
    total_count INTEGER;
    v_offset INTEGER;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    
    -- Get total count
    SELECT COUNT(*) INTO total_count
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_start_date IS NULL OR p.period_start >= p_start_date)
    AND (p_end_date IS NULL OR p.period_end <= p_end_date)
    AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%' OR e.employee_id ILIKE '%' || p_search || '%');
    
    -- Get paginated data
    SELECT json_build_object(
        'payslips', COALESCE((
            SELECT json_agg(sub ORDER BY sub.period_end DESC)
            FROM (
                SELECT 
                    p.id,
                    p.employee_id,
                    json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'role', e.role,
                        'employee_id', e.employee_id,
                        'avatar_url', e.avatar_url,
                        'email', e.email,
                        'phone', e.phone
                    ) as employee,
                    p.period_start,
                    p.period_end,
                    p.base_salary,
                    p.overtime_hours,
                    p.overtime_rate,
                    p.bonuses,
                    p.deductions,
                    p.tax_amount,
                    p.net_salary,
                    p.status,
                    p.payment_method,
                    p.paid_at,
                    p.notes,
                    p.created_by,
                    (SELECT cb.name FROM employees cb WHERE cb.id = p.created_by) as created_by_name,
                    p.created_at,
                    p.updated_at
                FROM payslips p
                JOIN employees e ON e.id = p.employee_id
                WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
                AND (p_status IS NULL OR p.status = p_status)
                AND (p_start_date IS NULL OR p.period_start >= p_start_date)
                AND (p_end_date IS NULL OR p.period_end <= p_end_date)
                AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%' OR e.employee_id ILIKE '%' || p_search || '%')
                ORDER BY p.period_end DESC
                LIMIT p_limit OFFSET v_offset
            ) sub
        ), '[]'::json),
        'total_count', total_count,
        'page', p_page,
        'total_pages', CEIL(total_count::float / p_limit)
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_pending_leave_count()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'pending_count', (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending')
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_pending_leave_count(p_caller_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  RETURN json_build_object('success', true, 'pending_count', (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'));
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_public_reviews(p_review_type text DEFAULT NULL::text, p_item_id uuid DEFAULT NULL::uuid, p_meal_id uuid DEFAULT NULL::uuid, p_min_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_sort text DEFAULT 'recent'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reviews', COALESCE((
            SELECT json_agg(review_data ORDER BY 
                CASE WHEN p_sort = 'recent' THEN r.created_at END DESC,
                CASE WHEN p_sort = 'rating_high' THEN r.rating END DESC,
                CASE WHEN p_sort = 'rating_low' THEN r.rating END ASC,
                CASE WHEN p_sort = 'helpful' THEN r.helpful_count END DESC
            )
            FROM (
                SELECT 
                    json_build_object(
                        'id', r.id,
                        'customer', json_build_object(
                            'name', COALESCE(c.name, 'Anonymous'),
                            'initial', UPPER(LEFT(COALESCE(c.name, 'A'), 1))
                        ),
                        'rating', r.rating,
                        'comment', r.comment,
                        'review_type', r.review_type,
                        'images', COALESCE(r.images, '[]'::jsonb),
                        'is_verified', r.is_verified,
                        'helpful_count', COALESCE(r.helpful_count, 0),
                        'item', CASE 
                            WHEN r.item_id IS NOT NULL THEN (
                                SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images->0)
                                FROM menu_items mi WHERE mi.id = r.item_id
                            )
                            ELSE NULL
                        END,
                        'meal', CASE 
                            WHEN r.meal_id IS NOT NULL THEN (
                                SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images->0)
                                FROM meals m WHERE m.id = r.meal_id
                            )
                            ELSE NULL
                        END,
                        'admin_reply', r.admin_reply,
                        'replied_at', r.replied_at,
                        'created_at', r.created_at
                    ) AS review_data,
                    r.created_at,
                    r.rating,
                    r.helpful_count
                FROM reviews r
                LEFT JOIN customers c ON c.id = r.customer_id
                WHERE r.is_visible = true
                AND (p_review_type IS NULL OR r.review_type = p_review_type)
                AND (p_item_id IS NULL OR r.item_id = p_item_id)
                AND (p_meal_id IS NULL OR r.meal_id = p_meal_id)
                AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
                LIMIT p_limit OFFSET p_offset
            ) r
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total_reviews', COUNT(*),
                'average_rating', ROUND(COALESCE(AVG(rating), 0)::numeric, 1),
                'five_star', COUNT(*) FILTER (WHERE rating = 5),
                'four_star', COUNT(*) FILTER (WHERE rating = 4),
                'three_star', COUNT(*) FILTER (WHERE rating = 3),
                'two_star', COUNT(*) FILTER (WHERE rating = 2),
                'one_star', COUNT(*) FILTER (WHERE rating = 1)
            )
            FROM reviews
            WHERE is_visible = true
            AND (p_review_type IS NULL OR review_type = p_review_type)
            AND (p_item_id IS NULL OR item_id = p_item_id)
            AND (p_meal_id IS NULL OR meal_id = p_meal_id)
        ),
        'has_more', (
            SELECT COUNT(*) > (p_offset + p_limit)
            FROM reviews
            WHERE is_visible = true
            AND (p_review_type IS NULL OR review_type = p_review_type)
            AND (p_item_id IS NULL OR item_id = p_item_id)
            AND (p_meal_id IS NULL OR meal_id = p_meal_id)
            AND (p_min_rating IS NULL OR rating >= p_min_rating)
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_recent_invoices(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payment_method text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.get_review_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_reviews', (SELECT COUNT(*) FROM reviews),
        'average_rating', (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews),
        'five_star', (SELECT COUNT(*) FROM reviews WHERE rating = 5),
        'four_star', (SELECT COUNT(*) FROM reviews WHERE rating = 4),
        'three_star', (SELECT COUNT(*) FROM reviews WHERE rating = 3),
        'two_star', (SELECT COUNT(*) FROM reviews WHERE rating = 2),
        'one_star', (SELECT COUNT(*) FROM reviews WHERE rating = 1),
        'pending_replies', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NULL),
        'this_week', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days')
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_rider_dashboard_stats(p_rider_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'total_deliveries_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'pending_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND status IN ('assigned', 'picked_up')
    ), 0),
    'completed', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'completed_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'delivered'
    ), 0),
    'total_tips', COALESCE((
      SELECT SUM(tip_amount)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'avg_delivery_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - picked_up_at))/60)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND delivered_at IS NOT NULL
        AND picked_up_at IS NOT NULL
    ), 25),
    'total_earnings', COALESCE((
      SELECT SUM(delivery_fee + COALESCE(tip_amount, 0))
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'pending_orders', (
      SELECT json_agg(json_build_object(
        'id', dh.id,
        'order_id', dh.order_id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_address', o.customer_address,
        'total', o.total,
        'status', dh.status,
        'created_at', dh.created_at
      ))
      FROM delivery_history dh
      JOIN orders o ON o.id = dh.order_id
      WHERE dh.rider_id = p_rider_id
        AND dh.status IN ('assigned', 'picked_up')
      ORDER BY dh.created_at ASC
    ),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_rider_delivery_history(p_rider_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_rider_id UUID;
    v_is_valid_rider BOOLEAN;
    result JSON;
    total_count INT;
BEGIN
    -- Determine rider ID: use explicit parameter or fall back to auth
    IF p_rider_id IS NOT NULL THEN
        -- Verify the provided rider_id exists and is a delivery rider
        SELECT EXISTS(
            SELECT 1 FROM employees 
            WHERE id = p_rider_id 
            AND role = 'delivery_rider' 
            AND status = 'active'
        ) INTO v_is_valid_rider;
        
        IF NOT v_is_valid_rider THEN
            RETURN json_build_object('success', false, 'error', 'Invalid rider ID');
        END IF;
        
        v_rider_id := p_rider_id;
    ELSE
        -- Fall back to getting rider from auth context
        v_rider_id := get_employee_id();
    END IF;
    
    -- Final check
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated - no rider ID provided');
    END IF;
    
    -- Count total matching records
    SELECT COUNT(*) INTO total_count
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date);
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'rider_id', v_rider_id,  -- Return the rider_id for debugging
        'history', COALESCE(json_agg(
            json_build_object(
                'id', dh.id,
                'order_id', dh.order_id,
                'order_number', dh.order_number,
                'customer_name', dh.customer_name,
                'customer_phone', dh.customer_phone,
                'customer_address', dh.customer_address,
                'items', dh.items,
                'total_items', dh.total_items,
                'total', dh.total,
                'payment_method', dh.payment_method,
                'delivery_status', dh.delivery_status,
                'accepted_at', dh.accepted_at,
                'started_at', dh.started_at,
                'delivered_at', dh.delivered_at,
                'actual_delivery_minutes', dh.actual_delivery_minutes,
                'customer_rating', dh.customer_rating
            ) ORDER BY dh.accepted_at DESC
        ), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count,
        -- Quick stats for this rider
        'stats', (
            SELECT json_build_object(
                'total_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
                'total_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                'total_this_week', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
                'total_this_month', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
                'avg_delivery_minutes', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL)),
                'avg_rating', ROUND(AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL), 1),
                'total_earnings', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0),
                'cancelled_count', COUNT(*) FILTER (WHERE delivery_status = 'cancelled'),
                'active_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivering')
            )
            FROM delivery_history WHERE rider_id = v_rider_id
        )
    ) INTO result
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date)
    LIMIT p_limit
    OFFSET p_offset;
    
    -- Handle empty result (when no records found)
    IF result IS NULL THEN
        result := json_build_object(
            'success', true,
            'rider_id', v_rider_id,
            'history', '[]'::json,
            'total_count', 0,
            'has_more', false,
            'stats', json_build_object(
                'total_deliveries', 0,
                'total_today', 0,
                'total_this_week', 0,
                'total_this_month', 0,
                'avg_delivery_minutes', NULL,
                'avg_rating', NULL,
                'total_earnings', 0,
                'cancelled_count', 0,
                'active_deliveries', 0
            )
        );
    END IF;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_sales_analytics(p_start_date date, p_end_date date, p_group_by text DEFAULT 'day'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF p_group_by = 'day' THEN
        SELECT json_agg(
            json_build_object(
                'date', date,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY date
        ) INTO result
        FROM (
            SELECT 
                DATE(created_at) as date,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY DATE(created_at)
        ) stats;
    ELSIF p_group_by = 'week' THEN
        SELECT json_agg(
            json_build_object(
                'week_start', week_start,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY week_start
        ) INTO result
        FROM (
            SELECT 
                date_trunc('week', created_at)::DATE as week_start,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY date_trunc('week', created_at)
        ) stats;
    ELSE
        SELECT json_agg(
            json_build_object(
                'month', month,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY month
        ) INTO result
        FROM (
            SELECT 
                date_trunc('month', created_at)::DATE as month,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY date_trunc('month', created_at)
        ) stats;
    END IF;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_sales_by_date_range(p_start_date date, p_end_date date)
 RETURNS TABLE(date date, order_count bigint, total_revenue numeric, avg_order_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.created_at::DATE as date,
        COUNT(*)::BIGINT as order_count,
        COALESCE(SUM(o.total), 0) as total_revenue,
        COALESCE(AVG(o.total), 0) as avg_order_value
    FROM orders o
    WHERE o.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY o.created_at::DATE
    ORDER BY date DESC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_tables_for_waiter()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.get_tables_status()
 RETURNS SETOF json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', t.id,
        'table_number', t.table_number,
        'capacity', t.capacity,
        'status', t.status,
        'current_order_id', t.current_order_id,
        'assigned_waiter_id', t.assigned_waiter_id,
        'assigned_waiter_name', e.name,
        'section', t.section
    )
    FROM restaurant_tables t
    LEFT JOIN employees e ON t.assigned_waiter_id = e.id
    ORDER BY t.table_number;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_today_attendance()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'attendance', COALESCE(json_agg(
            json_build_object(
                'id', a.id,
                'employee_id', a.employee_id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes,
                'employee', json_build_object(
                    'id', e.id,
                    'employee_id', e.employee_id,
                    'name', e.name,
                    'email', e.email,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'role', e.role,
                    'status', e.status,
                    'hired_date', e.hired_date
                )
            ) ORDER BY a.check_in DESC
        ), '[]'::json)
    ) INTO result
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date = CURRENT_DATE;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_type text DEFAULT 'employee'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    count_val INTEGER;
BEGIN
    emp_id := get_employee_id();
    
    SELECT COUNT(*) INTO count_val
    FROM notifications
    WHERE user_id = emp_id
    AND user_type = p_user_type
    AND is_read = false;
    
    RETURN json_build_object('count', count_val);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email text)
 RETURNS TABLE(id uuid, email text, name text, phone text, user_type text, role text, permissions jsonb, employee_id text, status text, is_2fa_enabled boolean, portal_enabled boolean, block_reason text, is_banned boolean, auth_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Check employees first (includes admin)
    IF EXISTS (SELECT 1 FROM employees e WHERE LOWER(e.email) = LOWER(p_email)) THEN
        RETURN QUERY
        SELECT 
            e.id,
            e.email::TEXT,
            e.name::TEXT,
            e.phone::TEXT,
            CASE WHEN e.role = 'admin' THEN 'admin'::TEXT ELSE 'employee'::TEXT END AS user_type,
            e.role::TEXT,
            e.permissions,
            e.employee_id::TEXT,
            e.status::TEXT,
            e.is_2fa_enabled,
            COALESCE(e.portal_enabled, true) AS portal_enabled,
            e.block_reason::TEXT,
            (e.status = 'blocked')::boolean AS is_banned,
            e.auth_user_id
        FROM employees e
        WHERE LOWER(e.email) = LOWER(p_email);
        RETURN;
    END IF;

    -- Check customers
    RETURN QUERY
    SELECT 
        c.id,
        c.email::TEXT,
        c.name::TEXT,
        c.phone::TEXT,
        'customer'::TEXT AS user_type,
        NULL::TEXT AS role,
        NULL::JSONB AS permissions,
        NULL::TEXT AS employee_id,
        CASE WHEN c.is_verified THEN 'active'::TEXT ELSE 'pending'::TEXT END AS status,
        c.is_2fa_enabled,
        true AS portal_enabled,
        c.ban_reason::TEXT AS block_reason,
        COALESCE(c.is_banned, false) AS is_banned,
        c.auth_user_id
    FROM customers c
    WHERE LOWER(c.email) = LOWER(p_email);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_waiter_dashboard()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    SELECT json_build_object(
        'today_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE waiter_id = emp_id
            AND DATE(created_at) = CURRENT_DATE
        ),
        'today_tips', (
            SELECT COALESCE(SUM(tip_amount), 0)
            FROM waiter_tips
            WHERE waiter_id = emp_id
            AND date = CURRENT_DATE
        ),
        'assigned_tables', (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'table_number', t.table_number,
                    'status', t.status,
                    'current_customers', t.current_customers,
                    'current_order_id', t.current_order_id
                )
            )
            FROM restaurant_tables t
            WHERE t.assigned_waiter_id = emp_id
        ),
        'pending_orders', (
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'table_number', o.table_number,
                    'status', o.status,
                    'items', o.items,
                    'total', o.total,
                    'can_cancel', o.can_cancel_until > NOW(),
                    'created_at', o.created_at
                )
                ORDER BY o.created_at DESC
            )
            FROM orders o
            WHERE o.waiter_id = emp_id
            AND o.status NOT IN ('delivered', 'cancelled')
        ),
        'employee', (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'hired_date', e.hired_date,
                'total_tips', e.total_tips,
                'total_orders_taken', e.total_orders_taken
            )
            FROM employees e
            WHERE e.id = emp_id
        )
    ) INTO result;
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_waiter_dashboard_stats(p_employee_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'orders_count', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'orders_today', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'tips_total', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND tip_amount IS NOT NULL
    ), 0),
    'tips_today', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
        AND tip_amount IS NOT NULL
    ), 0),
    'active_tables', COALESCE((
      SELECT COUNT(*)
      FROM restaurant_tables
      WHERE assigned_waiter_id = p_employee_id
        AND status = 'occupied'
    ), 0),
    'total_sales', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'avg_order_value', COALESCE((
      SELECT AVG(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_waiter_order_history(p_date date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ==================== END BATCH I ====================


-- ==================== BATCH J: ACTION/TOGGLE FUNCTIONS ====================

CREATE OR REPLACE FUNCTION public.link_google_auth_to_employee(p_employee_id uuid, p_auth_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_status text;
  v_portal_enabled boolean;
BEGIN
  -- Check employee status and portal access
  SELECT status, COALESCE(portal_enabled, true)
  INTO v_employee_status, v_portal_enabled
  FROM employees
  WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;
  
  -- Don't allow linking for inactive employees
  IF v_employee_status != 'active' THEN
    RAISE EXCEPTION 'Employee account is not active. Please activate your account first.';
  END IF;
  
  -- Don't allow linking for blocked employees
  IF v_portal_enabled = false THEN
    RAISE EXCEPTION 'Your portal access has been disabled. Please contact administrator.';
  END IF;
  
  -- Update employee with auth_user_id if not already linked to different auth
  UPDATE employees
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_employee_id
    AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
  
  RETURN FOUND;
END;
$function$;


CREATE OR REPLACE FUNCTION public.log_password_reset_completion(p_email text, p_ip_address text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Mark all OTPs for this email as used/expired
  UPDATE public.password_reset_otps
  SET is_verified = false
  WHERE email = p_email;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Password reset completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to log password reset completion'
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.lookup_customer(p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_name text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.manage_menu_category(p_action text, p_category_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_slug text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_display_order integer DEFAULT NULL::integer, p_is_visible boolean DEFAULT NULL::boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSON;
    v_category RECORD;
    v_slug TEXT;
    v_order INT;
    v_item_count INT;
BEGIN
    -- Validate action
    IF p_action NOT IN ('create', 'update', 'delete', 'toggle') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid action. Use: create, update, delete, or toggle'
        );
    END IF;
    
    -- CREATE ACTION
    IF p_action = 'create' THEN
        -- Validate required fields
        IF p_name IS NULL OR trim(p_name) = '' THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category name is required'
            );
        END IF;
        
        -- Check for duplicate name
        IF EXISTS (SELECT 1 FROM menu_categories WHERE lower(name) = lower(trim(p_name))) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'A category with this name already exists'
            );
        END IF;
        
        -- Generate slug if not provided
        v_slug := COALESCE(p_slug, lower(regexp_replace(trim(p_name), '\s+', '-', 'g')));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        
        -- Ensure unique slug
        IF EXISTS (SELECT 1 FROM menu_categories WHERE slug = v_slug) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
        
        -- Get next display order
        SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_order FROM menu_categories;
        
        -- Insert category
        INSERT INTO menu_categories (name, slug, description, image_url, display_order, is_visible)
        VALUES (
            trim(p_name), 
            v_slug, 
            p_description, 
            p_image_url, 
            COALESCE(p_display_order, v_order),
            COALESCE(p_is_visible, true)
        )
        RETURNING * INTO v_category;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Category created successfully',
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'slug', v_category.slug,
                'description', v_category.description,
                'image_url', v_category.image_url,
                'display_order', v_category.display_order,
                'is_visible', v_category.is_visible,
                'created_at', v_category.created_at
            )
        );
    END IF;
    
    -- UPDATE ACTION
    IF p_action = 'update' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for update'
            );
        END IF;
        
        -- Check category exists
        IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE id = p_category_id) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        -- Check for duplicate name (excluding current category)
        IF p_name IS NOT NULL AND EXISTS (
            SELECT 1 FROM menu_categories 
            WHERE lower(name) = lower(trim(p_name)) 
            AND id != p_category_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Another category with this name already exists'
            );
        END IF;
        
        -- Generate new slug if name changed
        IF p_name IS NOT NULL THEN
            v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
            v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
            IF EXISTS (SELECT 1 FROM menu_categories WHERE slug = v_slug AND id != p_category_id) THEN
                v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
            END IF;
        END IF;
        
        -- Update category
        UPDATE menu_categories
        SET 
            name = COALESCE(trim(p_name), name),
            slug = COALESCE(v_slug, slug),
            description = COALESCE(p_description, description),
            image_url = COALESCE(p_image_url, image_url),
            display_order = COALESCE(p_display_order, display_order),
            is_visible = COALESCE(p_is_visible, is_visible),
            updated_at = NOW()
        WHERE id = p_category_id
        RETURNING * INTO v_category;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Category updated successfully',
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'slug', v_category.slug,
                'description', v_category.description,
                'image_url', v_category.image_url,
                'display_order', v_category.display_order,
                'is_visible', v_category.is_visible,
                'updated_at', v_category.updated_at
            )
        );
    END IF;
    
    -- TOGGLE ACTION
    IF p_action = 'toggle' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for toggle'
            );
        END IF;
        
        UPDATE menu_categories
        SET 
            is_visible = NOT is_visible,
            updated_at = NOW()
        WHERE id = p_category_id
        RETURNING * INTO v_category;
        
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        RETURN json_build_object(
            'success', true,
            'message', CASE WHEN v_category.is_visible THEN 'Category visible' ELSE 'Category hidden' END,
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'is_visible', v_category.is_visible
            )
        );
    END IF;
    
    -- DELETE ACTION
    IF p_action = 'delete' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for delete'
            );
        END IF;
        
        -- Check for items in this category
        SELECT COUNT(*) INTO v_item_count FROM menu_items WHERE category_id = p_category_id;
        
        IF v_item_count > 0 THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Cannot delete category with %s items. Move or delete items first.', v_item_count),
                'item_count', v_item_count
            );
        END IF;
        
        -- Get category info before deletion
        SELECT * INTO v_category FROM menu_categories WHERE id = p_category_id;
        
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        -- Delete category
        DELETE FROM menu_categories WHERE id = p_category_id;
        
        -- Reorder remaining categories
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 as new_order
            FROM menu_categories
        )
        UPDATE menu_categories mc
        SET display_order = ordered.new_order
        FROM ordered
        WHERE mc.id = ordered.id;
        
        RETURN json_build_object(
            'success', true,
            'message', format('Category "%s" deleted successfully', v_category.name),
            'deleted_category', json_build_object(
                'id', v_category.id,
                'name', v_category.name
            )
        );
    END IF;
    
    RETURN json_build_object('success', false, 'error', 'Unknown error');
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_type text DEFAULT 'employee'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE notifications
    SET is_read = true
    WHERE user_id = emp_id
    AND user_type = p_user_type
    AND is_read = false;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_inventory_alert_read(p_alert_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE inventory_alerts SET is_read = true WHERE id = p_alert_id;
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_invoice_printed(p_invoice_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = p_notification_id;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_review_helpful(p_review_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_ip_address character varying DEFAULT NULL::character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    vote_exists BOOLEAN;
BEGIN
    -- Check if already voted
    SELECT EXISTS (
        SELECT 1 FROM review_helpful_votes
        WHERE review_id = p_review_id
        AND (
            (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
            OR (p_customer_id IS NULL AND ip_address = p_ip_address)
        )
    ) INTO vote_exists;
    
    IF vote_exists THEN
        RETURN json_build_object('success', false, 'error', 'Already marked as helpful');
    END IF;
    
    -- Insert vote
    INSERT INTO review_helpful_votes (review_id, customer_id, ip_address)
    VALUES (p_review_id, p_customer_id, p_ip_address);
    
    -- Update helpful count
    UPDATE reviews 
    SET helpful_count = COALESCE(helpful_count, 0) + 1
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true, 'message', 'Marked as helpful');
END;
$function$;


CREATE OR REPLACE FUNCTION public.record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.remove_employee_document(p_employee_id uuid, p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_file_url TEXT;
BEGIN
  -- Get document file URL for cleanup
  SELECT file_url INTO v_file_url
  FROM employee_documents
  WHERE id = p_document_id AND employee_id = p_employee_id;

  IF v_file_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  DELETE FROM employee_documents WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'file_url', v_file_url,  -- Return URL so frontend can delete from storage
    'message', 'Document removed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION public.reply_to_review_advanced(p_review_id uuid, p_reply text, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_reply IS NULL OR TRIM(p_reply) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Reply cannot be empty');
    END IF;
    
    UPDATE reviews
    SET 
        admin_reply = TRIM(p_reply),
        replied_at = NOW(),
        replied_by = p_employee_id,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reply saved successfully',
        'replied_at', NOW()
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.request_table_exchange(p_table_id uuid, p_to_waiter_id uuid, p_exchange_type text, p_swap_table_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    INSERT INTO table_exchange_requests (
        from_waiter_id, to_waiter_id, table_id,
        exchange_type, swap_table_id, reason
    ) VALUES (
        emp_id, p_to_waiter_id, p_table_id,
        p_exchange_type, p_swap_table_id, p_reason
    );
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.resolve_inventory_alert(p_alert_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE inventory_alerts 
    SET is_resolved = true, resolved_by = emp_id, resolved_at = NOW()
    WHERE id = p_alert_id;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.respond_table_exchange(p_request_id uuid, p_accept boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    request_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    SELECT * INTO request_record
    FROM table_exchange_requests
    WHERE id = p_request_id;
    
    IF request_record.to_waiter_id != emp_id THEN
        RETURN json_build_object('success', false, 'error', 'Not your request');
    END IF;
    
    -- Update request
    UPDATE table_exchange_requests
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
        responded_at = NOW()
    WHERE id = p_request_id;
    
    -- If accepted, do the exchange
    IF p_accept THEN
        IF request_record.exchange_type = 'one_way' THEN
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.to_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.table_id;
        ELSE
            -- Swap tables
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.to_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.table_id;
            
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.from_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.swap_table_id;
        END IF;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.revoke_attendance_code()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Check authorization
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Delete all codes for today (active and inactive)
    DELETE FROM attendance_codes
    WHERE valid_for_date = CURRENT_DATE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deleted_count', deleted_count,
        'message', 'Attendance code revoked and deleted'
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.search_customer_for_order(p_search text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSON;
    v_search_clean TEXT;
BEGIN
    -- Clean search input
    v_search_clean := TRIM(p_search);
    
    -- Return empty if search too short
    IF LENGTH(v_search_clean) < 2 THEN
        RETURN json_build_object(
            'success', true,
            'exact_match', false,
            'customers', '[]'::json
        );
    END IF;

    -- Use CTE for optimized search with pre-calculated loyalty
    WITH customer_search AS (
        SELECT 
            c.id,
            c.name,
            c.phone,
            c.email,
            c.address,
            c.is_verified,
            c.created_at,
            -- Prioritize exact matches
            CASE 
                WHEN c.phone = v_search_clean THEN 0
                WHEN c.email = v_search_clean THEN 1
                WHEN LOWER(c.name) = LOWER(v_search_clean) THEN 2
                WHEN c.phone LIKE v_search_clean || '%' THEN 3
                ELSE 4 
            END as match_rank
        FROM customers c
        WHERE 
            -- Search by phone (partial match)
            c.phone ILIKE '%' || v_search_clean || '%'
            -- Search by name (partial match)
            OR c.name ILIKE '%' || v_search_clean || '%'
            -- Search by email (partial match)
            OR c.email ILIKE '%' || v_search_clean || '%'
        ORDER BY match_rank, c.name
        LIMIT 10
    ),
    customer_stats AS (
        SELECT 
            cs.id,
            cs.name,
            cs.phone,
            cs.email,
            cs.address,
            cs.is_verified,
            cs.created_at,
            cs.match_rank,
            COALESCE(lp.total_points, 0) as loyalty_points,
            COALESCE(o.order_count, 0) as total_orders
        FROM customer_search cs
        LEFT JOIN LATERAL (
            SELECT SUM(
                CASE WHEN type IN ('earned', 'bonus') THEN points ELSE -points END
            ) as total_points
            FROM loyalty_points 
            WHERE customer_id = cs.id
        ) lp ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::INT as order_count
            FROM orders 
            WHERE customer_id = cs.id
        ) o ON true
    )
    SELECT json_build_object(
        'success', true,
        'exact_match', COALESCE((SELECT bool_or(match_rank <= 2) FROM customer_stats), false),
        'customers', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'phone', phone,
                    'email', email,
                    'address', address,
                    'loyalty_points', loyalty_points,
                    'total_orders', total_orders,
                    'loyalty_tier', CASE 
                        WHEN loyalty_points >= 5000 THEN 'platinum'
                        WHEN loyalty_points >= 2000 THEN 'gold'
                        WHEN loyalty_points >= 500 THEN 'silver'
                        ELSE 'bronze'
                    END,
                    'is_verified', is_verified,
                    'created_at', created_at
                )
                ORDER BY match_rank, name
            )
            FROM customer_stats
        ), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.send_notification(p_user_ids uuid[], p_user_type text, p_title text, p_message text, p_type text DEFAULT 'system'::text, p_data jsonb DEFAULT NULL::jsonb, p_priority text DEFAULT 'normal'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    user_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    FOREACH user_id IN ARRAY p_user_ids LOOP
        INSERT INTO notifications (user_id, user_type, title, message, type, data, priority, sent_by)
        VALUES (user_id, p_user_type, p_title, p_message, p_type::notification_type, p_data, p_priority, emp_id);
    END LOOP;
    
    RETURN json_build_object('success', true, 'count', array_length(p_user_ids, 1));
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_all_reviews_visibility(p_is_visible boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Authorization check - only admin
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    -- Update all menu items and meals ratings based on new visibility
    UPDATE menu_items mi
    SET 
        rating = COALESCE((
            SELECT ROUND(AVG(r.rating)::numeric, 1) 
            FROM reviews r 
            WHERE r.item_id = mi.id AND r.is_visible = true
        ), 0),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews r 
            WHERE r.item_id = mi.id AND r.is_visible = true
        );
    
    UPDATE meals m
    SET 
        rating = COALESCE((
            SELECT ROUND(AVG(r.rating)::numeric, 1) 
            FROM reviews r 
            WHERE r.meal_id = m.id AND r.is_visible = true
        ), 0),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews r 
            WHERE r.meal_id = m.id AND r.is_visible = true
        );
    
    RETURN json_build_object(
        'success', true,
        'affected_count', affected_count,
        'message', CASE WHEN p_is_visible THEN 'All reviews are now visible' ELSE 'All reviews are now hidden' END
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.toggle_block_employee(p_employee_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee RECORD;
  v_new_portal_enabled BOOLEAN;
  v_action TEXT;
BEGIN
  -- Get current employee status
  SELECT id, name, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE id = p_employee_id;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Toggle portal_enabled only
  IF v_employee.portal_enabled = false THEN
    -- UNBLOCK: Set portal_enabled to true
    v_new_portal_enabled := true;
    v_action := 'unblocked';
    
    UPDATE employees SET
      portal_enabled = true,
      block_reason = NULL,
      updated_at = NOW()
    WHERE id = p_employee_id;
  ELSE
    -- BLOCK: Set portal_enabled to false
    v_new_portal_enabled := false;
    v_action := 'blocked';
    
    UPDATE employees SET
      portal_enabled = false,
      block_reason = COALESCE(p_reason, 'Account blocked by administrator'),
      updated_at = NOW()
    WHERE id = p_employee_id;
  END IF;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
  VALUES (
    v_action || '_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('portal_enabled', v_employee.portal_enabled),
    jsonb_build_object('portal_enabled', v_new_portal_enabled, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'portal_enabled', v_new_portal_enabled,
    'message', v_employee.name || ' has been ' || v_action
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION public.toggle_deal_active(p_deal_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_status BOOLEAN;
BEGIN
    UPDATE deals SET is_active = NOT is_active, updated_at = NOW() WHERE id = p_deal_id RETURNING is_active INTO v_new_status;
    RETURN json_build_object('success', true, 'is_active', v_new_status);
END;
$function$;


CREATE OR REPLACE FUNCTION public.toggle_employee_status(p_employee_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admin can change employee status';
    END IF;
    
    UPDATE employees
    SET status = p_status::employee_status,
        portal_enabled = (p_status = 'active'),
        updated_at = NOW()
    WHERE id = p_employee_id;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.toggle_maintenance_mode(p_is_enabled boolean, p_reason_type text DEFAULT 'update'::text, p_custom_reason text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_estimated_restore_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_show_timer boolean DEFAULT true, p_show_progress boolean DEFAULT true, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_maint_id UUID;
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_reason_type NOT IN ('update', 'bug_fix', 'changes', 'scheduled', 'custom') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid reason type');
    END IF;
    
    UPDATE maintenance_mode SET
        is_enabled = p_is_enabled,
        reason_type = p_reason_type,
        custom_reason = CASE WHEN p_reason_type = 'custom' THEN COALESCE(p_custom_reason, custom_reason) ELSE NULL END,
        title = COALESCE(NULLIF(p_title, ''), title, 'We''ll Be Right Back'),
        message = COALESCE(NULLIF(p_message, ''), message),
        estimated_restore_time = p_estimated_restore_time,
        show_timer = p_show_timer,
        show_progress = p_show_progress,
        enabled_at = CASE WHEN p_is_enabled THEN NOW() ELSE NULL END,
        enabled_by = CASE WHEN p_is_enabled THEN p_employee_id ELSE NULL END,
        updated_at = NOW()
    WHERE id = (SELECT id FROM maintenance_mode LIMIT 1)
    RETURNING id INTO v_maint_id;
    
    IF v_maint_id IS NULL THEN
        INSERT INTO maintenance_mode (is_enabled, reason_type, custom_reason, title, message, estimated_restore_time, show_timer, show_progress, enabled_at, enabled_by)
        VALUES (p_is_enabled, p_reason_type, p_custom_reason, p_title, p_message, p_estimated_restore_time, p_show_timer, p_show_progress,
            CASE WHEN p_is_enabled THEN NOW() ELSE NULL END, CASE WHEN p_is_enabled THEN p_employee_id ELSE NULL END)
        RETURNING id INTO v_maint_id;
    END IF;
    
    RETURN json_build_object('success', true, 'is_enabled', p_is_enabled);
END;
$function$;


-- ==================== END BATCH J ====================


-- ==================== BATCH K: UPDATE/VALIDATE FUNCTIONS ====================

CREATE OR REPLACE FUNCTION public.toggle_payment_method_status(p_id uuid, p_is_active boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.toggle_payment_method_status_internal(p_id uuid, p_is_active boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    UPDATE payment_methods SET is_active = p_is_active, updated_at = NOW() WHERE id = p_id;
    RETURN json_build_object('success', true, 'is_active', p_is_active, 'message', 'Status updated');
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_contact_message_priority(p_message_id uuid, p_priority text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid priority');
    END IF;
    
    UPDATE contact_messages 
    SET priority = p_priority, updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN json_build_object('success', true, 'message', 'Priority updated');
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_contact_message_status(p_message_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_status NOT IN ('unread', 'read', 'replied', 'archived') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    UPDATE contact_messages 
    SET status = p_status, updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN json_build_object('success', true, 'message', 'Status updated');
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_customer_auth_user_id(p_email text, p_auth_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE customers
    SET 
        auth_user_id = p_auth_user_id,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(p_email);
    
    RETURN FOUND;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_deal_with_items(p_deal_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_original_price numeric DEFAULT NULL::numeric, p_discounted_price numeric DEFAULT NULL::numeric, p_image_url text DEFAULT NULL::text, p_valid_until timestamp without time zone DEFAULT NULL::timestamp without time zone, p_usage_limit integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_items jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_discount_pct DECIMAL(5,2);
    v_item JSONB;
    v_orig DECIMAL(10,2);
    v_disc DECIMAL(10,2);
BEGIN
    SELECT original_price, discounted_price INTO v_orig, v_disc FROM deals WHERE id = p_deal_id;
    v_orig := COALESCE(p_original_price, v_orig);
    v_disc := COALESCE(p_discounted_price, v_disc);
    v_discount_pct := CASE WHEN v_orig > 0 THEN ROUND((1 - (v_disc / v_orig)) * 100, 2) ELSE 0 END;
    
    UPDATE deals SET
        name = COALESCE(p_name, name), description = COALESCE(p_description, description),
        original_price = COALESCE(p_original_price, original_price), discounted_price = COALESCE(p_discounted_price, discounted_price),
        discount_percentage = v_discount_pct, image_url = COALESCE(p_image_url, image_url),
        valid_until = COALESCE(p_valid_until, valid_until), usage_limit = COALESCE(p_usage_limit, usage_limit),
        is_active = COALESCE(p_is_active, is_active), updated_at = NOW()
    WHERE id = p_deal_id;
    
    IF p_items IS NOT NULL THEN
        DELETE FROM deal_items WHERE deal_id = p_deal_id;
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (p_deal_id, (v_item->>'id')::UUID, COALESCE((v_item->>'quantity')::INTEGER, 1))
            ON CONFLICT (deal_id, menu_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        END LOOP;
    END IF;
    
    RETURN json_build_object('success', true, 'id', p_deal_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_deal_with_items(p_deal_id uuid, p_name text, p_description text, p_code text, p_original_price numeric, p_discounted_price numeric, p_image_url text, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_is_active boolean, p_items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_discount_percentage DECIMAL;
    v_item JSONB;
BEGIN
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Update the deal
    UPDATE deals SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        code = COALESCE(NULLIF(TRIM(p_code), ''), code),
        original_price = COALESCE(p_original_price, original_price),
        discounted_price = COALESCE(p_discounted_price, discounted_price),
        discount_percentage = v_discount_percentage,
        images = CASE WHEN p_image_url IS NOT NULL THEN jsonb_build_array(p_image_url) ELSE images END,
        valid_from = COALESCE(p_valid_from, valid_from),
        valid_until = COALESCE(p_valid_until, valid_until),
        usage_limit = COALESCE(p_usage_limit, usage_limit),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_deal_id;
    
    -- Replace deal_items (delete old, insert new)
    IF p_items IS NOT NULL THEN
        DELETE FROM deal_items WHERE deal_id = p_deal_id;
        
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                p_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            );
        END LOOP;
    END IF;
    
    RETURN json_build_object('success', true, 'id', p_deal_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_employee_salary(p_employee_id uuid, p_new_salary numeric, p_payment_frequency text DEFAULT NULL::text, p_bank_details jsonb DEFAULT NULL::jsonb, p_updated_by uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_old_salary DECIMAL;
    v_emp_name TEXT;
BEGIN
    -- Get current salary
    SELECT salary, name INTO v_old_salary, v_emp_name 
    FROM employees WHERE id = p_employee_id;
    
    IF v_emp_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found');
    END IF;

    -- Update employee salary
    UPDATE employees SET 
        salary = p_new_salary,
        bank_details = COALESCE(p_bank_details, bank_details),
        updated_at = NOW()
    WHERE id = p_employee_id;

    -- Update or insert employee_payroll record for current month
    INSERT INTO employee_payroll (
        employee_id, month, year, base_salary, 
        payment_frequency, bank_details, total_amount
    ) VALUES (
        p_employee_id, 
        EXTRACT(MONTH FROM CURRENT_DATE)::int,
        EXTRACT(YEAR FROM CURRENT_DATE)::int,
        p_new_salary,
        COALESCE(p_payment_frequency, 'monthly'),
        COALESCE(p_bank_details, '{}'::jsonb),
        p_new_salary
    )
    ON CONFLICT (employee_id, month, year) DO UPDATE SET 
        base_salary = p_new_salary,
        payment_frequency = COALESCE(p_payment_frequency, employee_payroll.payment_frequency),
        bank_details = COALESCE(p_bank_details, employee_payroll.bank_details),
        total_amount = p_new_salary + COALESCE(employee_payroll.bonus, 0) - COALESCE(employee_payroll.deductions, 0),
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'employee_name', v_emp_name,
        'old_salary', v_old_salary,
        'new_salary', p_new_salary
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_kitchen_order_status(p_order_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    order_record RECORD;
    result JSON;
BEGIN
    -- Get current employee
    emp_id := get_employee_id();
    
    -- Update order
    UPDATE orders
    SET status = p_status::order_status,
        prepared_by = emp_id,
        kitchen_started_at = CASE WHEN p_status = 'preparing' THEN NOW() ELSE kitchen_started_at END,
        kitchen_completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE kitchen_completed_at END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;
    
    IF order_record IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Insert status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, p_status::order_status, emp_id);
    
    -- Create notification for waiter if order is ready
    IF p_status = 'ready' AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, user_type, title, message, type, data)
        VALUES (
            order_record.waiter_id,
            'employee',
            'Order Ready',
            'Order #' || order_record.order_number || ' is ready for pickup',
            'order',
            json_build_object(
                'order_id', order_record.id,
                'order_number', order_record.order_number,
                'table_number', order_record.table_number
            )::jsonb
        );
    END IF;
    
    -- Return updated order
    result := json_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', p_status,
        'updated_at', NOW()
    );
    
    RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_maintenance_email_sent(p_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE maintenance_mode SET
        email_sent_at = NOW(),
        email_sent_count = p_count,
        updated_at = NOW();
    
    RETURN json_build_object('success', true, 'sent_count', p_count);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_is_spicy boolean DEFAULT NULL::boolean, p_is_vegetarian boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_item_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item ID is required');
    END IF;
    
    -- Check item exists
    IF NOT EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Menu item not found');
    END IF;
    
    -- Generate new slug if name changed
    IF p_name IS NOT NULL AND trim(p_name) != '' THEN
        v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        IF EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug AND id != p_item_id) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;
    
    UPDATE menu_items
    SET 
        name = COALESCE(trim(p_name), name),
        slug = COALESCE(v_slug, slug),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        category_id = COALESCE(p_category_id, category_id),
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        is_spicy = COALESCE(p_is_spicy, is_spicy),
        is_vegetarian = COALESCE(p_is_vegetarian, is_vegetarian),
        preparation_time = CASE WHEN p_preparation_time IS NOT NULL THEN p_preparation_time ELSE preparation_time END,
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item updated successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'updated_at', v_result.updated_at
        )
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer, p_has_variants boolean DEFAULT NULL::boolean, p_size_variants jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_item_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item ID is required');
    END IF;
    
    -- Check item exists
    IF NOT EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Menu item not found');
    END IF;
    
    -- Generate new slug if name changed
    IF p_name IS NOT NULL AND trim(p_name) != '' THEN
        v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        IF EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug AND id != p_item_id) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;
    
    UPDATE menu_items
    SET 
        name = COALESCE(trim(p_name), name),
        slug = COALESCE(v_slug, slug),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        category_id = COALESCE(p_category_id, category_id),
        images = CASE WHEN p_images IS NOT NULL THEN to_jsonb(p_images) ELSE images END,
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        preparation_time = CASE WHEN p_preparation_time IS NOT NULL THEN p_preparation_time ELSE preparation_time END,
        has_variants = COALESCE(p_has_variants, has_variants),
        size_variants = CASE 
            WHEN p_has_variants = true THEN COALESCE(p_size_variants, size_variants)
            WHEN p_has_variants = false THEN NULL
            ELSE size_variants
        END,
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item updated successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'has_variants', v_result.has_variants,
            'size_variants', v_result.size_variants,
            'updated_at', v_result.updated_at
        )
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_sale_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_is_spicy boolean DEFAULT NULL::boolean, p_is_vegetarian boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_item_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item ID is required');
    END IF;
    
    -- Check item exists
    IF NOT EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Menu item not found');
    END IF;
    
    -- Generate new slug if name changed
    IF p_name IS NOT NULL AND trim(p_name) != '' THEN
        v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        IF EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug AND id != p_item_id) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;
    
    UPDATE menu_items
    SET 
        name = COALESCE(trim(p_name), name),
        slug = COALESCE(v_slug, slug),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        sale_price = CASE WHEN p_sale_price IS NOT NULL THEN p_sale_price ELSE sale_price END,
        category_id = COALESCE(p_category_id, category_id),
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        is_spicy = COALESCE(p_is_spicy, is_spicy),
        is_vegetarian = COALESCE(p_is_vegetarian, is_vegetarian),
        preparation_time = CASE WHEN p_preparation_time IS NOT NULL THEN p_preparation_time ELSE preparation_time END,
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item updated successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'updated_at', v_result.updated_at
        )
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_order_status_kitchen(p_order_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    IF NOT can_access_kitchen() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    -- Update order
    UPDATE orders
    SET status = p_status::order_status,
        prepared_by = emp_id,
        kitchen_started_at = CASE WHEN p_status = 'preparing' THEN NOW() ELSE kitchen_started_at END,
        kitchen_completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE kitchen_completed_at END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;
    
    -- Insert status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, p_status::order_status, emp_id);
    
    -- Create notification for waiter
    IF p_status = 'ready' AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, user_type, title, message, type, data)
        VALUES (
            order_record.waiter_id,
            'employee',
            'Order Ready',
            'Order #' || order_record.order_number || ' is ready for serving',
            'order',
            json_build_object('order_id', p_order_id, 'order_number', order_record.order_number)
        );
    END IF;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_order_status_quick(p_order_id uuid, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    -- Get current employee (may be null for system updates)
    BEGIN
        emp_id := get_employee_id();
    EXCEPTION WHEN OTHERS THEN
        emp_id := NULL;
    END;

    -- Update order with timestamps based on status
    UPDATE orders
    SET 
        status = p_status::order_status,
        kitchen_started_at = CASE 
            WHEN p_status = 'preparing' AND kitchen_started_at IS NULL THEN NOW() 
            ELSE kitchen_started_at 
        END,
        kitchen_completed_at = CASE 
            WHEN p_status = 'ready' THEN NOW() 
            ELSE kitchen_completed_at 
        END,
        delivery_started_at = CASE 
            WHEN p_status = 'delivering' AND delivery_started_at IS NULL THEN NOW() 
            ELSE delivery_started_at 
        END,
        delivered_at = CASE 
            WHEN p_status = 'delivered' THEN NOW() 
            ELSE delivered_at 
        END,
        prepared_by = CASE 
            WHEN p_status IN ('preparing', 'ready') AND emp_id IS NOT NULL THEN emp_id 
            ELSE prepared_by 
        END,
        delivery_rider_id = CASE 
            WHEN p_status = 'delivering' AND emp_id IS NOT NULL THEN emp_id 
            ELSE delivery_rider_id 
        END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;

    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, p_status::order_status, emp_id, p_notes);

    -- Return success with key fields for UI update
    RETURN json_build_object(
        'success', true,
        'order_id', order_record.id,
        'new_status', p_status,
        'updated_at', order_record.updated_at
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_payment_method(p_id uuid, p_method_type text DEFAULT NULL::text, p_method_name text DEFAULT NULL::text, p_account_number text DEFAULT NULL::text, p_account_holder_name text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_display_order integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.update_payment_method_internal(p_id uuid, p_method_type text DEFAULT NULL::text, p_method_name text DEFAULT NULL::text, p_account_number text DEFAULT NULL::text, p_account_holder_name text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_display_order integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    UPDATE payment_methods SET
        method_type = COALESCE(p_method_type, method_type),
        method_name = COALESCE(p_method_name, method_name),
        account_number = COALESCE(p_account_number, account_number),
        account_holder_name = COALESCE(p_account_holder_name, account_holder_name),
        bank_name = COALESCE(p_bank_name, bank_name),
        is_active = COALESCE(p_is_active, is_active),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN json_build_object('success', true, 'message', 'Payment method updated');
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_payslip_advanced(p_payslip_id uuid, p_status text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_bonuses numeric DEFAULT NULL::numeric, p_deductions numeric DEFAULT NULL::numeric, p_tax_amount numeric DEFAULT NULL::numeric, p_overtime_hours numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_payslip RECORD;
    v_net_salary DECIMAL;
    v_overtime_pay DECIMAL;
    v_bonuses DECIMAL;
    v_deductions DECIMAL;
    v_tax DECIMAL;
    v_overtime DECIMAL;
BEGIN
    -- Get existing payslip
    SELECT * INTO v_payslip FROM payslips WHERE id = p_payslip_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;

    -- Use new values or existing
    v_bonuses := COALESCE(p_bonuses, v_payslip.bonuses);
    v_deductions := COALESCE(p_deductions, v_payslip.deductions);
    v_tax := COALESCE(p_tax_amount, v_payslip.tax_amount);
    v_overtime := COALESCE(p_overtime_hours, v_payslip.overtime_hours);

    -- Recalculate net salary
    v_overtime_pay := (v_payslip.base_salary / 30.0 / 8.0) * v_overtime * v_payslip.overtime_rate;
    v_net_salary := v_payslip.base_salary + v_overtime_pay + v_bonuses - v_deductions - v_tax;

    UPDATE payslips
    SET 
        status = COALESCE(p_status, status),
        payment_method = COALESCE(p_payment_method, payment_method),
        bonuses = v_bonuses,
        deductions = v_deductions,
        tax_amount = v_tax,
        overtime_hours = v_overtime,
        net_salary = v_net_salary,
        notes = COALESCE(p_notes, notes),
        paid_at = CASE 
            WHEN p_status = 'paid' AND paid_at IS NULL THEN NOW() 
            ELSE paid_at 
        END,
        updated_at = NOW()
    WHERE id = p_payslip_id;
    
    RETURN json_build_object('success', true, 'net_salary', v_net_salary);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_review_visibility(p_review_id uuid, p_is_visible boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_review_visibility_by_employee(p_review_id uuid, p_is_visible boolean, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    -- Check if employee exists and is manager or admin
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_user_password(p_email text, p_new_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_auth_user_id_text TEXT;
  v_auth_user_id UUID;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get auth_user_id (check customers first, then employees)
  SELECT c.auth_user_id INTO v_auth_user_id_text
  FROM public.customers c
  WHERE c.email = p_email;
  
  IF v_auth_user_id_text IS NULL THEN
    SELECT e.auth_user_id INTO v_auth_user_id_text
    FROM public.employees e
    WHERE e.email = p_email;
  END IF;
  
  IF v_auth_user_id_text IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Account not found with this email');
  END IF;
  
  -- Cast to UUID
  BEGIN
    v_auth_user_id := v_auth_user_id_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid auth user ID format');
  END;
  
  -- Update password directly in Supabase auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id::text = v_auth_user_id::text;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Auth user not found');
  END IF;
  
  -- Clear sessions (force re-login)
  DELETE FROM auth.sessions WHERE user_id::text = v_auth_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = v_auth_user_id::text;
  
  RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.upsert_website_settings_internal(p_settings jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO website_content (key, title, content, section, is_active, updated_at)
    VALUES ('settings', 'Website Settings', p_settings, 'general', true, NOW())
    ON CONFLICT (key) DO UPDATE SET
        content = p_settings,
        updated_at = NOW();
    
    RETURN json_build_object('success', true, 'message', 'Settings saved');
END;
$function$;


CREATE OR REPLACE FUNCTION public.validate_employee_license(p_email text, p_license_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee RECORD;
    v_license RECORD;
BEGIN
    -- Normalize email
    p_email := LOWER(TRIM(p_email));
    p_license_id := UPPER(TRIM(p_license_id));
    
    -- Find employee by email (case insensitive)
    SELECT id, name, email, role, status, portal_enabled, auth_user_id
    INTO v_employee
    FROM employees
    WHERE LOWER(email) = p_email;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No employee found with this email address'
        );
    END IF;
    
    -- Check if already active
    IF v_employee.status = 'active' AND v_employee.portal_enabled AND v_employee.auth_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'This account is already activated. Please use login instead.',
            'already_active', TRUE
        );
    END IF;
    
    -- Find license for this employee
    SELECT *
    INTO v_license
    FROM employee_licenses
    WHERE employee_id = v_employee.id
      AND license_id = p_license_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid license ID for this employee'
        );
    END IF;
    
    -- Check if license is already used
    IF v_license.is_used THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'This license ID has already been used'
        );
    END IF;
    
    -- Check if license is expired
    IF v_license.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'License ID has expired. Please contact admin for a new one.'
        );
    END IF;
    
    -- Valid - return employee info
    RETURN jsonb_build_object(
        'success', TRUE,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'email', v_employee.email,
            'role', v_employee.role::TEXT
        ),
        'license', jsonb_build_object(
            'id', v_license.id,
            'license_id', v_license.license_id,
            'expires_at', v_license.expires_at
        )
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_customer_id uuid DEFAULT NULL::uuid, p_order_amount numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL;
BEGIN
    -- Find the promo code
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (usage_limit IS NULL OR current_usage < usage_limit)
      -- Check customer-specific codes belong to the right customer
      AND (customer_id IS NULL OR customer_id = p_customer_id)
    LIMIT 1;

    IF v_promo IS NULL THEN
        -- Check if code exists but is invalid
        IF EXISTS (SELECT 1 FROM promo_codes WHERE UPPER(code) = UPPER(p_code)) THEN
            RETURN json_build_object(
                'valid', false,
                'error', 'Promo code is expired, used, or not available for your account'
            );
        END IF;
        
        RETURN json_build_object('valid', false, 'error', 'Invalid promo code');
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required'
        );
    END IF;

    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSE
        v_discount := v_promo.value;
    END IF;

    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'promo_type', v_promo.promo_type,
            'value', v_promo.value,
            'discount_amount', v_discount
        ),
        'discount_amount', v_discount
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.validate_promo_code_for_billing(p_code text, p_customer_id uuid DEFAULT NULL::uuid, p_order_amount numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ==================== END BATCH K ====================

-- ==================== BATCH L: Previously Missing RPCs ====================

CREATE OR REPLACE FUNCTION public.delete_customer_promo_admin(p_promo_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    DELETE FROM promo_codes
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_favorite_ids(p_customer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_favorites jsonb;
BEGIN
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return array of {id, type} objects
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', elem->>'id', 'type', elem->>'type')), '[]'::jsonb)
    FROM jsonb_array_elements(v_favorites) AS elem
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_favorite(p_customer_id uuid, p_item_id text, p_item_type text DEFAULT 'menu_item'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_favorites jsonb;
  v_item jsonb;
  v_exists boolean;
  v_result jsonb;
BEGIN
  -- Build the item object
  v_item := jsonb_build_object(
    'id', p_item_id,
    'type', p_item_type,
    'added_at', NOW()
  );

  -- Get current favorites
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Check if item already exists
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_favorites) AS elem
    WHERE elem->>'id' = p_item_id AND elem->>'type' = p_item_type
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove from favorites
    v_favorites := (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(v_favorites) AS elem
      WHERE NOT (elem->>'id' = p_item_id AND elem->>'type' = p_item_type)
    );
    
    UPDATE customers SET favorites = v_favorites, updated_at = NOW()
    WHERE id = p_customer_id;
    
    v_result := jsonb_build_object(
      'action', 'removed',
      'item_id', p_item_id,
      'item_type', p_item_type,
      'favorites', v_favorites
    );
  ELSE
    -- Add to favorites (prepend to array for recent first)
    v_favorites := v_item || v_favorites;
    
    UPDATE customers SET favorites = v_favorites, updated_at = NOW()
    WHERE id = p_customer_id;
    
    v_result := jsonb_build_object(
      'action', 'added',
      'item_id', p_item_id,
      'item_type', p_item_type,
      'favorites', v_favorites
    );
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_perks_setting(p_setting_key text, p_setting_value jsonb, p_description text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ==================== END BATCH L ====================


-- ============================================================================
-- SECTION 7: TRIGGERS
-- ============================================================================

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_payroll_updated_at BEFORE UPDATE ON employee_payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_employee_id BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION generate_employee_id();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_invoice_number BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER loyalty_points_award_promo_trigger AFTER INSERT ON loyalty_points FOR EACH ROW EXECUTE FUNCTION award_loyalty_promo_on_points_insert();
CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON loyalty_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER menu_item_slug_trigger BEFORE INSERT OR UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION auto_generate_menu_item_slug();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_new_notification AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION notify_new_notification();
CREATE TRIGGER on_order_status_auto_log AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION auto_log_order_status_change();
CREATE TRIGGER on_order_status_change AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();
CREATE TRIGGER set_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_cleanup_otps AFTER INSERT ON otp_codes FOR EACH ROW EXECUTE FUNCTION auto_cleanup_otps_trigger();
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_website_content_updated_at BEFORE UPDATE ON website_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
