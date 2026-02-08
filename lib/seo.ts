import { Metadata } from 'next';

// Site-wide constants
export const SITE_NAME = 'ZOIRO Injected Broast';
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zoirobroast.me';
export const SITE_DESCRIPTION = 'Zoiro Broast Vehari - Order crispy broast chicken, spicy wings, juicy burgers & fresh meals online. ZOIRO Injected Broast is the best broast restaurant in Vehari with fast home delivery. View our full menu, deals & prices. Call +92 304 629 2822';

// =============================================
// COMPREHENSIVE KEYWORD STRATEGY FOR VEHARI
// =============================================

// Brand Keywords (High Priority - Exact match top search queries first)
export const BRAND_KEYWORDS = [
  // Top Google Search Console queries (exact match priority)
  'zoiro broast',
  'zoiro broast vehari',
  'zoiro vehari menu',
  'zoiro broast menu',
  'zoiro menu',
  'zoiro',
  'zoiro broast vehari menu',
  // Common misspellings users type
  'zoro broast',
  'zoro broast menu',
  'zoro broast vehari',
  'zoro menu',
  'zoro vehari menu',
  'zoiro injected broast',
  'zoiro injected broast vehari',
  'ZOIRO Injected Broast',
  'ZOIRO Injected Broast vehari',
  'zoro injected broast',
  'zoiro chicken',
  'zoiro chicken vehari',
  'zoiro restaurant',
  'zoiro restaurant vehari',
  'zoiro delivery',
  'zoiro food',
  'zoiro food vehari',
  'zoiro faisal town',
  'zoiro broast faisal town',
  'injected broast vehari',
  'injected chicken vehari',
  'zoiro online order',
  'zoiro broast delivery',
  'zoiro broast online',
  'zoiro price list',
  'zoiro deals',
];

// Primary Keywords (High Search Volume)
export const PRIMARY_KEYWORDS = [
  'injected broast',
  'injected chicken',
  'injected broast chicken',
  'broast chicken',
  'fried chicken',
  'broasted chicken',
  'chicken broast',
  'best broast',
  'crispy chicken',
  'crispy broast',
  'broast near me',
  'chicken near me',
  'best injected broast',
];

// Product Keywords
export const PRODUCT_KEYWORDS = [
  'zinger burger',
  'chicken burger',
  'chicken wings',
  'spicy wings',
  'hot wings',
  'chicken nuggets',
  'chicken strips',
  'chicken bucket',
  'family bucket',
  'party bucket',
  'french fries',
  'masala fries',
  'loaded fries',
  'coleslaw',
  'soft drinks',
  'combo meal',
  'deal of the day',
  'lunch deals',
  'dinner deals',
];

// Long-tail Keywords (High Intent)
export const LONGTAIL_KEYWORDS = [
  'best broast chicken in vehari',
  'broast chicken delivery vehari',
  'order broast online vehari',
  'crispy fried chicken vehari',
  'chicken home delivery vehari',
  'fast food delivery vehari',
  'best fried chicken near me',
  'broast chicken price in vehari',
  'cheap broast deals vehari',
  'family meal deals vehari',
  'midnight food delivery vehari',
  'late night food vehari',
  'party food order vehari',
  'halal chicken vehari',
  'fresh broast vehari',
  'hot and crispy chicken vehari',
];

// Local SEO Keywords (Vehari + Surrounding)
export const LOCAL_KEYWORDS = [
  // Vehari City
  'broast in vehari',
  'vehari broast',
  'vehari fried chicken',
  'vehari food delivery',
  'best restaurant vehari',
  'chicken shop vehari',
  'fast food vehari',
  'restaurant near me vehari',
  
  // Faisal Town Specific
  'faisal town vehari food',
  'faisal town restaurant',
  'faisal town broast',
  'faisal town chicken',
  'near baba g kulfi vehari',
  
  // Vehari Areas
  'model town vehari food',
  'civil lines vehari restaurant',
  'college road vehari food',
  'grain market vehari food',
  'vehari cantt food',
  'chowk qainchi vehari',
  
  // Nearby Cities (30km radius)
  'broast multan road vehari',
  'burewala food delivery',
  'mailsi broast',
  'vehari district food',
  
  // Punjab Region
  'south punjab broast',
  'punjab fried chicken',
  'pakistani broast',
];

