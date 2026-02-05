import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Cache keys
const USER_CACHE_KEY = (email: string) => `user:profile:${email}`;

interface ProcessGoogleAuthRequest {
  authUserId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
}

// POST /api/auth/google/process - Process Google OAuth after client-side token extraction
export async function POST(request: NextRequest) {
  try {
    const body: ProcessGoogleAuthRequest = await request.json();
    const { authUserId, email, name, accessToken, refreshToken } = body;

    if (!authUserId || !email || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Supabase admin client with service role for RPC calls
    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey || supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const normalizedEmail = email.toLowerCase();

    // Check if user exists in our system using RPC
    const { data: userResult, error: userError } = await supabase.rpc('get_user_by_email', {
      p_email: normalizedEmail,
    });

    if (userError) {
      console.error('Error checking user:', userError);
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500 }
      );
    }

    const existingUser = userResult && userResult.length > 0 ? userResult[0] : null;

    // Check if user is blocked/banned
    if (existingUser) {
      const isBlocked = existingUser.is_banned === true || 
                        existingUser.status === 'blocked' ||
                        (existingUser.user_type !== 'customer' && existingUser.portal_enabled === false);
      
      if (isBlocked) {
        return NextResponse.json(
          { error: existingUser.block_reason || 'Your account has been suspended' },
          { status: 403 }
        );
      }
    }

    let userType = existingUser?.user_type || 'customer';
    let isNewUser = false;

    // Handle based on user existence
    if (existingUser) {
      // User exists
      if (existingUser.user_type === 'admin' || existingUser.user_type === 'employee') {
        // Employee/Admin - check if active
        if (existingUser.status !== 'active') {
          return NextResponse.json(
            { error: 'Please activate your account with your license ID first' },
            { status: 403 }
          );
        }

        // Link Google auth to employee if not already linked
        if (!existingUser.auth_user_id || existingUser.auth_user_id !== authUserId) {
          try {
            await supabase.rpc('link_google_auth_to_employee', {
              p_employee_id: existingUser.id,
              p_auth_user_id: authUserId,
            });
          } catch (linkError) {
            console.error('Error linking Google to employee:', linkError);
            // Continue anyway - might already be linked
          }
        }
      } else {
        // Customer - link Google auth if not already linked
        if (!existingUser.auth_user_id || existingUser.auth_user_id !== authUserId) {
          try {
            await supabase.rpc('link_google_auth_to_customer', {
              p_customer_id: existingUser.id,
              p_auth_user_id: authUserId,
            });
          } catch (linkError) {
            console.error('Error linking Google to customer:', linkError);
          }
        }
      }
    } else {
      // New user - create customer account
      isNewUser = true;
      userType = 'customer';

      const { data: newCustomerId, error: createError } = await supabase.rpc('create_google_oauth_customer', {
        p_auth_user_id: authUserId,
        p_email: normalizedEmail,
        p_name: name || email.split('@')[0],
        p_phone: '',
      });

      if (createError) {
        console.error('Error creating customer:', createError);
        // Check if it's because email is registered as employee
        if (createError.message?.includes('employee')) {
          return NextResponse.json(
            { error: 'This email is registered as an employee. Please use employee login.' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        );
      }
    }

    // Set cookies
    const cookieStore = await cookies();
    
    cookieStore.set('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    cookieStore.set('sb-access-token', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    if (refreshToken) {
      cookieStore.set('sb-refresh-token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    // Clear user cache to get fresh data
    try {
      await redis?.del(USER_CACHE_KEY(normalizedEmail));
    } catch (cacheError) {
      console.error('Error clearing cache:', cacheError);
    }

    return NextResponse.json({
      success: true,
      userType,
      isNewUser,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Error processing Google auth:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
