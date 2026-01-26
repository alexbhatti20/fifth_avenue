import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { checkPasswordChangeRateLimit, recordPasswordChangeAttempt, recordPasswordChangeFailure } from '@/lib/rate-limit';
import { sendBrevoEmail } from '@/lib/brevo';
import { redis, CACHE_TTL } from '@/lib/redis';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/customer/change-password - Request password change
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Customer access only' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Check rate limit
    const rateLimitResult = await checkPasswordChangeRateLimit(decoded.userId);
    if (!rateLimitResult.allowed) {
      const blockedMinutes = rateLimitResult.blockedUntil 
        ? Math.ceil((rateLimitResult.blockedUntil - Date.now()) / 60000) 
        : 60;
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${blockedMinutes} minutes.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      }, { status: 400 });
    }

    // Get customer's auth user
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('auth_user_id, email')
      .eq('id', decoded.userId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify current password using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword
    });

    if (authError || !authData.user) {
      await recordPasswordChangeFailure(decoded.userId);
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Generate OTP for password change verification
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP and new password in Redis (secured, short-lived)
    const passwordChangeKey = `password_change:${decoded.userId}`;
    
    await redis.setex(passwordChangeKey, 300, JSON.stringify({
      otp,
      newPassword: newPassword, // Stored temporarily, will be used to update via Supabase Auth
      email: customer.email,
      authUserId: customer.auth_user_id,
      createdAt: Date.now()
    }));

    // Send OTP email
    await sendBrevoEmail({
      to: customer.email,
      subject: 'Password Change Verification - Zoiro Broast',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">Password Change Request</h2>
          <p>You have requested to change your password. Use the following OTP to verify:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316;">${otp}</span>
          </div>
          <p><strong>This code expires in 5 minutes.</strong></p>
          <p style="color: #666;">If you didn't request this change, please ignore this email and ensure your account is secure.</p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresAt: otpExpiry.toISOString()
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/customer/change-password - Verify OTP and change password
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.userType !== 'customer') {
      return NextResponse.json({ error: 'Customer access only' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const body = await request.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
    }

    // Get stored password change data
    const passwordChangeKey = `password_change:${decoded.userId}`;
    const storedData = await redis.get(passwordChangeKey);

    if (!storedData) {
      return NextResponse.json(
        { error: 'No pending password change request or it has expired' },
        { status: 400 }
      );
    }

    const parsedData = JSON.parse(storedData as string);

    // Verify OTP
    if (parsedData.otp !== otp) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Update password in Supabase Auth using the stored new password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      parsedData.authUserId,
      { password: parsedData.newPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Clear the stored data
    await redis.del(passwordChangeKey);

    // Record successful attempt
    await recordPasswordChangeAttempt(decoded.userId, ip, true);

    // Create notification
    await supabase.from('notifications').insert({
      user_type: 'customer',
      user_id: decoded.userId,
      title: 'Password Changed',
      message: 'Your password has been successfully changed.',
      type: 'security'
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

