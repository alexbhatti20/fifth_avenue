import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Inter } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/context/CartContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
import { Toaster } from '@/components/ui/toaster'
import FloatingCartButton from '@/components/custom/FloatingCartButton'
import CookieConsent from '@/components/custom/CookieConsent'
import JsonLd from '@/components/seo/JsonLd'
import GlobalGoogleAuthHandler from '@/components/auth/GlobalGoogleAuthHandler'
import { ALL_KEYWORDS, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebasNeue = Bebas_Neue({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas'
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dc2626' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Best Broast Chicken & Fast Food Delivery in Vehari`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ALL_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  generator: 'Next.js',
  applicationName: SITE_NAME,
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/assets/zoiro-logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/zoiro-logo.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/zoiro-logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/zoiro-logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/assets/zoiro-logo.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/assets/zoiro-logo.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ur_PK'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Best Broast Chicken & Fast Food Delivery in Vehari`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/assets/zoiro-og-image.jpg',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - Delicious Broast Chicken`,
        type: 'image/jpeg',
      },
      {
        url: '/assets/zoiro-logo.png',
        width: 512,
        height: 512,
        alt: `${SITE_NAME} Logo`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@zoirobroast',
    creator: '@zoirobroast',
    title: `${SITE_NAME} - Best Broast Chicken in Vehari`,
    description: 'Order crispy broast chicken, burgers, wings & more. Fast delivery in Vehari!',
    images: ['/assets/zoiro-og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'en-US': SITE_URL,
    },
  },
  category: 'food',
  classification: 'Restaurant',
  other: {
    'geo.region': 'PK-PB',
    'geo.placename': 'Vehari',
    'geo.position': '30.0451;72.3487',
    'ICBM': '30.0451, 72.3487',
    'rating': 'general',
    'distribution': 'global',
    'revisit-after': '7 days',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': SITE_NAME,
    'format-detection': 'telephone=no',
  },
  verification: {
    // Add verification codes when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://eqfeeiryzslccyivkphf.supabase.co" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        
        {/* Additional SEO meta tags */}
        <meta name="theme-color" content="#dc2626" />
        <meta name="msapplication-TileColor" content="#dc2626" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className={`${inter.variable} ${bebasNeue.variable}`}>
        {/* JSON-LD Structured Data for SEO - Comprehensive schema markup */}
        <JsonLd type="home" />
        
        {/* Global Google OAuth Handler for implicit flow */}
        <GlobalGoogleAuthHandler />
        
        <CartProvider>
          <FavoritesProvider>
            {children}
            <FloatingCartButton />
            <Toaster />
            <CookieConsent />
          </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  )
}
