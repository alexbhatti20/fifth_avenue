-- =========================================
-- UPDATE get_user_by_email TO INCLUDE portal_enabled AND block_reason
-- Run this SQL in Supabase to fix the blocked employee issue
-- =========================================

DROP FUNCTION IF EXISTS get_user_by_email(TEXT);

-- Get user by email - checks both employees and customers tables
-- Now includes portal_enabled and block_reason for employees
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    phone TEXT,
    user_type TEXT,
    role TEXT,
    permissions JSONB,
    employee_id TEXT,
    status TEXT,
    is_2fa_enabled BOOLEAN,
    portal_enabled BOOLEAN,
    block_reason TEXT,
    is_banned BOOLEAN,
    auth_user_id UUID
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO anon;
