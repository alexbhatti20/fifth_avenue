/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'eqfeeiryzslccyivkphf.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
    // Optimize images for Vercel
    formats: ['image/avif', 'image/webp'],
  },
  
  // Environment variable mapping (for backward compatibility)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // HSTS - enabled in production
          ...(isProd ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }] : []),
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
      {
        // Cache static assets
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Redirects for domain management (disabled for local dev)
  async redirects() {
    const isProd = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');
    if (!isProd) return [];
    return [
      // Redirect www to non-www (production only)
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.zoirobroast.me',
          },
        ],
        destination: 'https://zoirobroast.me/:path*',
        permanent: true,
      },
    ];
  },
  
  // Transpile packages that cause chunk 404 errors in dev
  transpilePackages: ['lottie-react'],

  // Compress output
  compress: true,
  
  // Power by header removal for security
  poweredByHeader: false,
  
  // Generate ETags for caching
  generateEtags: true,
  
  // Experimental optimizations for faster navigation
  experimental: {
    // Optimistic client cache for faster navigation
    optimisticClientCache: true,
  },
};

export default nextConfig;
