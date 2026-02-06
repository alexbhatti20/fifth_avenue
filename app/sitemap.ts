import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const currentDate = new Date().toISOString();

  // Static pages with optimized priorities
  const staticPages: MetadataRoute.Sitemap = [
    // Homepage - Highest priority
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // Menu - Second highest (main conversion page)
    {
      url: `${baseUrl}/menu`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    // Contact - Important for local SEO
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Reviews - Social proof, important for SEO
    {
      url: `${baseUrl}/reviews`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    // Loyalty program
    {
      url: `${baseUrl}/loyalty`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Features page
    {
      url: `${baseUrl}/features`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Auth pages (lower priority but indexed)
    {
      url: `${baseUrl}/auth/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // Legal pages (required but low priority)
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Menu category pages (if they exist)
  const menuCategories = [
    'broast',
    'burgers',
    'wings',
    'deals',
    'combos',
    'sides',
    'beverages',
  ];

  const categoryPages: MetadataRoute.Sitemap = menuCategories.map((category) => ({
    url: `${baseUrl}/menu?category=${category}`,
    lastModified: currentDate,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Local SEO pages for Vehari areas
  const localPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/delivery/vehari`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/delivery/faisal-town`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.75,
    },
  ];

  return [...staticPages, ...categoryPages];
}
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Menu category pages (add dynamically if needed)
  const menuCategories = [
    'broast',
    'burgers',
    'wings',
    'deals',
    'beverages',
    'sides',
  ];

  const categoryPages: MetadataRoute.Sitemap = menuCategories.map((category) => ({
    url: `${baseUrl}/menu/${category}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...categoryPages];
}
