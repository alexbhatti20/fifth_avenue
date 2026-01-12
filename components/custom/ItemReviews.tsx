import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquare, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/data/menuData";
import ReviewModal from "./ReviewModal";

interface Review {
  id: string;
  customer: {
    name: string;
    initial: string;
  };
  rating: number;
  comment: string;
  created_at: string;
  is_verified: boolean;
}

interface ItemReviewsProps {
  item: MenuItem;
}

export default function ItemReviews({ item }: ItemReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/customer/reviews?item_id=${item.id}&limit=10&sort=recent`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setAvgRating(data.stats?.average_rating || 0);
        setTotalReviews(data.stats?.total_reviews || 0);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const displayedReviews = expanded ? reviews : reviews.slice(0, 2);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.round(avgRating)
                    ? "text-accent fill-accent"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">
            {avgRating > 0 ? avgRating.toFixed(1) : "No ratings"}
          </span>
          <span className="text-sm text-muted-foreground">
            ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReviewModal(true)}
          className="text-primary hover:text-primary/80"
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          Review
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Reviews list */}
      {!isLoading && reviews.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {displayedReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="bg-muted/50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                      {review.customer.initial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{review.customer.name}</p>
                        {review.is_verified && (
                          <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Verified</span>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= review.rating
                                ? "text-accent fill-accent"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(review.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {reviews.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show {reviews.length - 2} more reviews
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && reviews.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No reviews yet. Be the first to review!
        </p>
      )}

      <ReviewModal
        item={item}
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        onReviewSubmitted={loadReviews}
      />
    </div>
  );
}
