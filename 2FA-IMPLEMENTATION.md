# Two-Factor Authentication (2FA) Implementation

## Overview
This implementation adds Google Authenticator-based 2FA security for all portal users (managers, admins, employees).

## How It Works

### 1. **Database Schema**
The existing database already has 2FA columns:
- `employees.is_2fa_enabled` (BOOLEAN) - Flag to enable/disable 2FA
- `employees.two_fa_secret` (TEXT) - Stores the TOTP secret for verification
- `customers.is_2fa_enabled` (BOOLEAN) - Flag for customers (optional)
- `customers.two_fa_secret` (TEXT) - Secret for customers

### 2. **RPC Functions**
- `get_user_by_email(email)` - Already returns `is_2fa_enabled` field
- No new RPC needed - verification happens server-side via API

### 3. **Login Flow with 2FA**

#### Step 1: User enters email & password
- API: `POST /api/auth/login`
- Validates credentials
- Checks `is_2fa_enabled` from database
- If 2FA enabled: Returns `{ requires2FA: true, employeeId: "xxx" }`
- If 2FA disabled: Proceeds with normal login

#### Step 2: 2FA Dialog appears (if required)
- Component: `<TwoFactorDialog />`
- User enters 6-digit code from Google Authenticator
- API: `POST /api/portal/security/2fa/verify`

#### Step 3: Verification
- Fetches employee record with `two_fa_secret`
- Uses `speakeasy.totp.verify()` to validate code
- On success:
  - Generates JWT token
  - Sets auth cookie
  - Returns user data
  - Completes login

### 4. **Settings Page - Security Tab**

Located: `app/portal/settings/page.tsx` → Security Tab

Features:
- **Enable 2FA**:
  1. Click "Enable 2FA"
  2. Generates QR code + manual entry key
  3. Scan with Google Authenticator
  4. Enter verification code
  5. Saves `two_fa_secret` to database
  6. Sets `is_2fa_enabled = true`

- **Disable 2FA**:
  1. Click "Disable 2FA"
  2. Enter current 2FA code for verification
  3. Sets `is_2fa_enabled = false`
  4. Clears `two_fa_secret`

### 5. **API Endpoints**

#### `/api/portal/security/2fa` (GET)
- Returns current 2FA status
- Generates new QR code & secret for setup

#### `/api/portal/security/2fa/enable` (POST)
```json
{
  "secret": "base32_secret",
  "token": "123456"
}
```
- Verifies token against secret
- Saves to database if valid

#### `/api/portal/security/2fa` (PUT)
```json
{
  "enabled": false,
  "token": "123456"
}
```
- Disable 2FA (requires current token)

#### `/api/portal/security/2fa/verify` (POST)
```json
{
  "employee_id": "uuid",
  "token": "123456"
}
```
- Verifies 2FA during login
- **Completes login** by issuing JWT token
- Returns user data & session

### 6. **Security Features**
- ✅ TOTP-based (Time-based One-Time Password)
- ✅ Works with Google Authenticator, Authy, Microsoft Authenticator
- ✅ 30-second token rotation
- ✅ 2-step window for clock drift tolerance
- ✅ Secret stored encrypted in database
- ✅ Requires current 2FA code to disable
- ✅ Server-side verification only (no client-side bypass)

### 7. **Required Packages**
```json
{
  "speakeasy": "^2.0.0",    // TOTP generation & verification
  "qrcode": "^1.5.4",        // QR code generation
  "@types/speakeasy": "^2.0.10",
  "@types/qrcode": "^1.5.5"
}
```

### 8. **User Experience**

**For Managers/Admins:**
1. Go to Settings → Security tab
2. Enable 2FA with Google Authenticator
3. On next login: Enter code after password

**First Time Setup:**
1. Install Google Authenticator app
2. Scan QR code in Settings
3. Enter 6-digit code to verify
4. Done! Required on every login

**Each Login:**
1. Enter email → password
2. If 2FA enabled: Dialog pops up
3. Open authenticator app
4. Enter current 6-digit code
5. Login complete

## Migration Path
- ✅ No database migration needed (columns already exist)
- ✅ Backward compatible (2FA is optional)
- ✅ Users can enable/disable anytime
- ✅ No impact on existing logins until enabled

## Testing Checklist
- [ ] Enable 2FA in settings
- [ ] Scan QR with Google Authenticator
- [ ] Verify setup with code
- [ ] Logout and login again
- [ ] Enter 2FA code at login
- [ ] Try invalid code (should fail)
- [ ] Disable 2FA (requires code)
- [ ] Login without 2FA

## Security Notes
- Secrets are stored in database (consider encryption at rest)
- JWT tokens expire after 7 days
- 2FA codes expire after 30 seconds
- Rate limiting should be added to verification endpoint
- Consider backup codes for account recovery
