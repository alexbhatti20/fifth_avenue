-- RLS Policies for Employee Related Tables
-- These policies allow admins to manage employee_documents, employee_licenses, and employee_payroll

-- Enable RLS on tables (if not already enabled)
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_payroll ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage employee_documents" ON employee_documents;
DROP POLICY IF EXISTS "Employees can view own documents" ON employee_documents;

DROP POLICY IF EXISTS "Admins can manage employee_licenses" ON employee_licenses;
DROP POLICY IF EXISTS "Employees can view own license" ON employee_licenses;

DROP POLICY IF EXISTS "Admins can manage employee_payroll" ON employee_payroll;
DROP POLICY IF EXISTS "Employees can view own payroll" ON employee_payroll;

-- =====================================================
-- EMPLOYEE DOCUMENTS POLICIES
-- =====================================================

-- Admins can do everything on employee_documents
CREATE POLICY "Admins can manage employee_documents"
ON employee_documents
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Employees can view their own documents
CREATE POLICY "Employees can view own documents"
ON employee_documents
FOR SELECT
USING (
    employee_id IN (
        SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
);

-- =====================================================
-- EMPLOYEE LICENSES POLICIES
-- =====================================================

-- Admins can do everything on employee_licenses
CREATE POLICY "Admins can manage employee_licenses"
ON employee_licenses
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Employees can view their own license
CREATE POLICY "Employees can view own license"
ON employee_licenses
FOR SELECT
USING (
    employee_id IN (
        SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
);

-- Allow anyone to update license during activation (for account activation flow)
CREATE POLICY "Allow license activation"
ON employee_licenses
FOR UPDATE
USING (is_used = false)
WITH CHECK (true);

-- =====================================================
-- EMPLOYEE PAYROLL POLICIES
-- =====================================================

-- Admins can do everything on employee_payroll
CREATE POLICY "Admins can manage employee_payroll"
ON employee_payroll
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Employees can view their own payroll records
CREATE POLICY "Employees can view own payroll"
ON employee_payroll
FOR SELECT
USING (
    employee_id IN (
        SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
);
