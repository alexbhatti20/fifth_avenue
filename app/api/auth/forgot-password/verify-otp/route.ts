import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabaseAdmin } from '@/lib/supabase';
import { signCookieValue, verifyCookieValue } from '@/lib/cookie-signing';

// OTP verification limits
const MAX_VERIFY_ATTEMPTS = 3;

const FORGOT_PASSWORD_OTP_KEY = (email: string) => `otp:forgot-password:${email}`;
const FORGOT_PASSWORD_VERIFIED_KEY = (email: string) => `forgot-password:verified:${email}`;
const FORGOT_PASSWORD_OTP_COOKIE = 'forgot_password_otp';
const FORGOT_PASSWORD_VERIFIED_COOKIE = 'forgot_password_verified';

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const otp = typeof body?.otp === 'string' || typeof body?.otp === 'number' ? String(body.otp) : '';

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim();

    let redisVerified = false;

    // Try signed cookie fallback first (works even if Redis/DB writes fail).
    const signedOtpCookie = request.cookies.get(FORGOT_PASSWORD_OTP_COOKIE)?.value;
    if (signedOtpCookie) {
      try {
        const verifiedPayload = await verifyCookieValue(signedOtpCookie);
        if (verifiedPayload) {
          const otpData = JSON.parse(decodeURIComponent(verifiedPayload)) as OTPData;
          if (otpData?.email === normalizedEmail) {
            if (Date.now() > otpData.expiresAt) {
              const expiredResponse = NextResponse.json(
                { error: 'Verification code has expired. Please request a new one.' },
                { status: 400 }
              );
              expiredResponse.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);
              return expiredResponse;
            }

            if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
              const blockedResponse = NextResponse.json(
                { error: 'Too many failed attempts. Please request a new code.' },
                { status: 429 }
              );
              blockedResponse.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);
              return blockedResponse;
            }

            if (otpData.code !== normalizedOTP) {
              otpData.attempts += 1;
              const invalidResponse = NextResponse.json(
                {
                  error: 'Invalid verification code',
                  attemptsRemaining: Math.max(0, MAX_VERIFY_ATTEMPTS - otpData.attempts),
                },
                { status: 400 }
              );

              if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
                invalidResponse.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);
              } else {
                const cookiePayload = encodeURIComponent(JSON.stringify(otpData));
                const signedPayload = await signCookieValue(cookiePayload);
                const ttl = Math.max(1, Math.ceil((otpData.expiresAt - Date.now()) / 1000));
                invalidResponse.cookies.set(FORGOT_PASSWORD_OTP_COOKIE, signedPayload, {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/',
                  maxAge: ttl,
                });
              }

              return invalidResponse;
            }

            redisVerified = true;
          }
        }
      } catch {
        // Ignore cookie parsing/signature errors and continue to Redis/DB fallback.
      }
    }

    // Try Redis first (fast path)
    try {
      const redisOTPData = await redis?.get<string | OTPData>(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));

      if (redisOTPData) {
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

        redisVerified = true;
      }
    } catch {}

    // Fallback to DB if Redis is unavailable or empty
    if (!redisVerified) {
      const { data: dbOTP, error: dbOtpError } = await supabaseAdmin
        .from('otp_codes')
        .select('id, code, expires_at, is_used')
        .eq('email', normalizedEmail)
        .eq('purpose', 'forgot-password')
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbOtpError || !dbOTP) {
        return NextResponse.json(
          { error: 'No verification code found. Please request a new one.' },
          { status: 400 }
        );
      }

      if (dbOTP.code !== normalizedOTP) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }

      await supabaseAdmin
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', dbOTP.id);
    }

    // OTP verified successfully
    // Delete the OTP to prevent reuse
    try {
      await redis?.del(FORGOT_PASSWORD_OTP_KEY(normalizedEmail));
    } catch {
      // Best-effort cleanup only.
    }
    
    // Create a verified session token that allows password reset (valid for 5 minutes)
    const verifiedToken = crypto.randomUUID();

    try {
      await redis?.set(
        FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail),
        JSON.stringify({
          token: verifiedToken,
          email: normalizedEmail,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000),
        }),
        { ex: 300 }
      );
    } catch {
      // Fallback token is persisted in DB below.
    }

    await supabaseAdmin
      .from('otp_codes')
      .delete()
      .eq('email', normalizedEmail)
      .eq('purpose', 'forgot-password-verified');

    await supabaseAdmin
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code: verifiedToken,
        purpose: 'forgot-password-verified',
        expires_at: new Date(Date.now() + (5 * 60 * 1000)).toISOString(),
        is_used: false,
      });

    const response = NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      token: verifiedToken
    });

    response.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);

    try {
      const verifiedPayload = encodeURIComponent(JSON.stringify({
        token: verifiedToken,
        email: normalizedEmail,
        expiresAt: Date.now() + (5 * 60 * 1000),
      }));
      const signedVerifiedPayload = await signCookieValue(verifiedPayload);
      response.cookies.set(FORGOT_PASSWORD_VERIFIED_COOKIE, signedVerifiedPayload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
      });
    } catch {
      // Best-effort cookie fallback only.
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}

