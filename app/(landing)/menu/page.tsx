// =============================================
// MENU PAGE - SERVER COMPONENT (SSR)
// Data is fetched on the server - HIDDEN from browser Network tab
// =============================================

import { Metadata } from "next";
import { getMenuData } from "@/lib/server-queries";
import MenuClient from "./MenuClient";

// SEO Metadata
export const metadata: Metadata = {
  title: "Menu | ZOIRO Injected Broast - Fresh & Delicious",
  description: "Explore our signature broasted chicken, juicy burgers, crispy wings, and more. Made fresh with premium ingredients. Order online for delivery or pickup.",
  keywords: ["menu", "broasted chicken", "burgers", "wings", "fast food", "ZOIRO Injected Broast", "delivery"],
  openGraph: {
    title: "Menu | ZOIRO Injected Broast",
    description: "Explore our signature broasted chicken, juicy burgers, crispy wings, and more.",
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
