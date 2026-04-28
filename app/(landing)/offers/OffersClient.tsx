"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Clock, Flame, Tag, ArrowRight, Search, X, BadgePercent, ChevronDown, ShoppingCart, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import PageHero from "@/components/custom/PageHero";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { SpecialOffer, SpecialOfferItem, SpecialOfferDeal } from "@/types/offers";

interface OffersClientProps {
  offers: SpecialOffer[];
}

function formatTimeRemaining(endDate: string) {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return "ENDING SOON!";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}D ${hours}H LEFT`;
  if (hours > 0) return `${hours}H LEFT`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}M LEFT`;
}

function OfferCard({ offer, index }: { offer: SpecialOffer; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { addToCart, applyOffer, onlineOrderingEnabled, onlineOrderingMessage } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOrderNow = () => {
    if (!onlineOrderingEnabled) {
      toast({
        title: 'UNAVAILABLE',
        description: onlineOrderingMessage,
        variant: 'destructive',
      });
      return;
    }

    let addedCount = 0;
    const names: string[] = [];
    const safePrice = (offerPrice: number, originalPrice: number) =>
      offerPrice > 0 ? offerPrice : originalPrice > 0 ? originalPrice : undefined;

    if (offer.items && offer.items.length > 0) {
      offer.items.forEach((item: SpecialOfferItem) => {
        if (!item.menu_item_id) return;
        const price = safePrice(item.offer_price, item.original_price);
        if (!price) return;
        const added = addToCart(
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
        if (added) { names.push(item.menu_item?.name ?? "Item"); addedCount++; }
      });
    }

    if (offer.deals && offer.deals.length > 0) {
      offer.deals.forEach((deal: SpecialOfferDeal) => {
        if (!deal.deal_id) return;
        const price = safePrice(deal.offer_price, deal.original_price);
        if (!price) return;
        const added = addToCart(
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
        if (added) { names.push(deal.deal?.name ?? "Deal"); addedCount++; }
      });
    }

    if (addedCount === 0) {
      if (offer.discount_type === 'percentage' || offer.discount_type === 'fixed_amount') {
        applyOffer({
          id: offer.id,
          name: offer.name,
          discount_type: offer.discount_type as 'percentage' | 'fixed_amount',
          discount_value: Number(offer.discount_value),
          max_discount_amount: offer.max_discount_amount,
        });
        toast({ title: `🔥 ${offer.name} APPLIED!` });
      } else {
        router.push('/menu');
        return;
      }
      setAdded(true);
      setTimeout(() => router.push('/cart'), 700);
      return;
    }

    toast({ title: `🛒 ${addedCount} ITEMS ADDED!` });
    setAdded(true);
    setTimeout(() => router.push("/cart"), 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all relative overflow-hidden group"
    >
      {/* Visual Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD200] -rotate-45 translate-x-16 -translate-y-16 group-hover:bg-[#ED1C24] transition-colors" />

      {/* Banner Image */}
      {offer.banner_image && (
        <div className="relative w-full aspect-[16/9] border-b-8 border-black overflow-hidden">
          <Image 
            src={offer.banner_image} 
            alt={offer.name} 
            fill 
            className="object-cover group-hover:scale-110 transition-transform duration-500" 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          />
        </div>
      )}

      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col">
            <Badge className="bg-[#ED1C24] text-white rounded-none font-bebas text-lg px-3 mb-2 w-fit">
              {formatTimeRemaining(offer.end_date)}
            </Badge>
            <h3 className="font-bebas text-4xl text-black leading-none uppercase">{offer.name}</h3>
          </div>
          <div className="bg-[#008A45] border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-3">
             <BadgePercent className="w-8 h-8 text-white" />
          </div>
        </div>

        <p className="font-source-sans text-lg font-black text-black/70 uppercase leading-tight mb-8 border-l-4 border-[#FFD200] pl-4">
          {offer.description}
        </p>

        {/* Discount Box */}
        <div className="bg-black p-6 border-4 border-[#FFD200] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8 flex items-center justify-center">
            <span className="font-bebas text-6xl text-white">
              {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `Rs ${offer.discount_value} OFF`}
            </span>
        </div>

        {/* CTA */}
        {!mounted || !user ? (
          <div className="grid grid-cols-2 gap-4">
            <Link href="/auth?tab=login" className="w-full">
              <Button className="w-full h-14 bg-black text-white rounded-none font-bebas text-2xl tracking-widest border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]">
                LOGIN
              </Button>
            </Link>
            <Link href="/auth?tab=register" className="w-full">
              <Button className="w-full h-14 bg-[#FFD200] text-black rounded-none font-bebas text-2xl tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                JOIN
              </Button>
            </Link>
          </div>
        ) : (
          <Button
            onClick={handleOrderNow}
            className={cn(
              "w-full h-16 rounded-none font-bebas text-3xl tracking-widest border-4 border-black transition-all",
              added 
                ? "bg-[#008A45] text-white" 
                : "bg-[#ED1C24] text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-x-[4px] translate-y-[4px] hover:translate-x-0 hover:translate-y-0"
            )}
          >
            {added ? <CheckCircle2 className="w-8 h-8 mr-2" /> : <ShoppingCart className="w-8 h-8 mr-2" />}
            {added ? "ADDED!" : "ORDER NOW"}
          </Button>
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
    { label: "ALL", value: "all" },
    { label: "PERCENTAGE", value: "percentage" },
    { label: "CASH OFF", value: "fixed_amount" },
    { label: "BUNDLES", value: "bundle_price" },
  ];

  return (
    <div className="min-h-screen bg-white pt-[96px]">
      <PageHero 
        title="VEHARI" 
        subtitle="NOW SERVING IN" 
        accentText="Hot Offers" 
      />

      {/* Filter bar */}
      <section className="sticky top-[80px] z-30 bg-white border-b-8 border-black py-4">
        <div className="container-custom flex flex-col sm:flex-row gap-6 items-center px-6 mx-auto max-w-7xl">
          <div className="relative flex-shrink-0 w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-black" />
            <Input
              placeholder="SEARCH OFFERS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-4 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={cn(
                  "px-6 py-2 border-4 border-black font-bebas text-xl transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                  activeFilter === f.value ? "bg-[#FFD200] translate-x-[2px] translate-y-[2px] shadow-none" : "bg-white hover:bg-[#FFD200]/20"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-24">
        <div className="container-custom px-6 mx-auto max-w-7xl">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <h3 className="font-bebas text-5xl text-black/20">NO DEALS FOUND</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
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
