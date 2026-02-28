-- ============================================================
--  ZOIRO – Full RLS Policy Export
--  Generated: 2026-02-28
--  Source: pg_policies (public + storage schemas)
-- ============================================================

-- Usage:
--   Run this file against your Supabase project to re-apply
--   all Row Level Security policies exactly as they exist today.
--   Policies are DROPped first so the script is idempotent.
-- ============================================================


-- ┌─────────────────────────────────────────────────────────┐
-- │  attendance                                             │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_attendance" ON public.attendance;
CREATE POLICY "admins_manage_attendance"
  ON public.attendance AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin() OR (employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))))
  WITH CHECK (is_admin() OR (employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  audit_logs                                             │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;
CREATE POLICY "System can create audit logs"
  ON public.audit_logs AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_manage_audit_logs"
  ON public.audit_logs AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_system"
  ON public.audit_logs AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  contact_messages                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything with contact messages" ON public.contact_messages;
CREATE POLICY "Admins can do everything with contact messages"
  ON public.contact_messages AS PERMISSIVE FOR ALL
  TO authenticated
  USING  ((EXISTS ( SELECT 1 FROM employees e WHERE ((e.auth_user_id = auth.uid()) AND (e.role = 'admin'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees e WHERE ((e.auth_user_id = auth.uid()) AND (e.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Allow insert for API" ON public.contact_messages;
CREATE POLICY "Allow insert for API"
  ON public.contact_messages AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Managers can update contact messages" ON public.contact_messages;
CREATE POLICY "Managers can update contact messages"
  ON public.contact_messages AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((EXISTS ( SELECT 1 FROM employees e WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees e WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))));

DROP POLICY IF EXISTS "Managers can view and update contact messages" ON public.contact_messages;
CREATE POLICY "Managers can view and update contact messages"
  ON public.contact_messages AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1 FROM employees e WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  customer_invoice_records                               │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.customer_invoice_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_invoice_records_insert" ON public.customer_invoice_records;
CREATE POLICY "customer_invoice_records_insert"
  ON public.customer_invoice_records AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "customer_invoice_records_select" ON public.customer_invoice_records;
CREATE POLICY "customer_invoice_records_select"
  ON public.customer_invoice_records AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  customer_promo_codes                                   │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.customer_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_promo_delete" ON public.customer_promo_codes;
CREATE POLICY "customer_promo_delete"
  ON public.customer_promo_codes AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_promo_insert" ON public.customer_promo_codes;
CREATE POLICY "customer_promo_insert"
  ON public.customer_promo_codes AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "customer_promo_select" ON public.customer_promo_codes;
CREATE POLICY "customer_promo_select"
  ON public.customer_promo_codes AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_promo_update" ON public.customer_promo_codes;
CREATE POLICY "customer_promo_update"
  ON public.customer_promo_codes AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  customers                                              │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create customer" ON public.customers;
CREATE POLICY "Anyone can create customer"
  ON public.customers AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
CREATE POLICY "Customers can update own profile"
  ON public.customers AS PERMISSIVE FOR UPDATE
  TO public
  USING ((auth.uid() = auth_user_id));

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile"
  ON public.customers AS PERMISSIVE FOR SELECT
  TO public
  USING ((auth.uid() = auth_user_id));

DROP POLICY IF EXISTS "customers_delete_admin" ON public.customers;
CREATE POLICY "customers_delete_admin"
  ON public.customers AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "customers_insert_system" ON public.customers;
CREATE POLICY "customers_insert_system"
  ON public.customers AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "customers_select_anon" ON public.customers;
CREATE POLICY "customers_select_anon"
  ON public.customers AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
CREATE POLICY "customers_select_own"
  ON public.customers AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((auth_user_id = auth.uid()) OR is_employee());

DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
CREATE POLICY "customers_update_own"
  ON public.customers AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((auth_user_id = auth.uid()))
  WITH CHECK ((auth_user_id = auth.uid()));


-- ┌─────────────────────────────────────────────────────────┐
-- │  deal_items                                             │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.deal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage deal items" ON public.deal_items;
CREATE POLICY "Admins can manage deal items"
  ON public.deal_items AS PERMISSIVE FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1 FROM employees WHERE (employees.auth_user_id = auth.uid()))));

DROP POLICY IF EXISTS "Anyone can view deal items" ON public.deal_items;
CREATE POLICY "Anyone can view deal items"
  ON public.deal_items AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "deal_items_delete_employees" ON public.deal_items;
CREATE POLICY "deal_items_delete_employees"
  ON public.deal_items AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "deal_items_insert_employees" ON public.deal_items;
CREATE POLICY "deal_items_insert_employees"
  ON public.deal_items AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "deal_items_select_all" ON public.deal_items;
CREATE POLICY "deal_items_select_all"
  ON public.deal_items AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "deal_items_update_employees" ON public.deal_items;
CREATE POLICY "deal_items_update_employees"
  ON public.deal_items AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  (true)
  WITH CHECK (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  deals                                                  │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active deals" ON public.deals;
CREATE POLICY "Anyone can view active deals"
  ON public.deals AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_active = true) AND ((now() >= COALESCE(valid_from, now())) AND (now() <= COALESCE(valid_until, (now() + '100 years'::interval)))));

DROP POLICY IF EXISTS "deals_delete_employees" ON public.deals;
CREATE POLICY "deals_delete_employees"
  ON public.deals AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "deals_insert_employees" ON public.deals;
CREATE POLICY "deals_insert_employees"
  ON public.deals AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "deals_manage_admin" ON public.deals;
CREATE POLICY "deals_manage_admin"
  ON public.deals AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "deals_select_all" ON public.deals;
CREATE POLICY "deals_select_all"
  ON public.deals AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "deals_select_anon" ON public.deals;
CREATE POLICY "deals_select_anon"
  ON public.deals AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "deals_select_public" ON public.deals;
CREATE POLICY "deals_select_public"
  ON public.deals AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_active = true) AND ((valid_from IS NULL) OR (valid_from <= now())) AND ((valid_until IS NULL) OR (valid_until >= now())));

DROP POLICY IF EXISTS "deals_update_employees" ON public.deals;
CREATE POLICY "deals_update_employees"
  ON public.deals AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  (true)
  WITH CHECK (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  delivery_history                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_history_insert" ON public.delivery_history;
CREATE POLICY "delivery_history_insert"
  ON public.delivery_history AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_history_select_own" ON public.delivery_history;
CREATE POLICY "delivery_history_select_own"
  ON public.delivery_history AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((rider_id = get_employee_id()) OR (EXISTS ( SELECT 1 FROM employees e WHERE ((e.id = get_employee_id()) AND (e.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))));

DROP POLICY IF EXISTS "delivery_history_update_own" ON public.delivery_history;
CREATE POLICY "delivery_history_update_own"
  ON public.delivery_history AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((rider_id = get_employee_id()))
  WITH CHECK ((rider_id = get_employee_id()));


-- ┌─────────────────────────────────────────────────────────┐
-- │  employee_documents                                     │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage employee_documents" ON public.employee_documents;
CREATE POLICY "Admins can manage employee_documents"
  ON public.employee_documents AS PERMISSIVE FOR ALL
  TO public
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees can view own documents" ON public.employee_documents;
CREATE POLICY "Employees can view own documents"
  ON public.employee_documents AS PERMISSIVE FOR SELECT
  TO public
  USING ((employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))));

DROP POLICY IF EXISTS "admins_manage_employee_documents" ON public.employee_documents;
CREATE POLICY "admins_manage_employee_documents"
  ON public.employee_documents AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin() OR (employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))))
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  employee_licenses                                      │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.employee_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage employee_licenses" ON public.employee_licenses;
CREATE POLICY "Admins can manage employee_licenses"
  ON public.employee_licenses AS PERMISSIVE FOR ALL
  TO public
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Allow license activation" ON public.employee_licenses;
CREATE POLICY "Allow license activation"
  ON public.employee_licenses AS PERMISSIVE FOR UPDATE
  TO public
  USING  ((is_used = false))
  WITH CHECK (true);

