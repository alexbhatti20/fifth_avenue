-- =========================================
-- ADVANCED EMPLOYEE MANAGEMENT RPC FUNCTIONS
-- Ultra-optimized for fast queries, minimal API calls
-- All CRUD operations with documents & images
-- Created: January 2026
-- =========================================

-- =========================================
-- DROP ALL EXISTING FUNCTIONS
-- =========================================
DROP FUNCTION IF EXISTS get_employees_paginated(INTEGER, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_employees_with_stats();
DROP FUNCTION IF EXISTS get_employee_complete(UUID);
DROP FUNCTION IF EXISTS get_employee_full_details(UUID);
DROP FUNCTION IF EXISTS get_employee_with_documents(UUID);
DROP FUNCTION IF EXISTS search_employees(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_employees_advanced(TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_employees_by_role(TEXT);
DROP FUNCTION IF EXISTS toggle_employee_portal_access(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS update_employee_status(UUID, TEXT);
DROP FUNCTION IF EXISTS get_employee_attendance_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_active_employees_count();
DROP FUNCTION IF EXISTS create_employee_with_license(JSONB, TEXT);
DROP FUNCTION IF EXISTS create_employee_inactive(JSONB);
DROP FUNCTION IF EXISTS update_employee_complete(UUID, JSONB);
DROP FUNCTION IF EXISTS delete_employee_cascade(UUID);
DROP FUNCTION IF EXISTS block_employee(UUID, TEXT);
DROP FUNCTION IF EXISTS unblock_employee(UUID);
DROP FUNCTION IF EXISTS add_employee_document(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS remove_employee_document(UUID, UUID);
DROP FUNCTION IF EXISTS update_employee_avatar(UUID, TEXT);
DROP FUNCTION IF EXISTS get_employees_dashboard_stats();
DROP FUNCTION IF EXISTS bulk_update_employee_status(UUID[], TEXT);
DROP FUNCTION IF EXISTS get_employee_payroll_summary(UUID);

-- =========================================
-- CUSTOM TYPES FOR EMPLOYEE RESPONSES
-- =========================================
DROP TYPE IF EXISTS employee_list_item CASCADE;
CREATE TYPE employee_list_item AS (
  id UUID,
  employee_id TEXT,
  license_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  avatar_url TEXT,
  portal_enabled BOOLEAN,
  hired_date DATE,
  salary NUMERIC,
  total_tips NUMERIC,
  total_orders_taken INTEGER,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  attendance_this_month INTEGER,
  documents_count INTEGER
);

DROP TYPE IF EXISTS employee_complete CASCADE;
CREATE TYPE employee_complete AS (
  -- Core data
  id UUID,
  employee_id TEXT,
  auth_user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  avatar_url TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_contact_name TEXT,
  date_of_birth DATE,
  blood_group TEXT,
  hired_date DATE,
  portal_enabled BOOLEAN,
  permissions JSONB,
  notes TEXT,
  -- License
  license_id TEXT,
  license_activated BOOLEAN,
  license_expires TIMESTAMPTZ,
  -- Payroll
  salary NUMERIC,
  bank_details JSONB,
  total_tips NUMERIC,
  total_orders_taken INTEGER,
  -- Documents as JSONB array
  documents JSONB,
  -- Stats
  last_login TIMESTAMPTZ,
  attendance_this_month INTEGER,
  total_attendance INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- =========================================
-- 1. GET EMPLOYEES PAGINATED (OPTIMIZED LIST)
-- Returns paginated employees with computed stats
-- Single query with all needed data - NO extra API calls
-- =========================================
CREATE OR REPLACE FUNCTION get_employees_paginated(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  employees JSONB,
  total_count INTEGER,
  page INTEGER,
  total_pages INTEGER,
  has_next BOOLEAN,
  has_prev BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_employees JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Get total count first (for pagination)
  SELECT COUNT(*)::INTEGER INTO v_total
  FROM employees e
  WHERE 
    (p_search IS NULL OR p_search = '' OR 
      e.name ILIKE '%' || p_search || '%' OR
      e.email ILIKE '%' || p_search || '%' OR
      e.employee_id ILIKE '%' || p_search || '%' OR
      e.phone ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
    AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status);

  -- Get employees with all data in single query
  SELECT COALESCE(jsonb_agg(emp ORDER BY emp->>'created_at' DESC), '[]'::JSONB) INTO v_employees
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'employee_id', e.employee_id,
      'license_id', el.license_id,
      'name', e.name,
      'email', e.email,
      'phone', e.phone,
      'role', e.role::TEXT,
      'status', e.status::TEXT,
      'avatar_url', e.avatar_url,
      'portal_enabled', e.portal_enabled,
      'hired_date', e.hired_date,
      'salary', e.salary,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'last_login', e.last_login,
      'created_at', e.created_at,
      'attendance_this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.check_in) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'documents_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM employee_documents ed 
        WHERE ed.employee_id = e.id
      ), 0)
    ) as emp
    FROM employees e
    LEFT JOIN employee_licenses el ON el.employee_id = e.id
    WHERE 
      (p_search IS NULL OR p_search = '' OR 
        e.name ILIKE '%' || p_search || '%' OR
        e.email ILIKE '%' || p_search || '%' OR
        e.employee_id ILIKE '%' || p_search || '%' OR
        e.phone ILIKE '%' || p_search || '%')
      AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
      AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status)
    ORDER BY e.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) sub;

  RETURN QUERY SELECT 
    v_employees,
    v_total,
    p_page,
    CEIL(v_total::NUMERIC / p_limit)::INTEGER,
    (p_page * p_limit) < v_total,
    p_page > 1;
END;
$$;

-- =========================================
-- 2. GET EMPLOYEE COMPLETE (SINGLE CALL - ALL DATA)
-- Returns employee with documents, license, payroll - EVERYTHING
-- Avoids multiple API calls
-- =========================================
CREATE OR REPLACE FUNCTION get_employee_complete(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    -- Core employee data
    'id', e.id,
    'employee_id', e.employee_id,
    'auth_user_id', e.auth_user_id,
    'name', e.name,
    'email', e.email,
    'phone', e.phone,
    'role', e.role::TEXT,
    'status', e.status::TEXT,
    'avatar_url', e.avatar_url,
    'address', e.address,
    'emergency_contact', e.emergency_contact,
    'emergency_contact_name', e.emergency_contact_name,
    'date_of_birth', e.date_of_birth,
    'blood_group', e.blood_group,
    'hired_date', e.hired_date,
    'portal_enabled', e.portal_enabled,
    'permissions', e.permissions,
    'notes', e.notes,
    'last_login', e.last_login,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'created_by', e.created_by,
    'is_2fa_enabled', e.is_2fa_enabled,
    'license_id', e.license_id,
    'salary', e.salary,
    'total_tips', e.total_tips,
    'total_orders_taken', e.total_orders_taken,
    'bank_details', e.bank_details,
    'documents', e.documents,
    -- License info (from employee_licenses table)
    'license', (
      SELECT jsonb_build_object(
        'id', el.id,
        'license_id', el.license_id,
        'is_used', el.is_used,
        'activated_at', el.activated_at,
        'expires_at', el.expires_at,
        'issued_at', el.issued_at,
        'is_active', CASE 
          WHEN el.expires_at IS NULL THEN true
          WHEN el.expires_at > NOW() THEN true
          ELSE false
        END
      )
      FROM employee_licenses el
      WHERE el.employee_id = e.id
      ORDER BY el.issued_at DESC
      LIMIT 1
    ),
    -- Payroll info
    'payroll', jsonb_build_object(
      'salary', e.salary,
      'bank_details', e.bank_details,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'latest_payroll', (
        SELECT jsonb_build_object(
          'id', ep.id,
          'month', ep.month,
          'year', ep.year,
          'base_salary', ep.base_salary,
          'bonus', ep.bonus,
          'deductions', ep.deductions,
          'tips', ep.tips,
          'total_amount', ep.total_amount,
          'paid', ep.paid,
          'paid_at', ep.paid_at,
          'paid_by', ep.paid_by,
          'notes', ep.notes
        )
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id
        ORDER BY ep.year DESC, ep.month DESC
        LIMIT 1
      ),
      'pending_amount', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = false
      ), 0),
      'total_paid', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = true
      ), 0)
    ),
    -- Documents array (from employee_documents table)
    'employee_documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'document_type', ed.document_type,
        'document_name', ed.document_name,
        'file_url', ed.file_url,
        'file_type', ed.file_type,
        'uploaded_at', ed.uploaded_at,
        'verified', ed.verified,
        'verified_at', ed.verified_at,
        'verified_by', ed.verified_by
      ) ORDER BY ed.uploaded_at DESC)
      FROM employee_documents ed
      WHERE ed.employee_id = e.id
    ), '[]'::JSONB),
    -- Attendance stats
    'attendance_stats', jsonb_build_object(
      'this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'last_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ), 0),
      'total', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id
      ), 0),
      'late_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id AND a.status = 'late'
      ), 0),
      'last_check_in', (
        SELECT a.check_in FROM attendance a
        WHERE a.employee_id = e.id
        ORDER BY a.date DESC
        LIMIT 1
      )
    ),
    -- Recent attendance records
    'recent_attendance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'date', a.date,
        'check_in', a.check_in,
        'check_out', a.check_out,
        'status', a.status,
        'notes', a.notes
      ) ORDER BY a.date DESC)
      FROM (
        SELECT * FROM attendance 
        WHERE employee_id = e.id 
        ORDER BY date DESC 
        LIMIT 10
      ) a
    ), '[]'::JSONB)
  ) INTO v_result
  FROM employees e
  WHERE e.id = p_employee_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee not found', 'success', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- =========================================
