import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

const FORGOT_PASSWORD_VERIFIED_KEY = (email: string) => `forgot-password:verified:${email}`;
const FORGOT_PASSWORD_ATTEMPTS_KEY = (email: string) => `forgot-password:attempts:${email}`;

interface VerifiedSession {
  token: string;
  email: string;
  verifiedAt: number;
  expiresAt: number;
}

export async function POST(request: NextRequest) {
  try {
    const { email, token, newPassword, confirmPassword } = await request.json();

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

    const normalizedEmail = email.toLowerCase().trim();

    // Verify the session token
    const sessionData = await redis?.get<string | VerifiedSession>(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));
    
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session expired. Please start the password reset process again.' },
        { status: 400 }
      );
    }

    const session: VerifiedSession = typeof sessionData === 'string' 
      ? JSON.parse(sessionData) 
      : sessionData;

    // Verify token matches
    if (session.token !== token) {
      return NextResponse.json(
        { error: 'Invalid session. Please start the password reset process again.' },
        { status: 400 }
      );
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      await redis?.del(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));
      return NextResponse.json(
        { error: 'Session expired. Please start the password reset process again.' },
        { status: 400 }
      );
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
    await redis?.del(FORGOT_PASSWORD_VERIFIED_KEY(normalizedEmail));
    await redis?.del(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
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

