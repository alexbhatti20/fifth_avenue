"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Gift, Clock, Flame, Sparkles, Tag, ArrowRight, Search, X, BadgePercent, ChevronDown, ShoppingCart, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { SpecialOffer, SpecialOfferItem, SpecialOfferDeal } from "@/types/offers";

// Lava spark config for cards
const CARD_SPARKS = [
  { top: 15, left: 10, size: 2 },
  { top: 40, left: 88, size: 3 },
  { top: 75, left: 25, size: 2 },
  { top: 25, left: 70, size: 2 },
];

interface OffersClientProps {
  offers: SpecialOffer[];
}

function formatTimeRemaining(endDate: string) {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return "Ending soon!";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}m left`;
}

function OfferCard({ offer, index }: { offer: SpecialOffer; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { addToCart, applyOffer } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const isLava = !offer.pakistani_flags;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOrderNow = () => {
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
        if (!price) return; // skip if no valid price
        addToCart(
          {
            id: item.menu_item_id,
            name: item.menu_item?.name ?? "Item",
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
        names.push(item.menu_item?.name ?? "Item");
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
            name: deal.deal?.name ?? "Deal",
            slug: deal.deal?.slug,
            price,
            originalPrice: deal.original_price,
            image: deal.deal?.image,
            is_available: true,
          },
          undefined,
          price
        );
        names.push(deal.deal?.name ?? "Deal");
        addedCount++;
      });
    }

    if (addedCount === 0) {
      // Storewide discount — no specific items, apply offer to cart total
      if (offer.discount_type === 'percentage' || offer.discount_type === 'fixed_amount') {
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
        router.push('/menu');
        return;
      }
      setAdded(true);
      setTimeout(() => router.push('/cart'), 700);
      return;
    }

    toast({
      title: `🛒 ${addedCount} item${addedCount > 1 ? "s" : ""} added to cart!`,
      description: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : ""),
    });

    setAdded(true);
    setTimeout(() => {
      router.push("/cart");
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 90, damping: 15 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.3)] group"
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: offer.theme_colors?.primary
            ? `linear-gradient(145deg, ${offer.theme_colors.primary} 0%, #7f1d1d 60%, #1a0a00 100%)`
            : isLava
            ? "linear-gradient(145deg, #dc2626 0%, #991b1b 35%, #7f1d1d 60%, #1a0a00 100%)"
            : "linear-gradient(145deg, #16a34a 0%, #15803d 50%, #052e16 100%)",
        }}
      />

      {/* Lava blobs */}
      {isLava && (
        <>
          <motion.div
            className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl opacity-50 pointer-events-none"
            style={{ background: "radial-gradient(circle, #f97316 0%, #dc2626 60%, transparent 80%)" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-2xl opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {CARD_SPARKS.map((s, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.size * 2,
                height: s.size * 2,
                background: i % 2 === 0 ? "#fbbf24" : "#f97316",
                boxShadow: `0 0 ${s.size * 4}px ${i % 2 === 0 ? "#fbbf24" : "#f97316"}`,
              }}
              animate={{ y: [0, -20, -40], opacity: [0, 1, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
            />
          ))}
        </>
      )}

      {/* Pakistani flags */}
      {offer.pakistani_flags && (
        <div className="absolute top-0 left-0 right-0 flex justify-evenly px-4 pt-3 text-2xl z-10">
          <span>🇵🇰</span><span>🇵🇰</span><span>🇵🇰</span>
        </div>
      )}

      {/* Card Content */}
      <div className={cn("relative z-10 p-6 text-white", offer.pakistani_flags && "pt-12")}>
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge className="bg-white/15 border border-white/20 text-white text-[10px]">
            <Sparkles className="h-2.5 w-2.5 mr-1 text-yellow-300" />
            {offer.event_type?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Special Offer"}
          </Badge>
          <Badge className="bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px]">
            <Clock className="h-2.5 w-2.5 mr-1" />
            {formatTimeRemaining(offer.end_date)}
          </Badge>
          {isLava && offer.discount_type === "percentage" && Number(offer.discount_value) >= 20 && (
            <Badge className="bg-red-900/50 border border-red-400/30 text-red-300 text-[10px]">
              <Flame className="h-2.5 w-2.5 mr-1" /> Hot
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold mb-1.5 drop-shadow-lg flex items-center gap-2">
          {isLava ? <Flame className="h-5 w-5 text-orange-400" /> : <Gift className="h-5 w-5 text-yellow-300" />}
          {offer.name}
        </h3>

        {/* Banner Image */}
        {offer.banner_image && (
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-4 border border-white/20 shadow-lg">
            <Image
              src={offer.banner_image}
              alt={offer.name}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Description */}
        {offer.description && (
          <p className="text-white/70 text-sm mb-4 leading-relaxed line-clamp-2">{offer.description}</p>
        )}

        {/* Discount */}
        <motion.div
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4 border",
            isLava
              ? "bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/30 shadow-[0_0_16px_rgba(249,115,22,0.35)]"
              : "bg-white/15 border-white/25"
          )}
          animate={isLava ? { boxShadow: ["0 0 16px rgba(249,115,22,0.3)", "0 0 28px rgba(239,68,68,0.5)", "0 0 16px rgba(249,115,22,0.3)"] } : {}}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          <BadgePercent className="h-4 w-4 text-yellow-300" />
          <span className="text-xl font-extrabold">
            {offer.discount_type === "percentage"
              ? `${offer.discount_value}% OFF`
              : `Rs ${offer.discount_value} OFF`}
          </span>
          {offer.min_order_amount && (
            <span className="text-xs text-white/50">min Rs {offer.min_order_amount}</span>
          )}
        </motion.div>

        {/* Items preview */}
        {offer.items && offer.items.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors mb-2"
            >
              <Tag className="h-3 w-3" />
              {offer.items.length} item{offer.items.length > 1 ? "s" : ""} included
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {offer.items.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex-shrink-0 w-18 rounded-xl p-2 text-center border text-[10px]",
                          isLava ? "bg-black/20 border-orange-500/20" : "bg-white/10 border-white/20"
                        )}
                        style={{ width: "72px" }}
                      >
                        {item.menu_item?.images?.[0] && (
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-1">
                            <Image src={item.menu_item.images[0]} alt={item.menu_item.name} fill className="object-cover" />
                          </div>
                        )}
                        <p className="truncate font-medium">{item.menu_item?.name}</p>
                        <p className="text-yellow-300 font-bold">Rs {item.offer_price}</p>
                      </div>
                    ))}
                    {offer.items.length > 5 && (
                      <div
                        className="flex-shrink-0 rounded-xl p-2 flex items-center justify-center bg-white/10 border border-white/20 text-xs"
                        style={{ width: "72px" }}
                      >
                        +{offer.items.length - 5} more
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* CTA */}
        {!mounted || !user ? (
          /* Guest — prompt to login/register */
          <div className="space-y-2">
            <p className="text-xs text-white/60 text-center">
              🔐 Login to avail this offer
            </p>
            <div className="flex gap-2">
              <motion.button
                onClick={() => router.push('/login')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-xl font-bold text-center flex items-center justify-center gap-1.5 text-sm transition-all",
                  isLava
                    ? "bg-gradient-to-r from-orange-400 via-red-500 to-red-600 text-white shadow-[0_3px_16px_rgba(220,38,38,0.5)]"
                    : "bg-white/90 text-green-800"
                )}
              >
                <LogIn className="h-3.5 w-3.5" /> Login
              </motion.button>
              <motion.button
                onClick={() => router.push('/register')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-2.5 px-3 rounded-xl font-bold text-center flex items-center justify-center gap-1.5 text-sm transition-all border border-white/30 text-white hover:bg-white/10"
              >
                <UserPlus className="h-3.5 w-3.5" /> Sign Up
              </motion.button>
            </div>
          </div>
        ) : (
          /* Logged-in — normal Order Now button */
          <motion.button
            onClick={handleOrderNow}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full py-2.5 px-4 rounded-xl font-bold text-center flex items-center justify-center gap-2 text-sm transition-all",
              added
                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_3px_16px_rgba(34,197,94,0.5)]"
                : isLava
                ? "bg-gradient-to-r from-orange-400 via-red-500 to-red-600 text-white shadow-[0_3px_16px_rgba(220,38,38,0.5)]"
                : "bg-white/90 text-green-800"
            )}
          >
            {added ? (
              <><CheckCircle2 className="h-4 w-4" /> Added! Going to cart...</>
            ) : (
              <><ShoppingCart className="h-4 w-4" /> Order Now <ArrowRight className="h-4 w-4" /></>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function OffersClient({ offers: initialOffers }: OffersClientProps) {
  const [offers] = useState<SpecialOffer[]>(initialOffers);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "percentage" | "fixed_amount" | "bundle_price">("all");

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      const matchSearch =
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.description || "").toLowerCase().includes(search.toLowerCase());
      const matchFilter = activeFilter === "all" || o.discount_type === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [offers, search, activeFilter]);

  const filters: { label: string; value: typeof activeFilter }[] = [
    { label: "All Offers", value: "all" },
    { label: "% Off", value: "percentage" },
    { label: "Fixed Amount", value: "fixed_amount" },
    { label: "Bundle Deals", value: "bundle_price" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        {/* Lava background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-red-900 to-black" />
        <motion.div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle, #f97316 0%, #dc2626 60%, transparent 80%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{ background: "radial-gradient(circle, #fbbf24 0%, #ef4444 60%, transparent 80%)" }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

        <div className="container-custom relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-2 mb-6"
          >
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-orange-300 text-sm font-medium">Live Offers</span>
            {offers.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                {offers.length}
              </span>
            )}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bebas text-white mb-4 drop-shadow-2xl"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-yellow-400">
              HOT OFFERS
            </span>
            <br />
            <span className="text-white/90">& DEALS</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg max-w-xl mx-auto"
          >
            Exclusive discounts on your favorite Zoiro Broast items. Grab them before they expire!
          </motion.p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b py-4 shadow-sm">
        <div className="container-custom flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-shrink-0 w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search offers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-full bg-secondary/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {filters.map((f) => (
              <motion.button
                key={f.value}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveFilter(f.value)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  activeFilter === f.value
                    ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-[0_2px_10px_rgba(220,38,38,0.4)]"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                )}
              >
                {f.label}
              </motion.button>
            ))}
          </div>
          {/* Count */}
          <span className="text-sm text-muted-foreground ml-auto hidden sm:block">
            <span className="font-semibold text-foreground">{filtered.length}</span> offer{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {/* Offers Grid */}
      <section className="py-12">
        <div className="container-custom">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24"
            >
              <Flame className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">No offers found</h3>
              <p className="text-muted-foreground/60 text-sm mb-6">
                {search ? `No offers match "${search}"` : "Check back soon for hot new deals!"}
              </p>
              {(search || activeFilter !== "all") && (
                <Button variant="outline" onClick={() => { setSearch(""); setActiveFilter("all"); }}>
                  Clear filters
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((offer, i) => (
                <OfferCard key={offer.id} offer={offer} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
