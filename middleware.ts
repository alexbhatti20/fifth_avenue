import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase (edge-compatible, anonymous) ────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Allowed CORS origins (computed once at module load) ──────────────────────
const ALLOWED_ORIGINS: string[] = [
  'https://zoirobroast.me',
  'https://www.zoirobroast.me',
  ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
  ...(process.env.NODE_ENV === 'development'
    ? [
        'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
        'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002',
      ]
    : []),
];

// ─── SEO bot pattern (compiled once) ─────────────────────────────────────────
const SEO_BOT_RE =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot/i;

// ─── Attack probe pattern (compiled once) ────────────────────────────────────
const ATTACK_RE =
  /\.(php|asp|aspx|jsp|env|git|sql|bak|config|ini)$|wp-admin|wp-login|wp-content|wp-includes|xmlrpc|cgi-bin|phpmyadmin|adminer/i;

// ─── Localhost origin check (compiled once) ───────────────────────────────────
const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// ─── CSP (built once, not per request) ───────────────────────────────────────
const CSP = [
  "default-src 'self' https://zoirobroast.me",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://vercel.live https://zoirobroast.me",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://zoirobroast.me",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* https://zoirobroast.me https://*.zoirobroast.me https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://www.google-analytics.com https://vercel.live wss://ws-us3.pusher.com https://api.brevo.com",
  "frame-src 'self' https://vercel.live https://www.google.com https://zoirobroast.me",
  "frame-ancestors 'self' https://zoirobroast.me",
  "base-uri 'self'",
  "form-action 'self' https://zoirobroast.me",
].join('; ');

// ─── Maintenance bypass prefixes ──────────────────────────────────────────────
const MAINTENANCE_BYPASS = [
  '/maintenance', '/portal/login', '/api/', '/_next/',
  '/assets/', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/manifest.json',
];

// ─── Admin-only portal paths ──────────────────────────────────────────────────
// These require role === 'admin'; non-admins are bounced to /portal
// NOTE: /portal/backup is intentionally excluded — it allows admin AND manager
//       (the page's own SSR auth guard enforces that check)
const ADMIN_ONLY_PATHS = ['/portal/employees', '/portal/audit'];

// ─── JWT helpers (edge runtime: no Buffer, use atob) ─────────────────────────

/** Decode URL-safe base64url JWT segment → parsed object, or null on failure. */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → standard base64 + padding
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

interface TokenInfo {
  /** Token present and not expired */
  valid: boolean;
  /** Token present but the exp claim has passed */
  expired: boolean;
  /** Role string from JWT payload, or null */
  role: string | null;
}

/**
 * Inspect the access token from cookies.
 * Pure JS — zero network calls — safe for edge runtime.
 * Allows 60-second clock skew.
 */
function inspectToken(request: NextRequest): TokenInfo {
  const raw =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('auth_token')?.value;

  if (!raw) return { valid: false, expired: false, role: null };

  const payload = decodeJWTPayload(raw);
  if (!payload) return { valid: false, expired: false, role: null };

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  const expired = exp !== null && exp * 1000 < Date.now() - 60_000;
  if (expired) return { valid: false, expired: true, role: null };

  // Supabase stores custom role in app_metadata or user_metadata
  const role =
    (payload.role as string | undefined) ||
    ((payload.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined) ||
    ((payload.user_metadata as Record<string, unknown> | undefined)?.role as string | undefined) ||
    null;

  return { valid: true, expired: false, role };
}

/** Also check the employee_data cookie (non-JWT, set by the portal at login). */
function isAdminFromEmployeeData(request: NextRequest): boolean {
  try {
    const raw = request.cookies.get('employee_data')?.value;
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      return parsed?.role === 'admin';
    }
  } catch {}
  return false;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // ── 1. Block attack probes before anything else (fastest possible exit) ────
  if (ATTACK_RE.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // ── 2. Portal auth — JWT expiry + role check (zero network) ───────────────
  const isPortalPage = pathname.startsWith('/portal') && !pathname.startsWith('/portal/login');
  if (isPortalPage) {
    const token = inspectToken(request);

    if (!token.valid) {
      // Token missing or expired → redirect to login
      const loginUrl = new URL('/portal/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      if (token.expired) loginUrl.searchParams.set('reason', 'expired'); // UI can show "session expired"
      return NextResponse.redirect(loginUrl);
    }

    // Enforce admin-only portal routes at the edge
    // token.role is the Supabase auth role ('authenticated'), NOT the custom employee role.
    // Fall back to the employee_data cookie which stores the actual role (admin/manager/etc.).
    const isAdminOnly = ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
    if (isAdminOnly) {
      const jwtIsAdmin = token.role === 'admin';
      const cookieIsAdmin = !jwtIsAdmin && isAdminFromEmployeeData(request);
      if (!jwtIsAdmin && !cookieIsAdmin) {
        return NextResponse.redirect(new URL('/portal', request.url));
      }
    }
  }

  // ── 3. Maintenance mode (Supabase call skipped when JWT confirms admin) ────
  const shouldCheckMaintenance =
    !MAINTENANCE_BYPASS.some(p => pathname.startsWith(p) || pathname === p);

  if (shouldCheckMaintenance && supabaseUrl && supabaseKey) {
    // Fast path: JWT already confirms admin → skip the DB round-trip entirely
    const token = inspectToken(request);
    const jwtIsAdmin = token.valid && token.role === 'admin';
    const cookieIsAdmin = !jwtIsAdmin && isAdminFromEmployeeData(request);

    if (!jwtIsAdmin && !cookieIsAdmin) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        const { data: maintenanceData } = await supabase.rpc('get_maintenance_status');

        if (maintenanceData?.is_enabled) {
          return NextResponse.redirect(new URL('/maintenance', request.url));
        }
      } catch {
        // Fail-open: if DB is unreachable, let the request through
      }
    }
  }

  // ── 4. Build response with security headers ────────────────────────────────
  const response = NextResponse.next();
  const h = response.headers;

  h.set('X-DNS-Prefetch-Control', 'on');
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('X-XSS-Protection', '1; mode=block');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)');
  h.set('Content-Security-Policy', CSP);
  // Unique request ID for distributed tracing / log correlation
  h.set('X-Request-Id', crypto.randomUUID());

  // ── 5. CORS for API routes ────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Prevent search engines from indexing API endpoints
    h.set('X-Robots-Tag', 'noindex, nofollow');

    const origin = request.headers.get('origin');
    const isLocalhost = !!origin && LOCALHOST_ORIGIN_RE.test(origin);
    const isAllowed  = !!origin && ALLOWED_ORIGINS.includes(origin);

    if (origin) {
      if (isAllowed || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
        h.set('Access-Control-Allow-Origin', origin);
      } else if (process.env.NODE_ENV !== 'production') {
        h.set('Access-Control-Allow-Origin', origin); // dev: allow any origin
      }
      // Production + unlisted origin → no ACAO header → browser enforces same-origin
    } else {
      h.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]); // same-origin / SSR
    }

    h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token');
    h.set('Access-Control-Allow-Credentials', 'true');
    h.set('Access-Control-Max-Age', '86400');
    h.set('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining');

    // Preflight — respond immediately, no further processing needed
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: h });
    }

    // Block unknown cross-origin requests in production (bots exempt for SEO)
    if (
      process.env.NODE_ENV === 'production' &&
      origin &&
      !isAllowed &&
      !SEO_BOT_RE.test(userAgent)
    ) {
      return new NextResponse(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
};
