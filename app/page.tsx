import { Metadata } from 'next';
import { getMenuCategories, getActiveDeals, getSiteContent } from '@/lib/queries';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import Hero from '@/components/custom/Hero';
import FeaturedMenu from '@/components/custom/FeaturedMenu';
import About from '@/components/custom/About';
import Reviews from '@/components/custom/Reviews';
import LocationSection from '@/components/custom/LocationSection';
import Footer from '@/components/custom/Footer';
import Navbar from '@/components/custom/Navbar';

// ISR Home Page - Revalidate every 30 minutes
export const revalidate = 1800;

export const metadata: Metadata = pageMetadata.home();

export default async function Page() {
  const [heroContent, categories, deals] = await Promise.all([
    getSiteContent('hero'),
    getMenuCategories(),
    getActiveDeals(),
  ]);

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', url: SITE_URL }]} />
      <Navbar />
      <main>
        <Hero />
        <FeaturedMenu />
        <About />
        <Reviews />
        <LocationSection />
      </main>
      <Footer />
    </>
  );
}