DROP POLICY IF EXISTS "Employees can view own license" ON public.employee_licenses;
CREATE POLICY "Employees can view own license"
  ON public.employee_licenses AS PERMISSIVE FOR SELECT
  TO public
  USING ((employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))));

DROP POLICY IF EXISTS "admins_manage_employee_licenses" ON public.employee_licenses;
CREATE POLICY "admins_manage_employee_licenses"
  ON public.employee_licenses AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin() OR (employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))))
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  employee_payroll                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage employee_payroll" ON public.employee_payroll;
CREATE POLICY "Admins can manage employee_payroll"
  ON public.employee_payroll AS PERMISSIVE FOR ALL
  TO public
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees can view own payroll" ON public.employee_payroll;
CREATE POLICY "Employees can view own payroll"
  ON public.employee_payroll AS PERMISSIVE FOR SELECT
  TO public
  USING ((employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))));

DROP POLICY IF EXISTS "admins_manage_employee_payroll" ON public.employee_payroll;
CREATE POLICY "admins_manage_employee_payroll"
  ON public.employee_payroll AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin() OR (employee_id IN ( SELECT employees.id FROM employees WHERE (employees.auth_user_id = auth.uid()))))
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  employees                                              │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can update own profile" ON public.employees;
CREATE POLICY "Employees can update own profile"
  ON public.employees AS PERMISSIVE FOR UPDATE
  TO public
  USING ((auth.uid() = auth_user_id));

