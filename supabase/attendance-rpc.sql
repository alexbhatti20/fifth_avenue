-- =============================================
-- ATTENDANCE MANAGEMENT RPCs
-- Optimized functions for attendance with security
-- =============================================

-- =============================================
-- DROP OLD FUNCTION SIGNATURES TO AVOID CONFLICTS
-- =============================================
DROP FUNCTION IF EXISTS generate_attendance_code();
DROP FUNCTION IF EXISTS generate_attendance_code(INTEGER);
DROP FUNCTION IF EXISTS generate_attendance_code(TIME, TIME);
DROP FUNCTION IF EXISTS mark_attendance_with_code(VARCHAR);
DROP FUNCTION IF EXISTS get_my_today_attendance();
DROP FUNCTION IF EXISTS get_today_attendance();
DROP FUNCTION IF EXISTS get_attendance_history(INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_attendance_stats();
DROP FUNCTION IF EXISTS admin_mark_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, TEXT);

-- =============================================
-- 1. GET MY TODAY'S ATTENDANCE (For Employee)
-- Returns current employee's attendance for today
-- =============================================
CREATE OR REPLACE FUNCTION get_my_today_attendance()
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
        'attendance', CASE WHEN a.id IS NOT NULL THEN
            json_build_object(
                'id', a.id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes
            )
        ELSE NULL END
    ) INTO result
    FROM (SELECT 1) dummy
    LEFT JOIN attendance a ON a.employee_id = emp_id AND a.date = CURRENT_DATE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_my_today_attendance IS 'Returns current employee attendance for today - secure';

-- =============================================
-- 2. GET TODAY'S ATTENDANCE LIST (Admin/Manager)
-- Returns all attendance records for today
-- =============================================
CREATE OR REPLACE FUNCTION get_today_attendance()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'attendance', COALESCE(json_agg(
            json_build_object(
                'id', a.id,
                'employee_id', a.employee_id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes,
                'employee', json_build_object(
                    'id', e.id,
                    'employee_id', e.employee_id,
                    'name', e.name,
                    'email', e.email,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'role', e.role,
                    'status', e.status,
                    'hired_date', e.hired_date
                )
            ) ORDER BY a.check_in DESC
        ), '[]'::json)
    ) INTO result
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date = CURRENT_DATE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_today_attendance IS 'Returns all attendance for today - admin/manager only';

-- =============================================
-- 3. GET ATTENDANCE HISTORY (Admin/Manager)
-- Returns attendance records for a specific month
-- =============================================
CREATE OR REPLACE FUNCTION get_attendance_history(
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
    p_employee_id UUID DEFAULT NULL
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
        'attendance', COALESCE(json_agg(
            json_build_object(
                'id', a.id,
                'employee_id', a.employee_id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes,
                'employee', json_build_object(
                    'id', e.id,
                    'employee_id', e.employee_id,
                    'name', e.name,
                    'email', e.email,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'role', e.role,
                    'status', e.status,
                    'hired_date', e.hired_date
                )
            ) ORDER BY a.date DESC, a.check_in DESC
        ), '[]'::json)
    ) INTO result
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date >= start_date 
    AND a.date < end_date
    AND (p_employee_id IS NULL OR a.employee_id = p_employee_id);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_attendance_history IS 'Returns attendance history for a month - admin/manager only';

