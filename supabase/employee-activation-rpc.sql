-- =====================================================
-- EMPLOYEE ACTIVATION RPC FUNCTIONS
-- Handles portal activation flow (bypasses RLS)
-- Created: January 2026
-- =====================================================

-- Drop existing functions (all possible signatures)
DROP FUNCTION IF EXISTS validate_employee_license(TEXT, TEXT);
DROP FUNCTION IF EXISTS activate_employee_portal(TEXT, UUID);
DROP FUNCTION IF EXISTS activate_employee_portal(TEXT, UUID, TEXT);

-- =====================================================
-- 1. VALIDATE EMPLOYEE LICENSE
-- Called when employee enters email + license ID
-- Returns employee info if valid, error otherwise
-- =====================================================
CREATE OR REPLACE FUNCTION validate_employee_license(
    p_email TEXT,
    p_license_id TEXT
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. ACTIVATE EMPLOYEE PORTAL
-- Called after OTP verification to mark employee as active
-- Updates employee status, portal access, and license usage
-- =====================================================
CREATE OR REPLACE FUNCTION activate_employee_portal(
    p_email TEXT,
    p_auth_user_id UUID,
    p_license_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_employee RECORD;
    v_license_updated BOOLEAN := FALSE;
BEGIN
    -- Normalize email
    p_email := LOWER(TRIM(p_email));
    
    -- Find and update employee
    UPDATE employees
    SET 
        auth_user_id = p_auth_user_id,
        status = 'active',
        portal_enabled = TRUE,
        updated_at = NOW()
    WHERE LOWER(email) = p_email
    RETURNING id, name, email, role, employee_id, permissions
    INTO v_employee;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Employee not found'
        );
    END IF;
    
    -- Mark license as used (if license_id provided)
    IF p_license_id IS NOT NULL AND p_license_id != '' THEN
        UPDATE employee_licenses
        SET 
            is_used = TRUE,
            activated_at = NOW()
        WHERE employee_id = v_employee.id
          AND license_id = UPPER(TRIM(p_license_id));
        
        v_license_updated := FOUND;
    ELSE
        -- Try to mark any unused license for this employee (using subquery since LIMIT not allowed in UPDATE)
        UPDATE employee_licenses
        SET 
            is_used = TRUE,
            activated_at = NOW()
        WHERE id = (
            SELECT id FROM employee_licenses
            WHERE employee_id = v_employee.id
              AND is_used = FALSE
              AND expires_at > NOW()
            ORDER BY expires_at ASC
            LIMIT 1
        );
        
        v_license_updated := FOUND;
    END IF;
    
    -- Return success with employee data
    RETURN jsonb_build_object(
        'success', TRUE,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'email', v_employee.email,
            'role', v_employee.role::TEXT,
            'employee_id', v_employee.employee_id,
            'permissions', v_employee.permissions
        ),
        'license_updated', v_license_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT EXECUTE TO AUTHENTICATED AND ANON
-- (Needed for activation flow before user is authenticated)
-- =====================================================
GRANT EXECUTE ON FUNCTION validate_employee_license TO anon;
GRANT EXECUTE ON FUNCTION validate_employee_license TO authenticated;
GRANT EXECUTE ON FUNCTION activate_employee_portal TO anon;
GRANT EXECUTE ON FUNCTION activate_employee_portal TO authenticated;
