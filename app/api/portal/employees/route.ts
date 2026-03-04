import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseSingleton } from '@/lib/supabase';
import { getEmployeesPaginatedServer } from '@/lib/server-queries';
import { cookies } from 'next/headers';

// ─── Auth helper (mirrors the pattern used in other portal API routes) ─────────
async function getAuthenticatedEmployee(request: NextRequest) {
  // Prefer Authorization header (freshest token from client localStorage)
  const authHeader = request.headers.get('authorization');
  let token: string | null =
    authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // Fall back to cookies (httpOnly set at login)
  if (!token) {
    const cookieStore = await cookies();
    token =
      cookieStore.get('sb-access-token')?.value ||
      cookieStore.get('auth_token')?.value ||
      null;
  }

  if (!token) return null;

  // Quick JWT expiry check before hitting Supabase
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload.exp * 1000 < Date.now()) return null;
    }
  } catch {}

  const { data: { user }, error } = await supabaseSingleton.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// ─── GET /api/portal/employees ────────────────────────────────────────────────
// Returns paginated employee list using the server-side authenticated client.
// Accepts query params: page, limit, search, role, status
export async function GET(request: NextRequest) {
  // 1. Verify caller is authenticated
  const user = await getAuthenticatedEmployee(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify caller is an employee/admin (user_type cookie set at login)
  const cookieStore = await cookies();
  const userType = cookieStore.get('user_type')?.value;
  if (userType !== 'employee' && userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Parse query params
  const { searchParams } = new URL(request.url);
  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const limit  = parseInt(searchParams.get('limit')  || '100', 10);
  const search = searchParams.get('search')  || undefined;
  const role   = searchParams.get('role')    || undefined;
  const status = searchParams.get('status')  || undefined;

  // 4. Fetch using the server-side function (uses service-role / cookie-auth)
  const data = await getEmployeesPaginatedServer(page, limit, search, role, status);

  return NextResponse.json(data);
}
