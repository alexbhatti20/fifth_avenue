import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateToken } from '@/lib/jwt';
import { generateOTP, sendLoginOTP } from '@/lib/brevo';
import { 
  checkLoginRateLimit, 
  recordLoginFailure, 
  clearLoginRateLimit,
  getClientIP 
} from '@/lib/rate-limit';

// OTP expiry time: 2 minutes
const OTP_EXPIRY_MINUTES = 2;

// Cache keys
const LOGIN_OTP_KEY = (email: string) => `otp:login:${email}`;
const USER_CACHE_KEY = (email: string) => `user:profile:${email}`;

interface UserProfile {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  phone: string;
  address?: string;
  type: 'admin' | 'employee' | 'customer';
  role?: string;
  permissions?: Record<string, boolean>;
  is2FAEnabled?: boolean;
}

/**
 * Get user profile from cache or database
 */
async function getUserProfile(email: string, forceRefresh: boolean = false): Promise<UserProfile | null> {
  // Skip cache if forceRefresh is true
  if (!forceRefresh) {
    // Try cache first
    const cached = await redis.get<string | UserProfile>(USER_CACHE_KEY(email));
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
  } else {
    // Clear existing cache
    await redis.del(USER_CACHE_KEY(email));
  }

  if (!supabase) return null;

  // Use RPC function to bypass RLS (SECURITY DEFINER)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
    p_email: email.toLowerCase()
  });

  console.log('getUserProfile RPC result:', { rpcResult, rpcError, email });

  if (!rpcError && rpcResult && rpcResult.length > 0) {
    const user = rpcResult[0];
    const profile: UserProfile = {
      id: user.id,
      authUserId: user.id, // Will be updated later if needed
      email: user.email,
      name: user.name,
      phone: user.phone,
      type: user.user_type as 'admin' | 'employee' | 'customer',
      role: user.role,
      permissions: user.permissions,
      is2FAEnabled: user.is_2fa_enabled,
    };
    
    // Cache for 1 hour
    await redis.set(USER_CACHE_KEY(email), JSON.stringify(profile), { ex: 3600 });
    return profile;
  }

  // Fallback: Check employees first (includes admin)
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, auth_user_id, email, name, phone, role, permissions, is_2fa_enabled, status')
    .ilike('email', email.toLowerCase())
    .single();

  console.log('getUserProfile employee query:', { employee, empError, email });

  if (employee) {
    const profile: UserProfile = {
      id: employee.id,
      authUserId: employee.auth_user_id,
      email: employee.email,
      name: employee.name,
      phone: employee.phone,
      type: employee.role === 'admin' ? 'admin' : 'employee',
      role: employee.role,
      permissions: employee.permissions,
      is2FAEnabled: employee.is_2fa_enabled,
    };
    
    // Cache for 1 hour
    await redis.set(USER_CACHE_KEY(email), JSON.stringify(profile), { ex: 3600 });
    return profile;
  }

  // Check customers
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id, auth_user_id, email, name, phone, address, is_2fa_enabled, is_verified')
    .ilike('email', email.toLowerCase())
    .single();

  console.log('getUserProfile customer query:', { customer, custError, email });

  if (customer) {
    const profile: UserProfile = {
      id: customer.id,
      authUserId: customer.auth_user_id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      type: 'customer',
      is2FAEnabled: customer.is_2fa_enabled,
    };
    
    // Cache for 1 hour
    await redis.set(USER_CACHE_KEY(email), JSON.stringify(profile), { ex: 3600 });
    return profile;
  }

  return null;
}

