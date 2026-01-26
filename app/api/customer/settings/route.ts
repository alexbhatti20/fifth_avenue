import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/jwt';
import { redis, redisKeys, deleteCache } from '@/lib/redis';
import { sendBrevoEmail } from '@/lib/brevo';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// GET /api/customer/settings - Get customer settings
export async function GET(request: NextRequest) {
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

    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        email_notifications,
        sms_notifications,
        two_factor_enabled,
        email,
        phone
      `)
      .eq('id', decoded.userId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        notifications: {
          email: customer.email_notifications ?? true,
          sms: customer.sms_notifications ?? true
        },
        security: {
          twoFactorEnabled: customer.two_factor_enabled ?? false,
          email: customer.email,
          phone: customer.phone
        }
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/customer/settings - Update customer settings
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { setting, value } = body;

    if (!setting) {
      return NextResponse.json({ error: 'Setting name is required' }, { status: 400 });
    }

    // Map setting names to database columns
    const settingMap: Record<string, string> = {
      'email_notifications': 'email_notifications',
      'sms_notifications': 'sms_notifications',
      'two_factor_enabled': 'two_factor_enabled'
    };

    if (!settingMap[setting]) {
      return NextResponse.json({ error: 'Invalid setting name' }, { status: 400 });
    }

    // Update the setting
    const { error } = await supabase
      .from('customers')
      .update({
        [settingMap[setting]]: value,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    // Invalidate cache
    await deleteCache(redisKeys.customerProfile(decoded.userId));

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/customer/settings - Enable/disable 2FA
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

    const body = await request.json();
    const { action, otp } = body;

    if (!action || !['enable_2fa', 'disable_2fa', 'verify_2fa'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('email, two_factor_enabled')
      .eq('id', decoded.userId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (action === 'enable_2fa') {
      if (customer.two_factor_enabled) {
        return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
      }

      // Generate OTP
      const otpCode = generateOTP();
      const otpKey = `2fa_setup:${decoded.userId}`;

      await redis.setex(otpKey, 300, JSON.stringify({
        otp: otpCode,
        action: 'enable',
        createdAt: Date.now()
      }));

      // Send OTP email
      await sendBrevoEmail({
        to: customer.email,
        subject: 'Enable Two-Factor Authentication - Zoiro Broast',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f97316;">Enable Two-Factor Authentication</h2>
            <p>Use this code to enable 2FA on your account:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316;">${otpCode}</span>
            </div>
            <p><strong>This code expires in 5 minutes.</strong></p>
          </div>
        `
      });

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    }

    if (action === 'disable_2fa') {
      if (!customer.two_factor_enabled) {
        return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
      }

      // Generate OTP
      const otpCode = generateOTP();
      const otpKey = `2fa_setup:${decoded.userId}`;

      await redis.setex(otpKey, 300, JSON.stringify({
        otp: otpCode,
        action: 'disable',
        createdAt: Date.now()
      }));

      // Send OTP email
      await sendBrevoEmail({
        to: customer.email,
        subject: 'Disable Two-Factor Authentication - Zoiro Broast',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f97316;">Disable Two-Factor Authentication</h2>
            <p>Use this code to disable 2FA on your account:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316;">${otpCode}</span>
            </div>
            <p><strong>This code expires in 5 minutes.</strong></p>
            <p style="color: #dc2626;">Warning: Disabling 2FA will make your account less secure.</p>
          </div>
        `
      });

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    }

    if (action === 'verify_2fa') {
      if (!otp) {
        return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
      }

      const otpKey = `2fa_setup:${decoded.userId}`;
      const storedData = await redis.get(otpKey);

      if (!storedData) {
        return NextResponse.json({ error: 'No pending 2FA request or it has expired' }, { status: 400 });
      }

      const parsedData = JSON.parse(storedData as string);

      if (parsedData.otp !== otp) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
      }

      // Update 2FA setting
      const newValue = parsedData.action === 'enable';
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          two_factor_enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', decoded.userId);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update 2FA setting' }, { status: 500 });
      }

      // Clear OTP data
      await redis.del(otpKey);

      // Invalidate cache
      await deleteCache(redisKeys.customerProfile(decoded.userId));

      // Create notification
      await supabase.from('notifications').insert({
        user_type: 'customer',
        user_id: decoded.userId,
        title: newValue ? '2FA Enabled' : '2FA Disabled',
        message: newValue
          ? 'Two-factor authentication has been enabled on your account.'
          : 'Two-factor authentication has been disabled on your account.',
        type: 'security'
      });

      return NextResponse.json({
        success: true,
        message: newValue ? '2FA enabled successfully' : '2FA disabled successfully',
        two_factor_enabled: newValue
      });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

