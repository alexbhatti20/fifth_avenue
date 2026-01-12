-- Password Reset OTP Table
-- This table stores OTPs for password reset functionality
-- Note: Primary OTP storage is done via Redis for performance,
-- but this table can be used as a backup/audit trail

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  otp_hash character varying NOT NULL,  -- Store hashed OTP for security
  purpose character varying DEFAULT 'password_reset'::character varying,
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id)
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access this table (for security)
CREATE POLICY "Service role only" ON public.password_reset_otps
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Function to clean up expired OTPs (run periodically via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_password_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_reset_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Password reset rate limit tracking table
CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  attempt_count integer DEFAULT 1,
  first_attempt_at timestamp with time zone DEFAULT now(),
  last_attempt_at timestamp with time zone DEFAULT now(),
  cooldown_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_rate_limits_email_key UNIQUE (email)
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_email ON public.password_reset_rate_limits(email);

-- Enable RLS
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access this table
CREATE POLICY "Service role only" ON public.password_reset_rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION check_password_reset_rate_limit(
  p_email TEXT,
  p_max_attempts INTEGER DEFAULT 3,
  p_cooldown_hours INTEGER DEFAULT 2
)
RETURNS JSON AS $$
DECLARE
  v_record RECORD;
  v_result JSON;
BEGIN
  -- Get existing rate limit record
  SELECT * INTO v_record
  FROM public.password_reset_rate_limits
  WHERE email = LOWER(p_email);

  -- If no record exists, create one and allow
  IF NOT FOUND THEN
    INSERT INTO public.password_reset_rate_limits (email, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (LOWER(p_email), 1, NOW(), NOW());
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;

  -- Check if in cooldown period
  IF v_record.cooldown_until IS NOT NULL AND v_record.cooldown_until > NOW() THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'cooldown_until', v_record.cooldown_until,
      'remaining_minutes', EXTRACT(EPOCH FROM (v_record.cooldown_until - NOW())) / 60
    );
  END IF;

  -- Reset if first attempt was more than cooldown period ago
  IF v_record.first_attempt_at < NOW() - (p_cooldown_hours || ' hours')::INTERVAL THEN
    UPDATE public.password_reset_rate_limits
    SET attempt_count = 1,
        first_attempt_at = NOW(),
        last_attempt_at = NOW(),
        cooldown_until = NULL
    WHERE email = LOWER(p_email);
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;

  -- Check if max attempts reached
  IF v_record.attempt_count >= p_max_attempts THEN
    -- Set cooldown
    UPDATE public.password_reset_rate_limits
    SET cooldown_until = NOW() + (p_cooldown_hours || ' hours')::INTERVAL
    WHERE email = LOWER(p_email);
    
    RETURN json_build_object(
      'allowed', false,
      'reason', 'max_attempts',
      'cooldown_until', NOW() + (p_cooldown_hours || ' hours')::INTERVAL,
      'remaining_minutes', p_cooldown_hours * 60
    );
  END IF;

  -- Increment attempts
  UPDATE public.password_reset_rate_limits
  SET attempt_count = attempt_count + 1,
      last_attempt_at = NOW()
  WHERE email = LOWER(p_email);
  
  RETURN json_build_object(
    'allowed', true,
    'attempts', v_record.attempt_count + 1,
    'remaining', p_max_attempts - v_record.attempt_count - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_password_reset_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_password_reset_rate_limit TO service_role;

COMMENT ON TABLE public.password_reset_otps IS 'Stores password reset OTPs (primary storage in Redis, this is for audit)';
COMMENT ON TABLE public.password_reset_rate_limits IS 'Tracks rate limits for password reset attempts';
COMMENT ON FUNCTION check_password_reset_rate_limit IS 'Checks and updates rate limit for password reset, returns JSON with allowed status';
