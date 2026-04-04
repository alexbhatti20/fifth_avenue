import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getClientIP } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

// Rate limit: 10 requests per minute per IP
const CHECK_USER_RATE_LIMIT = 10;
const CHECK_USER_WINDOW_SECONDS = 60;

interface UserLookupResult {
  id: string;
  email: string;
  name: string;
  user_type: 'admin' | 'employee' | 'customer';
  status?: string | null;
}

interface PortalAccessResult {
  found?: boolean;
  portal_enabled?: boolean;
  block_reason?: string | null;
}

function pickFirst<T>(value: T[] | T | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function lookupUserByEmail(email: string): Promise<UserLookupResult | null> {
  const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
    p_email: email,
  });

  if (!rpcError) {
    const rpcUser = pickFirst<any>(rpcResult);
    if (rpcUser?.email && rpcUser?.user_type) {
      return {
        id: rpcUser.id,
        email: rpcUser.email,
        name: rpcUser.name,
        user_type: rpcUser.user_type,
        status: rpcUser.status,
      };
    }
  }

  // Fallback for environments where RPCs are unavailable.
  const { data: employee } = await supabase
    .from('employees')
    .select('id, email, name, role, status')
    .ilike('email', email)
    .single();

  if (employee) {
    return {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      user_type: employee.role === 'admin' ? 'admin' : 'employee',
      status: employee.status,
    };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, email, name')
    .ilike('email', email)
    .single();

  if (customer) {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      user_type: 'customer',
      status: 'active',
    };
  }

  return null;
}

// POST /api/auth/check-user - Check if user exists and their status
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    
    // Rate limiting for check-user endpoint to prevent email enumeration
    if (redis) {
      try {
        const rateLimitKey = `ratelimit:check-user:${ip}`;
        const attempts = await redis.get<number>(rateLimitKey) || 0;
        
        if (attempts >= CHECK_USER_RATE_LIMIT) {
          return NextResponse.json(
            { error: 'Too many requests. Please wait a moment before trying again.' },
            { status: 429 }
          );
        }
        
        // Increment rate limit counter
        await redis.incr(rateLimitKey);
        if (attempts === 0) {
          await redis.expire(rateLimitKey, CHECK_USER_WINDOW_SECONDS);
        }
      } catch {
        // Fail open if rate-limit backend is unavailable.
      }
    }

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await lookupUserByEmail(normalizedEmail);

    if (user) {
      
      // Employee or Admin found
      if (user.user_type === 'admin' || user.user_type === 'employee') {
        const isActive = user.status === 'active';

        if (isActive) {
          // Check if active employee/admin is blocked from portal.
          let portalEnabled = true;
          let blockReason: string | null = null;

          const { data: accessData, error: accessError } = await supabase.rpc('check_employee_portal_access', {
            p_email: normalizedEmail,
          });

          const access = pickFirst<PortalAccessResult>(accessData);

          if (!accessError && access?.found) {
            portalEnabled = access.portal_enabled !== false;
            blockReason = access.block_reason || null;
          } else {
            // Fallback if check_employee_portal_access RPC is not available.
            const { data: employeeAccess } = await supabase
              .from('employees')
              .select('portal_enabled, block_reason')
              .ilike('email', normalizedEmail)
              .single();

            if (employeeAccess) {
              portalEnabled = employeeAccess.portal_enabled !== false;
              blockReason = employeeAccess.block_reason || null;
            }
          }

          if (!portalEnabled) {
            return NextResponse.json({
              exists: true,
              userType: user.user_type,
              isEmployee: true,
              isActive: false,
              needsActivation: false,
              isBlocked: true,
              blockReason: blockReason || 'Your portal access has been disabled. Please contact the administrator.',
              name: user.name,
              email: user.email,
            });
          }
        }
        
        return NextResponse.json({
          exists: true,
          userType: user.user_type,
          isEmployee: true,
          isActive,
          needsActivation: !isActive,
          isBlocked: false,
          name: user.name,
          email: user.email,
        });
      }
      
      // Customer found
      if (user.user_type === 'customer') {
        return NextResponse.json({
          exists: true,
          userType: 'customer',
          isEmployee: false,
          isActive: true,
          needsActivation: false,
          name: user.name,
          email: user.email,
        });
      }
    }

    // User not found - new customer registration
    return NextResponse.json({
      exists: false,
      userType: null,
      isEmployee: false,
      isActive: false,
      needsActivation: false,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check user' },
      { status: 500 }
    );
  }
}

