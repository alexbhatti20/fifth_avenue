# 🔒 Supabase Security & Performance Audit Report

**Project:** Zoiro Broast Hub  
**Date:** January 28, 2026  
**Audit Type:** Comprehensive Database Security & Performance Review

---

## 📊 Executive Summary

| Category | Status | Count |
|----------|--------|-------|
| 🔴 Critical Issues | Immediate Action Required | 12 |
| 🟠 High Severity Issues | Action Required | 18 |
| 🟡 Medium Severity Issues | Should Fix | 25 |
| 🟢 Low Severity Issues | Nice to Fix | 15 |
| **Total Issues Found** | | **70** |

---

## 🗄️ Database Overview

### Tables Summary
- **Total Tables:** 51 public tables
- **Tables with RLS Enabled:** 35
- **Tables without RLS:** 16 ⚠️
- **Tables without any Policies:** 17 ⚠️

### Functions Summary
- **Total RPC Functions:** 350+
- **Functions with SECURITY DEFINER:** ALL (100%) ⚠️
- **Functions granted to `anon`:** 200+ ⚠️
- **Functions without Exception Handling:** 50+ ⚠️

---

## 🔴 CRITICAL SECURITY ISSUES (P0)

### 1. OTP Codes Table Completely Exposed
**Table:** `otp_codes`  
**RLS Status:** ❌ DISABLED  
**Issue:** Anyone can read/write/delete OTP codes without authentication

```sql
-- Current vulnerable policies:
"Allow OTP operations" - cmd: ALL, qual: true, with_check: true
"Public can read OTP for verification" - cmd: SELECT, qual: true
```

**Risk:** 
- Attackers can intercept OTP codes for any email
- Account takeover vulnerability
- Password reset hijacking

**Fix:**
```sql
-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies
DROP POLICY IF EXISTS "Allow OTP operations" ON otp_codes;
DROP POLICY IF EXISTS "Public can read OTP for verification" ON otp_codes;
DROP POLICY IF EXISTS "otp_select_public" ON otp_codes;

-- Use RPC function to verify OTP instead of direct access
```

---

### 2. Tables Without RLS (Data Exposure)

The following **16 tables** have RLS disabled, exposing all data:

| Table | Sensitive Data | Risk Level |
|-------|---------------|------------|
| `attendance_codes` | Daily codes | 🔴 Critical |
| `invoices` | Financial records | 🔴 Critical |
| `payslips` | Salary information | 🔴 Critical |
| `otp_codes` | Authentication codes | 🔴 Critical |
| `attendance` | Employee attendance | 🟠 High |
| `loyalty_transactions` | Customer points | 🟠 High |
| `restaurant_tables` | Table assignments | 🟡 Medium |
| `order_cancellations` | Order data | 🟡 Medium |
| `table_exchange_requests` | Waiter data | 🟡 Medium |
| `table_history` | Order history | 🟡 Medium |
| `push_tokens` | Device tokens | 🟡 Medium |
| `reports_archive` | Business reports | 🟡 Medium |
| `waiter_tips` | Financial data | 🟡 Medium |
| `two_fa_setup` | 2FA secrets | 🟡 Medium |
| `website_content` | CMS data | 🟢 Low |
| `inventory_categories` | Stock info | 🟢 Low |

**Fix:**
```sql
-- Enable RLS on all sensitive tables
ALTER TABLE attendance_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_fa_setup ENABLE ROW LEVEL SECURITY;
```

---

### 3. Anonymous Users Can Execute Sensitive Functions

**200+ functions** are executable by `anon` role (unauthenticated users):

#### Financial Functions (CRITICAL):
```
- create_payslip_v2
- delete_payslip_v2
- get_payslips_v2
- get_payroll_summary_v2
- create_customer_order
- deduct_loyalty_points
- apply_promo_code
- generate_invoice
- confirm_payment
```

#### Employee Management (HIGH):
```
- create_employee
- create_employee_complete
- delete_employee
- activate_employee
- bulk_update_employee_status
- ban_customer
- admin_mark_attendance
```

#### Order & Delivery (HIGH):
```
- create_portal_order
- cancel_order
- assign_delivery_rider
- complete_delivery
- create_dine_in_order
```