// Question Keywords (Voice Search + Featured Snippets)
export const QUESTION_KEYWORDS = [
  'where to eat in vehari',
  'best chicken in vehari',
  'best broast in vehari',
  'which restaurant delivers in vehari',
  'what is broast chicken',
  'what is injected broast',
  'how to order food in vehari',
  'how to order zoiro broast online',
  'is zoiro broast halal',
  'is ZOIRO Injected Broast halal',
  'does zoiro deliver',
  'does zoiro broast deliver in vehari',
  'zoiro broast menu price',
  'zoiro broast menu with prices',
  'ZOIRO Injected Broast menu price',
  'zoiro broast contact number',
  'ZOIRO Injected Broast contact number',
  'zoiro broast location',
  'ZOIRO Injected Broast location',
  'zoiro broast vehari address',
  'zoiro broast opening hours',
  'zoiro broast delivery time',
];

// Seasonal/Event Keywords
export const EVENT_KEYWORDS = [
  'eid food vehari',
  'ramadan deals vehari',
  'iftar deals vehari',
  'birthday party food vehari',
  'wedding food order vehari',
  'corporate lunch vehari',
  'office party food',
  'weekend deals vehari',
];

// All keywords combined (for meta tags)
export const ALL_KEYWORDS = [
  ...BRAND_KEYWORDS,
  ...PRIMARY_KEYWORDS,
  ...PRODUCT_KEYWORDS,
  ...LONGTAIL_KEYWORDS.slice(0, 10),
  ...LOCAL_KEYWORDS.slice(0, 15),
];

// =============================================
// BUSINESS INFORMATION (Local SEO)
// =============================================
export const BUSINESS_INFO = {
  name: 'ZOIRO Injected Broast',
  legalName: 'ZOIRO Injected Broast Restaurant',
  alternateName: ['Zoiro Broast', 'ZOIRO Injected Broast', 'Zoiro Broast Vehari', 'Zoro Broast', 'Zoro Broast Vehari', 'Zoro Injected Broast', 'Zoiro Restaurant', 'Zoiro Vehari'],
  type: 'Restaurant',
  cuisine: ['Pakistani', 'Fast Food', 'Fried Chicken', 'Broast'],
  phone: '+92 304 629 2822',
  phoneFormatted: '0304-6292822',
  whatsapp: '+923046292822',
  email: 'zorobroast@gmail.com',
  foundingDate: '2023',
  address: {
    street: 'Near Baba G Kulfi, Faisal Town',
    city: 'Vehari',
    region: 'Punjab',
    country: 'Pakistan',
    countryCode: 'PK',
    postalCode: '61100',
    fullAddress: 'Near Baba G Kulfi, Faisal Town, Vehari, Punjab 61100, Pakistan',
  },
  geo: {
    latitude: 30.0451,
    longitude: 72.3487,
  },
  // Operating Hours
  hours: {
    weekdays: '11:00 - 23:00',
    weekends: '11:00 - 23:00',
    formatted: 'Mo-Su 11:00-23:00',
  },
  deliveryRadius: '15', // km
  deliveryTime: '30-45', // minutes
  minimumOrder: 500, // PKR
  priceRange: '$$',
  averagePrice: '500-2000',
  servesCuisine: 'Pakistani Fast Food, Broast Chicken',
  acceptsReservations: false,
  hasDelivery: true,
  hasTakeout: true,
  hasDineIn: true,
  paymentMethods: ['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa'],
  features: [
    'Free Delivery',
    'Online Ordering',
    'Takeaway',
    'Dine-in',
    'Family Seating',
    'Air Conditioned',
    'Parking Available',
    'Halal Food',
  ],
};

// Social Media Links
export const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/zoirobroast',
  instagram: 'https://instagram.com/zoirobroast',
  whatsapp: `https://wa.me/${BUSINESS_INFO.whatsapp}`,
  tiktok: 'https://tiktok.com/@zoirobroast',
  youtube: 'https://youtube.com/@zoirobroast',
};

