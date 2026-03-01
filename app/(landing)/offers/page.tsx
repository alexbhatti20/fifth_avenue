// =============================================
// OFFERS PAGE - SERVER COMPONENT (SSR)
// Fetches active offers on the server using RPC
// HIDDEN from browser Network tab - Zero client waterfalls
// =============================================

import { Metadata } from "next";
import { getActiveOffers } from "@/lib/server-queries";
import OffersClient from "./OffersClient";
import type { SpecialOffer } from "@/types/offers";

export const revalidate = 300; // 5 minutes SSR cache (matches RPC cache)

export const metadata: Metadata = {
  title: "Zoiro Broast Offers & Deals - Hot Discounts | Vehari",
  description:
    "Best offers & discounts at Zoiro Broast Vehari. Get up to 50% off on broasted chicken, burgers, wings & family deals. Limited time offers – grab them now!",
  keywords: [
    "zoiro offers", "zoiro deals", "zoiro discount", "zoiro broast deals",
    "zoiro broast vehari offers", "broast discount vehari", "fast food deals vehari",
    "zoiro special offers", "zoiro coupon", "zoiro promo",
  ],
  openGraph: {
    title: "Zoiro Broast Hot Offers & Deals – Limited Time!",
    description:
      "Exclusive discounts on our crispy broasted chicken, burgers, wings & more. Grab Zoiro Broast deals before they expire!",
    type: "website",
  },
};

export default async function OffersPage() {
  // Fetch active offers via SSR – uses the existing `get_active_offers_with_deals` RPC
  // This runs on the server so credentials & queries are never exposed to the browser
  const rawOffers = await getActiveOffers();

  // Normalise – the RPC can return either an array or wrapped object
  const offers: SpecialOffer[] = Array.isArray(rawOffers)
    ? (rawOffers as SpecialOffer[])
    : ((rawOffers as any)?.offers ?? []);

  return <OffersClient offers={offers} />;
}