DROP POLICY IF EXISTS "Employees can view own profile" ON public.employees;
CREATE POLICY "Employees can view own profile"
  ON public.employees AS PERMISSIVE FOR SELECT
  TO public
  USING ((auth.uid() = auth_user_id));

DROP POLICY IF EXISTS "admins_delete_employees" ON public.employees;
CREATE POLICY "admins_delete_employees"
  ON public.employees AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admins_insert_employees" ON public.employees;
CREATE POLICY "admins_insert_employees"
  ON public.employees AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins_select_employees" ON public.employees;
CREATE POLICY "admins_select_employees"
  ON public.employees AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_admin() OR (auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_update_employees" ON public.employees;
CREATE POLICY "admins_update_employees"
  ON public.employees AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  (is_admin() OR (auth_user_id = auth.uid()))
  WITH CHECK (is_admin() OR (auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "employees_delete_admin" ON public.employees;
CREATE POLICY "employees_delete_admin"
  ON public.employees AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "employees_insert_admin" ON public.employees;
CREATE POLICY "employees_insert_admin"
  ON public.employees AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select"
  ON public.employees AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((auth_user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "employees_update_admin" ON public.employees;
CREATE POLICY "employees_update_admin"
  ON public.employees AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory                                              │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view inventory" ON public.inventory;
CREATE POLICY "Employees can view inventory"
  ON public.inventory AS PERMISSIVE FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::employee_status)))));

DROP POLICY IF EXISTS "Managers can manage inventory" ON public.inventory;
CREATE POLICY "Managers can manage inventory"
  ON public.inventory AS PERMISSIVE FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::employee_status) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory_alerts                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_inventory_alerts" ON public.inventory_alerts;
CREATE POLICY "admins_manage_inventory_alerts"
  ON public.inventory_alerts AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory_categories                                   │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_inventory_categories" ON public.inventory_categories;
CREATE POLICY "admins_manage_inventory_categories"
  ON public.inventory_categories AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory_purchase_orders                              │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_inventory_purchase_orders" ON public.inventory_purchase_orders;
CREATE POLICY "admins_manage_inventory_purchase_orders"
  ON public.inventory_purchase_orders AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory_suppliers                                    │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_inventory_suppliers" ON public.inventory_suppliers;
CREATE POLICY "admins_manage_inventory_suppliers"
  ON public.inventory_suppliers AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  inventory_transactions                                 │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can insert transactions" ON public.inventory_transactions;
CREATE POLICY "Employees can insert transactions"
  ON public.inventory_transactions AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::employee_status)))));

DROP POLICY IF EXISTS "Employees can view transactions" ON public.inventory_transactions;
CREATE POLICY "Employees can view transactions"
  ON public.inventory_transactions AS PERMISSIVE FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::employee_status)))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  leave_balances                                         │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers update leave balances" ON public.leave_balances;
