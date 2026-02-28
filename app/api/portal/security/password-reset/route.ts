import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseSingleton } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateOTP, sendPasswordResetOTP } from '@/lib/brevo';

// ─── Constants ────────────────────────────────────────────────────────────────
const OTP_EXPIRY_SECONDS     = 120;       // 2 minutes
const RESEND_COOLDOWN_SECONDS = 60;       // 60 s between re-sends
const MAX_SEND_ATTEMPTS       = 3;        // before 2-h cooldown
const COOLDOWN_SECONDS        = 7200;     // 2 hours
const SESSION_EXPIRY_SECONDS  = 300;      // 5 min to set new password
const MAX_VERIFY_ATTEMPTS     = 3;        // wrong guesses before OTP invalidation

// ─── Redis Key Factories ───────────────────────────────────────────────────────
const K_OTP      = (e: string) => `portal:pwd-reset:otp:${e}`;
const K_RESEND   = (e: string) => `portal:pwd-reset:resend:${e}`;
const K_ATTEMPTS = (e: string) => `portal:pwd-reset:attempts:${e}`;
const K_COOLDOWN = (e: string) => `portal:pwd-reset:cooldown:${e}`;
const K_VERIFIED = (e: string) => `portal:pwd-reset:verified:${e}`;

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
}

interface VerifiedSession {
  token: string;
  email: string;
  verifiedAt: number;
  expiresAt: number;
}

// ─── Auth Helper (Authorization header first — always freshest token) ─────────────
async function getAuthenticatedEmployee(request: NextRequest) {
  // Authorization header comes FIRST — client sends fresh token from localStorage.
  // Cookies are checked last since httpOnly cookies can't be updated client-side
  // after a token refresh, so they may hold a stale/expired value.
  const authHeader = request.headers.get('authorization');
  let token: string | null =
    authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    const cookieStore = await cookies();
    token =
      cookieStore.get('sb-access-token')?.value ||
      cookieStore.get('auth_token')?.value ||
      null;
  }

  if (!token) {
    return null;
  }

  // Validate JWT expiry before hitting Supabase
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const exp = payload.exp * 1000;
      const now = Date.now();
      if (exp < now) {
        return null;
      }
    }
  } catch (e) {
    // ignore JWT parse errors
  }

  // Use the SINGLETON supabase client with explicit token — avoids new GoTrueClient instances
  const { data: { user }, error } = await supabaseSingleton.auth.getUser(token);
  if (error || !user) {
    return null;
  }

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

  const { data: byId, error: byIdErr } = await fetchClient
    .from('employees')
    .select('id, email, name, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (byIdErr) console.error('[pwd-reset] Employee lookup error:', byIdErr?.message);
  if (byId) employee = byId;

  if (!employee && user.email) {
    const { data: byEmail, error: byEmailErr } = await fetchClient
      .from('employees')
      .select('id, email, name, role')
      .ilike('email', user.email)
      .maybeSingle();
    if (byEmail) {
      employee = byEmail;
      // Back-fill auth_user_id using the authenticated client
      await fetchClient.from('employees').update({ auth_user_id: user.id }).eq('id', byEmail.id);
    }
  }

  return employee;
}

