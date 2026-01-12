-- =========================================
-- EMPLOYEE BLOCK SYSTEM
-- Add block_reason column and fast toggle function
-- =========================================

-- Add block_reason column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Drop existing functions to recreate
DROP FUNCTION IF EXISTS block_employee(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS toggle_block_employee(UUID, TEXT);

-- =========================================
-- FAST TOGGLE BLOCK/UNBLOCK FUNCTION
-- Single function to block or unblock employee
-- No email - just fast database update
-- =========================================
CREATE OR REPLACE FUNCTION toggle_block_employee(
  p_employee_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_new_status TEXT;
  v_action TEXT;
BEGIN
  -- Get current employee status
  SELECT id, name, status::TEXT, portal_enabled 
  INTO v_employee
  FROM employees 
  WHERE id = p_employee_id;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Toggle status
  IF v_employee.status = 'blocked' THEN
    -- UNBLOCK: Set to active
    v_new_status := 'active';
    v_action := 'unblocked';
    
    UPDATE employees SET
      status = 'active'::employee_status,
      portal_enabled = true,
      block_reason = NULL,
      updated_at = NOW()
    WHERE id = p_employee_id;
  ELSE
    -- BLOCK: Set to blocked
    v_new_status := 'blocked';
    v_action := 'blocked';
    
    UPDATE employees SET
      status = 'blocked'::employee_status,
      portal_enabled = false,
      block_reason = COALESCE(p_reason, 'Account blocked by administrator'),
      updated_at = NOW()
    WHERE id = p_employee_id;
    
    -- Expire all licenses
    UPDATE employee_licenses SET
      expires_at = NOW()
    WHERE employee_id = p_employee_id AND expires_at > NOW();
  END IF;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
  VALUES (
    v_action || '_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('status', v_employee.status),
    jsonb_build_object('status', v_new_status, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'new_status', v_new_status,
    'portal_enabled', (v_new_status = 'active'),
    'message', v_employee.name || ' has been ' || v_action
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- GET BLOCK REASON FOR LOGIN
-- Returns block reason if employee is blocked
-- =========================================
CREATE OR REPLACE FUNCTION get_employee_block_status(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, name, status::TEXT, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE email = p_email;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  IF v_employee.status = 'blocked' THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_blocked', true,
      'block_reason', COALESCE(v_employee.block_reason, 'Your account has been blocked. Contact administrator.'),
      'portal_enabled', false
    );
  END IF;

  IF NOT v_employee.portal_enabled THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_blocked', false,
      'portal_enabled', false,
      'message', 'Portal access is disabled for your account.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_blocked', false,
    'portal_enabled', true
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION toggle_block_employee(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_block_status(TEXT) TO anon, authenticated;