CREATE POLICY "Managers update leave balances"
  ON public.leave_balances AS PERMISSIVE FOR ALL
  TO public
  USING (is_manager_or_admin());

DROP POLICY IF EXISTS "View own leave balance" ON public.leave_balances;
CREATE POLICY "View own leave balance"
  ON public.leave_balances AS PERMISSIVE FOR SELECT
  TO public
  USING ((employee_id = get_employee_id()) OR is_manager_or_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  leave_requests                                         │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees insert own leave requests" ON public.leave_requests;
CREATE POLICY "Employees insert own leave requests"
  ON public.leave_requests AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK ((employee_id = get_employee_id()));

DROP POLICY IF EXISTS "Employees view own leave requests" ON public.leave_requests;
CREATE POLICY "Employees view own leave requests"
  ON public.leave_requests AS PERMISSIVE FOR SELECT
  TO public
  USING ((employee_id = get_employee_id()) OR is_manager_or_admin());

DROP POLICY IF EXISTS "Managers update leave requests" ON public.leave_requests;
CREATE POLICY "Managers update leave requests"
  ON public.leave_requests AS PERMISSIVE FOR UPDATE
  TO public
  USING (((employee_id = get_employee_id()) AND ((status)::text = 'pending'::text)) OR is_manager_or_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  loyalty_points                                         │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage loyalty points" ON public.loyalty_points;
CREATE POLICY "System can manage loyalty points"
  ON public.loyalty_points AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "loyalty_insert_system" ON public.loyalty_points;
CREATE POLICY "loyalty_insert_system"
  ON public.loyalty_points AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "loyalty_points_insert_anon" ON public.loyalty_points;
CREATE POLICY "loyalty_points_insert_anon"
  ON public.loyalty_points AS PERMISSIVE FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "loyalty_points_select_anon" ON public.loyalty_points;
CREATE POLICY "loyalty_points_select_anon"
  ON public.loyalty_points AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "loyalty_select_own" ON public.loyalty_points;
CREATE POLICY "loyalty_select_own"
  ON public.loyalty_points AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = get_my_customer_id()) OR is_employee());


-- ┌─────────────────────────────────────────────────────────┐
-- │  maintenance_mode                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read maintenance status" ON public.maintenance_mode;
CREATE POLICY "Anyone can read maintenance status"
  ON public.maintenance_mode AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only admin can modify maintenance mode" ON public.maintenance_mode;
CREATE POLICY "Only admin can modify maintenance mode"
  ON public.maintenance_mode AS PERMISSIVE FOR ALL
  TO public
  USING (is_admin());


-- ┌─────────────────────────────────────────────────────────┐
-- │  meals                                                  │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available meals" ON public.meals;
CREATE POLICY "Anyone can view available meals"
  ON public.meals AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_available = true));

DROP POLICY IF EXISTS "meals_manage_admin" ON public.meals;
CREATE POLICY "meals_manage_admin"
  ON public.meals AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "meals_select_anon" ON public.meals;
CREATE POLICY "meals_select_anon"
  ON public.meals AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "meals_select_public" ON public.meals;
CREATE POLICY "meals_select_public"
  ON public.meals AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_available = true));


-- ┌─────────────────────────────────────────────────────────┐
-- │  menu_categories                                        │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_delete_admin" ON public.menu_categories;
CREATE POLICY "categories_delete_admin"
  ON public.menu_categories AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "categories_insert_admin" ON public.menu_categories;
CREATE POLICY "categories_insert_admin"
  ON public.menu_categories AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_select_employee" ON public.menu_categories;
CREATE POLICY "categories_select_employee"
  ON public.menu_categories AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "categories_select_public" ON public.menu_categories;
CREATE POLICY "categories_select_public"
  ON public.menu_categories AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_visible = true));

DROP POLICY IF EXISTS "categories_update_admin" ON public.menu_categories;
CREATE POLICY "categories_update_admin"
  ON public.menu_categories AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "menu_categories_delete_admin" ON public.menu_categories;
CREATE POLICY "menu_categories_delete_admin"
  ON public.menu_categories AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = 'admin'::user_role) AND (employees.status = 'active'::employee_status)))));

