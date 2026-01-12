-- =========================================
-- SIMPLE EMPLOYEE BLOCK SYSTEM
-- Only toggles portal_enabled column (true/false)
-- =========================================

-- Drop existing function to recreate
DROP FUNCTION IF EXISTS toggle_block_employee(UUID, TEXT);
DROP FUNCTION IF EXISTS check_employee_portal_access(TEXT);

-- =========================================
-- SIMPLE TOGGLE BLOCK/UNBLOCK FUNCTION
-- Only updates portal_enabled column
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
$$;

-- =========================================
-- CHECK EMPLOYEE PORTAL ACCESS BY EMAIL
-- Used during login to check if employee can access portal
-- =========================================
CREATE OR REPLACE FUNCTION check_employee_portal_access(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, name, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE LOWER(email) = LOWER(p_email);

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'portal_enabled', false,
      'block_reason', null
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'portal_enabled', COALESCE(v_employee.portal_enabled, true),
    'block_reason', v_employee.block_reason
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION toggle_block_employee(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_employee_portal_access(TEXT) TO authenticated;