// ─── Route Entry ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    switch (body.action) {
      case 'send-otp':
        return handleSendOTP(request);
      case 'verify-otp':
        return handleVerifyOTP(request, body);
      case 'reset-password':
        return handleResetPassword(request, body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Step 1: Send OTP ─────────────────────────────────────────────────────────
async function handleSendOTP(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = employee.email.toLowerCase().trim();

  // Check 2-hour hard cooldown (triggered after MAX_SEND_ATTEMPTS)
  const cooldownUntil = await redis?.get<number>(K_COOLDOWN(email));
  if (cooldownUntil && Date.now() < cooldownUntil) {
    const remainingMinutes = Math.ceil((cooldownUntil - Date.now()) / 60000);
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        cooldownUntil,
      },
      { status: 429 },
    );
  }

  // Check 60-second resend cooldown
  const lastSend = await redis?.get<number>(K_RESEND(email));
  if (lastSend) {
    const elapsed = Date.now() - lastSend;
    if (elapsed < RESEND_COOLDOWN_SECONDS * 1000) {
      const remaining = Math.ceil(
        (RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000,
      );
      return NextResponse.json(
        {
          error: `Wait ${remaining}s before requesting a new code.`,
          remainingSeconds: remaining,
        },
        { status: 429 },
      );
    }
  }

  // Enforce MAX_SEND_ATTEMPTS before cooldown
  const attempts =
    (await redis?.get<number>(K_ATTEMPTS(email))) || 0;
  if (attempts >= MAX_SEND_ATTEMPTS) {
    const cooldownExpiry = Date.now() + COOLDOWN_SECONDS * 1000;
    await redis?.set(K_COOLDOWN(email), cooldownExpiry, {
      ex: COOLDOWN_SECONDS,
    });
    await redis?.del(K_ATTEMPTS(email));
    return NextResponse.json(
      {
        error: 'Too many attempts. Please try again in 2 hours.',
        cooldownUntil: cooldownExpiry,
      },
      { status: 429 },
    );
  }

  // Increment send attempts
  await redis?.incr(K_ATTEMPTS(email));
  await redis?.expire(K_ATTEMPTS(email), COOLDOWN_SECONDS);

  // Generate and persist OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_SECONDS * 1000;
  const otpData: OTPData = { code: otp, expiresAt, attempts: 0, email };

  await redis?.set(K_OTP(email), JSON.stringify(otpData), {
    ex: OTP_EXPIRY_SECONDS,
  });
  await redis?.set(K_RESEND(email), Date.now(), {
    ex: RESEND_COOLDOWN_SECONDS,
  });

  // Fire email
  await sendPasswordResetOTP(email, employee.name, otp);

  // Mask email for display e.g. zo**@example.com
  const maskedEmail = email.replace(
    /^(..)(.*?)(@.*)$/,
    (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 2)) + c,
  );

  return NextResponse.json({
    success: true,
    message: 'Verification code sent to your registered email.',
    maskedEmail,
    expiresIn: OTP_EXPIRY_SECONDS,
    resendIn: RESEND_COOLDOWN_SECONDS,
  });
}

// ─── Step 2: Verify OTP ───────────────────────────────────────────────────────
async function handleVerifyOTP(request: NextRequest, body: { otp?: string }) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { otp } = body;
  if (!otp)
    return NextResponse.json({ error: 'OTP is required' }, { status: 400 });

  const email = employee.email.toLowerCase().trim();

  const raw = await redis?.get<string | OTPData>(K_OTP(email));
  if (!raw)
    return NextResponse.json(
      { error: 'No code found. Request a new one.' },
      { status: 400 },
    );

  const otpData: OTPData =
    typeof raw === 'string' ? JSON.parse(raw) : raw;

  // Expiry check
  if (Date.now() > otpData.expiresAt) {
    await redis?.del(K_OTP(email));
    return NextResponse.json(
      { error: 'Code expired. Request a new one.' },
      { status: 400 },
    );
  }

  // Too many wrong guesses
  if (otpData.attempts >= MAX_VERIFY_ATTEMPTS) {
    await redis?.del(K_OTP(email));
    return NextResponse.json(
      { error: 'Too many failed attempts. Request a new code.' },
      { status: 429 },
    );
  }

  // Wrong code
  if (otpData.code !== otp.toString().trim()) {
    otpData.attempts += 1;
    const ttl = Math.ceil((otpData.expiresAt - Date.now()) / 1000);
    await redis?.set(K_OTP(email), JSON.stringify(otpData), {
      ex: Math.max(ttl, 1),
    });
    return NextResponse.json(
      {
        error: 'Invalid code.',
        attemptsRemaining: MAX_VERIFY_ATTEMPTS - otpData.attempts,
      },
      { status: 400 },
    );
  }

  // ✅ OTP correct — issue a short-lived verified session token
  await redis?.del(K_OTP(email));

  const verifiedToken = crypto.randomUUID();
  const sessionPayload: VerifiedSession = {
    token: verifiedToken,
    email,
    verifiedAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_SECONDS * 1000,
  };

  await redis?.set(K_VERIFIED(email), JSON.stringify(sessionPayload), {
    ex: SESSION_EXPIRY_SECONDS,
  });

  return NextResponse.json({
    success: true,
    message: 'Code verified. You can now set a new password.',
    token: verifiedToken,
    expiresIn: SESSION_EXPIRY_SECONDS,
  });
}