**Fix:**
```sql
-- Revoke anon access from sensitive functions
REVOKE EXECUTE ON FUNCTION create_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION delete_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION create_employee_complete FROM anon;
REVOKE EXECUTE ON FUNCTION delete_employee FROM anon;
REVOKE EXECUTE ON FUNCTION ban_customer FROM anon;
REVOKE EXECUTE ON FUNCTION deduct_loyalty_points FROM anon;
-- ... repeat for all sensitive functions
```

---

### 4. Privilege Escalation - Customer Auth Update

**Function:** `update_customer_auth_user_id`  
**Issue:** Anonymous users can link any email to their auth account

```sql
-- Current: Allows anon to update auth_user_id for ANY customer
GRANT EXECUTE ON FUNCTION update_customer_auth_user_id(TEXT, UUID) TO anon;
```

**Risk:** Account takeover - attacker creates auth account, then links it to victim's email

**Fix:**
```sql
-- Only allow authenticated users to update their own auth
REVOKE EXECUTE ON FUNCTION update_customer_auth_user_id FROM anon;

-- Add validation in function
IF (SELECT auth_user_id FROM customers WHERE email = p_email) IS NOT NULL THEN
    RAISE EXCEPTION 'Customer already has an auth account linked';
END IF;
```

---

### 5. Loyalty Points Can Be Manipulated

**Policies on `loyalty_points`:**
```sql
"loyalty_points_insert_anon" - anon can INSERT with true
"loyalty_points_select_anon" - anon can SELECT all
```

**Risk:** Anonymous users can:
- Add unlimited loyalty points to any customer
- View all customers' loyalty balances
- Potential financial fraud

**Fix:**
```sql
DROP POLICY IF EXISTS "loyalty_points_insert_anon" ON loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_select_anon" ON loyalty_points;

-- Only allow through RPC functions with proper validation
```

---

## 🟠 HIGH SEVERITY ISSUES (P1)

### 6. Missing Input Validation in Functions

#### 6.1 No Amount Validation
**Function:** `apply_promo_code`
```sql
CREATE OR REPLACE FUNCTION apply_promo_code(
    p_code TEXT,
    p_customer_id UUID,
    p_order_amount DECIMAL  -- No validation!
)
```
**Issue:** Negative amounts could bypass discount logic

#### 6.2 No Format Validation
**Function:** `create_employee_complete`
```sql
p_cnic TEXT,      -- Should be 13 digits, no validation
p_phone TEXT,     -- No phone format validation  
p_email TEXT,     -- Only lowercased, no format check
```

**Fix:**
```sql
-- Add at start of functions
IF p_order_amount <= 0 THEN
    RAISE EXCEPTION 'Order amount must be positive';
END IF;

IF p_cnic !~ '^\d{13}$' THEN
    RAISE EXCEPTION 'CNIC must be 13 digits';
END IF;

IF p_phone !~ '^\+?[\d\s-]{10,15}$' THEN
    RAISE EXCEPTION 'Invalid phone format';
END IF;

IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
END IF;
```

---

### 7. Race Conditions

#### 7.1 Attendance Code Race Condition
**Function:** `mark_attendance_with_code`
```sql
SELECT * INTO code_record
FROM attendance_codes
WHERE code = UPPER(TRIM(p_code))
AND is_active = true
-- No FOR UPDATE lock!
```

**Issue:** Multiple employees can use same single-use code simultaneously

**Fix:**
```sql
SELECT * INTO code_record
FROM attendance_codes
WHERE code = UPPER(TRIM(p_code))
AND is_active = true
FOR UPDATE SKIP LOCKED;  -- Add row lock
```

#### 7.2 Promo Code Race Condition
**Function:** `apply_promo_code`
**Issue:** `current_usage` check and update not atomic

**Fix:**
```sql
UPDATE promo_codes
SET current_usage = current_usage + 1
WHERE id = v_promo.id
AND current_usage < max_usage  -- Atomic check
RETURNING current_usage INTO v_new_usage;

IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Promo code limit reached');
END IF;
```

---

### 8. Data Leakage via Error Messages

**Function:** `create_portal_order`
```sql
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,      -- Exposes DB internals!
        'detail', SQLSTATE
    );
END;
```

**Risk:** Error messages reveal table names, column names, constraint names

