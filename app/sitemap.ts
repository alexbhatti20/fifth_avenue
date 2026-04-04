import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const currentDate = new Date().toISOString();

  // Keep sitemap focused on canonical, indexable public pages only.
  const pages: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
  }> = [
    { path: '', changeFrequency: 'daily', priority: 1.0 },
    { path: '/menu', changeFrequency: 'daily', priority: 0.95 },
    { path: '/offers', changeFrequency: 'daily', priority: 0.9 },
    { path: '/book-online', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/reviews', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/loyalty', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/features', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return pages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: currentDate,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