-- =============================================
-- 4. GET ATTENDANCE STATS (Admin/Manager)
-- Returns attendance statistics for today
-- =============================================
CREATE OR REPLACE FUNCTION get_attendance_stats()
RETURNS JSON AS $$
DECLARE
    total_active INTEGER;
    present_count INTEGER;
    late_count INTEGER;
    on_leave_count INTEGER;
    absent_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Get total active employees
    SELECT COUNT(*) INTO total_active
    FROM employees
    WHERE status = 'active';
    
    -- Get today's attendance counts
    SELECT 
        COUNT(*) FILTER (WHERE status = 'present'),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'on_leave')
    INTO present_count, late_count, on_leave_count
    FROM attendance
    WHERE date = CURRENT_DATE;
    
    -- Calculate absent (total - all who marked attendance - on leave)
    absent_count := total_active - present_count - late_count - on_leave_count;
    IF absent_count < 0 THEN absent_count := 0; END IF;
    
    RETURN json_build_object(
        'success', true,
        'stats', json_build_object(
            'total', total_active,
            'present', present_count,
            'late', late_count,
            'on_leave', on_leave_count,
            'absent', absent_count,
            'attendance_rate', CASE WHEN total_active > 0 
                THEN ROUND(((present_count + late_count)::NUMERIC / total_active) * 100, 1)
                ELSE 0 
            END
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_attendance_stats IS 'Returns attendance stats for today - admin/manager only';

-- =============================================
-- 5. IMPROVED MARK ATTENDANCE WITH CODE
-- Better security with more validation
-- =============================================
CREATE OR REPLACE FUNCTION mark_attendance_with_code(
    p_code VARCHAR(10)
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    emp_status VARCHAR;
    code_record RECORD;
    attendance_record RECORD;
    new_status VARCHAR;
    action_type VARCHAR;
    message TEXT;
BEGIN
    emp_id := get_employee_id();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    
    -- Check employee status
    SELECT status INTO emp_status FROM employees WHERE id = emp_id;
    IF emp_status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Your account is not active');
    END IF;
    
    -- Validate code with stricter checks
    SELECT * INTO code_record
    FROM attendance_codes
    WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND valid_for_date = CURRENT_DATE
    AND CURRENT_TIME BETWEEN valid_from AND valid_until;
    
    IF code_record IS NULL THEN
        -- Log failed attempt (optional - for security monitoring)
        RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
    END IF;
    
    -- Check existing attendance
    SELECT * INTO attendance_record
    FROM attendance
    WHERE employee_id = emp_id
    AND date = CURRENT_DATE;
    
    IF attendance_record IS NOT NULL THEN
        -- Already checked in - try check out
        IF attendance_record.check_out IS NOT NULL THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'You have already checked out today'
            );
        END IF;
        
        -- Perform check out
        UPDATE attendance
        SET check_out = NOW(),
            updated_at = NOW()
        WHERE id = attendance_record.id
        RETURNING * INTO attendance_record;
        
        action_type := 'check_out';
        message := 'Checked out successfully at ' || to_char(NOW(), 'HH12:MI AM');
    ELSE
        -- New check in
        new_status := CASE 
            WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'
            ELSE 'present'
        END;
        
        INSERT INTO attendance (
            employee_id, 
            date, 
            check_in, 
            status,
            created_at,
            updated_at
        )
        VALUES (
            emp_id,
            CURRENT_DATE,
            NOW(),
            new_status,
            NOW(),
            NOW()
        )
        RETURNING * INTO attendance_record;
        
        action_type := 'check_in';
        message := CASE 
            WHEN new_status = 'late' 
            THEN 'Checked in as LATE at ' || to_char(NOW(), 'HH12:MI AM')
            ELSE 'Checked in successfully at ' || to_char(NOW(), 'HH12:MI AM')
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'action', action_type,
        'message', message,
        'attendance', json_build_object(
            'id', attendance_record.id,
            'date', attendance_record.date,
            'check_in', attendance_record.check_in,
            'check_out', attendance_record.check_out,
            'status', attendance_record.status
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_attendance_with_code IS 'Mark attendance with code - secure with validation';

-- =============================================
-- 6. IMPROVED GENERATE ATTENDANCE CODE
-- With configurable expiry and better defaults
-- =============================================
CREATE OR REPLACE FUNCTION generate_attendance_code(
    p_valid_minutes INTEGER DEFAULT 5
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_code VARCHAR(6);
    valid_from_time TIME;
    valid_until_time TIME;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    emp_id := get_employee_id();
    
    -- Generate random 6-digit alphanumeric code
    new_code := UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    
    -- Set validity window
    valid_from_time := CURRENT_TIME;
    valid_until_time := (CURRENT_TIME + (p_valid_minutes || ' minutes')::INTERVAL)::TIME;
    
    -- Deactivate all previous codes for today
    UPDATE attendance_codes
    SET is_active = false,
        updated_at = NOW()
    WHERE valid_for_date = CURRENT_DATE
    AND is_active = true;
    
    -- Insert new code
    INSERT INTO attendance_codes (
        code, 
        generated_by, 
        valid_for_date, 
        valid_from, 
        valid_until,
        is_active,
        created_at
    )
    VALUES (
        new_code, 
        emp_id, 
        CURRENT_DATE, 
        valid_from_time, 
        valid_until_time,
        true,
        NOW()
    );
    
    RETURN json_build_object(
        'success', true, 
        'code', new_code,
        'valid_from', valid_from_time,
        'valid_until', valid_until_time,
        'expires_in_minutes', p_valid_minutes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_attendance_code IS 'Generate attendance code - admin/manager only';

-- =============================================
-- 7. MANUAL ATTENDANCE MARK (Admin Only)
-- For correcting/adding attendance manually
-- =============================================
CREATE OR REPLACE FUNCTION admin_mark_attendance(
    p_employee_id UUID,
    p_date DATE,
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ DEFAULT NULL,
    p_status VARCHAR DEFAULT 'present',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result RECORD;
BEGIN
    -- Only admin can manually mark attendance
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Validate employee exists
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found');
    END IF;
    
    -- Insert or update attendance
    INSERT INTO attendance (
        employee_id,
        date,
        check_in,
        check_out,
        status,
        notes,
        created_at,
        updated_at
    )
    VALUES (
        p_employee_id,
        p_date,
        p_check_in,
        p_check_out,
        p_status,
        p_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (employee_id, date) 
    DO UPDATE SET
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING * INTO result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Attendance recorded successfully',
        'attendance', row_to_json(result)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION admin_mark_attendance IS 'Manually mark/correct attendance - admin only';

-- =============================================
-- GRANTS
-- =============================================
GRANT EXECUTE ON FUNCTION get_my_today_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_today_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_attendance_history(INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_attendance_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_attendance_with_code(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_attendance_code(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_mark_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, TEXT) TO authenticated;