**Fix:**
```sql
EXCEPTION WHEN OTHERS THEN
    -- Log detailed error internally
    INSERT INTO error_logs (error_message, error_detail, error_context)
    VALUES (SQLERRM, SQLSTATE, pg_exception_context());
    
    -- Return generic message to client
    RETURN json_build_object(
        'success', false,
        'error', 'An error occurred processing your request',
        'error_code', 'INTERNAL_ERROR'
    );
END;
```

---

### 9. Overly Permissive RLS Policies

#### 9.1 `customer_promo_codes` - Anyone Can Delete Any Promo
```sql
"customer_promo_delete" - DELETE, qual: true  -- No restriction!
```

#### 9.2 `perks_settings` - Any User Can Modify Settings
```sql
"perks_settings_update" - UPDATE, qual: true  -- No admin check!
"perks_settings_insert" - INSERT, with_check: true
```

#### 9.3 `deal_items` - Any Authenticated User Has Full Access
```sql
"deal_items_delete_employees" - DELETE, qual: true
"deal_items_insert_employees" - INSERT, with_check: true
"deal_items_update_employees" - UPDATE, qual: true
```

#### 9.4 `promo_codes` - Any Authenticated Can Delete/Update
```sql
"promo_codes_delete_employees" - DELETE, qual: true
"promo_codes_update_employees" - UPDATE, qual: true
```

**Fix:**
```sql
-- Replace with role-based policies
DROP POLICY "customer_promo_delete" ON customer_promo_codes;
CREATE POLICY "customer_promo_delete_admin" ON customer_promo_codes
    FOR DELETE TO authenticated
    USING (is_admin() OR customer_id = get_my_customer_id());

DROP POLICY "perks_settings_update" ON perks_settings;
CREATE POLICY "perks_settings_update_admin" ON perks_settings
    FOR UPDATE TO authenticated
    USING (is_admin());
```

---

### 10. Order Status History Public Insert

```sql
"order_status_history_insert" - cmd: INSERT, roles: {public}, with_check: true
"order_status_history_insert_anon" - cmd: INSERT, roles: {anon}, with_check: true
```

**Issue:** Anyone can insert fake order status history records

**Fix:**
```sql
DROP POLICY "order_status_history_insert" ON order_status_history;
DROP POLICY "order_status_history_insert_anon" ON order_status_history;

-- Only employees can insert
CREATE POLICY "order_status_history_insert_employee" ON order_status_history
    FOR INSERT TO authenticated
    WITH CHECK (is_employee());
```

---

### 11. 50+ Functions Without Exception Handling

The following functions have **NO exception handling** (will crash on errors):

```
activate_customer_promo_admin    add_items_to_order
add_order_loyalty_points         adjust_inventory_stock
apply_promo_code                 assign_table_to_order
ban_customer                     bulk_delete_promo_codes_admin
cancel_order                     cancel_order_by_waiter
check_customer_auth_status       cleanup_expired_customer_promos
complete_delivery                confirm_payment
create_bulk_notifications        create_deal_with_items
create_employee                  create_inventory_item
create_menu_item                 create_notification
create_order_with_items          create_payslip_v2
create_table                     delete_deal_cascade
delete_employee                  delete_inventory_item
delete_menu_category             delete_menu_item
delete_payslip_v2                delete_review
generate_advanced_invoice        generate_attendance_code
generate_invoice                 get_inventory_items
get_orders_advanced              mark_attendance_with_code
... and 20+ more
```

**Fix Template:**
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    -- Function logic here
    
    RETURN result;
    
EXCEPTION 
    WHEN unique_violation THEN
        RETURN json_build_object('success', false, 'error', 'Duplicate entry');
    WHEN foreign_key_violation THEN
        RETURN json_build_object('success', false, 'error', 'Related record not found');
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Operation failed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🟡 MEDIUM SEVERITY ISSUES (P2)

### 12. Hardcoded Values That Should Be Configurable

#### 12.1 Tax Rate Hardcoded
**File:** `create-order-rpc.sql`
```sql
v_tax := ROUND(v_subtotal * 0.16, 2);  -- 16% GST hardcoded
```

#### 12.2 Late Time Threshold Hardcoded
**File:** `attendance-rpc.sql`
```sql
new_status := CASE 
    WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'  -- Hardcoded
    ELSE 'present'
END;
```

#### 12.3 Order Delay Thresholds Hardcoded
```sql
AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) > 300 -- 5 min hardcoded
AND EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at)) > 900 -- 15 min hardcoded
```

