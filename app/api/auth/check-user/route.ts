import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getClientIP } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

// Rate limit: 10 requests per minute per IP
const CHECK_USER_RATE_LIMIT = 10;
const CHECK_USER_WINDOW_SECONDS = 60;

// POST /api/auth/check-user - Check if user exists and their status
// Uses only RPC functions - no direct table queries
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    
    // Rate limiting for check-user endpoint to prevent email enumeration
    if (redis) {
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
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Use RPC function to get user info
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_by_email', {
      p_email: normalizedEmail
    });

    if (rpcError) {
      return NextResponse.json(
        { error: 'Failed to check user' },
        { status: 500 }
      );
    }

    if (rpcResult && rpcResult.length > 0) {
      const user = rpcResult[0];
      
      // Employee or Admin found
      if (user.user_type === 'admin' || user.user_type === 'employee') {
        // Use RPC to check portal access (blocked status)
        const { data: accessData } = await supabase.rpc('check_employee_portal_access', {
          p_email: normalizedEmail
        });
        
        // Check if portal is disabled (blocked)
        if (accessData && accessData.found && accessData.portal_enabled === false) {
          return NextResponse.json({
            exists: true,
            userType: user.user_type,
            isEmployee: true,
            isActive: false,
            needsActivation: false,
            isBlocked: true,
            blockReason: accessData.block_reason || 'Your portal access has been disabled. Please contact the administrator.',
            name: user.name,
            email: user.email,
          });
        }
        
        const isActive = user.status === 'active';
        
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
          isActive: user.status === 'active',
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

