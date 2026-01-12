import { Metadata } from 'next';

// Site-wide constants
export const SITE_NAME = 'ZOIRO Broast';
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zoirobroast.me';
export const SITE_DESCRIPTION = 'Order delicious crispy broast chicken, spicy wings, juicy burgers, and fresh meals from ZOIRO Broast. Best fried chicken in Vehari with fast home delivery. Fresh food, amazing taste!';

// Primary Keywords
export const PRIMARY_KEYWORDS = [
  'zoiro broast',
  'broast chicken',
  'fried chicken',
  'broasted chicken',
  'chicken broast',
  'best broast',
  'crispy chicken',
];

// Secondary/Long-tail Keywords
export const SECONDARY_KEYWORDS = [
  'broast chicken near me',
  'best broast chicken in vehari',
  'chicken delivery vehari',
  'fast food delivery',
  'online food order',
  'crispy fried chicken',
  'spicy chicken wings',
  'chicken burger',
  'zinger burger',
  'family meal deals',
  'broast deals',
  'chicken bucket',
  'party food order',
  'halal chicken',
  'fresh broast',
];

// Local SEO Keywords
export const LOCAL_KEYWORDS = [
  'broast in vehari',
  'vehari broast',
  'faisal town vehari food',
  'vehari fried chicken',
  'vehari food delivery',
  'best restaurant vehari',
  'chicken shop vehari',
  'fast food vehari',
];

// All keywords combined
export const ALL_KEYWORDS = [...PRIMARY_KEYWORDS, ...SECONDARY_KEYWORDS, ...LOCAL_KEYWORDS];

// Business Information for Local SEO
export const BUSINESS_INFO = {
  name: 'ZOIRO Broast',
  type: 'Restaurant',
  cuisine: ['Pakistani', 'Fast Food', 'Fried Chicken'],
  phone: '+92 304 629 2822',
  email: 'zorobroast@gmail.com',
  address: {
    street: 'Near Baba G Kulfi, Faisal Town',
    city: 'Vehari',
    region: 'Punjab',
    country: 'Pakistan',
    postalCode: '61100',
  },
  geo: {
    latitude: 30.0451,
    longitude: 72.3487,
  },
  hours: 'Mo-Su 11:00-23:00',
  priceRange: '$$',
  servesCuisine: 'Pakistani Fast Food',
  acceptsReservations: false,
  hasDelivery: true,
  hasTakeout: true,
  hasDineIn: true,
};

// Social Media Links
export const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/zoirobroast',
  instagram: 'https://instagram.com/zoirobroast',
  whatsapp: 'https://wa.me/923046292822',
};

// Default OpenGraph Image
export const DEFAULT_OG_IMAGE = {
  url: '/assets/zoiro-og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'ZOIRO Broast - Best Broast Chicken',
  type: 'image/jpeg',
};

