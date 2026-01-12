import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// OTP verification limits
const MAX_VERIFY_ATTEMPTS = 3;

const FORGOT_PASSWORD_OTP_KEY = (email: string) => `otp:forgot-password:${email}`;
const FORGOT_PASSWORD_VERIFIED_KEY = (email: string) => `forgot-password:verified:${email}`;

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim();

    // Get OTP from Redis
    const redisOTPData = await redis?.get<string | OTPData>(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));
    
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
      await redis?.del(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
      await redis?.del(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    // Verify OTP
    if (otpData.code !== normalizedOTP) {
      // Increment attempts
      otpData.attempts += 1;
      const remainingTTL = Math.ceil((otpData.expiresAt - Date.now()) / 1000);
      
      await redis?.set(
        FORGOT_PASSWORD_OTP_KEY(normalizedEmail),
        JSON.stringify(otpData),
        { ex: Math.max(remainingTTL, 1) }
      );

      return NextResponse.json(
        { 
          error: 'Invalid verification code', 
          attemptsRemaining: MAX_VERIFY_ATTEMPTS - otpData.attempts 
        },
        { status: 400 }
      );
    }

    // OTP verified successfully
    // Delete the OTP to prevent reuse
    await redis?.del(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));
    
    // Create a verified session token that allows password reset (valid for 5 minutes)
    const verifiedToken = crypto.randomUUID();
    await redis?.set(
      FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail),
      JSON.stringify({
        token: verifiedToken,
        email: normalizedEmail,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes to set new password
      }),
      { ex: 300 } // 5 minutes
    );

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      token: verifiedToken
    });
  } catch (error: any) {
    console.error('Verify forgot password OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
