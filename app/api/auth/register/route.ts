import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateOTP, sendRegistrationOTP } from '@/lib/brevo';
import { 
  checkRegistrationRateLimit, 
  recordRegistrationFailure, 
  getClientIP 
} from '@/lib/rate-limit';

// OTP expiry time: 2 minutes
const OTP_EXPIRY_MINUTES = 2;

// Cache keys
const PENDING_REGISTRATION_KEY = (email: string) => `pending_registration:${email}`;
const OTP_KEY = (email: string) => `otp:registration:${email}`;

interface RegistrationRequest {
  email: string;
  name: string;
  phone: string;
  password: string;
  address?: string;
}

interface UserTypeCheckResult {
  userType: 'admin' | 'employee' | 'customer';
  existingUser: boolean;
  role?: string;
  employeeId?: string;
}

/**
 * Check user type based on email
 * Priority: Admin → Employee → Customer
 */
async function checkUserType(email: string): Promise<UserTypeCheckResult> {
  if (!supabase) {
    throw new Error('Database connection unavailable');
  }

  // Check if email exists in employees table (includes admin)
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, role, employee_id, status')
    .eq('email', email.toLowerCase())
    .single();

  if (employee && !empError) {
    const isAdmin = employee.role === 'admin';
    return {
      userType: isAdmin ? 'admin' : 'employee',
      existingUser: true,
      role: employee.role,
      employeeId: employee.employee_id,
    };
  }

  // Check if email exists in customers table
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (customer && !custError) {
    return {
      userType: 'customer',
      existingUser: true,
    };
  }

  // New customer registration
  return {
    userType: 'customer',
    existingUser: false,
  };
}

/**
 * Validate registration input
 */
function validateInput(data: RegistrationRequest): { valid: boolean; error?: string } {
  const { email, name, phone, password } = data;

  // Email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Valid email is required' };
  }

  // Name validation
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  // Phone validation (Pakistan format)
  if (!phone || !/^(\+92|0)?[3][0-9]{9}$/.test(phone.replace(/[\s-]/g, ''))) {
    return { valid: false, error: 'Valid Pakistani phone number is required (e.g., 03001234567)' };
  }

  // Password validation - trim and check length
  const trimmedPassword = password?.trim() || '';
  if (trimmedPassword.length < 8) {
    return { valid: false, error: `Password must be at least 8 characters (currently ${trimmedPassword.length})` };
  }

  // Password strength check
  const hasUppercase = /[A-Z]/.test(trimmedPassword);
  const hasLowercase = /[a-z]/.test(trimmedPassword);
  const hasNumber = /[0-9]/.test(trimmedPassword);
  
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return { 
      valid: false, 
      error: 'Password must contain uppercase, lowercase, and a number' 
    };
  }

  return { valid: true };
}

