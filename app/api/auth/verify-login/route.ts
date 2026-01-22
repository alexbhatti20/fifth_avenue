import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateToken } from '@/lib/jwt';
import { clearLoginRateLimit, getClientIP } from '@/lib/rate-limit';

// Redis key for login OTP
const LOGIN_OTP_KEY = (email: string) => `otp:login:${email}`;

// POST /api/auth/verify-login - Step 2: Verify login OTP and return token
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp.trim();

    // First try Redis (primary storage)
    const redisOtpData = await redis.get<string | { code: string; expiresAt: number; authUserId: string; attempts: number }>(LOGIN_OTP_KEY(normalizedEmail));
    
    let isValid = false;
    let authUserId: string | null = null;

    if (redisOtpData) {
      const otpData = typeof redisOtpData === 'string' ? JSON.parse(redisOtpData) : redisOtpData;
      
      // Check if OTP matches and not expired
      if (otpData.code === normalizedOtp && otpData.expiresAt > Date.now()) {
        isValid = true;
        authUserId = otpData.authUserId;
        // Delete OTP from Redis after successful verification
        await redis.del(LOGIN_OTP_KEY(normalizedEmail));
      }
    }

    // Fallback to database if Redis didn't have valid OTP
    if (!isValid) {
      const { data: otpRecord, error: otpError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('code', normalizedOtp)
        .eq('purpose', 'login')
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!otpError && otpRecord) {
        isValid = true;
        // Mark OTP as used
        await supabase
          .from('otp_codes')
          .update({ is_used: true })
          .eq('id', otpRecord.id);
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Clear rate limit on successful OTP verification
    await clearLoginRateLimit(ip);
    
    // Get user data using RPC function (SECURITY DEFINER bypasses RLS)
    let user;
    let userType: 'customer' | 'employee' | 'admin';

    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
      p_email: normalizedEmail
    });

    console.log('RPC get_user_by_email result:', { rpcResult, rpcError, normalizedEmail });

    if (rpcError) {
      console.error('RPC error details:', JSON.stringify(rpcError, null, 2));
      return NextResponse.json(
        { error: `Database error: ${rpcError.message}`, details: rpcError },
        { status: 500 }
      );
    }

    if (!rpcResult || rpcResult.length === 0) {
      console.error('User not found for email:', normalizedEmail);
      return NextResponse.json(
        { error: 'User not found. Please register first or check your email.' },
        { status: 404 }
      );
    }

    const profile = rpcResult[0];
    user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      permissions: profile.permissions,
      employee_id: profile.employee_id,
      status: profile.status,
      is_2fa_enabled: profile.is_2fa_enabled
    };
    userType = profile.user_type as 'customer' | 'employee' | 'admin';

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      userType: userType,
      role: userType === 'customer' ? undefined : user.role,
    });

    // Create response with user data
    const responseData = {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        ...(userType !== 'customer' && {
          employee_id: user.employee_id,
          role: user.role,
          permissions: user.permissions,
        }),
      },
      userType,
      token,
    };

    const response = NextResponse.json(responseData);

    // Set secure HTTP-only cookie
    const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
