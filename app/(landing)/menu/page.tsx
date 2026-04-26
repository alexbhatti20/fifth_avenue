// =============================================
// MENU PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { getMenuData, getActiveOffers } from "@/lib/server-queries";
import MenuClient from "./MenuClient";
import type { SpecialOffer } from "@/types/offers";
import HeroOffersIndicator from "@/components/landing/HeroOffersIndicator";

// SEO Metadata - Optimized for top search queries
export const metadata: Metadata = {
  title: "Fifth Avenue Menu - Full Menu with Prices",
  description: "Explore the full Fifth Avenue menu with prices, signature mains, sides, and deals. Order online for fast delivery.",
  keywords: [
    "zoiro menu", "zoiro broast menu", "zoiro vehari menu", "zoiro broast vehari menu",
    "zoro broast menu", "zoiro broast price", "zoiro broast menu with prices",
    "broast menu vehari", "broasted chicken", "burgers", "wings", "fast food",
    "ZOIRO Injected Broast", "delivery", "zoiro deals", "zoiro chicken menu",
    "zoiro broast vehari", "zoiro broast", "zoiro food menu",
  ],
  openGraph: {
    title: "Fifth Avenue Menu - Full Menu with Prices",
    description: "View the complete Fifth Avenue menu with prices, featured dishes, and active deals.",
    type: "website",
  },
};

// This runs on the SERVER - data fetching is HIDDEN from browser
export default async function MenuPage() {
  // Fetch all menu data + active offers on the server (hidden from Network tab)
  const [{ categories, items, deals }, rawOffers] = await Promise.all([
    getMenuData(),
    getActiveOffers(),
  ]);

  const offers: SpecialOffer[] = Array.isArray(rawOffers)
    ? (rawOffers as SpecialOffer[])
    : ((rawOffers as any)?.offers ?? []);

  // Pass data to client component for interactivity
  return (
    <>
      <MenuClient
        initialCategories={categories}
        initialMenuItems={items}
        initialDeals={deals}
        initialOffers={offers}
      />
      {/* Fixed offers indicator - pass count to avoid redundant fetch */}
      <HeroOffersIndicator initialCount={offers.length} />
    </>
  );
}
