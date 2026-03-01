import { getActiveOffers } from "@/lib/server-queries";
import HeroOffersIndicatorClient from "./HeroOffersIndicatorClient";
import type { SpecialOffer } from "@/types/offers";

export default async function HeroOffersIndicator() {
  const rawOffers = await getActiveOffers();
  const offers: SpecialOffer[] = Array.isArray(rawOffers)
    ? (rawOffers as SpecialOffer[])
    : ((rawOffers as any)?.offers ?? []);
  const count = offers.length;
  if (count === 0) return null;
  return <HeroOffersIndicatorClient count={count} />;
}
