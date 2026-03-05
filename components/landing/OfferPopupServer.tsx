import { getPopupOffers } from "@/lib/server-queries";
import OfferPopupClient from "./OfferPopupClient";
import type { SpecialOffer } from "@/types/offers";

/**
 * Server component wrapper for OfferPopup.
 * Fetches popup offers via SSR (cached) and passes to client component.
 */
export default async function OfferPopupServer() {
  const rawOffers = await getPopupOffers();
  const offers: SpecialOffer[] = Array.isArray(rawOffers)
    ? (rawOffers as SpecialOffer[])
    : ((rawOffers as any)?.offers ?? []);

  // Don't render popup wrapper if no offers
  if (offers.length === 0) return null;

  return <OfferPopupClient initialOffers={offers} />;
}
