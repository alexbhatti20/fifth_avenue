import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';

const PASSWORD_OTP_KEY = (email: string) => `otp:password:${email}`;

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp, currentPassword, newPassword } = await request.json();

    // Validate input
    if (!email || !otp || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim();

    // Get OTP from Redis
    const redisOTPData = await redis.get<string | OTPData>(PASSWORD_OTP_KEY(normalizedEmail));
    
    if (!redisOTPData) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    const otpData: OTPData = typeof redisOTPData === 'string' 
      ? JSON.parse(redisOTPData) 
      : redisOTPData;

    // Check if OTP has expired
    if (Date.now() > otpData.expiresAt) {
      await redis.del(PASSWORD_OTP_KEY(normalizedEmail));
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpData.attempts >= 3) {
      await redis.del(PASSWORD_OTP_KEY(normalizedEmail));
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    // Verify OTP
    if (otpData.code !== normalizedOTP) {
      // Increment attempts
      otpData.attempts += 1;
      await redis.set(
        PASSWORD_OTP_KEY(normalizedEmail),
        JSON.stringify(otpData),
        { ex: Math.ceil((otpData.expiresAt - Date.now()) / 1000) }
      );

      return NextResponse.json(
        { error: 'Invalid verification code', attemptsRemaining: 3 - otpData.attempts },
        { status: 400 }
      );
    }

    // OTP verified - now verify current password and change it
    // First sign in with current password to verify it
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: currentPassword,
    });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Clear OTP
    await redis.del(PASSWORD_OTP_KEY(normalizedEmail));

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}

