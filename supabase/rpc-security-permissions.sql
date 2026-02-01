-- =============================================
-- RPC Security Permissions Configuration
-- =============================================
-- Generated based on actual database function signatures
-- Run this migration to secure all RPC functions
-- =============================================

-- =============================================
-- SECTION 1: PUBLIC FUNCTIONS (anon + authenticated)
-- These are read-only functions for public data
-- =============================================

-- Get public reviews (for landing page) - accepts named parameters
REVOKE ALL ON FUNCTION get_public_reviews(
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_min_rating integer,
    p_limit integer,
    p_offset integer,
    p_sort text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_public_reviews(
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_min_rating integer,
    p_limit integer,
    p_offset integer,
    p_sort text
) FROM anon;
GRANT EXECUTE ON FUNCTION get_public_reviews(
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_min_rating integer,
    p_limit integer,
    p_offset integer,
    p_sort text
) TO anon;
GRANT EXECUTE ON FUNCTION get_public_reviews(
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_min_rating integer,
    p_limit integer,
    p_offset integer,
    p_sort text
) TO authenticated;

-- Get active payment methods (for checkout display)
REVOKE ALL ON FUNCTION get_active_payment_methods() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_payment_methods() FROM anon;
GRANT EXECUTE ON FUNCTION get_active_payment_methods() TO anon;
GRANT EXECUTE ON FUNCTION get_active_payment_methods() TO authenticated;

-- Get order creation data (menu items, deals for ordering)
REVOKE ALL ON FUNCTION get_order_creation_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_order_creation_data() FROM anon;
GRANT EXECUTE ON FUNCTION get_order_creation_data() TO anon;
GRANT EXECUTE ON FUNCTION get_order_creation_data() TO authenticated;

-- Mark review helpful (allows anonymous via IP tracking)
REVOKE ALL ON FUNCTION mark_review_helpful(
    p_review_id uuid,
    p_customer_id uuid,
    p_ip_address varchar
) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_review_helpful(
    p_review_id uuid,
    p_customer_id uuid,
    p_ip_address varchar
) FROM anon;
GRANT EXECUTE ON FUNCTION mark_review_helpful(
    p_review_id uuid,
    p_customer_id uuid,
    p_ip_address varchar
) TO anon;
GRANT EXECUTE ON FUNCTION mark_review_helpful(
    p_review_id uuid,
    p_customer_id uuid,
    p_ip_address varchar
) TO authenticated;

-- Validate employee license (for employee activation flow)
REVOKE ALL ON FUNCTION validate_employee_license(p_email text, p_license_id text) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_employee_license(p_email text, p_license_id text) FROM anon;
GRANT EXECUTE ON FUNCTION validate_employee_license(p_email text, p_license_id text) TO anon;
GRANT EXECUTE ON FUNCTION validate_employee_license(p_email text, p_license_id text) TO authenticated;

-- Validate promo code for billing (supports guest checkout)
REVOKE ALL ON FUNCTION validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric) FROM anon;
GRANT EXECUTE ON FUNCTION validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric) TO anon;
GRANT EXECUTE ON FUNCTION validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric) TO authenticated;

-- Activate employee portal (for employee activation)
REVOKE ALL ON FUNCTION activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text) FROM PUBLIC;
REVOKE ALL ON FUNCTION activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text) FROM anon;
GRANT EXECUTE ON FUNCTION activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text) TO anon;
GRANT EXECUTE ON FUNCTION activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text) TO authenticated;

-- =============================================
-- SECTION 2: CUSTOMER AUTHENTICATED FUNCTIONS
-- These require a valid customer JWT token
-- =============================================