DROP POLICY IF EXISTS "menu_categories_insert_admin" ON public.menu_categories;
CREATE POLICY "menu_categories_insert_admin"
  ON public.menu_categories AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (employees.status = 'active'::employee_status)))));

DROP POLICY IF EXISTS "menu_categories_select_employee" ON public.menu_categories;
CREATE POLICY "menu_categories_select_employee"
  ON public.menu_categories AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::employee_status)))));

DROP POLICY IF EXISTS "menu_categories_select_public" ON public.menu_categories;
CREATE POLICY "menu_categories_select_public"
  ON public.menu_categories AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_visible = true));

DROP POLICY IF EXISTS "menu_categories_update_admin" ON public.menu_categories;
CREATE POLICY "menu_categories_update_admin"
  ON public.menu_categories AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (employees.status = 'active'::employee_status)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (employees.status = 'active'::employee_status)))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  menu_items                                             │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available items" ON public.menu_items;
CREATE POLICY "Anyone can view available items"
  ON public.menu_items AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_available = true));

DROP POLICY IF EXISTS "menu_items_delete_admin" ON public.menu_items;
CREATE POLICY "menu_items_delete_admin"
  ON public.menu_items AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "menu_items_insert_admin" ON public.menu_items;
CREATE POLICY "menu_items_insert_admin"
  ON public.menu_items AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "menu_items_select_anon" ON public.menu_items;
CREATE POLICY "menu_items_select_anon"
  ON public.menu_items AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "menu_items_select_employee" ON public.menu_items;
CREATE POLICY "menu_items_select_employee"
  ON public.menu_items AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "menu_items_select_public" ON public.menu_items;
CREATE POLICY "menu_items_select_public"
  ON public.menu_items AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_available = true));

