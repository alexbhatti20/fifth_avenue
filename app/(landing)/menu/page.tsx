"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Plus, Minus, Star, Search, X, Sparkles, Flame, Gift, Tag, Clock, Package, ChevronRight, Percent, LogIn, UserPlus, MessageSquare, ThumbsUp, Send, Loader2, Heart } from "lucide-react";
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
import { isMobile, cn } from "@/lib/utils";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

// Floating food images - using Unsplash URLs
const floatingFoods = [
  { src: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop&q=80", className: "top-10 right-[5%] w-28 sm:w-40 lg:w-52", delay: 0.3 },
  { src: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=400&fit=crop&q=80", className: "top-1/3 right-[2%] w-20 sm:w-28 lg:w-36", delay: 0.5 },
  { src: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop&q=80", className: "bottom-16 right-[10%] w-16 sm:w-24 lg:w-32", delay: 0.7 },
  { src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop&q=80", className: "top-20 left-[3%] w-20 sm:w-28 lg:w-36", delay: 0.4 },
  { src: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=400&fit=crop&q=80", className: "bottom-20 left-[5%] w-16 sm:w-20 lg:w-28", delay: 0.6 },
];

interface SizeVariant {
  size: string;
  price: number;
  is_available: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number;
  category_id: string;
  rating?: number;
  total_reviews?: number;
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
  is_visible: boolean;
}

interface DealItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Deal {
  id: string;
  name: string;
  slug: string;
  description: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  image_url?: string;
  valid_from: string;
  valid_until: string;
  code?: string;
  items: DealItem[];
  is_active: boolean;
  rating?: number;
  total_reviews?: number;
}

interface ItemReview {
  id: string;
  customer: { name: string; initial: string };
  rating: number;
  comment: string;
  is_verified: boolean;
  created_at: string;
}

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

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
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
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedSizePrice, setSelectedSizePrice] = useState<number | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());
  const { addToCart, items: cartItems, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const ref = useRef(null);
  const heroRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  // Removed scroll-based parallax to prevent floating image vibration

  useEffect(() => {
    async function fetchData() {
      setIsMobileDevice(isMobile());
      try {
        // Single API call with caching - much faster!
        const res = await fetch("/api/customer/menu", {
          next: { revalidate: 60 }, // ISR revalidation
        });
        const data = await res.json();
        
        if (data.success && data.data) {
          setCategories(data.data.categories || []);
          setMenuItems(data.data.items || []);
          setDeals(data.data.deals || []);
          
          // Log cache status for debugging
          if (process.env.NODE_ENV === 'development') {
            console.log(`Menu data ${data.cached ? 'from cache' : 'fresh fetch'}`);
          }
        }
      } catch (error) {
        console.error("Error fetching menu:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    // If deals tab is selected, return empty (we show deals separately)
    if (selectedCategory === "deals") return [];
    
    return menuItems.filter((item) => {
      // Don't show unavailable items
      if (!item.is_available) return false;
      const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Filter deals based on search
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
    // Check if user is logged in
    if (!user && !authLoading) {
      setShowLoginModal(true);
      return;
    }
    
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.images?.[0] || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80",
    });
    toast({
      title: "Added to cart!",
      description: `${item.name} has been added to your cart.`,
    });
  };

  const handleAddDealToCart = (deal: Deal) => {
    // Check if user is logged in
    if (!user && !authLoading) {
      setShowLoginModal(true);
      return;
    }
    
    // Add deal as a single cart item with deal price
    addToCart({
      id: `deal-${deal.id}`,
      name: deal.name,
      price: deal.discounted_price,
      image: deal.image_url || deal.items?.[0]?.image || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80",
    });
    toast({
      title: "Deal added to cart!",
      description: `${deal.name} has been added to your cart.`,
    });
  };

  const handleToggleFavorite = async (e: React.MouseEvent, itemId: string, itemType: 'menu_item' | 'deal' = 'menu_item', itemName: string) => {
    e.stopPropagation();
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
    // Reset size selection, default to first available size if item has variants
    if (item.has_variants && item.size_variants && item.size_variants.length > 0) {
      const firstAvailable = item.size_variants.find(v => v.is_available);
      if (firstAvailable) {
        setSelectedSize(firstAvailable.size);
        setSelectedSizePrice(firstAvailable.price);
      }
    } else {
      setSelectedSize(null);
      setSelectedSizePrice(null);
    }
  };

  const openDealDetail = (deal: Deal) => {
    setSelectedDeal(deal);
    setSelectedItem(null);
    setShowDetailModal(true);
    fetchItemReviews(deal.id, 'meal');
    setSelectedSize(null);
    setSelectedSizePrice(null);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedItem(null);
    setSelectedDeal(null);
    setItemReviews([]);
    setSelectedSize(null);
    setSelectedSizePrice(null);
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

  // Fetch reviews for an item or deal
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
      console.error('Error fetching item reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Submit a review for an item
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

    // If comment provided, it should be meaningful
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
      const token = localStorage.getItem('auth_token');
      console.log('[Menu Review] Submitting review with token:', token ? `Bearer ${token.substring(0, 20)}...` : 'No token');
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim() || `${reviewRating} star rating`, // Default comment if empty
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

      // Reset form
      setReviewRating(0);
      setReviewComment("");
      setShowReviewModal(false);

      // Refresh reviews
      if (selectedItem) {
        fetchItemReviews(selectedItem.id, 'item');
        // Update local rating
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

  // Count active deals
  const activeDealsCount = deals.filter((deal) => {
    if (!deal.is_active) return false;
    const now = new Date();
    const validFrom = new Date(deal.valid_from);
    const validUntil = new Date(deal.valid_until);
    return now >= validFrom && now <= validUntil;
  }).length;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32">
        {/* Advanced Hero Section */}
        <section ref={heroRef} className="relative min-h-[55vh] flex items-center overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 z-0 bg-zinc-900">
            <img
              src="https://images.unsplash.com/photo-1562967914-608f82629710?w=1920&h=1080&fit=crop&q=80"
              alt="Menu Background"
              className="w-full h-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
          </div>

          {/* Animated gradient orbs */}
          <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
            <motion.div 
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
              animate={!isMobileDevice ? { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] } : {}}
              transition={!isMobileDevice ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : {}}
            />
            <motion.div 
              className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl"
              animate={!isMobileDevice ? { scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] } : {}}
              transition={!isMobileDevice ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : {}}
            />
          </div>

          {/* Floating Food Images - No scroll parallax to prevent vibration */}
          <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden hidden md:block">
            {floatingFoods.map((food, index) => (
              <motion.div
                key={index}
                className={`absolute ${food.className} drop-shadow-2xl`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  y: !isMobileDevice ? [0, -12, 0] : 0,
                  rotate: !isMobileDevice ? [-3, 3, -3] : 0,
                }}
                transition={{ 
                  opacity: { duration: 0.6, delay: food.delay },
                  scale: { duration: 0.6, delay: food.delay },
                  y: !isMobileDevice ? { duration: 4 + index * 0.5, repeat: Infinity, ease: "easeInOut", delay: food.delay } : {},
                  rotate: !isMobileDevice ? { duration: 5 + index * 0.5, repeat: Infinity, ease: "easeInOut", delay: food.delay } : {},
                }}
              >
                <img src={food.src} alt="" className="w-full h-auto rounded-lg" />
              </motion.div>
            ))}

            {/* Sparkle effects - use fixed positions to avoid hydration mismatch */}
            {!isMobileDevice && [
              { top: 20, left: 15 },
              { top: 35, left: 75 },
              { top: 50, left: 25 },
              { top: 65, left: 85 },
              { top: 25, left: 55 },
              { top: 70, left: 40 },
              { top: 45, left: 10 },
              { top: 80, left: 65 },
            ].map((pos, i) => (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute w-2 h-2 bg-primary rounded-full"
                style={{
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
              />
            ))}
          </div>

          {/* Content */}
          <div className="container-custom relative z-10 pt-24">
            <motion.div className="max-w-2xl">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-2 mb-6"
              >
                <Sparkles className="h-4 w-4 text-primary fill-primary" />
                <span className="text-background text-sm font-medium">Fresh & Delicious</span>
              </motion.div>

              {/* Animated Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-bebas text-background leading-tight mb-4"
              >
                <span className="text-primary">EXPLORE</span>
                <br />
                <motion.span
                  className="inline-block bg-gradient-to-r from-background via-primary to-background bg-clip-text text-transparent bg-[length:200%_auto]"
                  animate={{ backgroundPosition: ["0% center", "200% center"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  OUR MENU
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg sm:text-xl text-background/80 mb-6 max-w-lg"
              >
                Discover our signature broasted chicken, juicy burgers, crispy wings, 
                and more. Made fresh with premium ingredients.
              </motion.p>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex gap-8"
              >
                <div>
                  <p className="text-3xl font-bebas text-primary">50+</p>
                  <p className="text-sm text-background/70">Menu Items</p>
                </div>
                <div>
                  <p className="text-3xl font-bebas text-primary">4.9</p>
                  <p className="text-sm text-background/70">Rating</p>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-6 h-6 text-primary" />
                  <p className="text-sm text-background/70">Hot & Fresh</p>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-6 h-10 rounded-full border-2 border-background/50 flex items-start justify-center p-2"
            >
              <motion.div className="w-1.5 h-3 bg-primary rounded-full" />
            </motion.div>
          </motion.div>
        </section>

        {/* Search & Category Filter Section */}
        <section className="sticky top-20 z-30 bg-background/95 backdrop-blur-md border-b py-4 shadow-sm">
          <div className="container-custom space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-secondary/50 border-border rounded-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              )}
            </div>
            
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory("all")}
                className={`px-4 sm:px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
                  selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                All Items
              </motion.button>
              {/* Deals Tab with Badge */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory("deals")}
                className={`px-4 sm:px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base ${
                  selectedCategory === "deals" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                <Gift className="w-4 h-4" />
                Deals
                {activeDealsCount > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedCategory === "deals" ? "bg-white/20" : "bg-primary text-primary-foreground"
                  }`}>
                    {activeDealsCount}
                  </span>
                )}
              </motion.button>
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 sm:px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
                    selectedCategory === category.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {category.name}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        {/* Menu Grid */}
        <section className="py-12" ref={ref}>
          <div className="container-custom">
            {/* Results count */}
            {!isLoading && (
              <div className="mb-6 flex items-center justify-between">
                <p className="text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">
                    {selectedCategory === "deals" ? filteredDeals.length : filteredItems.length}
                  </span> {selectedCategory === "deals" ? (filteredDeals.length === 1 ? 'deal' : 'deals') : (filteredItems.length === 1 ? 'item' : 'items')}
                  {selectedCategory === "deals" && (
                    <span> in <span className="text-primary font-medium">Special Deals</span></span>
                  )}
                  {selectedCategory !== "all" && selectedCategory !== "deals" && categories.find(c => c.id === selectedCategory) && (
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
            )}
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-secondary rounded-2xl h-80 animate-pulse" />
                ))}
              </div>
            ) : selectedCategory === "deals" ? (
              // Deals Grid
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
                          className="group bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                          onClick={() => openDealDetail(deal)}
                        >
                          <div className="relative h-48 bg-gradient-to-br from-orange-500 to-red-500 overflow-hidden">
                            {deal.image_url ? (
                              <Image
                                src={deal.image_url}
                                alt={deal.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : deal.items?.[0]?.image ? (
                              <Image
                                src={deal.items[0].image}
                                alt={deal.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-110 opacity-80"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Gift className="w-16 h-16 text-white/50" />
                              </div>
                            )}
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            
                            {/* Discount Badge */}
                            {discountPercent > 0 && (
                              <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 z-10">
                                <Percent className="w-3 h-3" />
                                {discountPercent}% OFF
                              </span>
                            )}
                            
                            {/* Favorite Heart Button */}
                            <motion.button
                              onClick={(e) => handleToggleFavorite(e, deal.id, 'deal', deal.name)}
                              disabled={isToggling}
                              className={`absolute top-3 right-3 w-9 h-9 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg transition-all z-10 ${
                                isDealFavorite 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
                              }`}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Heart 
                                className={`h-5 w-5 transition-all ${
                                  isDealFavorite ? 'fill-current' : ''
                                } ${isToggling ? 'animate-pulse' : ''}`} 
                              />
                            </motion.button>
                            
                            {/* Items Count */}
                            {deal.items && deal.items.length > 0 && (
                              <span className="absolute bottom-3 left-3 text-white text-xs font-medium flex items-center gap-1 z-10">
                                <Package className="w-3 h-3" />
                                {deal.items.length} items included
                              </span>
                            )}
                            
                            {/* Deal Type Badge */}
                            <span className="absolute bottom-3 right-3 bg-background/90 text-foreground text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 z-10">
                              <Tag className="w-3 h-3 text-primary" />
                              {deal.deal_type === 'combo' ? 'Combo' : deal.deal_type === 'bogo' ? 'BOGO' : 'Discount'}
                            </span>
                          </div>
                          <div className="p-5">
                            <h3 className="text-lg font-bebas group-hover:text-primary transition-colors line-clamp-1">
                              {deal.name}
                            </h3>
                            <p className="text-muted-foreground text-sm mb-2 line-clamp-2">{deal.description}</p>
                            <div className="flex items-center gap-1 mb-3">
                              <Star className="w-4 h-4 text-accent fill-accent" />
                              <span className="text-sm font-medium">{deal.rating ? deal.rating.toFixed(1) : 'New'}</span>
                              {deal.total_reviews > 0 && <span className="text-xs text-muted-foreground">({deal.total_reviews})</span>}
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xl font-bold text-primary">Rs. {deal.discounted_price}</span>
                                {deal.original_price > deal.discounted_price && (
                                  <span className="text-sm text-muted-foreground line-through ml-2">
                                    Rs. {deal.original_price}
                                  </span>
                                )}
                              </div>
                              {quantity > 0 ? (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(dealCartId, quantity - 1)}>
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="font-semibold w-6 text-center">{quantity}</span>
                                  <Button size="icon" className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90" onClick={() => updateQuantity(dealCartId, quantity + 1)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                                  <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90" onClick={() => handleAddDealToCart(deal)}>
                                    <Plus className="h-5 w-5" />
                                  </Button>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
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
                  {filteredItems.map((item) => {
                    const quantity = getCartQuantity(item.id);
                    const isItemFavorite = isFavorite(item.id, 'menu_item');
                    const isToggling = togglingFavorites.has(item.id);
                    return (
                      <motion.div
                        key={item.id}
                        variants={cardVariants}
                        layout
                        className="group bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                        onClick={() => openItemDetail(item)}
                      >
                        <div className="relative h-48 bg-muted overflow-hidden">
                          <Image
                            src={item.images?.[0] || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80"}
                            alt={item.name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          {item.is_featured && (
                            <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full z-10">
                              Popular
                            </span>
                          )}
                          {/* Favorite Heart Button */}
                          <motion.button
                            onClick={(e) => handleToggleFavorite(e, item.id, 'menu_item', item.name)}
                            disabled={isToggling}
                            className={`absolute top-3 right-3 w-9 h-9 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg transition-all z-10 ${
                              isItemFavorite 
                                ? 'bg-red-500 text-white' 
                                : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
                            }`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Heart 
                              className={`h-5 w-5 transition-all ${
                                isItemFavorite ? 'fill-current' : ''
                              } ${isToggling ? 'animate-pulse' : ''}`} 
                            />
                          </motion.button>
                          {/* Size Variants Badge */}
                          {item.has_variants && item.size_variants && item.size_variants.length > 0 && (
                            <span className="absolute bottom-3 left-3 bg-orange-500/90 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 z-10">
                              {item.size_variants.length} sizes
                            </span>
                          )}
                          {/* Rating Badge - moved to bottom */}
                          <span className="absolute bottom-3 right-3 bg-background/90 text-foreground text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 z-10">
                            <Star className="w-3 h-3 text-accent fill-accent" />
                            {item.rating ? item.rating.toFixed(1) : 'New'}
                            {item.total_reviews > 0 && <span className="text-muted-foreground">({item.total_reviews})</span>}
                          </span>
                        </div>
                        <div className="p-5">
                          <h3 className="text-lg font-bebas group-hover:text-primary transition-colors line-clamp-1">
                            {item.name}
                          </h3>
                          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{item.description}</p>
                          <div className="flex items-center justify-between">
                            {/* Show price range if has variants, otherwise single price */}
                            {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Starting from</span>
                                <span className="text-xl font-bold text-primary">
                                  Rs. {Math.min(...item.size_variants.map(v => v.price))}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xl font-bold text-primary">Rs. {item.price}</span>
                            )}
                            {/* For items with variants, show "Select" button to open modal */}
                            {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                              <Button 
                                size="sm" 
                                className="rounded-full bg-primary hover:bg-primary/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openItemDetail(item);
                                }}
                              >
                                Select Size
                              </Button>
                            ) : quantity > 0 ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(item.id, quantity - 1)}>
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold w-6 text-center">{quantity}</span>
                                <Button size="icon" className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90" onClick={() => updateQuantity(item.id, quantity + 1)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90" onClick={() => handleAddToCart(item)}>
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />

      {/* Item/Deal Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bebas">{selectedItem.name}</DialogTitle>
                <div className="flex items-center flex-wrap gap-2">
                  {selectedItem.is_featured && (
                    <Badge className="bg-primary/10 text-primary">Popular</Badge>
                  )}
                  <DialogDescription className="!mt-0">
                    {selectedItem.description}
                  </DialogDescription>
                </div>
              </DialogHeader>
              
              {/* Item Image */}
              <div className="relative h-64 w-full rounded-xl overflow-hidden bg-muted">
                <Image
                  src={selectedItem.images?.[0] || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80"}
                  alt={selectedItem.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              </div>

              {/* Item Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {selectedItem.preparation_time || 15} min prep time
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <span className="text-sm font-medium">{selectedItem.rating ? selectedItem.rating.toFixed(1) : 'New'}</span>
                    {selectedItem.total_reviews > 0 && <span className="text-sm text-muted-foreground">({selectedItem.total_reviews} reviews)</span>}
                  </div>
                </div>

                {/* Reviews Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Customer Reviews
                    </h4>
                    <Button variant="ghost" size="sm" onClick={openReviewModal} className="text-primary">
                      <Star className="w-4 h-4 mr-1" />
                      Rate This
                    </Button>
                  </div>
                  
                  {loadingReviews ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : itemReviews.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {itemReviews.map((review) => (
                        <div key={review.id} className="bg-secondary/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                                {review.customer.initial}
                              </div>
                              <span className="text-sm font-medium">{review.customer.name}</span>
                              {review.is_verified && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">Verified</Badge>
                              )}
                            </div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "w-3 h-3",
                                    star <= review.rating ? "text-accent fill-accent" : "text-muted-foreground/30"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No reviews yet. Be the first to review!
                    </p>
                  )}
                </div>

                {/* Size Variants Selection */}
                {selectedItem.has_variants && selectedItem.size_variants && selectedItem.size_variants.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Select Size</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedItem.size_variants.map((variant) => (
                        <button
                          key={variant.size}
                          onClick={() => {
                            if (variant.is_available) {
                              setSelectedSize(variant.size);
                              setSelectedSizePrice(variant.price);
                            }
                          }}
                          disabled={!variant.is_available}
                          className={cn(
                            "relative p-3 rounded-xl border-2 transition-all text-left",
                            selectedSize === variant.size
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50",
                            !variant.is_available && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span className="font-medium">{variant.size}</span>
                          <span className="block text-lg font-bold text-primary mt-1">Rs. {variant.price}</span>
                          {!variant.is_available && (
                            <span className="absolute top-1 right-1 text-xs text-destructive">Unavailable</span>
                          )}
                          {selectedSize === variant.size && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price and Add to Cart */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    {selectedItem.has_variants && selectedSizePrice ? (
                      <div>
                        <span className="text-xs text-muted-foreground">{selectedSize}</span>
                        <span className="block text-2xl font-bold text-primary">Rs. {selectedSizePrice}</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-primary">Rs. {selectedItem.price}</span>
                    )}
                  </div>
                  {(() => {
                    const cartItemId = selectedItem.has_variants && selectedSize 
                      ? `${selectedItem.id}-${selectedSize.toLowerCase().replace(/\s+/g, '-')}`
                      : selectedItem.id;
                    const qty = cartItems.find(i => (i.cartItemId || i.id) === cartItemId)?.quantity || 0;
                    const priceToUse = selectedSizePrice || selectedItem.price;
                    
                    return qty > 0 ? (
                      <div className="flex items-center gap-3">
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => updateQuantity(cartItemId, qty - 1)}>
                          <Minus className="h-5 w-5" />
                        </Button>
                        <span className="font-bold text-lg w-8 text-center">{qty}</span>
                        <Button size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90" onClick={() => updateQuantity(cartItemId, qty + 1)}>
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="rounded-full px-6" 
                        disabled={selectedItem.has_variants && !selectedSize}
                        onClick={() => { 
                          addToCart(selectedItem, selectedSize || undefined, priceToUse); 
                          toast({
                            title: "Added to cart!",
                            description: `${selectedItem.name}${selectedSize ? ` (${selectedSize})` : ''} has been added.`,
                          });
                          closeDetailModal(); 
                        }}
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Add to Cart
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bebas">{selectedDeal.name}</DialogTitle>
                <div className="flex items-center flex-wrap gap-2">
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                    {selectedDeal.deal_type === 'combo' ? 'Combo Deal' : selectedDeal.deal_type === 'bogo' ? 'Buy One Get One' : 'Discount'}
                  </Badge>
                  <DialogDescription className="!mt-0">
                    {selectedDeal.description}
                  </DialogDescription>
                </div>
              </DialogHeader>
              
              {/* Deal Image */}
              <div className="relative h-48 w-full rounded-xl overflow-hidden bg-gradient-to-br from-orange-500 to-red-500">
                {selectedDeal.image_url ? (
                  <Image
                    src={selectedDeal.image_url}
                    alt={selectedDeal.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover"
                  />
                ) : selectedDeal.items?.[0]?.image ? (
                  <Image
                    src={selectedDeal.items[0].image}
                    alt={selectedDeal.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover opacity-80"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Gift className="w-20 h-20 text-white/50" />
                  </div>
                )}
                {/* Discount Overlay */}
                {selectedDeal.original_price > selectedDeal.discounted_price && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    {Math.round((1 - selectedDeal.discounted_price / selectedDeal.original_price) * 100)}% OFF
                  </div>
                )}
              </div>

              {/* Deal Items List */}
              {selectedDeal.items && selectedDeal.items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    What's Included ({selectedDeal.items.length} items)
                  </h4>
                  <div className="space-y-2">
                    {selectedDeal.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">Rs. {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Promo Code */}
              {selectedDeal.code && (
                <div className="p-3 rounded-lg bg-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <span className="text-sm">Use code:</span>
                    <span className="font-mono font-bold text-primary">{selectedDeal.code}</span>
                  </div>
                </div>
              )}

              {/* Rating Info */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-accent fill-accent" />
                  <span className="text-sm font-medium">{selectedDeal.rating ? selectedDeal.rating.toFixed(1) : 'New'}</span>
                  {selectedDeal.total_reviews > 0 && <span className="text-sm text-muted-foreground">({selectedDeal.total_reviews} reviews)</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={openReviewModal} className="text-primary">
                  <Star className="w-4 h-4 mr-1" />
                  Rate This Deal
                </Button>
              </div>

              {/* Reviews Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4" />
                  Customer Reviews
                </h4>
                
                {loadingReviews ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : itemReviews.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {itemReviews.map((review) => (
                      <div key={review.id} className="bg-secondary/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                              {review.customer.initial}
                            </div>
                            <span className="text-sm font-medium">{review.customer.name}</span>
                            {review.is_verified && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Verified</Badge>
                            )}
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "w-3 h-3",
                                  star <= review.rating ? "text-accent fill-accent" : "text-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No reviews yet. Be the first to review this deal!
                  </p>
                )}
              </div>

              {/* Price and Add to Cart */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <span className="text-2xl font-bold text-primary">Rs. {selectedDeal.discounted_price}</span>
                  {selectedDeal.original_price > selectedDeal.discounted_price && (
                    <span className="text-lg text-muted-foreground line-through ml-2">
                      Rs. {selectedDeal.original_price}
                    </span>
                  )}
                </div>
                {(() => {
                  const dealCartId = `deal-${selectedDeal.id}`;
                  const qty = getCartQuantity(dealCartId);
                  return qty > 0 ? (
                    <div className="flex items-center gap-3">
                      <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => updateQuantity(dealCartId, qty - 1)}>
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="font-bold text-lg w-8 text-center">{qty}</span>
                      <Button size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90" onClick={() => updateQuantity(dealCartId, qty + 1)}>
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  ) : (
                    <Button className="rounded-full px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" onClick={() => { handleAddDealToCart(selectedDeal); closeDetailModal(); }}>
                      <Plus className="h-5 w-5 mr-2" />
                      Add Deal
                    </Button>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Login Required Modal */}
      <AlertDialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <AlertDialogContent className="max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <AlertDialogHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4"
              >
                <LogIn className="w-10 h-10 text-white" />
              </motion.div>
              <AlertDialogTitle className="text-2xl font-bebas">Login Required</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Please sign in to your account to add items to your cart and place orders. Join us for a delicious experience!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3 mt-6">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link href="/auth?tab=login" className="w-full">
                  <Button className="w-full h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold">
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link href="/auth?tab=register" className="w-full">
                  <Button variant="outline" className="w-full h-12 rounded-full font-semibold">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create Account
                  </Button>
                </Link>
              </motion.div>
            </div>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="w-full rounded-full">
                Continue Browsing
              </AlertDialogCancel>
            </AlertDialogFooter>
          </motion.div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bebas">
              Rate {selectedItem?.name || selectedDeal?.name}
            </DialogTitle>
            <DialogDescription>
              Share your experience with this {selectedItem ? 'item' : 'deal'}
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground mb-4">Please login to write a review</p>
              <Link href="/auth?tab=login">
                <Button className="bg-primary hover:bg-primary/90">
                  Login to Review
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Star Rating */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Tap to rate</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onMouseEnter={() => setReviewHoverRating(star)}
                      onMouseLeave={() => setReviewHoverRating(0)}
                      onClick={() => setReviewRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          "w-8 h-8 transition-colors",
                          star <= (reviewHoverRating || reviewRating)
                            ? "text-accent fill-accent"
                            : "text-muted-foreground/30"
                        )}
                      />
                    </motion.button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <p className="text-sm mt-2 text-primary font-medium">
                    {reviewRating === 1 && "Poor"}
                    {reviewRating === 2 && "Fair"}
                    {reviewRating === 3 && "Good"}
                    {reviewRating === 4 && "Very Good"}
                    {reviewRating === 5 && "Excellent!"}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-medium mb-2 block">Your Review (Optional)</label>
                <Textarea
                  placeholder="Tell us about your experience..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {reviewComment.length}/500
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmitItemReview}
                disabled={reviewRating === 0 || isSubmittingReview}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Review
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