/**
 * Format phone number to standard format
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+92')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '+92' + cleaned.slice(1);
  }
  return '+92' + cleaned;
}

/**
 * POST /api/auth/register - Step 1: Validate and Send OTP
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Check rate limit
    const rateLimitResult = await checkRegistrationRateLimit(ip);
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.blockedUntil 
        ? Math.ceil((rateLimitResult.blockedUntil - Date.now()) / 1000)
        : 60;
      
      return NextResponse.json(
        { 
          error: 'Too many registration attempts. Please try again later.',
          retryAfter,
        },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }

    // Parse and validate input
    const body: RegistrationRequest = await request.json();
    const validation = validateInput(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { email, name, phone, password, address } = body;
    const normalizedEmail = email.toLowerCase().trim();
    const formattedPhone = formatPhoneNumber(phone);

    // Check user type and if already registered
    const userTypeCheck = await checkUserType(normalizedEmail);

    if (userTypeCheck.existingUser) {
      // For existing users, redirect to login
      if (userTypeCheck.userType === 'admin') {
        return NextResponse.json(
          { 
            error: 'This email is registered as an admin account. Please use admin login.',
            userType: 'admin',
          },
          { status: 400 }
        );
      }

      if (userTypeCheck.userType === 'employee') {
        return NextResponse.json(
          { 
            error: 'This email is registered as an employee account. Please use employee login.',
            userType: 'employee',
            role: userTypeCheck.role,
          },
          { status: 400 }
        );
      }

      // Existing customer
      return NextResponse.json(
        { 
          error: 'Email already registered. Please login instead.',
          userType: 'customer',
        },
        { status: 400 }
      );
    }

    // Check if phone already exists
    if (supabase) {
      const { data: phoneExists } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', formattedPhone)
        .single();

      if (phoneExists) {
        return NextResponse.json(
          { error: 'Phone number already registered' },
          { status: 400 }
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store pending registration data in Redis (expires in 10 minutes)
    await redis.set(
      PENDING_REGISTRATION_KEY(normalizedEmail),
      JSON.stringify({
        email: normalizedEmail,
        name: name.trim(),
        phone: formattedPhone,
        password, // Will be hashed when creating Supabase auth
        address: address?.trim() || null,
        createdAt: Date.now(),
      }),
      { ex: 600 } // 10 minutes
    );

    // Store OTP in Redis (expires in 2 minutes)
    await redis.set(
      OTP_KEY(normalizedEmail),
      JSON.stringify({
        code: otp,
        expiresAt,
        attempts: 0,
      }),
      { ex: OTP_EXPIRY_MINUTES * 60 }
    );

    // Also store in database for backup
    if (supabase) {
      // Delete any existing OTP for this email
      await supabase
        .from('otp_codes')
        .delete()
        .eq('email', normalizedEmail)
        .eq('purpose', 'registration');

      // Insert new OTP
      await supabase
        .from('otp_codes')
        .insert({
          email: normalizedEmail,
          code: otp,
          purpose: 'registration',
          expires_at: new Date(expiresAt).toISOString(),
        });
    }

    // Send OTP via email
    const emailResult = await sendRegistrationOTP(normalizedEmail, name, otp);

    if (!emailResult.success) {
      // In development, still allow registration but show OTP in response
      const isDev = process.env.NODE_ENV === 'development';
      
      if (isDev) {
        console.log('=================================');
        console.log('DEV MODE - OTP for', normalizedEmail, ':', otp);
        console.log('=================================');
        
        return NextResponse.json({
          success: true,
          message: `Verification code sent to ${normalizedEmail}`,
          email: normalizedEmail,
          expiresIn: OTP_EXPIRY_MINUTES * 60,
          // DEV ONLY - remove in production
          devOtp: otp,
        });
      }
      
      // Record failure for rate limiting
      await recordRegistrationFailure(ip);
      
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      email: normalizedEmail,
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/register - Resend OTP
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Check rate limit
    const rateLimitResult = await checkRegistrationRateLimit(ip);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another code.' },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if pending registration exists
    const pendingData = await redis.get<string>(PENDING_REGISTRATION_KEY(normalizedEmail));
    
    if (!pendingData) {
      return NextResponse.json(
        { error: 'Registration session expired. Please start over.' },
        { status: 400 }
      );
    }

    const pending = typeof pendingData === 'string' ? JSON.parse(pendingData) : pendingData;

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

    // Update OTP in Redis
    await redis.set(
      OTP_KEY(normalizedEmail),
      JSON.stringify({
        code: otp,
        expiresAt,
        attempts: 0,
      }),
      { ex: OTP_EXPIRY_MINUTES * 60 }
    );

    // Update in database
    if (supabase) {
      await supabase
        .from('otp_codes')
        .delete()
        .eq('email', normalizedEmail)
        .eq('purpose', 'registration');

      await supabase
        .from('otp_codes')
        .insert({
          email: normalizedEmail,
          code: otp,
          purpose: 'registration',
          expires_at: new Date(expiresAt).toISOString(),
        });
    }

    // Send OTP
    const emailResult = await sendRegistrationOTP(normalizedEmail, pending.name, otp);

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'New verification code sent',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend code' },
      { status: 500 }
    );
  }
}
