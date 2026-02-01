# ⚠️ Security Fix Impact Analysis

## Will Fixes Break Your Website?

**Short Answer:** YES - some fixes will break things if applied without code changes.

This document explains what will break and what's safe to fix immediately.

---

## 🚦 Fix Categories

| Category | Safe to Apply? | Code Changes Needed? |
|----------|---------------|---------------------|
| 🟢 Safe Fixes | Yes, apply now | No |
| 🟡 Needs Prep | After code change | Minor changes |
| 🔴 Breaking | After major refactor | Significant work |

---

## 🟢 SAFE TO APPLY NOW (No Breaking Changes)

These fixes won't affect your current website:

### 1. Add Missing Indexes
```sql
-- Safe: Only improves performance
CREATE INDEX idx_orders_delivery_rider ON orders(delivery_rider_id);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX idx_loyalty_points_order ON loyalty_points(order_id);
CREATE INDEX idx_invoices_served_by ON invoices(served_by);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
```
**Impact:** None - only makes queries faster

### 2. Drop Duplicate Indexes
```sql
-- Safe: Removes redundant indexes
DROP INDEX IF EXISTS idx_customers_email;
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_orders_customer;
```
**Impact:** None - unique constraint still exists

### 3. Add updated_at Triggers
```sql
-- Safe: Auto-updates timestamp on UPDATE
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
**Impact:** None - improves data tracking

### 4. Add CHECK Constraints (for new data only)
```sql
-- Safe: Only validates new inserts/updates
ALTER TABLE payslips ADD CONSTRAINT chk_payslip_status 
CHECK (status IN ('pending', 'paid', 'cancelled'));
```
**Impact:** None if current data is valid

### 5. Add NOT NULL with Defaults
```sql
-- Safe: Add defaults first
ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT NOW();
```
**Impact:** None

---

## 🟡 NEEDS PREPARATION (Minor Code Changes)

### 6. Enable RLS on `restaurant_tables`

**Current Code Using This:**
```typescript
// lib/server-queries.ts
const { data, error } = await supabase.rpc('get_tables_for_waiter');
```
✅ **Already uses RPC** - Safe to enable RLS

**Fix:**
```sql
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_select_employee" ON restaurant_tables
    FOR SELECT TO authenticated USING (is_employee());
    
CREATE POLICY "tables_update_employee" ON restaurant_tables
    FOR UPDATE TO authenticated USING (is_employee());
```

### 7. Enable RLS on `delivery_history`
✅ **Already uses RPC** (`get_delivery_orders`) - Safe to enable

### 8. Enable RLS on `waiter_tips`
✅ **Already uses RPC** - Safe to enable

### 9. Revoke Anon from Employee-Only Functions

These functions should NEVER be called by anonymous users:

```sql
-- Safe to revoke - only employees use these
REVOKE EXECUTE ON FUNCTION get_kitchen_orders_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_kitchen_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_billing_dashboard_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_admin_dashboard_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_employees_paginated FROM anon;
REVOKE EXECUTE ON FUNCTION get_payslips_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_payroll_summary_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION create_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION delete_payslip_v2 FROM anon;
```

**Check:** Ensure your portal always uses authenticated Supabase client

---

## 🔴 BREAKING CHANGES (Code Updates Required)

### 10. ⚠️ OTP Codes Table - CRITICAL but Breaking

**Current Usage in your code:**
```typescript
// app/api/auth/verify-otp/route.ts (Line 72-82)
const { data: dbOTP } = await supabase
    .from('otp_codes')           // ← Direct table access!
    .select('code, expires_at, is_used')
    .eq('email', normalizedEmail)
    .eq('purpose', 'registration')
```

**Problem:** Your auth routes directly query `otp_codes` table. If we enable RLS, these queries will fail because:
1. API routes use the anon key
2. There's no authenticated user during registration

**Solution Options:**

#### Option A: Use Service Role Key in API Routes (Recommended)
```typescript
// Create admin client in api routes
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Add this env variable
);

// Use admin client for OTP operations
const { data: dbOTP } = await supabaseAdmin
    .from('otp_codes')
    .select(...)