**Fix:** Move to `perks_settings` or create `system_config` table
```sql
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config VALUES
('tax_rate', '0.16', 'GST rate'),
('late_time', '"09:30:00"', 'Time after which attendance is late'),
('order_delay_pending', '300', 'Seconds before pending order is delayed'),
('order_delay_preparing', '900', 'Seconds before preparing order is delayed');
```

---

### 13. Tables Missing updated_at Trigger

The following tables have `updated_at` column but NO auto-update trigger:

```
push_tokens          payslips             attendance
meals                reviews              site_content
menu_categories      deals                delivery_history
waiter_order_history perks_settings       payment_methods
inventory_suppliers  inventory_purchase_orders
```

**Fix:**
```sql
-- Create generic trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for all tables...
```

---

### 14. 37 Duplicate Indexes Wasting Space

| Table | Duplicate Index 1 | Duplicate Index 2 |
|-------|------------------|------------------|
| `attendance` | attendance_employee_id_date_key | idx_attendance_employee_date |
| `customer_promo_codes` | customer_promo_codes_code_key | idx_customer_promo_code |
| `customers` | customers_auth_user_id_key | idx_customers_auth_user |
| `customers` | customers_email_key | idx_customers_email |
| `customers` | customers_phone_key | idx_customers_phone |
| `deals` | deals_code_key | idx_deals_code |
| `employees` | employees_auth_user_id_key | idx_employees_auth_user |
| `employees` | employees_email_key | idx_employees_email |
| `employees` | employees_employee_id_key | idx_employees_employee_id |
| `employees` | employees_phone_key | idx_employees_phone |
| `employee_documents` | idx_employee_docs_employee | idx_employee_documents_employee |
| `invoices` | idx_invoices_created | idx_invoices_created_date |
| `invoices` | idx_invoices_customer | idx_invoices_customer_id |
| `invoices` | idx_invoices_order | idx_invoices_order_id |
| `loyalty_points` | idx_loyalty_customer | idx_loyalty_points_customer |
| `orders` | idx_orders_customer | idx_orders_customer_id |
| `orders` | idx_orders_order_number | orders_order_number_key |
| `otp_codes` | idx_otp_codes_expires | idx_otp_expires |
| `promo_codes` | idx_promo_code | promo_codes_code_key |
| `reviews` | idx_reviews_customer | idx_reviews_customer_id |
| `reviews` | idx_reviews_created_at | idx_reviews_created_at_desc |

**Fix:**
```sql
-- Drop duplicate indexes (keep the constraint ones)
DROP INDEX IF EXISTS idx_attendance_employee_date;
DROP INDEX IF EXISTS idx_customer_promo_code;
DROP INDEX IF EXISTS idx_customers_auth_user;
DROP INDEX IF EXISTS idx_customers_email;
DROP INDEX IF EXISTS idx_customers_phone;
DROP INDEX IF EXISTS idx_deals_code;
DROP INDEX IF EXISTS idx_employees_auth_user;
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_employee_id;
DROP INDEX IF EXISTS idx_employees_phone;
DROP INDEX IF EXISTS idx_employee_documents_employee;
DROP INDEX IF EXISTS idx_invoices_created;
DROP INDEX IF EXISTS idx_invoices_customer;
DROP INDEX IF EXISTS idx_invoices_order;
DROP INDEX IF EXISTS idx_loyalty_customer;
DROP INDEX IF EXISTS idx_orders_customer;
DROP INDEX IF EXISTS idx_otp_expires;
DROP INDEX IF EXISTS idx_promo_code;
DROP INDEX IF EXISTS idx_reviews_customer;
DROP INDEX IF EXISTS idx_reviews_created_at;
```

---

### 15. Columns Missing CHECK Constraints

| Table | Column | Should Validate |
|-------|--------|-----------------|
| `attendance` | status | ENUM: present, late, absent |
| `customers` | email | Email format |
| `customers` | phone | Phone format |
| `employees` | email | Email format |
| `employees` | phone | Phone format |
| `orders` | payment_status | ENUM values |
| `payment_records` | status | ENUM values |
| `payslips` | status | ENUM values |
| `table_exchange_requests` | status | ENUM values |