-- Customer Favorites
REVOKE ALL ON FUNCTION get_favorite_ids(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_favorite_ids(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_favorite_ids(p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION toggle_favorite(p_customer_id uuid, p_item_id text, p_item_type text) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_favorite(p_customer_id uuid, p_item_id text, p_item_type text) FROM anon;
GRANT EXECUTE ON FUNCTION toggle_favorite(p_customer_id uuid, p_item_id text, p_item_type text) TO authenticated;

REVOKE ALL ON FUNCTION get_customer_favorites(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_favorites(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_favorites(p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION clear_all_favorites(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_all_favorites(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION clear_all_favorites(p_customer_id uuid) TO authenticated;

-- Customer Reviews
REVOKE ALL ON FUNCTION check_customer_review_limit(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_customer_review_limit(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION check_customer_review_limit(p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION submit_customer_review(
    p_customer_id uuid,
    p_rating integer,
    p_comment text,
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_order_id uuid,
    p_images jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_customer_review(
    p_customer_id uuid,
    p_rating integer,
    p_comment text,
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_order_id uuid,
    p_images jsonb
) FROM anon;
GRANT EXECUTE ON FUNCTION submit_customer_review(
    p_customer_id uuid,
    p_rating integer,
    p_comment text,
    p_review_type text,
    p_item_id uuid,
    p_meal_id uuid,
    p_order_id uuid,
    p_images jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION delete_customer_review(p_customer_id uuid, p_review_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_customer_review(p_customer_id uuid, p_review_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_customer_review(p_customer_id uuid, p_review_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION get_customer_reviews(p_customer_id uuid, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_reviews(p_customer_id uuid, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_reviews(p_customer_id uuid, p_limit integer, p_offset integer) TO authenticated;

-- Customer Loyalty & Promo
REVOKE ALL ON FUNCTION get_loyalty_balance(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_loyalty_balance(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_loyalty_balance(p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION get_customer_promo_codes(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_promo_codes(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_promo_codes(p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION check_promo_code_details(p_code text, p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_promo_code_details(p_code text, p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION check_promo_code_details(p_code text, p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION validate_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric) FROM anon;
GRANT EXECUTE ON FUNCTION validate_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric) TO authenticated;

REVOKE ALL ON FUNCTION record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric) FROM anon;
GRANT EXECUTE ON FUNCTION record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric) TO authenticated;

REVOKE ALL ON FUNCTION deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text) FROM PUBLIC;
REVOKE ALL ON FUNCTION deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text) FROM anon;
GRANT EXECUTE ON FUNCTION deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text) TO authenticated;

-- Customer Orders
REVOKE ALL ON FUNCTION get_customer_orders_paginated(p_customer_id uuid, p_limit integer, p_offset integer, p_status order_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_orders_paginated(p_customer_id uuid, p_limit integer, p_offset integer, p_status order_status) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_orders_paginated(p_customer_id uuid, p_limit integer, p_offset integer, p_status order_status) TO authenticated;

REVOKE ALL ON FUNCTION get_order_details(p_order_id uuid, p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_order_details(p_order_id uuid, p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_order_details(p_order_id uuid, p_customer_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION create_customer_order(
    p_customer_id uuid,
    p_order_number text,
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_customer_address text,
    p_order_type text,
    p_items jsonb,
    p_subtotal numeric,
    p_tax numeric,
    p_delivery_fee numeric,
    p_discount numeric,
    p_total numeric,
    p_payment_method text,
    p_payment_status text,
    p_table_number integer,
    p_notes text,
    p_transaction_id text,
    p_online_payment_method_id uuid,
    p_online_payment_details jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_customer_order(
    p_customer_id uuid,
    p_order_number text,
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_customer_address text,
    p_order_type text,
    p_items jsonb,
    p_subtotal numeric,
    p_tax numeric,
    p_delivery_fee numeric,
    p_discount numeric,
    p_total numeric,
    p_payment_method text,
    p_payment_status text,
    p_table_number integer,
    p_notes text,
    p_transaction_id text,
    p_online_payment_method_id uuid,
    p_online_payment_details jsonb
) FROM anon;
GRANT EXECUTE ON FUNCTION create_customer_order(
    p_customer_id uuid,
    p_order_number text,
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_customer_address text,
    p_order_type text,
    p_items jsonb,
    p_subtotal numeric,
    p_tax numeric,
    p_delivery_fee numeric,
    p_discount numeric,
    p_total numeric,
    p_payment_method text,
    p_payment_status text,
    p_table_number integer,
    p_notes text,
    p_transaction_id text,
    p_online_payment_method_id uuid,
    p_online_payment_details jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid) TO authenticated;

-- Customer Profile
REVOKE ALL ON FUNCTION update_customer_profile(p_customer_id uuid, p_name text, p_phone text, p_address text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_customer_profile(p_customer_id uuid, p_name text, p_phone text, p_address text) FROM anon;
GRANT EXECUTE ON FUNCTION update_customer_profile(p_customer_id uuid, p_name text, p_phone text, p_address text) TO authenticated;

REVOKE ALL ON FUNCTION toggle_2fa(p_customer_id uuid, p_enable boolean, p_secret text) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_2fa(p_customer_id uuid, p_enable boolean, p_secret text) FROM anon;
GRANT EXECUTE ON FUNCTION toggle_2fa(p_customer_id uuid, p_enable boolean, p_secret text) TO authenticated;

-- =============================================
-- SECTION 3: AUTH FUNCTIONS
-- Note: get_user_by_email needs anon access for login flow
-- Rate limiting in API routes prevents enumeration attacks
-- =============================================

-- Get user by email - needs anon for login flow (rate-limited in API)
REVOKE ALL ON FUNCTION get_user_by_email(p_email text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_by_email(p_email text) TO anon;
GRANT EXECUTE ON FUNCTION get_user_by_email(p_email text) TO authenticated;

REVOKE ALL ON FUNCTION update_customer_auth_user_id(p_email text, p_auth_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_customer_auth_user_id(p_email text, p_auth_user_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION update_customer_auth_user_id(p_email text, p_auth_user_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION log_password_reset_completion(p_email text, p_ip_address text) FROM PUBLIC;
REVOKE ALL ON FUNCTION log_password_reset_completion(p_email text, p_ip_address text) FROM anon;
GRANT EXECUTE ON FUNCTION log_password_reset_completion(p_email text, p_ip_address text) TO authenticated;

-- =============================================
-- SECTION 4: PORTAL EMPLOYEE FUNCTIONS
-- Require authenticated employee with portal access
-- =============================================

-- 2FA Functions (need anon access for login flow - user isn't authenticated yet)
REVOKE ALL ON FUNCTION get_employee_for_2fa(p_employee_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_employee_for_2fa(p_employee_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_employee_for_2fa(p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION update_employee_2fa_login(p_employee_id uuid, p_auth_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_employee_2fa_login(p_employee_id uuid, p_auth_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION update_employee_2fa_login(p_employee_id uuid, p_auth_user_id uuid) TO authenticated;

-- Check employee portal access (needed during login before token is issued)
REVOKE ALL ON FUNCTION check_employee_portal_access(p_email text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_employee_portal_access(p_email text) TO anon;
GRANT EXECUTE ON FUNCTION check_employee_portal_access(p_email text) TO authenticated;

REVOKE ALL ON FUNCTION get_employee_by_auth_user(p_auth_user_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employee_by_auth_user(p_auth_user_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_employee_by_auth_user(p_auth_user_id uuid) TO authenticated;

-- Employee Management
REVOKE ALL ON FUNCTION get_all_employees() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_employees() FROM anon;
GRANT EXECUTE ON FUNCTION get_all_employees() TO authenticated;

REVOKE ALL ON FUNCTION get_employee_complete(p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employee_complete(p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_employee_complete(p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION get_employee_profile_by_id(p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employee_profile_by_id(p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_employee_profile_by_id(p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION get_employees_paginated(p_page integer, p_limit integer, p_search text, p_role text, p_status text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employees_paginated(p_page integer, p_limit integer, p_search text, p_role text, p_status text) FROM anon;
GRANT EXECUTE ON FUNCTION get_employees_paginated(p_page integer, p_limit integer, p_search text, p_role text, p_status text) TO authenticated;

REVOKE ALL ON FUNCTION get_employees_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employees_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_employees_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION get_employee_payroll_v2(p_employee_id uuid, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employee_payroll_v2(p_employee_id uuid, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_employee_payroll_v2(p_employee_id uuid, p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION update_employee_complete(p_employee_id uuid, p_data jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_employee_complete(p_employee_id uuid, p_data jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION update_employee_complete(p_employee_id uuid, p_data jsonb) TO authenticated;

REVOKE ALL ON FUNCTION toggle_block_employee(p_employee_id uuid, p_reason text) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_block_employee(p_employee_id uuid, p_reason text) FROM anon;
GRANT EXECUTE ON FUNCTION toggle_block_employee(p_employee_id uuid, p_reason text) TO authenticated;

REVOKE ALL ON FUNCTION delete_employee(p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_employee(p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_employee(p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_employee_cascade(p_employee_id uuid, p_deleted_by uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_employee_cascade(p_employee_id uuid, p_deleted_by uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_employee_cascade(p_employee_id uuid, p_deleted_by uuid) TO authenticated;

-- Dashboard Stats
REVOKE ALL ON FUNCTION get_admin_dashboard_stats(p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_dashboard_stats(p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats(p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_hourly_sales(p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_hourly_sales(p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_hourly_sales(p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_hourly_sales_today() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_hourly_sales_today() FROM anon;
GRANT EXECUTE ON FUNCTION get_hourly_sales_today() TO authenticated;

REVOKE ALL ON FUNCTION get_waiter_dashboard_stats(p_employee_id uuid, p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_waiter_dashboard_stats(p_employee_id uuid, p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_waiter_dashboard_stats(p_employee_id uuid, p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_waiter_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_waiter_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION get_waiter_dashboard() TO authenticated;

REVOKE ALL ON FUNCTION get_kitchen_orders() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_kitchen_orders() FROM anon;
GRANT EXECUTE ON FUNCTION get_kitchen_orders() TO authenticated;

REVOKE ALL ON FUNCTION get_kitchen_orders_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_kitchen_orders_v2() FROM anon;
GRANT EXECUTE ON FUNCTION get_kitchen_orders_v2() TO authenticated;

REVOKE ALL ON FUNCTION get_kitchen_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_kitchen_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_kitchen_stats() TO authenticated;

REVOKE ALL ON FUNCTION get_rider_dashboard_stats(p_rider_id uuid, p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_rider_dashboard_stats(p_rider_id uuid, p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_rider_dashboard_stats(p_rider_id uuid, p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_rider_delivery_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_rider_delivery_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_rider_delivery_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) TO authenticated;

-- Orders Management
REVOKE ALL ON FUNCTION get_all_orders(p_status order_status, p_order_type order_type, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_orders(p_status order_status, p_order_type order_type, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_all_orders(p_status order_status, p_order_type order_type, p_limit integer, p_offset integer) TO authenticated;

REVOKE ALL ON FUNCTION get_orders_advanced(p_status text, p_order_type text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_orders_advanced(p_status text, p_order_type text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_orders_advanced(p_status text, p_order_type text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) TO authenticated;

REVOKE ALL ON FUNCTION get_orders_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_orders_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_orders_stats() TO authenticated;

REVOKE ALL ON FUNCTION update_order_status(p_order_id uuid, p_new_status order_status, p_notes text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_order_status(p_order_id uuid, p_new_status order_status, p_notes text) FROM anon;
GRANT EXECUTE ON FUNCTION update_order_status(p_order_id uuid, p_new_status order_status, p_notes text) TO authenticated;

REVOKE ALL ON FUNCTION update_order_status_quick(p_order_id uuid, p_status text, p_notes text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_order_status_quick(p_order_id uuid, p_status text, p_notes text) FROM anon;
GRANT EXECUTE ON FUNCTION update_order_status_quick(p_order_id uuid, p_status text, p_notes text) TO authenticated;

REVOKE ALL ON FUNCTION update_kitchen_order_status(p_order_id uuid, p_status text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_kitchen_order_status(p_order_id uuid, p_status text) FROM anon;
GRANT EXECUTE ON FUNCTION update_kitchen_order_status(p_order_id uuid, p_status text) TO authenticated;

-- Tables Management
REVOKE ALL ON FUNCTION get_tables_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_tables_status() FROM anon;
GRANT EXECUTE ON FUNCTION get_tables_status() TO authenticated;

REVOKE ALL ON FUNCTION get_tables_for_waiter() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_tables_for_waiter() FROM anon;
GRANT EXECUTE ON FUNCTION get_tables_for_waiter() TO authenticated;

REVOKE ALL ON FUNCTION claim_table_for_waiter(p_table_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_table_for_waiter(p_table_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION claim_table_for_waiter(p_table_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION assign_table_to_order(p_order_id uuid, p_table_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_table_to_order(p_order_id uuid, p_table_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION assign_table_to_order(p_order_id uuid, p_table_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION release_table(p_table_id uuid, p_tip_amount numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_table(p_table_id uuid, p_tip_amount numeric) FROM anon;
GRANT EXECUTE ON FUNCTION release_table(p_table_id uuid, p_tip_amount numeric) TO authenticated;

REVOKE ALL ON FUNCTION get_waiter_order_history(p_date date, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_waiter_order_history(p_date date, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_waiter_order_history(p_date date, p_limit integer, p_offset integer) TO authenticated;

REVOKE ALL ON FUNCTION lookup_customer(p_phone text, p_email text, p_name text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lookup_customer(p_phone text, p_email text, p_name text) FROM anon;
GRANT EXECUTE ON FUNCTION lookup_customer(p_phone text, p_email text, p_name text) TO authenticated;

REVOKE ALL ON FUNCTION get_menu_for_ordering() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_menu_for_ordering() FROM anon;
GRANT EXECUTE ON FUNCTION get_menu_for_ordering() TO authenticated;

-- Delivery Management
REVOKE ALL ON FUNCTION get_available_delivery_riders() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_available_delivery_riders() FROM anon;
GRANT EXECUTE ON FUNCTION get_available_delivery_riders() TO authenticated;

REVOKE ALL ON FUNCTION assign_delivery_rider(p_order_id uuid, p_rider_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_delivery_rider(p_order_id uuid, p_rider_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION assign_delivery_rider(p_order_id uuid, p_rider_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION accept_delivery_order(p_order_id uuid, p_rider_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_delivery_order(p_order_id uuid, p_rider_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION accept_delivery_order(p_order_id uuid, p_rider_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION complete_delivery_order(p_order_id uuid, p_notes text, p_rider_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_delivery_order(p_order_id uuid, p_notes text, p_rider_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION complete_delivery_order(p_order_id uuid, p_notes text, p_rider_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION cancel_delivery_order(p_order_id uuid, p_reason text, p_rider_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_delivery_order(p_order_id uuid, p_reason text, p_rider_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_delivery_order(p_order_id uuid, p_reason text, p_rider_id uuid) TO authenticated;

-- Billing & Invoices
REVOKE ALL ON FUNCTION get_billing_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_billing_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_billing_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION get_billing_pending_orders(p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_billing_pending_orders(p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_billing_pending_orders(p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION get_billable_orders(p_order_type text, p_status_filter text, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_billable_orders(p_order_type text, p_status_filter text, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_billable_orders(p_order_type text, p_status_filter text, p_limit integer, p_offset integer) TO authenticated;

REVOKE ALL ON FUNCTION get_recent_invoices(p_start_date timestamptz, p_end_date timestamptz, p_payment_method text, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_recent_invoices(p_start_date timestamptz, p_end_date timestamptz, p_payment_method text, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_recent_invoices(p_start_date timestamptz, p_end_date timestamptz, p_payment_method text, p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION get_order_for_billing(p_order_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_order_for_billing(p_order_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_order_for_billing(p_order_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION generate_quick_bill(p_order_id uuid, p_biller_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_quick_bill(p_order_id uuid, p_biller_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION generate_quick_bill(p_order_id uuid, p_biller_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION generate_advanced_invoice(
    p_order_id uuid,
    p_payment_method text,
    p_manual_discount numeric,
    p_tip numeric,
    p_service_charge numeric,
    p_promo_code text,
    p_loyalty_points_used integer,
    p_notes text,
    p_biller_id uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_advanced_invoice(
    p_order_id uuid,
    p_payment_method text,
    p_manual_discount numeric,
    p_tip numeric,
    p_service_charge numeric,
    p_promo_code text,
    p_loyalty_points_used integer,
    p_notes text,
    p_biller_id uuid
) FROM anon;
GRANT EXECUTE ON FUNCTION generate_advanced_invoice(
    p_order_id uuid,
    p_payment_method text,
    p_manual_discount numeric,
    p_tip numeric,
    p_service_charge numeric,
    p_promo_code text,
    p_loyalty_points_used integer,
    p_notes text,
    p_biller_id uuid
) TO authenticated;

REVOKE ALL ON FUNCTION get_invoice_details(p_invoice_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_invoice_details(p_invoice_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_invoice_details(p_invoice_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION mark_invoice_printed(p_invoice_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_invoice_printed(p_invoice_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION mark_invoice_printed(p_invoice_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION void_invoice(p_invoice_id uuid, p_reason text) FROM PUBLIC;
REVOKE ALL ON FUNCTION void_invoice(p_invoice_id uuid, p_reason text) FROM anon;
GRANT EXECUTE ON FUNCTION void_invoice(p_invoice_id uuid, p_reason text) TO authenticated;

-- Menu Management
REVOKE ALL ON FUNCTION get_menu_management_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_menu_management_data() FROM anon;
GRANT EXECUTE ON FUNCTION get_menu_management_data() TO authenticated;

REVOKE ALL ON FUNCTION delete_menu_item(p_item_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_menu_item(p_item_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_menu_item(p_item_id uuid) TO authenticated;

-- Deals Management
REVOKE ALL ON FUNCTION get_all_deals_with_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_deals_with_items() FROM anon;
GRANT EXECUTE ON FUNCTION get_all_deals_with_items() TO authenticated;

REVOKE ALL ON FUNCTION get_deal_with_items(p_deal_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_deal_with_items(p_deal_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_deal_with_items(p_deal_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION toggle_deal_active(p_deal_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_deal_active(p_deal_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION toggle_deal_active(p_deal_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_deal_cascade(p_deal_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_deal_cascade(p_deal_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_deal_cascade(p_deal_id uuid) TO authenticated;

-- Admin Reviews Management
REVOKE ALL ON FUNCTION get_admin_reviews_advanced(p_status text, p_min_rating integer, p_max_rating integer, p_has_reply boolean, p_sort_by text, p_limit integer, p_offset integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_reviews_advanced(p_status text, p_min_rating integer, p_max_rating integer, p_has_reply boolean, p_sort_by text, p_limit integer, p_offset integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_reviews_advanced(p_status text, p_min_rating integer, p_max_rating integer, p_has_reply boolean, p_sort_by text, p_limit integer, p_offset integer) TO authenticated;

REVOKE ALL ON FUNCTION get_admin_reviews_by_employee(p_employee_id uuid, p_status text, p_min_rating integer, p_max_rating integer, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_reviews_by_employee(p_employee_id uuid, p_status text, p_min_rating integer, p_max_rating integer, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_reviews_by_employee(p_employee_id uuid, p_status text, p_min_rating integer, p_max_rating integer, p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION get_all_review_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_review_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_all_review_stats() TO authenticated;

REVOKE ALL ON FUNCTION update_review_visibility(p_review_id uuid, p_is_visible boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_review_visibility(p_review_id uuid, p_is_visible boolean) FROM anon;
GRANT EXECUTE ON FUNCTION update_review_visibility(p_review_id uuid, p_is_visible boolean) TO authenticated;

REVOKE ALL ON FUNCTION update_review_visibility_by_employee(p_review_id uuid, p_is_visible boolean, p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_review_visibility_by_employee(p_review_id uuid, p_is_visible boolean, p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION update_review_visibility_by_employee(p_review_id uuid, p_is_visible boolean, p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION bulk_update_review_visibility(p_review_ids uuid[], p_is_visible boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_update_review_visibility(p_review_ids uuid[], p_is_visible boolean) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_update_review_visibility(p_review_ids uuid[], p_is_visible boolean) TO authenticated;

REVOKE ALL ON FUNCTION bulk_update_review_visibility_by_employee(p_review_ids uuid[], p_is_visible boolean, p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_update_review_visibility_by_employee(p_review_ids uuid[], p_is_visible boolean, p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_update_review_visibility_by_employee(p_review_ids uuid[], p_is_visible boolean, p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION reply_to_review_advanced(p_review_id uuid, p_reply text, p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reply_to_review_advanced(p_review_id uuid, p_reply text, p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION reply_to_review_advanced(p_review_id uuid, p_reply text, p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION reply_to_review_by_employee(p_review_id uuid, p_reply text, p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reply_to_review_by_employee(p_review_id uuid, p_reply text, p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION reply_to_review_by_employee(p_review_id uuid, p_reply text, p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_review_advanced(p_review_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_review_advanced(p_review_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_review_advanced(p_review_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_review_by_employee(p_review_id uuid, p_employee_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_review_by_employee(p_review_id uuid, p_employee_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_review_by_employee(p_review_id uuid, p_employee_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION set_all_reviews_visibility(p_is_visible boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_all_reviews_visibility(p_is_visible boolean) FROM anon;
GRANT EXECUTE ON FUNCTION set_all_reviews_visibility(p_is_visible boolean) TO authenticated;

-- Payroll Management
REVOKE ALL ON FUNCTION get_payslips_v2(p_employee_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_payslips_v2(p_employee_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_payslips_v2(p_employee_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION get_payroll_summary_v2(p_period_start date, p_period_end date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_payroll_summary_v2(p_period_start date, p_period_end date) FROM anon;
GRANT EXECUTE ON FUNCTION get_payroll_summary_v2(p_period_start date, p_period_end date) TO authenticated;

REVOKE ALL ON FUNCTION create_payslip_v2(
    p_employee_id uuid,
    p_period_start date,
    p_period_end date,
    p_base_salary numeric,
    p_overtime_hours numeric,
    p_overtime_rate numeric,
    p_bonuses numeric,
    p_deductions numeric,
    p_tax_amount numeric,
    p_notes text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_payslip_v2(
    p_employee_id uuid,
    p_period_start date,
    p_period_end date,
    p_base_salary numeric,
    p_overtime_hours numeric,
    p_overtime_rate numeric,
    p_bonuses numeric,
    p_deductions numeric,
    p_tax_amount numeric,
    p_notes text
) FROM anon;
GRANT EXECUTE ON FUNCTION create_payslip_v2(
    p_employee_id uuid,
    p_period_start date,
    p_period_end date,
    p_base_salary numeric,
    p_overtime_hours numeric,
    p_overtime_rate numeric,
    p_bonuses numeric,
    p_deductions numeric,
    p_tax_amount numeric,
    p_notes text
) TO authenticated;

REVOKE ALL ON FUNCTION update_payslip_status_v2(p_payslip_id uuid, p_status text, p_payment_method text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_payslip_status_v2(p_payslip_id uuid, p_status text, p_payment_method text) FROM anon;
GRANT EXECUTE ON FUNCTION update_payslip_status_v2(p_payslip_id uuid, p_status text, p_payment_method text) TO authenticated;

REVOKE ALL ON FUNCTION delete_payslip_v2(p_payslip_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_payslip_v2(p_payslip_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_payslip_v2(p_payslip_id uuid) TO authenticated;

-- Analytics & Reports
REVOKE ALL ON FUNCTION get_sales_analytics(p_start_date date, p_end_date date, p_group_by text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_sales_analytics(p_start_date date, p_end_date date, p_group_by text) FROM anon;
GRANT EXECUTE ON FUNCTION get_sales_analytics(p_start_date date, p_end_date date, p_group_by text) TO authenticated;

REVOKE ALL ON FUNCTION get_category_sales_report_v2(p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_category_sales_report_v2(p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_category_sales_report_v2(p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_employee_performance_report(p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_employee_performance_report(p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_employee_performance_report(p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_report() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_report() FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_report() TO authenticated;

-- Audit Logs
REVOKE ALL ON FUNCTION get_audit_logs(p_start_date date, p_end_date date, p_employee_id uuid, p_action_type text, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_audit_logs(p_start_date date, p_end_date date, p_employee_id uuid, p_action_type text, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_audit_logs(p_start_date date, p_end_date date, p_employee_id uuid, p_action_type text, p_limit integer) TO authenticated;

-- Notifications
REVOKE ALL ON FUNCTION get_my_notifications(p_limit integer, p_unread_only boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_my_notifications(p_limit integer, p_unread_only boolean) FROM anon;
GRANT EXECUTE ON FUNCTION get_my_notifications(p_limit integer, p_unread_only boolean) TO authenticated;

REVOKE ALL ON FUNCTION get_notifications(p_user_id uuid, p_user_type text, p_is_read boolean, p_limit integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_notifications(p_user_id uuid, p_user_type text, p_is_read boolean, p_limit integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_notifications(p_user_id uuid, p_user_type text, p_is_read boolean, p_limit integer) TO authenticated;

REVOKE ALL ON FUNCTION mark_notification_read(p_notification_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_notification_read(p_notification_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION mark_notification_read(p_notification_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION mark_all_notifications_read(p_user_type text) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_all_notifications_read(p_user_type text) FROM anon;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(p_user_type text) TO authenticated;

REVOKE ALL ON FUNCTION get_unread_notification_count(p_user_type text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_unread_notification_count(p_user_type text) FROM anon;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(p_user_type text) TO authenticated;

-- Settings
REVOKE ALL ON FUNCTION get_website_settings_internal() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_website_settings_internal() FROM anon;
GRANT EXECUTE ON FUNCTION get_website_settings_internal() TO authenticated;

REVOKE ALL ON FUNCTION upsert_website_settings_internal(p_settings jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_website_settings_internal(p_settings jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_website_settings_internal(p_settings jsonb) TO authenticated;

-- Perks & Promo Admin
REVOKE ALL ON FUNCTION get_all_perks_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_perks_settings() FROM anon;
GRANT EXECUTE ON FUNCTION get_all_perks_settings() TO authenticated;

REVOKE ALL ON FUNCTION get_all_customers_loyalty(p_limit integer, p_offset integer, p_search text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_customers_loyalty(p_limit integer, p_offset integer, p_search text) FROM anon;
GRANT EXECUTE ON FUNCTION get_all_customers_loyalty(p_limit integer, p_offset integer, p_search text) TO authenticated;

REVOKE ALL ON FUNCTION get_all_customer_promo_codes_admin(p_limit integer, p_offset integer, p_filter text, p_search text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_customer_promo_codes_admin(p_limit integer, p_offset integer, p_filter text, p_search text) FROM anon;
GRANT EXECUTE ON FUNCTION get_all_customer_promo_codes_admin(p_limit integer, p_offset integer, p_filter text, p_search text) TO authenticated;

REVOKE ALL ON FUNCTION update_perks_setting(p_setting_key text, p_setting_value jsonb, p_description text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_perks_setting(p_setting_key text, p_setting_value jsonb, p_description text) FROM anon;
GRANT EXECUTE ON FUNCTION update_perks_setting(p_setting_key text, p_setting_value jsonb, p_description text) TO authenticated;

REVOKE ALL ON FUNCTION deactivate_customer_promo_admin(p_promo_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION deactivate_customer_promo_admin(p_promo_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION deactivate_customer_promo_admin(p_promo_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION activate_customer_promo_admin(p_promo_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION activate_customer_promo_admin(p_promo_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION activate_customer_promo_admin(p_promo_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_customer_promo_admin(p_promo_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_customer_promo_admin(p_promo_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_customer_promo_admin(p_promo_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION bulk_activate_promo_codes_admin(p_promo_ids uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_activate_promo_codes_admin(p_promo_ids uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_activate_promo_codes_admin(p_promo_ids uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION bulk_deactivate_promo_codes_admin(p_promo_ids uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_deactivate_promo_codes_admin(p_promo_ids uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_deactivate_promo_codes_admin(p_promo_ids uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION bulk_delete_promo_codes_admin(p_promo_ids uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_delete_promo_codes_admin(p_promo_ids uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_delete_promo_codes_admin(p_promo_ids uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION cleanup_expired_customer_promos() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_customer_promos() FROM anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_customer_promos() TO authenticated;

-- Customers Admin
REVOKE ALL ON FUNCTION get_all_customers_admin(p_limit integer, p_offset integer, p_search text, p_filter text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_customers_admin(p_limit integer, p_offset integer, p_search text, p_filter text) FROM anon;
GRANT EXECUTE ON FUNCTION get_all_customers_admin(p_limit integer, p_offset integer, p_search text, p_filter text) TO authenticated;

REVOKE ALL ON FUNCTION get_customers_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customers_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_customers_stats() TO authenticated;

REVOKE ALL ON FUNCTION get_customer_detail_admin(p_customer_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_detail_admin(p_customer_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_detail_admin(p_customer_id uuid) TO authenticated;

-- Attendance
REVOKE ALL ON FUNCTION get_attendance_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_attendance_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_attendance_stats() TO authenticated;

REVOKE ALL ON FUNCTION get_today_attendance() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_today_attendance() FROM anon;
GRANT EXECUTE ON FUNCTION get_today_attendance() TO authenticated;

-- Inventory Management
REVOKE ALL ON FUNCTION get_inventory_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_items() FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_items() TO authenticated;

REVOKE ALL ON FUNCTION delete_inventory_item(p_item_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_inventory_item(p_item_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_inventory_item(p_item_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION bulk_update_stock(p_items jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION bulk_update_stock(p_items jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION bulk_update_stock(p_items jsonb) TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_summary() FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_summary() TO authenticated;

REVOKE ALL ON FUNCTION get_low_stock_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_low_stock_items() FROM anon;
GRANT EXECUTE ON FUNCTION get_low_stock_items() TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_movement_report(p_start_date date, p_end_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_movement_report(p_start_date date, p_end_date date) FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_movement_report(p_start_date date, p_end_date date) TO authenticated;

REVOKE ALL ON FUNCTION get_expiring_items(p_days integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_expiring_items(p_days integer) FROM anon;
GRANT EXECUTE ON FUNCTION get_expiring_items(p_days integer) TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_value_by_category() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_value_by_category() FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_value_by_category() TO authenticated;

REVOKE ALL ON FUNCTION generate_reorder_suggestions() FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_reorder_suggestions() FROM anon;
GRANT EXECUTE ON FUNCTION generate_reorder_suggestions() TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_suppliers() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_suppliers() FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_suppliers() TO authenticated;

REVOKE ALL ON FUNCTION get_inventory_alerts(p_unread_only boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_alerts(p_unread_only boolean) FROM anon;
GRANT EXECUTE ON FUNCTION get_inventory_alerts(p_unread_only boolean) TO authenticated;

REVOKE ALL ON FUNCTION mark_inventory_alert_read(p_alert_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_inventory_alert_read(p_alert_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION mark_inventory_alert_read(p_alert_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION resolve_inventory_alert(p_alert_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_inventory_alert(p_alert_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION resolve_inventory_alert(p_alert_id uuid) TO authenticated;

-- Payment Methods Admin
REVOKE ALL ON FUNCTION get_all_payment_methods_internal() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_all_payment_methods_internal() FROM anon;
GRANT EXECUTE ON FUNCTION get_all_payment_methods_internal() TO authenticated;

REVOKE ALL ON FUNCTION delete_payment_method_internal(p_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_payment_method_internal(p_id uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_payment_method_internal(p_id uuid) TO authenticated;

REVOKE ALL ON FUNCTION toggle_payment_method_status_internal(p_id uuid, p_is_active boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION toggle_payment_method_status_internal(p_id uuid, p_is_active boolean) FROM anon;
GRANT EXECUTE ON FUNCTION toggle_payment_method_status_internal(p_id uuid, p_is_active boolean) TO authenticated;

-- =============================================
-- END OF PERMISSIONS FILE
-- =============================================
