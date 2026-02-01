import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateOTP, sendLoginOTP } from '@/lib/brevo';

const OTP_EXPIRY_MINUTES = 5;
const ACTIVATION_OTP_KEY = (email: string) => `otp:activation:${email}`;

// POST /api/auth/activate-employee - Activate employee account with license ID
export async function POST(request: NextRequest) {
  try {
    const { email, name, phone, password, licenseId, otp, step } = await request.json();

    const normalizedEmail = email?.toLowerCase().trim();

    // Step 1: Validate license ID and send OTP
    if (step === 'validate-license') {
      if (!licenseId || !normalizedEmail) {
        return NextResponse.json(
          { error: 'License ID and email are required' },
          { status: 400 }
        );
      }

      // Use RPC to validate employee and license (bypasses RLS)
      const { data: validationResult, error: rpcError } = await supabase.rpc('validate_employee_license', {
        p_email: normalizedEmail,
        p_license_id: licenseId,
      });

      if (rpcError) {
        return NextResponse.json(
          { error: `Validation failed: ${rpcError.message || 'Unknown error'}` },
          { status: 500 }
        );
      }

      if (!validationResult?.success) {
        // Check if already active - redirect to login
        if (validationResult?.already_active) {
          return NextResponse.json(
            { error: validationResult.error, redirect: 'login' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: validationResult?.error || 'Validation failed' },
          { status: 400 }
        );
      }

      const employee = validationResult.employee;

      // Generate and send OTP
      const otpCode = generateOTP();
      const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

      await redis.set(
        ACTIVATION_OTP_KEY(normalizedEmail),
        JSON.stringify({
          code: otpCode,
          expiresAt,
          licenseId: licenseId.toUpperCase(),
          employeeId: employee.id,
          employeeName: employee.name,
          employeeRole: employee.role,
        }),
        { ex: OTP_EXPIRY_MINUTES * 60 }
      );

      // Send OTP via email
      await sendLoginOTP(normalizedEmail, employee.name, otpCode);

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email',
        employeeName: employee.name,
      });
    }

    // Step 2: Verify OTP and create account
    if (step === 'verify-and-activate') {
      if (!normalizedEmail || !otp || !password) {
        return NextResponse.json(
          { error: 'Email, OTP, and password are required' },
          { status: 400 }
        );
      }

      // Verify OTP from Redis
      const otpData = await redis.get<string | { code: string; expiresAt: number; licenseId: string; employeeId: string; employeeName?: string; employeeRole?: string }>(ACTIVATION_OTP_KEY(normalizedEmail));

      if (!otpData) {
        return NextResponse.json(
          { error: 'Verification code expired. Please try again.' },
          { status: 400 }
        );
      }

      const parsedOtp = typeof otpData === 'string' ? JSON.parse(otpData) : otpData;

      if (parsedOtp.code !== otp.trim()) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }

      if (parsedOtp.expiresAt < Date.now()) {
        return NextResponse.json(
          { error: 'Verification code expired' },
          { status: 400 }
        );
      }

      // Create auth user in Supabase
      let authUserId: string | null = null;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        // If user already exists, try to sign in
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (signInError) {
            return NextResponse.json(
              { error: 'Account exists with different password. Please use login instead.' },
              { status: 400 }
            );
          }
          
          authUserId = signInData.user?.id || null;
        } else {
          return NextResponse.json(
            { error: authError.message },
            { status: 400 }
          );
        }
      } else if (authData.user) {
        authUserId = authData.user.id;
      }

      if (!authUserId) {
        return NextResponse.json(
          { error: 'Failed to create authentication account' },
          { status: 500 }
        );
      }

      // Use RPC to activate employee portal (bypasses RLS)
      const { data: activationResult, error: activationError } = await supabase.rpc('activate_employee_portal', {
        p_email: normalizedEmail,
        p_auth_user_id: authUserId,
        p_license_id: parsedOtp.licenseId,
      });

      if (activationError || !activationResult?.success) {
        return NextResponse.json(
          { error: activationResult?.error || 'Failed to activate portal' },
          { status: 500 }
        );
      }

      // Delete OTP from Redis
      await redis.del(ACTIVATION_OTP_KEY(normalizedEmail));

      const employee = activationResult.employee;

      // Sign in to get session token
      const { data: sessionData } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      const token = sessionData?.session?.access_token || '';

      const response = NextResponse.json({
        success: true,
        message: 'Account activated successfully',
        showConfetti: true, // Frontend should show confetti animation
        user: {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          role: employee.role,
          employee_id: employee.employee_id,
          permissions: employee.permissions,
        },
        userType: employee.role === 'admin' ? 'admin' : 'employee',
        token,
      });

      // Set auth cookie
      const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      if (sessionData?.session?.refresh_token) {
        response.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid step' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: 'Activation failed' },
      { status: 500 }
    );
  }
}

