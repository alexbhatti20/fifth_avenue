import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { redis } from '@/lib/redis';
import { supabaseAdmin } from '@/lib/supabase';
import { generateOTP, sendPasswordResetOTP } from '@/lib/brevo';

const OTP_EXPIRY_SECONDS = 120; // 2 minutes
const RESEND_COOLDOWN_SECONDS = 60;

const CHANGE_PASSWORD_OTP_KEY = (userId: string) => `otp:change-password:${userId}`;
const CHANGE_PASSWORD_RESEND_KEY = (userId: string) => `change-password:resend:${userId}`;

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

    // Check resend cooldown (60 seconds between sends)
    const lastSendTime = await redis?.get<number>(CHANGE_PASSWORD_RESEND_KEY(userId));
    if (lastSendTime) {
      const timeSinceLastSend = Date.now() - lastSendTime;
      if (timeSinceLastSend < RESEND_COOLDOWN_SECONDS * 1000) {
        const remainingSeconds = Math.ceil(
          (RESEND_COOLDOWN_SECONDS * 1000 - timeSinceLastSend) / 1000
        );
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
            remainingSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Get customer email and name from DB
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_SECONDS * 1000;

    const otpData: OTPData = {
      code: otp,
      expiresAt,
      attempts: 0,
      userId,
    };

    // Store OTP in Redis
    await redis?.set(
      CHANGE_PASSWORD_OTP_KEY(userId),
      JSON.stringify(otpData),
      { ex: OTP_EXPIRY_SECONDS }
    );

    // Record resend timestamp
    await redis?.set(CHANGE_PASSWORD_RESEND_KEY(userId), Date.now(), {
      ex: RESEND_COOLDOWN_SECONDS,
    });

    // Send OTP via Brevo
    const emailResult = await sendPasswordResetOTP(
      customer.email,
      customer.name || 'Valued Customer',
      otp
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your registered email address.',
      expiresIn: OTP_EXPIRY_SECONDS,
    });
  } catch (error: any) {
    console.error('[send-password-otp]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
