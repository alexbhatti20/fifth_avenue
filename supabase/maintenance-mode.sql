-- =============================================
-- MAINTENANCE MODE SYSTEM
-- Allows admin to put site in maintenance mode
-- All non-admin users see maintenance page
-- =============================================

-- Drop existing table if exists
DROP TABLE IF EXISTS public.maintenance_mode CASCADE;

-- Create maintenance_mode table (single row, settings table)
CREATE TABLE IF NOT EXISTS public.maintenance_mode (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    reason_type TEXT NOT NULL DEFAULT 'update' CHECK (reason_type IN ('update', 'bug_fix', 'changes', 'scheduled', 'custom')),
    custom_reason TEXT,
    title TEXT DEFAULT 'We''ll Be Right Back',
    message TEXT DEFAULT 'Our website is currently undergoing scheduled maintenance. We apologize for any inconvenience.',
    estimated_restore_time TIMESTAMPTZ,
    show_timer BOOLEAN DEFAULT true,
    show_progress BOOLEAN DEFAULT true,
    enabled_at TIMESTAMPTZ,
    enabled_by UUID REFERENCES employees(id),
    email_sent_at TIMESTAMPTZ,
    email_sent_count INTEGER DEFAULT 0,
    last_check TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_mode_single_row_idx ON maintenance_mode ((id IS NOT NULL));

-- Insert default row if not exists
INSERT INTO maintenance_mode (id, is_enabled, reason_type) 
VALUES (gen_random_uuid(), false, 'update')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read maintenance status (needed to show maintenance page)
DROP POLICY IF EXISTS "Anyone can read maintenance status" ON public.maintenance_mode;
CREATE POLICY "Anyone can read maintenance status" ON public.maintenance_mode
    FOR SELECT USING (true);

-- Only admins can modify
DROP POLICY IF EXISTS "Only admin can modify maintenance mode" ON public.maintenance_mode;
CREATE POLICY "Only admin can modify maintenance mode" ON public.maintenance_mode
    FOR ALL USING (is_admin());

-- =============================================
-- RPC: GET MAINTENANCE STATUS (Public, fast)
-- =============================================
CREATE OR REPLACE FUNCTION get_maintenance_status()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: TOGGLE MAINTENANCE MODE (Admin only)
-- =============================================
CREATE OR REPLACE FUNCTION toggle_maintenance_mode(
    p_is_enabled BOOLEAN,
    p_reason_type TEXT DEFAULT 'update',
    p_custom_reason TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_estimated_restore_time TIMESTAMPTZ DEFAULT NULL,
    p_show_timer BOOLEAN DEFAULT true,
    p_show_progress BOOLEAN DEFAULT true,
    p_employee_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_maint_id UUID;
BEGIN
    -- Authorization check
    IF NOT is_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin can toggle maintenance mode.'
        );
    END IF;
    
    -- Validate reason_type
    IF p_reason_type NOT IN ('update', 'bug_fix', 'changes', 'scheduled', 'custom') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid reason type'
        );
    END IF;
    
    -- Update or insert maintenance record (single row table - select the existing row)
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
    
    -- If no row exists, insert one
    IF v_maint_id IS NULL THEN
        INSERT INTO maintenance_mode (
            is_enabled, reason_type, custom_reason, title, message,
            estimated_restore_time, show_timer, show_progress,
            enabled_at, enabled_by
        ) VALUES (
            p_is_enabled, p_reason_type, p_custom_reason, p_title, p_message,
            p_estimated_restore_time, p_show_timer, p_show_progress,
            CASE WHEN p_is_enabled THEN NOW() ELSE NULL END,
            CASE WHEN p_is_enabled THEN p_employee_id ELSE NULL END
        )
        RETURNING id INTO v_maint_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'is_enabled', p_is_enabled,
        'message', CASE 
            WHEN p_is_enabled THEN 'Maintenance mode enabled. All non-admin users will see the maintenance page.'
            ELSE 'Maintenance mode disabled. Website is now accessible to all users.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: UPDATE EMAIL SENT STATUS
-- =============================================
CREATE OR REPLACE FUNCTION update_maintenance_email_sent(
    p_count INTEGER
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE maintenance_mode SET
        email_sent_at = NOW(),
        email_sent_count = p_count,
        updated_at = NOW()
    WHERE id = (SELECT id FROM maintenance_mode LIMIT 1);
    
    RETURN json_build_object('success', true, 'sent_count', p_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: GET ALL USERS FOR EMAIL NOTIFICATION
-- =============================================
CREATE OR REPLACE FUNCTION get_all_users_for_maintenance_email()
RETURNS JSON AS $$
DECLARE
    result JSON;
    customer_count INTEGER;
    employee_count INTEGER;
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized - not admin');
    END IF;
    
    -- Count for debugging
    SELECT COUNT(*) INTO customer_count FROM customers WHERE email IS NOT NULL AND email != '' AND is_banned = false;
    SELECT COUNT(*) INTO employee_count FROM employees WHERE email IS NOT NULL AND email != '' AND status = 'active' AND role != 'admin';
    
    SELECT json_build_object(
        'success', true,
        'debug', json_build_object('customer_count', customer_count, 'employee_count', employee_count),
        'customers', COALESCE((
            SELECT json_agg(json_build_object(
                'email', c.email,
                'name', COALESCE(c.name, 'Customer')
            ))
            FROM customers c
            WHERE c.email IS NOT NULL 
            AND c.email != ''
            AND c.is_banned = false
        ), '[]'::json),
        'employees', COALESCE((
            SELECT json_agg(json_build_object(
                'email', e.email,
                'name', COALESCE(e.name, 'Employee')
            ))
            FROM employees e
            WHERE e.email IS NOT NULL 
            AND e.email != ''
            AND e.status = 'active'
            AND e.role != 'admin'
        ), '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_maintenance_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_maintenance_mode(BOOLEAN, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_maintenance_email_sent(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_for_maintenance_email() TO authenticated;

-- Add comments
COMMENT ON TABLE maintenance_mode IS 'Single-row table storing maintenance mode settings';
COMMENT ON FUNCTION get_maintenance_status IS 'Public: Check if site is in maintenance mode';
COMMENT ON FUNCTION toggle_maintenance_mode IS 'Admin: Toggle maintenance mode with details';
COMMENT ON FUNCTION get_all_users_for_maintenance_email IS 'Admin: Get all user emails for notification';
