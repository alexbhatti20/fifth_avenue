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
  Sparkles
} from "lucide-react";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";
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
import { cn } from "@/lib/utils";

// Types
interface Review {
  id: string;
  customer: {
    name: string;
    initial: string;
  };
  rating: number;
  comment: string;
  review_type: string;
  images: string[];
  is_verified: boolean;
  helpful_count: number;
  item?: { id: string; name: string; image?: string } | null;
  meal?: { id: string; name: string; image?: string } | null;
  admin_reply?: string | null;
  replied_at?: string | null;
  created_at: string;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

interface ReviewsResponse {
  reviews: Review[];
  stats: ReviewStats;
  has_more: boolean;
  cached?: boolean;
}

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
  review: Review; 
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
        <Badge variant="outline" className="mb-3 text-xs bg-primary/5">
          {review.item?.name || review.meal?.name}
        </Badge>
      )}

      {/* Review type badge */}
      {review.review_type !== 'overall' && (
        <Badge variant="secondary" className="mb-3 ml-2 text-xs capitalize">
          {review.review_type}
        </Badge>
      )}

      {/* Comment */}
      <p className="text-muted-foreground mb-4 text-sm leading-relaxed line-clamp-4">
        "{review.comment}"
      </p>

      {/* Admin reply */}
      {review.admin_reply && (
        <div className="bg-primary/5 rounded-lg p-3 mb-4 border-l-2 border-primary">
          <p className="text-xs font-medium text-primary mb-1">Response from ZOIRO</p>
          <p className="text-xs text-muted-foreground">{review.admin_reply}</p>
        </div>
      )}

      {/* Author & helpful */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-semibold text-primary-foreground">
            {review.customer.initial}
          </div>
          <div>
            <p className="font-semibold text-sm">{review.customer.name}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => onHelpful(review.id)}
          disabled={helpfulLoading === review.id}
        >
          {helpfulLoading === review.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ThumbsUp className="h-3 w-3" />
          )}
          {review.helpful_count > 0 && review.helpful_count}
        </Button>
      </div>
    </motion.div>
  );
});