DROP POLICY IF EXISTS "menu_items_update_employees" ON public.menu_items;
CREATE POLICY "menu_items_update_employees"
  ON public.menu_items AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((EXISTS ( SELECT 1 FROM employees WHERE (employees.auth_user_id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees WHERE (employees.auth_user_id = auth.uid()))));


-- ┌─────────────────────────────────────────────────────────┐
-- │  notifications                                          │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
  ON public.notifications AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_insert_anon" ON public.notifications;
CREATE POLICY "notifications_insert_anon"
  ON public.notifications AS PERMISSIVE FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system"
  ON public.notifications AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((((user_type)::text = 'customer'::text) AND (user_id = get_my_customer_id())) OR (((user_type)::text = 'employee'::text) AND (user_id = get_my_employee_id())));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((((user_type)::text = 'customer'::text) AND (user_id = get_my_customer_id())) OR (((user_type)::text = 'employee'::text) AND (user_id = get_my_employee_id())));


-- ┌─────────────────────────────────────────────────────────┐
-- │  order_activity_log                                     │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.order_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert order activity logs" ON public.order_activity_log;
CREATE POLICY "Authenticated users can insert order activity logs"
  ON public.order_activity_log AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view order activity logs" ON public.order_activity_log;
CREATE POLICY "Authenticated users can view order activity logs"
  ON public.order_activity_log AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  order_status_history                                   │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_history_insert" ON public.order_status_history;
CREATE POLICY "order_history_insert"
  ON public.order_status_history AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (is_employee());

DROP POLICY IF EXISTS "order_history_select" ON public.order_status_history;
CREATE POLICY "order_history_select"
  ON public.order_status_history AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((order_id IN ( SELECT orders.id FROM orders WHERE (orders.customer_id = get_my_customer_id()))) OR is_employee());

DROP POLICY IF EXISTS "order_status_history_insert" ON public.order_status_history;
CREATE POLICY "order_status_history_insert"
  ON public.order_status_history AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "order_status_history_insert_anon" ON public.order_status_history;
CREATE POLICY "order_status_history_insert_anon"
  ON public.order_status_history AS PERMISSIVE FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "order_status_history_select" ON public.order_status_history;
CREATE POLICY "order_status_history_select"
  ON public.order_status_history AS PERMISSIVE FOR SELECT
  TO public
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  orders                                                 │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;
CREATE POLICY "orders_insert_anon"
  ON public.orders AS PERMISSIVE FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;
CREATE POLICY "orders_insert_customer"
  ON public.orders AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "orders_select_anon" ON public.orders;
CREATE POLICY "orders_select_anon"
  ON public.orders AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "orders_select_customer" ON public.orders;
CREATE POLICY "orders_select_customer"
  ON public.orders AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "orders_select_employee" ON public.orders;
CREATE POLICY "orders_select_employee"
  ON public.orders AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "orders_update_customer" ON public.orders;
CREATE POLICY "orders_update_customer"
  ON public.orders AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (((customer_id = get_my_customer_id()) AND (status = 'pending'::order_status)));

DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;
CREATE POLICY "orders_update_staff"
  ON public.orders AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (is_employee());


-- ┌─────────────────────────────────────────────────────────┐
-- │  otp_codes                                              │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow OTP operations" ON public.otp_codes;
CREATE POLICY "Allow OTP operations"
  ON public.otp_codes AS PERMISSIVE FOR ALL
  TO public
  USING  (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read OTP for verification" ON public.otp_codes;
CREATE POLICY "Public can read OTP for verification"
  ON public.otp_codes AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "System can create OTP" ON public.otp_codes;
CREATE POLICY "System can create OTP"
  ON public.otp_codes AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update OTP" ON public.otp_codes;
CREATE POLICY "System can update OTP"
  ON public.otp_codes AS PERMISSIVE FOR UPDATE
  TO public
  USING (true);

DROP POLICY IF EXISTS "otp_insert_public" ON public.otp_codes;
CREATE POLICY "otp_insert_public"
  ON public.otp_codes AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "otp_select_public" ON public.otp_codes;
CREATE POLICY "otp_select_public"
  ON public.otp_codes AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "otp_update_public" ON public.otp_codes;
CREATE POLICY "otp_update_public"
  ON public.otp_codes AS PERMISSIVE FOR UPDATE
  TO anon, authenticated
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  password_reset_otps                                    │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.password_reset_otps;
CREATE POLICY "Service role only"
  ON public.password_reset_otps AS PERMISSIVE FOR ALL
  TO public
  USING  (false)
  WITH CHECK (false);


-- ┌─────────────────────────────────────────────────────────┐
-- │  password_reset_rate_limits                             │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.password_reset_rate_limits;
CREATE POLICY "Service role only"
  ON public.password_reset_rate_limits AS PERMISSIVE FOR ALL
  TO public
  USING  (false)
  WITH CHECK (false);


-- ┌─────────────────────────────────────────────────────────┐
-- │  payment_methods                                        │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admin can manage payment methods"
  ON public.payment_methods AS PERMISSIVE FOR ALL
  TO public
  USING (is_manager_or_admin());

DROP POLICY IF EXISTS "Public can view active payment methods" ON public.payment_methods;
CREATE POLICY "Public can view active payment methods"
  ON public.payment_methods AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_active = true));


-- ┌─────────────────────────────────────────────────────────┐
-- │  payment_records                                        │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_records_insert_customer" ON public.payment_records;
CREATE POLICY "payment_records_insert_customer"
  ON public.payment_records AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "payment_records_select_customer" ON public.payment_records;
CREATE POLICY "payment_records_select_customer"
  ON public.payment_records AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "payment_records_select_employee" ON public.payment_records;
CREATE POLICY "payment_records_select_employee"
  ON public.payment_records AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "payment_records_update_staff" ON public.payment_records;
CREATE POLICY "payment_records_update_staff"
  ON public.payment_records AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['admin'::text, 'cashier'::text]));


-- ┌─────────────────────────────────────────────────────────┐
-- │  perks_settings                                         │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.perks_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perks_settings_insert" ON public.perks_settings;
CREATE POLICY "perks_settings_insert"
  ON public.perks_settings AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "perks_settings_select" ON public.perks_settings;
CREATE POLICY "perks_settings_select"
  ON public.perks_settings AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "perks_settings_select_anon" ON public.perks_settings;
CREATE POLICY "perks_settings_select_anon"
  ON public.perks_settings AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "perks_settings_update" ON public.perks_settings;
