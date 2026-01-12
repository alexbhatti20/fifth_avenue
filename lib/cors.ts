import { NextRequest, NextResponse } from 'next/server';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://zoirobroast.me',
  'https://www.zoirobroast.me',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

// Development origins
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

// CORS headers configuration
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // 24 hours
  'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining',
};

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow same-origin requests
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { ...CORS_HEADERS };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    // Same-origin request
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0] || '*';
  }

  return headers;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Create a CORS-enabled JSON response
 */
export function corsJsonResponse(
  data: unknown,
  request: NextRequest,
  options?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  const allHeaders = { ...corsHeaders, ...options?.headers };

  return NextResponse.json(data, {
    status: options?.status || 200,
    headers: allHeaders,
  });
}

/**
 * Create a CORS-enabled error response
 */
export function corsErrorResponse(
  message: string,
  request: NextRequest,
  status: number = 400
): NextResponse {
  return corsJsonResponse(
    { success: false, error: message },
    request,
    { status }
  );
}

/**
 * Middleware wrapper for API routes with CORS support
 */
export function withCors(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest(request);
    }

    // Check origin
    const origin = request.headers.get('origin');
    if (origin && !isOriginAllowed(origin)) {
      return corsErrorResponse('Origin not allowed', request, 403);
    }

    // Call the actual handler
    const response = await handler(request);

    // Add CORS headers to response
    return addCorsHeaders(response, request);
  };
}

/**
 * Security headers for all responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://www.google-analytics.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
