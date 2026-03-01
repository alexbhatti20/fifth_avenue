import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { redis } from '@/lib/redis';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const MAX_VERIFY_ATTEMPTS = 3;
const CHANGE_PASSWORD_OTP_KEY = (userId: string) => `otp:change-password:${userId}`;

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userId = decoded.userId;

    const body = await request.json();
    const { otp, currentPassword, newPassword } = body;

    if (!otp || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'All fields are required: otp, currentPassword, newPassword' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json(
        {
          error:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        },
        { status: 400 }
      );
    }

    // Get customer email from DB
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify OTP from Redis
    const redisOTPData = await redis?.get<string | OTPData>(CHANGE_PASSWORD_OTP_KEY(userId));

    if (!redisOTPData) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    const otpData: OTPData =
      typeof redisOTPData === 'string' ? JSON.parse(redisOTPData) : redisOTPData;

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      await redis?.del(CHANGE_PASSWORD_OTP_KEY(userId));
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
      await redis?.del(CHANGE_PASSWORD_OTP_KEY(userId));
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    // Verify OTP code
    if (otpData.code !== otp.toString().trim()) {
      otpData.attempts += 1;
      const remainingTTL = Math.ceil((otpData.expiresAt - Date.now()) / 1000);
      await redis?.set(CHANGE_PASSWORD_OTP_KEY(userId), JSON.stringify(otpData), {
        ex: Math.max(remainingTTL, 1),
      });
      return NextResponse.json(
        {
          error: 'Invalid verification code',
          attemptsRemaining: MAX_VERIFY_ATTEMPTS - otpData.attempts,
        },
        { status: 400 }
      );
    }

    // OTP verified — now verify current password via Supabase sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Delete the OTP to prevent reuse
    await redis?.del(CHANGE_PASSWORD_OTP_KEY(userId));

    // Update the password using the existing RPC
    const { data: updateResult, error: updateError } = await supabaseAdmin.rpc(
      'update_user_password',
      {
        p_email: customer.email,
        p_new_password: newPassword,
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 500 }
      );
    }

    if (!updateResult?.success) {
      return NextResponse.json(
        { error: updateResult?.error || 'Failed to update password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error: any) {
    console.error('[change-password]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
