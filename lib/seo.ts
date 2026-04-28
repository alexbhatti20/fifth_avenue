import { Metadata } from 'next';

// Site-wide constants
export const SITE_NAME = 'FIFTH AVENUE';
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fifth-avenue-weld.vercel.app';
export const SITE_DESCRIPTION = 'FIFTH AVENUE - Chasing Flavours with bold street food, premium quality ingredients, and fast delivery.';

// =============================================
// COMPREHENSIVE KEYWORD STRATEGY FOR VEHARI
// =============================================

// Brand Keywords (High Priority - Exact match top search queries first)
export const BRAND_KEYWORDS = [
  'fifth avenue',
  'fifth avenue vehari',
  'fifth avenue menu',
  'fifth avenue pizza',
  'fifth avenue broast',
  'fifth avenue restaurant',
  'fifth avenue delivery',
  'fifth avenue food',
  'fifth avenue urban hub',
  'urban street hub',
  'urban street hub vehari',
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
  name: 'FIFTH AVENUE',
  legalName: 'FIFTH AVENUE URBAN HUB',
  alternateName: ['Fifth Avenue', 'Fifth Avenue Vehari', 'Urban Street Hub', 'Fifth Avenue Restaurant'],
  type: 'Restaurant',
  cuisine: ['Pakistani', 'Fast Food', 'Fried Chicken', 'Pizza', 'Urban Street Food'],
  phone: '+92 321 5550199',
  phoneFormatted: '0321-5550199',
  whatsapp: '+923215550199',
  email: 'hub@fifthavenue.com',
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
  facebook: 'https://facebook.com/fifthavenue',
  instagram: 'https://instagram.com/fifthavenue',
  whatsapp: `https://wa.me/${BUSINESS_INFO.whatsapp}`,
  tiktok: 'https://tiktok.com/@fifthavenue',
  youtube: 'https://youtube.com/@fifthavenue',
};

// Default OpenGraph Image
export const DEFAULT_OG_IMAGE = {
  url: '/assets/fifth-avenue-og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'FIFTH AVENUE - Best Street Food in Vehari, Pakistan',
  type: 'image/jpeg',
};

// =============================================
// COMPREHENSIVE FAQ DATA (For Schema + Page)
// =============================================
export const FAQ_DATA = [
  {
    question: 'What is Fifth Avenue?',
    answer: 'Fifth Avenue (Urban Street Hub) is a premium fast food restaurant in Vehari, Punjab, Pakistan. We specialize in artisan pizzas, crispy broast chicken, gourmet burgers, and signature street food. Known as the top dining destination in Vehari for our high-energy atmosphere and premium quality.',
  },
  {
    question: 'Where is Fifth Avenue located in Vehari?',
    answer: 'Fifth Avenue is located in Faisal Town, Vehari, Punjab, Pakistan (postal code 61100). We are the central hub for street food enthusiasts in the city.',
  },
  {
    question: 'What is on the Fifth Avenue menu?',
    answer: 'The Fifth Avenue menu includes artisan pizzas, crispy broast chicken, zinger burgers, spicy wings, loaded fries, and exclusive urban meal deals. View our full menu with prices at fifthavenue.pk/menu.',
  },
];

