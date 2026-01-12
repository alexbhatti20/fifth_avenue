# Password Reset Fix

## Problem
The password reset functionality was failing with the error:
```json
{"error":"Failed to update password. Please try again."}
```

## Solution Applied

### 1. Created New RPC Functions (`supabase/password-reset-rpc.sql`)

Three new PostgreSQL functions were created to handle password reset more reliably:

#### `reset_customer_password(p_email, p_new_password)`
- Validates the customer exists
- Checks if the customer has a valid auth_user_id
- Returns customer information needed for password update
- Provides detailed error messages

#### `validate_password_reset_session(p_email, p_token)`
- Validates password reset sessions stored in the database
- Checks if OTP was verified
- Ensures session hasn't expired

#### `log_password_reset_completion(p_email, p_ip_address)`
- Logs successful password reset completion
- Invalidates all OTPs for the email
- Maintains audit trail

### 2. Enhanced Reset Password Route

Updated `/app/api/auth/forgot-password/reset-password/route.ts` with:

- **RPC Integration**: Uses the new `reset_customer_password` RPC for validation
- **Better Error Handling**: Provides specific error messages for different failure scenarios
- **Detailed Logging**: Enhanced console logging for debugging
- **Error Details**: Returns both user-friendly messages and technical details

### 3. Improved Error Messages

The route now returns specific errors for:
- Weak passwords
- Short passwords  
- User not found
- RPC validation failures
- Auth update failures

## How to Apply

### Step 1: Run the New RPC SQL File

Execute the password reset RPC file in your Supabase SQL editor:

```bash
# Navigate to Supabase Dashboard → SQL Editor → New Query
# Copy and paste the contents of: supabase/password-reset-rpc.sql
# Click "Run" to execute
```

Or via CLI:
```bash
supabase db execute -f supabase/password-reset-rpc.sql
```

### Step 2: Verify Functions Were Created

Run this query to verify:
```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'reset_customer_password',
  'validate_password_reset_session',
  'log_password_reset_completion'
)
AND routine_schema = 'public';
```

You should see all three functions listed.

### Step 3: Test the Password Reset Flow

1. **Request Password Reset**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **Verify OTP** (check your email for the OTP):
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otp": "123456"}'
   ```

3. **Reset Password** (use the token from step 2):
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "token": "your-session-token",
       "newPassword": "NewPass123",
       "confirmPassword": "NewPass123"
     }'
   ```

### Step 4: Check Logs

Monitor your application logs for any errors:
- RPC errors will be logged with full details
- Password update errors will show specific failure reasons
- All errors include stack traces for debugging

## Environment Variables Required

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for admin operations
```

## Common Issues & Solutions

### Issue 1: "Failed to process password reset"
**Cause**: RPC function not created or permissions issue
**Solution**: 
- Verify the RPC was created (see Step 2)
- Check that service_role has execute permissions
- Run: `GRANT EXECUTE ON FUNCTION reset_customer_password TO service_role;`

### Issue 2: "Customer account not properly configured"
**Cause**: Customer record missing `auth_user_id`
**Solution**: 
- Check the customers table: `SELECT id, email, auth_user_id FROM customers WHERE email = 'user@example.com';`
- If `auth_user_id` is NULL, the customer needs to be properly registered

### Issue 3: "Password is too weak"
**Cause**: Supabase Auth password policy
**Solution**:
- Password must be at least 8 characters
- Must contain uppercase, lowercase, and numbers
- Check Supabase Auth settings for custom password policies

### Issue 4: Session expired errors
**Cause**: Redis session expired or token mismatch
**Solution**:
- Verify Redis is running and accessible
- Check Redis TTL settings
- Ensure the correct token is being passed from the verify-otp response

## Security Features

✅ Rate limiting on password reset attempts  
✅ OTP verification before password reset  
✅ Session token validation  
✅ Password complexity requirements  
✅ Automatic session cleanup after reset  
✅ Audit trail in database  
✅ IP address logging  

## Next Steps

If you continue to experience issues:

1. Check the browser console for errors
2. Check the server logs (terminal running `npm run dev`)
3. Check Supabase logs in the dashboard
4. Verify Redis is running: `redis-cli ping`
5. Test the RPC directly in Supabase SQL editor:
   ```sql
   SELECT reset_customer_password('test@example.com', 'TestPass123');
   ```

## Files Modified

- ✅ `supabase/password-reset-rpc.sql` (NEW)
- ✅ `app/api/auth/forgot-password/reset-password/route.ts` (UPDATED)

## Files to Review

- `app/api/auth/forgot-password/route.ts` (OTP generation)
- `app/api/auth/forgot-password/verify-otp/route.ts` (OTP verification)
- `lib/redis.ts` (Redis configuration)
- `lib/supabase.ts` (Supabase Admin client)
