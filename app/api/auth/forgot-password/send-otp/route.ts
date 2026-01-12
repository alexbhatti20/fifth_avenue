import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabaseAdmin } from '@/lib/supabase';
import { generateOTP, sendPasswordResetOTP } from '@/lib/brevo';

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

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
}

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

    // Check if in cooldown period (after 3 failed attempts)
    const cooldownUntil = await redis?.get<number>(FORGOT_PASSWORD_COOLDOWN_KEY(normalizedEmail));
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
    const lastSendTime = await redis?.get<number>(FORGOT_PASSWORD_RESEND_KEY(normalizedEmail));
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
    console.log('Forgot Password: Checking user', normalizedEmail);
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('get_user_by_email', {
      p_email: normalizedEmail
    });

    if (rpcError) {
      console.error('RPC error in send-otp:', rpcError);
    }

    let userRecord = null;
    let userName = 'User';

    if (!rpcError && rpcResult && rpcResult.length > 0) {
      userRecord = rpcResult[0];
      userName = userRecord.name || 'User';
      console.log('User found via RPC:', { type: userRecord.user_type, name: userName });
    }

    if (!userRecord) {
      console.log('RPC found nothing, trying direct query (prioritizing employees):', normalizedEmail);
      // Fallback: direct query prioritizing employees for staff login compatibility
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('id, name, email')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      
      if (employee) {
        userRecord = employee;
        userName = employee.name;
        console.log('User found in employees table:', userName);
      } else {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, name, email')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (customer) {
          userRecord = customer;
          userName = customer.name;
          console.log('User found in customers table:', userName);
        }
      }
    }

    if (!userRecord) {
      console.log('No user record found in any table for:', normalizedEmail);
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a verification code.',
        expiresIn: OTP_EXPIRY_SECONDS,
        resendIn: RESEND_COOLDOWN_SECONDS
      });
    }

    console.log('Generating OTP for:', normalizedEmail);

    // Check rate limit attempts
    const attempts = await redis?.get<number>(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail)) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      // Set cooldown period
      const cooldownExpiry = Date.now() + (COOLDOWN_SECONDS * 1000);
      await redis?.set(FORGOT_PASSWORD_COOLDOWN_KEY(normalizedEmail), cooldownExpiry, { ex: COOLDOWN_SECONDS });
      // Reset attempts counter
      await redis?.del(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));
      
      return NextResponse.json(
        { 
          error: 'Too many attempts. Please try again in 2 hours.',
          cooldownUntil: cooldownExpiry
        },
        { status: 429 }
      );
    }

    // Increment attempts
    await redis?.incr(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail));
    await redis?.expire(FORGOT_PASSWORD_ATTEMPTS_KEY(normalizedEmail), COOLDOWN_SECONDS);

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

    await redis?.set(
      FORGOT_PASSWORD_OTP_KEY(normalizedEmail),
      JSON.stringify(otpData),
      { ex: OTP_EXPIRY_SECONDS }
    );

    // Set resend cooldown
    await redis?.set(
      FORGOT_PASSWORD_RESEND_KEY(normalizedEmail),
      Date.now(),
      { ex: RESEND_COOLDOWN_SECONDS }
    );

    // Send OTP via email
    const emailResult = await sendPasswordResetOTP(
      normalizedEmail,
      userName,
      otp
    );

    if (!emailResult.success) {
      console.log('📧 DEV MODE - Forgot Password OTP:', otp);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: OTP_EXPIRY_SECONDS,
      resendIn: RESEND_COOLDOWN_SECONDS,
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error: any) {
    console.error('Send forgot password OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
