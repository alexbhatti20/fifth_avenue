"use client";

import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { 
  Star, 
  Quote, 
  MessageSquare, 
  ThumbsUp, 
  Filter,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import type { PublicReviewServer, ReviewStatsServer, PublicReviewsResponseServer } from "@/lib/server-queries";
import Link from "next/link";
import PageHero from "@/components/custom/PageHero";

// ── Components ───────────────────────────────────────────────────────────────

// Animated Counter Component
function AnimatedCounter({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value, decimals]);

  return (
    <span ref={ref}>
      {decimals > 0 ? displayValue.toFixed(decimals) : displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// Rating Bar Component - Urban Style
function RatingBar({ rating, count, total, delay }: { rating: number; count: number; total: number; delay: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <motion.div 
      className="flex items-center gap-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <span className="font-bebas text-2xl w-4 text-black">{rating}</span>
      <Star className="h-5 w-5 text-[#FFD200] fill-[#FFD200] stroke-black stroke-2" />
      <div className="flex-1 h-4 bg-white border-2 border-black rounded-none overflow-hidden">
        <motion.div 
          className="h-full bg-[#008A45]"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="font-bebas text-xl text-black/40 w-16 text-right">{count} VIBES</span>
    </motion.div>
  );
}

// Review Card Component - Urban Style
const ReviewCard = memo(function ReviewCard({ 
  review, 
  index, 
  isInView,
  onHelpful,
  helpfulLoading
}: { 
  review: PublicReviewServer; 
  index: number; 
  isInView: boolean;
  onHelpful: (id: string) => void;
  helpfulLoading: string | null;
}) {
  const timeAgo = useMemo(() => {
    const now = new Date();
    const date = new Date(review.created_at);
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Just Now";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} Days Ago`;
    if (days < 30) return `${Math.floor(days / 7)} Weeks Ago`;
    return `${Math.floor(days / 30)} Months Ago`;
  }, [review.created_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotate: -2 }}
      animate={isInView ? { opacity: 1, y: 0, rotate: 0 } : {}}
      transition={{ delay: index * 0.05 }}
      className="bg-white border-4 border-black p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative group hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
    >
      {/* Quote decoration */}
      <div className="absolute -top-4 -right-4 bg-[#ED1C24] text-white p-3 border-4 border-black rotate-12">
        <Quote className="h-6 w-6" />
      </div>
      
      {/* Verified badge */}
      {review.is_verified && (
        <div className="absolute -top-3 left-6 bg-[#008A45] text-white px-3 py-1 font-bebas text-sm border-2 border-black -rotate-2">
           STREET VERIFIED
        </div>
      )}

      {/* Author Info */}
      <div className="flex items-center gap-4 mb-6 border-b-2 border-black/5 pb-4">
        <div className="w-14 h-14 bg-[#FFD200] border-4 border-black flex items-center justify-center font-bebas text-3xl shadow-[4px_4px_0px_0px_rgba(237,28,36,1)]">
          {review.customer.initial}
        </div>
        <div>
          <p className="font-bebas text-2xl text-black leading-none uppercase">{review.customer.name}</p>
          <p className="font-source-sans text-xs font-black text-[#008A45] uppercase tracking-widest">{timeAgo}</p>
        </div>
      </div>

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-5 w-5 transition-colors",
              i < review.rating ? "text-[#FFD200] fill-[#FFD200] stroke-black" : "text-black/10"
            )}
            strokeWidth={2}
          />
        ))}
      </div>

      {/* Item/Meal badge */}
      {(review.item || review.meal) && (
        <span className="inline-block bg-black text-white px-3 py-1 font-bebas text-sm mb-4 uppercase tracking-tighter">
          TARGET: {review.item?.name || review.meal?.name}
        </span>
      )}

      {/* Comment */}
      <p className="font-source-sans text-lg font-bold text-black/80 leading-snug italic mb-6">
        "{review.comment}"
      </p>

      {/* Admin Reply */}
      {review.admin_reply && (
        <div className="mb-6 p-4 bg-[#FFD200]/10 border-l-8 border-[#ED1C24]">
          <p className="font-bebas text-sm text-[#ED1C24] mb-1">FIFTH AVENUE SQUAD RESPONSE:</p>
          <p className="font-source-sans text-sm font-bold text-black/70 italic">{review.admin_reply}</p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t-2 border-black/5">
        <div className="flex items-center gap-2">
           <span className="font-bebas text-sm text-black/40">LEVEL OF RESPECT:</span>
           <span className="font-bebas text-xl text-black">{review.helpful_count}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none hover:bg-black hover:text-white border-2 border-transparent hover:border-black transition-all"
          onClick={() => onHelpful(review.id)}
          disabled={helpfulLoading === review.id}
        >
          <ThumbsUp className="h-4 w-4 mr-2" />
          RESPECT
        </Button>
      </div>
    </motion.div>
  );
});