// Generate base metadata
export function generateBaseMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} - Best Broast Chicken in Vehari`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: ALL_KEYWORDS,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['ur_PK'],
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME} - Best Broast Chicken in Vehari`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - Best Broast Chicken in Vehari`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE.url],
      creator: '@zoirobroast',
      site: '@zoirobroast',
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
        'ur-PK': `${SITE_URL}/ur`,
      },
    },
    category: 'food',
    classification: 'Restaurant',
    ...overrides,
  };
}

// Page-specific metadata generators
export const pageMetadata = {
  home: (): Metadata => generateBaseMetadata({
    title: 'ZOIRO Broast - Best Broast Chicken & Fast Food Delivery in Vehari',
    description: 'Order crispy broast chicken, spicy wings, zinger burgers & family meals from ZOIRO Broast Vehari. Fast delivery, fresh food, amazing taste! Call +92 304 629 2822',
    keywords: [...PRIMARY_KEYWORDS, 'home delivery', 'food order online', 'vehari restaurant'],
    openGraph: {
      title: 'ZOIRO Broast - Best Broast Chicken & Fast Food Delivery in Vehari',
      description: 'Order crispy broast chicken, spicy wings, zinger burgers & family meals. Fast delivery!',
      url: SITE_URL,
      images: [DEFAULT_OG_IMAGE],
    },
  }),

  menu: (): Metadata => generateBaseMetadata({
    title: 'Menu - Broast Chicken, Burgers, Wings & Deals',
    description: 'Explore ZOIRO Broast full menu: Crispy broast chicken, zinger burgers, spicy wings, family buckets, meal deals & more. Fresh ingredients, best prices in Vehari!',
    keywords: [
      'zoiro menu', 'broast menu', 'chicken menu', 'fast food menu',
      'zinger burger', 'chicken wings', 'family bucket', 'meal deals',
      'chicken nuggets', 'french fries', 'combo meals', 'party packages',
    ],
    openGraph: {
      title: 'ZOIRO Broast Menu - Full Food Menu with Prices',
      description: 'View our complete menu with prices. Broast, burgers, wings, deals & more!',
      url: `${SITE_URL}/menu`,
    },
    alternates: {
      canonical: `${SITE_URL}/menu`,
    },
  }),

  contact: (): Metadata => generateBaseMetadata({
    title: 'Contact Us - Location, Phone & Hours',
    description: 'Contact ZOIRO Broast Vehari. Address: Near Baba G Kulfi, Faisal Town. Phone: +92 304 629 2822. Open Daily 11AM-11PM. Fast delivery available!',
    keywords: [
      'zoiro contact', 'zoiro broast phone', 'zoiro location', 'zoiro address',
      'vehari restaurant contact', 'food delivery vehari', 'broast phone number',
    ],
    openGraph: {
      title: 'Contact ZOIRO Broast - Location & Phone',
      description: 'Find us at Faisal Town, Vehari. Call +92 304 629 2822 for orders!',
      url: `${SITE_URL}/contact`,
    },
    alternates: {
      canonical: `${SITE_URL}/contact`,
    },
  }),

  cart: (): Metadata => generateBaseMetadata({
    title: 'Your Cart - Complete Your Order',
    description: 'Review your cart and checkout. Fast delivery in Vehari. Cash on delivery, bank transfer & online payment available. Order now!',
    keywords: ['food cart', 'checkout', 'order food', 'delivery order', 'cash on delivery'],
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title: 'Your Cart - ZOIRO Broast',
      description: 'Complete your food order. Fast delivery available!',
      url: `${SITE_URL}/cart`,
    },
    alternates: {
      canonical: `${SITE_URL}/cart`,
    },
  }),

  favorites: (): Metadata => generateBaseMetadata({
    title: 'My Favorites - Saved Items',
    description: 'Your favorite ZOIRO Broast items saved for quick ordering. Easy reorder your loved dishes!',
    keywords: ['favorite food', 'saved items', 'quick order', 'reorder'],
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: `${SITE_URL}/favorites`,
    },
  }),

  loyalty: (): Metadata => generateBaseMetadata({
    title: 'Loyalty Program - Earn Points & Rewards',
    description: 'Join ZOIRO Broast loyalty program! Earn points on every order, unlock exclusive deals, get free meals & special discounts. Start saving today!',
    keywords: [
      'loyalty program', 'food rewards', 'earn points', 'free food',
      'discount codes', 'promo codes', 'customer rewards', 'special offers',
    ],
    openGraph: {
      title: 'ZOIRO Broast Loyalty Program - Earn & Save',
      description: 'Earn points on every order. Get free meals & exclusive deals!',
      url: `${SITE_URL}/loyalty`,
    },
    alternates: {
      canonical: `${SITE_URL}/loyalty`,
    },
  }),

  reviews: (): Metadata => generateBaseMetadata({
    title: 'Customer Reviews & Ratings',
    description: 'Read genuine customer reviews of ZOIRO Broast. See why we\'re rated the best broast chicken in Vehari. Share your experience!',
    keywords: [
      'zoiro reviews', 'broast reviews', 'customer ratings', 'food reviews',
      'vehari restaurant reviews', 'best rated restaurant', 'customer feedback',
    ],
    openGraph: {
      title: 'ZOIRO Broast Reviews - Customer Feedback',
      description: 'See what our customers say about us. Rated best in Vehari!',
      url: `${SITE_URL}/reviews`,
    },
    alternates: {
      canonical: `${SITE_URL}/reviews`,
    },
  }),

  terms: (): Metadata => generateBaseMetadata({
    title: 'Terms & Conditions',
    description: 'ZOIRO Broast terms and conditions. Read about our ordering policy, delivery terms, refund policy, and service agreements.',
    keywords: ['terms of service', 'conditions', 'ordering policy', 'delivery terms'],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${SITE_URL}/terms`,
    },
  }),

  privacy: (): Metadata => generateBaseMetadata({
    title: 'Privacy Policy',
    description: 'ZOIRO Broast privacy policy. Learn how we protect your personal data, handle your information, and ensure secure transactions.',
    keywords: ['privacy policy', 'data protection', 'personal information', 'security'],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${SITE_URL}/privacy`,
    },
  }),

  orders: (): Metadata => generateBaseMetadata({
    title: 'My Orders - Track Your Delivery',
    description: 'Track your ZOIRO Broast orders in real-time. View order history and reorder your favorites easily.',
    keywords: ['order tracking', 'delivery status', 'order history', 'track food'],
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `${SITE_URL}/orders`,
    },
  }),
};

// JSON-LD Structured Data
export function generateRestaurantSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurant`,
    name: BUSINESS_INFO.name,
    image: `${SITE_URL}/assets/zoiro-logo.png`,
    url: SITE_URL,
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.region,
      postalCode: BUSINESS_INFO.address.postalCode,
      addressCountry: BUSINESS_INFO.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '11:00',
      closes: '23:00',
    },
    servesCuisine: BUSINESS_INFO.cuisine,
    priceRange: BUSINESS_INFO.priceRange,
    acceptsReservations: BUSINESS_INFO.acceptsReservations,
    hasDeliveryMethod: {
      '@type': 'DeliveryMethod',
      name: 'Home Delivery',
    },
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/menu`,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: ['http://purl.org/goodrelations/v1#DeliveryModeOwnFleet'],
    },
    sameAs: [
      SOCIAL_LINKS.facebook,
      SOCIAL_LINKS.instagram,
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '500',
      bestRating: '5',
      worstRating: '1',
    },
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    publisher: {
      '@id': `${SITE_URL}/#restaurant`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/menu?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-US',
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateMenuItemSchema(item: {
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.name,
    description: item.description,
    offers: {
      '@type': 'Offer',
      price: item.price,
      priceCurrency: 'PKR',
    },
    image: item.image,
    menuAddOn: {
      '@type': 'MenuSection',
      name: item.category,
    },
  };
}

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: BUSINESS_INFO.name,
    image: `${SITE_URL}/assets/zoiro-logo.png`,
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.region,
      postalCode: BUSINESS_INFO.address.postalCode,
      addressCountry: 'PK',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    openingHours: BUSINESS_INFO.hours,
    priceRange: BUSINESS_INFO.priceRange,
    paymentAccepted: 'Cash, Bank Transfer, JazzCash, EasyPaisa',
    currenciesAccepted: 'PKR',
    areaServed: {
      '@type': 'City',
      name: 'Vehari',
    },
  };
}