/**
 * POST /api/auth/login - Step 1: Validate credentials and send OTP
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Check rate limit
    const rateLimitResult = await checkLoginRateLimit(ip);
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.blockedUntil 
        ? Math.ceil((rateLimitResult.blockedUntil - Date.now()) / 1000)
        : 900; // 15 minutes default
      
      return NextResponse.json(
        { 
          error: 'Too many failed login attempts. Please try again later.',
          retryAfter,
          blockedUntil: rateLimitResult.blockedUntil,
        },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }

    const { email, password, skipOTP } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection unavailable' },
        { status: 500 }
      );
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    console.log('Supabase Auth result:', { 
      user: authData?.user?.id, 
      error: authError?.message,
      errorCode: authError?.code,
      email: normalizedEmail 
    });

    if (authError || !authData.user) {
      // Record failed attempt
      const failureResult = await recordLoginFailure(ip);
      
      // Check for specific error types
      let errorMessage = 'Invalid email or password';
      
      if (authError?.message?.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email before logging in. Check your inbox for the confirmation link.';
      } else if (authError?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (authError?.message?.includes('Database error')) {
        // Database error - try to get user profile anyway to check if it's an auth issue
        console.error('Database error during auth, checking if user exists in tables...');
        
        // Check if user exists in our tables
        const { data: rpcCheck } = await supabase.rpc('get_user_by_email', {
          p_email: normalizedEmail
        });
        
        if (rpcCheck && rpcCheck.length > 0) {
          errorMessage = 'Authentication service error. The user exists but auth failed. Please try again or reset your password.';
        } else {
          errorMessage = 'Authentication service error. Please try again later.';
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          attemptsRemaining: failureResult.remaining,
          debug: process.env.NODE_ENV === 'development' ? authError?.message : undefined,
        },
        { status: 401 }
      );
    }

    // Get user profile - force refresh from database to ensure fresh 2FA status
    const userProfile = await getUserProfile(normalizedEmail, true);

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found. Please contact support.' },
        { status: 404 }
      );
    }

    // For employees/admins, check portal_enabled before allowing login
    if (userProfile.type === 'admin' || userProfile.type === 'employee') {
      // Try RPC function first to bypass RLS
      let portalEnabled = true;
      let blockReason: string | null = null;

      const { data: accessData, error: accessErr } = await supabase.rpc('check_employee_portal_access', {
        p_email: normalizedEmail
      });

      if (!accessErr && accessData && accessData.found) {
        portalEnabled = accessData.portal_enabled;
        blockReason = accessData.block_reason;
      } else {
        // Fallback: Direct query (works on server-side with auth context)
        const { data: empData } = await supabase
          .from('employees')
          .select('portal_enabled, block_reason')
          .ilike('email', normalizedEmail)
          .single();
        
        if (empData) {
          portalEnabled = empData.portal_enabled;
          blockReason = empData.block_reason;
        }
      }

      if (!portalEnabled) {
        // Sign out the user since we authenticated but they're blocked
        await supabase.auth.signOut();
        
        return NextResponse.json(
          { 
            error: blockReason || 'Your portal access has been disabled. Please contact the administrator.',
            portalBlocked: true,
          },
          { status: 403 }
        );
      }
    }

    // For customers, check if they are banned
    if (userProfile.type === 'customer') {
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('is_banned, ban_reason')
        .ilike('email', normalizedEmail)
        .single();

      if (!custErr && custData && custData.is_banned) {
        // Sign out the user since we authenticated but they're banned
        await supabase.auth.signOut();
        
        return NextResponse.json(
          { 
            error: custData.ban_reason || 'Your account has been suspended. Please contact support.',
            accountBanned: true,
          },
          { status: 403 }
        );
      }
    }

    // Check if 2FA is enabled or if OTP verification is required
    // Explicitly check for boolean true to avoid truthy issues with null/undefined
    const requires2FA = userProfile.is2FAEnabled === true;
    const isAdmin = userProfile.type === 'admin';
    const isEmployee = userProfile.type === 'employee';
    const isCustomer = userProfile.type === 'customer';

    // Debug log for troubleshooting (remove in production)
    console.log('Login check:', {
      email: normalizedEmail,
      userType: userProfile.type,
      is2FAEnabled: userProfile.is2FAEnabled,
      requires2FA,
      isAdmin,
      isEmployee,
      isCustomer,
    });

    // OTP disabled - direct login for all users
    const shouldRequireOTP = false;

    if (shouldRequireOTP && !skipOTP) {
      // Generate OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in Redis
      await redis.set(
        LOGIN_OTP_KEY(normalizedEmail),
        JSON.stringify({
          code: otp,
          expiresAt,
          authUserId: authData.user.id,
          attempts: 0,
        }),
        { ex: OTP_EXPIRY_MINUTES * 60 }
      );

      // Store in database as backup
      await supabase
        .from('otp_codes')
        .insert({
          email: normalizedEmail,
          code: otp,
          purpose: 'login',
          expires_at: new Date(expiresAt).toISOString(),
        });

      // Send OTP via email
      const emailResult = await sendLoginOTP(normalizedEmail, userProfile.name, otp);

      if (!emailResult.success) {
        return NextResponse.json(
          { error: 'Failed to send verification code' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        requiresOTP: true,
        message: 'Verification code sent to your email',
        email: normalizedEmail,
        userType: userProfile.type,
        expiresIn: OTP_EXPIRY_MINUTES * 60,
      });
    }

    // Direct login (no OTP required for regular customers without 2FA)
    await clearLoginRateLimit(ip);

    // For employees/admins, update the auth_user_id in the database
    if (isEmployee || isAdmin) {
      await supabase
        .from('employees')
        .update({
          auth_user_id: authData.user.id,
          updated_at: new Date().toISOString(),
        })
        .ilike('email', normalizedEmail);
    }

    // For customers, update the auth_user_id using RPC to bypass RLS
    if (isCustomer) {
      await supabase.rpc('update_customer_auth_user_id', {
        p_email: normalizedEmail,
        p_auth_user_id: authData.user.id,
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: userProfile.id,
      email: userProfile.email,
      userType: userProfile.type as 'customer' | 'admin' | 'employee',
      role: userProfile.role as any,
    });

    const response = NextResponse.json({
      success: true,
      requiresOTP: false,
      message: 'Login successful',
      userType: userProfile.type,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        phone: userProfile.phone,
        address: userProfile.address,
        type: userProfile.type,
        role: userProfile.role,
        employee_id: userProfile.id,
        permissions: userProfile.permissions,
      },
      token,
      // Include Supabase session for RLS-enabled API calls
      supabaseAccessToken: authData.session?.access_token,
    });

    // Set secure HTTP-only cookie
    const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also set Supabase access token cookie for API routes
    if (authData.session?.access_token) {
      response.cookies.set('sb-access-token', authData.session.access_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour (Supabase token expiry)
        path: '/',
      });
    }

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
