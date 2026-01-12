-- =========================================
-- GET EMPLOYEE BLOCK STATUS BY ID
-- Function to check if an employee is blocked
-- Used for polling from client to detect blocks
-- =========================================

CREATE OR REPLACE FUNCTION get_employee_block_status_by_id(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, status, portal_enabled, block_reason
  INTO v_employee
  FROM employees
  WHERE id = p_employee_id;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object(
      'is_blocked', false,
      'error', 'Employee not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'is_blocked', (v_employee.status = 'blocked' OR v_employee.portal_enabled = false),
    'status', v_employee.status,
    'portal_enabled', v_employee.portal_enabled,
    'block_reason', v_employee.block_reason
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_employee_block_status_by_id(UUID) TO authenticated;
