import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";

interface AuthResult {
  employee: {
    id: string;
    email: string;
    name: string;
    is_2fa_enabled: boolean;
    two_fa_secret: string | null;
    role: string;
  } | null;
  client: SupabaseClient | null;
}

// Helper to get authenticated employee using Supabase Auth
async function getAuthenticatedEmployee(request?: NextRequest): Promise<AuthResult> {
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value || cookieStore.get('sb-access-token')?.value;
  
  // If no cookie token, check Authorization header
  if (!token && request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    console.error('No auth token found in cookies or headers');
    return { employee: null, client: null };
  }


  try {
    // Create a Supabase client with the user's token
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    
    const authClient = createSupabaseClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    
    // Verify token with Supabase Auth
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    
    if (error || !user) {
      console.error('Supabase auth error:', error);
      return { employee: null, client: null };
    }

    // Use the authenticated client (with user's token) for RLS-protected queries
    // This ensures auth.uid() returns the correct user ID for RLS policies
    let { data: employeeList, error: empError } = await authClient
      .from('employees')
      .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
      .eq('auth_user_id', user.id);

    
    let employee = employeeList?.[0] || null;

    // Fallback: Try to find employee by email if auth_user_id not linked
    if (!employee && user.email) {
      const { data: employeeByEmailList, error: emailError } = await authClient
        .from('employees')
        .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
        .ilike('email', user.email);
      
      
      const employeeByEmail = employeeByEmailList?.[0] || null;
      
      if (employeeByEmail) {
        // Link the auth_user_id for future requests
        await authClient
          .from('employees')
          .update({ auth_user_id: user.id })
          .eq('id', employeeByEmail.id);
        
        employee = employeeByEmail;
      }
    }


    return { employee, client: authClient };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { employee: null, client: null };
  }
}

// GET /api/portal/security/2fa - Get 2FA status and generate secret
export async function GET(request: NextRequest) {
  try {
    // Debug: Log all cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    const { employee, client } = await getAuthenticatedEmployee(request);
    if (!employee || !client) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Generate new secret for setup
    const secret = speakeasy.generateSecret({
      name: `ZOIRO Injected Broast (${employee.email})`,
      issuer: 'ZOIRO Injected Broast Hub',
      length: 32,
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return NextResponse.json({ 
      success: true,
      is_enabled: employee.is_2fa_enabled || false,
      secret: secret.base32,
      qr_code: qrCodeDataUrl,
      manual_entry_key: secret.base32,
    });
  } catch (error: any) {
    console.error('2FA GET error:', error);
    return NextResponse.json({ error: error.message || "Failed to get 2FA status" }, { status: 500 });
  }
}

// POST /api/portal/security/2fa/enable - Enable 2FA with verification
export async function POST(request: NextRequest) {
  try {
    const { employee, client } = await getAuthenticatedEmployee(request);
    if (!employee || !client) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { secret, token } = body;

    if (!secret || !token) {
      return NextResponse.json({ error: "Secret and token are required" }, { status: 400 });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 steps before and after
    });

    if (!verified) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Enable 2FA and save secret (using authenticated client for RLS)
    const { error } = await client
      .from('employees')
      .update({ 
        is_2fa_enabled: true,
        two_fa_secret: secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) {
      console.error('2FA enable error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "2FA enabled successfully" 
    });
  } catch (error: any) {
    console.error('2FA POST error:', error);
    return NextResponse.json({ error: error.message || "Failed to enable 2FA" }, { status: 500 });
  }
}

// PUT /api/portal/security/2fa - Toggle 2FA (disable only, requires current token)
export async function PUT(request: NextRequest) {
  try {
    const { employee, client } = await getAuthenticatedEmployee(request);
    if (!employee || !client) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, token } = body;

    // If disabling, verify current token
    if (!enabled && employee.is_2fa_enabled && employee.two_fa_secret) {
      if (!token) {
        return NextResponse.json({ error: "Token required to disable 2FA" }, { status: 400 });
      }

      const verified = speakeasy.totp.verify({
        secret: employee.two_fa_secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      if (!verified) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
      }
    }

    const { error } = await client
      .from('employees')
      .update({ 
        is_2fa_enabled: enabled,
        two_fa_secret: enabled ? employee.two_fa_secret : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      enabled,
      message: enabled ? "2FA enabled" : "2FA disabled successfully" 
    });
  } catch (error: any) {
    console.error('2FA PUT error:', error);
    return NextResponse.json({ error: error.message || "Failed to update 2FA setting" }, { status: 500 });
  }
}
