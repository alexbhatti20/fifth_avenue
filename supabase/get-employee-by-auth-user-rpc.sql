-- =========================================
-- GET EMPLOYEE BY AUTH USER ID
-- Returns complete employee data for authenticated user
-- =========================================

DROP FUNCTION IF EXISTS get_employee_by_auth_user(UUID);

CREATE OR REPLACE FUNCTION get_employee_by_auth_user(p_auth_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_employee_by_auth_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_by_auth_user(UUID) TO anon;