CREATE POLICY "perks_settings_update"
  ON public.perks_settings AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  promo_code_usage                                       │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_code_usage_insert_anon" ON public.promo_code_usage;
CREATE POLICY "promo_code_usage_insert_anon"
  ON public.promo_code_usage AS PERMISSIVE FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "promo_usage_insert" ON public.promo_code_usage;
CREATE POLICY "promo_usage_insert"
  ON public.promo_code_usage AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "promo_usage_select_own" ON public.promo_code_usage;
CREATE POLICY "promo_usage_select_own"
  ON public.promo_code_usage AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = get_my_customer_id()) OR is_employee());


-- ┌─────────────────────────────────────────────────────────┐
-- │  promo_codes                                            │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_delete_admin" ON public.promo_codes;
CREATE POLICY "promo_codes_delete_admin"
  ON public.promo_codes AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (promo_codes.is_active = true)))));

DROP POLICY IF EXISTS "promo_codes_delete_employees" ON public.promo_codes;
CREATE POLICY "promo_codes_delete_employees"
  ON public.promo_codes AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "promo_codes_insert_admin" ON public.promo_codes;
CREATE POLICY "promo_codes_insert_admin"
  ON public.promo_codes AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (promo_codes.is_active = true)))));

DROP POLICY IF EXISTS "promo_codes_insert_employees" ON public.promo_codes;
CREATE POLICY "promo_codes_insert_employees"
  ON public.promo_codes AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "promo_codes_select_all" ON public.promo_codes;
CREATE POLICY "promo_codes_select_all"
  ON public.promo_codes AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "promo_codes_select_general" ON public.promo_codes;
CREATE POLICY "promo_codes_select_general"
  ON public.promo_codes AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id IS NULL));

DROP POLICY IF EXISTS "promo_codes_select_own" ON public.promo_codes;
CREATE POLICY "promo_codes_select_own"
  ON public.promo_codes AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = auth.uid()));

DROP POLICY IF EXISTS "promo_codes_update_admin" ON public.promo_codes;
CREATE POLICY "promo_codes_update_admin"
  ON public.promo_codes AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1 FROM employees WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])) AND (promo_codes.is_active = true)))));

DROP POLICY IF EXISTS "promo_codes_update_employees" ON public.promo_codes;
CREATE POLICY "promo_codes_update_employees"
  ON public.promo_codes AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  (true)
  WITH CHECK (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  review_helpful_votes                                   │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert helpful votes" ON public.review_helpful_votes;
CREATE POLICY "Anyone can insert helpful votes"
  ON public.review_helpful_votes AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view helpful votes" ON public.review_helpful_votes;
CREATE POLICY "Anyone can view helpful votes"
  ON public.review_helpful_votes AS PERMISSIVE FOR SELECT
  TO public
  USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  reviews                                                │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;
CREATE POLICY "Anyone can view visible reviews"
  ON public.reviews AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_visible = true));

DROP POLICY IF EXISTS "Customers can create reviews" ON public.reviews;
CREATE POLICY "Customers can create reviews"
  ON public.reviews AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK ((customer_id IS NOT NULL));

DROP POLICY IF EXISTS "Customers can delete own reviews" ON public.reviews;
CREATE POLICY "Customers can delete own reviews"
  ON public.reviews AS PERMISSIVE FOR DELETE
  TO public
  USING ((customer_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
CREATE POLICY "Customers can update own reviews"
  ON public.reviews AS PERMISSIVE FOR UPDATE
  TO public
  USING ((customer_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view visible reviews" ON public.reviews;
CREATE POLICY "Public can view visible reviews"
  ON public.reviews AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_visible = true));

DROP POLICY IF EXISTS "reviews_insert_customer" ON public.reviews;
CREATE POLICY "reviews_insert_customer"
  ON public.reviews AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((customer_id = get_my_customer_id()) AND (order_id IN ( SELECT orders.id FROM orders WHERE ((orders.customer_id = get_my_customer_id()) AND (orders.status = 'delivered'::order_status)))));

DROP POLICY IF EXISTS "reviews_manage_admin" ON public.reviews;
CREATE POLICY "reviews_manage_admin"
  ON public.reviews AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "reviews_select_own" ON public.reviews;
CREATE POLICY "reviews_select_own"
  ON public.reviews AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((customer_id = get_my_customer_id()));

DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public"
  ON public.reviews AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_visible = true));

