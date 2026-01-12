# Authentication Setup Guide

## ✅ What's Fixed

1. **useAuth Hook** - Updated to use correct OTP-based endpoints:
   - `sendLoginOTP()` - Sends OTP to email for login
   - `verifyLoginOTP()` - Verifies OTP and logs in
   - `sendRegisterOTP()` - Sends OTP for registration
   - `verifyRegisterOTP()` - Verifies OTP and creates account

2. **Auth Page UI** - Added 3-step flow while keeping same design:
   - Step 1: Enter email/details
   - Step 2: Enter OTP code (new!)
   - Step 3: Success message

3. **Endpoints Fixed**:
   - ✅ Changed `/api/auth/signup` → `/api/auth/register`
   - ✅ Added OTP verification flow
   - ✅ Kept all existing beautiful UI design

## 🔧 Current Login Flow

**Registration (Working):**
1. User enters: name, email, phone, password
2. Frontend calls `/api/auth/register` → Backend sends OTP email
3. User enters OTP code
4. Frontend calls `/api/auth/verify-otp` → Account created, JWT returned

**Login (Needs Update):**
- Current backend requires PASSWORD + sends OTP
- Frontend now only collects EMAIL

### Option 1: Add Password to Login Form (Quick Fix)
Add password field back to login form:
```tsx
<Input type="password" placeholder="Your password" />
```

### Option 2: Create Passwordless Login (Recommended)
Create new endpoint `/api/auth/passwordless-login`:
```typescript
// Only requires email, sends OTP, verifies OTP
POST /api/auth/passwordless-login { email }
POST /api/auth/verify-login { email, otp }
```

## 🚀 How to Test

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to auth page:**
   - Go to `http://localhost:3000/auth`

3. **Test Registration:**
   - Click "Sign Up" tab
   - Fill in: Name, Email, Phone, Password
   - Click "Create Account"
   - Check email for OTP
   - Enter 6-digit code
   - Should redirect to success

4. **Test Login (needs password temporarily):**
   - Click "Login" tab
   - Enter email
   - Enter password (from registration)
   - Click "Send Verification Code"
   - Check email for OTP
   - Enter OTP
   - Should login successfully

## 📝 Next Steps

Choose ONE of these:

**A. Quick Fix (5 min):**
- Add password input field to login form in [src/pages/Auth.tsx](src/pages/Auth.tsx)
- Update `sendLoginOTP` to accept password parameter

**B. Better UX (15 min):**
- Create passwordless login endpoints
- Remove password requirement from login flow
- Keep password only for registration

## 🔐 Security Notes

- OTP codes expire in 10 minutes
- Rate limiting: 5 requests per minute
- JWTs expire in 7 days
- Passwords hashed with Supabase Auth

## 📱 UI Features

✅ Beautiful animated design
✅ OTP input with auto-focus
✅ Resend OTP button
✅ Change email option
✅ Loading states
✅ Error handling
✅ Same look and feel

## 🐛 Known Issues

1. Login requires password but UI doesn't show password field
   - **Fix**: Add password input OR create passwordless route
2. Backend `/api/auth/login` validates password before sending OTP
   - **Fix**: Create separate passwordless endpoint
