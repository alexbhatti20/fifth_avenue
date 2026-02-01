-- =========================================
-- RPC function to get employee data for 2FA verification
-- Uses SECURITY DEFINER to bypass RLS during login flow
-- Run this SQL in Supabase to enable 2FA verification
-- =========================================

DROP FUNCTION IF EXISTS get_employee_for_2fa(UUID);

-- Get employee by ID for 2FA verification - bypasses RLS
CREATE OR REPLACE FUNCTION get_employee_for_2fa(p_employee_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    phone TEXT,
    role TEXT,
    permissions JSONB,
    auth_user_id UUID,
    two_fa_secret TEXT,
    is_2fa_enabled BOOLEAN,
    status TEXT,
    portal_enabled BOOLEAN
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon (needed during login before auth)
GRANT EXECUTE ON FUNCTION get_employee_for_2fa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_for_2fa(UUID) TO anon;

-- Also create a function to update employee after 2FA verification
DROP FUNCTION IF EXISTS update_employee_2fa_login(UUID, UUID);

CREATE OR REPLACE FUNCTION update_employee_2fa_login(
    p_employee_id UUID,
    p_auth_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update last_login and optionally auth_user_id
    IF p_auth_user_id IS NOT NULL THEN
        UPDATE employees
        SET 
            last_login = NOW(),
            auth_user_id = p_auth_user_id,
            updated_at = NOW()
        WHERE id = p_employee_id;
    ELSE
        UPDATE employees
        SET 
            last_login = NOW(),
            updated_at = NOW()
        WHERE id = p_employee_id;
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_employee_2fa_login(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_2fa_login(UUID, UUID) TO anon;
