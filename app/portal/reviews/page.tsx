'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Reply,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Send,
  RefreshCw,
  Filter,
  User,
  ShoppingBag,
  Package,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  X,
  FileText,
  Sparkles,
  Shield,
  EyeIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { SectionHeader, StatsCard } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import {
  getAdminReviewsAdvanced,
  getAllReviewStats,
  updateReviewVisibility,
  replyToReviewAdvanced,
  deleteReviewAdvanced,
  bulkUpdateReviewVisibility,
  setAllReviewsVisibility,
  type AdminReviewAdvanced,
  type AllReviewStats,
  type AdminReviewFilters,
  type ReviewStatusFilter,
  type ReviewSortBy,
} from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// =============================================
// REPLY TEMPLATES
// =============================================

const REPLY_TEMPLATES = [
  {
    id: 'thank_positive',
    name: 'Thank You (Positive)',
    text: 'Thank you so much for your wonderful review! We truly appreciate your kind words and are thrilled that you enjoyed your experience with us. Your feedback motivates our team to continue delivering excellent service. We look forward to serving you again soon!',
  },
  {
    id: 'thank_feedback',
    name: 'Thank You (General)',
    text: 'Thank you for taking the time to share your feedback with us. We value every customer\'s opinion and continuously strive to improve our services. We hope to see you again soon!',
  },
  {
    id: 'apologize_issue',
    name: 'Apology (Service Issue)',
    text: 'We sincerely apologize for the inconvenience you experienced. This does not reflect our usual standards, and we take your feedback very seriously. We have shared your concerns with our team and are taking steps to ensure this doesn\'t happen again. Please give us another chance to serve you better.',
  },
  {
    id: 'apologize_food',
    name: 'Apology (Food Quality)',
    text: 'We\'re truly sorry to hear that your meal did not meet your expectations. Quality is our top priority, and we are disappointed we fell short this time. Our kitchen team has been notified, and we\'d love the opportunity to make it up to you. Please contact us directly so we can make things right.',
  },
  {
    id: 'apologize_delivery',
    name: 'Apology (Delivery Issue)',
    text: 'We apologize for the delay in your delivery. We understand how frustrating this can be and are working to improve our delivery times. Thank you for your patience, and we hope to serve you better on your next order.',
  },
  {
    id: 'follow_up',
    name: 'Follow Up Request',
    text: 'Thank you for your feedback. We would like to learn more about your experience to better serve you. Could you please reach out to us at [contact] with more details? We genuinely want to resolve any concerns you may have.',
  },
  {
    id: 'invite_back',
    name: 'Invite Back',
    text: 'Thank you for sharing your thoughts with us. We\'d love to welcome you back and show you how we\'ve improved. As a token of our appreciation, we\'d like to offer you a special discount on your next visit. We hope to see you soon!',
  },
  {
    id: 'acknowledge_suggestion',
    name: 'Acknowledge Suggestion',
    text: 'Thank you for your valuable suggestion! We appreciate customers who help us improve. Your idea has been shared with our team, and we\'re always looking for ways to enhance our offerings. Stay tuned for updates!',
  },
];

// =============================================
// STAR RATING COMPONENT
// =============================================

function StarRating({ rating, size = 'sm', interactive = false, onChange }: { 
  rating: number; 
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 dark:text-zinc-600',
            interactive && 'cursor-pointer hover:scale-110 transition-transform'
          )}
          onClick={() => interactive && onChange?.(star)}
        />
      ))}
    </div>
  );
}

// =============================================
// RATING DISTRIBUTION COMPONENT
// =============================================

