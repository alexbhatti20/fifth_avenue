-- =============================================
-- LEAVE MANAGEMENT SYSTEM - SSR COMPATIBLE
-- Tables, RPCs, and Policies for Leave Requests
-- All RPCs accept employee_id parameter for SSR authentication
-- =============================================

-- =============================================
-- 1. CREATE LEAVE_REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  leave_type character varying NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'emergency', 'unpaid', 'maternity', 'paternity', 'other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days integer NOT NULL,
  reason text NOT NULL,
  status character varying DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.employees(id),
  CONSTRAINT leave_requests_valid_dates CHECK (end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- =============================================
-- 2. CREATE LEAVE_BALANCES TABLE (Track annual leave balance)
-- =============================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL UNIQUE,
  annual_leave integer DEFAULT 14,
  sick_leave integer DEFAULT 10,
  casual_leave integer DEFAULT 5,
  annual_used integer DEFAULT 0,
  sick_used integer DEFAULT 0,
  casual_used integer DEFAULT 0,
  year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON public.leave_balances(employee_id);

-- =============================================
-- DROP OLD FUNCTION SIGNATURES
-- =============================================
DROP FUNCTION IF EXISTS create_leave_request(character varying, date, date, text);
DROP FUNCTION IF EXISTS create_leave_request(uuid, character varying, date, date, text);
DROP FUNCTION IF EXISTS get_my_leave_requests(integer, integer);
DROP FUNCTION IF EXISTS get_my_leave_requests(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_all_leave_requests(character varying, integer, integer);
DROP FUNCTION IF EXISTS get_all_leave_requests(uuid, character varying, integer, integer);
DROP FUNCTION IF EXISTS review_leave_request(uuid, character varying, text);
DROP FUNCTION IF EXISTS review_leave_request(uuid, uuid, character varying, text);
DROP FUNCTION IF EXISTS get_leave_balance();
DROP FUNCTION IF EXISTS get_leave_balance(uuid);
DROP FUNCTION IF EXISTS get_employee_leave_details(uuid);
DROP FUNCTION IF EXISTS get_employee_leave_details(uuid, uuid);
DROP FUNCTION IF EXISTS get_attendance_summary_by_employee(integer, integer);
DROP FUNCTION IF EXISTS get_attendance_summary_by_employee(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_absent_employees_today();
DROP FUNCTION IF EXISTS get_absent_employees_today(uuid);
DROP FUNCTION IF EXISTS cancel_leave_request(uuid);
DROP FUNCTION IF EXISTS cancel_leave_request(uuid, uuid);
DROP FUNCTION IF EXISTS get_pending_leave_count();
DROP FUNCTION IF EXISTS get_pending_leave_count(uuid);

-- Helper: Get employee ID from parameter or auth
CREATE OR REPLACE FUNCTION resolve_employee_id(p_employee_id UUID DEFAULT NULL)
RETURNS UUID AS $$
BEGIN
  IF p_employee_id IS NOT NULL THEN
    RETURN p_employee_id;
  END IF;
  RETURN get_employee_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if caller is manager/admin (SSR compatible)
CREATE OR REPLACE FUNCTION check_manager_or_admin(p_caller_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  caller_id UUID;
  caller_role VARCHAR;
BEGIN
  caller_id := COALESCE(p_caller_id, get_employee_id());
  IF caller_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT role INTO caller_role FROM employees WHERE id = caller_id AND status = 'active';
  RETURN caller_role IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. CREATE LEAVE REQUEST (For Employees)
-- =============================================
CREATE OR REPLACE FUNCTION create_leave_request(
  p_leave_type VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  emp_id UUID;
  emp_status VARCHAR;
  total_days INTEGER;
  balance_record RECORD;
  leave_available INTEGER;
  new_request RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check employee status
  SELECT status INTO emp_status FROM employees WHERE id = emp_id;
  IF emp_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Your account is not active');
  END IF;
  
  -- Validate dates
  IF p_start_date < CURRENT_DATE THEN
    RETURN json_build_object('success', false, 'error', 'Start date cannot be in the past');
  END IF;
  
  IF p_end_date < p_start_date THEN
    RETURN json_build_object('success', false, 'error', 'End date must be after start date');
  END IF;
  
  -- Calculate total days (excluding weekends optionally)
  total_days := (p_end_date - p_start_date) + 1;
  
  -- Check for overlapping requests
  IF EXISTS (
    SELECT 1 FROM leave_requests
    WHERE employee_id = emp_id
    AND status IN ('pending', 'approved')
    AND (
      (p_start_date BETWEEN start_date AND end_date)
      OR (p_end_date BETWEEN start_date AND end_date)
      OR (start_date BETWEEN p_start_date AND p_end_date)
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have an overlapping leave request');
  END IF;
  
  -- Check leave balance for certain types
  IF p_leave_type IN ('annual', 'sick', 'casual') THEN
    SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
    
    IF balance_record IS NULL THEN
      -- Create default balance
      INSERT INTO leave_balances (employee_id) VALUES (emp_id)
      RETURNING * INTO balance_record;
    END IF;
    
    -- Check available balance
    CASE p_leave_type
      WHEN 'annual' THEN leave_available := balance_record.annual_leave - balance_record.annual_used;
      WHEN 'sick' THEN leave_available := balance_record.sick_leave - balance_record.sick_used;
      WHEN 'casual' THEN leave_available := balance_record.casual_leave - balance_record.casual_used;
      ELSE leave_available := 999;
    END CASE;
    
    IF total_days > leave_available THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Insufficient %s leave balance. Available: %s days', p_leave_type, leave_available)
      );
    END IF;
  END IF;
  
  -- Create the request
  INSERT INTO leave_requests (
    employee_id,
    leave_type,
    start_date,
    end_date,
    total_days,
    reason,
    status
  ) VALUES (
    emp_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    total_days,
    p_reason,
    'pending'
  )
  RETURNING * INTO new_request;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Leave request submitted successfully',
    'request', row_to_json(new_request)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_leave_request IS 'Create a new leave request - for employees';

-- =============================================
-- 4. GET MY LEAVE REQUESTS (For Employees)
-- =============================================
CREATE OR REPLACE FUNCTION get_my_leave_requests(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
  emp_id UUID;
  result JSON;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', lr.id,
        'leave_type', lr.leave_type,
        'start_date', lr.start_date,
        'end_date', lr.end_date,
        'total_days', lr.total_days,
        'reason', lr.reason,
        'status', lr.status,
        'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at,
        'review_notes', lr.review_notes,
        'created_at', lr.created_at,
        'reviewer', CASE WHEN r.id IS NOT NULL THEN
          json_build_object('id', r.id, 'name', r.name, 'role', r.role)
        ELSE NULL END
      ) ORDER BY lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE lr.employee_id = emp_id
  AND EXTRACT(YEAR FROM lr.start_date) = p_year
  LIMIT p_limit;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. GET ALL LEAVE REQUESTS (Admin/Manager)
-- =============================================
CREATE OR REPLACE FUNCTION get_all_leave_requests(
  p_status VARCHAR DEFAULT NULL,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_month INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', lr.id,
        'employee_id', lr.employee_id,
        'leave_type', lr.leave_type,
        'start_date', lr.start_date,
        'end_date', lr.end_date,
        'total_days', lr.total_days,
        'reason', lr.reason,
        'status', lr.status,
        'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at,
        'review_notes', lr.review_notes,
        'created_at', lr.created_at,
        'employee', json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'name', e.name,
          'email', e.email,
          'phone', e.phone,
          'role', e.role,
          'avatar_url', e.avatar_url
        ),
        'reviewer', CASE WHEN r.id IS NOT NULL THEN
          json_build_object('id', r.id, 'name', r.name, 'role', r.role)
        ELSE NULL END
      ) ORDER BY 
        CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END,
        lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  INNER JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE EXTRACT(YEAR FROM lr.start_date) = p_year
  AND (p_status IS NULL OR lr.status = p_status)
  AND (p_month IS NULL OR EXTRACT(MONTH FROM lr.start_date) = p_month);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_all_leave_requests IS 'Get all leave requests - admin/manager only';

-- =============================================
-- 6. REVIEW LEAVE REQUEST (Approve/Reject)
-- =============================================
CREATE OR REPLACE FUNCTION review_leave_request(
  p_request_id UUID,
  p_status VARCHAR,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  reviewer_id UUID;
  request_record RECORD;
  emp_record RECORD;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  reviewer_id := get_employee_id();
  
  -- Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status. Use approved or rejected');
  END IF;
  
  -- Get the request
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id;
  
  IF request_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'This request has already been reviewed');
  END IF;
  
  -- Update the request
  UPDATE leave_requests
  SET status = p_status,
      reviewed_by = reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_request_id;
  
  -- If approved, update leave balance
  IF p_status = 'approved' AND request_record.leave_type IN ('annual', 'sick', 'casual') THEN
    UPDATE leave_balances
    SET 
      annual_used = CASE WHEN request_record.leave_type = 'annual' THEN annual_used + request_record.total_days ELSE annual_used END,
      sick_used = CASE WHEN request_record.leave_type = 'sick' THEN sick_used + request_record.total_days ELSE sick_used END,
      casual_used = CASE WHEN request_record.leave_type = 'casual' THEN casual_used + request_record.total_days ELSE casual_used END,
      updated_at = NOW()
    WHERE employee_id = request_record.employee_id;
    
    -- Also mark attendance as on_leave for approved dates
    INSERT INTO attendance (employee_id, date, status, notes)
    SELECT 
      request_record.employee_id,
      d::date,
      'on_leave',
      format('%s leave', request_record.leave_type)
    FROM generate_series(request_record.start_date, request_record.end_date, '1 day'::interval) d
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = EXCLUDED.notes;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', format('Leave request %s successfully', p_status)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION review_leave_request IS 'Approve or reject a leave request - admin/manager only';

-- =============================================
-- 7. GET LEAVE BALANCE (For Employee)
-- =============================================
CREATE OR REPLACE FUNCTION get_leave_balance()
RETURNS JSON AS $$
DECLARE
  emp_id UUID;
  balance_record RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
  
  IF balance_record IS NULL THEN
    -- Create default balance
    INSERT INTO leave_balances (employee_id) VALUES (emp_id)
    RETURNING * INTO balance_record;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'balance', json_build_object(
      'annual', json_build_object(
        'total', balance_record.annual_leave,
        'used', balance_record.annual_used,
        'available', balance_record.annual_leave - balance_record.annual_used
      ),
      'sick', json_build_object(
        'total', balance_record.sick_leave,
        'used', balance_record.sick_used,
        'available', balance_record.sick_leave - balance_record.sick_used
      ),
      'casual', json_build_object(
        'total', balance_record.casual_leave,
        'used', balance_record.casual_used,
        'available', balance_record.casual_leave - balance_record.casual_used
      ),
      'year', balance_record.year
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 8. GET EMPLOYEE LEAVE DETAILS (Admin/Manager)
-- =============================================
CREATE OR REPLACE FUNCTION get_employee_leave_details(
  p_employee_id UUID
)
RETURNS JSON AS $$
DECLARE
  balance_record RECORD;
  emp_record RECORD;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Get employee info
  SELECT * INTO emp_record FROM employees WHERE id = p_employee_id;
  IF emp_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  -- Get or create balance
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = p_employee_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (p_employee_id)
    RETURNING * INTO balance_record;
  END IF;
  
  -- Build complete response
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', emp_record.id,
      'employee_id', emp_record.employee_id,
      'name', emp_record.name,
      'role', emp_record.role,
      'avatar_url', emp_record.avatar_url
    ),
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used)
    ),
    'requests', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', id,
          'leave_type', leave_type,
          'start_date', start_date,
          'end_date', end_date,
          'total_days', total_days,
          'status', status,
          'created_at', created_at
        ) ORDER BY created_at DESC
      )
      FROM leave_requests
      WHERE employee_id = p_employee_id
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. GET ATTENDANCE SUMMARY BY EMPLOYEE (Admin/Manager)
-- =============================================
CREATE OR REPLACE FUNCTION get_attendance_summary_by_employee(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS JSON AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + INTERVAL '1 month')::DATE;
  
  SELECT json_build_object(
    'success', true,
    'month', to_char(start_date, 'YYYY-MM'),
    'summary', COALESCE(json_agg(
      json_build_object(
        'employee', json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'name', e.name,
          'role', e.role,
          'avatar_url', e.avatar_url
        ),
        'present_days', COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
        'late_days', COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0),
        'absent_days', COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0),
        'leave_days', COALESCE(SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END), 0),
        'half_days', COALESCE(SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END), 0),
        'total_hours', COALESCE(ROUND(SUM(
          EXTRACT(EPOCH FROM (COALESCE(a.check_out, NOW()) - a.check_in)) / 3600
        )::NUMERIC, 1), 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  LEFT JOIN attendance a ON a.employee_id = e.id 
    AND a.date >= start_date 
    AND a.date < end_date
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_id, e.name, e.role, e.avatar_url
  ORDER BY e.name;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_attendance_summary_by_employee IS 'Get monthly attendance summary per employee - admin/manager';

-- =============================================
-- 10. GET ABSENT EMPLOYEES TODAY (Admin/Manager)
-- =============================================
CREATE OR REPLACE FUNCTION get_absent_employees_today()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'date', CURRENT_DATE,
    'absent_employees', COALESCE(json_agg(
      json_build_object(
        'id', e.id,
        'employee_id', e.employee_id,
        'name', e.name,
        'role', e.role,
        'email', e.email,
        'phone', e.phone,
        'avatar_url', e.avatar_url,
        'hired_date', e.hired_date
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  WHERE e.status = 'active'
  AND e.role != 'admin' -- Admin doesn't need attendance
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.employee_id = e.id
    AND a.date = CURRENT_DATE
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_absent_employees_today IS 'Get list of absent employees today - admin/manager';

-- =============================================
-- 11. CANCEL LEAVE REQUEST (For Employee)
-- =============================================
CREATE OR REPLACE FUNCTION cancel_leave_request(
  p_request_id UUID
)
RETURNS JSON AS $$
DECLARE
  emp_id UUID;
  request_record RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get and validate request
  SELECT * INTO request_record FROM leave_requests 
  WHERE id = p_request_id AND employee_id = emp_id;
  
  IF request_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Can only cancel pending requests');
  END IF;
  
  UPDATE leave_requests
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN json_build_object('success', true, 'message', 'Leave request cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 12. GET PENDING LEAVE COUNT (Admin/Manager)
-- =============================================
CREATE OR REPLACE FUNCTION get_pending_leave_count()
RETURNS JSON AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'pending_count', (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ADD UNIQUE CONSTRAINT FOR ATTENDANCE
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_employee_date_unique'
  ) THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_employee_date_unique UNIQUE (employee_id, date);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- GRANTS
-- =============================================
GRANT EXECUTE ON FUNCTION create_leave_request(VARCHAR, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_leave_requests(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_leave_requests(VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION review_leave_request(UUID, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_leave_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_attendance_summary_by_employee(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_absent_employees_today() TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_leave_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_leave_count() TO authenticated;

-- RLS Policies
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Employees can view their own leave requests
DROP POLICY IF EXISTS "Employees view own leave requests" ON leave_requests;
CREATE POLICY "Employees view own leave requests" ON leave_requests
  FOR SELECT USING (
    employee_id = get_employee_id() 
    OR is_manager_or_admin()
  );

-- Employees can insert their own leave requests
DROP POLICY IF EXISTS "Employees insert own leave requests" ON leave_requests;
CREATE POLICY "Employees insert own leave requests" ON leave_requests
  FOR INSERT WITH CHECK (employee_id = get_employee_id());

-- Only managers/admins can update leave requests (for approval)
DROP POLICY IF EXISTS "Managers update leave requests" ON leave_requests;
CREATE POLICY "Managers update leave requests" ON leave_requests
  FOR UPDATE USING (
    (employee_id = get_employee_id() AND status = 'pending') -- Employee can cancel own pending
    OR is_manager_or_admin()
  );

-- Leave balances policies
DROP POLICY IF EXISTS "View own leave balance" ON leave_balances;
CREATE POLICY "View own leave balance" ON leave_balances
  FOR SELECT USING (
    employee_id = get_employee_id() 
    OR is_manager_or_admin()
  );

DROP POLICY IF EXISTS "Managers update leave balances" ON leave_balances;
CREATE POLICY "Managers update leave balances" ON leave_balances
  FOR ALL USING (is_manager_or_admin());