// Generate base metadata
export function generateBaseMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} | Chasing Flavours`,
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
      title: `${SITE_NAME} | Chasing Flavours`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - Chasing Flavours`,
      description: SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE.url],
      creator: '@fifthavenue',
      site: '@fifthavenue',
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
    title: `${SITE_NAME} | Bold Street Food & Fast Delivery`,
    description: `${SITE_NAME} serves bold street food with signature flavour, fresh quality, and fast delivery.`,
    keywords: [...BRAND_KEYWORDS, ...PRIMARY_KEYWORDS, 'home delivery', 'food order online', 'vehari restaurant', 'fifth avenue vehari menu', 'fifth avenue menu'],
    openGraph: {
      title: `${SITE_NAME} - Chasing Flavours | Best Street Food & Delivery`,
      description: `${SITE_NAME} serves bold street food and signature flavour with fast delivery.`,
      url: SITE_URL,
      images: [DEFAULT_OG_IMAGE],
    },
  }),

  menu: (): Metadata => generateBaseMetadata({
    title: `${SITE_NAME} Menu - Full Menu with Prices | Broast, Pizza & Deals in Vehari`,
    description: `${SITE_NAME} Vehari Menu - Explore our full menu: Artisan pizzas, crispy injected broast, burgers, and meal deals. View prices and order online for fast delivery!`,
    keywords: [
      'fifth avenue menu', 'fifth avenue vehari menu', 'pizza menu vehari', 'broast menu vehari',
      'fifth avenue price list', 'fast food menu vehari',
    ],
    openGraph: {
      title: `${SITE_NAME} Menu - Full Food Menu with Prices | Vehari`,
      description: `View ${SITE_NAME} complete menu with prices. Pizza, broast chicken, burgers, and more in Vehari!`,
      url: `${SITE_URL}/menu`,
    },
    alternates: {
      canonical: `${SITE_URL}/menu`,
    },
  }),

  contact: (): Metadata => generateBaseMetadata({
    title: `${SITE_NAME} Contact - Location, Phone & Hours | Vehari`,
    description: `Contact ${SITE_NAME} Vehari. Address: Faisal Town. Phone: 0304-1116617. Open Daily 11AM-11PM. Fast delivery available in Vehari!`,
    keywords: [
      'fifth avenue contact', 'fifth avenue phone', 'fifth avenue location', 'fifth avenue address',
    ],
    openGraph: {
      title: `${SITE_NAME} Vehari - Contact, Location & Phone`,
      description: `Find ${SITE_NAME} at Faisal Town, Vehari. Call 0304-1116617 for orders!`,
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
      title: 'Your Cart - Fifth Avenue',
      description: 'Complete your food order. Fast delivery available!',
      url: `${SITE_URL}/cart`,
    },
    alternates: {
      canonical: `${SITE_URL}/cart`,
    },
  }),

  favorites: (): Metadata => generateBaseMetadata({
    title: 'My Favorites - Saved Items',
    description: 'Your favorite Fifth Avenue items saved for quick ordering. Reorder your loved dishes fast.',
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
    title: 'Fifth Avenue Loyalty Program - Earn Points & Unlock Rewards',
    description: 'Join the Fifth Avenue loyalty program. Earn points on every order and unlock exclusive rewards and discounts.',
    keywords: [
      'loyalty program', 'food rewards', 'earn points', 'free food',
      'discount codes', 'promo codes', 'customer rewards', 'special offers',
    ],
    openGraph: {
      title: 'Fifth Avenue Loyalty Program - Earn & Save',
      description: 'Earn points on every order. Get free meals & exclusive deals!',
      url: `${SITE_URL}/loyalty`,
    },
    alternates: {
      canonical: `${SITE_URL}/loyalty`,
    },
  }),

  reviews: (): Metadata => generateBaseMetadata({
    title: 'Fifth Avenue Reviews & Ratings - Customer Feedback',
    description: 'Read genuine customer reviews of Fifth Avenue and share your experience with our street-food favourites.',
    keywords: [
      'zoiro broast reviews', 'zoiro reviews', 'broast reviews vehari', 'customer ratings',
      'zoiro broast rating', 'vehari restaurant reviews', 'best rated restaurant vehari', 'zoiro broast feedback',
    ],
    openGraph: {
      title: 'Fifth Avenue Reviews - Customer Feedback',
      description: 'See what customers say about Fifth Avenue.',
      url: `${SITE_URL}/reviews`,
    },
    alternates: {
      canonical: `${SITE_URL}/reviews`,
    },
  }),

  terms: (): Metadata => generateBaseMetadata({
    title: 'Terms & Conditions',
    description: 'Fifth Avenue terms and conditions. Read about ordering policy, delivery terms, refund policy, and service agreements.',
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
    description: 'Fifth Avenue privacy policy. Learn how we protect your personal data, handle your information, and ensure secure transactions.',
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
    description: 'Track your Fifth Avenue orders in real-time. View order history and reorder your favorites easily.',
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
    priceRange: BUSINESS_INFO.priceRange,
    acceptsReservations: BUSINESS_INFO.acceptsReservations,
    paymentAccepted: BUSINESS_INFO.paymentMethods.join(', '),
    currenciesAccepted: 'PKR',
    sameAs: Object.values(SOCIAL_LINKS),
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
    alternateName: ['Fifth Avenue', 'Fifth Avenue Urban Hub', 'Fifth Avenue Vehari', 'Fifth Avenue Hub Vehari', 'Fifth Avenue Menu', 'Fifth Avenue Street Food', '5th Avenue Vehari', 'Fifth Avenue Hub', 'Fifth Avenue Restaurant'],
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
      url: `${SITE_URL}/assets/fifth_avenue_urban_logo_1777394607150.png`,
      width: 512,
      height: 512,
      caption: 'FIFTH AVENUE URBAN HUB Logo',
    },
    image: `${SITE_URL}/assets/fifth_avenue_urban_logo_1777394607150.png`,
    description: SITE_DESCRIPTION,
    foundingDate: BUSINESS_INFO.foundingDate,
    founders: [
      {
        '@type': 'Person',
        name: 'FIFTH AVENUE URBAN HUB Team',
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
    image: `${SITE_URL}/assets/fifth_avenue_urban_logo_1777394607150.png`,
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
      name: 'FIFTH AVENUE URBAN HUB Menu',
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
    '@id': `${SITE_URL}/#faq`,
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
    sku: product.sku || `FIFTH-AVENUE-${product.name.replace(/\s+/g, '-').toUpperCase()}`,
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
    name: 'Fifth Avenue Food Delivery Vehari',
    description: 'Fifth Avenue fast food delivery service in Vehari. Order premium street food, burgers, wings and more delivered to your doorstep. Best delivery in Vehari city.',
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
    generateFAQSchema(),
  ];
}
