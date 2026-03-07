import { Metadata } from 'next';
import { getMenuCategories, getActiveDeals, getSiteContent } from '@/lib/queries';
import { getActiveOffers } from '@/lib/server-queries';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import Hero from '@/components/custom/Hero';
import FeaturedMenu from '@/components/custom/FeaturedMenu';
import About from '@/components/custom/About';
import Reviews from '@/components/custom/Reviews';
import LocationSection from '@/components/custom/LocationSection';
import HeroOffersIndicator from '@/components/landing/HeroOffersIndicator';

// ISR Home Page - Revalidate every 30 minutes
export const revalidate = 1800;

export const metadata: Metadata = pageMetadata.home();

export default async function Home() {
  const [heroContent, categories, deals] = await Promise.all([
    getSiteContent('hero'),
    getMenuCategories(),
    getActiveDeals(),
  ]);

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', url: SITE_URL }]} />
      <main>
        <Hero />
        <FeaturedMenu />
        <About />
        <Reviews />
        <LocationSection />
      </main>
      {/* Fixed offers indicator – SSR fetched, shows only when offers exist */}
      <HeroOffersIndicator />
    </>
  );
}
