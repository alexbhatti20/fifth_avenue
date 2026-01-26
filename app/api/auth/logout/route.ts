import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookie or header
    const authToken = request.cookies.get('auth-token')?.value;
    
    // Clear user cache if we can identify the user
    if (authToken) {
      try {
        // Decode JWT to get user email (simplified - in production use proper JWT verification)
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        if (payload.email) {
          // Clear user profile cache
          await redis.del(`user:profile:${payload.email}`);
          // Clear any OTP codes
          await redis.del(`otp:login:${payload.email}`);
          await redis.del(`otp:activation:${payload.email}`);
        }
        if (payload.userId) {
          // Clear employee profile cache
          await redis.del(`portal:employee:${payload.userId}`);
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

    // Clear auth cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;

  } catch (error) {
    // Still return success - we want user to be logged out client-side
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out' 
    });

    // Clear cookie even on error
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  }
}

