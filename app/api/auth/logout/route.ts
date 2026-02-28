import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

// Clear every auth cookie — httpOnly flags MUST match how each was originally set
// otherwise the browser ignores the deletion.
function clearAllCookies(response: NextResponse) {
  const isSecure = process.env.NODE_ENV === 'production';
  const base = { secure: isSecure, sameSite: 'lax' as const, maxAge: 0, path: '/' };

  // These were set with httpOnly: false — must clear with httpOnly: false
  response.cookies.set('auth_token',      '', { ...base, httpOnly: false });
  response.cookies.set('sb-access-token', '', { ...base, httpOnly: false });

  // These were set with httpOnly: true
  response.cookies.set('auth-token',      '', { ...base, httpOnly: true });
  response.cookies.set('sb-refresh-token','', { ...base, httpOnly: true });

  // employee_data and user_type were set with httpOnly: false
  response.cookies.set('employee_data',   '', { ...base, httpOnly: false });
  response.cookies.set('user_type',       '', { ...base, httpOnly: false });
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookie or header (check both names for backward compatibility)
    const authToken = request.cookies.get('auth_token')?.value || 
                      request.cookies.get('auth-token')?.value;
    
    // Clear user cache if we can identify the user
    if (authToken) {
      try {
        // Decode JWT to get user email (simplified - in production use proper JWT verification)
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        if (payload.email) {
          // Clear user profile cache
          await redis?.del(`user:profile:${payload.email}`);
          // Clear any OTP codes
          await redis?.del(`otp:login:${payload.email}`);
          await redis?.del(`otp:activation:${payload.email}`);
        }
        if (payload.userId) {
          // Clear employee profile cache
          await redis?.del(`portal:employee:${payload.userId}`);
        }
      } catch (e) {
        // Token decode failed, continue with logout
      }
    }

    // Sign out from Supabase
    await supabase.auth.signOut();

    // Create response
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });

    clearAllCookies(response);
    return response;

  } catch (error) {
    const response = NextResponse.json({ success: true, message: 'Logged out' });
    clearAllCookies(response);
    return response;
  }
}

