import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { generateOTP, sendOTPEmail } from '@/lib/brevo';

// OTP expiry time: 2 minutes
const OTP_EXPIRY_MINUTES = 2;
const PASSWORD_OTP_KEY = (email: string) => `otp:password:${email}`;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in Redis
    await redis.set(
      PASSWORD_OTP_KEY(normalizedEmail),
      JSON.stringify({
        code: otp,
        expiresAt,
        attempts: 0,
      }),
      { ex: OTP_EXPIRY_MINUTES * 60 }
    );

    // Send OTP via email
    const emailResult = await sendOTPEmail(
      normalizedEmail,
      'User',
      otp,
      'password_change'
    );

    if (!emailResult.success) {
      // Dev mode fallback
      console.log('📧 DEV MODE - Password OTP:', otp);
      return NextResponse.json({
        success: true,
        message: 'Verification code sent',
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error: any) {
    console.error('Send password OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
