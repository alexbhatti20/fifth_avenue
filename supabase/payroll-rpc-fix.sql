-- =====================================================
-- FIXED PAYROLL RPCs
-- Removes is_manager_or_admin() check since we use JWT auth
-- All functions use SECURITY DEFINER to bypass RLS
-- Authorization is handled at API level, not database level
-- =====================================================

-- =====================================================
-- DROP EXISTING FUNCTIONS TO AVOID CONFLICTS
-- =====================================================
DROP FUNCTION IF EXISTS get_payroll_summary_v2(DATE, DATE);
DROP FUNCTION IF EXISTS get_payslips_v2(UUID, TEXT, DATE, DATE, INTEGER);
DROP FUNCTION IF EXISTS create_payslip_v2(UUID, DATE, DATE, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS update_payslip_status_v2(UUID, TEXT, TEXT);

-- =====================================================
-- 1. GET PAYROLL SUMMARY (v2 - No auth check)
-- =====================================================
CREATE OR REPLACE FUNCTION get_payroll_summary_v2(
    p_period_start DATE DEFAULT NULL,
    p_period_end DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_payroll', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE (p_period_start IS NULL OR period_start >= p_period_start)
            AND (p_period_end IS NULL OR period_end <= p_period_end)
        ),
        'pending_count', (
            SELECT COUNT(*)
            FROM payslips
            WHERE status = 'pending'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'pending'
        ),
        'paid_this_month', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'paid'
            AND paid_at >= date_trunc('month', CURRENT_DATE)
        ),
        'employees_count', (
            SELECT COUNT(*)
            FROM employees
            WHERE status = 'active'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. GET PAYSLIPS (v2 - No auth check)
-- =====================================================
CREATE OR REPLACE FUNCTION get_payslips_v2(
    p_employee_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'employee_id', p.employee_id,
            'employee', (
                SELECT json_build_object(
                    'id', e.id, 
                    'name', e.name, 
                    'role', e.role, 
                    'employee_id', e.employee_id,
                    'avatar_url', e.avatar_url
                )
                FROM employees e WHERE e.id = p.employee_id
            ),
            'period_start', p.period_start,
            'period_end', p.period_end,
            'base_salary', p.base_salary,
            'overtime_hours', p.overtime_hours,
            'overtime_rate', p.overtime_rate,
            'bonuses', p.bonuses,
            'deductions', p.deductions,
            'tax_amount', p.tax_amount,
            'net_salary', p.net_salary,
            'status', p.status,
            'payment_method', p.payment_method,
            'paid_at', p.paid_at,
            'notes', p.notes,
            'created_at', p.created_at
        )
        ORDER BY p.period_end DESC
    ) INTO result
    FROM payslips p
    WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_start_date IS NULL OR p.period_start >= p_start_date)
    AND (p_end_date IS NULL OR p.period_end <= p_end_date)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE PAYSLIP (v2 - No auth check)