**Fix:**
```sql
-- Add CHECK constraints
ALTER TABLE customers 
ADD CONSTRAINT chk_customer_email 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE customers 
ADD CONSTRAINT chk_customer_phone 
CHECK (phone ~ '^\+?[\d\s-]{10,15}$');

ALTER TABLE payslips 
ADD CONSTRAINT chk_payslip_status 
CHECK (status IN ('pending', 'paid', 'cancelled'));
```

---

### 16. Nullable Columns That Should Be NOT NULL

**90+ columns** are nullable that should probably be required:

#### Critical (Referential Integrity):
- `employee_documents.employee_id` - FK should not be null
- `employee_licenses.employee_id` - FK should not be null
- `employee_payroll.employee_id` - FK should not be null
- `loyalty_points.customer_id` - FK should not be null
- `loyalty_transactions.customer_id` - FK should not be null
- `order_cancellations.order_id` - FK should not be null
- `order_status_history.order_id` - FK should not be null

#### Timestamp Columns:
All `created_at` columns should be NOT NULL with DEFAULT NOW()

**Fix:**
```sql
-- Add NOT NULL constraints (after fixing existing NULLs)
UPDATE employee_documents SET employee_id = '...' WHERE employee_id IS NULL;
ALTER TABLE employee_documents ALTER COLUMN employee_id SET NOT NULL;

-- For created_at columns
ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE customers ALTER COLUMN created_at SET NOT NULL;
```

---

### 17. Text Columns Without Length Constraints

**50+ text columns** have no maximum length, allowing DoS via huge inputs:

| Table | Column | Suggested Max Length |
|-------|--------|---------------------|
| `audit_logs` | user_agent | 500 |
| `customer_promo_codes` | code | 50 |
| `customer_promo_codes` | name | 100 |
| `customers` | ban_reason | 500 |
| `delivery_history` | customer_address | 500 |
| `delivery_history` | customer_name | 100 |
| `delivery_history` | customer_phone | 20 |
| `employees` | avatar_url | 500 |
| `employees` | block_reason | 500 |
| `invoices` | void_reason | 500 |
| `notifications` | message | 1000 |
| `orders` | cancellation_reason | 500 |
| `orders` | customer_address | 500 |
| `password_reset_otps` | email | 255 |

**Fix:**
```sql
-- Add length constraints
ALTER TABLE audit_logs 
ADD CONSTRAINT chk_user_agent_length 
CHECK (LENGTH(user_agent) <= 500);

-- Or change column type
ALTER TABLE customer_promo_codes 
ALTER COLUMN code TYPE VARCHAR(50);
```

---

### 18. Business Logic Flaws

#### 18.1 Loyalty Points Awarded Before Order Completion
**Function:** `create_portal_order`
```sql
v_loyalty_points_earned := FLOOR(v_total / 100);  -- Calculated immediately
```
**Issue:** Points awarded even if order is cancelled

#### 18.2 Promo Code Marked Used Even If Order Fails
**Function:** `apply_promo_code`
```sql
UPDATE promo_codes SET current_usage = v_new_usage ...
-- No rollback if order creation fails later
```

#### 18.3 No Balance Check Before Loyalty Deduction
**Function:** `deduct_loyalty_points`
```sql
INSERT INTO loyalty_points (...) VALUES (..., -p_points, ...)
-- No check if customer has enough points
```

**Fix:**
```sql
-- Check balance before deduction
IF (SELECT COALESCE(SUM(points), 0) FROM loyalty_points WHERE customer_id = p_customer_id) < p_points THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient loyalty points');
END IF;
```

---

### 19. Missing Transactions for Multi-Step Operations

**Function:** `check_and_award_loyalty_promo`
```sql
FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds)
LOOP
    SELECT generate_customer_promo_code(...) INTO v_promo_result;
    -- If one fails mid-loop, partial state remains
END LOOP;
```

**Fix:**
```sql
BEGIN
    -- Use savepoint for atomic loop
    FOR v_threshold IN ...
    LOOP
        SAVEPOINT loop_savepoint;
        BEGIN
            -- promo generation
        EXCEPTION WHEN OTHERS THEN
            ROLLBACK TO SAVEPOINT loop_savepoint;
            CONTINUE;
        END;
    END LOOP;
END;
```

---

## 🟢 LOW SEVERITY ISSUES (P3)

### 20. Information Disclosure in Error Messages

