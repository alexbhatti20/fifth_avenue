import { Metadata } from 'next';
import { getMenuCategories, getActiveDeals, getSiteContent } from '@/lib/queries';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';

// ISR Home Page - Revalidate every 30 minutes
export const revalidate = 1800;

export const metadata: Metadata = pageMetadata.home();

export default async function Home() {
  // Parallel data fetching with multi-layer cache
  const [heroContent, categories, deals] = await Promise.all([
    getSiteContent('hero'),
    getMenuCategories(),
    getActiveDeals(),
  ]);

  return (
    <main>
      {/* Static sections - server rendered once, cached */}
      <section className="hero">
        <h1>{heroContent?.content?.title}</h1>
        <p>{heroContent?.content?.subtitle}</p>
      </section>

      {/* Deals section - cached, revalidated every 30 min */}
      <section className="deals">
        <h2>Today's Special Deals</h2>
        <div className="deals-grid">
          {deals.map((deal) => (
            <div key={deal.id} className="deal-card">
              <h3>{deal.name}</h3>
              <p>{deal.description}</p>
              <div className="pricing">
                <span className="original">${deal.original_price}</span>
                <span className="discounted">${deal.discounted_price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories - heavily cached */}
      <section className="categories">
        <h2>Browse Menu</h2>
        <div className="categories-grid">
          {categories.map((category) => (
            <a 
              key={category.id} 
              href={`/menu/${category.slug}`}
              className="category-card"
            >
              <h3>{category.name}</h3>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