-- 3. CREATE EMPLOYEE INACTIVE (DEFAULT STATE)
-- Creates employee with 'inactive' status pending activation
-- Returns employee_id, license_id, and all details
-- =========================================
CREATE OR REPLACE FUNCTION create_employee_inactive(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id TEXT;
  v_license_id TEXT;
  v_new_employee_uuid UUID;
  v_role TEXT;
BEGIN
  -- Validate required fields
  IF p_data->>'name' IS NULL OR p_data->>'email' IS NULL OR p_data->>'phone' IS NULL OR p_data->>'role' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required fields: name, email, phone, role');
  END IF;

  -- Check for duplicate email
  IF EXISTS (SELECT 1 FROM employees WHERE email = p_data->>'email') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists');
  END IF;

  -- Check for duplicate phone
  IF EXISTS (SELECT 1 FROM employees WHERE phone = p_data->>'phone') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone number already exists');
  END IF;

  v_role := p_data->>'role';

  -- Generate unique employee ID based on role
  v_employee_id := CASE v_role
    WHEN 'admin' THEN 'ADM-'
    WHEN 'manager' THEN 'MGR-'
    WHEN 'waiter' THEN 'WTR-'
    WHEN 'billing_staff' THEN 'BIL-'
    WHEN 'kitchen_staff' THEN 'KIT-'
    WHEN 'delivery_rider' THEN 'DLR-'
    ELSE 'STF-'
  END || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

  -- Generate license ID
  v_license_id := 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4));

  -- Insert employee with INACTIVE status (pending activation)
  INSERT INTO employees (
    employee_id,
    name,
    email,
    phone,
    role,
    status,
    portal_enabled,
    salary,
    hired_date,
    address,
    emergency_contact,
    emergency_contact_name,
    date_of_birth,
    blood_group,
    permissions,
    bank_details,
    notes,
    license_id,
    avatar_url
  ) VALUES (
    v_employee_id,
    p_data->>'name',
    p_data->>'email',
    p_data->>'phone',
    (p_data->>'role')::employee_role,
    'inactive'::employee_status,  -- INACTIVE by default
    COALESCE((p_data->>'portal_enabled')::BOOLEAN, false),  -- Portal disabled by default
    COALESCE((p_data->>'salary')::NUMERIC, 0),
    COALESCE((p_data->>'hired_date')::DATE, CURRENT_DATE),
    p_data->>'address',
    p_data->>'emergency_contact',
    p_data->>'emergency_contact_name',
    (p_data->>'date_of_birth')::DATE,
    p_data->>'blood_group',
    COALESCE((p_data->'permissions')::JSONB, '{}'::JSONB),
    COALESCE((p_data->'bank_details')::JSONB, '{}'::JSONB),
    p_data->>'notes',
    v_license_id,
    p_data->>'avatar_url'
  )
  RETURNING id INTO v_new_employee_uuid;

  -- Create license record
  INSERT INTO employee_licenses (
    employee_id,
    license_id,
    is_used,
    expires_at
  ) VALUES (
    v_new_employee_uuid,
    v_license_id,
    false,
    NOW() + INTERVAL '7 days'  -- License valid for 7 days
  );

  -- Log creation in audit
  INSERT INTO audit_logs (action, table_name, record_id, new_data)
  VALUES ('create_employee', 'employees', v_new_employee_uuid, p_data);

  -- Return complete employee data
  RETURN jsonb_build_object(
    'success', true,
    'employee_id', v_employee_id,
    'id', v_new_employee_uuid,
    'license_id', v_license_id,
    'status', 'inactive',
    'message', 'Employee created with inactive status. Send activation email to enable portal access.'
  );