-- =====================================================
CREATE OR REPLACE FUNCTION create_payslip_v2(
    p_employee_id UUID,
    p_period_start DATE,
    p_period_end DATE,
    p_base_salary DECIMAL,
    p_overtime_hours DECIMAL DEFAULT 0,
    p_overtime_rate DECIMAL DEFAULT 1.5,
    p_bonuses DECIMAL DEFAULT 0,
    p_deductions DECIMAL DEFAULT 0,
    p_tax_amount DECIMAL DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_id UUID;
    net_salary DECIMAL;
    overtime_pay DECIMAL;
BEGIN
    -- Calculate net salary
    overtime_pay := (p_base_salary / 30 / 8) * p_overtime_hours * p_overtime_rate;
    net_salary := p_base_salary + overtime_pay + p_bonuses - p_deductions - p_tax_amount;
    
    -- Insert new payslip
    INSERT INTO payslips (
        employee_id,
        period_start,
        period_end,
        base_salary,
        overtime_hours,
        overtime_rate,
        bonuses,
        deductions,
        tax_amount,
        net_salary,
        status,
        notes
    ) VALUES (
        p_employee_id,
        p_period_start,
        p_period_end,
        p_base_salary,
        p_overtime_hours,
        p_overtime_rate,
        p_bonuses,
        p_deductions,
        p_tax_amount,
        net_salary,
        'pending',
        p_notes
    )
    RETURNING id INTO new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', new_id,
        'net_salary', net_salary
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATE PAYSLIP STATUS (v2 - No auth check)
-- =====================================================
CREATE OR REPLACE FUNCTION update_payslip_status_v2(
    p_payslip_id UUID,
    p_status TEXT,
    p_payment_method TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    UPDATE payslips
    SET 
        status = p_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = p_payslip_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. DELETE PAYSLIP (v2 - No auth check)
-- =====================================================
CREATE OR REPLACE FUNCTION delete_payslip_v2(
    p_payslip_id UUID
)
RETURNS JSON AS $$
BEGIN
    DELETE FROM payslips WHERE id = p_payslip_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GET EMPLOYEE PAYROLL INFO (v2 - for employee details page)
-- =====================================================
CREATE OR REPLACE FUNCTION get_employee_payroll_v2(
    p_employee_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'employee', (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'employee_id', e.employee_id,
                'role', e.role
            )
            FROM employees e WHERE e.id = p_employee_id
        ),
        'payroll_settings', (
            SELECT json_build_object(
                'base_salary', ep.base_salary,
                'payment_frequency', ep.payment_frequency,
                'bank_details', ep.bank_details
            )
            FROM employee_payroll ep WHERE ep.employee_id = p_employee_id
        ),
        'recent_payslips', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', p.id,
                    'period_start', p.period_start,
                    'period_end', p.period_end,
                    'base_salary', p.base_salary,
                    'net_salary', p.net_salary,
                    'status', p.status,
                    'paid_at', p.paid_at
                )
                ORDER BY p.period_end DESC
            ), '[]'::json)
            FROM payslips p 
            WHERE p.employee_id = p_employee_id
            LIMIT p_limit
        ),
        'total_paid', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE employee_id = p_employee_id AND status = 'paid'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE employee_id = p_employee_id AND status = 'pending'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_payroll_summary_v2(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_payslips_v2(UUID, TEXT, DATE, DATE, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_payslip_v2(UUID, DATE, DATE, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_payslip_status_v2(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_payslip_v2(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_employee_payroll_v2(UUID, INTEGER) TO anon, authenticated;

-- Also grant anon access to existing employee_payroll_summary if it doesn't have it
GRANT EXECUTE ON FUNCTION get_employee_payroll_summary(UUID) TO anon;

-- =====================================================
-- REPORTS RPCs (v2 - No auth check)
-- =====================================================

DROP FUNCTION IF EXISTS get_category_sales_report_v2(DATE, DATE);

-- Get category sales report (v2 - No auth check)
CREATE OR REPLACE FUNCTION get_category_sales_report_v2(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'category', mc.name,
            'category_id', mc.id,
            'total_sales', COALESCE(sales.total, 0),
            'order_count', COALESCE(sales.order_count, 0),
            'items_sold', COALESCE(sales.items_sold, 0)
        )
        ORDER BY sales.total DESC NULLS LAST
    ) INTO result
    FROM menu_categories mc
    LEFT JOIN LATERAL (
        SELECT 
            SUM((item->>'subtotal')::decimal) as total,
            COUNT(DISTINCT o.id) as order_count,
            SUM((item->>'quantity')::int) as items_sold
        FROM orders o,
        jsonb_array_elements(o.items) as item
        JOIN menu_items mi ON mi.id = (item->>'id')::uuid
        WHERE mi.category_id = mc.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) sales ON true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_category_sales_report_v2(DATE, DATE) TO anon, authenticated;
