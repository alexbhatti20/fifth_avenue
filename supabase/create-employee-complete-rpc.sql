-- =====================================================
-- OPTIMIZED EMPLOYEE MANAGEMENT RPCs
-- CREATE, UPDATE, BLOCK, ACTIVATE, DELETE
-- All related tables: employees, employee_documents, employee_licenses, employee_payroll
-- Returns file URLs for storage cleanup
-- Updated: January 2026
-- =====================================================

-- =====================================================
-- DROP ALL EXISTING FUNCTIONS TO AVOID CONFLICTS
-- =====================================================
-- =====================================================
-- DROP EXISTING FUNCTIONS (Clean slate)
-- =====================================================
-- Drop all overloads of create_employee_complete
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'create_employee_complete'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS update_employee_complete_v2(UUID, JSONB);
DROP FUNCTION IF EXISTS block_employee_complete(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS activate_employee_complete(UUID, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS delete_employee_complete(UUID, UUID);
DROP FUNCTION IF EXISTS check_employee_exists(TEXT, TEXT, TEXT);

-- =====================================================
-- 1. CREATE EMPLOYEE COMPLETE (NEW)
-- =====================================================
CREATE OR REPLACE FUNCTION create_employee_complete(
    -- Personal Details
    p_employee_id TEXT,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_cnic TEXT,
    p_cnic_file_url TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_emergency_contact TEXT DEFAULT NULL,
    p_emergency_contact_name TEXT DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_blood_group TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    
    -- Role & Access
    p_role user_role DEFAULT 'waiter',
    p_permissions JSONB DEFAULT '{}'::JSONB,
    p_portal_enabled BOOLEAN DEFAULT TRUE,
    
    -- Payroll
    p_base_salary NUMERIC DEFAULT 25000,
    p_payment_frequency TEXT DEFAULT 'monthly',
    p_bank_details JSONB DEFAULT '{}'::JSONB,
    
    -- Hiring
    p_hired_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    
    -- License
    p_license_id TEXT DEFAULT NULL,
    p_license_expires_days INT DEFAULT 7,
    
    -- Documents (JSONB array of {type, number, file_url})
    p_documents JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_new_employee_id UUID;
    v_generated_emp_id TEXT;
    v_generated_license_id TEXT;
    v_current_month INT;
    v_current_year INT;
    v_doc JSONB;
    v_result JSONB;
BEGIN
    -- Generate employee_id if not provided
    v_generated_emp_id := COALESCE(NULLIF(p_employee_id, ''), 
        CASE p_role::TEXT
            WHEN 'admin' THEN 'ADM-'
            WHEN 'manager' THEN 'MGR-'
            WHEN 'waiter' THEN 'WTR-'
            WHEN 'billing_staff' THEN 'BIL-'
            WHEN 'kitchen_staff' THEN 'KIT-'
            WHEN 'delivery_rider' THEN 'DLR-'
            ELSE 'EMP-'
        END || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
    );
    
    -- Generate license_id if not provided
    v_generated_license_id := COALESCE(NULLIF(p_license_id, ''),
        'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
    );
    
    -- Get current month/year for payroll
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- =====================================================
    -- 1. INSERT EMPLOYEE
    -- =====================================================
    INSERT INTO employees (
        employee_id,
        name,
        email,
        phone,
        role,
        status,
        permissions,
        salary,
        hired_date,
        license_id,
        avatar_url,
        address,
        emergency_contact,
        emergency_contact_name,
        date_of_birth,
        blood_group,
        portal_enabled,
        bank_details,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_generated_emp_id,
        p_name,
        LOWER(p_email),
        REGEXP_REPLACE(p_phone, '\s', '', 'g'),
        p_role,
        'inactive',
        p_permissions,
        p_base_salary,
        p_hired_date,
        v_generated_license_id,
        p_avatar_url,
        p_address,
        p_emergency_contact,
        p_emergency_contact_name,
        p_date_of_birth,
        p_blood_group,
        p_portal_enabled,
        p_bank_details,
        p_notes,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_employee_id;
    
    -- =====================================================
    -- 2. INSERT LICENSE
    -- =====================================================
    INSERT INTO employee_licenses (
        employee_id,
        license_id,
        issued_at,
        is_used,
        expires_at
    ) VALUES (
        v_new_employee_id,
        v_generated_license_id,
        NOW(),
        FALSE,
        NOW() + (p_license_expires_days || ' days')::INTERVAL
    );
    
    -- =====================================================
    -- 3. INSERT CNIC DOCUMENT (Primary ID)
    -- =====================================================
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        INSERT INTO employee_documents (
            employee_id,
            document_type,
            document_name,
            file_url,
            file_type,
            uploaded_at,
            verified
        ) VALUES (
            v_new_employee_id,
            'cnic',
            REGEXP_REPLACE(p_cnic, '-', '', 'g'),
            COALESCE(p_cnic_file_url, ''),
            CASE WHEN p_cnic_file_url IS NOT NULL AND p_cnic_file_url != '' THEN 'image' ELSE 'text' END,
            NOW(),
            FALSE
        );
    END IF;
    
    -- =====================================================
    -- 4. INSERT ADDITIONAL DOCUMENTS (Bulk insert)
    -- =====================================================
    IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
        INSERT INTO employee_documents (
            employee_id,
            document_type,
            document_name,
            file_url,
            file_type,
            uploaded_at,
            verified
        )
        SELECT 
            v_new_employee_id,
            doc->>'type',
            COALESCE(doc->>'number', doc->>'type'),
            COALESCE(doc->>'file_url', ''),
            COALESCE(doc->>'file_type', 'unknown'),
            NOW(),
            FALSE
        FROM jsonb_array_elements(p_documents) AS doc
        WHERE doc->>'type' != 'cnic'
          AND (
              (doc->>'number' IS NOT NULL AND doc->>'number' != '') OR
              (doc->>'file_url' IS NOT NULL AND doc->>'file_url' != '')
          );
    END IF;
    
    -- =====================================================
    -- 5. INSERT INITIAL PAYROLL RECORD
    -- =====================================================
    INSERT INTO employee_payroll (
        employee_id,
        month,
        year,
        base_salary,
        bonus,
        deductions,
        tips,
        total_amount,
        paid,
        created_at,
        updated_at
    ) VALUES (
        v_new_employee_id,
        v_current_month,
        v_current_year,
        COALESCE(p_base_salary, 0),
        0,
        0,
        0,
        COALESCE(p_base_salary, 0),
        FALSE,
        NOW(),
        NOW()
    );
    
    -- =====================================================
    -- 6. BUILD AND RETURN RESULT
    -- =====================================================
    SELECT jsonb_build_object(
        'success', TRUE,
        'data', jsonb_build_object(
            'employee', jsonb_build_object(
                'id', e.id,
                'employee_id', e.employee_id,
                'name', e.name,
                'email', e.email,
                'phone', e.phone,
                'role', e.role,
                'status', e.status,
                'license_id', e.license_id,
                'hired_date', e.hired_date,
                'portal_enabled', e.portal_enabled,
                'avatar_url', e.avatar_url,
                'created_at', e.created_at
            ),
            'employee_id', v_generated_emp_id,
            'license_id', v_generated_license_id,
            'license_expires_at', NOW() + (p_license_expires_days || ' days')::INTERVAL
        )
    ) INTO v_result
    FROM employees e
    WHERE e.id = v_new_employee_id;
    
    RETURN v_result;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Employee with this email, phone, or employee ID already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- =====================================================
GRANT EXECUTE ON FUNCTION create_employee_complete TO authenticated;

-- =====================================================
-- CHECK EMPLOYEE EXISTS FUNCTION (for validation before creation)
-- =====================================================
DROP FUNCTION IF EXISTS check_employee_exists(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION check_employee_exists(
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_cnic TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_employee RECORD;
    v_cnic_clean TEXT;
BEGIN
    -- Check by email
    IF p_email IS NOT NULL AND p_email != '' THEN
        SELECT id, name, email INTO v_employee
        FROM employees
        WHERE LOWER(email) = LOWER(p_email)
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'email',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email)
            );
        END IF;
    END IF;
    
    -- Check by phone
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT id, name, phone INTO v_employee
        FROM employees
        WHERE REGEXP_REPLACE(phone, '\s', '', 'g') = REGEXP_REPLACE(p_phone, '\s', '', 'g')
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'phone',
                'employee', jsonb_build_object('name', v_employee.name, 'phone', v_employee.phone)
            );
        END IF;
    END IF;
    
    -- Check by CNIC
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        v_cnic_clean := REGEXP_REPLACE(p_cnic, '-', '', 'g');
        
        SELECT e.id, e.name, e.email INTO v_employee
        FROM employee_documents d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.document_type = 'cnic'
          AND d.document_name = v_cnic_clean
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'cnic',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email)
            );
        END IF;
    END IF;
    
    -- No match found
    RETURN jsonb_build_object('exists', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_employee_exists TO authenticated;

-- =====================================================
-- CREATE INDEXES FOR FASTER LOOKUPS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_license_id ON employees(license_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_name ON employee_documents(document_name);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee_id ON employee_licenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_license_id ON employee_licenses(license_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_employee_id ON employee_payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_month_year ON employee_payroll(year, month);
