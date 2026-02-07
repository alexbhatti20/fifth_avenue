-- Google OAuth Customer Creation and Linking Functions
-- These RPCs handle Google OAuth authentication for customers

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS create_google_oauth_customer(uuid, text, text, text);
DROP FUNCTION IF EXISTS link_google_auth_to_customer(uuid, uuid);
DROP FUNCTION IF EXISTS link_google_auth_to_employee(uuid, uuid);

-- Create customer from Google OAuth data
-- Only allows customer creation, not employees
CREATE OR REPLACE FUNCTION create_google_oauth_customer(
  p_auth_user_id uuid,
  p_email text,
  p_name text,
  p_phone text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_existing_customer_id uuid;
  v_existing_employee_id uuid;
  v_phone_value text;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));
  
  -- Normalize phone: treat empty/whitespace-only as NULL to avoid unique constraint violations
  v_phone_value := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  
  -- Check if email already exists as an employee (should NOT allow registration)
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
    -- Link the auth_user_id to existing customer if not already linked
    UPDATE customers
    SET auth_user_id = p_auth_user_id,
        updated_at = now()
    WHERE id = v_existing_customer_id
      AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
    
    RETURN v_existing_customer_id;
  END IF;
  
  -- Check if auth_user_id already linked to another customer
  SELECT id INTO v_existing_customer_id
  FROM customers
  WHERE auth_user_id = p_auth_user_id
  LIMIT 1;
  
  IF v_existing_customer_id IS NOT NULL THEN
    RETURN v_existing_customer_id;
  END IF;
  
  -- Create new customer (phone is NULL for Google OAuth to avoid unique constraint)
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
    v_phone_value,  -- NULL instead of '' to avoid unique constraint violation
    p_auth_user_id,
    true,  -- Google OAuth users are auto-verified
    now(),
    now()
  )
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

-- Link Google auth to existing customer account
CREATE OR REPLACE FUNCTION link_google_auth_to_customer(
  p_customer_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update customer with auth_user_id if not already linked to different auth
  UPDATE customers
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_customer_id
    AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
  
  RETURN FOUND;
END;
$$;

-- Link Google auth to existing employee account
-- Note: This only links to existing employees, does NOT create new employees
CREATE OR REPLACE FUNCTION link_google_auth_to_employee(
  p_employee_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_google_oauth_customer(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_google_oauth_customer(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION link_google_auth_to_customer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION link_google_auth_to_customer(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION link_google_auth_to_employee(uuid, uuid) TO authenticated;

-- Add comment descriptions
COMMENT ON FUNCTION create_google_oauth_customer IS 'Creates a new customer from Google OAuth. Only for customers, not employees.';
COMMENT ON FUNCTION link_google_auth_to_customer IS 'Links Google auth to an existing customer account.';
COMMENT ON FUNCTION link_google_auth_to_employee IS 'Links Google auth to an existing active employee account.';
