import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { supabase as supabaseSingleton } from "@/lib/supabase";
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

// Token priority: Authorization header (fresh) > cookies (may be stale)
async function getToken(request?: NextRequest): Promise<string | null> {
  // 1. Authorization header — always the freshest token (sent by client from localStorage)
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  }
  // 2. Cookies — httpOnly, may be stale after token refresh
  const cookieStore = await cookies();
  return (
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('auth_token')?.value ||
    null
  );
}

async function getAuthenticatedEmployee(request?: NextRequest): Promise<AuthResult> {
  const token = await getToken(request);
  if (!token) return { employee: null, client: null };

  // Validate JWT expiry locally before network call
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload.exp * 1000 < Date.now()) return { employee: null, client: null };
    }
  } catch { /* ignore */ }

  // Use the SINGLETON supabase client with explicit token — avoids new GoTrueClient instances
  const { data: { user }, error: authError } = await supabaseSingleton.auth.getUser(token);
  if (authError || !user) return { employee: null, client: null };

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // CRITICAL: Use service key if available, otherwise use an AUTHENTICATED client
  // with the user's token. The singleton has no session on the server, so RLS blocks queries.
  const fetchClient = serviceKey
    ? createSupabaseClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : createSupabaseClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

  let employee = null;

  const { data: byId } = await fetchClient
    .from('employees')
    .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (byId) employee = byId;

  if (!employee && user.email) {
    const { data: byEmail } = await fetchClient
      .from('employees')
      .select('id, email, name, is_2fa_enabled, two_fa_secret, role')
      .ilike('email', user.email)
      .maybeSingle();
    if (byEmail) {
      employee = byEmail;
      // Back-fill auth_user_id using the same authenticated client
      await fetchClient.from('employees').update({ auth_user_id: user.id }).eq('id', byEmail.id);
    }
  }

  if (!employee) return { employee: null, client: null };

  // Client for mutations (update 2FA) — reuse the authenticated fetchClient
  return { employee, client: fetchClient };
}

const getAuthticatedEmployee = getAuthenticatedEmployee;

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
