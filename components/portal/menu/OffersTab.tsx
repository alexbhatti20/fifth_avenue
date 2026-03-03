'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  Calendar,
  Bell,
  Sparkles,
  Gift,
  Percent,
  Flag,
  Clock,
  Send,
  X,
  Check,
  ImagePlus,
  PartyPopper,
  Loader2,
  MoreVertical,
  Copy,
  Pause,
  Play,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NotificationProgress from '@/components/portal/NotificationProgress';
import { 
  SpecialOffer, 
  SpecialOfferItem, 
  OFFER_EVENT_TYPES, 
  OfferStatus 
} from '@/types/offers';
import type { MenuItemAdmin } from '@/lib/server-queries';

interface OffersTabProps {
  menuItems: MenuItemAdmin[];
  initialOffers?: SpecialOffer[];
  initialStats?: { total: number; active: number; scheduled: number; expired: number; draft: number };
}

export default function OffersTab({ menuItems, initialOffers, initialStats }: OffersTabProps) {
  const router = useRouter();
  const [offers, setOffers] = useState<SpecialOffer[]>(initialOffers || []);
  const [stats, setStats] = useState(initialStats || { total: 0, active: 0, scheduled: 0, expired: 0, draft: 0 });
  // Only show loading if no SSR data provided
  const [isLoading, setIsLoading] = useState(!initialOffers || initialOffers.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Notification settings
  const [notifyPush, setNotifyPush] = useState(true);
  const [forceResend, setForceResend] = useState(false);
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [showBulkNotifyDialog, setShowBulkNotifyDialog] = useState(false);
  const [bulkSendingIndex, setBulkSendingIndex] = useState(-1);
  const [bulkResults, setBulkResults] = useState<{ name: string; push: number }[]>([])

  // Load offers from API
  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    try {
      const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
      
      const response = await fetch('/api/offers', {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setOffers(data.offers || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Only fetch on mount if no SSR data was provided
  useEffect(() => {
    // Skip if we already have SSR data
    if (initialOffers && initialOffers.length > 0) {
      setIsLoading(false);
      return;
    }
    loadOffers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter offers
  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         offer.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Navigate to create page
  const handleCreateOffer = () => {
    router.push('/portal/offers/add');
  };

  // Navigate to edit page
  const handleEditOffer = (offer: SpecialOffer) => {
    router.push(`/portal/offers/${offer.id}`);
  };

  // Delete offer via API (SSR authenticated)
  const handleDeleteOffer = async () => {
    if (!selectedOffer) return;
    
    setIsSaving(true);
    
    try {
      const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
      
      // Delete banner image from storage if it exists
      if (selectedOffer.banner_image && accessToken) {
        try {
          const url = new URL(selectedOffer.banner_image);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/images\/(.+)/);
          const path = pathMatch?.[1];
          
          if (path) {
            await fetch(`/api/upload/image?bucket=images&path=${encodeURIComponent(path)}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });
          }
        } catch (imgError) {
          console.error('Error deleting offer image:', imgError);
          // Continue with offer deletion even if image delete fails
        }
      }

      // Delete offer via API route
      const response = await fetch(`/api/offers/${selectedOffer.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include', // Include cookies for SSR auth
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete offer');
      }
      
      toast.success('Offer deleted');
      setShowDeleteConfirm(false);
      setSelectedOffer(null);
      loadOffers();
    } catch (error: any) {
      console.error('Error deleting offer:', error);
      toast.error(error.message || 'Failed to delete offer');
    } finally {
      setIsSaving(false);
    }
  };

  // Open send notifications dialog
  const handleOpenNotifyDialog = (offer: SpecialOffer) => {
    setSelectedOffer(offer);
    setNotifyPush(offer.notify_via_push ?? true);
    setForceResend(false);
    setIsSendingNotifications(false);
    setShowNotifyDialog(true);
  };

  // Start sending notifications
  const handleStartSendNotifications = () => {
    if (!notifyPush) {
      toast.error('Enable push notifications to send');
      return;
    }
    setIsSendingNotifications(true);
  };

  // Handle notification complete
  const handleNotificationComplete = (results: { push: { sent: number; failed: number } }) => {
    const totalSent = results.push.sent;
    const totalFailed = results.push.failed;
    
    // Close dialog first
    setShowNotifyDialog(false);
    setIsSendingNotifications(false);
    setSelectedOffer(null);
    
    // Show toast after a small delay to ensure clean state
    setTimeout(() => {
      if (totalFailed === 0 && totalSent > 0) {
        toast.success(`Successfully sent ${totalSent} notifications!`);
      } else if (totalSent > 0) {
        toast.warning(`Sent ${totalSent} notifications, ${totalFailed} failed`);
      } else {
        toast.info('No notifications were sent');
      }
      loadOffers();
    }, 100);
  };

  // Handle notification cancel
  const handleNotificationCancel = () => {
    setIsSendingNotifications(false);
    setShowNotifyDialog(false);
    setSelectedOffer(null);
  };

  // Get status color
  const getStatusColor = (status: OfferStatus) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'scheduled': return 'bg-blue-500';
      case 'paused': return 'bg-amber-500';
      case 'expired': return 'bg-zinc-400';
      case 'draft': return 'bg-zinc-300';
      default: return 'bg-zinc-400';
    }
  };

  // Get event emoji
  const getEventEmoji = (eventType?: string) => {
    return OFFER_EVENT_TYPES.find(e => e.value === eventType)?.emoji || '✨';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700">
              <Gift className="h-4 w-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Sparkles className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.scheduled}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Scheduled</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 hidden sm:block">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Pause className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.draft}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 hidden sm:block">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700">
              <X className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-500">{stats.expired}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search offers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowBulkNotifyDialog(true)} 
            variant="outline"
            className="gap-2 border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            disabled={offers.filter(o => o.status === 'active').length === 0}
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Send All Offers</span>
          </Button>
          <Button onClick={handleCreateOffer} className="gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
            <Plus className="h-4 w-4" />
            Create Offer
          </Button>
        </div>
      </div>

      {/* Offers Grid */}
      {filteredOffers.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Offers Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Create your first special offer for Eid, Pakistan Day, or any event!'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button onClick={handleCreateOffer} className="gap-2">
              <Plus className="h-4 w-4" /> Create Your First Offer
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredOffers.map((offer) => (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
                  {/* Banner */}
                  <div 
                    className={cn(
                      "h-24 sm:h-32 relative bg-gradient-to-br",
                      offer.theme_colors?.primary 
                        ? `from-[${offer.theme_colors.primary}] to-[${offer.theme_colors.secondary}]`
                        : "from-red-500 to-red-700"
                    )}
                    style={{
                      background: offer.banner_image 
                        ? `url(${offer.banner_image}) center/cover`
                        : `linear-gradient(135deg, ${offer.theme_colors?.primary || '#dc2626'} 0%, ${offer.theme_colors?.secondary || '#991b1b'} 100%)`
                    }}
                  >
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <Badge className={cn("text-white border-0", getStatusColor(offer.status))}>
                        {offer.status}
                      </Badge>
                    </div>
                    
                    {/* Event Emoji */}
                    <div className="absolute top-2 right-2 text-2xl">
                      {getEventEmoji(offer.event_type)}
                    </div>
                    
                    {/* Pakistani Flags */}
                    {offer.pakistani_flags && (
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <span className="text-xl">🇵🇰</span>
                        <span className="text-xl">🇵🇰</span>
                      </div>
                    )}
                    
                    {/* Discount Badge */}
                    <div className="absolute bottom-2 left-2 px-3 py-1 bg-white/90 dark:bg-zinc-900/90 rounded-full text-sm font-bold">
                      {offer.discount_type === 'percentage' 
                        ? `${offer.discount_value}% OFF`
                        : `Rs ${offer.discount_value} OFF`}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{offer.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {offer.description || 'No description'}
                        </p>
                      </div>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onSelect={(e) => {
                              e.preventDefault();
                              handleEditOffer(offer);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onSelect={(e) => {
                              e.preventDefault();
                              setTimeout(() => handleOpenNotifyDialog(offer), 0);
                            }}
                          >
                            <Send className="h-4 w-4 mr-2" /> Send Notifications
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onSelect={(e) => {
                              e.preventDefault();
                              setTimeout(() => {
                                setSelectedOffer(offer);
                                setShowDeleteConfirm(true);
                              }, 0);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(offer.start_date).toLocaleDateString()} - {new Date(offer.end_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {offer.items_count || 0} items
                      </div>
                    </div>
                    
                    {/* Notification status */}
                    {offer.notify_via_push && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs">
                        <Bell className="h-3 w-3 text-green-500" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !isSaving && setShowDeleteConfirm(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete Offer?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedOffer?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteOffer}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Notifications Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={(open) => {
        if (!open && !isSendingNotifications) {
          setShowNotifyDialog(false);
          setSelectedOffer(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0">
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 p-6 pb-8">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmg0djJoMnY0aC0ydjJoLTR2LTJ6bTAtNGgydi0yaDJ2Mmgydi0yaC0ydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-3 text-white">
                  <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                    <Send className={cn("h-5 w-5", isSendingNotifications && "animate-pulse")} />
                  </div>
                  <span className="text-xl font-bold tracking-[0.2em]">
                    {isSendingNotifications ? 'SENDING NOTIFICATIONS' : 'SEND NOTIFICATIONS'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-white/80 text-sm tracking-wide pl-1">
                  {isSendingNotifications 
                    ? <>Sending to customers for <span className="font-semibold text-white">{selectedOffer?.name}</span></>
                    : <>Notify registered customers about <span className="font-semibold text-white">{selectedOffer?.name}</span></>
                  }
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          
          <div className="p-6 -mt-4 bg-background rounded-t-3xl relative">
            {!isSendingNotifications ? (
              <>
                <div className="space-y-4">
                  {/* Push Option */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-teal-500/15 p-5 border border-emerald-500/20 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
                          <Bell className="h-5 w-5 text-white" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold tracking-wide text-emerald-700 dark:text-emerald-300">
                            PUSH NOTIFICATIONS
                          </p>
                          <p className="text-sm text-muted-foreground tracking-wide">
                            Send to all registered browsers
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={notifyPush}
                        onCheckedChange={setNotifyPush}
                        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-600"
                      />
                    </div>
                  </div>

                  {/* Already sent warning */}
                  {selectedOffer?.notification_sent_at && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        ⚠️ Already sent on{' '}
                        {new Date(selectedOffer.notification_sent_at).toLocaleString('en-PK', {
                          dateStyle: 'medium', timeStyle: 'short'
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Customers have already received this offer. Enable Force Resend only if the offer changed significantly.
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium tracking-wide">Force Resend</span>
                        <Switch
                          checked={forceResend}
                          onCheckedChange={setForceResend}
                          className="data-[state=checked]:bg-amber-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                  <DialogFooter className="mt-6 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleNotificationCancel}
                    className="rounded-xl font-medium px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleStartSendNotifications}
                    disabled={!notifyPush || (!!selectedOffer?.notification_sent_at && !forceResend)}
                    className="gap-2 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 hover:from-red-600 hover:via-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 font-medium px-6"
                  >
                    <Send className="h-4 w-4" />
                    SEND NOW
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <NotificationProgress
                offerId={selectedOffer?.id || ''}
                offerName={selectedOffer?.name || ''}
                sendPush={notifyPush}
                forceResend={forceResend}
                onComplete={handleNotificationComplete}
                onCancel={handleNotificationCancel}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Send All Offers Dialog */}
      <Dialog open={showBulkNotifyDialog} onOpenChange={(open) => {
        if (!open && bulkSendingIndex === -1) {
          setShowBulkNotifyDialog(false);
          setBulkResults([]);
        }
      }}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0">
          <div className="relative bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 p-6 pb-8">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmg0djJoMnY0aC0ydjJoLTR2LTJ6bTAtNGgydi0yaDJ2Mmgydi0yaC0ydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-3 text-white">
                  <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className="text-xl font-bold tracking-[0.2em]">
                    SEND ALL OFFERS
                  </span>
                </DialogTitle>
                <DialogDescription className="text-white/80 text-sm tracking-wide pl-1">
                  Send notifications for all {offers.filter(o => o.status === 'active').length} active offers to customers
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          
          <div className="p-6 -mt-4 bg-background rounded-t-3xl relative">
            {bulkSendingIndex === -1 ? (
              <>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/50 dark:border-purple-800/50">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Active offers to notify:</p>
                    <div className="flex flex-wrap gap-2">
                      {offers.filter(o => o.status === 'active').map(offer => (
                        <Badge key={offer.id} variant="secondary" className="bg-white dark:bg-zinc-800">
                          {getEventEmoji(offer.event_type)} {offer.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Push Option - Push only for bulk */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-teal-500/15 p-5 border border-emerald-500/20">
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
                          <Bell className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300">Push Notifications</p>
                          <p className="text-sm text-muted-foreground">Send to all registered browsers</p>
                        </div>
                      </div>
                      <Switch checked={notifyPush} onCheckedChange={setNotifyPush} />
                    </div>
                  </div>
                </div>
                
                <DialogFooter className="mt-6 gap-3">
                  <Button variant="outline" onClick={() => setShowBulkNotifyDialog(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button 
                    onClick={async () => {
                      const activeOffers = offers.filter(o => o.status === 'active');
                      if (activeOffers.length === 0) {
                        toast.error('No active offers to send');
                        return;
                      }
                      
                      setBulkSendingIndex(0);
                      toast.loading('Sending notifications to all customers...', { id: 'bulk-notify' });
                      
                      try {
                        const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
                        const headers: HeadersInit = { 'Content-Type': 'application/json' };
                        if (accessToken) {
                          headers['Authorization'] = `Bearer ${accessToken}`;
                        }
                        
                        // Send all offers at once using bulk endpoint
                        const response = await fetch('/api/offers/notify/bulk', {
                          method: 'POST',
                          headers,
                          credentials: 'include',
                          body: JSON.stringify({ 
                            offerIds: activeOffers.map(o => o.id), 
                            sendPush: true 
                          }),
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to send notifications');
                        }
                        
                        // Show results
                        setBulkResults(activeOffers.map(offer => ({
                          name: offer.name,
                          push: Math.round((data.results?.push?.sent || 0) / activeOffers.length),
                        })));
                        
                        toast.success(
                          `Sent ${data.results?.push?.sent || 0} push notifications!`,
                          { id: 'bulk-notify' }
                        );
                      } catch (err: any) {
                        console.error('Bulk notify error:', err);
                        toast.error(err.message || 'Failed to send notifications', { id: 'bulk-notify' });
                      } finally {
                        setBulkSendingIndex(-1);
                      }
                    }}
                    className="gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-lg"
                  >
                    <Send className="h-4 w-4" />
                    Send All Now
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <p className="text-lg font-medium">
                    Sending {bulkSendingIndex + 1} of {offers.filter(o => o.status === 'active').length}...
                  </p>
                </div>
                <p className="text-center text-muted-foreground">
                  {offers.filter(o => o.status === 'active')[bulkSendingIndex]?.name}
                </p>
              </div>
            )}
            
            {bulkResults.length > 0 && bulkSendingIndex === -1 && (
              <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4" /> All offers sent successfully!
                </p>
                <div className="space-y-1 text-sm">
                  {bulkResults.map((r, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{r.name}</span>
                      <span>{r.push} push</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
