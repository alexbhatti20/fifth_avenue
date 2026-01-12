-- Password Reset RPC Functions
-- Provides secure password reset functionality with proper error handling

-- Function to reset password for a customer
-- This function is called after OTP verification
CREATE OR REPLACE FUNCTION reset_customer_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_auth_user RECORD;
  v_auth_user_id UUID;
  v_error_message TEXT;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Validate input
  IF p_email IS NULL OR p_email = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email is required'
    );
  END IF;
  
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 8 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Password must be at least 8 characters'
    );
  END IF;
  
  -- Get user details (check customers first, then employees)
  SELECT id, auth_user_id, name, email
  INTO v_customer
  FROM public.customers
  WHERE email = p_email;
  
  -- If not found in customers, check employees
  IF NOT FOUND THEN
    SELECT id, auth_user_id, name, email
    INTO v_customer
    FROM public.employees
    WHERE email = p_email;
  END IF;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Account not found with this email'
    );
  END IF;
  
  -- Check if user has auth_user_id
  IF v_customer.auth_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Account not properly configured. Please contact support.'
    );
  END IF;
  
  -- Cast auth_user_id to UUID
  BEGIN
    v_auth_user_id := v_customer.auth_user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid auth user ID');
  END;
  
  -- Verify the auth user exists and is valid
  SELECT id, email, email_confirmed_at, banned_until, deleted_at
  INTO v_auth_user
  FROM auth.users
  WHERE id::text = v_auth_user_id::text;
  
  -- Check if auth user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication account not found. Please contact support.',
      'code', 'AUTH_USER_NOT_FOUND'
    );
  END IF;
  
  -- Check if user is deleted
  IF v_auth_user.deleted_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This account has been deleted. Please contact support.',
      'code', 'AUTH_USER_DELETED'
    );
  END IF;
  
  -- Check if user is banned
  IF v_auth_user.banned_until IS NOT NULL AND v_auth_user.banned_until > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This account has been suspended. Please contact support.',
      'code', 'AUTH_USER_BANNED'
    );
  END IF;
  
  -- Return success with user info for the API to use
  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'auth_user_id', v_customer.auth_user_id,
    'email', v_customer.email,
    'name', v_customer.name,
    'auth_email', v_auth_user.email,
    'email_confirmed', v_auth_user.email_confirmed_at IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to process password reset: ' || v_error_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate password reset session
CREATE OR REPLACE FUNCTION validate_password_reset_session(
  p_email TEXT,
  p_token TEXT
)
RETURNS JSON AS $$
DECLARE
  v_otp_record RECORD;
  v_result JSON;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get the most recent verified OTP for this email
  SELECT *
  INTO v_otp_record
  FROM public.password_reset_otps
  WHERE email = p_email
    AND is_verified = true
    AND expires_at > NOW()
  ORDER BY verified_at DESC
  LIMIT 1;
  
  -- Check if valid session exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'No valid session found'
    );
  END IF;
  
  -- Return validation result
  RETURN json_build_object(
    'valid', true,
    'email', v_otp_record.email,
    'verified_at', v_otp_record.verified_at,
    'expires_at', v_otp_record.expires_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Session validation failed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log password reset completion
CREATE OR REPLACE FUNCTION log_password_reset_completion(
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Mark all OTPs for this email as used/expired
  UPDATE public.password_reset_otps
  SET is_verified = false
  WHERE email = p_email;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Password reset completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to log password reset completion'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fix broken auth_user_id references
-- This creates a new auth user if the old one is missing or invalid
CREATE OR REPLACE FUNCTION fix_customer_auth_user(
  p_customer_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_auth_user RECORD;
  v_auth_user_id UUID;
  v_error_message TEXT;
BEGIN
  -- Get customer details
  SELECT id, auth_user_id, name, email, phone
  INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id;
  
  -- Check if customer exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;
  
  -- Check if auth user exists
  IF v_customer.auth_user_id IS NOT NULL THEN
    -- Cast to UUID safely
    BEGIN
      v_auth_user_id := v_customer.auth_user_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'Invalid auth user ID format');
    END;
    
    SELECT id INTO v_auth_user
    FROM auth.users
    WHERE id::text = v_auth_user_id::text
      AND deleted_at IS NULL;
    
    -- If auth user exists and is valid, no fix needed
    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'message', 'Auth user is valid, no fix needed',
        'auth_user_id', v_customer.auth_user_id
      );
    END IF;
  END IF;
  
  -- At this point, either auth_user_id is null or points to invalid/deleted user
  RETURN json_build_object(
    'success', false,
    'error', 'Auth user is invalid. Please re-register or contact support.',
    'code', 'REQUIRES_REREGISTRATION',
    'customer_email', v_customer.email
  );
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to fix auth user: ' || v_error_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE PASSWORD IN SUPABASE AUTH (Simple & Direct)
-- Updates password directly in Supabase's auth.users table
-- No separate password storage - uses Supabase authentication
-- =====================================================
DROP FUNCTION IF EXISTS update_user_password_hash(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_user_password(TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_user_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_auth_user_id_text TEXT;
  v_auth_user_id UUID;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get auth_user_id (check customers first, then employees)
  SELECT c.auth_user_id INTO v_auth_user_id_text
  FROM public.customers c
  WHERE c.email = p_email;
  
  IF v_auth_user_id_text IS NULL THEN
    SELECT e.auth_user_id INTO v_auth_user_id_text
    FROM public.employees e
    WHERE e.email = p_email;
  END IF;
  
  IF v_auth_user_id_text IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Account not found with this email');
  END IF;
  
  -- Cast to UUID
  BEGIN
    v_auth_user_id := v_auth_user_id_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid auth user ID format');
  END;
  
  -- Update password directly in Supabase auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id::text = v_auth_user_id::text;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Auth user not found');
  END IF;
  
  -- Clear sessions (force re-login)
  DELETE FROM auth.sessions WHERE user_id::text = v_auth_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = v_auth_user_id::text;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_customer_password TO service_role;
GRANT EXECUTE ON FUNCTION reset_customer_password TO anon;
GRANT EXECUTE ON FUNCTION validate_password_reset_session TO service_role;
GRANT EXECUTE ON FUNCTION validate_password_reset_session TO anon;
GRANT EXECUTE ON FUNCTION log_password_reset_completion TO service_role;
GRANT EXECUTE ON FUNCTION log_password_reset_completion TO anon;
GRANT EXECUTE ON FUNCTION fix_customer_auth_user TO service_role;
GRANT EXECUTE ON FUNCTION update_user_password TO anon;
GRANT EXECUTE ON FUNCTION update_user_password TO authenticated;

-- Comments
COMMENT ON FUNCTION reset_customer_password IS 'Validates customer and auth user, prepares for password reset';
COMMENT ON FUNCTION validate_password_reset_session IS 'Validates password reset session from database';
COMMENT ON FUNCTION log_password_reset_completion IS 'Logs successful password reset completion';
COMMENT ON FUNCTION fix_customer_auth_user IS 'Checks and reports status of customer auth user reference';
COMMENT ON FUNCTION update_user_password IS 'Updates password in Supabase auth.users after OTP verification';