// ─── Step 3: Reset Password ───────────────────────────────────────────────────
async function handleResetPassword(
  request: NextRequest,
  body: { token?: string; newPassword?: string; confirmPassword?: string },
) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, newPassword, confirmPassword } = body;

  if (!token || !newPassword || !confirmPassword)
    return NextResponse.json(
      { error: 'token, newPassword and confirmPassword are required.' },
      { status: 400 },
    );

  if (newPassword !== confirmPassword)
    return NextResponse.json(
      { error: 'Passwords do not match.' },
      { status: 400 },
    );

  if (newPassword.length < 8)
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );

  if (
    !/[A-Z]/.test(newPassword) ||
    !/[a-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  )
    return NextResponse.json(
      {
        error:
          'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
      },
      { status: 400 },
    );

  const email = employee.email.toLowerCase().trim();

  // Validate verified session
  const rawSession = await redis?.get<string | VerifiedSession>(
    K_VERIFIED(email),
  );
  if (!rawSession)
    return NextResponse.json(
      { error: 'Session expired. Please verify your OTP again.' },
      { status: 400 },
    );

  const session: VerifiedSession =
    typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;

  if (session.token !== token)
    return NextResponse.json(
      { error: 'Invalid session token.' },
      { status: 400 },
    );

  if (Date.now() > session.expiresAt) {
    await redis?.del(K_VERIFIED(email));
    return NextResponse.json(
      { error: 'Session expired. Please verify your OTP again.' },
      { status: 400 },
    );
  }

  // ─── Update password in Supabase Auth ────────────────────────────────────
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  let updateSuccess = false;

  if (serviceKey) {
    // Preferred: admin client — no RLS, direct auth.users update
    const adminClient = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find the Supabase Auth user by email using admin API
    const listResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const listErr = listResult.error;
    const users = (listResult.data as any)?.users as { id: string; email?: string }[] | undefined;

    if (!listErr && users) {
      const authUser = users.find(
        (u) => u.email?.toLowerCase() === email,
      );

      if (authUser) {
        const { error: updateErr } =
          await adminClient.auth.admin.updateUserById(authUser.id, {
            password: newPassword,
          });
        updateSuccess = !updateErr;
      }
    }
  }

  if (!updateSuccess) {
    // Fallback: SECURITY DEFINER RPC (same approach as public forgot-password flow)
    const fallbackClient = createSupabaseClient(supabaseUrl, anonKey);
    const { data: rpcResult, error: rpcErr } =
      await fallbackClient.rpc('update_user_password', {
        p_email: email,
        p_new_password: newPassword,
      });

    if (rpcErr || !rpcResult?.success) {
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 },
      );
    }
    updateSuccess = true;
  }

  if (!updateSuccess) {
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.' },
      { status: 500 },
    );
  }

  // Clean up Redis keys
  await Promise.all([
    redis?.del(K_VERIFIED(email)),
    redis?.del(K_ATTEMPTS(email)),
  ]);

  return NextResponse.json({
    success: true,
    message: 'Password updated successfully.',
  });
}
