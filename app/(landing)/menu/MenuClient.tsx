"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Minus, Star, Search, X, Sparkles, Flame, Gift, Tag, Clock, Package, Percent, LogIn, UserPlus, MessageSquare, Send, Loader2, Heart, ChevronLeft, ChevronRight, Utensils, BadgeCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/cookies";
import { isMobile, cn } from "@/lib/utils";

import type { MenuItem, Category, Deal, ItemReview } from "@/lib/server-queries";
import { supabase } from "@/lib/supabase";
import type { SpecialOffer } from "@/types/offers";
import MenuDetailModal from "@/components/custom/MenuDetailModal";
import PageHero from "@/components/custom/PageHero";

// Floating food images - using Unsplash URLs
const floatingFoods = [
  { src: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop&q=80", className: "top-10 right-[5%] w-28 sm:w-40 lg:w-52", delay: 0.3 },
  { src: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=400&fit=crop&q=80", className: "top-1/3 right-[2%] w-20 sm:w-28 lg:w-36", delay: 0.5 },
  { src: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop&q=80", className: "bottom-16 right-[10%] w-16 sm:w-24 lg:w-32", delay: 0.7 },
  { src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop&q=80", className: "top-20 left-[3%] w-20 sm:w-28 lg:w-36", delay: 0.4 },
  { src: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=400&fit=crop&q=80", className: "bottom-20 left-[5%] w-16 sm:w-20 lg:w-28", delay: 0.6 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.9, rotateX: -15 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { type: "spring" as const, stiffness: 80, damping: 15 },
  },
};

interface MenuClientProps {
  initialCategories: Category[];
  initialMenuItems: MenuItem[];
  initialDeals: Deal[];
  initialOffers?: SpecialOffer[];
}

// ─── Advanced Menu Item Card with image carousel ───────────────────────────
interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  isItemFavorite: boolean;
  isToggling: boolean;
  isMobileDevice: boolean;
  categoryName?: string;
  priority?: boolean;
  onOpen: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onAddToCart: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

function MenuItemCard({
  item,
  quantity,
  isItemFavorite,
  isToggling,
  isMobileDevice,
  categoryName,
  priority = false,
  onOpen,
  onToggleFavorite,
  onAddToCart,
  onIncrement,
  onDecrement,
}: MenuItemCardProps) {
  const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=600&fit=crop&q=80";
  const image = item.images?.[0] || FALLBACK_IMAGE;

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="group relative"
      onClick={onOpen}
    >
      <div className="bg-white border-4 border-black p-0 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[4px] group-hover:translate-y-[4px] transition-all duration-300 h-full flex flex-col">
        {/* Image Area */}
        <div className="relative aspect-square w-full overflow-hidden border-b-4 border-black">
          <Image
            src={image}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Top Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {item.is_featured && (
              <div className="bg-[#FFD200] border-2 border-black px-3 py-1 font-bebas text-sm text-black flex items-center gap-1">
                <Flame className="w-4 h-4 fill-black" /> BEST SELLER
              </div>
            )}
            {categoryName && (
              <div className="bg-black border-2 border-white px-3 py-1 font-bebas text-xs text-white uppercase tracking-widest">
                {categoryName}
              </div>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
            disabled={isToggling}
            className={cn(
              "absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center transition-all z-10",
              isItemFavorite ? "bg-[#ED1C24] text-white" : "bg-white text-black hover:bg-gray-100"
            )}
          >
            <Heart className={cn("w-5 h-5", isItemFavorite && "fill-current")} />
          </button>
        </div>

        {/* Info Body */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-2 gap-2">
             <h3 className="font-bebas text-3xl text-black leading-tight line-clamp-2 uppercase">
              {item.name}
            </h3>
            <div className="flex items-center gap-1 bg-[#FFD200] border-2 border-black px-1.5 py-0.5 flex-shrink-0">
              <Star className="w-3 h-3 fill-black" />
              <span className="font-bebas text-sm">{item.rating?.toFixed(1) || "NEW"}</span>
            </div>
          </div>
          <p className="font-source-sans text-sm text-black/60 line-clamp-2 leading-tight mb-4">
            {item.description}
          </p>
          
          <div className="mt-auto flex items-center justify-between gap-4">
            <span className="font-bebas text-3xl text-[#008A45] whitespace-nowrap">
              RS. {item.has_variants && item.size_variants?.length ? Math.min(...item.size_variants.map(v => v.price)) : item.price}
              {item.has_variants && "+" }
            </span>
            
            {quantity > 0 ? (
              <div className="flex items-center border-4 border-black bg-white" onClick={(e) => e.stopPropagation()}>
                <button onClick={onDecrement} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 border-r-4 border-black">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bebas text-2xl px-4 min-w-[40px] text-center">{quantity}</span>
                <button onClick={onIncrement} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 border-l-4 border-black">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMobileDevice || item.has_variants) {
                    onOpen();
                    return;
                  }
                  onAddToCart();
                }}
                className="rounded-none bg-black hover:bg-[#ED1C24] text-white h-12 w-12 p-0 transition-colors border-2 border-black shadow-[3px_3px_0px_0px_rgba(255,210,0,1)]"
              >
                <Plus className="w-8 h-8" strokeWidth={3} />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="absolute -z-10 -bottom-2 -right-2 w-full h-full bg-[#008A45] border-2 border-black opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function MenuClient({ 
  initialCategories, 
  initialMenuItems, 
  initialDeals,
  initialOffers = [],
}: MenuClientProps) {
  const router = useRouter();

  // Use initial data from server - no loading state needed!
  const [categories] = useState<Category[]>(initialCategories);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [deals] = useState<Deal[]>(initialDeals);
  // Offers are now fully SSR - no client-side refetch needed
  const offers = initialOffers;

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Set after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    setIsMobileDevice(isMobile());
    const onResize = () => setIsMobileDevice(isMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [itemReviews, setItemReviews] = useState<ItemReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());
  
  const { addToCart, items: cartItems, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const ref = useRef(null);
  const heroRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const filteredItems = useMemo(() => {
    if (selectedCategory === "deals") return [];
    
    return menuItems.filter((item) => {
      if (!item.is_available) return false;
      const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const filteredDeals = useMemo(() => {
    if (selectedCategory !== "deals") return [];
    
    return deals.filter((deal) => {
      if (!deal.is_active) return false;
      const now = new Date();
      const validFrom = new Date(deal.valid_from);
      const validUntil = new Date(deal.valid_until);
      if (now < validFrom || now > validUntil) return false;
      
      const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deal.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [deals, selectedCategory, searchQuery]);

  const handleAddToCart = (item: MenuItem) => {
    if (!user && !authLoading) {
      setShowLoginModal(true);
      return;
    }
    
    const added = addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.images?.[0] || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80",
    });
    if (!added) return;

    toast({
      title: "Added to cart!",
      description: `${item.name} has been added to your cart.`,
      duration: 2000,
    });
  };

  const handleAddDealToCart = (deal: Deal) => {
    if (!user && !authLoading) {
      setShowLoginModal(true);
      return;
    }
    
    const added = addToCart({
      id: `deal-${deal.id}`,
      name: deal.name,
      price: deal.discounted_price,
      image: deal.image_url || deal.items?.[0]?.image || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80",
    });
    if (!added) return;

    toast({
      title: "Deal added to cart!",
      description: `${deal.name} has been added to your cart.`,
      duration: 2000,
    });
  };

  const handleToggleFavorite = async (e: React.MouseEvent, itemId: string, itemType: 'menu_item' | 'deal' = 'menu_item', itemName: string) => {
    e.stopPropagation();

    if (!user && !authLoading) {
      setShowLoginModal(true);
      return;
    }

    if (authLoading) {
      return;
    }

    if (togglingFavorites.has(itemId)) return;
    
    setTogglingFavorites(prev => new Set(prev).add(itemId));
    try {
      const added = await toggleFavorite(itemId, itemType);
      toast({
        title: added ? "Added to favorites! ❤️" : "Removed from favorites",
        description: added 
          ? `${itemName} has been added to your favorites.`
          : `${itemName} has been removed from your favorites.`,
      });
    } finally {
      setTogglingFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedDeal(null);
    setShowDetailModal(true);
    fetchItemReviews(item.id, 'item');
  };

  const openDealDetail = (deal: Deal) => {
    setSelectedDeal(deal);
    setSelectedItem(null);
    setShowDetailModal(true);
    fetchItemReviews(deal.id, 'meal');
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedItem(null);
    setSelectedDeal(null);
    setItemReviews([]);
  };

  const openReviewModal = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setShowReviewModal(true);
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cartItems.find((i) => i.id === itemId);
    return cartItem?.quantity || 0;
  };

  // Fetch reviews - this is the only client-side fetch (for modal interaction)
  const fetchItemReviews = async (itemId: string, type: 'item' | 'meal' = 'item') => {
    setLoadingReviews(true);
    try {
      const param = type === 'meal' ? 'meal_id' : 'item_id';
      const res = await fetch(`/api/customer/reviews?${param}=${itemId}&limit=5&sort=recent`);
      if (res.ok) {
        const data = await res.json();
        setItemReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitItemReview = async () => {
    if (!user) {
      setShowReviewModal(false);
      setShowLoginModal(true);
      return;
    }

    if (reviewRating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating.",
        variant: "destructive",
      });
      return;
    }

    if (reviewComment.trim().length > 0 && reviewComment.trim().length < 10) {
      toast({
        title: "Review Too Short",
        description: "Please write at least 10 characters or leave it empty for a quick rating.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      const reviewType = selectedItem ? 'item' : 'meal';
      const token = getAuthToken();
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim() || `${reviewRating} star rating`,
          review_type: reviewType,
          item_id: selectedItem?.id || null,
          meal_id: selectedDeal?.id || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit review');
      }

      toast({
        title: "Review Submitted! 🎉",
        description: "Thank you for your feedback!",
      });

      setReviewRating(0);
      setReviewComment("");
      setShowReviewModal(false);

      if (selectedItem) {
        fetchItemReviews(selectedItem.id, 'item');
        setMenuItems(prev => prev.map(item => 
          item.id === selectedItem.id 
            ? { ...item, rating: ((item.rating || 0) * (item.total_reviews || 0) + reviewRating) / ((item.total_reviews || 0) + 1), total_reviews: (item.total_reviews || 0) + 1 }
            : item
        ));
      } else if (selectedDeal) {
        fetchItemReviews(selectedDeal.id, 'meal');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const activeDealsCount = deals.filter((deal) => {
    if (!deal.is_active) return false;
    const now = new Date();
    const validFrom = new Date(deal.valid_from);
    const validUntil = new Date(deal.valid_until);
    return now >= validFrom && now <= validUntil;
  }).length;

  const activeOffersCount = offers.length;

  const filteredOffers = useMemo(() => {
    if (selectedCategory !== "offers") return [];
    return offers.filter((offer) => {
      const matchesSearch =
        offer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (offer.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [offers, selectedCategory, searchQuery]);

  return (
    <>
    <main className="min-h-screen bg-white pt-[96px]">
        {/* Compact Hero Banner - Fifth Avenue Style */}
        <PageHero 
          title="VEHARI" 
          subtitle="NOW SERVING IN" 
          accentText="Menu Reckoning" 
        />

        {/* Search & Category Filter Section - Fifth Avenue Style */}
        <section className="sticky top-20 z-30 bg-white border-b-4 border-black py-6 shadow-xl">
          <div className="container-custom space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-black" strokeWidth={3} />
              <Input
                type="text"
                placeholder="FIND YOUR FLAVOUR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 h-14 bg-white border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0 focus-visible:bg-[#FFD200] transition-colors placeholder:text-black/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "px-8 py-3 font-bebas text-xl tracking-widest transition-all border-4 border-black",
                  selectedCategory === "all" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                )}
              >
                ALL ITEMS
              </button>
              <button
                onClick={() => setSelectedCategory("deals")}
                className={cn(
                  "px-8 py-3 font-bebas text-xl tracking-widest transition-all border-4 border-black flex items-center gap-2",
                  selectedCategory === "deals" ? "bg-[#ED1C24] text-white" : "bg-white text-black hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(237,28,36,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                )}
              >
                <Gift className="w-5 h-5" />
                DEALS
                {activeDealsCount > 0 && (
                  <span className="bg-black text-white text-xs px-2 py-0.5 border border-white">
                    {activeDealsCount}
                  </span>
                )}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "px-8 py-3 font-bebas text-xl tracking-widest transition-all border-4 border-black",
                    selectedCategory === category.id ? "bg-[#008A45] text-white" : "bg-white text-black hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,138,69,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  )}
                >
                  {category.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Menu Grid */}
        <section className="py-12" ref={ref}>
          <div className="container-custom">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">
                  {selectedCategory === "deals" ? filteredDeals.length : selectedCategory === "offers" ? filteredOffers.length : filteredItems.length}
                </span> {selectedCategory === "deals" ? (filteredDeals.length === 1 ? 'deal' : 'deals') : selectedCategory === "offers" ? (filteredOffers.length === 1 ? 'offer' : 'offers') : (filteredItems.length === 1 ? 'item' : 'items')}
                {selectedCategory === "deals" && (
                  <span> in <span className="text-primary font-medium">Special Deals</span></span>
                )}
                {selectedCategory === "offers" && (
                  <span> in <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent font-medium">🔥 Hot Offers</span></span>
                )}
                {selectedCategory !== "all" && selectedCategory !== "deals" && selectedCategory !== "offers" && categories.find(c => c.id === selectedCategory) && (
                  <span> in <span className="text-primary font-medium">{categories.find(c => c.id === selectedCategory)?.name}</span></span>
                )}
                {searchQuery && (
                  <span> matching "<span className="text-primary font-medium">{searchQuery}</span>"</span>
                )}
              </p>
              {(selectedCategory !== "all" || searchQuery) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4 mr-1" /> Clear filters
                </Button>
              )}
            </div>
            
            {selectedCategory === "deals" ? (
              filteredDeals.length === 0 ? (
                <div className="text-center py-16">
                  <Gift className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-lg">No active deals found.</p>
                  <Button onClick={() => setSelectedCategory("all")} variant="outline" className="mt-4">
                    Browse Menu
                  </Button>
                </div>
              ) : (
                <motion.div
                  key="deals-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredDeals.map((deal) => {
                      const dealCartId = `deal-${deal.id}`;
                      const quantity = getCartQuantity(dealCartId);
                      const onIncrement = () => updateQuantity(dealCartId, quantity + 1);
                      const onDecrement = () => updateQuantity(dealCartId, quantity - 1);
                      const discountPercent = deal.original_price > 0 
                        ? Math.round((1 - deal.discounted_price / deal.original_price) * 100) 
                        : 0;
                      const isDealFavorite = isFavorite(deal.id, 'deal');
                      const isToggling = togglingFavorites.has(deal.id);
                      
                      return (
                        <motion.div
                          key={deal.id}
                          variants={cardVariants}
                          layout
                          className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative flex flex-col hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                          onClick={() => openDealDetail(deal)}
                        >
                          <div className="relative h-56 bg-black overflow-hidden border-b-4 border-black">
                            {deal.image_url ? (
                              <Image
                                src={deal.image_url}
                                alt={deal.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#ED1C24] flex items-center justify-center">
                                <Gift className="w-20 h-20 text-white/30" />
                              </div>
                            )}
                            
                            {/* Tags */}
                            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                              <div className="bg-[#FFD200] border-2 border-black px-3 py-1 font-bebas text-xl text-black flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                 <Tag className="h-4 w-4" /> STREET DEAL
                              </div>
                              {discountPercent > 0 && (
                                <div className="bg-white border-2 border-black px-3 py-1 font-bebas text-xl text-[#ED1C24] flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                   <Percent className="h-4 w-4" /> {discountPercent}% OFF
                                </div>
                              )}
                            </div>

                            <motion.button
                              onClick={(e) => handleToggleFavorite(e, deal.id, 'deal', deal.name)}
                              disabled={isToggling}
                              className={cn(
                                "absolute top-4 right-4 w-12 h-12 border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all z-20",
                                isDealFavorite ? "bg-[#ED1C24] text-white" : "bg-white text-black"
                              )}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Heart className={cn("h-6 w-6", isDealFavorite && "fill-current")} />
                            </motion.button>

                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                               <div className="bg-black/80 backdrop-blur-sm text-white font-bebas text-lg px-3 border border-white/20 flex items-center gap-2">
                                  <Package className="h-4 w-4" /> {deal.items?.length || 0} ITEMS
                               </div>
                               <div className="bg-[#FFD200] border-2 border-black px-2 py-0.5 flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-black" />
                                  <span className="font-bebas text-xl text-black">{deal.rating ? deal.rating.toFixed(1) : 'NEW'}</span>
                               </div>
                            </div>
                          </div>

                          <div className="p-6 flex-1 flex flex-col">
                            <h3 className="font-bebas text-3xl text-black leading-none mb-2 group-hover:text-[#ED1C24] transition-colors uppercase">
                              {deal.name}
                            </h3>
                            <p className="font-source-sans text-sm text-black/60 line-clamp-2 leading-tight mb-6">
                              {deal.description}
                            </p>
                            
                            <div className="mt-auto pt-6 border-t-2 border-black/5 flex items-center justify-between">
                              <div className="flex flex-col">
                                {deal.original_price > deal.discounted_price && (
                                  <span className="font-bebas text-lg text-black/30 line-through">Rs. {deal.original_price}</span>
                                )}
                                <span className="font-bebas text-4xl text-[#008A45] leading-none">Rs. {deal.discounted_price}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {quantity > 0 ? (
                                  <div className="flex items-center bg-black border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={onDecrement} className="h-10 w-10 flex items-center justify-center text-[#FFD200] hover:bg-white/10">
                                      <Minus className="h-5 w-5" />
                                    </button>
                                    <span className="font-bebas text-2xl text-white px-3 min-w-[2rem] text-center">{quantity}</span>
                                    <button onClick={onIncrement} className="h-10 w-10 flex items-center justify-center text-[#FFD200] hover:bg-white/10 border-l border-white/20">
                                      <Plus className="h-5 w-5" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button 
                                    onClick={(e) => { e.stopPropagation(); handleAddDealToCart(deal); }}
                                    className="bg-black text-[#FFD200] border-4 border-black rounded-none h-14 w-14 p-0 shadow-[4px_4px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                  >
                                    <Plus className="h-8 w-8" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )
            ) : selectedCategory === "offers" ? (
              /* ===== OFFERS GRID ===== */
              filteredOffers.length === 0 ? (
                <div className="text-center py-24 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <Flame className="w-16 h-16 mx-auto text-black/20 mb-4 animate-pulse" />
                  <p className="font-bebas text-3xl text-black">NO ACTIVE DROPS MATCH YOUR SEARCH</p>
                  <Button onClick={() => setSearchQuery("")} className="mt-6 bg-black text-[#FFD200] rounded-none font-bebas text-xl h-14 px-8">CLEAR INTEL</Button>
                </div>
              ) : (
                <motion.div
                  key="offers-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredOffers.map((offer, idx) => {
                    return (
                      <motion.div
                        key={offer.id}
                        variants={cardVariants}
                        className="group bg-black border-4 border-black shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] relative flex flex-col hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="p-8 relative overflow-hidden">
                          <div className="absolute -bottom-4 -right-4 opacity-10 pointer-events-none select-none">
                             <span className="font-bebas text-9xl text-white">HOT</span>
                          </div>

                          <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center gap-2">
                               <span className="bg-[#ED1C24] text-white font-bebas text-lg px-3 border border-white/20">STREET DROP</span>
                               {offer.pakistani_flags && <span className="text-2xl">🇵🇰</span>}
                            </div>
                            
                            <h3 className="font-bebas text-4xl md:text-5xl text-[#FFD200] leading-none uppercase tracking-tighter">
                              {offer.name}
                            </h3>
                            
                            <p className="font-caveat text-2xl text-white/70 italic leading-tight mb-4 line-clamp-2">
                               "{offer.description}"
                            </p>

                            <div className="flex flex-wrap gap-3">
                               <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1">
                                  <Clock className="h-4 w-4 text-[#FFD200]" />
                                  <span className="font-bebas text-lg text-white">LIMITED TIME</span>
                               </div>
                               <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1">
                                  <Percent className="h-4 w-4 text-[#FFD200]" />
                                  <span className="font-bebas text-lg text-white">
                                    {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `RS ${offer.discount_value} OFF`}
                                  </span>
                               </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto p-6 bg-white/5 border-t-4 border-black flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <Sparkles className="h-6 w-6 text-[#FFD200]" />
                              <span className="font-bebas text-2xl text-white uppercase tracking-widest">ACTIVATE DEAL</span>
                           </div>
                           <Button
                              onClick={() => { setSelectedCategory("all"); router.push("/menu"); }}
                              className="bg-[#FFD200] text-black border-4 border-black rounded-none h-14 w-14 p-0 shadow-[4px_4px_0px_0px_rgba(237,28,36,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                           >
                              <ChevronRight className="h-8 w-8" />
                           </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No items found.</p>
                <Button onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }} variant="outline" className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <motion.div
                key={selectedCategory + searchQuery}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item, index) => {
                    const quantity = getCartQuantity(item.id);
                    const isItemFavorite = isFavorite(item.id, 'menu_item');
                    const isToggling = togglingFavorites.has(item.id);
                    const categoryName = categories.find((c) => c.id === item.category_id)?.name;
                    return (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        quantity={quantity}
                        isItemFavorite={isItemFavorite}
                        isToggling={isToggling}
                        isMobileDevice={isMobileDevice}
                        categoryName={categoryName}
                        priority={index === 0}
                        onOpen={() => openItemDetail(item)}
                        onToggleFavorite={(e) => handleToggleFavorite(e, item.id, 'menu_item', item.name)}
                        onAddToCart={() => handleAddToCart(item)}
                        onIncrement={() => updateQuantity(item.id, quantity + 1)}
                        onDecrement={() => updateQuantity(item.id, quantity - 1)}
                      />
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      </main>

      <MenuDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        selectedItem={selectedItem}
        selectedDeal={selectedDeal}
        cartItems={cartItems}
        addToCart={addToCart}
        updateQuantity={updateQuantity}
        handleAddDealToCart={handleAddDealToCart}
        toast={toast}
      />
      {/* Login Required Modal - Fifth Avenue Style */}
      <AlertDialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <AlertDialogContent className="max-w-md border-[8px] border-black rounded-none bg-white p-8">
            <AlertDialogHeader className="text-center">
              <div className="mx-auto w-24 h-24 border-4 border-black bg-[#FFD200] flex items-center justify-center mb-6 transform -rotate-3">
                <LogIn className="w-12 h-12 text-black" strokeWidth={3} />
              </div>
              <AlertDialogTitle className="text-4xl font-bebas text-black mb-2">JOIN THE SQUAD</AlertDialogTitle>
              <AlertDialogDescription className="text-lg font-bold text-black/60">
                You need to be in the squad to grab these flavours. Sign in or join us now!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-4 mt-8">
                <Link href="/auth?tab=login" className="w-full">
                  <Button className="w-full h-16 rounded-none bg-black text-white font-bebas text-2xl tracking-widest hover:bg-[#ED1C24] border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,210,0,1)] hover:shadow-none">
                    SIGN IN
                  </Button>
                </Link>
                <Link href="/auth?tab=register" className="w-full">
                  <Button variant="outline" className="w-full h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest text-black hover:bg-black hover:text-white transition-colors">
                    JOIN SQUAD
                  </Button>
                </Link>
            </div>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="w-full rounded-none border-2 border-black font-bebas text-xl text-black/40">
                LATER
              </AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Modal - Fifth Avenue Style */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-md border-[8px] border-black rounded-none bg-white p-8">
          <DialogHeader>
            <DialogTitle className="text-4xl font-bebas text-black mb-2">
              RATE THE VIBE
            </DialogTitle>
            <DialogDescription className="font-bold text-black/60">
              Share your street story with this {selectedItem ? 'item' : 'deal'}
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-6 border-4 border-black bg-[#FFD200] flex items-center justify-center transform rotate-3">
                <LogIn className="w-10 h-10 text-black" strokeWidth={3} />
              </div>
              <p className="font-bebas text-2xl text-black mb-6">LOGIN TO RECKON</p>
              <Link href="/auth?tab=login">
                <Button className="rounded-none bg-black text-white h-14 px-8 font-bebas text-2xl tracking-widest hover:bg-[#ED1C24] border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]">
                  GO TO LOGIN
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setReviewHoverRating(star)}
                      onMouseLeave={() => setReviewHoverRating(0)}
                      onClick={() => setReviewRating(star)}
                      className="p-1 transition-transform hover:scale-125"
                    >
                      <Star
                        className={cn(
                          "w-12 h-12",
                          star <= (reviewHoverRating || reviewRating)
                            ? "text-[#FFD200] fill-[#FFD200] stroke-black stroke-[2px]"
                            : "text-black/10 stroke-black stroke-[1px]"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bebas text-2xl text-black uppercase">Your Story</label>
                <Textarea
                  placeholder="Drop the truth..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="min-h-[120px] rounded-none border-4 border-black font-source-sans text-lg font-bold p-4 focus-visible:ring-0 focus-visible:bg-gray-50"
                  maxLength={500}
                />
              </div>

              <Button
                onClick={handleSubmitItemReview}
                disabled={reviewRating === 0 || isSubmittingReview}
                className="w-full h-16 rounded-none bg-black text-white font-bebas text-2xl tracking-widest hover:bg-[#ED1C24] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,138,69,1)]"
              >
                {isSubmittingReview ? "SUBMITTING..." : "SEND IT"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