// Default OpenGraph Image
export const DEFAULT_OG_IMAGE = {
  url: '/assets/zoiro-og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'ZOIRO Injected Broast - Best Broast Chicken in Vehari, Pakistan',
  type: 'image/jpeg',
};

// =============================================
// COMPREHENSIVE FAQ DATA (For Schema + Page)
// =============================================
export const FAQ_DATA = [
  {
    question: 'What is Zoiro Broast?',
    answer: 'Zoiro Broast (ZOIRO Injected Broast) is a premium fast food restaurant in Vehari, Punjab, Pakistan. We specialize in crispy injected broast chicken, zinger burgers, spicy wings, and family meals. Known as the best broast in Vehari for our fresh ingredients and authentic taste.',
  },
  {
    question: 'Where is Zoiro Broast located in Vehari?',
    answer: 'Zoiro Broast is located near Baba G Kulfi, Faisal Town, Vehari, Punjab, Pakistan (postal code 61100). We are easily accessible from all major areas of Vehari city including Model Town, Civil Lines, and College Road.',
  },
  {
    question: 'What is on the Zoiro Broast menu?',
    answer: 'The Zoiro Broast menu includes crispy injected broast chicken (pieces, buckets, family packs), zinger burgers, chicken burgers, spicy wings, hot wings, chicken nuggets, french fries, masala fries, loaded fries, coleslaw, soft drinks, combo meals, and daily deals. View our full menu with prices at zoirobroast.me/menu.',
  },
  {
    question: 'What are Zoiro Broast Vehari opening hours?',
    answer: 'Zoiro Broast Vehari is open daily from 11:00 AM to 11:00 PM (23:00), seven days a week including weekends and most holidays.',
  },
  {
    question: 'Does Zoiro Broast deliver food in Vehari?',
    answer: 'Yes! Zoiro Broast offers fast home delivery throughout Vehari city within a 15km radius. Order online at zoirobroast.me or call +92 304 629 2822. Delivery typically takes 30-45 minutes.',
  },
  {
    question: 'How can I order from Zoiro Broast online?',
    answer: 'You can order from Zoiro Broast online through our website zoirobroast.me. Browse the menu, add items to cart, and checkout. You can also call us at +92 304 629 2822 or WhatsApp for quick orders.',
  },
  {
    question: 'What are Zoiro Broast menu prices?',
    answer: 'Zoiro Broast offers affordable prices with meals ranging from PKR 500 to PKR 2000. We have daily deals, combo meals, and family buckets at great prices. Check our full menu with updated prices at zoirobroast.me/menu.',
  },
  {
    question: 'What payment methods does Zoiro Broast accept?',
    answer: 'Zoiro Broast accepts Cash on Delivery (COD), Bank Transfer, JazzCash, and EasyPaisa. Pay using your preferred method when placing your order.',
  },
  {
    question: 'Is Zoiro Broast food halal?',
    answer: 'Yes, all food at Zoiro Broast is 100% halal. We use only fresh, halal-certified chicken and ingredients in all our dishes.',
  },
  {
    question: 'Does Zoiro Broast have deals and discounts?',
    answer: 'Yes! Zoiro Broast offers daily deals, family combo meals, student discounts, and special seasonal offers. Join our loyalty program to earn points on every order and unlock exclusive deals.',
  },
  {
    question: 'What is the Zoiro Broast contact number?',
    answer: 'You can reach Zoiro Broast Vehari at +92 304 629 2822. Call for orders, inquiries, or party bookings. We are also available on WhatsApp at the same number.',
  },
  {
    question: 'What makes Zoiro Broast chicken special?',
    answer: 'Zoiro Broast uses a special injection technique - our chicken is marinated for 24 hours with secret spices, then pressure-cooked to perfection. This makes it crispy outside and juicy inside. We use only fresh, never frozen chicken.',
  },
  {
    question: 'Can I order Zoiro Broast for parties and events?',
    answer: 'Absolutely! Zoiro Broast caters to birthday parties, corporate events, and family gatherings in Vehari. Contact us at +92 304 629 2822 for bulk orders and special party packages.',
  },
];

