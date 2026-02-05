import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

export interface AuthUser {
  userId: string;
  email: string;
  role?: 'customer' | 'admin' | 'employee' | 'manager' | 'cashier' | 'kitchen' | 'reception' | 'waiter' | 'delivery';
  userType?: 'customer' | 'admin' | 'employee';
  type?: 'customer' | 'admin' | 'employee';
  authUserId?: string;
  name?: string;
  phone?: string;
  permissions?: any;
}

/**
 * Get the auth token from cookies or request headers
 */
export async function getAuthToken(request?: NextRequest): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value || 
                cookieStore.get('sb-access-token')?.value;
    
    // If no cookie token, check Authorization header
    if (!token && request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Verify token and get authenticated user using Supabase Auth
 */
export async function verifyAuth(request?: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getAuthToken(request);
    if (!token) return null;

    const supabase = createClient();
    
    // Verify with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Check if user is an employee
    const { data: employee } = await supabase
      .from('employees')
      .select('id, email, name, phone, role, permissions')
      .eq('auth_user_id', user.id)
      .single();

    if (employee) {
      return {
        userId: employee.id,
        email: employee.email,
        name: employee.name,
        phone: employee.phone,
        role: employee.role,
        userType: employee.role === 'admin' ? 'admin' : 'employee',
        type: employee.role === 'admin' ? 'admin' : 'employee',
        authUserId: user.id,
        permissions: employee.permissions,
      };
    }

    // Check if user is a customer using RPC (bypasses RLS)
    const { data: customerData } = await supabase.rpc('get_customer_by_auth_id', {
      p_auth_user_id: user.id
    });

    const customer = customerData && customerData.length > 0 ? customerData[0] : null;

    if (customer) {
      return {
        userId: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        role: 'customer',
        userType: 'customer',
        type: 'customer',
        authUserId: user.id,
      };
    }

    // User exists in Supabase Auth but not in our tables - use auth metadata
    const metadata = user.user_metadata || {};
    return {
      userId: user.id,
      email: user.email || '',
      name: metadata.name,
      role: metadata.role || 'customer',
      userType: metadata.userType || 'customer',
      type: metadata.type || 'customer',
      authUserId: user.id,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * Verify and get authenticated employee/admin
 */
export async function verifyEmployeeAuth(request?: NextRequest): Promise<AuthUser | null> {
  const user = await verifyAuth(request);
  if (!user) return null;
  
  // Check if user is employee or admin
  if (!isEmployeeOrAdmin(user)) {
    return null;
  }
  
  return user;
}

/**
 * Verify and get authenticated customer
 */
export async function verifyCustomerAuth(request?: NextRequest): Promise<AuthUser | null> {
  const user = await verifyAuth(request);
  if (!user) return null;
  
  // Customers can be identified by userType
  if (user.userType === 'customer' || user.type === 'customer') {
    return user;
  }
  
  return null;
}

/**
 * Check if user is an employee or admin
 */
export function isEmployeeOrAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  
  // Check type field
  if (user.type === 'employee' || user.type === 'admin') return true;
  
  // Check userType field
  if (user.userType === 'employee' || user.userType === 'admin') return true;
  
  // Check role field - any portal role is employee/admin
  if (user.role && ['admin', 'manager', 'cashier', 'kitchen', 'reception', 'waiter', 'delivery', 'employee'].includes(user.role)) {
    return true;
  }
  
  return false;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.type === 'admin' || user.userType === 'admin';
}

/**
 * Set auth cookies after successful authentication
 */
export async function setAuthCookies(accessToken: string, refreshToken?: string) {
  const cookieStore = await cookies();
  
  cookieStore.set('auth_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  cookieStore.set('sb-access-token', accessToken, {
    httpOnly: true,
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
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }
}

/**
 * Clear auth cookies on logout
 */
export async function clearAuthCookies() {
  const cookieStore = await cookies();
  
  cookieStore.delete('auth_token');
  cookieStore.delete('sb-access-token');
  cookieStore.delete('sb-refresh-token');
}

// ============================================================================
// LEGACY COMPATIBILITY - These functions wrap the new Supabase-based auth
// to maintain backward compatibility with existing code
// ============================================================================

/**
 * @deprecated Use verifyAuth() instead
 * Legacy function to verify token - now uses Supabase
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;

    // Get user profile
    const { data: employee } = await supabase
      .from('employees')
      .select('id, email, name, role, permissions')
      .eq('auth_user_id', user.id)
      .single();

    if (employee) {
      return {
        userId: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        userType: employee.role === 'admin' ? 'admin' : 'employee',
        type: employee.role === 'admin' ? 'admin' : 'employee',
        authUserId: user.id,
        permissions: employee.permissions,
      };
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, email, name')
      .eq('auth_user_id', user.id)
      .single();

    if (customer) {
      return {
        userId: customer.id,
        email: customer.email,
        name: customer.name,
        role: 'customer',
        userType: 'customer',
        type: 'customer',
        authUserId: user.id,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Token generation now handled by Supabase Auth
 * This function is kept for backward compatibility but throws an error
 */
export function generateToken(_payload: any): never {
  throw new Error('Token generation is now handled by Supabase Auth. Use supabase.auth.signUp() or supabase.auth.signInWithPassword() instead.');
}