function RatingDistribution({ stats }: { stats: AllReviewStats | null }) {
  if (!stats) return null;

  const distribution = [
    { rating: 5, count: stats.five_star, color: 'bg-green-500' },
    { rating: 4, count: stats.four_star, color: 'bg-lime-500' },
    { rating: 3, count: stats.three_star, color: 'bg-yellow-500' },
    { rating: 2, count: stats.two_star, color: 'bg-orange-500' },
    { rating: 1, count: stats.one_star, color: 'bg-red-500' },
  ].map(d => ({
    ...d,
    percentage: stats.total_reviews > 0 ? (d.count / stats.total_reviews) * 100 : 0,
  }));

  const ratingTrend = stats.recent_avg_rating - stats.previous_avg_rating;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Rating Overview
          {ratingTrend !== 0 && (
            <Badge variant={ratingTrend > 0 ? 'default' : 'destructive'} className="text-xs">
              {ratingTrend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {ratingTrend > 0 ? '+' : ''}{ratingTrend.toFixed(1)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Rating */}
        <div className="text-center">
          <div className="text-4xl font-bold">{stats.average_rating?.toFixed(1) || '0.0'}</div>
          <StarRating rating={Math.round(stats.average_rating || 0)} size="md" />
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total_reviews} total reviews
          </p>
        </div>

        <Separator />

        {/* Distribution */}
        <div className="space-y-2">
          {distribution.map(({ rating, count, percentage, color }) => (
            <div key={rating} className="flex items-center gap-2 text-sm">
              <span className="w-3 font-medium">{rating}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-10 text-right text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-green-600 dark:text-green-400 font-medium">{stats.visible_reviews}</p>
            <p className="text-xs text-muted-foreground">Visible</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">{stats.hidden_reviews}</p>
            <p className="text-xs text-muted-foreground">Hidden</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-blue-600 dark:text-blue-400 font-medium">{stats.verified_reviews}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-orange-600 dark:text-orange-400 font-medium">{stats.pending_replies}</p>
            <p className="text-xs text-muted-foreground">Need Reply</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================
// CUSTOMER DETAILS SHEET
// =============================================

function CustomerDetailsSheet({ 
  customer, 
  open, 
  onOpenChange 
}: { 
  customer: AdminReviewAdvanced['customer'] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Customer Details</SheetTitle>
          <SheetDescription>View customer information</SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {customer.name?.[0]?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{customer.name}</h3>
              {customer.is_verified && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified Customer
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
            
            {customer.email && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{customer.email}</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
              </div>
            )}
            
            {customer.phone && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{customer.phone}</p>
                  <p className="text-xs text-muted-foreground">Phone</p>
                </div>
              </div>
            )}
            
            {customer.address && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{customer.address}</p>
                  <p className="text-xs text-muted-foreground">Address</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Stats */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Customer Stats</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <p className="text-2xl font-bold">{customer.total_orders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
              
              {customer.member_since && (
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <p className="text-sm font-semibold">
                    {new Date(customer.member_since).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============================================
// REPLY DIALOG WITH TEMPLATES
// =============================================

function ReplyDialog({
  review,
  open,
  onOpenChange,
  onReply,
  employeeId,
}: {
  review: AdminReviewAdvanced | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: (reviewId: string, reply: string) => Promise<void>;
  employeeId?: string;
}) {
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (open && review?.admin_reply) {
      setReply(review.admin_reply);
    } else if (open) {
      setReply('');
    }
    setShowTemplates(false);
  }, [open, review?.admin_reply]);

  const handleSubmit = async () => {
    if (!review || !reply.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onReply(review.id, reply);
      setReply('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyTemplate = (template: typeof REPLY_TEMPLATES[0]) => {
    setReply(template.text);
    setShowTemplates(false);
  };

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-5 w-5" />
            {review.admin_reply ? 'Edit Reply' : 'Reply to Review'}
          </DialogTitle>
          <DialogDescription>
            Respond to {review.customer?.name}'s {review.rating}-star review
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original Review */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{review.customer?.name?.[0] || 'A'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{review.customer?.name || 'Anonymous'}</p>
                  <StarRating rating={review.rating} size="sm" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
            
            {/* Item/Meal being reviewed */}
            {(review.item || review.meal) && (
              <div className="mb-3">
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Review for: {review.item?.name || review.meal?.name}
                </Badge>
              </div>
            )}
            
            <p className="text-sm">{review.comment || <span className="italic text-muted-foreground">No comment provided</span>}</p>
          </div>

          {/* Template Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Your Response</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {showTemplates ? 'Hide' : 'Use'} Templates
              {showTemplates ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
          </div>

          {/* Templates */}
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ScrollArea className="h-48 border rounded-lg p-2">
                  <div className="space-y-2">
                    {REPLY_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="w-full text-left p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {template.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reply Input */}
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your response to the customer..."
            rows={5}
            className="resize-none"
          />
          
          <p className="text-xs text-muted-foreground">
            {reply.length} characters • Recommended: 50-300 characters
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reply.trim() || isSubmitting}>
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Sending...' : review.admin_reply ? 'Update Reply' : 'Send Reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// REVIEW CARD COMPONENT
// =============================================

function ReviewCard({
  review,
  isSelected,
  onSelect,
  onReply,
  onToggleVisibility,
  onDelete,
  onViewCustomer,
}: {
  review: AdminReviewAdvanced;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onReply: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onViewCustomer: () => void;
}) {
  const timeAgo = useMemo(() => {
    const date = new Date(review.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }, [review.created_at]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={cn(
        "transition-all duration-200",
        isSelected && "ring-2 ring-primary",
        !review.is_visible && "opacity-60"
      )}>
        <CardContent className="pt-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-1"
              />
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                onClick={onViewCustomer}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {review.customer?.name?.[0]?.toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {review.customer?.name || 'Anonymous'}
                    {review.customer?.is_verified && (
                      <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!review.is_visible && (
                <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
              {review.is_verified && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified Purchase
                </Badge>
              )}
              {review.helpful_count > 0 && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {review.helpful_count}
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onReply}>
                    <Reply className="h-4 w-4 mr-2" />
                    {review.admin_reply ? 'Edit Reply' : 'Reply'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onViewCustomer}>
                    <User className="h-4 w-4 mr-2" />
                    View Customer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onToggleVisibility}>
                    {review.is_visible ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Hide Review
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show Review
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Review Type & Item/Meal */}
          <div className="flex flex-wrap items-center gap-2 mt-3 ml-12">
            {review.review_type && review.review_type !== 'overall' && (
              <Badge variant="secondary" className="capitalize">
                {review.review_type} Review
              </Badge>
            )}
            {review.item && (
              <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-600">
                <Package className="h-3 w-3 mr-1" />
                {review.item.name}
              </Badge>
            )}
            {review.meal && (
              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                <Sparkles className="h-3 w-3 mr-1" />
                {review.meal.name}
              </Badge>
            )}
            {review.order && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                <ShoppingBag className="h-3 w-3 mr-1" />
                Order #{review.order.order_number}
              </Badge>
            )}
          </div>

          {/* Comment */}
          <p className="text-sm text-muted-foreground mt-3 ml-12">
            {review.comment || <span className="italic">No comment provided</span>}
          </p>

          {/* Images */}
          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 mt-3 ml-12">
              {review.images.map((img, idx) => (
                <div key={idx} className="h-16 w-16 rounded-lg overflow-hidden bg-zinc-100">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Customer Contact Info (Mini) */}
          {(review.customer?.email || review.customer?.phone) && (
            <div className="flex flex-wrap items-center gap-4 mt-3 ml-12 text-xs text-muted-foreground">
              {review.customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {review.customer.email}
                </span>
              )}
              {review.customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {review.customer.phone}
                </span>
              )}
              {review.customer.total_orders > 0 && (
                <span className="flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" />
                  {review.customer.total_orders} orders
                </span>
              )}
            </div>
          )}

          {/* Admin Reply */}
          {review.admin_reply && (
            <div className="mt-4 ml-12 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-800">
                  <Shield className="h-3 w-3 mr-1" />
                  Owner Response
                </Badge>
                {review.replied_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.replied_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm">{review.admin_reply}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =============================================
// MAIN REVIEWS PAGE
// =============================================

export default function AdminReviewsPage() {
  const { employee, isLoading: authLoading, hasPermission } = usePortalAuth();
  const router = useRouter();
  
  // State
  const [reviews, setReviews] = useState<AdminReviewAdvanced[]>([]);
  const [stats, setStats] = useState<AllReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ReviewSortBy>('recent');
  
  // Selection
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [selectedReview, setSelectedReview] = useState<AdminReviewAdvanced | null>(null);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [customerToView, setCustomerToView] = useState<AdminReviewAdvanced['customer'] | null>(null);
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState<'show' | 'hide' | 'delete' | null>(null);
  const [showAllVisibilityDialog, setShowAllVisibilityDialog] = useState<'show' | 'hide' | null>(null);
  
  // Refs for preventing duplicate calls
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  // Check permissions - only admin and manager allowed
  const isAuthorized = useMemo(() => {
    if (!employee) return false;
    return employee.role === 'admin' || employee.role === 'manager';
  }, [employee]);

  // Build filters for API call
  const apiFilters = useMemo((): AdminReviewFilters => ({
    status: statusFilter,
    minRating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
    maxRating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
    sortBy,
    limit: 100,
    offset: 0,
  }), [statusFilter, ratingFilter, sortBy]);

  // Single data fetch function
  const fetchData = useCallback(async (showLoadingState = true) => {
    if (!isAuthorized || fetchingRef.current) return;
    
    fetchingRef.current = true;
    if (showLoadingState) setIsLoading(true);
    
    try {
      // Single batch of API calls - no duplicate calls
      const [reviewsResponse, statsResponse] = await Promise.all([
        getAdminReviewsAdvanced(apiFilters),
        getAllReviewStats(),
      ]);
      
      if (reviewsResponse.success) {
        setReviews(reviewsResponse.reviews);
      } else if (reviewsResponse.error) {
        toast.error(reviewsResponse.error);
      }
      
      if (statsResponse?.success !== false) {
        setStats(statsResponse);
      }
    } catch (error) {
      
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
      fetchingRef.current = false;
    }
  }, [isAuthorized, apiFilters]);

  // Initial data fetch - only once when authorized
  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthorized) {
      router.push('/portal');
      return;
    }
    
    // Only fetch on first load or when filters change
    if (!hasFetchedRef.current || !isInitialLoad) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [authLoading, isAuthorized, router, fetchData, isInitialLoad]);

  // Refetch when filters change (after initial load)
  useEffect(() => {
    if (!isInitialLoad && hasFetchedRef.current) {
      fetchData(false);
    }
  }, [apiFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter reviews by search query (client-side filtering)
  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    
    const query = searchQuery.toLowerCase();
    return reviews.filter((review) => 
      (review.customer?.name || '').toLowerCase().includes(query) ||
      (review.customer?.email || '').toLowerCase().includes(query) ||
      (review.comment || '').toLowerCase().includes(query) ||
      (review.item?.name || '').toLowerCase().includes(query) ||
      (review.meal?.name || '').toLowerCase().includes(query)
    );
  }, [reviews, searchQuery]);

  // Handlers
  const handleToggleVisibility = async (review: AdminReviewAdvanced) => {
    const result = await updateReviewVisibility(review.id, !review.is_visible);
    if (result.success) {
      setReviews(prev => 
        prev.map(r => r.id === review.id ? { ...r, is_visible: !review.is_visible } : r)
      );
      // Update stats locally
      if (stats) {
        setStats({
          ...stats,
          visible_reviews: stats.visible_reviews + (review.is_visible ? -1 : 1),
          hidden_reviews: stats.hidden_reviews + (review.is_visible ? 1 : -1),
        });
      }
      toast.success(`Review ${review.is_visible ? 'hidden' : 'shown'}`);
    } else {
      toast.error(result.error || 'Failed to update review');
    }
  };

  const handleReply = async (reviewId: string, reply: string) => {
    const result = await replyToReviewAdvanced(reviewId, reply, employee?.id);
    if (result.success) {
      setReviews(prev =>
        prev.map(r => 
          r.id === reviewId 
            ? { ...r, admin_reply: reply, replied_at: result.replied_at || new Date().toISOString() }
            : r
        )
      );
      // Update stats
      if (stats) {
        const hadReply = reviews.find(r => r.id === reviewId)?.admin_reply;
        if (!hadReply) {
          setStats({
            ...stats,
            pending_replies: stats.pending_replies - 1,
            total_replied: stats.total_replied + 1,
          });
        }
      }
      toast.success('Reply sent successfully');
      setIsReplyDialogOpen(false);
      setSelectedReview(null);
    } else {
      toast.error(result.error || 'Failed to send reply');
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;
    
    const result = await deleteReviewAdvanced(reviewId);
    if (result.success) {
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      setSelectedReviews(prev => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
      // Refresh stats after delete
      getAllReviewStats().then(s => s && setStats(s));
      toast.success('Review deleted');
    } else {
      toast.error(result.error || 'Failed to delete review');
    }
  };

  const handleBulkVisibility = async (isVisible: boolean) => {
    if (selectedReviews.size === 0) return;
    
    const result = await bulkUpdateReviewVisibility(Array.from(selectedReviews), isVisible);
    if (result.success) {
      setReviews(prev => 
        prev.map(r => selectedReviews.has(r.id) ? { ...r, is_visible: isVisible } : r)
      );
      setSelectedReviews(new Set());
      getAllReviewStats().then(s => s && setStats(s));
      toast.success(`${result.affected_count} reviews ${isVisible ? 'shown' : 'hidden'}`);
    } else {
      toast.error(result.error || 'Failed to update reviews');
    }
    setShowBulkDialog(null);
  };

  const handleSetAllVisibility = async (isVisible: boolean) => {
    const result = await setAllReviewsVisibility(isVisible);
    if (result.success) {
      setReviews(prev => prev.map(r => ({ ...r, is_visible: isVisible })));
      getAllReviewStats().then(s => s && setStats(s));
      toast.success(`All reviews ${isVisible ? 'shown' : 'hidden'}`);
    } else {
      toast.error(result.error || 'Failed to update reviews');
    }
    setShowAllVisibilityDialog(null);
  };

  const toggleSelectAll = () => {
    if (selectedReviews.size === filteredReviews.length) {
      setSelectedReviews(new Set());
    } else {
      setSelectedReviews(new Set(filteredReviews.map(r => r.id)));
    }
  };

  // Unauthorized state
  if (!authLoading && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          Only administrators and managers can access review management.
        </p>
        <Button onClick={() => router.push('/portal')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title="Review Management"
        description="Manage and respond to customer reviews • Admin & Manager only"
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Visibility
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowAllVisibilityDialog('show')}>
                  <Eye className="h-4 w-4 mr-2" />
                  Show All Reviews
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAllVisibilityDialog('hide')}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide All Reviews
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => fetchData()}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="Total Reviews"
          value={stats?.total_reviews || 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatsCard
          title="Average Rating"
          value={stats?.average_rating?.toFixed(1) || '0.0'}
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          change={stats?.recent_avg_rating && stats?.previous_avg_rating 
            ? `${(stats.recent_avg_rating - stats.previous_avg_rating) > 0 ? '+' : ''}${(stats.recent_avg_rating - stats.previous_avg_rating).toFixed(1)} vs last week`
            : undefined
          }
          changeType={stats?.recent_avg_rating && stats?.previous_avg_rating 
            ? (stats.recent_avg_rating - stats.previous_avg_rating) > 0 ? 'positive' : (stats.recent_avg_rating - stats.previous_avg_rating) < 0 ? 'negative' : 'neutral'
            : 'neutral'
          }
        />
        <StatsCard
          title="Pending Replies"
          value={stats?.pending_replies || 0}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
        />
        <StatsCard
          title="This Week"
          value={stats?.this_week || 0}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
        />
        <StatsCard
          title="Verified"
          value={stats?.verified_reviews || 0}
          icon={<CheckCircle className="h-5 w-5 text-blue-500" />}
        />
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, comment, or item..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReviewStatusFilter)}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="visible">Visible</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                    <SelectItem value="pending_reply">Pending Reply</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Rating Filter */}
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as ReviewSortBy)}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="rating_high">Highest Rating</SelectItem>
                    <SelectItem value="rating_low">Lowest Rating</SelectItem>
                    <SelectItem value="helpful">Most Helpful</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Bulk Actions */}
              {selectedReviews.size > 0 && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="flex items-center gap-2 mt-4 pt-4 border-t"
                >
                  <Checkbox
                    checked={selectedReviews.size === filteredReviews.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedReviews.size} selected
                  </span>
                  <div className="flex-1" />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBulkDialog('show')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Show
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBulkDialog('hide')}
                  >
                    <EyeOff className="h-4 w-4 mr-1" />
                    Hide
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedReviews(new Set())}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Reviews List */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            {isLoading && isInitialLoad ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
                <p>Loading reviews...</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No reviews found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? 'Try adjusting your search or filters' : 'Reviews will appear here'}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-4 pr-4">
                  {filteredReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      isSelected={selectedReviews.has(review.id)}
                      onSelect={(selected) => {
                        setSelectedReviews(prev => {
                          const next = new Set(prev);
                          if (selected) {
                            next.add(review.id);
                          } else {
                            next.delete(review.id);
                          }
                          return next;
                        });
                      }}
                      onReply={() => {
                        setSelectedReview(review);
                        setIsReplyDialogOpen(true);
                      }}
                      onToggleVisibility={() => handleToggleVisibility(review)}
                      onDelete={() => handleDelete(review.id)}
                      onViewCustomer={() => {
                        setCustomerToView(review.customer);
                        setIsCustomerSheetOpen(true);
                      }}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </ScrollArea>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <RatingDistribution stats={stats} />
          
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Today</span>
                <span className="font-medium">{stats?.today || 0} reviews</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">This Month</span>
                <span className="font-medium">{stats?.this_month || 0} reviews</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Replied</span>
                <span className="font-medium">{stats?.total_replied || 0} reviews</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Most Helpful</span>
                <span className="font-medium">{stats?.most_helpful || 0} votes</span>
              </div>
            </CardContent>
          </Card>

          {/* Review Types */}
          {stats?.by_type && Object.keys(stats.by_type).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{type || 'Overall'}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ReplyDialog
        review={selectedReview}
        open={isReplyDialogOpen}
        onOpenChange={setIsReplyDialogOpen}
        onReply={handleReply}
        employeeId={employee?.id}
      />

      <CustomerDetailsSheet
        customer={customerToView}
        open={isCustomerSheetOpen}
        onOpenChange={setIsCustomerSheetOpen}
      />

      {/* Bulk Action Confirmation */}
      <AlertDialog open={showBulkDialog !== null} onOpenChange={() => setShowBulkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showBulkDialog === 'show' ? 'Show' : 'Hide'} Selected Reviews?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {showBulkDialog === 'show' ? 'show' : 'hide'} {selectedReviews.size} selected reviews
              {showBulkDialog === 'show' ? ' on public pages' : ' from public pages'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkVisibility(showBulkDialog === 'show')}>
              {showBulkDialog === 'show' ? 'Show Reviews' : 'Hide Reviews'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show/Hide All Confirmation */}
      <AlertDialog open={showAllVisibilityDialog !== null} onOpenChange={() => setShowAllVisibilityDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {showAllVisibilityDialog === 'show' ? 'Show All' : 'Hide All'} Reviews?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {showAllVisibilityDialog === 'show' ? 'make all reviews visible on' : 'hide all reviews from'} public pages.
              This affects all {stats?.total_reviews || 0} reviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleSetAllVisibility(showAllVisibilityDialog === 'show')}
              className={showAllVisibilityDialog === 'hide' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {showAllVisibilityDialog === 'show' ? 'Show All Reviews' : 'Hide All Reviews'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