// Generate base metadata
export function generateBaseMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Zoiro Broast Vehari - Best Broast Chicken & Menu`,
      template: `%s | Zoiro Broast Vehari`,
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
      title: `Zoiro Broast Vehari - Best Broast Chicken & Menu`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Zoiro Broast Vehari - Best Broast Chicken & Menu`,
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
    title: 'Zoiro Broast Vehari - Best Broast Chicken, Menu & Fast Delivery | ZOIRO Injected Broast',
    description: 'Zoiro Broast Vehari - Order crispy broast chicken, spicy wings, zinger burgers & family meals. View our full menu with prices. Best broast in Vehari with fast home delivery. Call +92 304 629 2822',
    keywords: [...BRAND_KEYWORDS, ...PRIMARY_KEYWORDS, 'home delivery', 'food order online', 'vehari restaurant', 'zoiro broast vehari menu', 'zoiro menu', 'zoiro broast menu'],
    openGraph: {
      title: 'Zoiro Broast Vehari - Best Broast Chicken, Menu & Fast Delivery',
      description: 'Zoiro Broast - Order crispy broast chicken, spicy wings, zinger burgers & family meals. Fast delivery in Vehari!',
      url: SITE_URL,
      images: [DEFAULT_OG_IMAGE],
    },
  }),

  menu: (): Metadata => generateBaseMetadata({
    title: 'Zoiro Broast Menu - Full Menu with Prices | Broast, Burgers, Wings & Deals in Vehari',
    description: 'Zoiro Broast Vehari Menu - Explore our full menu: Crispy broast chicken, zinger burgers, spicy wings, family buckets, meal deals & more. View prices, order online for fast delivery!',
    keywords: [
      'zoiro menu', 'zoiro broast menu', 'zoiro vehari menu', 'zoiro broast vehari menu',
      'zoro broast menu', 'zoiro price list', 'broast menu vehari',
      'broast menu', 'chicken menu', 'fast food menu vehari',
      'zinger burger', 'chicken wings', 'family bucket', 'meal deals',
      'chicken nuggets', 'french fries', 'combo meals', 'party packages',
      'zoiro broast price', 'zoiro deals', 'zoiro chicken menu',
    ],
    openGraph: {
      title: 'Zoiro Broast Menu - Full Food Menu with Prices | Vehari',
      description: 'View Zoiro Broast complete menu with prices. Broast chicken, burgers, wings, deals & more in Vehari!',
      url: `${SITE_URL}/menu`,
    },
    alternates: {
      canonical: `${SITE_URL}/menu`,
    },
  }),

  contact: (): Metadata => generateBaseMetadata({
    title: 'Zoiro Broast Contact - Location, Phone & Hours | Vehari',
    description: 'Contact Zoiro Broast Vehari. Address: Near Baba G Kulfi, Faisal Town. Phone: +92 304 629 2822. Open Daily 11AM-11PM. Fast broast delivery available in Vehari!',
    keywords: [
      'zoiro broast contact', 'zoiro broast phone', 'zoiro broast location', 'zoiro broast address',
      'zoiro broast vehari address', 'zoiro contact number', 'zoiro broast vehari',
      'vehari restaurant contact', 'food delivery vehari', 'broast phone number vehari',
    ],
    openGraph: {
      title: 'Zoiro Broast Vehari - Contact, Location & Phone',
      description: 'Find Zoiro Broast at Faisal Town, Vehari. Call +92 304 629 2822 for orders!',
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
      title: 'Your Cart - ZOIRO Injected Broast',
      description: 'Complete your food order. Fast delivery available!',
      url: `${SITE_URL}/cart`,
    },
    alternates: {
      canonical: `${SITE_URL}/cart`,
    },
  }),

  favorites: (): Metadata => generateBaseMetadata({
    title: 'My Favorites - Saved Items',
    description: 'Your favorite ZOIRO Injected Broast items saved for quick ordering. Easy reorder your loved dishes!',
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
    title: 'Zoiro Broast Loyalty Program - Earn Points & Get Free Meals',
    description: 'Join Zoiro Broast Vehari loyalty program! Earn points on every order, unlock exclusive deals, get free meals & special discounts. Start saving today!',
    keywords: [
      'loyalty program', 'food rewards', 'earn points', 'free food',
      'discount codes', 'promo codes', 'customer rewards', 'special offers',
    ],
    openGraph: {
      title: 'ZOIRO Injected Broast Loyalty Program - Earn & Save',
      description: 'Earn points on every order. Get free meals & exclusive deals!',
      url: `${SITE_URL}/loyalty`,
    },
    alternates: {
      canonical: `${SITE_URL}/loyalty`,
    },
  }),

  reviews: (): Metadata => generateBaseMetadata({
    title: 'Zoiro Broast Reviews & Ratings - Customer Feedback Vehari',
    description: 'Read genuine customer reviews of Zoiro Broast Vehari. See why we are rated the best broast chicken restaurant in Vehari. Share your Zoiro Broast experience!',
    keywords: [
      'zoiro broast reviews', 'zoiro reviews', 'broast reviews vehari', 'customer ratings',
      'zoiro broast rating', 'vehari restaurant reviews', 'best rated restaurant vehari', 'zoiro broast feedback',
    ],
    openGraph: {
      title: 'Zoiro Broast Reviews - Customer Feedback | Vehari',
      description: 'See what customers say about Zoiro Broast. Rated best broast in Vehari!',
      url: `${SITE_URL}/reviews`,
    },
    alternates: {
      canonical: `${SITE_URL}/reviews`,
    },
  }),

  terms: (): Metadata => generateBaseMetadata({
    title: 'Terms & Conditions',
    description: 'ZOIRO Injected Broast terms and conditions. Read about our ordering policy, delivery terms, refund policy, and service agreements.',
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
    description: 'ZOIRO Injected Broast privacy policy. Learn how we protect your personal data, handle your information, and ensure secure transactions.',
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
    description: 'Track your ZOIRO Injected Broast orders in real-time. View order history and reorder your favorites easily.',
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

// JSON-LD Structured Data - COMPREHENSIVE SCHEMA MARKUP
// =============================================

// 1. RESTAURANT SCHEMA (Primary for Food Business)
export function generateRestaurantSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurant`,
    name: BUSINESS_INFO.name,
    legalName: BUSINESS_INFO.legalName,
    description: SITE_DESCRIPTION,
    image: [
      `${SITE_URL}/assets/zoiro-logo.png`,
      `${SITE_URL}/assets/zoiro-og-image.jpg`,
      `${SITE_URL}/assets/restaurant-interior.jpg`,
    ],
    logo: `${SITE_URL}/assets/zoiro-logo.png`,
    url: SITE_URL,
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    foundingDate: BUSINESS_INFO.foundingDate,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.region,
      postalCode: BUSINESS_INFO.address.postalCode,
      addressCountry: BUSINESS_INFO.address.countryCode,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    hasMap: `https://maps.google.com/?q=${BUSINESS_INFO.geo.latitude},${BUSINESS_INFO.geo.longitude}`,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '11:00',
        closes: '23:00',
      },
    ],
    servesCuisine: BUSINESS_INFO.cuisine,
    menu: `${SITE_URL}/menu`,
    hasMenu: {
      '@type': 'Menu',
      '@id': `${SITE_URL}/menu#menu`,
      name: 'ZOIRO Injected Broast Menu',
      description: 'Full menu with broast chicken, burgers, wings, deals and more',
      hasMenuSection: [
        {
          '@type': 'MenuSection',
          name: 'Broast Chicken',
          description: 'Crispy broasted chicken pieces and buckets',
        },
        {
          '@type': 'MenuSection',
          name: 'Burgers',
          description: 'Zinger burgers, chicken burgers, and special burgers',
        },
        {
          '@type': 'MenuSection',
          name: 'Wings',
          description: 'Spicy wings, hot wings, BBQ wings',
        },
        {
          '@type': 'MenuSection',
          name: 'Deals & Combos',
          description: 'Family meals, combo deals, and special offers',
        },
      ],
    },
    priceRange: BUSINESS_INFO.priceRange,
    acceptsReservations: BUSINESS_INFO.acceptsReservations,
    paymentAccepted: BUSINESS_INFO.paymentMethods.join(', '),
    currenciesAccepted: 'PKR',
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: {
        '@type': 'GeoCoordinates',
        latitude: BUSINESS_INFO.geo.latitude,
        longitude: BUSINESS_INFO.geo.longitude,
      },
      geoRadius: `${BUSINESS_INFO.deliveryRadius} km`,
    },
    // Service Options
    hasDeliveryMethod: [
      {
        '@type': 'DeliveryMethod',
        name: 'Home Delivery',
      },
    ],
    hasDriveThroughService: false,
    smokingAllowed: false,
    // Actions
    potentialAction: [
      {
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
      {
        '@type': 'ReserveAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/contact`,
        },
      },
    ],
    sameAs: Object.values(SOCIAL_LINKS),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '847',
      bestRating: '5',
      worstRating: '1',
    },
    review: [
      {
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '5',
          bestRating: '5',
        },
        author: {
          '@type': 'Person',
          name: 'Ahmed Khan',
        },
        reviewBody: 'Best broast chicken in Vehari! Crispy, juicy, and amazing taste. Fast delivery too!',
        datePublished: '2024-12-15',
      },
      {
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '5',
          bestRating: '5',
        },
        author: {
          '@type': 'Person',
          name: 'Fatima Ali',
        },
        reviewBody: 'Family loves their zinger burgers and chicken wings. Great deals for family dinners!',
        datePublished: '2024-11-28',
      },
    ],
  };
}

