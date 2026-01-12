-- =============================================
-- HELPER FUNCTION: is_manager_or_admin()
-- This function checks if the current user is an admin or manager
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop if exists
DROP FUNCTION IF EXISTS public.is_manager_or_admin();

-- Create the function
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM employees
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    -- Return true if user is admin or manager
    RETURN user_role IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

-- =============================================
-- Also create get_employee_id function if missing
-- This is commonly used alongside is_manager_or_admin
-- =============================================

CREATE OR REPLACE FUNCTION public.get_employee_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_employee_id() TO authenticated;
