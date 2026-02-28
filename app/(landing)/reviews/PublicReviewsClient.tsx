"use client";

import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
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
  Sparkles
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

// Rating Bar Component
function RatingBar({ rating, count, total, delay }: { rating: number; count: number; total: number; delay: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <span className="text-sm font-medium w-3">{rating}</span>
      <Star className="h-4 w-4 text-accent fill-accent" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
    </motion.div>
  );
}

// Review Card Component
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
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }, [review.created_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ 
        delay: index * 0.1,
        type: "spring",
        stiffness: 100,
        damping: 15 
      }}
      className="bg-card rounded-2xl p-6 relative group shadow-lg hover:shadow-xl transition-all duration-300"
      whileHover={{ y: -8, scale: 1.02 }}
    >
      {/* Quote icon */}
      <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/20 group-hover:text-primary/40 transition-colors" />
      
      {/* Verified badge */}
      {review.is_verified && (
        <Badge variant="secondary" className="absolute top-4 left-4 gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      )}

      {/* Rating */}
      <div className="flex gap-1 mb-4 mt-6">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4 transition-colors",
              i < review.rating ? "text-accent fill-accent" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>

      {/* Item/Meal badge */}
      {(review.item || review.meal) && (
        <Badge variant="outline" className="mb-3 text-xs">
          {review.item?.name || review.meal?.name}
        </Badge>
      )}

      {/* Comment */}
      <p className="text-foreground/90 mb-4 line-clamp-4">{review.comment}</p>

      {/* Admin Reply */}
      {review.admin_reply && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
          <p className="text-xs font-semibold text-primary mb-1">ZOIRO Response:</p>
          <p className="text-sm text-muted-foreground">{review.admin_reply}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {review.customer.initial}
          </div>
          <div>
            <p className="font-medium text-sm">{review.customer.name}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-primary"
          onClick={() => onHelpful(review.id)}
          disabled={helpfulLoading === review.id}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs">{review.helpful_count}</span>
        </Button>
      </div>
    </motion.div>
  );
});

