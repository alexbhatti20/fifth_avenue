-- =========================================
-- ADMIN RLS POLICIES FOR EMPLOYEE MANAGEMENT
-- Run this in Supabase SQL Editor
-- Allows admins to manage all employee data
-- =========================================

-- =========================================
-- DROP EXISTING RESTRICTIVE POLICIES
-- =========================================
DROP POLICY IF EXISTS "admins_full_access_employees" ON employees;
DROP POLICY IF EXISTS "admins_insert_employees" ON employees;
DROP POLICY IF EXISTS "admins_update_employees" ON employees;
DROP POLICY IF EXISTS "admins_delete_employees" ON employees;
DROP POLICY IF EXISTS "admins_select_employees" ON employees;
DROP POLICY IF EXISTS "employees_view_own" ON employees;
DROP POLICY IF EXISTS "employees_update_own" ON employees;

DROP POLICY IF EXISTS "admins_manage_employee_licenses" ON employee_licenses;
DROP POLICY IF EXISTS "admins_manage_employee_documents" ON employee_documents;
DROP POLICY IF EXISTS "admins_manage_employee_payroll" ON employee_payroll;

-- =========================================
-- HELPER FUNCTION: Check if current user is admin
-- =========================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- EMPLOYEES TABLE POLICIES
-- =========================================

-- Admins can SELECT all employees
CREATE POLICY "admins_select_employees" ON employees
FOR SELECT
TO authenticated
USING (
  is_admin() OR auth_user_id = auth.uid()
);

-- Admins can INSERT new employees
CREATE POLICY "admins_insert_employees" ON employees
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Admins can UPDATE any employee, employees can update own profile
CREATE POLICY "admins_update_employees" ON employees
FOR UPDATE
TO authenticated
USING (is_admin() OR auth_user_id = auth.uid())
WITH CHECK (is_admin() OR auth_user_id = auth.uid());

-- Admins can DELETE employees
CREATE POLICY "admins_delete_employees" ON employees
FOR DELETE
TO authenticated
USING (is_admin());

-- =========================================
-- EMPLOYEE_LICENSES TABLE POLICIES
-- =========================================

-- Admins can do everything with licenses
CREATE POLICY "admins_manage_employee_licenses" ON employee_licenses
FOR ALL
TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- EMPLOYEE_DOCUMENTS TABLE POLICIES
-- =========================================

-- Admins can manage all documents, employees can view own
CREATE POLICY "admins_manage_employee_documents" ON employee_documents
FOR ALL
TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- EMPLOYEE_PAYROLL TABLE POLICIES
-- =========================================

-- Admins can manage all payroll, employees can view own
CREATE POLICY "admins_manage_employee_payroll" ON employee_payroll
FOR ALL
TO authenticated
USING (
  is_admin() OR 
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
)
WITH CHECK (is_admin());

-- =========================================
-- ATTENDANCE TABLE POLICIES (if exists)
-- =========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') THEN
    DROP POLICY IF EXISTS "admins_manage_attendance" ON attendance;
    
    CREATE POLICY "admins_manage_attendance" ON attendance
    FOR ALL
    TO authenticated
    USING (
      is_admin() OR 
      employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
      is_admin() OR 
      employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid())
    );
  END IF;
END $$;

-- =========================================
-- AUDIT_LOGS TABLE POLICIES (if exists)
-- =========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DROP POLICY IF EXISTS "admins_manage_audit_logs" ON audit_logs;
    
    CREATE POLICY "admins_manage_audit_logs" ON audit_logs
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
  END IF;
END $$;

-- =========================================
-- GRANT EXECUTE ON HELPER FUNCTION
-- =========================================
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- =========================================
-- VERIFY POLICIES CREATED
-- =========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('employees', 'employee_licenses', 'employee_documents', 'employee_payroll', 'attendance', 'audit_logs')
ORDER BY tablename, policyname;