**Function:** `apply_promo_code`
```sql
RETURN json_build_object(
    'error', 'This promo code is not yet active. Valid from: ' || TO_CHAR(v_promo.valid_from, 'DD Mon YYYY'),
    'error_code', 'NOT_YET_VALID'
);
```

**Issue:** Reveals exact date when promo becomes valid

---

### 21. Missing Rate Limiting on Sensitive Operations

Operations without rate limiting:
- OTP verification attempts
- Password reset requests
- Login attempts
- Promo code applications

**Fix:** Use `password_reset_rate_limits` pattern for all sensitive operations

---

### 22. All Functions Use SECURITY DEFINER

**ALL 350+ functions** use `SECURITY DEFINER`, meaning they run with owner (superuser) privileges.

**Risk:** Any SQL injection in any function gives attacker full database access

**Fix:** Use `SECURITY INVOKER` where possible
```sql
-- Only use DEFINER when necessary, and add explicit checks
CREATE FUNCTION safe_function()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- Run with caller's privileges
AS $$
BEGIN
    -- Add explicit permission checks
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    -- Function logic
END;
$$;
```

---

### 23. Missing Composite Indexes

Based on query patterns, these composite indexes would help:

```sql
-- Password reset lookups
CREATE INDEX idx_password_reset_composite 
ON password_reset_otps(email, is_verified, expires_at);

-- Order queries
CREATE INDEX idx_orders_status_created 
ON orders(status, created_at DESC);

-- Notification queries  
CREATE INDEX idx_notifications_unread 
ON notifications(user_id, user_type, is_read) 
WHERE is_read = false;

-- Inventory alerts
CREATE INDEX idx_inventory_alerts_active 
ON inventory_alerts(inventory_id, is_resolved) 
WHERE is_resolved = false;
```

---

### 24. Missing Partial Indexes

```sql
-- Active promo codes only
CREATE INDEX idx_promo_codes_active 
ON promo_codes(code) 
WHERE is_active = true;

-- Pending orders only
CREATE INDEX idx_orders_pending 
ON orders(created_at) 
WHERE status = 'pending';

-- Unread notifications only
CREATE INDEX idx_notifications_unread_partial 
ON notifications(user_id) 
WHERE is_read = false;
```

---

### 25. Password Validation Too Weak

**Function:** `reset_customer_password`
```sql
IF LENGTH(p_new_password) < 8 THEN  -- Only length check
```

**Missing:**
- Maximum length (DoS prevention)
- Complexity requirements
- Common password blacklist
- Previous password check

**Fix:**
```sql
-- Better validation
IF LENGTH(p_new_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 8 characters');
END IF;

IF LENGTH(p_new_password) > 128 THEN
    RETURN json_build_object('success', false, 'error', 'Password too long');
END IF;

IF p_new_password !~ '[A-Z]' THEN
    RETURN json_build_object('success', false, 'error', 'Password must contain uppercase letter');
END IF;

IF p_new_password !~ '[0-9]' THEN
    RETURN json_build_object('success', false, 'error', 'Password must contain a number');
END IF;
```

---

## 📈 PERFORMANCE ISSUES

### 26. Missing Foreign Key Indexes

**51 foreign key columns** without indexes (slow JOINs):

```sql
-- Add missing FK indexes
CREATE INDEX idx_orders_delivery_rider ON orders(delivery_rider_id);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX idx_orders_prepared_by ON orders(prepared_by);
CREATE INDEX idx_loyalty_points_order ON loyalty_points(order_id);
CREATE INDEX idx_invoices_served_by ON invoices(served_by);
CREATE INDEX idx_invoices_billed_by ON invoices(billed_by);
CREATE INDEX idx_invoices_voided_by ON invoices(voided_by);
CREATE INDEX idx_inventory_transactions_inventory ON inventory_transactions(inventory_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_attendance_codes_created_by ON attendance_codes(created_by);
CREATE INDEX idx_order_cancellations_cancelled_by ON order_cancellations(cancelled_by);
CREATE INDEX idx_promo_codes_created_by ON promo_codes(created_by);
```

---

### 27. Heavy Functions Without Pagination

Functions returning unbounded results:
- `get_all_orders`
- `get_all_customers_admin`
- `get_all_employees`
- `get_audit_logs`
- `get_inventory_transactions`

**Fix:** Add pagination parameters
```sql
CREATE FUNCTION get_all_orders(
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
```

