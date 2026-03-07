'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, ArrowRight, Flame, Tag, ChevronLeft, ChevronRight, ShoppingCart, CheckCircle2, LogIn, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import type { SpecialOffer, SpecialOfferItem, SpecialOfferDeal } from '@/types/offers';
import Link from 'next/link';
import Image from 'next/image';

interface OfferPopupProps {
  onClose?: () => void;
  initialOffers?: SpecialOffer[];
}

export default function OfferPopup({ onClose, initialOffers = [] }: OfferPopupProps) {
  const [offers, setOffers] = useState<SpecialOffer[]>(initialOffers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);
  const [progress, setProgress] = useState(100);
  const [orderAdded, setOrderAdded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const totalTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const { addToCart, applyOffer } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Hide popup when the mobile nav drawer opens
  useEffect(() => {
    const handler = (e: Event) => setIsDrawerOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener('zoiro:drawer', handler);
    return () => window.removeEventListener('zoiro:drawer', handler);
  }, []);

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
  }, []);

  // Load active offers with a 3-second delay so page loads first
  // Skip fetch if SSR provided initialOffers
  useEffect(() => {
    // Check if user has seen popup in this session
    const seen = sessionStorage.getItem('zoiro_offer_popup_seen');
    if (seen) {
      setHasSeenPopup(true);
      return;
    }

    // If we have SSR offers, use them directly without fetching
    if (initialOffers.length > 0) {
      // Show popup with a 3-second delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
        // Desktop starts expanded, mobile starts collapsed
        setIsCollapsed(window.innerWidth < 640);
        const autoClose = initialOffers[0]?.popup_auto_close_seconds || 8;
        if (autoClose > 0) {
          setTimeLeft(autoClose);
          totalTimeRef.current = autoClose;
          startTimeRef.current = Date.now();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Fallback: fetch client-side if no SSR data (shouldn't happen normally)
    const loadOffers = async () => {
      try {
        const { data, error } = await supabase.rpc('get_active_offers', {
          p_include_items: true,
          p_for_popup: true,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setOffers(data);
          // Show popup with a 3-second delay for better UX
          setTimeout(() => {
            setIsVisible(true);
            // Desktop starts expanded, mobile starts collapsed
            setIsCollapsed(window.innerWidth < 640);
            const autoClose = data[0]?.popup_auto_close_seconds || 8;
            if (autoClose > 0) {
              setTimeLeft(autoClose);
              totalTimeRef.current = autoClose;
              startTimeRef.current = Date.now();
            }
          }, 3000);
        }
      } catch (error) {
        console.error('Error loading offers:', error);
      }
    };

    loadOffers();
  }, [initialOffers]);

  // Close handler — defined before any effect that references it
  const handleClose = useCallback(() => {
    setIsVisible(false);
    sessionStorage.setItem('zoiro_offer_popup_seen', 'true');
    setHasSeenPopup(true);
    onClose?.();
  }, [onClose]);

  // Auto-close countdown — pause when collapsed
  // Depends on isVisible (starts timer) and isCollapsed (pause/resume).
  // timeLeft is intentionally excluded: the interval computes remaining time
  // from wall-clock refs so it doesn't need to restart on every tick.
  useEffect(() => {
    if (!isVisible || !startTimeRef.current || !totalTimeRef.current || isCollapsed) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      const total = totalTimeRef.current!;
      const remaining = Math.max(0, total - elapsed);
      const pct = (remaining / total) * 100;

      setTimeLeft(Math.ceil(remaining));
      setProgress(pct);

      if (remaining <= 0) {
        clearInterval(interval);
        handleClose();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isVisible, isCollapsed, handleClose]);

  // Confetti effect — desktop only, single lightweight burst
  useEffect(() => {
    if (!isVisible || offers.length === 0 || isMobile) return;
    const currentOffer = offers[currentIndex];
    if (!currentOffer?.confetti_enabled) return;
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 60, spread: 55, origin: { x: 0.15, y: 0.2 } });
    });
  }, [isVisible, currentIndex, offers, isMobile]);

  // Track click
  const handleOfferClick = async (offer: SpecialOffer) => {
    try {
      await supabase.rpc('track_offer_click', { p_offer_id: offer.id });
    } catch {
      // Silent fail
    }
  };

  // Add all offer items/deals to cart then navigate
  const handleGrabDeal = async (offer: SpecialOffer) => {
    await handleOfferClick(offer);

    let addedCount = 0;
    const summaryLines: string[] = [];

    // Helper: resolve a safe price (never 0)
    const safePrice = (offerPrice: number, originalPrice: number) =>
      offerPrice > 0 ? offerPrice : originalPrice > 0 ? originalPrice : undefined;

    // Add every item included in the offer
    if (offer.items && offer.items.length > 0) {
      offer.items.forEach((item: SpecialOfferItem) => {
        if (!item.menu_item_id) return;
        const offerPrice = safePrice(item.offer_price, item.original_price);
        if (!offerPrice) return;

        // Resolve the correct size: use the offer's specified size_variant if set,
        // otherwise auto-pick the first available size for items with variants.
        const menuItem = item.menu_item;
        const hasVariants = menuItem?.has_variants || (menuItem?.size_variants && menuItem.size_variants.length > 0);
        let resolvedSize: string | undefined = item.size_variant ?? undefined;
        if (!resolvedSize && hasVariants && menuItem?.size_variants) {
          const firstAvailable = menuItem.size_variants.find(v => v.is_available !== false);
          resolvedSize = firstAvailable?.size;
        }

        addToCart(
          {
            id: item.menu_item_id,
            name: menuItem?.name ?? 'Item',
            slug: menuItem?.slug,
            description: menuItem?.description,
            price: offerPrice,
            originalPrice: item.original_price > offerPrice ? item.original_price : undefined,
            image: menuItem?.images?.[0],
            images: menuItem?.images,
            is_available: true,
            has_variants: hasVariants ?? false,
            size_variants: menuItem?.size_variants,
          },
          resolvedSize,
          offerPrice
        );
        const itemName = menuItem?.name ?? 'Item';
        const sizeSuffix = resolvedSize ? ` (${resolvedSize})` : '';
        const priceLine = item.original_price > offerPrice
          ? `${itemName}${sizeSuffix}: Rs.${item.original_price} → Rs.${offerPrice}`
          : `${itemName}${sizeSuffix}: Rs.${offerPrice}`;
        summaryLines.push(priceLine);
        addedCount++;
      });
    }

    // Add every deal included in the offer
    if (offer.deals && offer.deals.length > 0) {
      offer.deals.forEach((deal: SpecialOfferDeal) => {
        if (!deal.deal_id) return;
        const price = safePrice(deal.offer_price, deal.original_price);
        if (!price) return;
        addToCart(
          {
            id: `deal-${deal.deal_id}`,
            name: deal.deal?.name ?? 'Deal',
            slug: deal.deal?.slug,
            price,
            originalPrice: deal.original_price > price ? deal.original_price : undefined,
            image: deal.deal?.image,
            is_available: true,
          },
          undefined,
          price
        );
        const dealLine = deal.original_price > price
          ? `${deal.deal?.name ?? 'Deal'}: Rs.${deal.original_price} → Rs.${price}`
          : `${deal.deal?.name ?? 'Deal'}: Rs.${price}`;
        summaryLines.push(dealLine);
        addedCount++;
      });
    }

    if (addedCount > 0) {
      const shownLines = summaryLines.slice(0, 3);
      const extra = summaryLines.length > 3 ? ` +${summaryLines.length - 3} more` : '';
      toast({
        title: `🛒 ${addedCount} item${addedCount > 1 ? 's' : ''} added to cart!`,
        description: shownLines.join('\n') + extra,
      });
    } else if (offer.discount_type === 'percentage' || offer.discount_type === 'fixed_amount') {
      // Storewide discount — apply to cart total
      applyOffer({
        id: offer.id,
        name: offer.name,
        discount_type: offer.discount_type as 'percentage' | 'fixed_amount',
        discount_value: Number(offer.discount_value),
        max_discount_amount: offer.max_discount_amount,
      });
      toast({
        title: `🔥 ${offer.name} applied!`,
        description: offer.discount_type === 'percentage'
          ? `${offer.discount_value}% off your entire order.`
          : `Rs. ${offer.discount_value} off your order.`,
      });
    } else {
      toast({
        title: `${offer.name} applied!`,
        description: 'Browse the menu to place your order with the discount.',
      });
    }

    setOrderAdded(true);
    handleClose();

    setTimeout(() => {
      router.push(addedCount > 0 ? '/cart' : '/menu');
    }, 400);
  };

  const formatTimeLeft = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Ending soon!';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h left`;
    return 'Ending soon!';
  };

  if (hasSeenPopup || !isVisible || offers.length === 0) return null;

  const offer = offers[currentIndex];
  const isLava = !offer.pakistani_flags;
  const bgStyle = isLava
    ? { background: offer.theme_colors?.primary ? `linear-gradient(135deg, ${offer.theme_colors.primary} 0%, #7f1d1d 100%)` : 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' }
    : { background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)' };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -60, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className={cn('fixed top-4 left-4 z-[100] w-[calc(100vw-2rem)] max-w-[320px] sm:max-w-[340px] transition-opacity duration-200', isDrawerOpen && 'opacity-0 pointer-events-none')}
        >
          <div
            className="relative rounded-2xl shadow-2xl overflow-hidden border border-white/20"
            style={bgStyle}
          >
            {/* Progress bar (auto-close, only when expanded) */}
            {!isCollapsed && timeLeft !== null && timeLeft > 0 && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-20">
                <div
                  className="h-full bg-yellow-400"
                  style={{ width: `${progress}%`, transition: 'width 0.2s linear' }}
                />
              </div>
            )}

            {/* ── COLLAPSED HEADER (always visible) ── */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className={cn('flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center', isLava ? 'bg-orange-500/30' : 'bg-white/20')}>
                <Flame className="h-4 w-4 text-yellow-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate leading-tight">{offer.name}</p>
                <p className={cn('text-xs font-semibold', isLava ? 'text-orange-300' : 'text-green-300')}>
                  {offer.discount_type === 'percentage' ? `${offer.discount_value}% OFF` : `Rs ${offer.discount_value} OFF`}
                  {' · '}
                  <span className="text-white/60">{formatTimeLeft(offer.end_date)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsCollapsed(c => !c)}
                className="flex-shrink-0 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── EXPANDED CONTENT ── */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key="expanded"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-3 pb-3 space-y-3">
                    {/* Banner image */}
                    {offer.banner_image && (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/15">
                        <Image src={offer.banner_image} alt={offer.name} fill className="object-cover" />
                      </div>
                    )}

                    {/* Description */}
                    {offer.description && (
                      <p className="text-white/75 text-xs leading-relaxed line-clamp-2">
                        {offer.description}
                      </p>
                    )}

                    {/* Discount pill */}
                    <div className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-white text-sm font-extrabold',
                      isLava ? 'bg-orange-500/25 border-orange-400/30' : 'bg-white/15 border-white/20'
                    )}>
                      <Gift className="h-3.5 w-3.5 text-yellow-300 flex-shrink-0" />
                      {offer.discount_type === 'percentage' ? `${offer.discount_value}% OFF` : `Rs ${offer.discount_value} OFF`}
                      {offer.min_order_amount && <span className="text-[10px] text-white/50 font-normal ml-0.5">min Rs {offer.min_order_amount}</span>}
                    </div>

                    {/* Items preview */}
                    {offer.items && offer.items.length > 0 && (
                      <div>
                        <p className="text-[10px] text-white/50 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" /> Items
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {offer.items.slice(0, isMobile ? 3 : 4).map((item) => (
                            <div key={item.id} className={cn('flex-shrink-0 w-16 rounded-lg p-1.5 text-center border', isLava ? 'bg-black/20 border-orange-500/20' : 'bg-white/10 border-white/20')}>
                              {item.menu_item?.images?.[0] && (
                                <div className="relative w-full aspect-square rounded-md overflow-hidden mb-1">
                                  <Image src={item.menu_item.images[0]} alt={item.menu_item.name} fill className="object-cover" />
                                </div>
                              )}
                              <p className="text-[9px] truncate font-semibold text-white">{item.menu_item?.name}</p>
                              <p className="text-yellow-300 text-[9px] font-bold">Rs {item.offer_price}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CTA buttons */}
                    {isAuthenticated === false ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { handleClose(); router.push('/login'); }}
                          className={cn('flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white', isLava ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-white/20')}
                        >
                          <LogIn className="h-3 w-3" /> Login
                        </button>
                        <button
                          onClick={() => { handleClose(); router.push('/register'); }}
                          className="flex-1 py-2 rounded-xl text-xs font-bold border border-white/25 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <UserPlus className="h-3 w-3" /> Register
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGrabDeal(offer)}
                          className={cn(
                            'flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white transition-all',
                            orderAdded
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                              : isLava
                              ? 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_2px_12px_rgba(220,38,38,0.5)]'
                              : 'bg-white/25 hover:bg-white/35'
                          )}
                        >
                          {orderAdded
                            ? <><CheckCircle2 className="h-3 w-3" /> Added!</>
                            : <><ShoppingCart className="h-3 w-3" /> Grab Deal <ArrowRight className="h-3 w-3" /></>
                          }
                        </button>
                        <button
                          onClick={handleClose}
                          className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          Later
                        </button>
                      </div>
                    )}

                    {/* Multi-offer navigation */}
                    {offers.length > 1 && (
                      <div className="flex items-center justify-between">
                        <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center gap-1">
                          {offers.map((_, idx) => (
                            <button key={idx} onClick={() => setCurrentIndex(idx)} className={cn('rounded-full transition-all', idx === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50')} />
                          ))}
                        </div>
                        <button onClick={() => setCurrentIndex(i => Math.min(offers.length - 1, i + 1))} disabled={currentIndex === offers.length - 1} className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="text-center">
                      <Link href="/offers" onClick={handleClose} className="text-[10px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">
                        View all offers →
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
