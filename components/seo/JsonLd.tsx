import Script from 'next/script';
import { 
  generateRestaurantSchema, 
  generateWebsiteSchema, 
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  SITE_URL,
  SITE_NAME
} from '@/lib/seo';

interface JsonLdProps {
  type?: 'restaurant' | 'website' | 'local-business' | 'breadcrumb' | 'faq' | 'all';
  breadcrumbs?: { name: string; url: string }[];
  faqs?: { question: string; answer: string }[];
}

export default function JsonLd({ type = 'all', breadcrumbs, faqs }: JsonLdProps) {
  const schemas: object[] = [];

  if (type === 'all' || type === 'restaurant') {
    schemas.push(generateRestaurantSchema());
  }

  if (type === 'all' || type === 'website') {
    schemas.push(generateWebsiteSchema());
  }

  if (type === 'all' || type === 'local-business') {
    schemas.push(generateLocalBusinessSchema());
  }

  if (type === 'breadcrumb' && breadcrumbs) {
    schemas.push(generateBreadcrumbSchema(breadcrumbs));
  }

  if (type === 'faq' && faqs) {
    schemas.push(generateFAQSchema(faqs));
  }

  // Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/assets/zoiro-logo.png`,
      width: 512,
      height: 512,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+92-304-629-2822',
      contactType: 'customer service',
      availableLanguage: ['English', 'Urdu'],
      areaServed: 'PK',
    },
    sameAs: [
      'https://facebook.com/zoirobroast',
      'https://instagram.com/zoirobroast',
    ],
  };

  if (type === 'all') {
    schemas.push(organizationSchema);
  }

  return (
    <>
      {schemas.map((schema, index) => (
        <Script
          key={index}
          id={`json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          strategy="afterInteractive"
        />
      ))}
    </>
  );
}

// Export individual schema components for specific pages
export function RestaurantJsonLd() {
  return (
    <Script
      id="restaurant-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateRestaurantSchema()) }}
      strategy="afterInteractive"
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return (
    <Script
      id="breadcrumb-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(items)) }}
      strategy="afterInteractive"
    />
  );
}

export function FAQJsonLd({ faqs }: { faqs: { question: string; answer: string }[] }) {
  return (
    <Script
      id="faq-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(faqs)) }}
      strategy="afterInteractive"
    />
  );
}
