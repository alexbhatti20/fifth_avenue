import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Source_Sans_3, Bebas_Neue, Caveat } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/context/CartContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
import { Toaster } from '@/components/ui/toaster'
import FloatingCartButton from '@/components/custom/FloatingCartButton'
import CookieConsent from '@/components/custom/CookieConsent'
import GlobalGoogleAuthHandler from '@/components/auth/GlobalGoogleAuthHandler'
import { ALL_KEYWORDS, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'
import PageLoader from '@/components/custom/PageLoader'
import { getOnlineOrderingSettingsServer } from '@/lib/server-queries'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans' })
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' })
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' })

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
    default: `${SITE_NAME} - Chasing Flavours | Best Injected Broast in Vehari`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${SITE_NAME} - Chasing Flavours. Experience the best injected broast and fast food in Vehari with our signature urban flavors and fast delivery.`,
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
    title: `${SITE_NAME} - Chasing Flavours | Best Injected Broast`,
    description: `Experience the best injected broast and fast food in Vehari with our signature urban flavors at ${SITE_NAME}.`,
    images: [
      {
        url: '/assets/zoiro-og-image.jpg',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - Chasing Flavours`,
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@fifthavenue',
    creator: '@fifthavenue',
    title: `${SITE_NAME} - Chasing Flavours`,
    description: `${SITE_NAME} - Order crispy injected broast chicken, burgers, pizza & more. Fast delivery in Vehari!`,
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
    google: 'AdHBIVqRzJMmXv6l_i_f2Ae6ZYvkL54hg4lbtlSGPQs',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const onlineOrderingSettings = await getOnlineOrderingSettingsServer()

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
      <body className={`${playfair.variable} ${sourceSans.variable} ${bebas.variable} ${caveat.variable}`}>
        <div
          className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.012]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
          }}
        />
        <PageLoader />
        <GlobalGoogleAuthHandler />

        <CartProvider
          initialOnlineOrderingEnabled={onlineOrderingSettings.enabled}
          initialOnlineOrderingMessage={onlineOrderingSettings.disabled_message}
        >
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
