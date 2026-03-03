import { getActiveOffers } from "@/lib/server-queries";
import HeroOffersIndicatorClient from "./HeroOffersIndicatorClient";
import type { SpecialOffer } from "@/types/offers";

interface HeroOffersIndicatorProps {
  /** Pre-computed count to skip redundant fetch when parent already has offers */
  initialCount?: number;
}

export default async function HeroOffersIndicator({ initialCount }: HeroOffersIndicatorProps = {}) {
  // Use provided count if available, otherwise fetch
  let count = initialCount;
  
  if (count === undefined) {
    const rawOffers = await getActiveOffers();
    const offers: SpecialOffer[] = Array.isArray(rawOffers)
      ? (rawOffers as SpecialOffer[])
      : ((rawOffers as any)?.offers ?? []);
    count = offers.length;
  }
  
  if (count === 0) return null;
  return <HeroOffersIndicatorClient count={count} />;
}
