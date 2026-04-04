import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';
import { verifyCookieValue } from '@/lib/cookie-signing';

const FORGOT_PASSWORD_VERIFIED_KEY = (email: string) => `forgot-password:verified:${email}`;
const FORGOT_PASSWORD_ATTEMPTS_KEY = (email: string) => `forgot-password:attempts:${email}`;
const FORGOT_PASSWORD_OTP_COOKIE = 'forgot_password_otp';
const FORGOT_PASSWORD_VERIFIED_COOKIE = 'forgot_password_verified';

interface VerifiedSession {
  token: string;
  email: string;
  verifiedAt: number;
  expiresAt: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

    // Validate input
    if (!email || !token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check for password complexity (at least one uppercase, one lowercase, one number)
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      );
    }

    const normalizedEmail = email;

    // Verify the session token
    let sessionValidated = false;

    // Cookie fallback first.
    const signedVerifiedCookie = request.cookies.get(FORGOT_PASSWORD_VERIFIED_COOKIE)?.value;
    if (signedVerifiedCookie) {
      try {
        const verifiedPayload = await verifyCookieValue(signedVerifiedCookie);
        if (verifiedPayload) {
          const cookieSession = JSON.parse(decodeURIComponent(verifiedPayload)) as { token?: string; email?: string; expiresAt?: number };
          if (
            cookieSession?.token === token &&
            cookieSession?.email === normalizedEmail &&
            typeof cookieSession?.expiresAt === 'number' &&
            Date.now() <= cookieSession.expiresAt
          ) {
            sessionValidated = true;
          }
        }
      } catch {
        sessionValidated = false;
      }
    }

    if (!sessionValidated) {
      try {
      const sessionData = await redis?.get<string | VerifiedSession>(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));

      if (sessionData) {
        const session: VerifiedSession = typeof sessionData === 'string'
          ? JSON.parse(sessionData)
          : sessionData;

        if (session.token !== token) {
          return NextResponse.json(
            { error: 'Invalid session. Please start the password reset process again.' },
            { status: 400 }
          );
        }

        if (Date.now() > session.expiresAt) {
          await redis?.del(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));
          return NextResponse.json(
            { error: 'Session expired. Please start the password reset process again.' },
            { status: 400 }
          );
        }

        sessionValidated = true;
      }
      } catch {
        sessionValidated = false;
      }
    }

    // DB fallback when Redis session is unavailable.
    if (!sessionValidated) {
      const { data: verifiedRecord, error: verifiedError } = await supabase
        .from('otp_codes')
        .select('id, expires_at, is_used')
        .eq('email', normalizedEmail)
        .eq('purpose', 'forgot-password-verified')
        .eq('code', token)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verifiedError || !verifiedRecord) {
        return NextResponse.json(
          { error: 'Session expired. Please start the password reset process again.' },
          { status: 400 }
        );
      }

      sessionValidated = true;
    }

    // Use RPC to update password directly in Supabase auth.users
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_user_password', {
        p_email: normalizedEmail,
        p_new_password: newPassword
      });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password. Please try again.', details: updateError.code },
        { status: 500 }
      );
    }

    if (!updateResult?.success) {
      return NextResponse.json(
        { 
          error: updateResult?.error || 'Failed to update password',
          code: updateResult?.code || 'PASSWORD_UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    // Log the successful password reset
    await supabase.rpc('log_password_reset_completion', {
      p_email: normalizedEmail,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    });

    // Clean up Redis keys
    try {
      await redis?.del(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));
      await redis?.del(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));
    } catch {
      // Best-effort cleanup only.
    }

    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('email', normalizedEmail)
      .eq('purpose', 'forgot-password-verified')
      .eq('code', token)
      .eq('is_used', false);

    const response = NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });

    response.cookies.delete(FORGOT_PASSWORD_VERIFIED_COOKIE);
    response.cookies.delete(FORGOT_PASSWORD_OTP_COOKIE);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to reset password. Please try again.',
        message: error?.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