// Review Form Modal Component
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
    if (comment.trim().length < 10) {
      return;
    }
    onSubmit({ rating, comment: comment.trim(), review_type: reviewType });
    setComment("");
    setRating(5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Write a Review
          </DialogTitle>
          <DialogDescription>
            Share your experience with others ({remainingReviews} reviews remaining today)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Rating Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(null)}
                  onClick={() => setRating(value)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      (hoveredRating !== null ? value <= hoveredRating : value <= rating)
                        ? "text-accent fill-accent"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Review Type</label>
            <Select value={reviewType} onValueChange={setReviewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Experience</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="food">Food Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your Review</label>
            <Textarea
              placeholder="Tell us about your experience (min 10 characters)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {comment.length}/500 characters
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || comment.trim().length < 10}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Review
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Props interface
interface PublicReviewsClientProps {
  initialData: PublicReviewsResponseServer;
}

// Container variants for animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// Main Component
export default function PublicReviewsClient({ initialData }: PublicReviewsClientProps) {
  // State with SSR data
  const [reviews, setReviews] = useState<PublicReviewServer[]>(initialData.reviews);
  const [stats, setStats] = useState<ReviewStatsServer>(initialData.stats);
  const [hasMore, setHasMore] = useState(initialData.has_more);
  const [offset, setOffset] = useState(20); // SSR fetched first 20
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filters
  const [sortBy, setSortBy] = useState("recent");
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const fetchedFiltersRef = useRef('recent|null|null'); // Track SSR filter combo
  
  // UI states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingReviews, setRemainingReviews] = useState(3);
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { user: customer, isLoading: authLoading } = useAuth();
  
  // Set mounted after hydration to avoid auth-dependent mismatch
  useEffect(() => { setMounted(true); }, []);

  const ref = useRef(null);
  const statsRef = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const statsInView = useInView(statsRef, { once: true, margin: "-50px" });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const contentY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  // Fetch reviews (only when filters change from SSR defaults)
  const fetchReviews = useCallback(async (reset = false, forceRefresh = false) => {
    const currentFilterKey = `${sortBy}|${filterRating}|${filterType}`;
    
    // Skip if this is the initial SSR data and we haven't changed filters (unless force refresh)
    if (reset && !forceRefresh && fetchedFiltersRef.current === currentFilterKey) {
      return;
    }

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
      
      if (!res.ok) {
        if (reset) {
          setReviews([]);
          setStats({ total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 });
          setHasMore(false);
        }
        return;
      }
      
      const data = await res.json();
      
      if (reset) {
        setReviews(data.reviews || []);
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(20);
        fetchedFiltersRef.current = currentFilterKey;
      } else {
        setReviews(prev => [...prev, ...(data.reviews || [])]);
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(newOffset + 20);
      }
    } catch (error) {
      if (reset) {
        setReviews([]);
        setStats({ total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 });
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, sortBy, filterRating, filterType]);

  // Fetch when filters change (but skip initial SSR match)
  useEffect(() => {
    fetchReviews(true);
  }, [sortBy, filterRating, filterType]);

  // Submit review
  const handleSubmitReview = async (data: { rating: number; comment: string; review_type: string }) => {
    if (!customer) {
      toast({
        title: "Login Required",
        description: "Please login to submit a review.",
        variant: "destructive",
      });
      return;
    }

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

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit review');
      }

      toast({
        title: "Review Submitted! 🎉",
        description: "Thank you for sharing your experience.",
      });

      setShowReviewModal(false);
      setRemainingReviews(prev => Math.max(0, prev - 1));
      
      // Refresh reviews (force refresh to get new review)
      fetchReviews(true, true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle helpful
  const handleHelpful = async (reviewId: string) => {
    setHelpfulLoading(reviewId);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        setReviews(prev => 
          prev.map(r => 
            r.id === reviewId 
              ? { ...r, helpful_count: r.helpful_count + 1 }
              : r
          )
        );
      }
    } catch (error) {
      // Silent fail
    } finally {
      setHelpfulLoading(null);
    }
  };

  return (
    <>
      <div className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-background relative overflow-hidden">
        <motion.div 
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="absolute top-10 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
          </motion.div>

          <div className="container-custom relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <Badge variant="secondary" className="mb-4">
                <Star className="w-3 h-3 mr-1 fill-accent text-accent" />
                Customer Reviews
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bebas mb-4">
                What Our Customers Say
              </h1>
              <p className="text-lg text-muted-foreground">
                Real reviews from real customers. Your feedback helps us serve you better.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section ref={statsRef} className="py-12 border-b">
          <div className="container-custom">
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-8"
              initial="hidden"
              animate={statsInView ? "visible" : "hidden"}
              variants={containerVariants}
            >
              <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <p className="text-4xl md:text-5xl font-bebas text-primary">
                  {statsInView ? <AnimatedCounter value={stats?.total_reviews || 0} /> : '-'}
                </p>
                <p className="text-muted-foreground mt-1">Total Reviews</p>
              </motion.div>
              <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <p className="text-4xl md:text-5xl font-bebas text-primary flex items-center justify-center gap-1">
                  {statsInView ? (
                    <AnimatedCounter value={stats?.average_rating || 0} decimals={1} />
                  ) : '-'}
                  <Star className="w-8 h-8 text-accent fill-accent" />
                </p>
                <p className="text-muted-foreground mt-1">Average Rating</p>
              </motion.div>
              <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <p className="text-4xl md:text-5xl font-bebas text-primary">
                  {statsInView ? (
                    <AnimatedCounter value={stats?.five_star || 0} />
                  ) : '-'}
                </p>
                <p className="text-muted-foreground mt-1">5-Star Reviews</p>
              </motion.div>
              <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <p className="text-4xl md:text-5xl font-bebas text-primary">
                  {statsInView && stats?.total_reviews > 0 ? (
                    <AnimatedCounter 
                      value={Math.round(((stats.four_star + stats.five_star) / stats.total_reviews) * 100)} 
                      suffix="%" 
                    />
                  ) : '-'}
                </p>
                <p className="text-muted-foreground mt-1">Satisfaction</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Rating Distribution */}
        {stats && stats.total_reviews > 0 && (
          <section className="py-8 border-b">
            <div className="container-custom max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-4 text-center">Rating Distribution</h3>
              <div className="space-y-2">
                <RatingBar rating={5} count={stats.five_star} total={stats.total_reviews} delay={0} />
                <RatingBar rating={4} count={stats.four_star} total={stats.total_reviews} delay={0.1} />
                <RatingBar rating={3} count={stats.three_star} total={stats.total_reviews} delay={0.2} />
                <RatingBar rating={2} count={stats.two_star} total={stats.total_reviews} delay={0.3} />
                <RatingBar rating={1} count={stats.one_star} total={stats.total_reviews} delay={0.4} />
              </div>
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="py-6 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-20">
          <div className="container-custom">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter:</span>
                <Select 
                  value={filterRating?.toString() || "all"} 
                  onValueChange={(v) => setFilterRating(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={filterType || "all"} 
                  onValueChange={(v) => setFilterType(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="overall">Overall</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="item">Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="rating_high">Highest Rated</SelectItem>
                  <SelectItem value="rating_low">Lowest Rated</SelectItem>
                  <SelectItem value="helpful">Most Helpful</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Reviews Grid */}
        <section className="py-16 overflow-hidden relative" style={{ position: 'relative' }} ref={containerRef}>
          <motion.div 
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ y: bgY }}
          >
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
          </motion.div>

          <motion.div className="container-custom relative z-10" style={{ y: contentY }} ref={ref}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-20">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Reviews Yet</h3>
                <p className="text-muted-foreground mb-6">Be the first to share your experience!</p>
                {mounted && !authLoading && customer && (
                  <Button onClick={() => setShowReviewModal(true)}>
                    Write the First Review
                  </Button>
                )}
              </div>
            ) : (
              <>
                <motion.div
                  className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate={isInView ? "visible" : "hidden"}
                >
                  {reviews.map((review, index) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      index={index}
                      isInView={isInView}
                      onHelpful={handleHelpful}
                      helpfulLoading={helpfulLoading}
                    />
                  ))}
                </motion.div>

                {/* Load More */}
                {hasMore && (
                  <div className="text-center mt-12">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => fetchReviews(false)}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More Reviews
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-primary">
          <div className="container-custom text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <MessageSquare className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
              <h2 className="text-4xl font-bebas text-primary-foreground mb-4">
                Share Your Experience
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Loved our food? We'd love to hear from you! Your feedback helps us serve you better.
              </p>
              {mounted && !authLoading && customer ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowReviewModal(true)}
                  className="inline-flex items-center gap-2 bg-background text-foreground px-8 py-3 rounded-full font-semibold"
                >
                  Write a Review <ThumbsUp className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.a
                  href="/menu"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 bg-background text-foreground px-8 py-3 rounded-full font-semibold"
                >
                  Order Now <ThumbsUp className="w-5 h-5" />
                </motion.a>
              )}
            </motion.div>
          </div>
        </section>
      </div>

      {/* Review Form Modal */}
      <ReviewFormModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        onSubmit={handleSubmitReview}
        isSubmitting={isSubmitting}
        remainingReviews={remainingReviews}
      />
    </>
  );
}