---

### 28. Missing JSONB Indexes

Tables with JSONB columns that need GIN indexes:

```sql
CREATE INDEX idx_orders_items_gin ON orders USING GIN (items);
CREATE INDEX idx_invoices_items_gin ON invoices USING GIN (items);
CREATE INDEX idx_perks_settings_value_gin ON perks_settings USING GIN (setting_value);
```

---

## 🔧 SCALABILITY ISSUES

### 29. No Table Partitioning

High-growth tables that need partitioning:
- `orders` - Partition by `created_at` (monthly)
- `audit_logs` - Partition by `created_at` (monthly)
- `notifications` - Partition by `created_at` (weekly)
- `order_status_history` - Partition by `created_at` (monthly)

### 30. No Data Archiving Strategy

Tables that will grow unboundedly:
- `audit_logs` - No cleanup
- `notifications` - No cleanup for old read notifications
- `order_status_history` - No cleanup
- `otp_codes` - Cleanup exists but manual
- `password_reset_otps` - Cleanup exists but manual

---

## ✅ IMPLEMENTATION PRIORITY

### P0 - Immediate (This Week)
1. ❌ Enable RLS on `otp_codes`, `attendance_codes`, `invoices`, `payslips`
2. ❌ Revoke `anon` grants from payroll/employee functions
3. ❌ Fix loyalty_points public insert policy
4. ❌ Fix order_status_history public insert policy

### P1 - High Priority (Next 2 Weeks)
5. ❌ Add input validation to all functions
6. ❌ Fix race conditions with FOR UPDATE
7. ❌ Remove data leakage from error messages
8. ❌ Fix overly permissive RLS policies
9. ❌ Add exception handling to all functions
10. ❌ Enable RLS on remaining tables

### P2 - Medium Priority (Next Month)
11. ❌ Move hardcoded values to config table
12. ❌ Add updated_at triggers
13. ❌ Remove duplicate indexes
14. ❌ Add CHECK constraints
15. ❌ Add NOT NULL constraints
16. ❌ Add text length constraints
17. ❌ Fix business logic flaws

### P3 - Nice to Have (Backlog)
18. ❌ Add rate limiting
19. ❌ Review SECURITY DEFINER usage
20. ❌ Add composite/partial indexes
21. ❌ Improve password validation
22. ❌ Add missing FK indexes
23. ❌ Add pagination to all list functions
24. ❌ Implement table partitioning
25. ❌ Create data archiving jobs

---

## 📝 Quick Reference SQL Fixes

### Enable RLS on All Critical Tables
```sql
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_fa_setup ENABLE ROW LEVEL SECURITY;
```

### Revoke Anon Access from Sensitive Functions
```sql
-- Financial
REVOKE EXECUTE ON FUNCTION create_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION delete_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_payslips_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_payroll_summary_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION deduct_loyalty_points FROM anon;
REVOKE EXECUTE ON FUNCTION confirm_payment FROM anon;

-- Employee Management
REVOKE EXECUTE ON FUNCTION create_employee FROM anon;
REVOKE EXECUTE ON FUNCTION create_employee_complete FROM anon;
REVOKE EXECUTE ON FUNCTION delete_employee FROM anon;
REVOKE EXECUTE ON FUNCTION delete_employee_cascade FROM anon;
REVOKE EXECUTE ON FUNCTION activate_employee FROM anon;
REVOKE EXECUTE ON FUNCTION ban_customer FROM anon;

-- Orders
REVOKE EXECUTE ON FUNCTION cancel_order FROM anon;
REVOKE EXECUTE ON FUNCTION assign_delivery_rider FROM anon;
```

### Drop Permissive Policies
```sql
-- OTP
DROP POLICY IF EXISTS "Allow OTP operations" ON otp_codes;
DROP POLICY IF EXISTS "otp_select_public" ON otp_codes;

-- Loyalty
DROP POLICY IF EXISTS "loyalty_points_insert_anon" ON loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_select_anon" ON loyalty_points;

-- Order History
DROP POLICY IF EXISTS "order_status_history_insert" ON order_status_history;
DROP POLICY IF EXISTS "order_status_history_insert_anon" ON order_status_history;
```

---

## 🔗 Related Documentation

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Function Security](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

---

*Report generated by security audit on January 28, 2026*
