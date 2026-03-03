import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import * as speakeasy from "speakeasy";
import { cookies } from "next/headers";
import { signCookieValue } from "@/lib/cookie-signing";

// POST /api/portal/security/2fa/verify - Verify 2FA token during login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, token } = body;

    if (!employee_id || !token) {
      return NextResponse.json({ 
        error: "Employee ID and token are required" 
      }, { status: 400 });
    }

    const supabase = createClient();
    
    // Use RPC function to bypass RLS (this is during login, user isn't authenticated yet)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_employee_for_2fa', {
      p_employee_id: employee_id
    });

    if (rpcError) {
      console.error('RPC error getting employee for 2FA:', rpcError);
      return NextResponse.json({ 
        error: "Failed to verify employee" 
      }, { status: 500 });
    }

    const employee = rpcResult && rpcResult.length > 0 ? rpcResult[0] : null;

    if (!employee) {
      return NextResponse.json({ 
        error: "Employee not found" 
      }, { status: 404 });
    }

    if (!employee.is_2fa_enabled || !employee.two_fa_secret) {
      return NextResponse.json({ 
        error: "2FA is not enabled for this account" 
      }, { status: 400 });
    }

    // Check if employee is blocked
    if (employee.status === 'blocked' || employee.portal_enabled === false) {
      return NextResponse.json({ 
        error: "Your portal access has been disabled. Please contact the administrator." 
      }, { status: 403 });
    }

    // Verify the 2FA token
    const verified = speakeasy.totp.verify({
      secret: employee.two_fa_secret,
      encoding: 'base32',
      token: token.toString().trim(), // Ensure token is string and trimmed
      window: 6, // Increased window for clock drift (3 minutes each direction)
    });

    if (!verified) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid verification code. Please try again." 
      }, { status: 400 });
    }

    // 2FA verification successful!
    // Get the session that was created during initial signInWithPassword
    const { data: sessionData } = await supabase.auth.getSession();
    
    // Update last_login timestamp using RPC (bypasses RLS)
    await supabase.rpc('update_employee_2fa_login', {
      p_employee_id: employee.id
    });

    // Prepare user data for client
    const userData = {
      id: employee.id,
      auth_user_id: employee.auth_user_id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      permissions: employee.permissions,
      is_2fa_enabled: employee.is_2fa_enabled,
    };

    // Get token from session or from existing cookies
    const cookieStore = await cookies();
    let accessToken = sessionData?.session?.access_token || 
                      cookieStore.get('sb-access-token')?.value || '';
    
    // Create response with cookies
    const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') || process.env.NODE_ENV === 'production';
    
    const response = NextResponse.json({ 
      success: true,
      verified: true,
      message: "2FA verification successful",
      user: userData,
      userType: employee.role === 'admin' ? 'admin' : 'employee',
      token: accessToken, // Include token for client-side storage
    });

    // Set auth_token cookie - NOT httpOnly so client can refresh on token rotation
    if (accessToken) {
      response.cookies.set('auth_token', accessToken, {
        httpOnly: false,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      response.cookies.set('sb-access-token', accessToken, {
        httpOnly: false,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    // If we have refresh token, set that too
    const refreshToken = sessionData?.session?.refresh_token || 
                         cookieStore.get('sb-refresh-token')?.value;
    if (refreshToken) {
      response.cookies.set('sb-refresh-token', refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    // Set employee_data cookie (HMAC-signed) for maintenance mode admin bypass check
    const employeeData = JSON.stringify({
      id: employee.id,
      role: employee.role, // 'admin' or 'employee'
      name: employee.name,
    });
    const signedValue = await signCookieValue(encodeURIComponent(employeeData));
    response.cookies.set('employee_data', signedValue, {
      httpOnly: false, // Must be readable by edge middleware
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ 
      error: error.message || "Failed to verify 2FA token" 
    }, { status: 500 });
  }
}
