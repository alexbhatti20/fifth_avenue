# Payroll Payment Frequency Fix

## Issue
Database error when fetching employee payroll summary:
```
{
    "code": "42703",
    "message": "column ep.payment_frequency does not exist"
}
```

## Root Cause
The `get_employee_payroll_v2` RPC function was querying `payment_frequency` and `bank_details` columns from the `employee_payroll` table, but these columns didn't exist in the schema.

## Solution Applied

### 1. Database Migration
Created migration `add_employee_payroll_fields` that:
- Added `payment_frequency` column (TEXT with CHECK constraint for valid values: daily, weekly, biweekly, monthly, quarterly, yearly)
- Added `bank_details` column (JSONB for storing bank account information)
- Updated `get_employee_payroll_v2` RPC function to use COALESCE for these new fields
- Added proper documentation comments

**Migration Details:**
```sql
ALTER TABLE employee_payroll 
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'::jsonb;
```

### 2. Server-Side Query (SSR)
Created SSR version of the query to hide sensitive data from browser:

**File: `lib/server-queries.ts`**
- Added `getEmployeePayrollSummaryServer(employeeId)` function
- Uses authenticated Supabase client
- Runs only on server (hidden from browser Network tab)

**File: `lib/actions.ts`**
- Added `getEmployeePayrollSummaryAction(employeeId)` server action
- Acts as client-callable wrapper for SSR function
- Properly handles errors

### 3. Client Component Updates
Updated components to use new SSR server action:

**Files Modified:**
- `components/portal/employees/EmployeeDetailSheet.tsx`
- `app/portal/employees/[id]/page.tsx`

**Changes:**
- Replaced `getEmployeePayrollSummary` (client-side) with `getEmployeePayrollSummaryAction` (SSR)
- Updated imports to use server action from `@/lib/actions`

## Benefits
1. ✅ **Fixed Database Error** - Columns now exist with proper constraints
2. ✅ **Enhanced Security** - Payroll data now fetched server-side (hidden from browser)
3. ✅ **Better Type Safety** - Payment frequency is constrained to valid values
4. ✅ **Flexible Bank Details** - JSONB field allows storing various bank information
5. ✅ **SSR Performance** - Server-side rendering reduces client bundle size

## Payment Frequency Options
- `daily` - Daily payments
- `weekly` - Weekly payments  
- `biweekly` - Every two weeks
- `monthly` - Monthly (default)
- `quarterly` - Every 3 months
- `yearly` - Annual payments

## Bank Details Structure (JSONB)
```json
{
  "account_number": "string",
  "bank_name": "string",
  "branch": "string",
  "account_holder_name": "string",
  "iban": "string",
  "swift_code": "string"
}
```

## Testing
After applying this fix:
1. Employee payroll summary queries should work without errors
2. Payment frequency defaults to 'monthly' for existing records
3. Bank details default to empty object `{}`
4. All payroll data is now fetched via SSR (check Network tab - should not see RPC calls)

## Files Changed
- `supabase/migrations/add_employee_payroll_fields.sql` (NEW)
- `lib/server-queries.ts` (MODIFIED)
- `lib/actions.ts` (MODIFIED)
- `components/portal/employees/EmployeeDetailSheet.tsx` (MODIFIED)
- `app/portal/employees/[id]/page.tsx` (MODIFIED)
