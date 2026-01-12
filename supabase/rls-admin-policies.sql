-- =========================================
-- RLS POLICIES FOR ADMIN EMPLOYEE MANAGEMENT
-- Run this in Supabase SQL Editor
-- =========================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_payroll ENABLE ROW LEVEL SECURITY;

-- =========================================
-- DROP EXISTING POLICIES (to avoid conflicts)
-- =========================================
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

DROP POLICY IF EXISTS "employee_licenses_policy" ON employee_licenses;
DROP POLICY IF EXISTS "employee_documents_policy" ON employee_documents;
DROP POLICY IF EXISTS "employee_payroll_policy" ON employee_payroll;

-- =========================================
-- HELPER FUNCTION: Check if current user is admin
-- Uses SECURITY DEFINER to bypass RLS for the check itself
-- =========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =========================================
-- EMPLOYEES TABLE POLICIES
-- =========================================

-- SELECT: Admins see all, others see only themselves
CREATE POLICY "employees_select_policy" ON employees
FOR SELECT TO authenticated
USING (
  is_admin() OR auth_user_id = auth.uid()
);

-- INSERT: Only admins can create new employees
CREATE POLICY "employees_insert_policy" ON employees
FOR INSERT TO authenticated
WITH CHECK (is_admin());

-- UPDATE: Admins can update anyone, others only themselves
CREATE POLICY "employees_update_policy" ON employees
FOR UPDATE TO authenticated
USING (is_admin() OR auth_user_id = auth.uid())
WITH CHECK (is_admin() OR auth_user_id = auth.uid());

-- DELETE: Only admins can delete
CREATE POLICY "employees_delete_policy" ON employees
FOR DELETE TO authenticated
USING (is_admin());

-- =========================================
-- EMPLOYEE_LICENSES TABLE POLICIES
-- =========================================

CREATE POLICY "employee_licenses_policy" ON employee_licenses
FOR ALL TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- EMPLOYEE_DOCUMENTS TABLE POLICIES
-- =========================================

CREATE POLICY "employee_documents_policy" ON employee_documents
FOR ALL TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- EMPLOYEE_PAYROLL TABLE POLICIES
-- =========================================

CREATE POLICY "employee_payroll_policy" ON employee_payroll
FOR ALL TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- VERIFICATION: Check policies were created
-- =========================================
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('employees', 'employee_licenses', 'employee_documents', 'employee_payroll');