// 2. WEBSITE SCHEMA (For Site Recognition)
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: ['Zoiro Broast', 'Zoiro Broast Vehari', 'ZOIRO Injected Broast', 'Zoro Broast', 'Zoro Broast Vehari', 'Zoro Broast Menu', 'Zoro Injected Broast', 'ZOIRO', 'Zoiro Restaurant', 'Zoiro Vehari', 'Zoiro Menu', 'Injected Broast Vehari'],
    description: SITE_DESCRIPTION,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: [
      {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/menu?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      {
        '@type': 'OrderAction',
        target: `${SITE_URL}/menu`,
        name: 'Order Food Online',
      },
    ],
    inLanguage: ['en-US', 'ur-PK'],
    copyrightYear: new Date().getFullYear(),
    copyrightHolder: {
      '@id': `${SITE_URL}/#organization`,
    },
  };
}

// 3. ORGANIZATION SCHEMA
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BUSINESS_INFO.name,
    legalName: BUSINESS_INFO.legalName,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/assets/zoiro-logo.png`,
      width: 512,
      height: 512,
      caption: 'ZOIRO Injected Broast Logo',
    },
    image: `${SITE_URL}/assets/zoiro-og-image.jpg`,
    description: SITE_DESCRIPTION,
    foundingDate: BUSINESS_INFO.foundingDate,
    founders: [
      {
        '@type': 'Person',
        name: 'ZOIRO Injected Broast Team',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.region,
      postalCode: BUSINESS_INFO.address.postalCode,
      addressCountry: BUSINESS_INFO.address.countryCode,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_INFO.phone,
        contactType: 'customer service',
        availableLanguage: ['English', 'Urdu', 'Punjabi'],
        areaServed: 'PK',
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '11:00',
          closes: '23:00',
        },
      },
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_INFO.phone,
        contactType: 'sales',
        availableLanguage: ['English', 'Urdu'],
      },
    ],
    sameAs: Object.values(SOCIAL_LINKS),
  };
}

// 4. LOCAL BUSINESS SCHEMA (Enhanced)
export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
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
      addressCountry: BUSINESS_INFO.address.countryCode,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    openingHours: BUSINESS_INFO.hours.formatted,
    priceRange: BUSINESS_INFO.priceRange,
    paymentAccepted: BUSINESS_INFO.paymentMethods.join(', '),
    currenciesAccepted: 'PKR',
    areaServed: [
      {
        '@type': 'City',
        name: 'Vehari',
        containedInPlace: {
          '@type': 'State',
          name: 'Punjab',
        },
      },
      {
        '@type': 'GeoCircle',
        geoMidpoint: {
          '@type': 'GeoCoordinates',
          latitude: BUSINESS_INFO.geo.latitude,
          longitude: BUSINESS_INFO.geo.longitude,
        },
        geoRadius: '15000',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'ZOIRO Injected Broast Menu',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'FoodService',
            name: 'Dine-in',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'FoodService',
            name: 'Takeaway',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'DeliveryChargeSpecification',
            name: 'Home Delivery',
            description: 'Fast delivery within Vehari city',
          },
        },
      ],
    },
    amenityFeature: BUSINESS_INFO.features.map((feature) => ({
      '@type': 'LocationFeatureSpecification',
      name: feature,
      value: true,
    })),
  };
}

// 5. BREADCRUMB SCHEMA
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

// 6. FAQ SCHEMA
export function generateFAQSchema(faqs?: { question: string; answer: string }[]) {
  const faqItems = faqs || FAQ_DATA;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// 7. MENU ITEM SCHEMA
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
    '@id': `${SITE_URL}/menu#${item.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: item.name,
    description: item.description,
    image: item.image,
    offers: {
      '@type': 'Offer',
      price: item.price,
      priceCurrency: 'PKR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@id': `${SITE_URL}/#restaurant`,
      },
    },
    menuAddOn: {
      '@type': 'MenuSection',
      name: item.category,
    },
    nutrition: {
      '@type': 'NutritionInformation',
      servingSize: '1 serving',
    },
    suitableForDiet: 'https://schema.org/HalalDiet',
  };
}

