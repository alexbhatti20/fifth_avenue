// ============================================================================
// DEPRECATED: This file is kept for backward compatibility
// All new code should import from '@/lib/auth' instead
// ============================================================================

import { createClient } from '@/lib/supabase';

// Re-export types for backward compatibility
export interface JWTPayload {
  userId: string;
  email: string;
  role?: 'customer' | 'admin' | 'employee' | 'manager' | 'cashier' | 'kitchen' | 'reception' | 'waiter' | 'delivery';
  userType?: 'customer' | 'admin' | 'employee';
  type?: 'customer' | 'admin' | 'employee' | 'reset';
  authUserId?: string;
  name?: string;
  phone?: string;
  permissions?: any;
  iat?: number;
  exp?: number;
  sub?: string;
  aud?: string;
  user_metadata?: any;
  app_metadata?: any;
}

/**
 * @deprecated Token generation now handled by Supabase Auth
 * Use supabase.auth.signUp() or supabase.auth.signInWithPassword() instead
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  console.warn('generateToken is deprecated. Use Supabase Auth instead.');
  // For backward compatibility during migration, we'll use a temporary approach
  // This should be replaced with proper Supabase Auth flow
  throw new Error('Token generation is now handled by Supabase Auth');
}

/**
 * Verify and decode a token using Supabase Auth
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;

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

    // User exists in Supabase Auth but not in our tables
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
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Verify employee/admin token
 */
export function verifyEmployeeToken(token: string): Promise<JWTPayload | null> {
  return verifyToken(token);
}

/**
 * Check if user is an employee or admin
 */
export function isEmployeeOrAdmin(decoded: JWTPayload | null): boolean {
  if (!decoded) return false;
  
  if (decoded.type === 'employee' || decoded.type === 'admin') return true;
  if (decoded.userType === 'employee' || decoded.userType === 'admin') return true;
  
  if (decoded.role && ['admin', 'manager', 'cashier', 'kitchen', 'reception', 'waiter', 'delivery', 'employee'].includes(decoded.role)) {
    return true;
  }
  
  return false;
}

/**
 * @deprecated Use Supabase Auth instead
 */
export function generateAdminToken(userId: string, email: string): string {
  throw new Error('Token generation is now handled by Supabase Auth');
}

/**
 * @deprecated Use Supabase password reset instead
 */
export function generateResetToken(userId: string, email: string): string {
  throw new Error('Password reset is now handled by Supabase Auth');
}

/**
 * Check if token has admin role
 */
export async function isAdminToken(token: string): Promise<boolean> {
  const payload = await verifyToken(token);
  return payload?.role === 'admin';
}

/**
 * Extract user ID from token
 */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  const payload = await verifyToken(token);
  return payload?.userId || null;
}
