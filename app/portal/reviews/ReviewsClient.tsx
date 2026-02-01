'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  Star,
  MessageSquare,
  Reply,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  Send,
  RefreshCw,
  Package,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePortalAuth } from '@/hooks/usePortal';
import {
  getAdminReviewsAdvanced,
  updateReviewVisibility,
  replyToReviewAdvanced,
  deleteReviewAdvanced,
  bulkUpdateReviewVisibility,
  type AdminReviewAdvanced,
  type AllReviewStats,
  type ReviewStatusFilter,
  type ReviewSortBy,
} from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Reply Templates
const REPLY_TEMPLATES = [
  { id: 'thank', name: 'Thank You', text: 'Thank you for your review! We appreciate your feedback.' },
  { id: 'apology', name: 'Apology', text: 'We apologize for the inconvenience. We will do better.' },
  { id: 'delivery', name: 'Delivery Issue', text: 'We apologize for the delivery delay. We are working to improve our delivery times.' },
];

// Star Rating Component
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(sizeClass, star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')}
        />
      ))}
    </div>
  );
}

// Rating Distribution Component
function RatingDistribution({ stats }: { stats: AllReviewStats | null }) {
  if (!stats) return null;

  const distribution = [
    { rating: 5, count: stats.five_star || 0, color: 'bg-green-500' },
    { rating: 4, count: stats.four_star || 0, color: 'bg-lime-500' },
    { rating: 3, count: stats.three_star || 0, color: 'bg-yellow-500' },
    { rating: 2, count: stats.two_star || 0, color: 'bg-orange-500' },
    { rating: 1, count: stats.one_star || 0, color: 'bg-red-500' },
  ];

  const total = stats.total_reviews || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rating Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold">{(stats.average_rating || 0).toFixed(1)}</div>
          <StarRating rating={Math.round(stats.average_rating || 0)} size="md" />
          <p className="text-sm text-muted-foreground mt-1">{stats.total_reviews || 0} total reviews</p>
        </div>
        <Separator />
        <div className="space-y-2">
          {distribution.map(({ rating, count, color }) => (
            <div key={rating} className="flex items-center gap-2 text-sm">
              <span className="w-3">{rating}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-green-600 font-medium">{stats.visible_reviews || 0}</p>
            <p className="text-xs text-muted-foreground">Visible</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
            <p className="text-zinc-600 font-medium">{stats.hidden_reviews || 0}</p>
            <p className="text-xs text-muted-foreground">Hidden</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-blue-600 font-medium">{stats.verified_reviews || 0}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-orange-600 font-medium">{stats.pending_replies || 0}</p>
            <p className="text-xs text-muted-foreground">Need Reply</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Review Card Component - Simple version
function ReviewCard({
  review,
  isSelected,
  onSelect,
  onReply,
  onToggleVisibility,
  onDelete,
}: {
  review: AdminReviewAdvanced;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onReply: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const timeAgo = useMemo(() => {
    const date = new Date(review.created_at);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }, [review.created_at]);

  return (
    <Card className={cn(isSelected && "ring-2 ring-primary", !review.is_visible && "opacity-60")}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Checkbox checked={isSelected} onCheckedChange={onSelect} />
            <Avatar className="h-10 w-10">
              <AvatarFallback>{review.customer?.name?.[0] || 'A'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{review.customer?.name || 'Anonymous'}</span>
                <StarRating rating={review.rating} />
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
              {review.customer?.email && (
                <p className="text-xs text-muted-foreground">{review.customer.email}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReply}>
                <Reply className="h-4 w-4 mr-2" />
                {review.admin_reply ? 'Edit Reply' : 'Reply'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleVisibility}>
                {review.is_visible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {review.is_visible ? 'Hide Review' : 'Show Review'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Delete Review
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(review.item || review.meal) && (
          <Badge variant="outline" className="mt-2 ml-11">
            <Package className="h-3 w-3 mr-1" />
            {review.item?.name || review.meal?.name}
          </Badge>
        )}

        <p className="mt-3 ml-11 text-sm">{review.comment || <span className="italic text-muted-foreground">No comment</span>}</p>

        {review.admin_reply && (
          <div className="mt-4 ml-11 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />Owner Response
              </Badge>
              {review.replied_at && <span className="text-xs text-muted-foreground">{new Date(review.replied_at).toLocaleDateString()}</span>}
            </div>
            <p className="text-sm">{review.admin_reply}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Native HTML Dialog for Reply - avoids Radix Dialog issues
function ReplyDialog({
  review,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  review: AdminReviewAdvanced | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (reply: string) => void;
  isSubmitting: boolean;
}) {
  const [reply, setReply] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && review) {
      setReply(review.admin_reply || '');
      setShowTemplates(false);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, review]);

  // Handle backdrop click
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (!reply.trim() || isSubmitting) return;
    onSubmit(reply);
  };

  if (!review) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="fixed m-auto p-0 w-full max-w-2xl rounded-xl border-0 bg-transparent backdrop:bg-black/60"
    >
      <div className="bg-background rounded-xl border shadow-xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{review.admin_reply ? 'Edit Reply' : 'Reply to Review'}</h2>
            <p className="text-sm text-muted-foreground">Respond to {review.customer?.name || 'Anonymous'}&apos;s {review.rating}-star review</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Review Preview */}
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{review.customer?.name?.[0] || 'A'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{review.customer?.name || 'Anonymous'}</p>
              <StarRating rating={review.rating} />
            </div>
          </div>
          <p className="text-sm">{review.comment || 'No comment'}</p>
        </div>

        {/* Templates Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Your Response</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            {showTemplates ? 'Hide' : 'Use'} Templates
            {showTemplates ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="border rounded-lg p-2 space-y-2">
            {REPLY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setReply(t.text); setShowTemplates(false); }}
                className="w-full text-left p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.text}</p>
              </button>
            ))}
          </div>
        )}

        {/* Reply Input */}
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write your response..."
          rows={5}
          disabled={isSubmitting}
        />

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!reply.trim() || isSubmitting}>
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isSubmitting ? 'Sending...' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// Props Interface
interface ReviewsClientProps {
  initialReviews: AdminReviewAdvanced[];
  initialStats: AllReviewStats | null;
  initialTotalCount: number;
  initialHasMore: boolean;
}

// Main Component
export default function ReviewsClient({ initialReviews, initialStats }: ReviewsClientProps) {
  const { employee, isLoading: authLoading } = usePortalAuth();
  const router = useRouter();

  // State
  const [reviews, setReviews] = useState<AdminReviewAdvanced[]>(initialReviews ?? []);
  const [stats, setStats] = useState<AllReviewStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ReviewSortBy>('recent');

  // Selection
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Dialogs
  const [replyReview, setReplyReview] = useState<AdminReviewAdvanced | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState<'show' | 'hide' | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchingRef = useRef(false);

  // Authorization
  const isAuthorized = employee?.role === 'admin' || employee?.role === 'manager';

  // Fetch data
  const fetchData = useCallback(async () => {
    if (fetchingRef.current || !employee?.id) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const response = await getAdminReviewsAdvanced({
        status: statusFilter,
        minRating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
        maxRating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
        sortBy,
        limit: 100,
      }, employee.id);

      if (response.success) {
        setReviews(response.reviews);
        const rpcStats = (response as any).stats;
        if (rpcStats) {
          setStats({
            success: true,
            total_reviews: rpcStats.total || 0,
            visible_reviews: rpcStats.visible || 0,
            hidden_reviews: rpcStats.hidden || 0,
            verified_reviews: rpcStats.verified || 0,
            average_rating: rpcStats.avg_rating || 0,
            five_star: rpcStats.five_star || 0,
            four_star: rpcStats.four_star || 0,
            three_star: rpcStats.three_star || 0,
            two_star: rpcStats.two_star || 0,
            one_star: rpcStats.one_star || 0,
            pending_replies: rpcStats.pending_reply || 0,
            total_replied: rpcStats.replied || 0,
            this_week: 0, this_month: 0, today: 0, most_helpful: 0, avg_helpful: 0,
            by_type: {}, recent_avg_rating: rpcStats.avg_rating || 0, previous_avg_rating: 0,
          });
        }
      }
    } catch (error) {
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [employee?.id, statusFilter, ratingFilter, sortBy]);

  useEffect(() => {
    if (!authLoading && isAuthorized && (!initialReviews || initialReviews.length === 0)) {
      fetchData();
    }
  }, [authLoading, isAuthorized, fetchData, initialReviews]);

  useEffect(() => {
    if (!authLoading && !isAuthorized && employee !== null) {
      router.push('/portal');
    }
  }, [authLoading, isAuthorized, router, employee]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter((r) =>
      r.customer?.name?.toLowerCase().includes(q) ||
      r.customer?.email?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  }, [reviews, searchQuery]);

  // Handlers - using setTimeout to defer state updates
  const handleReply = useCallback(async (reply: string) => {
    if (!replyReview || isSubmittingReply) return;

    const reviewId = replyReview.id;
    setIsSubmittingReply(true);

    try {
      const result = await replyToReviewAdvanced(reviewId, reply, employee?.id);

      if (result.success) {
        // Close dialog first
        setReplyReview(null);
        setIsSubmittingReply(false);

        // Defer state update to next tick to avoid render conflict
        setTimeout(() => {
          setReviews((prev) =>
            prev.map((r) =>
              r.id === reviewId
                ? { ...r, admin_reply: reply, replied_at: new Date().toISOString() }
                : r
            )
          );
        }, 0);
      } else {
        setIsSubmittingReply(false);
        toast.error(result.error || 'Failed to send reply');
      }
    } catch (err) {
      console.error('Reply error:', err);
      setIsSubmittingReply(false);
      toast.error('Failed to send reply');
    }
  }, [replyReview, isSubmittingReply, employee?.id]);

  const handleToggleVisibility = useCallback(async (review: AdminReviewAdvanced) => {
    try {
      const result = await updateReviewVisibility(review.id, !review.is_visible, employee?.id);
      if (result.success) {
        setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, is_visible: !review.is_visible } : r));
        toast.success(review.is_visible ? 'Review hidden' : 'Review shown');
      } else {
        toast.error(result.error || 'Failed to update visibility');
      }
    } catch {
      toast.error('Failed to update visibility');
    }
  }, [employee?.id]);

  const handleDelete = useCallback(async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const result = await deleteReviewAdvanced(reviewId, employee?.id);
      if (result.success) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        setSelectedReviews((prev) => {
          const next = new Set(prev);
          next.delete(reviewId);
          return next;
        });
        toast.success('Review deleted');
      } else {
        toast.error(result.error || 'Failed to delete review');
      }
    } catch {
      toast.error('Failed to delete review');
    }
  }, [employee?.id]);

  const handleBulkVisibility = useCallback(async (isVisible: boolean) => {
    if (selectedReviews.size === 0) return;
    try {
      const result = await bulkUpdateReviewVisibility(Array.from(selectedReviews), isVisible, employee?.id);
      if (result.success) {
        setReviews((prev) => prev.map((r) => selectedReviews.has(r.id) ? { ...r, is_visible: isVisible } : r));
        setSelectedReviews(new Set());
        toast.success(`${result.affected_count || selectedReviews.size} reviews updated`);
      } else {
        toast.error(result.error || 'Failed to update reviews');
      }
    } catch {
      toast.error('Failed to update reviews');
    }
    setShowBulkDialog(null);
  }, [selectedReviews, employee?.id]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
      </div>
    );
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Not authorized to view reviews</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviews Management</h1>
          <p className="text-muted-foreground">Manage customer reviews and feedback</p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reviews..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReviewStatusFilter)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="visible">Visible</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                    <SelectItem value="pending_reply">Need Reply</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    {[5, 4, 3, 2, 1].map((r) => (
                      <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as ReviewSortBy)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="rating_high">Highest Rating</SelectItem>
                    <SelectItem value="rating_low">Lowest Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedReviews.size > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{selectedReviews.size} selected</span>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setShowBulkDialog('show')}>
                    <Eye className="h-4 w-4 mr-1" />Show
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowBulkDialog('hide')}>
                    <EyeOff className="h-4 w-4 mr-1" />Hide
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReviews(new Set())}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews List */}
          <ScrollArea className="h-[calc(100vh-350px)]">
            {isLoading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
                <p className="text-muted-foreground">Loading reviews...</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No reviews found</p>
              </div>
            ) : (
              <div className="space-y-4 pr-4">
                {filteredReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isSelected={selectedReviews.has(review.id)}
                    onSelect={(sel) => {
                      setSelectedReviews((prev) => {
                        const next = new Set(prev);
                        if (sel) next.add(review.id);
                        else next.delete(review.id);
                        return next;
                      });
                    }}
                    onReply={() => setReplyReview(review)}
                    onToggleVisibility={() => handleToggleVisibility(review)}
                    onDelete={() => handleDelete(review.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <RatingDistribution stats={stats} />
        </div>
      </div>

      {/* Reply Dialog - Native HTML dialog */}
      <ReplyDialog
        review={replyReview}
        open={replyReview !== null}
        onClose={() => setReplyReview(null)}
        onSubmit={handleReply}
        isSubmitting={isSubmittingReply}
      />

      {/* Bulk Dialog */}
      <AlertDialog open={showBulkDialog !== null} onOpenChange={() => setShowBulkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showBulkDialog === 'show' ? 'Show' : 'Hide'} {selectedReviews.size} reviews?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update visibility for all selected reviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkVisibility(showBulkDialog === 'show')}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