// Review Form Modal Component - Urban Style
function ReviewFormModal({ 
  open, 
  onOpenChange, 
  onSubmit,
  isSubmitting,
  remainingReviews
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { rating: number; comment: string; review_type: string }) => void;
  isSubmitting: boolean;
  remainingReviews: number;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewType, setReviewType] = useState("overall");
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  const handleSubmit = () => {
    if (comment.trim().length < 10) return;
    onSubmit({ rating, comment: comment.trim(), review_type: reviewType });
    setComment("");
    setRating(5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[8px] border-black rounded-none bg-white p-8">
        <DialogHeader className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-[#FFD200] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-6 transform -rotate-3">
             <MessageSquare className="w-10 h-10 text-black" strokeWidth={3} />
          </div>
          <DialogTitle className="text-4xl font-bebas text-black mb-2">DROP THE TRUTH</DialogTitle>
          <DialogDescription className="font-bold text-black/60 uppercase text-xs">
            {remainingReviews} stories remaining today. Make them count.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rating */}
          <div className="text-center">
            <label className="font-bebas text-2xl text-black block mb-4">VIBE LEVEL</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(null)}
                  onClick={() => setRating(value)}
                  className="p-1 transition-transform hover:scale-125"
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-colors",
                      (hoveredRating !== null ? value <= hoveredRating : value <= rating)
                        ? "text-[#FFD200] fill-[#FFD200] stroke-black stroke-2"
                        : "text-black/10"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Type */}
          <div className="space-y-2">
            <label className="font-bebas text-xl text-black uppercase">WHAT'S THE WORD?</label>
            <Select value={reviewType} onValueChange={setReviewType}>
              <SelectTrigger className="rounded-none border-4 border-black font-bebas text-xl h-14 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-4 border-black">
                <SelectItem value="overall">OVERALL VIBE</SelectItem>
                <SelectItem value="service">THE SQUAD SERVICE</SelectItem>
                <SelectItem value="delivery">STREET DELIVERY</SelectItem>
                <SelectItem value="food">FLAVOUR QUALITY</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="font-bebas text-xl text-black uppercase">YOUR STORY</label>
            <Textarea
              placeholder="Drop the truth (min 10 chars)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[120px] rounded-none border-4 border-black font-source-sans text-lg font-bold p-4 focus-visible:ring-0 focus-visible:bg-gray-50"
              maxLength={500}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || comment.trim().length < 10}
            className="w-full h-16 rounded-none bg-black text-white font-bebas text-3xl tracking-widest hover:bg-[#ED1C24] border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none"
          >
            {isSubmitting ? "SENDING..." : "SEND IT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function PublicReviewsClient({ initialData }: PublicReviewsClientProps) {
  const [reviews, setReviews] = useState<PublicReviewServer[]>(initialData.reviews);
  const [stats, setStats] = useState<ReviewStatsServer>(initialData.stats);
  const [hasMore, setHasMore] = useState(initialData.has_more);
  const [offset, setOffset] = useState(20);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingReviews, setRemainingReviews] = useState(3);
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const { toast } = useToast();
  const { user: customer, isLoading: authLoading } = useAuth();
  
  useEffect(() => { setMounted(true); }, []);

  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const fetchReviews = useCallback(async (reset = false, forceRefresh = false) => {
    try {
      const newOffset = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        limit: '20',
        offset: newOffset.toString(),
        sort: sortBy,
      });
      if (filterRating) params.set('min_rating', filterRating.toString());
      if (filterType) params.set('type', filterType);

      const res = await fetch(`/api/customer/reviews?${params}`);
      const data = await res.json();
      
      if (reset) {
        setReviews(data.reviews || []);
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(20);
      } else {
        setReviews(prev => [...prev, ...(data.reviews || [])]);
        setHasMore(data.has_more);
        setOffset(newOffset + 20);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, sortBy, filterRating, filterType]);

  useEffect(() => {
    if (mounted) fetchReviews(true);
  }, [sortBy, filterRating, filterType, mounted]);

  const handleSubmitReview = async (data: any) => {
    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: "SENT IT!", description: "Your story is now part of the street." });
      setShowReviewModal(false);
      fetchReviews(true, true);
    } catch (error) {
      toast({ title: "WHACK!", description: "Something went wrong. Try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHelpful = async (id: string) => {
    setHelpfulLoading(id);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/reviews/${id}/helpful`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        setReviews(prev => prev.map(r => r.id === id ? { ...r, helpful_count: r.helpful_count + 1 } : r));
      }
    } catch {} finally { setHelpfulLoading(null); }
  };

  return (
    <main className="min-h-screen bg-white pt-[96px]">
      <PageHero 
        title="VEHARI" 
        subtitle="NOW SERVING IN" 
        accentText="The Squad Reckoning" 
      />

      {/* Stats Hub */}
      <section className="py-20 border-b-8 border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-center">
            {/* Main Score */}
            <div className="bg-[#FFD200] border-8 border-black p-10 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
              <h3 className="font-bebas text-3xl text-black mb-4 tracking-widest">STREET CRED</h3>
              <div className="flex items-end gap-2 mb-4">
                <span className="font-bebas text-9xl leading-none text-black">
                   <AnimatedCounter value={stats?.average_rating || 0} decimals={1} />
                </span>
                <Star className="w-16 h-16 mb-4 fill-black text-black" />
              </div>
              <p className="font-bebas text-2xl text-black/60 uppercase">BASED ON {stats?.total_reviews || 0} REVIEWS</p>
            </div>

            {/* Bars */}
            <div className="space-y-6">
               <RatingBar rating={5} count={stats?.five_star || 0} total={stats?.total_reviews || 0} delay={0.1} />
               <RatingBar rating={4} count={stats?.four_star || 0} total={stats?.total_reviews || 0} delay={0.2} />
               <RatingBar rating={3} count={stats?.three_star || 0} total={stats?.total_reviews || 0} delay={0.3} />
               <RatingBar rating={2} count={stats?.two_star || 0} total={stats?.total_reviews || 0} delay={0.4} />
               <RatingBar rating={1} count={stats?.one_star || 0} total={stats?.total_reviews || 0} delay={0.5} />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-black text-white p-6 border-4 border-black">
                  <TrendingUp className="w-8 h-8 text-[#FFD200] mb-4" />
                  <p className="font-bebas text-5xl leading-none mb-1">98%</p>
                  <p className="font-bebas text-sm text-white/50 tracking-widest">LOYAL FANS</p>
               </div>
               <div className="bg-[#ED1C24] text-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <MapPin className="w-8 h-8 text-white mb-4" />
                  <p className="font-bebas text-5xl leading-none mb-1">50+</p>
                  <p className="font-bebas text-sm text-white/50 tracking-widest">STREETS FED</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Control Bar */}
      <section className="sticky top-20 z-40 bg-white/95 backdrop-blur-md border-b-4 border-black py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-black text-white px-4 py-2">
                <Filter className="w-4 h-4" />
                <span className="font-bebas text-lg">FILTER</span>
              </div>
              <Select value={filterRating?.toString() || "all"} onValueChange={(v) => setFilterRating(v === "all" ? null : parseInt(v))}>
                <SelectTrigger className="w-40 border-4 border-black rounded-none font-bebas text-lg h-12 focus:ring-0">
                  <SelectValue placeholder="RATING" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-4 border-black">
                  <SelectItem value="all">ALL RATINGS</SelectItem>
                  <SelectItem value="5">5 STARS ONLY</SelectItem>
                  <SelectItem value="4">4+ STARS</SelectItem>
                  <SelectItem value="3">3+ STARS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? null : v)}>
                <SelectTrigger className="w-40 border-4 border-black rounded-none font-bebas text-lg h-12 focus:ring-0">
                  <SelectValue placeholder="TYPE" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-4 border-black">
                  <SelectItem value="all">ALL TYPES</SelectItem>
                  <SelectItem value="overall">OVERALL</SelectItem>
                  <SelectItem value="service">SERVICE</SelectItem>
                  <SelectItem value="delivery">DELIVERY</SelectItem>
                  <SelectItem value="food">FLAVOURS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48 border-4 border-black rounded-none font-bebas text-lg h-12 focus:ring-0">
                  <SelectValue placeholder="SORT BY" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-4 border-black">
                  <SelectItem value="recent">LATEST STORIES</SelectItem>
                  <SelectItem value="rating_high">TOP RECKONED</SelectItem>
                  <SelectItem value="rating_low">ROUGH BITES</SelectItem>
                  <SelectItem value="helpful">MOST RESPECTED</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setShowReviewModal(true)}
                className="bg-[#ED1C24] text-white rounded-none border-4 border-black font-bebas text-xl h-12 px-8 shadow-[4px_4px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all"
              >
                JOIN THE RECKONING
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-20 bg-gray-50/50 relative" ref={containerRef}>
        <div className="max-w-7xl mx-auto px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40">
               <Loader2 className="w-16 h-16 animate-spin text-[#ED1C24] mb-4" />
               <p className="font-bebas text-2xl tracking-widest">LOADING THE VIBE...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-40 border-8 border-dashed border-black/10">
               <MessageSquare className="w-20 h-20 mx-auto text-black/10 mb-6" />
               <h3 className="font-bebas text-5xl text-black/20">NO STORIES YET</h3>
               <Button onClick={() => setShowReviewModal(true)} variant="outline" className="mt-8 border-4 border-black rounded-none font-bebas text-2xl h-16 px-10">
                  START THE TRUTH
               </Button>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-12">
                <AnimatePresence mode="popLayout">
                  {reviews.map((review, idx) => (
                    <ReviewCard 
                      key={review.id} 
                      review={review} 
                      index={idx} 
                      isInView={true} 
                      onHelpful={handleHelpful} 
                      helpfulLoading={helpfulLoading} 
                    />
                  ))}
                </AnimatePresence>
              </div>

              {hasMore && (
                <div className="mt-20 text-center">
                  <Button 
                    onClick={() => fetchReviews(false)}
                    disabled={loadingMore}
                    className="bg-black text-white rounded-none border-4 border-black font-bebas text-3xl h-20 px-16 shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all"
                  >
                    {loadingMore ? "SCOUTING..." : "SEE MORE STORIES"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 bg-[#FFD200] border-t-8 border-black relative overflow-hidden">
        <div className="absolute top-0 right-0 p-20 opacity-10">
           <Quote className="w-64 h-64 text-black" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
           <h2 className="font-bebas text-7xl md:text-9xl text-black leading-none mb-8">
              FEED THE<br/>SQUAD<br/>FEEDBACK
           </h2>
           <p className="font-source-sans text-2xl font-black mb-12 uppercase tracking-tight">Your voice is the heartbeat of these streets.</p>
           <Button 
              onClick={() => setShowReviewModal(true)}
              className="bg-black text-white h-24 px-16 rounded-none font-bebas text-4xl tracking-widest border-4 border-white shadow-[10px_10px_0px_0px_rgba(237,28,36,1)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all"
           >
              DROP YOUR REVIEW NOW
           </Button>
        </div>
      </section>

      <ReviewFormModal 
        open={showReviewModal} 
        onOpenChange={setShowReviewModal} 
        onSubmit={handleSubmitReview} 
        isSubmitting={isSubmitting} 
        remainingReviews={remainingReviews} 
      />
    </main>
  );
}

interface PublicReviewsClientProps {
  initialData: PublicReviewsResponseServer;
}