DROP POLICY IF EXISTS "reviews_update_customer" ON public.reviews;
CREATE POLICY "reviews_update_customer"
  ON public.reviews AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((customer_id = get_my_customer_id()))
  WITH CHECK ((customer_id = get_my_customer_id()));


-- ┌─────────────────────────────────────────────────────────┐
-- │  site_content                                           │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active content" ON public.site_content;
CREATE POLICY "Anyone can view active content"
  ON public.site_content AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_active = true));

DROP POLICY IF EXISTS "site_content_manage_admin" ON public.site_content;
CREATE POLICY "site_content_manage_admin"
  ON public.site_content AS PERMISSIVE FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "site_content_select_anon" ON public.site_content;
CREATE POLICY "site_content_select_anon"
  ON public.site_content AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "site_content_select_public" ON public.site_content;
CREATE POLICY "site_content_select_public"
  ON public.site_content AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((is_active = true));


-- ┌─────────────────────────────────────────────────────────┐
-- │  waiter_order_history                                   │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE public.waiter_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waiter_history_insert" ON public.waiter_order_history;
CREATE POLICY "waiter_history_insert"
  ON public.waiter_order_history AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "waiter_history_select" ON public.waiter_order_history;
CREATE POLICY "waiter_history_select"
  ON public.waiter_order_history AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((waiter_id = get_employee_id()) OR (EXISTS ( SELECT 1 FROM employees e WHERE ((e.id = get_employee_id()) AND (e.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role]))))));

DROP POLICY IF EXISTS "waiter_history_update" ON public.waiter_order_history;
CREATE POLICY "waiter_history_update"
  ON public.waiter_order_history AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING  ((waiter_id = get_employee_id()))
  WITH CHECK ((waiter_id = get_employee_id()));


-- ┌─────────────────────────────────────────────────────────┐
-- │  storage.objects                                        │
-- └─────────────────────────────────────────────────────────┘
DROP POLICY IF EXISTS "avatars_authenticated_all" ON storage.objects;
CREATE POLICY "avatars_authenticated_all"
  ON storage.objects AS PERMISSIVE FOR ALL
  TO authenticated
  USING  ((bucket_id = 'avatars'::text))
  WITH CHECK ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects AS PERMISSIVE FOR SELECT
  TO public
  USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "documents_authenticated_all" ON storage.objects;
CREATE POLICY "documents_authenticated_all"
  ON storage.objects AS PERMISSIVE FOR ALL
  TO authenticated
  USING  ((bucket_id = 'documents'::text))
  WITH CHECK ((bucket_id = 'documents'::text));

DROP POLICY IF EXISTS "images_authenticated_all" ON storage.objects;
CREATE POLICY "images_authenticated_all"
  ON storage.objects AS PERMISSIVE FOR ALL
  TO authenticated
  USING  ((bucket_id = 'images'::text))
  WITH CHECK ((bucket_id = 'images'::text));

DROP POLICY IF EXISTS "images_public_read" ON storage.objects;
CREATE POLICY "images_public_read"
  ON storage.objects AS PERMISSIVE FOR SELECT
  TO public
  USING ((bucket_id = 'images'::text));

DROP POLICY IF EXISTS "reviews_authenticated_all" ON storage.objects;
CREATE POLICY "reviews_authenticated_all"
  ON storage.objects AS PERMISSIVE FOR ALL
  TO authenticated
  USING  ((bucket_id = 'reviews'::text))
  WITH CHECK ((bucket_id = 'reviews'::text));

DROP POLICY IF EXISTS "reviews_public_read" ON storage.objects;
CREATE POLICY "reviews_public_read"
  ON storage.objects AS PERMISSIVE FOR SELECT
  TO public
  USING ((bucket_id = 'reviews'::text));


-- ============================================================
--  END OF RLS POLICY EXPORT
--  Tables covered: 33 public tables + storage.objects
--  Total policies: 160
-- ============================================================
