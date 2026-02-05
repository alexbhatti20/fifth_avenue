import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cache keys
const USER_CACHE_KEY = (email: string) => `user:profile:${email}`;

interface GoogleUserCheckResult {
  exists: boolean;
  userType: 'admin' | 'employee' | 'customer' | null;
  isEmployee: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role?: string;
    permissions?: any;
  };
}

/**
 * Check if user exists in our system and their status
 */
async function checkUserStatus(email: string, supabase: any): Promise<GoogleUserCheckResult> {
  // Use RPC function to get user info
  const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
    p_email: email.toLowerCase()
  });

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    return {
      exists: false,
      userType: null,
      isEmployee: false,
      isActive: false,
      isBlocked: false,
    };
  }

  const user = rpcResult[0];

  // Check if employee/admin
  if (user.user_type === 'admin' || user.user_type === 'employee') {
    // Check portal access (blocked status)
    const { data: accessData } = await supabase.rpc('check_employee_portal_access', {
      p_email: email.toLowerCase()
    });

    const isBlocked = accessData?.found && accessData?.portal_enabled === false;
    const isActive = user.status === 'active';

    return {
      exists: true,
      userType: user.user_type,
      isEmployee: true,
      isActive,
      isBlocked,
      blockReason: isBlocked ? (accessData?.block_reason || 'Portal access disabled') : undefined,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  // Customer found
  if (user.user_type === 'customer') {
    // Check if customer is blocked
    const isBlocked = user.status === 'blocked' || user.is_blocked === true;
    
    return {
      exists: true,
      userType: 'customer',
      isEmployee: false,
      isActive: user.status === 'active',
      isBlocked,
      blockReason: isBlocked ? 'Your account has been suspended' : undefined,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
    };
  }

  return {
    exists: false,
    userType: null,
    isEmployee: false,
    isActive: false,
    isBlocked: false,
  };
}

/**
 * Create a new customer from Google OAuth data
 */
async function createGoogleCustomer(
  authUserId: string,
  email: string,
  name: string,
  supabase: any
): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    // Use RPC to create customer (bypasses RLS)
    const { data, error } = await supabase.rpc('create_google_oauth_customer', {
      p_auth_user_id: authUserId,
      p_email: email.toLowerCase(),
      p_name: name || email.split('@')[0],
      p_phone: '',
    });

    if (error) {
      console.error('Failed to create Google customer:', error);
      return { success: false, error: 'Failed to create account' };
    }

    return { success: true, customerId: data };
  } catch (error) {
    console.error('Error creating Google customer:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

/**
 * Link Google auth to existing customer account
 */
async function linkGoogleToCustomer(
  customerId: string,
  authUserId: string,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('link_google_auth_to_customer', {
      p_customer_id: customerId,
      p_auth_user_id: authUserId,
    });

    if (error) {
      console.error('Failed to link Google auth:', error);
      return { success: false, error: 'Failed to link account' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error linking Google auth:', error);
    return { success: false, error: 'Failed to link account' };
  }
}

// GET /api/auth/google/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const intent = searchParams.get('intent') || 'login';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  // Get base URL from the request
  const host = request.headers.get('host') || 'zoirobroast.me';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  console.log('Google OAuth callback - baseUrl:', baseUrl);

  // Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/auth?error=${encodeURIComponent(errorDescription || 'Google sign-in failed')}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/auth?error=${encodeURIComponent('No authorization code received')}`
    );
  }

  try {
    // Create a fresh Supabase client for this callback
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Exchange the code for a session
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !sessionData.session) {
      console.error('Failed to exchange code for session:', sessionError);
      return NextResponse.redirect(
        `${baseUrl}/auth?error=${encodeURIComponent('Failed to complete Google sign-in')}`
      );
    }

    const { user: authUser, session } = sessionData;
    const email = authUser.email?.toLowerCase();
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';

    if (!email) {
      return NextResponse.redirect(
        `${baseUrl}/auth?error=${encodeURIComponent('No email received from Google')}`
      );
    }

    // Check if user exists in our system
    const userStatus = await checkUserStatus(email, supabase);

    // SECURITY: Check if user is blocked
    if (userStatus.isBlocked) {
      // Sign out the user from Supabase
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${baseUrl}/auth?error=${encodeURIComponent(userStatus.blockReason || 'Your account has been suspended')}`
      );
    }

    // Handle based on user type and intent
    if (userStatus.exists) {
      // User exists - handle login
      if (userStatus.isEmployee) {
        // Employee trying to login with Google
        if (!userStatus.isActive) {
          // Employee needs to activate their account first
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${baseUrl}/auth?error=${encodeURIComponent('Please activate your account with your license ID first')}`
          );
        }

        // Check if employee has auth_user_id linked
        // If not, link it now
        if (userStatus.user?.id) {
          try {
            await supabase.rpc('link_google_auth_to_employee', {
              p_employee_id: userStatus.user.id,
              p_auth_user_id: authUser.id,
            });
          } catch {
            // Ignore if already linked or RPC doesn't exist
          }
        }

        // Set cookies and redirect to portal
        const cookieStore = await cookies();
        cookieStore.set('auth_token', session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/',
        });
        cookieStore.set('sb-access-token', session.access_token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        // Clear user cache to get fresh data
        await redis?.del(USER_CACHE_KEY(email));

        return NextResponse.redirect(
          `${baseUrl}/portal?google_login=success&user_type=${userStatus.userType}`
        );
      } else {
        // Existing customer login
        // Link Google auth if not already linked
        if (userStatus.user?.id) {
          await linkGoogleToCustomer(userStatus.user.id, authUser.id, supabase);
        }

        // Set cookies
        const cookieStore = await cookies();
        cookieStore.set('auth_token', session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        cookieStore.set('sb-access-token', session.access_token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        // Clear user cache
        await redis?.del(USER_CACHE_KEY(email));

        return NextResponse.redirect(`${baseUrl}/?google_login=success`);
      }
    } else {
      // User doesn't exist
      if (intent === 'register' || intent === 'login') {
        // Allow customer registration via Google
        const createResult = await createGoogleCustomer(authUser.id, email, name, supabase);

        if (!createResult.success) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${baseUrl}/auth?error=${encodeURIComponent(createResult.error || 'Failed to create account')}`
          );
        }

        // Set cookies
        const cookieStore = await cookies();
        cookieStore.set('auth_token', session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        cookieStore.set('sb-access-token', session.access_token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        return NextResponse.redirect(`${baseUrl}/?google_register=success&new_user=true`);
      } else {
        // Employee trying to register with Google - not allowed
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${baseUrl}/auth?error=${encodeURIComponent('Employees cannot register with Google. Please contact admin.')}`
        );
      }
    }
  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(
      `${baseUrl}/auth?error=${encodeURIComponent('An unexpected error occurred')}`
    );
  }
}
