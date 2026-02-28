import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { 
  checkOTPRateLimit, 
  recordOTPFailure, 
  clearOTPRateLimit,
  clearRegistrationRateLimit,
  getClientIP 
} from '@/lib/rate-limit';

// Cache keys
const PENDING_REGISTRATION_KEY = (email: string) => `pending_registration:${email}`;
const OTP_KEY = (email: string) => `otp:registration:${email}`;

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
}

interface PendingRegistration {
  email: string;
  name: string;
  phone: string;
  password: string;
  address: string | null;
  createdAt: number;
}

// POST /api/auth/verify-otp - Step 2: Verify OTP and create account
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { email, otp } = await request.json();

    // Validate input
    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim();

    // Check rate limit for OTP attempts
    const rateLimitResult = await checkOTPRateLimit(normalizedEmail);
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.blockedUntil 
        ? Math.ceil((rateLimitResult.blockedUntil - Date.now()) / 1000)
        : 60;
      
      return NextResponse.json(
        { 
          error: 'Too many failed attempts. Please request a new code.',
          retryAfter,
        },
        { status: 429 }
      );
    }

    // Get OTP from Redis first (faster)
    let otpData: OTPData | null = null;
    const redisOTPData = await redis?.get<string | OTPData>(OTP_KEY(normalizedEmail));
    
    if (redisOTPData) {
      otpData = typeof redisOTPData === 'string' ? JSON.parse(redisOTPData) : redisOTPData;
    }

    // Fallback to database
    if (!otpData && supabase) {
      const { data: dbOTP } = await supabase
        .from('otp_codes')
        .select('code, expires_at, is_used')
        .eq('email', normalizedEmail)
        .eq('purpose', 'registration')
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (dbOTP) {
        otpData = {
          code: dbOTP.code,
          expiresAt: new Date(dbOTP.expires_at).getTime(),
          attempts: 0,
        };
      }
    }

    if (!otpData) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if OTP expired
    if (Date.now() > otpData.expiresAt) {
      // Clear expired OTP
      await redis?.del(OTP_KEY(normalizedEmail));
      
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (otpData.code !== normalizedOTP) {
      // Record failed attempt
      await recordOTPFailure(normalizedEmail);
      
      // Update attempts in Redis
      otpData.attempts = (otpData.attempts || 0) + 1;
      const remainingTTL = Math.floor((otpData.expiresAt - Date.now()) / 1000);
      if (remainingTTL > 0) {
        await redis?.set(OTP_KEY(normalizedEmail), JSON.stringify(otpData), { ex: remainingTTL });
      }

      return NextResponse.json(
        { 
          error: 'Invalid verification code',
          attemptsRemaining: Math.max(0, 5 - otpData.attempts),
        },
        { status: 400 }
      );
    }

    // OTP is valid - get pending registration data
    const pendingDataRaw = await redis.get<string | PendingRegistration>(PENDING_REGISTRATION_KEY(normalizedEmail));
    
    if (!pendingDataRaw) {
      return NextResponse.json(
        { error: 'Registration session expired. Please start over.' },
        { status: 400 }
      );
    }

    const pendingData: PendingRegistration = typeof pendingDataRaw === 'string' 
      ? JSON.parse(pendingDataRaw) 
      : pendingDataRaw;

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection unavailable' },
        { status: 500 }
      );
    }

    // Create Supabase auth user with password
    const { data: authData, error: authError } = await supabase!.auth.signUp({
      email: normalizedEmail,
      password: pendingData.password,
      options: {
        data: {
          name: pendingData.name,
          phone: pendingData.phone,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create account' },
        { status: 500 }
      );
    }

    // Create customer record - RLS allows inserts for registration
    const { data: customer, error: customerError } = await supabase!
      .from('customers')
      .insert({
        auth_user_id: authData.user.id,
        email: normalizedEmail,
        name: pendingData.name,
        phone: pendingData.phone,
        address: pendingData.address,
        is_verified: true,
      })
      .select()
      .single();

    if (customerError) {
      // Check for duplicate email or phone
      if (customerError.code === '23505') {
        // Unique violation - customer may already exist
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select()
          .eq('email', normalizedEmail)
          .single();
        
        if (existingCustomer) {
          // Customer already exists, try to sign them in to get session
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: pendingData.password,
          });
          
          const token = signInData?.session?.access_token || '';

          // Cleanup Redis
          await Promise.all([
            redis?.del(OTP_KEY(normalizedEmail)),
            redis?.del(PENDING_REGISTRATION_KEY(normalizedEmail)),
          ].filter(Boolean));

          const response = NextResponse.json({
            success: true,
            message: 'Welcome back! Account already exists.',
            user: {
              id: existingCustomer.id,
              email: existingCustomer.email,
              name: existingCustomer.name,
              phone: existingCustomer.phone,
              address: existingCustomer.address,
              isVerified: existingCustomer.is_verified,
            },
            token,
          });

          const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
          response.cookies.set('auth_token', token, {
            httpOnly: false,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });
          
          if (signInData?.session?.refresh_token) {
            response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
              path: '/',
            });
          }

          return response;
        }
      }
      
      // Note: Cannot cleanup auth user without admin access - user will need to re-register
      return NextResponse.json(
        { error: `Failed to create customer profile: ${customerError.message}` },
        { status: 500 }
      );
    }

    // Mark OTP as used in database
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('email', normalizedEmail)
      .eq('purpose', 'registration');

    // Cleanup Redis
    await Promise.all([
      redis?.del(OTP_KEY(normalizedEmail)),
      redis?.del(PENDING_REGISTRATION_KEY(normalizedEmail)),
      clearOTPRateLimit(normalizedEmail),
      clearRegistrationRateLimit(ip),
    ].filter(Boolean));

    // Sign in the newly created user to get session token
    const { data: sessionData } = await supabase!.auth.signInWithPassword({
      email: normalizedEmail,
      password: pendingData.password,
    });
    
    const token = sessionData?.session?.access_token || '';

    // Create welcome notification (non-critical, fire and forget)
    try {
      supabase.from('notifications').insert({
        user_type: 'customer',
        user_id: customer.id,
        title: 'Welcome to Zoiro Broast Hub! 🍗',
        message: 'Your account has been created successfully. Start ordering delicious food now!',
        type: 'system',
      });
    } catch {}

    // Create initial loyalty points entry (non-critical, fire and forget)
    try {
      supabase.from('loyalty_points').insert({
        customer_id: customer.id,
        points: 50, // Welcome bonus
        type: 'bonus',
        description: 'Welcome bonus points',
      });
    } catch {}

    // Set auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully! Welcome to Zoiro Broast Hub!',
      user: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isVerified: true,
      },
      token,
    });

    // Set secure HTTP-only cookie for token
    const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
    response.cookies.set('auth_token', token, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    if (sessionData?.session?.refresh_token) {
      response.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;

  } catch (error) {
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

