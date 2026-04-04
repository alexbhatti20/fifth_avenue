import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabaseAdmin } from '@/lib/supabase';
import { generateOTP, sendPasswordResetOTP } from '@/lib/brevo';
import { signCookieValue } from '@/lib/cookie-signing';

// OTP expiry time: 2 minutes
const OTP_EXPIRY_SECONDS = 120;
// Resend cooldown: 60 seconds
const RESEND_COOLDOWN_SECONDS = 60;
// Rate limit: 3 attempts then 2-hour cooldown
const MAX_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 2 * 60 * 60; // 2 hours

const FORGOT_PASSWORD_OTP_KEY = (email: string) => `otp:forgot-password:${email}`;
const FORGOT_PASSWORD_ATTEMPTS_KEY = (email: string) => `forgot-password:attempts:${email}`;
const FORGOT_PASSWORD_COOLDOWN_KEY = (email: string) => `forgot-password:cooldown:${email}`;
const FORGOT_PASSWORD_RESEND_KEY = (email: string) => `forgot-password:resend:${email}`;
const FORGOT_PASSWORD_OTP_COOKIE = 'forgot_password_otp';

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
}

function safeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.toLowerCase().trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedEmail = safeEmail(body?.email);

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if in cooldown period (after 3 failed attempts)
    let cooldownUntil: number | null = null;
    try {
      cooldownUntil = await redis?.get<number>(FORGOT_PASSWORD_COOLDOWN_KEY(normalizedEmail)) || null;
    } catch {
      cooldownUntil = null;
    }

    if (cooldownUntil && Date.now() < cooldownUntil) {
      const remainingMinutes = Math.ceil((cooldownUntil - Date.now()) / 60000);
      return NextResponse.json(
        { 
          error: `Too many attempts. Please try again in ${remainingMinutes} minutes.`,
          cooldownUntil,
          remainingMinutes
        },
        { status: 429 }
      );
    }

    // Check resend cooldown (60 seconds between sends)
    let lastSendTime: number | null = null;
    try {
      lastSendTime = await redis?.get<number>(FORGOT_PASSWORD_RESEND_KEY(normalizedEmail)) || null;
    } catch {
      lastSendTime = null;
    }

    if (lastSendTime) {
      const timeSinceLastSend = Date.now() - lastSendTime;
      if (timeSinceLastSend < RESEND_COOLDOWN_SECONDS * 1000) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - timeSinceLastSend) / 1000);
        return NextResponse.json(
          { 
            error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
            remainingSeconds,
            canResendAt: lastSendTime + (RESEND_COOLDOWN_SECONDS * 1000)
          },
          { status: 429 }
        );
      }
    }

    // Check if email exists (customer or employee)
    // Using get_user_by_email RPC to bypass RLS and handle both tables
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('get_user_by_email', {
      p_email: normalizedEmail
    });

    let userRecord = null;
    let userName = 'User';

    if (!rpcError && rpcResult && rpcResult.length > 0) {
      userRecord = rpcResult[0];
      userName = userRecord.name || 'User';
      }

    if (!userRecord) {
      // Fallback: direct query prioritizing employees for staff login compatibility
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('id, name, email')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      
      if (employee) {
        userRecord = employee;
        userName = employee.name;
        } else {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, name, email')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (customer) {
          userRecord = customer;
          userName = customer.name;
          }
      }
    }

    if (!userRecord) {
      // Don't reveal if email exists or not for security
      const response = NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a verification code.',
        expiresIn: OTP_EXPIRY_SECONDS,
        resendIn: RESEND_COOLDOWN_SECONDS
      });

      // Avoid stale OTP cookie when the email is not found.
      response.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);
      return response;
    }

    // Check rate limit attempts
    let attempts = 0;
    try {
      attempts = await redis?.get<number>(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail)) || 0;
    } catch {
      attempts = 0;
    }

    if (attempts >= MAX_ATTEMPTS) {
      // Set cooldown period
      const cooldownExpiry = Date.now() + (COOLDOWN_SECONDS * 1000);
      try {
        await redis?.set(FORGOT_PASSWORD_COOLDOWN_KEY(normalizedEmail), cooldownExpiry, { ex: COOLDOWN_SECONDS });
        // Reset attempts counter
        await redis?.del(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));
      } catch {
        // If Redis is unavailable, continue with throttling disabled.
      }
      
      return NextResponse.json(
        { 
          error: 'Too many attempts. Please try again in 2 hours.',
          cooldownUntil: cooldownExpiry
        },
        { status: 429 }
      );
    }

    // Increment attempts
    try {
      await redis?.incr(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));
      await redis?.expire(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail), COOLDOWN_SECONDS);
    } catch {
      // If Redis is unavailable, continue with throttling disabled.
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + (OTP_EXPIRY_SECONDS * 1000);

    // Store OTP in Redis
    const otpData: OTPData = {
      code: otp,
      expiresAt,
      attempts: 0,
      email: normalizedEmail
    };

    let signedOtpCookie: string | null = null;
    try {
      const cookiePayload = encodeURIComponent(JSON.stringify(otpData));
      signedOtpCookie = await signCookieValue(cookiePayload);
    } catch {
      signedOtpCookie = null;
    }

    try {
      await redis?.set(
        FORGOT_PASSWORD_OTP_KEY(normalizedEmail),
        JSON.stringify(otpData),
        { ex: OTP_EXPIRY_SECONDS }
      );
    } catch {
      // Keep flow alive even if Redis is unavailable; DB fallback is used in verify route.
    }

    // Set resend cooldown
    try {
      await redis?.set(
        FORGOT_PASSWORD_RESEND_KEY(normalizedEmail),
        Date.now(),
        { ex: RESEND_COOLDOWN_SECONDS }
      );
    } catch {
      // Best-effort only.
    }

    // Persist OTP in database as backup for verification when Redis is unavailable.
    await supabaseAdmin
      .from('otp_codes')
      .delete()
      .eq('email', normalizedEmail)
      .eq('purpose', 'forgot-password');

    await supabaseAdmin
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code: otp,
        purpose: 'forgot-password',
        expires_at: new Date(expiresAt).toISOString(),
        is_used: false,
      });

    // Send OTP via email
    const emailResult = await sendPasswordResetOTP(
      normalizedEmail,
      userName,
      otp
    );

    if (!emailResult.success) {
      if (process.env.NODE_ENV === 'development') {
        const response = NextResponse.json({
          success: true,
          message: 'Email service unavailable in development mode. Use the provided OTP for testing.',
          expiresIn: OTP_EXPIRY_SECONDS,
          resendIn: RESEND_COOLDOWN_SECONDS,
          devOtp: otp,
          warning: emailResult.error || 'Brevo delivery failed',
        });

        if (signedOtpCookie) {
          response.cookies.set(FORGOT_PASSWORD_OTP_COOKIE, signedOtpCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: OTP_EXPIRY_SECONDS,
          });
        }

        return response;
      }

      return NextResponse.json(
        { error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: OTP_EXPIRY_SECONDS,
      resendIn: RESEND_COOLDOWN_SECONDS,
    });

    if (signedOtpCookie) {
      response.cookies.set(FORGOT_PASSWORD_OTP_COOKIE, signedOtpCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: OTP_EXPIRY_SECONDS,
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

