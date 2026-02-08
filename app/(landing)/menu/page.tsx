// =============================================
// MENU PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { getMenuData } from "@/lib/server-queries";
import MenuClient from "./MenuClient";

// SEO Metadata - Optimized for top search queries
export const metadata: Metadata = {
  title: "Zoiro Broast Menu - Full Menu with Prices | Broast, Burgers, Wings & Deals Vehari",
  description: "Zoiro Broast Vehari Menu - View our complete menu with prices. Crispy broast chicken, zinger burgers, spicy wings, family buckets & deals. Order online for fast delivery in Vehari. ZOIRO Injected Broast menu.",
  keywords: [
    "zoiro menu", "zoiro broast menu", "zoiro vehari menu", "zoiro broast vehari menu",
    "zoro broast menu", "zoiro broast price", "zoiro broast menu with prices",
    "broast menu vehari", "broasted chicken", "burgers", "wings", "fast food",
    "ZOIRO Injected Broast", "delivery", "zoiro deals", "zoiro chicken menu",
    "zoiro broast vehari", "zoiro broast", "zoiro food menu",
  ],
  openGraph: {
    title: "Zoiro Broast Menu - Full Menu with Prices | Vehari",
    description: "Zoiro Broast Vehari - View our complete broast menu with prices. Crispy chicken, burgers, wings, deals & more!",
    type: "website",
  },
};

// This runs on the SERVER - data fetching is HIDDEN from browser
export default async function MenuPage() {
  // Fetch all menu data on the server (hidden from Network tab)
  const { categories, items, deals } = await getMenuData();

  // Pass data to client component for interactivity
  return (
    <MenuClient
      initialCategories={categories}
      initialMenuItems={items}
      initialDeals={deals}
    />
  );
}