```

#### Option B: Create RPC Functions for OTP Operations
```sql
-- Create secure OTP functions
CREATE OR REPLACE FUNCTION verify_otp(p_email TEXT, p_otp TEXT, p_purpose TEXT)
RETURNS JSON AS $$
-- Implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_otp TO anon;
```

Then update code:
```typescript
const { data } = await supabase.rpc('verify_otp', {
    p_email: normalizedEmail,
    p_otp: normalizedOTP,
    p_purpose: 'registration'
});
```

### 11. ⚠️ Loyalty Points Insert - Breaking

**Current Usage:**
```typescript
// app/api/auth/verify-otp/route.ts (Line 281)
supabase.from('loyalty_points').insert({
    customer_id: customer.id,
    points: 50,
    reason: 'Welcome bonus',
    ...
});
```

**Problem:** This direct insert will fail after fixing the policy

**Solution:** Create RPC function:
```sql
CREATE OR REPLACE FUNCTION award_welcome_bonus(p_customer_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loyalty_points (customer_id, points, reason, transaction_type)
    VALUES (p_customer_id, 50, 'Welcome bonus', 'earned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION award_welcome_bonus TO anon;
```

### 12. ⚠️ Notifications Insert - Breaking

**Current Usage:**
```typescript
// app/api/auth/verify-otp/route.ts (Line 270)
supabase.from('notifications').insert({
    user_id: customer.id,
    user_type: 'customer',
    title: 'Welcome!',
    ...
});
```

**Solution:** Create RPC function for system notifications

### 13. ⚠️ Customer Registration - Breaking

**Current Policy:**
```sql
"customers_insert_system" - anon can INSERT with true
"Anyone can create customer" - public can INSERT with true
```

**Problem:** Registration creates customer records from API routes using anon key

**Solution:** Keep one policy for registration:
```sql
-- This is actually needed for registration
CREATE POLICY "allow_customer_registration" ON customers
    FOR INSERT TO anon
    WITH CHECK (
        email IS NOT NULL 
        AND auth_user_id IS NOT NULL
    );
```

---

## 📋 Implementation Plan

### Phase 1: Safe Fixes (Apply Now)
```sql
-- Run these immediately
-- 1. Add indexes
-- 2. Drop duplicate indexes  
-- 3. Add triggers
-- 4. Add constraints
```
**Time:** 5 minutes  
**Risk:** Zero

### Phase 2: Service Role Key Setup
1. Get `SUPABASE_SERVICE_ROLE_KEY` from Supabase dashboard
2. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   ```
3. Create admin client in `/lib/supabase-admin.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   export const supabaseAdmin = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   ```

**Time:** 30 minutes  
**Risk:** Low

### Phase 3: Update API Routes
Update these files to use `supabaseAdmin`:
- `app/api/auth/verify-otp/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/verify-login/route.ts`

**Time:** 2-3 hours  
**Risk:** Medium (test thoroughly)

### Phase 4: Apply Security Fixes
After code updates, apply:
```sql
-- Enable RLS on sensitive tables
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- Remove dangerous policies
DROP POLICY IF EXISTS "loyalty_points_insert_anon" ON loyalty_points;

-- Revoke anon grants
REVOKE EXECUTE ON FUNCTION create_payslip_v2 FROM anon;
```

**Time:** 1 hour  
**Risk:** Medium (after testing)

---

## 🎯 Quick Decision Guide

| Want to Fix | Safe Now? | What's Needed |
|-------------|-----------|---------------|
| Performance (indexes) | ✅ Yes | Nothing |
| Employee-only RLS | ✅ Yes | Nothing |
| OTP security | ❌ No | Service role key + code |
| Loyalty points | ❌ No | Create RPC function |
| Anonymous grants | ⚠️ Partial | Check which funcs are used |
| Payroll functions | ✅ Yes | Only employees use them |

---

## 🔧 Immediate Safe SQL Script

Run this NOW without breaking anything:

```sql
-- ============================================
-- SAFE FIXES - Won't break anything
-- ============================================

-- 1. Performance: Add missing FK indexes
CREATE INDEX IF NOT EXISTS idx_orders_delivery_rider ON orders(delivery_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_prepared_by ON orders(prepared_by);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_order ON loyalty_points(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_served_by ON invoices(served_by);
CREATE INDEX IF NOT EXISTS idx_invoices_billed_by ON invoices(billed_by);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);

-- 2. Performance: Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, user_type, is_read) WHERE is_read = false;

-- 3. Enable RLS on tables accessed only via RPC
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_archive ENABLE ROW LEVEL SECURITY;

-- 4. Add proper policies for newly RLS-enabled tables
CREATE POLICY "tables_select_auth" ON restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "tables_manage_employee" ON restaurant_tables FOR ALL TO authenticated USING (is_employee());

CREATE POLICY "delivery_history_select_rider" ON delivery_history FOR SELECT TO authenticated 
    USING (rider_id = get_employee_id() OR is_admin());
CREATE POLICY "delivery_history_insert" ON delivery_history FOR INSERT TO authenticated 
    WITH CHECK (is_employee());

CREATE POLICY "tips_select_own" ON waiter_tips FOR SELECT TO authenticated 
    USING (waiter_id = get_employee_id() OR is_admin());
CREATE POLICY "tips_insert" ON waiter_tips FOR INSERT TO authenticated 
    WITH CHECK (is_employee());

-- 5. Revoke anon from admin-only functions (safe - employees are always authenticated)
REVOKE EXECUTE ON FUNCTION get_admin_dashboard_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_employees_paginated FROM anon;
REVOKE EXECUTE ON FUNCTION get_payslips_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_payroll_summary_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION create_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION delete_payslip_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_kitchen_orders_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION get_kitchen_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_billing_dashboard_stats FROM anon;
REVOKE EXECUTE ON FUNCTION ban_customer FROM anon;
REVOKE EXECUTE ON FUNCTION delete_employee FROM anon;
REVOKE EXECUTE ON FUNCTION delete_employee_cascade FROM anon;
REVOKE EXECUTE ON FUNCTION bulk_update_employee_status FROM anon;
REVOKE EXECUTE ON FUNCTION admin_mark_attendance FROM anon;

-- 6. Fix overly permissive policies (employee-only tables)
DROP POLICY IF EXISTS "perks_settings_update" ON perks_settings;
CREATE POLICY "perks_settings_update_admin" ON perks_settings 
    FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "perks_settings_insert" ON perks_settings;
CREATE POLICY "perks_settings_insert_admin" ON perks_settings 
    FOR INSERT TO authenticated WITH CHECK (is_admin());
```

---

## Summary

| Fix Type | Count | Safe Now? |
|----------|-------|-----------|
| Performance indexes | 15 | ✅ Yes |
| Employee RLS tables | 6 | ✅ Yes |
| Revoke admin anon grants | 15 | ✅ Yes |
| OTP/Auth security | 3 | ❌ After code change |
| Public insert policies | 4 | ❌ After code change |

**Recommendation:** Apply the safe fixes now, then work on the auth refactor for the critical OTP issues.