// Review Form Modal
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
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewType, setReviewType] = useState("overall");

  const handleSubmit = () => {
    if (rating === 0 || comment.trim().length < 10) return;
    onSubmit({ rating, comment: comment.trim(), review_type: reviewType });
  };

  const resetForm = () => {
    setRating(0);
    setComment("");
    setReviewType("overall");
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bebas text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Share Your Experience
          </DialogTitle>
          <DialogDescription>
            Your feedback helps us improve. You can submit {remainingReviews} more review{remainingReviews !== 1 ? 's' : ''} today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Review type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What are you reviewing?</label>
            <Select value={reviewType} onValueChange={setReviewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Experience</SelectItem>
                <SelectItem value="service">Service Quality</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="item">Food Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Star rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-all duration-200",
                      star <= (hoverRating || rating)
                        ? "text-accent fill-accent scale-110"
                        : "text-muted-foreground/30"
                    )}
                  />
                </motion.button>
              ))}
            </div>
            {rating > 0 && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-muted-foreground"
              >
                {rating === 5 && "Excellent! 🎉"}
                {rating === 4 && "Great! 😊"}
                {rating === 3 && "Good 👍"}
                {rating === 2 && "Fair 😐"}
                {rating === 1 && "Poor 😞"}
              </motion.p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Review</label>
            <Textarea
              placeholder="Share your experience... (minimum 10 characters)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{comment.length < 10 ? `${10 - comment.length} more characters needed` : "✓ Ready to submit"}</span>
              <span>{comment.length}/1000</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0 || comment.trim().length < 10}
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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const statsVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("recent");
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingReviews, setRemainingReviews] = useState(3);
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: customer, isLoading: authLoading } = useAuth();
  
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

  // Fetch reviews
  const fetchReviews = useCallback(async (reset = false) => {
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
        // Show empty state when API fails
        if (reset) {
          setReviews([]);
          setStats({ total_reviews: 0, average_rating: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 });
          setHasMore(false);
        }
        return;
      }
      
      const data: ReviewsResponse = await res.json();
      
      // Show real reviews or empty state
      if (reset) {
        setReviews(data.reviews || []);
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(newOffset + 20);
      } else {
        setReviews(prev => [...prev, ...(data.reviews || [])]);
        setStats(data.stats);
        setHasMore(data.has_more);
        setOffset(newOffset + 20);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      // Show empty state on error
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

  // Initial fetch
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
      const token = localStorage.getItem('auth_token');
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
        description: result.is_verified 
          ? "Your verified review has been posted."
          : "Thank you for your feedback!",
      });

      setRemainingReviews(result.reviews_remaining);
      setShowReviewModal(false);
      fetchReviews(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark as helpful
  const handleHelpful = async (reviewId: string) => {
    setHelpfulLoading(reviewId);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/customer/reviews/${reviewId}/helpful`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to mark as helpful');
      }

      // Update local state
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, helpful_count: r.helpful_count + 1 }
          : r
      ));

      toast({
        title: "Thanks!",
        description: "You marked this review as helpful.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Already marked as helpful",
        variant: "destructive",
      });
    } finally {
      setHelpfulLoading(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative py-24 bg-gradient-to-b from-foreground to-foreground/95 text-background overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container-custom relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <span className="text-primary font-semibold uppercase tracking-wider text-sm">
                Customer Reviews
              </span>
              <h1 className="text-5xl sm:text-6xl font-bebas mt-2 mb-4">
                What Our <span className="text-primary">Customers</span> Say
              </h1>
              <p className="text-background/70 text-lg mb-8">
                Real reviews from real customers. See what people love about ZOIRO.
              </p>
              
              {authLoading ? (
                <Button 
                  size="lg"
                  disabled
                  className="bg-primary/50"
                >
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </Button>
              ) : customer ? (
                <Button 
                  size="lg"
                  onClick={() => setShowReviewModal(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Write a Review
                </Button>
              ) : (
                <Button 
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => window.location.href = '/auth'}
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Login to Write a Review
                </Button>
              )}
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 bg-secondary" ref={statsRef}>
          <div className="container-custom">
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
              variants={containerVariants}
              initial="hidden"
              animate={statsInView ? "visible" : "hidden"}
            >
              <motion.div variants={statsVariants} whileHover={{ scale: 1.05 }}>
                <p className="text-5xl font-bebas text-primary">
                  {stats ? <AnimatedCounter value={stats.total_reviews} suffix="+" /> : '-'}
                </p>
                <p className="text-muted-foreground mt-1">Total Reviews</p>
              </motion.div>
              <motion.div variants={statsVariants} whileHover={{ scale: 1.05 }}>
                <p className="text-5xl font-bebas text-primary">
                  {stats ? <AnimatedCounter value={stats.average_rating} decimals={1} /> : '-'}
                </p>
                <p className="text-muted-foreground mt-1">Average Rating</p>
              </motion.div>
              <motion.div variants={statsVariants} whileHover={{ scale: 1.05 }}>
                <p className="text-5xl font-bebas text-primary">
                  {stats ? <AnimatedCounter value={stats.five_star} /> : '-'}
                </p>
                <p className="text-muted-foreground mt-1">5-Star Reviews</p>
              </motion.div>
              <motion.div variants={statsVariants} whileHover={{ scale: 1.05 }}>
                <p className="text-5xl font-bebas text-primary">
                  {stats ? (
                    <AnimatedCounter 
                      value={stats.total_reviews > 0 
                        ? Math.round(((stats.four_star + stats.five_star) / stats.total_reviews) * 100) 
                        : 0
                      } 
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
        <section className="py-16 overflow-hidden relative" ref={containerRef}>
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
                {customer && (
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
              {customer ? (
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
      </main>
      <Footer />

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
