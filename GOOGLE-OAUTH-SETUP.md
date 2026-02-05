# Google OAuth Setup Guide for ZOIRO Broast

This guide explains how to set up Google OAuth (Continue with Google) for the application.

## Overview

The Google OAuth implementation allows:
- **Customers**: Can sign in AND register using Google
- **Employees**: Can ONLY sign in with Google (if account already exists and is active), cannot register
- **Blocked users**: Cannot sign in or register with Google
- **Inactive employees**: Must activate their account first before using Google sign-in

## Prerequisites

1. A Google Cloud Console account
2. Supabase project with authentication enabled
3. Admin access to both Google Cloud Console and Supabase dashboard

## Step 1: Set Up Google Cloud Console

### 1.1 Create a New Project (or use existing)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name (e.g., "ZOIRO Broast Auth")
5. Click "Create"

### 1.2 Configure OAuth Consent Screen

1. In the left sidebar, navigate to **APIs & Services > OAuth consent screen**
2. Select **External** user type (unless you're using Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: ZOIRO Broast
   - **User support email**: Your support email
   - **App logo**: (Optional) Upload your logo
   - **App domain**: Your production domain
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. **Scopes**: Click "Add or Remove Scopes"
   - Select: `email`, `profile`, `openid`
   - Click "Update"
7. Click "Save and Continue"
8. **Test users** (if in testing mode): Add test emails
9. Click "Save and Continue"

### 1.3 Create OAuth Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **"+ CREATE CREDENTIALS"** > **OAuth client ID**
3. Select **Web application** as application type
4. **Name**: "ZOIRO Broast Web Client"
5. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://zoirobroast.me
   ```
6. **Authorized redirect URIs**:
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:3000/api/auth/google/callback
   https://zoirobroast.me/api/auth/google/callback
   ```
   > **Important**: Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference ID

7. Click "Create"
8. **Save the Client ID and Client Secret** - you'll need these for Supabase

## Step 2: Configure Supabase

### 2.1 Enable Google Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication > Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Google provider** ON
6. Enter your credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
7. **Authorized Client IDs** (optional): Add any additional client IDs
8. Click "Save"

### 2.2 Configure Redirect URLs

1. In Supabase, go to **Authentication > URL Configuration**
2. Ensure **Site URL** is set correctly:
   - Development: `http://localhost:3000`
   - Production: `https://zoirobroast.me`
3. Add to **Redirect URLs**:
   ```
   http://localhost:3000/api/auth/google/callback
   https://zoirobroast.me/api/auth/google/callback
   ```

## Step 3: Run Database Migrations

Execute the SQL migration to create the required RPC functions:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor
# Copy the contents of supabase/google-oauth-rpc.sql and execute it
```

The migration creates these functions:
- `create_google_oauth_customer`: Creates new customer accounts from Google OAuth
- `link_google_auth_to_customer`: Links Google auth to existing customer
- `link_google_auth_to_employee`: Links Google auth to existing active employee

## Step 4: Environment Variables

Ensure these environment variables are set:

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production URL
```

## Security Features

### Blocked User Protection
- When a user attempts to sign in with Google, the system checks if they are blocked
- Blocked employees/customers are immediately signed out and shown an error message
- The check happens at the callback level, before any session is established

### Employee Registration Prevention
- Employees cannot register via Google OAuth
- They must be created by an admin and then activate their account with their license ID
- Once activated, employees can use Google to sign in (if their email matches)

### Inactive Employee Protection
- Inactive employees cannot use Google sign-in
- They must first activate their account through the standard activation flow
- After activation, Google sign-in becomes available

## How It Works

### Customer Flow
1. Customer clicks "Continue with Google"
2. Redirected to Google OAuth consent screen
3. After authorization, redirected back to callback URL
4. System checks if email exists:
   - **Exists as customer**: Links Google auth, logs in
   - **Exists as employee**: Error - must use employee login
   - **Doesn't exist**: Creates new customer account, logs in
5. Customer is redirected to home page

### Employee Flow
1. Employee clicks "Continue with Google" (from login form)
2. Redirected to Google OAuth consent screen
3. After authorization, redirected back to callback URL
4. System checks:
   - **Employee exists and active**: Links Google auth, logs in to portal
   - **Employee exists but inactive**: Error - must activate first
   - **Employee is blocked**: Error - access denied
   - **No employee with this email**: Error - cannot register via Google
5. Active employees are redirected to portal

## Troubleshooting

### "redirect_uri_mismatch" Error
- Ensure the redirect URI in Google Cloud Console exactly matches:
  `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
- Check for trailing slashes
- Verify the Supabase project reference is correct

### "Failed to exchange code for session"
- Check that the Client ID and Secret are correctly entered in Supabase
- Verify the OAuth consent screen is properly configured
- Check Supabase logs for detailed error messages

### Cookies Not Being Set
- Ensure your domain is using HTTPS in production
- Check that `sameSite` and `secure` cookie settings are appropriate
- Verify the cookie domain matches your application domain

### "Employee cannot register with Google"
- This is expected behavior - employees must be created by admin
- The employee should contact their administrator

### User Not Redirecting After Login
- Check browser console for JavaScript errors
- Verify the redirect URLs are correctly configured
- Ensure no ad blockers are interfering with OAuth flow

## Testing Checklist

- [ ] New customer can register with Google
- [ ] Existing customer can sign in with Google
- [ ] Blocked customer cannot sign in with Google
- [ ] Active employee can sign in with Google
- [ ] Inactive employee cannot sign in with Google
- [ ] Blocked employee cannot sign in with Google
- [ ] Non-existent email with Google shows appropriate message
- [ ] Error messages display correctly
- [ ] Redirect after login works correctly
- [ ] Session cookies are set properly

## Files Modified/Created

1. `app/api/auth/google/route.ts` - Initiates Google OAuth
2. `app/api/auth/google/callback/route.ts` - Handles OAuth callback
3. `components/ui/google-sign-in-button.tsx` - Reusable Google button component
4. `app/(auth)/auth/page.tsx` - Updated auth page with Google buttons
5. `supabase/google-oauth-rpc.sql` - Database functions for Google OAuth

## Production Deployment Checklist

1. [ ] Google Cloud Console project is set to "Production" (not testing)
2. [ ] OAuth consent screen is verified (if required)
3. [ ] Production URLs are added to authorized origins/redirects
4. [ ] Supabase Site URL is set to production domain
5. [ ] Environment variables are configured in production
6. [ ] SSL/HTTPS is properly configured
7. [ ] Cookie settings use `secure: true` in production
