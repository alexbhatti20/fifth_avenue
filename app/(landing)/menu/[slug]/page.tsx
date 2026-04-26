import { Metadata } from 'next';
import { getMenuCategories, getMenuItemsByCategory } from '@/lib/queries';
import { notFound } from 'next/navigation';

// ISR for menu pages - revalidate every hour
export const revalidate = 3600;

// Generate static params for all categories at build time
export async function generateStaticParams() {
  const categories = await getMenuCategories();
  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getMenuCategories();
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return {
      title: 'Menu - Fifth Avenue',
    };
  }

  return {
    title: `${category.name} - Fifth Avenue Menu`,
    description: `Browse our ${category.name} menu. Order online for delivery or pickup.`,
  };
}

export default async function MenuCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Parallel fetch with multi-layer caching
  const [categories, items] = await Promise.all([
    getMenuCategories(),
    getMenuItemsByCategory(slug),
  ]);

  const currentCategory = categories.find((c) => c.slug === slug);

  if (!currentCategory) {
    notFound();
  }

  return (
    <main className="menu-page">
      {/* Category navigation */}
      <nav className="category-nav">
        {categories.map((category) => (
          <a
            key={category.id}
            href={`/menu/${category.slug}`}
            className={category.slug === slug ? 'active' : ''}
          >
            {category.name}
          </a>
        ))}
      </nav>

      {/* Menu items grid */}
      <section className="menu-items">
        <h1>{currentCategory.name}</h1>
        <div className="items-grid">
          {items.map((item) => (
            <div key={item.id} className="menu-item-card">
              {item.images && item.images[0] && (
                <img src={item.images[0]} alt={item.name} />
              )}
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="item-footer">
                <span className="price">${item.price}</span>
                <button className="add-to-cart">Add to Cart</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
