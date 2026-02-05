import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client for edge (middleware)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Allowed origins for CORS - include all possible localhost ports
const ALLOWED_ORIGINS = [
  'https://zoirobroast.me',
  'https://www.zoirobroast.me',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

// Development origins - support all common dev ports
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002'
  );
}

// List of paths that don't require any protection
const publicPaths = [
  '/',
  '/menu',
  '/contact',
  '/features',
  '/cart',
  '/favorites',
  '/loyalty',
  '/reviews',
  '/terms',
  '/privacy',
  '/api/health',
];

// Auth paths
const authPaths = ['/auth', '/forgot-password'];

// Portal paths that require authentication
const portalPaths = ['/portal'];

// SEO bot user agents
const SEO_BOTS = [
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
];

function isSearchBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return SEO_BOTS.some(bot => ua.includes(bot));
}

// Paths that should bypass maintenance mode check
const MAINTENANCE_BYPASS_PATHS = [
  '/maintenance',
  '/portal/login',
  '/api/',
  '/_next/',
  '/assets/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

// Check if user is admin from cookies (edge-compatible)
function isAdminFromCookies(request: NextRequest): boolean {
  try {
    // Check employee_data cookie
    const employeeData = request.cookies.get('employee_data')?.value;
    if (employeeData) {
      const parsed = JSON.parse(decodeURIComponent(employeeData));
      if (parsed.role === 'admin') return true;
    }
  } catch {}
  
  try {
    // Check JWT token payload (basic decode, no verification in edge)
    const authToken = request.cookies.get('auth_token')?.value || 
                      request.cookies.get('sb-access-token')?.value;
    if (authToken) {
      const parts = authToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === 'admin') return true;
      }
    }
  } catch {}
  
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next();
  const userAgent = request.headers.get('user-agent') || '';

  // =============================================
  // MAINTENANCE MODE CHECK (SSR - No client requests)
  // =============================================
  const shouldCheckMaintenance = !MAINTENANCE_BYPASS_PATHS.some(path => 
    pathname.startsWith(path) || pathname === path
  );

  if (shouldCheckMaintenance && supabaseUrl && supabaseKey) {
    try {
      // Create edge-compatible supabase client
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      
      // Check maintenance status directly from database
      const { data: maintenanceData } = await supabase.rpc('get_maintenance_status');
      
      if (maintenanceData?.is_enabled) {
        // Check if current user is admin
        const isAdmin = isAdminFromCookies(request);
        
        // If not admin, redirect to maintenance page
        if (!isAdmin) {
          const maintenanceUrl = new URL('/maintenance', request.url);
          return NextResponse.redirect(maintenanceUrl);
        }
      }
    } catch (error) {
      // If maintenance check fails, allow access (fail-open for availability)
      console.error('[Middleware] Maintenance check failed:', error);
    }
  }

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)');

  // Content Security Policy
  const cspHeader = [
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
  response.headers.set('Content-Security-Policy', cspHeader);

  // Block common attack patterns
  const blockedPatterns = [
    /\.php$/i,
    /\.asp$/i,
    /\.aspx$/i,
    /\.jsp$/i,
    /wp-admin/i,
    /wp-login/i,
    /wp-content/i,
    /wp-includes/i,
    /xmlrpc/i,
    /\.env$/i,
    /\.git/i,
    /\.sql$/i,
    /\.bak$/i,
    /\.config$/i,
    /\.ini$/i,
    /cgi-bin/i,
    /phpmyadmin/i,
    /adminer/i,
  ];

  if (blockedPatterns.some(pattern => pattern.test(pathname))) {
    return new NextResponse(null, { status: 404 });
  }

  // CORS handling for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    
    // Check if origin is localhost (development)
    const isLocalhost = origin && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:') ||
      origin === 'http://localhost' ||
      origin === 'http://127.0.0.1'
    );

    // Set CORS headers - allow localhost in development
    if (origin && (ALLOWED_ORIGINS.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost))) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Same-origin or server-side request
      response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    } else if (process.env.NODE_ENV !== 'production') {
      // In development, allow any origin
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    // Block unauthorized origins in production only
    if (process.env.NODE_ENV === 'production' && origin && !ALLOWED_ORIGINS.includes(origin)) {
      // Allow search bots to access API for SEO
      if (!isSearchBot(userAgent)) {
        return new NextResponse(
          JSON.stringify({ error: 'Origin not allowed' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Portal authentication check
  const isPortalPath = portalPaths.some(path => pathname.startsWith(path));
  
  if (isPortalPath && !pathname.includes('/portal/login')) {
    const authToken = request.cookies.get('auth_token')?.value;
    
    if (!authToken) {
      const loginUrl = new URL('/portal/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