EXCEPTION 
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee ID, email or phone already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 4. UPDATE EMPLOYEE COMPLETE (ALL FIELDS IN ONE CALL)
-- Updates employee with all details, avatar, bank info
-- Single transaction - atomic update
-- =========================================
CREATE OR REPLACE FUNCTION update_employee_complete(
  p_employee_id UUID,
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data JSONB;
  v_updated BOOLEAN := false;
BEGIN
  -- Check if employee exists
  SELECT jsonb_build_object(
    'name', name,
    'email', email,
    'phone', phone,
    'role', role::TEXT,
    'status', status::TEXT
  ) INTO v_old_data
  FROM employees WHERE id = p_employee_id;

  IF v_old_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Check for email uniqueness if changing email
  IF p_data->>'email' IS NOT NULL AND p_data->>'email' != v_old_data->>'email' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE email = p_data->>'email' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email already in use');
    END IF;
  END IF;

  -- Check for phone uniqueness if changing phone
  IF p_data->>'phone' IS NOT NULL AND p_data->>'phone' != v_old_data->>'phone' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE phone = p_data->>'phone' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Phone number already in use');
    END IF;
  END IF;

  -- Update employee with only provided fields
  UPDATE employees SET
    name = COALESCE(p_data->>'name', name),
    email = COALESCE(p_data->>'email', email),
    phone = COALESCE(p_data->>'phone', phone),
    role = COALESCE((p_data->>'role')::employee_role, role),
    address = COALESCE(p_data->>'address', address),
    emergency_contact = COALESCE(p_data->>'emergency_contact', emergency_contact),
    emergency_contact_name = COALESCE(p_data->>'emergency_contact_name', emergency_contact_name),
    date_of_birth = COALESCE((p_data->>'date_of_birth')::DATE, date_of_birth),
    blood_group = COALESCE(p_data->>'blood_group', blood_group),
    salary = COALESCE((p_data->>'salary')::NUMERIC, salary),
    portal_enabled = COALESCE((p_data->>'portal_enabled')::BOOLEAN, portal_enabled),
    permissions = COALESCE((p_data->'permissions')::JSONB, permissions),
    bank_details = COALESCE((p_data->'bank_details')::JSONB, bank_details),
    notes = COALESCE(p_data->>'notes', notes),
    avatar_url = COALESCE(p_data->>'avatar_url', avatar_url),
    updated_at = NOW()
  WHERE id = p_employee_id;

  v_updated := FOUND;

  -- Log update in audit
  IF v_updated THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('update_employee', 'employees', p_employee_id, v_old_data, p_data);
  END IF;

  RETURN jsonb_build_object(
    'success', v_updated,
    'message', CASE WHEN v_updated THEN 'Employee updated successfully' ELSE 'No changes made' END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 5. DELETE EMPLOYEE CASCADE
-- Deletes employee and ALL related data (documents, payroll, attendance, licenses)
-- Atomic deletion with audit trail
-- =========================================
CREATE OR REPLACE FUNCTION delete_employee_cascade(
  p_employee_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_data JSONB;
  v_employee_name TEXT;
  v_documents_deleted INTEGER := 0;
  v_payroll_deleted INTEGER := 0;
  v_attendance_deleted INTEGER := 0;
BEGIN
  -- Get employee data for audit
  SELECT jsonb_build_object(
    'employee_id', employee_id,
    'name', name,
    'email', email,
    'role', role::TEXT
  ), name INTO v_employee_data, v_employee_name
  FROM employees WHERE id = p_employee_id;

  IF v_employee_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Delete documents
  DELETE FROM employee_documents WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_documents_deleted = ROW_COUNT;

  -- Delete payroll records
  DELETE FROM employee_payroll WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_payroll_deleted = ROW_COUNT;

  -- Delete attendance records
  DELETE FROM attendance WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

  -- Delete licenses
  DELETE FROM employee_licenses WHERE employee_id = p_employee_id;

  -- Delete delivery history (set rider_id to null or delete)
  UPDATE delivery_history SET rider_id = NULL WHERE rider_id = p_employee_id;

  -- Finally delete employee
  DELETE FROM employees WHERE id = p_employee_id;

  -- Log deletion in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, user_id)
  VALUES ('delete_employee', 'employees', p_employee_id, v_employee_data, p_deleted_by);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" deleted successfully',
    'deleted', jsonb_build_object(
      'documents', v_documents_deleted,
      'payroll_records', v_payroll_deleted,
      'attendance_records', v_attendance_deleted
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 6. BLOCK EMPLOYEE
-- Blocks employee, disables portal, deactivates license
-- =========================================
CREATE OR REPLACE FUNCTION block_employee(
  p_employee_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_blocked_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_name TEXT;
  v_old_status TEXT;
BEGIN
  -- Get current status
  SELECT name, status::TEXT INTO v_employee_name, v_old_status
  FROM employees WHERE id = p_employee_id;

  IF v_employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  IF v_old_status = 'blocked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee is already blocked');
  END IF;

  -- Block employee and disable portal
  UPDATE employees SET
    status = 'blocked'::employee_status,
    portal_enabled = false,
    notes = COALESCE(notes || E'\n', '') || 'BLOCKED: ' || COALESCE(p_reason, 'No reason provided') || ' (' || NOW()::TEXT || ')',
    updated_at = NOW()
  WHERE id = p_employee_id;

  -- Deactivate all licenses
  UPDATE employee_licenses SET
    is_used = true,
    expires_at = NOW()
  WHERE employee_id = p_employee_id;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
  VALUES (
    'block_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'blocked', 'reason', p_reason),
    p_blocked_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" has been blocked',
    'previous_status', v_old_status
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 7. UNBLOCK/ACTIVATE EMPLOYEE
-- Activates employee, optionally enables portal
-- =========================================
CREATE OR REPLACE FUNCTION activate_employee(
  p_employee_id UUID,
  p_enable_portal BOOLEAN DEFAULT true,
  p_activated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_name TEXT;
  v_old_status TEXT;
  v_new_license_id TEXT;
BEGIN
  SELECT name, status::TEXT INTO v_employee_name, v_old_status
  FROM employees WHERE id = p_employee_id;

  IF v_employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Update employee status
  UPDATE employees SET
    status = 'active'::employee_status,
    portal_enabled = p_enable_portal,
    updated_at = NOW()
  WHERE id = p_employee_id;

  -- Generate new license if needed
  IF p_enable_portal THEN
    v_new_license_id := 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4));
    
    -- Expire old licenses
    UPDATE employee_licenses SET expires_at = NOW() WHERE employee_id = p_employee_id;
    
    -- Create new license
    INSERT INTO employee_licenses (employee_id, license_id, is_used, expires_at)
    VALUES (p_employee_id, v_new_license_id, false, NOW() + INTERVAL '30 days');
    
    -- Update employee license_id
    UPDATE employees SET license_id = v_new_license_id WHERE id = p_employee_id;
  END IF;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
  VALUES (
    'activate_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'active', 'portal_enabled', p_enable_portal),
    p_activated_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" has been activated',
    'previous_status', v_old_status,
    'portal_enabled', p_enable_portal,
    'new_license_id', v_new_license_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 8. ADD EMPLOYEE DOCUMENT
-- Adds document record to employee
-- =========================================
CREATE OR REPLACE FUNCTION add_employee_document(
  p_employee_id UUID,
  p_document_type TEXT,
  p_document_name TEXT,
  p_file_url TEXT,
  p_file_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_id UUID;
BEGIN
  -- Verify employee exists
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  INSERT INTO employee_documents (
    employee_id,
    document_type,
    document_name,
    file_url,
    file_type
  ) VALUES (
    p_employee_id,
    p_document_type,
    p_document_name,
    p_file_url,
    p_file_type
  ) RETURNING id INTO v_doc_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'message', 'Document added successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 9. REMOVE EMPLOYEE DOCUMENT
-- Removes document record
-- =========================================
CREATE OR REPLACE FUNCTION remove_employee_document(
  p_employee_id UUID,
  p_document_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file_url TEXT;
BEGIN
  -- Get document file URL for cleanup
  SELECT file_url INTO v_file_url
  FROM employee_documents
  WHERE id = p_document_id AND employee_id = p_employee_id;

  IF v_file_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  DELETE FROM employee_documents WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'file_url', v_file_url,  -- Return URL so frontend can delete from storage
    'message', 'Document removed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 10. UPDATE EMPLOYEE AVATAR
-- Quick avatar update
-- =========================================
CREATE OR REPLACE FUNCTION update_employee_avatar(
  p_employee_id UUID,
  p_avatar_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_avatar TEXT;
BEGIN
  SELECT avatar_url INTO v_old_avatar FROM employees WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  UPDATE employees SET 
    avatar_url = p_avatar_url,
    updated_at = NOW()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_avatar_url', v_old_avatar,  -- Return old URL for cleanup
    'new_avatar_url', p_avatar_url
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================
-- 11. GET EMPLOYEES DASHBOARD STATS
-- Quick stats for dashboard - single call
-- =========================================
CREATE OR REPLACE FUNCTION get_employees_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'total', (SELECT COUNT(*) FROM employees),
    'active', (SELECT COUNT(*) FROM employees WHERE status = 'active'),
    'inactive', (SELECT COUNT(*) FROM employees WHERE status = 'inactive'),
    'pending', (SELECT COUNT(*) FROM employees WHERE status = 'pending'),
    'blocked', (SELECT COUNT(*) FROM employees WHERE status = 'blocked'),
    'portal_enabled', (SELECT COUNT(*) FROM employees WHERE portal_enabled = true),
    'by_role', (
      SELECT jsonb_object_agg(role::TEXT, cnt)
      FROM (
        SELECT role, COUNT(*) as cnt
        FROM employees
        GROUP BY role
      ) r
    ),
    'hired_this_month', (
      SELECT COUNT(*) FROM employees 
      WHERE DATE_TRUNC('month', hired_date) = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'present_today', (
      SELECT COUNT(DISTINCT employee_id) FROM attendance 
      WHERE date = CURRENT_DATE AND status = 'present'
    )
  );
END;
$$;

-- =========================================
-- 12. TOGGLE PORTAL ACCESS (QUICK)
-- Fast portal enable/disable
-- =========================================
CREATE OR REPLACE FUNCTION toggle_employee_portal(
  p_employee_id UUID,
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  UPDATE employees SET
    portal_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'portal_enabled', p_enabled,
    'message', 'Portal access ' || CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END || ' for ' || v_name
  );
END;
$$;

-- =========================================
-- 13. BULK UPDATE STATUS
-- Update multiple employees at once
-- =========================================
CREATE OR REPLACE FUNCTION bulk_update_employee_status(
  p_employee_ids UUID[],
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_status NOT IN ('active', 'inactive', 'blocked', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  UPDATE employees SET
    status = p_status::employee_status,
    portal_enabled = CASE WHEN p_status = 'blocked' THEN false ELSE portal_enabled END,
    updated_at = NOW()
  WHERE id = ANY(p_employee_ids);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated,
    'new_status', p_status
  );
END;
$$;

-- =========================================
-- 14. GET EMPLOYEE PAYROLL SUMMARY
-- Get payroll history for employee
-- =========================================
CREATE OR REPLACE FUNCTION get_employee_payroll_summary(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'employee', (
      SELECT jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'name', name,
        'email', email,
        'phone', phone,
        'role', role::TEXT,
        'status', status::TEXT,
        'avatar_url', avatar_url,
        'salary', salary,
        'bank_details', bank_details,
        'total_tips', total_tips,
        'total_orders_taken', total_orders_taken,
        'hired_date', hired_date,
        'address', address
      )
      FROM employees WHERE id = p_employee_id
    ),
    'payroll_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'month', month,
        'year', year,
        'base_salary', base_salary,
        'bonus', bonus,
        'deductions', deductions,
        'tips', tips,
        'total_amount', total_amount,
        'paid', paid,
        'paid_at', paid_at,
        'paid_by', paid_by,
        'notes', notes,
        'created_at', created_at
      ) ORDER BY year DESC, month DESC)
      FROM employee_payroll WHERE employee_id = p_employee_id
    ), '[]'::JSONB),
    'totals', (
      SELECT jsonb_build_object(
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'total_tips', COALESCE(SUM(tips), 0),
        'total_bonus', COALESCE(SUM(bonus), 0),
        'total_deductions', COALESCE(SUM(deductions), 0),
        'months_paid', COUNT(*) FILTER (WHERE paid = true),
        'months_pending', COUNT(*) FILTER (WHERE paid = false)
      )
      FROM employee_payroll WHERE employee_id = p_employee_id
    ),
    'current_year_summary', (
      SELECT jsonb_build_object(
        'year', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
        'total_earned', COALESCE(SUM(total_amount), 0),
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'months_worked', COUNT(*)
      )
      FROM employee_payroll 
      WHERE employee_id = p_employee_id 
      AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ),
    'attendance_summary', (
      SELECT jsonb_build_object(
        'this_month_days', COALESCE(COUNT(*), 0),
        'late_days_this_month', COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0)
      )
      FROM attendance
      WHERE employee_id = p_employee_id
      AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
    )
  );
END;
$$;

-- =========================================
-- 15. VERIFY EMPLOYEE DOCUMENT
-- Mark document as verified
-- =========================================
CREATE OR REPLACE FUNCTION verify_employee_document(
  p_document_id UUID,
  p_verified_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employee_documents SET
    verified = true,
    verified_by = p_verified_by,
    verified_at = NOW()
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document verified');
END;
$$;

-- =========================================
-- GRANT PERMISSIONS
-- =========================================
GRANT EXECUTE ON FUNCTION get_employees_paginated(INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_employee_inactive(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_complete(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_employee_cascade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION block_employee(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_employee(UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_employee_document(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_employee_document(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_avatar(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employees_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_employee_portal(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_employee_status(UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_payroll_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_employee_document(UUID, UUID) TO authenticated;

-- =========================================
-- PERFORMANCE INDEXES
-- =========================================

-- Enable trigram extension for fuzzy search FIRST (required for gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_portal_enabled ON employees(portal_enabled);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_hired_date ON employees(hired_date);
CREATE INDEX IF NOT EXISTS idx_employees_name_search ON employees USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee ON employee_licenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_license ON employee_licenses(license_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_employee ON employee_payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_period ON employee_payroll(year, month);