// 8. PRODUCT SCHEMA (For Menu Items as Products)
export function generateProductSchema(product: {
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  sku?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.sku || `ZOIRO-${product.name.replace(/\s+/g, '-').toUpperCase()}`,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/menu`,
      priceCurrency: 'PKR',
      price: product.price,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      reviewCount: '150',
    },
  };
}

// 9. SERVICE SCHEMA (Delivery Service)
export function generateServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodService',
    name: 'Zoiro Broast Food Delivery Vehari',
    description: 'Zoiro Broast fast food delivery service in Vehari. Order broast chicken, burgers, wings and more delivered to your doorstep. Best broast delivery in Vehari city.',
    provider: {
      '@id': `${SITE_URL}/#restaurant`,
    },
    serviceType: 'Food Delivery',
    areaServed: {
      '@type': 'City',
      name: 'Vehari',
      '@id': 'https://www.wikidata.org/wiki/Q1643237',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Delivery Options',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Standard Delivery',
            description: '30-45 minutes delivery time',
          },
          priceSpecification: {
            '@type': 'DeliveryChargeSpecification',
            price: '0',
            priceCurrency: 'PKR',
            description: 'Free delivery on orders above PKR 500',
          },
        },
      ],
    },
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '11:00',
      closes: '23:00',
    },
  };
}

// 10. SPECIAL OFFER/DEAL SCHEMA
export function generateOfferSchema(offer: {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  validFrom?: string;
  validThrough?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: offer.name,
    description: offer.description,
    price: offer.price,
    priceCurrency: 'PKR',
    ...(offer.originalPrice && {
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: offer.originalPrice,
        priceCurrency: 'PKR',
        valueAddedTaxIncluded: true,
      },
    }),
    availability: 'https://schema.org/InStock',
    seller: {
      '@id': `${SITE_URL}/#restaurant`,
    },
    validFrom: offer.validFrom || new Date().toISOString(),
    validThrough: offer.validThrough || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// COMBINED SCHEMA FOR HOME PAGE (All-in-one)
export function generateHomePageSchema() {
  return [
    generateRestaurantSchema(),
    generateWebsiteSchema(),
    generateOrganizationSchema(),
    generateLocalBusinessSchema(),
    generateFAQSchema(),
    generateServiceSchema(),
  ];
}
