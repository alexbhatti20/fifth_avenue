import Script from 'next/script';
import { 
  generateRestaurantSchema, 
  generateWebsiteSchema, 
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateServiceSchema,
  generateHomePageSchema,
  generateProductSchema,
  generateOfferSchema,
  SITE_URL,
  SITE_NAME,
  FAQ_DATA,
} from '@/lib/seo';

interface JsonLdProps {
  type?: 'restaurant' | 'website' | 'local-business' | 'breadcrumb' | 'faq' | 'organization' | 'service' | 'home' | 'all';
  breadcrumbs?: { name: string; url: string }[];
  faqs?: { question: string; answer: string }[];
  product?: { name: string; description: string; price: number; image: string; category: string; };
}

export default function JsonLd({ type = 'all', breadcrumbs, faqs, product }: JsonLdProps) {
  let schemas: object[] = [];

  if (type === 'home' || type === 'all') {
    schemas = generateHomePageSchema();
  } else {
    if (type === 'restaurant') {
      schemas.push(generateRestaurantSchema());
    }
    if (type === 'website') {
      schemas.push(generateWebsiteSchema());
    }
    if (type === 'local-business') {
      schemas.push(generateLocalBusinessSchema());
    }
    if (type === 'organization') {
      schemas.push(generateOrganizationSchema());
    }
    if (type === 'service') {
      schemas.push(generateServiceSchema());
    }
    if (type === 'faq') {
      schemas.push(generateFAQSchema(faqs));
    }
    if (type === 'breadcrumb' && breadcrumbs) {
      schemas.push(generateBreadcrumbSchema(breadcrumbs));
    }
  }

  // Use single merged JSON-LD for better performance
  const mergedSchema = {
    '@context': 'https://schema.org',
    '@graph': schemas.map(s => {
      const { '@context': _, ...rest } = s as any;
      return rest;
    }),
  };

  return (
    <Script
      id="json-ld-merged"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(mergedSchema) }}
      strategy="beforeInteractive"
    />
  );
}

// Export individual schema components for specific pages
export function RestaurantJsonLd() {
  return (
    <Script
      id="restaurant-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateRestaurantSchema()) }}
      strategy="beforeInteractive"
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return (
    <Script
      id="breadcrumb-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(items)) }}
      strategy="beforeInteractive"
    />
  );
}

export function FAQJsonLd({ faqs }: { faqs?: { question: string; answer: string }[] }) {
  return (
    <Script
      id="faq-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(faqs || FAQ_DATA)) }}
      strategy="beforeInteractive"
    />
  );
}

export function ProductJsonLd({ product }: { product: { name: string; description: string; price: number; image: string; category: string; } }) {
  return (
    <Script
      id="product-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateProductSchema(product)) }}
      strategy="beforeInteractive"
    />
  );
}

export function OfferJsonLd({ offer }: { offer: { name: string; description: string; price: number; originalPrice?: number; } }) {
  return (
    <Script
      id="offer-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOfferSchema(offer)) }}
      strategy="beforeInteractive"
    />
  );
}
