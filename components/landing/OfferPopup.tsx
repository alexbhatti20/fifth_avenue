'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { X, Gift, Clock, ArrowRight, Sparkles, PartyPopper, Flame, Zap, Tag, ChevronLeft, ChevronRight, ShoppingCart, CheckCircle2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import type { SpecialOffer, SpecialOfferItem, SpecialOfferDeal } from '@/types/offers';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import Image from 'next/image';

interface OfferPopupProps {
  onClose?: () => void;
}

// Pre-built lava spark positions for the background effect
const LAVA_SPARKS = [
  { top: 10, left: 15, size: 3, delay: 0 },
  { top: 25, left: 80, size: 2, delay: 0.4 },
  { top: 45, left: 5, size: 4, delay: 0.8 },
  { top: 70, left: 90, size: 2, delay: 0.2 },
  { top: 85, left: 30, size: 3, delay: 0.6 },
  { top: 15, left: 55, size: 2, delay: 1.0 },
  { top: 60, left: 70, size: 3, delay: 0.3 },
  { top: 35, left: 40, size: 2, delay: 0.9 },
];

export default function OfferPopup({ onClose }: OfferPopupProps) {
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [orderAdded, setOrderAdded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const totalTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const { addToCart, applyOffer } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
  }, []);

  // Load active offers with a 3-second delay so page loads first
  useEffect(() => {
    const loadOffers = async () => {
      // Check if user has seen popup in this session
      const seen = sessionStorage.getItem('zoiro_offer_popup_seen');
      if (seen) {
        setHasSeenPopup(true);
        return;
      }

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
  }, []);

  // Auto-close countdown with smooth progress bar
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isDragging) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
      const total = totalTimeRef.current || 8;
      const remaining = Math.max(0, total - elapsed);
      const pct = (remaining / total) * 100;

      setTimeLeft(Math.ceil(remaining));
      setProgress(pct);

      if (remaining <= 0) {
        clearInterval(interval);
        handleClose();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeLeft, isDragging]);

  // Confetti effect
  useEffect(() => {
    if (!isVisible || offers.length === 0) return;

    const currentOffer = offers[currentIndex];
    if (!currentOffer?.confetti_enabled) return;

    // Fire confetti!
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const colors = currentOffer.pakistani_flags 
      ? ['#01411C', '#FFFFFF', '#FFD700'] // Pakistan colors
      : ['#dc2626', '#f97316', '#fbbf24', '#22c55e']; // Zoiro colors

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Burst in the center
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });
    }, 500);
  }, [isVisible, currentIndex, offers]);

  // Close handler
  const handleClose = useCallback(() => {
    setIsVisible(false);
    sessionStorage.setItem('zoiro_offer_popup_seen', 'true');
    setHasSeenPopup(true);
    onClose?.();
  }, [onClose]);

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
    const names: string[] = [];

    // Helper: resolve a safe price (never 0)
    const safePrice = (offerPrice: number, originalPrice: number) =>
      offerPrice > 0 ? offerPrice : originalPrice > 0 ? originalPrice : undefined;

    // Add every item included in the offer
    if (offer.items && offer.items.length > 0) {
      offer.items.forEach((item: SpecialOfferItem) => {
        if (!item.menu_item_id) return;
        const price = safePrice(item.offer_price, item.original_price);
        if (!price) return;
        addToCart(
          {
            id: item.menu_item_id,
            name: item.menu_item?.name ?? 'Item',
            slug: item.menu_item?.slug,
            description: item.menu_item?.description,
            price,
            originalPrice: item.original_price,
            image: item.menu_item?.images?.[0],
            images: item.menu_item?.images,
            is_available: true,
          },
          item.size_variant ?? undefined,
          price
        );
        names.push(item.menu_item?.name ?? 'Item');
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
            originalPrice: deal.original_price,
            image: deal.deal?.image,
            is_available: true,
          },
          undefined,
          price
        );
        names.push(deal.deal?.name ?? 'Deal');
        addedCount++;
      });
    }

    if (addedCount > 0) {
      toast({
        title: `🛒 ${addedCount} item${addedCount > 1 ? 's' : ''} added to cart!`,
        description: names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : ''),
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

  // Format time remaining
  const formatTimeRemaining = (endDate: string) => {
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return 'Ending soon!';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return 'Ending soon!';
  };

  if (hasSeenPopup || !isVisible || offers.length === 0) return null;

  const currentOffer = offers[currentIndex];
  const isLava = !currentOffer.pakistani_flags;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop with radial pulse */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          >
            {/* Radial glow behind modal */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(220,38,38,0.25) 0%, transparent 70%)',
              }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

          {/* Centering wrapper — keeps flex centering independent of framer-motion transforms */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.1}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(_, info) => {
                setIsDragging(false);
                if (Math.abs(info.offset.y) > 80) handleClose();
              }}
              className="pointer-events-auto w-full max-w-lg cursor-grab active:cursor-grabbing"
            >
            <div className="relative overflow-hidden rounded-3xl shadow-[0_0_60px_rgba(220,38,38,0.6)] border border-red-500/30">

              {/* === LAVA BACKGROUND LAYERS === */}
              {isLava ? (
                <>
                  {/* Base gradient */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: currentOffer.theme_colors?.primary
                        ? `linear-gradient(145deg, ${currentOffer.theme_colors.primary} 0%, #7f1d1d 60%, #1a0a00 100%)`
                        : 'linear-gradient(145deg, #dc2626 0%, #991b1b 35%, #7f1d1d 60%, #1a0a00 100%)',
                    }}
                  />
                  {/* Molten lava blobs */}
                  <motion.div
                    className="absolute -top-16 -left-16 w-64 h-64 rounded-full blur-3xl opacity-60 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, #dc2626 50%, transparent 80%)' }}
                    animate={{ x: [0, 20, -10, 0], y: [0, 15, -5, 0], scale: [1, 1.15, 0.95, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-50 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #fbbf24 0%, #ef4444 50%, transparent 80%)' }}
                    animate={{ x: [0, -25, 10, 0], y: [0, -20, 8, 0], scale: [1, 1.2, 0.9, 1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  />
                  <motion.div
                    className="absolute top-1/2 -left-10 w-48 h-48 rounded-full blur-2xl opacity-40 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #b45309 0%, transparent 70%)' }}
                    animate={{ x: [0, 30, 0], scale: [1, 1.3, 1] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                  />
                  {/* Hot crack lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                    <motion.path
                      d="M0,20% L15%,35% L10%,55% L25%,70% L20%,90%"
                      stroke="#fbbf24" strokeWidth="1" fill="none" strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 0.8, 0.3] }}
                      transition={{ duration: 3, delay: 0.5, ease: 'easeOut' }}
                    />
                    <motion.path
                      d="M100%,10% L88%,28% L92%,50% L80%,65% L85%,88%"
                      stroke="#f97316" strokeWidth="1" fill="none" strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 0.6, 0.2] }}
                      transition={{ duration: 3, delay: 0.8, ease: 'easeOut' }}
                    />
                  </svg>
                  {/* Floating sparks */}
                  {LAVA_SPARKS.map((spark, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        top: `${spark.top}%`,
                        left: `${spark.left}%`,
                        width: spark.size * 2,
                        height: spark.size * 2,
                        background: i % 2 === 0 ? '#fbbf24' : '#f97316',
                        boxShadow: `0 0 ${spark.size * 3}px ${i % 2 === 0 ? '#fbbf24' : '#f97316'}`,
                      }}
                      animate={{
                        y: [0, -30 - spark.size * 4, -60],
                        x: [0, (i % 2 === 0 ? 8 : -8)],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1, 0.2],
                      }}
                      transition={{
                        duration: 2 + spark.delay,
                        repeat: Infinity,
                        delay: spark.delay + i * 0.15,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </>
              ) : (
                /* Pakistan theme */
                <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-emerald-900" />
              )}

              {/* Pakistani Flags */}
              {currentOffer.pakistani_flags && (
                <div className="absolute top-0 left-0 right-0 flex justify-between px-4 pt-2 text-3xl z-10">
                  <span>🇵🇰</span><span>🇵🇰</span><span>🇵🇰</span>
                </div>
              )}

              {/* Top Progress Bar (auto-close) */}
              {timeLeft !== null && timeLeft > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
                  <motion.div
                    className={cn("h-full", isLava ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400" : "bg-white")}
                    style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
                  />
                </div>
              )}

              {/* Close Button */}
              <motion.button
                onClick={handleClose}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.35)' }}
                whileTap={{ scale: 0.95 }}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/20 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </motion.button>

              {/* Auto-close timer badge */}
              {timeLeft !== null && timeLeft > 0 && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-medium border border-white/10">
                  <Clock className="h-3 w-3 text-yellow-300" />
                  <span className="text-yellow-300">{timeLeft}s</span>
                </div>
              )}

              {/* ===== CONTENT ===== */}
              <div className="relative z-10 p-6 pt-14 sm:p-8 sm:pt-16 text-white">
                {/* Flame Icon */}
                {isLava && (
                  <motion.div
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    animate={{ y: [0, -4, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="flex items-center gap-0.5">
                      <Flame className="h-8 w-8 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
                      <Flame className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                      <Flame className="h-8 w-8 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
                    </div>
                  </motion.div>
                )}

                {/* Badges Row */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge className="bg-white/15 border border-white/20 text-white backdrop-blur-sm text-xs">
                    <Sparkles className="h-3 w-3 mr-1 text-yellow-300" />
                    {currentOffer.event_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Special Offer'}
                  </Badge>
                  <Badge className="bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTimeRemaining(currentOffer.end_date)}
                  </Badge>
                  {isLava && (
                    <Badge className="bg-red-900/50 border border-red-400/30 text-red-300 text-xs">
                      <Zap className="h-3 w-3 mr-1" /> Hot Deal
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 drop-shadow-lg">
                  <PartyPopper className="h-7 w-7 text-yellow-300 flex-shrink-0" />
                  {currentOffer.name}
                </h2>

                {/* Banner Image */}
                {currentOffer.banner_image && (
                  <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-4 border border-white/20 shadow-lg">
                    <Image
                      src={currentOffer.banner_image}
                      alt={currentOffer.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                )}

                {/* Description */}
                {currentOffer.description && (
                  <p className="text-white/80 mb-5 text-sm sm:text-base leading-relaxed">
                    {currentOffer.description}
                  </p>
                )}

                {/* Discount Badge - glowing */}
                <motion.div
                  className={cn(
                    "inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl mb-6 border",
                    isLava
                      ? "bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/40 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                      : "bg-white/20 border-white/30"
                  )}
                  animate={isLava ? { boxShadow: [
                    '0 0 20px rgba(249,115,22,0.4)',
                    '0 0 40px rgba(239,68,68,0.6)',
                    '0 0 20px rgba(249,115,22,0.4)',
                  ]} : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Gift className="h-5 w-5 text-yellow-300" />
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {currentOffer.discount_type === 'percentage'
                      ? `${currentOffer.discount_value}% OFF`
                      : `Rs ${currentOffer.discount_value} OFF`}
                  </span>
                  {currentOffer.min_order_amount && (
                    <span className="text-xs text-white/60 ml-1">
                      min Rs {currentOffer.min_order_amount}
                    </span>
                  )}
                </motion.div>

                {/* Offer Items Preview */}
                {currentOffer.items && currentOffer.items.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Tag className="h-3 w-3" /> Featured Items
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                      {currentOffer.items.slice(0, 4).map((item) => (
                        <motion.div
                          key={item.id}
                          whileHover={{ scale: 1.05, y: -2 }}
                          className={cn(
                            "flex-shrink-0 w-20 sm:w-24 rounded-xl p-2 text-center border",
                            isLava
                              ? "bg-black/20 border-orange-500/20"
                              : "bg-white/10 border-white/20"
                          )}
                        >
                          {item.menu_item?.images?.[0] && (
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-1.5">
                              <Image
                                src={item.menu_item.images[0]}
                                alt={item.menu_item.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <p className="text-[10px] sm:text-xs truncate font-semibold">{item.menu_item?.name}</p>
                          <div className="flex items-center justify-center gap-1 text-[9px] mt-0.5">
                            <span className="line-through opacity-50">Rs {item.original_price}</span>
                            <span className="text-yellow-300 font-bold">Rs {item.offer_price}</span>
                          </div>
                        </motion.div>
                      ))}
                      {currentOffer.items.length > 4 && (
                        <div className={cn(
                          "flex-shrink-0 w-20 sm:w-24 rounded-xl p-2 flex items-center justify-center border",
                          isLava ? "bg-black/20 border-orange-500/20" : "bg-white/10 border-white/20"
                        )}>
                          <span className="text-sm font-medium">+{currentOffer.items.length - 4}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CTA Buttons */}
                {isAuthenticated === false ? (
                  /* Guest user — prompt to login or sign up */
                  <div className="space-y-3">
                    <p className="text-sm text-white/70 text-center">
                      🔐 Login or create an account to avail this offer!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <motion.button
                        onClick={() => { handleClose(); router.push('/login'); }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "flex-1 py-3 px-6 rounded-xl font-bold text-center flex items-center justify-center gap-2 transition-all",
                          isLava
                            ? "bg-gradient-to-r from-orange-400 via-red-500 to-red-600 text-white shadow-[0_4px_20px_rgba(220,38,38,0.6)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.8)]"
                            : "bg-white text-green-700"
                        )}
                      >
                        <LogIn className="h-4 w-4" /> Login
                      </motion.button>
                      <motion.button
                        onClick={() => { handleClose(); router.push('/register'); }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 py-3 px-6 rounded-xl font-bold text-center flex items-center justify-center gap-2 transition-all border border-white/30 text-white hover:bg-white/10"
                      >
                        <UserPlus className="h-4 w-4" /> Create Account
                      </motion.button>
                    </div>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={handleClose}
                      className="w-full border border-white/20 text-white/70 hover:bg-white/10 hover:text-white rounded-xl"
                    >
                      Maybe Later
                    </Button>
                  </div>
                ) : (
                  /* Authenticated user — normal CTA */
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      onClick={() => handleGrabDeal(currentOffer)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex-1 py-3 px-6 rounded-xl font-bold text-center flex items-center justify-center gap-2 transition-all",
                        orderAdded
                          ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_4px_20px_rgba(34,197,94,0.6)]"
                          : isLava
                          ? "bg-gradient-to-r from-orange-400 via-red-500 to-red-600 text-white shadow-[0_4px_20px_rgba(220,38,38,0.6)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.8)]"
                          : "bg-white text-green-700"
                      )}
                    >
                      {orderAdded ? (
                        <><CheckCircle2 className="h-4 w-4" /> Added to cart!</>
                      ) : (
                        <><ShoppingCart className="h-4 w-4" /> Order Now <ArrowRight className="h-4 w-4" /></>
                      )}
                    </motion.button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={handleClose}
                      className="border border-white/20 text-white/70 hover:bg-white/10 hover:text-white rounded-xl"
                    >
                      Maybe Later
                    </Button>
                  </div>
                )}

                {/* Multiple offers navigation */}
                {offers.length > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-5">
                    <button
                      onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                      disabled={currentIndex === 0}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      {offers.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentIndex(idx)}
                          className={cn(
                            "rounded-full transition-all duration-300",
                            idx === currentIndex
                              ? "w-6 h-2 bg-white"
                              : "w-2 h-2 bg-white/35 hover:bg-white/55"
                          )}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentIndex(i => Math.min(offers.length - 1, i + 1))}
                      disabled={currentIndex === offers.length - 1}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-white/50 ml-1">{currentIndex + 1}/{offers.length}</span>
                  </div>
                )}

                {/* View All Offers link */}
                <div className="mt-4 text-center">
                  <Link
                    href="/offers"
                    className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors"
                    onClick={handleClose}
                  >
                    View all offers →
                  </Link>
                </div>
              </div>

              {/* Pakistan bottom bar */}
              {currentOffer.pakistani_flags && <div className="h-1 bg-white relative z-10" />}
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
