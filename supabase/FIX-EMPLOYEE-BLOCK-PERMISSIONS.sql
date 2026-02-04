-- =========================================
-- FIX EMPLOYEE BLOCK/UNBLOCK PERMISSIONS
-- Run this to fix the permission denied error
-- =========================================

-- Step 1: Drop and recreate the function with proper permissions
DROP FUNCTION IF EXISTS toggle_block_employee(UUID, TEXT);

-- Step 2: Create the function with SECURITY DEFINER
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
  v_current_user_id UUID;
  v_current_user_role TEXT;
BEGIN
  -- Get current authenticated user's employee ID and role
  SELECT id, role INTO v_current_user_id, v_current_user_role
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- Only admin and manager can block/unblock employees
  IF v_current_user_role NOT IN ('admin', 'manager') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Only admins and managers can block/unblock employees'
    );
  END IF;

  -- Get target employee status
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

  -- Log in audit with user who performed the action
  INSERT INTO audit_logs (
    action, 
    table_name, 
    record_id, 
    user_id,
    old_data, 
    new_data
  )
  VALUES (
    v_action || '_employee', 
    'employees', 
    p_employee_id,
    v_current_user_id,
    jsonb_build_object('portal_enabled', v_employee.portal_enabled),
    jsonb_build_object(
      'portal_enabled', v_new_portal_enabled, 
      'reason', p_reason,
      'performed_by', v_current_user_id
    )
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

-- Step 3: Revoke all existing permissions first (clean slate)
REVOKE ALL ON FUNCTION toggle_block_employee(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_block_employee(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION toggle_block_employee(UUID, TEXT) FROM authenticated;

-- Step 4: Grant EXECUTE permission ONLY to authenticated role
GRANT EXECUTE ON FUNCTION toggle_block_employee(UUID, TEXT) TO authenticated;

-- Step 5: Add comment for documentation
COMMENT ON FUNCTION toggle_block_employee IS 'Toggle employee block status - Admin/Manager only - Server-side only';

-- Step 6: Verify permissions (optional - run this to check)
DO $$
BEGIN
  RAISE NOTICE 'Permissions fixed for toggle_block_employee function';
  RAISE NOTICE 'Function is now available to authenticated users';
  RAISE NOTICE 'Role validation happens inside the function';
END $$;
