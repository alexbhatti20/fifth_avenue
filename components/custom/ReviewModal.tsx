import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/cookies";
import { MenuItem } from "@/data/menuData";

const REVIEWS_STORAGE_KEY = "zoiro_item_reviews";
const USER_DATA_KEY = "user_data";

export interface ItemReview {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

interface ReviewModalProps {
  item: MenuItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewSubmitted?: () => void;
  editReview?: ItemReview | null;
}

// Helper to get user data from localStorage
function getUserData() {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem(USER_DATA_KEY);
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

// Legacy localStorage functions (kept for backwards compatibility)
export function getItemReviews(itemId: string): ItemReview[] {
  const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
  if (!stored) return [];
  const allReviews: ItemReview[] = JSON.parse(stored);
  return allReviews.filter((r) => r.itemId === itemId);
}

export function getAllReviews(): ItemReview[] {
  const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

export function getAverageRating(itemId: string): number {
  const reviews = getItemReviews(itemId);
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function deleteReview(reviewId: string): boolean {
  const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
  if (!stored) return false;
  const allReviews: ItemReview[] = JSON.parse(stored);
  const filtered = allReviews.filter((r) => r.id !== reviewId);
  localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function updateReview(
  reviewId: string,
  updates: { rating: number; comment: string }
): boolean {
  const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
  if (!stored) return false;
  const allReviews: ItemReview[] = JSON.parse(stored);
  const index = allReviews.findIndex((r) => r.id === reviewId);
  if (index === -1) return false;
  allReviews[index] = {
    ...allReviews[index],
    ...updates,
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
  localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(allReviews));
  return true;
}

export function getCurrentUserId(): string | null {
  const user = getUserData();
  return user?.id || null;
}

export default function ReviewModal({
  item,
  open,
  onOpenChange,
  onReviewSubmitted,
  editReview,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Get user from user_data localStorage key (set by useAuth hook)
  const user = getUserData();
  const isEditMode = !!editReview;

  // Populate fields when editing
  useEffect(() => {
    if (editReview) {
      setRating(editReview.rating);
      setComment(editReview.comment);
    } else {
      setRating(0);
      setComment("");
    }
  }, [editReview, open]);

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to submit a review.",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (comment.trim().length < 10) {
      toast({
        title: "Review too short",
        description: "Please write at least 10 characters in your review.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get auth token from cookie/localStorage
      const token = getAuthToken();
      
      // Call the reviews API
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          review_type: 'item',
          item_id: item.id,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit review');
      }

      toast({
        title: "Review submitted! 🎉",
        description: result.is_verified 
          ? "Your verified review has been posted."
          : "Thank you for your feedback!",
      });

      setRating(0);
      setComment("");
      onOpenChange(false);
      onReviewSubmitted?.();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bebas text-2xl">
            {isEditMode ? "Edit Review" : `Review ${item.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Item preview */}
          <div className="flex items-center gap-4 p-3 bg-muted rounded-xl">
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div>
              <h4 className="font-semibold">{item.name}</h4>
              <p className="text-sm text-muted-foreground">Rs. {item.price}</p>
            </div>
          </div>

          {/* Star rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "text-accent fill-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Review</label>
            <Textarea
              placeholder="Share your experience with this item..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !user}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : !user ? (
              "Login to Review"
            ) : isEditMode ? (
              "Update Review"
            ) : (
              "Submit Review"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
