'use client';

import dynamic from 'next/dynamic';
import type { SpecialOffer } from '@/types/offers';

// ssr: false must live in a Client Component — keeps OfferPopup out of SSR
// so CartProvider context is always available on the client before this renders.
const OfferPopup = dynamic(() => import('./OfferPopup'), { ssr: false });

interface OfferPopupClientProps {
  initialOffers: SpecialOffer[];
}

export default function OfferPopupClient({ initialOffers }: OfferPopupClientProps) {
  return <OfferPopup initialOffers={initialOffers} />;
}
