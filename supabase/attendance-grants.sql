-- =============================================
-- ATTENDANCE RPC GRANTS
-- Grant execute permissions to authenticated role
-- Run this in Supabase SQL Editor
-- =============================================

-- First ensure the functions exist, then grant permissions
-- These are the core attendance functions that need grants

-- Grant for attendance stats (admin/manager only - checked in function)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_attendance_stats' AND pg_function_is_visible(oid)) THEN
        REVOKE ALL ON FUNCTION get_attendance_stats() FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_attendance_stats() FROM anon;
        GRANT EXECUTE ON FUNCTION get_attendance_stats() TO authenticated;
        RAISE NOTICE 'Granted execute on get_attendance_stats';
    END IF;
END $$;

-- Grant for today's attendance list (admin/manager only - checked in function)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_today_attendance' AND pg_function_is_visible(oid)) THEN
        REVOKE ALL ON FUNCTION get_today_attendance() FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_today_attendance() FROM anon;
        GRANT EXECUTE ON FUNCTION get_today_attendance() TO authenticated;
        RAISE NOTICE 'Granted execute on get_today_attendance';
    END IF;
END $$;

-- Grant for employee's own attendance
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_today_attendance' AND pg_function_is_visible(oid)) THEN
        REVOKE ALL ON FUNCTION get_my_today_attendance() FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_my_today_attendance() FROM anon;
        GRANT EXECUTE ON FUNCTION get_my_today_attendance() TO authenticated;
        RAISE NOTICE 'Granted execute on get_my_today_attendance';
    END IF;
END $$;

-- Grant for marking attendance with code
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_attendance_with_code') THEN
        REVOKE ALL ON FUNCTION mark_attendance_with_code(VARCHAR) FROM PUBLIC;
        REVOKE ALL ON FUNCTION mark_attendance_with_code(VARCHAR) FROM anon;
        GRANT EXECUTE ON FUNCTION mark_attendance_with_code(VARCHAR) TO authenticated;
        RAISE NOTICE 'Granted execute on mark_attendance_with_code';
    END IF;
END $$;

-- Grant for attendance history
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_attendance_history') THEN
        REVOKE ALL ON FUNCTION get_attendance_history(INTEGER, INTEGER, UUID) FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_attendance_history(INTEGER, INTEGER, UUID) FROM anon;
        GRANT EXECUTE ON FUNCTION get_attendance_history(INTEGER, INTEGER, UUID) TO authenticated;
        RAISE NOTICE 'Granted execute on get_attendance_history';
    END IF;
END $$;

-- Grant for attendance code generation (admin/manager only - checked in function)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_attendance_code') THEN
        -- Handle both signatures
        REVOKE ALL ON FUNCTION generate_attendance_code(TIME, TIME) FROM PUBLIC;
        REVOKE ALL ON FUNCTION generate_attendance_code(TIME, TIME) FROM anon;
        GRANT EXECUTE ON FUNCTION generate_attendance_code(TIME, TIME) TO authenticated;
        RAISE NOTICE 'Granted execute on generate_attendance_code';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'generate_attendance_code(TIME, TIME) does not exist, skipping';
END $$;

-- Grant for admin mark attendance
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_mark_attendance') THEN
        REVOKE ALL ON FUNCTION admin_mark_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, TEXT) FROM PUBLIC;
        REVOKE ALL ON FUNCTION admin_mark_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, TEXT) FROM anon;
        GRANT EXECUTE ON FUNCTION admin_mark_attendance(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, TEXT) TO authenticated;
        RAISE NOTICE 'Granted execute on admin_mark_attendance';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'admin_mark_attendance does not exist, skipping';
END $$;

-- Grant for helper functions (needed for auth.uid() to work in SECURITY DEFINER context)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_employee_id' AND pg_function_is_visible(oid)) THEN
        GRANT EXECUTE ON FUNCTION get_employee_id() TO authenticated;
        RAISE NOTICE 'Granted execute on get_employee_id';
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_manager_or_admin' AND pg_function_is_visible(oid)) THEN
        GRANT EXECUTE ON FUNCTION is_manager_or_admin() TO authenticated;
        RAISE NOTICE 'Granted execute on is_manager_or_admin';
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pg_function_is_visible(oid)) THEN
        GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
        RAISE NOTICE 'Granted execute on is_admin';
    END IF;
END $$;

-- Leave management functions grants
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_leave_request') THEN
        REVOKE ALL ON FUNCTION create_leave_request(UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC;
        REVOKE ALL ON FUNCTION create_leave_request(UUID, DATE, DATE, TEXT, TEXT) FROM anon;
        GRANT EXECUTE ON FUNCTION create_leave_request(UUID, DATE, DATE, TEXT, TEXT) TO authenticated;
        RAISE NOTICE 'Granted execute on create_leave_request';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'create_leave_request does not exist, skipping';
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_leave_requests') THEN
        REVOKE ALL ON FUNCTION get_my_leave_requests(UUID) FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_my_leave_requests(UUID) FROM anon;
        GRANT EXECUTE ON FUNCTION get_my_leave_requests(UUID) TO authenticated;
        RAISE NOTICE 'Granted execute on get_my_leave_requests';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_my_leave_requests does not exist, skipping';
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_all_leave_requests') THEN
        REVOKE ALL ON FUNCTION get_all_leave_requests(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_all_leave_requests(UUID, TEXT, INTEGER, INTEGER) FROM anon;
        GRANT EXECUTE ON FUNCTION get_all_leave_requests(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
        RAISE NOTICE 'Granted execute on get_all_leave_requests';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_all_leave_requests does not exist, skipping';
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'review_leave_request') THEN
        REVOKE ALL ON FUNCTION review_leave_request(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
        REVOKE ALL ON FUNCTION review_leave_request(UUID, UUID, TEXT, TEXT) FROM anon;
        GRANT EXECUTE ON FUNCTION review_leave_request(UUID, UUID, TEXT, TEXT) TO authenticated;
        RAISE NOTICE 'Granted execute on review_leave_request';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'review_leave_request does not exist, skipping';
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_leave_balances') THEN
        REVOKE ALL ON FUNCTION get_my_leave_balances(UUID) FROM PUBLIC;
        REVOKE ALL ON FUNCTION get_my_leave_balances(UUID) FROM anon;
        GRANT EXECUTE ON FUNCTION get_my_leave_balances(UUID) TO authenticated;
        RAISE NOTICE 'Granted execute on get_my_leave_balances';
    END IF;
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'get_my_leave_balances does not exist, skipping';
END $$;

-- =============================================
-- Verification Query
-- Run this to confirm grants were applied
-- =============================================
-- SELECT 
--     p.proname as function_name,
--     CASE 
--         WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'YES'
--         ELSE 'NO'
--     END as authenticated_can_execute,
--     CASE 
--         WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'YES'
--         ELSE 'NO'
--     END as anon_can_execute
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.proname IN (
--     'get_attendance_stats',
--     'get_today_attendance', 
--     'get_my_today_attendance',
--     'mark_attendance_with_code',
--     'get_attendance_history',
--     'generate_attendance_code',
--     'admin_mark_attendance',
--     'get_employee_id',
--     'is_manager_or_admin',
--     'is_admin',
--     'create_leave_request',
--     'get_my_leave_requests',
--     'get_all_leave_requests',
--     'review_leave_request',
--     'get_my_leave_balances'
-- )
-- ORDER BY p.proname;
