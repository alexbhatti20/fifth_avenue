import { 
  generateRestaurantSchema, 
  generateWebsiteSchema, 
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateServiceSchema,
  generateHomePageSchema,
  generateProductSchema,
  generateOfferSchema,
  SITE_URL,
  SITE_NAME,
} from '@/lib/seo';

interface JsonLdProps {
  type?: 'restaurant' | 'website' | 'local-business' | 'breadcrumb' | 'organization' | 'service' | 'home' | 'all';
  breadcrumbs?: { name: string; url: string }[];
  product?: { name: string; description: string; price: number; image: string; category: string; };
}

function JsonLdScript({ id, schema }: { id: string; schema: object }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function JsonLd({ type = 'all', breadcrumbs, product }: JsonLdProps) {
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
    if (type === 'breadcrumb' && breadcrumbs) {
      schemas.push(generateBreadcrumbSchema(breadcrumbs));
    }
  }

  const dedupedSchemas = schemas.filter((schema, index, array) => {
    const current = schema as { '@type'?: string; '@id'?: string };
    const currentType = current['@type'];
    const currentId = current['@id'];

    // Keep only one FAQPage even if multiple sources try to inject it.
    if (currentType === 'FAQPage') {
      return array.findIndex((s) => (s as { '@type'?: string })['@type'] === 'FAQPage') === index;
    }

    if (currentId) {
      return array.findIndex((s) => (s as { '@id'?: string })['@id'] === currentId) === index;
    }

    return true;
  });

  // Use single merged JSON-LD for better performance
  const mergedSchema = {
    '@context': 'https://schema.org',
    '@graph': dedupedSchemas.map(s => {
      const { '@context': _, ...rest } = s as any;
      return rest;
    }),
  };

  return <JsonLdScript id="json-ld-merged" schema={mergedSchema} />;
}

// Export individual schema components for specific pages
export function RestaurantJsonLd() {
  return <JsonLdScript id="restaurant-json-ld" schema={generateRestaurantSchema()} />;
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return <JsonLdScript id="breadcrumb-json-ld" schema={generateBreadcrumbSchema(items)} />;
}

export function ProductJsonLd({ product }: { product: { name: string; description: string; price: number; image: string; category: string; } }) {
  return <JsonLdScript id="product-json-ld" schema={generateProductSchema(product)} />;
}

export function OfferJsonLd({ offer }: { offer: { name: string; description: string; price: number; originalPrice?: number; } }) {
  return <JsonLdScript id="offer-json-ld" schema={generateOfferSchema(offer)} />;
}
