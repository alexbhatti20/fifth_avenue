'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationProgress from '@/components/portal/NotificationProgress';
import {
  ArrowLeft,
  Save,
  Eye,
  Tag,
  Calendar,
  Bell,
  Sparkles,
  Gift,
  Percent,
  Flag,
  Clock,
  Send,
  Check,
  ImagePlus,
  PartyPopper,
  Loader2,
  Trash2,
  Plus,
  Search,
  X,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  OfferFormData, 
  OFFER_NAME_SUGGESTIONS,
  OFFER_THEME_PRESET,
  OfferDiscountType,
  OfferTargetType,
  SpecialOffer,
} from '@/types/offers';
import type { MenuItemAdmin } from '@/lib/server-queries';

interface Deal {
  id: string;
  name: string;
  slug?: string;
  image_url?: string;
  original_price?: number;
  discounted_price?: number;
  is_active?: boolean;
}

interface OfferFormClientProps {
  menuItems: MenuItemAdmin[];
  deals: Deal[];
  mode: 'create' | 'edit';
  initialOffer?: SpecialOffer;
}

const DEFAULT_FORM_DATA: OfferFormData = {
  name: '',
  description: '',
  event_type: 'custom',
  discount_type: 'percentage',
  discount_value: '', // String for better input handling
  start_date: new Date().toISOString().slice(0, 16),
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  banner_image: '',
  popup_image: '',
  theme_colors: { primary: OFFER_THEME_PRESET.primary, secondary: OFFER_THEME_PRESET.secondary },
  pakistani_flags: false,
  confetti_enabled: true,
  show_popup: true,
  popup_auto_close_seconds: 5,
  min_order_amount: '',
  notify_via_push: false,
  notify_via_email: false,
  auto_notify_on_start: false,
  target_type: 'storewide',
};

export default function OfferFormClient({ menuItems, deals, mode, initialOffer }: OfferFormClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Notification sending state
  const [showNotificationProgress, setShowNotificationProgress] = useState(false);
  const [savedOfferId, setSavedOfferId] = useState<string | null>(null);
  const [sendPushNow, setSendPushNow] = useState(false);
  const [forceResend, setForceResend] = useState(false);
  const [notifForceResend, setNotifForceResend] = useState(false);

  // Trigger notification send independently (edit mode)
  const handleSendNotificationsNow = () => {
    if (!initialOffer?.id) return;
    setSavedOfferId(initialOffer.id);
    setSendPushNow(formData.notify_via_push);
    setNotifForceResend(forceResend);
    setShowNotificationProgress(true);
  };
  
  // Form state - using strings for number inputs to handle clearing
  const [formData, setFormData] = useState<OfferFormData>(() => {
    if (initialOffer) {
      return {
        name: initialOffer.name,
        description: initialOffer.description || '',
        event_type: initialOffer.event_type || 'custom',
        discount_type: initialOffer.discount_type,
        discount_value: initialOffer.discount_value?.toString() || '',
        start_date: initialOffer.start_date?.slice(0, 16) || DEFAULT_FORM_DATA.start_date,
        end_date: initialOffer.end_date?.slice(0, 16) || DEFAULT_FORM_DATA.end_date,
        banner_image: initialOffer.banner_image || '',
        popup_image: initialOffer.popup_image || '',
        theme_colors: {
          primary: initialOffer.theme_colors?.primary || OFFER_THEME_PRESET.primary,
          secondary: initialOffer.theme_colors?.secondary || OFFER_THEME_PRESET.secondary,
        },
        pakistani_flags: initialOffer.pakistani_flags || false,
        confetti_enabled: initialOffer.confetti_enabled ?? true,
        show_popup: initialOffer.show_popup ?? true,
        popup_auto_close_seconds: initialOffer.popup_auto_close_seconds || 5,
        min_order_amount: initialOffer.min_order_amount?.toString() || '',
        max_discount_amount: initialOffer.max_discount_amount?.toString(),
        notify_via_push: initialOffer.notify_via_push || false,
        notify_via_email: initialOffer.notify_via_email || false,
        auto_notify_on_start: initialOffer.auto_notify_on_start || false,
        // Infer target_type from existing items/deals, default to storewide
        target_type: initialOffer.items?.length > 0 ? 'menu_items' : 'storewide',
      };
    }
    return DEFAULT_FORM_DATA;
  });

  // Image upload state
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  // Pending file selected but not yet uploaded — uploads happen on save
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Selected items state
  const [selectedItems, setSelectedItems] = useState<Array<{
    menu_item_id: string;
    name: string;
    image?: string;
    original_price: string;
    offer_price: string;
    size_variant?: string; // undefined = no sizes / single price
  }>>(() => {
    if (initialOffer?.items) {
      return initialOffer.items.map(item => ({
        menu_item_id: item.menu_item_id,
        name: item.menu_item?.name || '',
        image: item.menu_item?.images?.[0],
        original_price: item.original_price?.toString() || '',
        offer_price: item.offer_price?.toString() || '',
        size_variant: item.size_variant,
      }));
    }
    return [];
  });

  // Selected deals state
  const [selectedDeals, setSelectedDeals] = useState<Array<{
    deal_id: string;
    name: string;
    image?: string;
    original_price: string;
    offer_price: string;
  }>>(() => {
    if ((initialOffer as any)?.deals) {
      return (initialOffer as any).deals.map((deal: any) => ({
        deal_id: deal.deal_id,
        name: deal.deal?.name || '',
        image: deal.deal?.image,
        original_price: deal.original_price?.toString() || '',
        offer_price: deal.offer_price?.toString() || '',
      }));
    }
    return [];
  });

  const [itemSearch, setItemSearch] = useState('');
  const [dealSearch, setDealSearch] = useState('');

  // Filter available items (not already selected)
  const availableItems = menuItems.filter(
    item => !selectedItems.some(s => s.menu_item_id === item.id) &&
            item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // Filter available deals (not already selected)
  const availableDeals = deals.filter(
    deal => !selectedDeals.some(s => s.deal_id === deal.id) &&
            deal.name.toLowerCase().includes(dealSearch.toLowerCase())
  );

  // Add menu item — expands into per-size rows when the item has size variants
  const addMenuItem = (item: MenuItemAdmin) => {
    const discountPct = formData.discount_type === 'percentage' ? parseFloat(formData.discount_value) || 0 : 0;
    const fixedOff   = formData.discount_type === 'fixed_amount' ? parseFloat(formData.discount_value) || 0 : 0;

    const calcOffer = (price: number) => {
      if (discountPct > 0) return Math.round(price * (1 - discountPct / 100));
      if (fixedOff > 0)   return Math.max(0, Math.round(price - fixedOff));
      return price;
    };

    if (item.has_variants && item.size_variants && item.size_variants.length > 0) {
      // One row per available size
      const newRows = item.size_variants
        .filter(sv => sv.is_available)
        .map(sv => ({
          menu_item_id: item.id,
          name: item.name,
          image: item.images?.[0],
          original_price: sv.price.toString(),
          offer_price: calcOffer(sv.price).toString(),
          size_variant: sv.size,
        }));
      setSelectedItems([...selectedItems, ...newRows]);
    } else {
      const price = item.price || 0;
      setSelectedItems([...selectedItems, {
        menu_item_id: item.id,
        name: item.name,
        image: item.images?.[0],
        original_price: price.toString(),
        offer_price: calcOffer(price).toString(),
      }]);
    }
    setItemSearch('');
  };

  // Add deal
  const addDeal = (deal: Deal) => {
    const price = deal.original_price || deal.discounted_price || 0;
    const discountedPrice = formData.discount_value
      ? price * (1 - parseFloat(formData.discount_value) / 100)
      : price;
    
    setSelectedDeals([...selectedDeals, {
      deal_id: deal.id,
      name: deal.name,
      image: deal.image_url,
      original_price: price.toString(),
      offer_price: Math.round(discountedPrice).toString(),
    }]);
    setDealSearch('');
  };

  // Remove menu item (matches by menu_item_id + size_variant)
  const removeMenuItem = (menu_item_id: string, size_variant?: string) => {
    setSelectedItems(selectedItems.filter(i =>
      !(i.menu_item_id === menu_item_id && i.size_variant === size_variant)
    ));
  };

  // Remove deal
  const removeDeal = (deal_id: string) => {
    setSelectedDeals(selectedDeals.filter(d => d.deal_id !== deal_id));
  };

  // Update item prices (matches by menu_item_id + size_variant)
  const updateItemPrice = (menu_item_id: string, field: 'original_price' | 'offer_price', value: string, size_variant?: string) => {
    setSelectedItems(selectedItems.map(i =>
      i.menu_item_id === menu_item_id && i.size_variant === size_variant
        ? { ...i, [field]: value }
        : i
    ));
  };

  // Select banner image — just preview locally, upload happens on save
  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be less than 8MB'); return; }
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    const preview = URL.createObjectURL(file);
    setPendingBannerFile(file);
    setBannerPreview(preview);
    setFormData(prev => ({ ...prev, banner_image: '' }));
    event.target.value = '';
  };

  // Upload pending file to storage — called from handleSave
  const uploadPendingBanner = async (): Promise<string> => {
    if (!pendingBannerFile) return formData.banner_image || '';
    const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
    if (!accessToken) throw new Error('Please log in to upload images');
    const fd = new FormData();
    fd.append('file', pendingBannerFile);
    fd.append('bucket', 'images');
    fd.append('folder', 'offers/banners');
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload image');
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
    setPendingBannerFile(null);
    return data.url as string;
  };

  // Delete banner image handler
  const handleDeleteBannerImage = async () => {
    // Local pending file only – no server delete needed
    if (pendingBannerFile) {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setPendingBannerFile(null);
      setBannerPreview(null);
      return;
    }
    if (!formData.banner_image) return;

    try {
      // Get auth token from localStorage (consistent with rest of codebase)
      const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
      
      if (!accessToken) {
        toast.error('Please log in to delete images');
        return;
      }

      // Extract path from URL
      const url = new URL(formData.banner_image);
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

      setFormData(prev => ({ ...prev, banner_image: '' }));
      toast.success('Banner image removed');
    } catch (error) {
      console.error('Delete error:', error);
      // Still clear the image from form even if delete fails
      setFormData(prev => ({ ...prev, banner_image: '' }));
    }
  };

  // Update deal prices
  const updateDealPrice = (deal_id: string, field: 'original_price' | 'offer_price', value: string) => {
    setSelectedDeals(selectedDeals.map(d => 
      d.deal_id === deal_id ? { ...d, [field]: value } : d
    ));
  };

  // Apply global discount to all items
  const applyGlobalDiscount = () => {
    const discount = parseFloat(formData.discount_value) || 0;
    if (discount <= 0 || discount > 100) {
      toast.error('Enter a valid discount percentage (1-100)');
      return;
    }
    
    setSelectedItems(selectedItems.map(item => ({
      ...item,
      offer_price: Math.round(parseFloat(item.original_price) * (1 - discount / 100)).toString(),
    })));
    
    setSelectedDeals(selectedDeals.map(deal => ({
      ...deal,
      offer_price: Math.round(parseFloat(deal.original_price) * (1 - discount / 100)).toString(),
    })));
    
    toast.success(`Applied ${discount}% discount to all items`);
  };

  // Save offer
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Offer name is required');
      setActiveTab('details');
      return;
    }
    
    const discountValue = parseFloat(formData.discount_value) || 0;
    const requiresDiscount = formData.target_type === 'storewide';
    if (requiresDiscount && discountValue <= 0) {
      toast.error('Discount value is required for storewide offers - go to Details tab');
      setActiveTab('details');
      return;
    }
    
    // Only validate item/deal selection for specific target types (not storewide)
    if (formData.target_type === 'menu_items' && selectedItems.length === 0) {
      toast.error('Select at least one menu item');
      return;
    }
    
    if (formData.target_type === 'deals' && selectedDeals.length === 0) {
      toast.error('Select at least one deal');
      return;
    }
    
    if (formData.target_type === 'both' && selectedItems.length === 0 && selectedDeals.length === 0) {
      toast.error('Select at least one item or deal');
      return;
    }
    
    // Storewide offers don't require item selection
    
    toast.loading(mode === 'create' ? 'Creating offer...' : 'Saving changes...', { id: 'save-offer' });
    setIsSaving(true);
    
    try {
      let offerId = initialOffer?.id;

      // Upload banner if user selected a new file
      let bannerUrl = formData.banner_image || '';
      if (pendingBannerFile) {
        toast.loading('Uploading banner image...', { id: 'save-offer' });
        setIsUploadingBanner(true);
        try {
          bannerUrl = await uploadPendingBanner();
          setFormData(prev => ({ ...prev, banner_image: bannerUrl }));
        } finally {
          setIsUploadingBanner(false);
        }
        toast.loading(mode === 'create' ? 'Creating offer...' : 'Saving changes...', { id: 'save-offer' });
      }
      const itemsData = selectedItems.map(item => ({
        menu_item_id: item.menu_item_id,
        original_price: item.original_price,
        offer_price: item.offer_price,
        ...(item.size_variant ? { size_variant: item.size_variant } : {}),
      }));
      
      const dealsData = selectedDeals.map(deal => ({
        deal_id: deal.deal_id,
        original_price: deal.original_price,
        offer_price: deal.offer_price,
      }));
      
      if (mode === 'create') {
        // Create offer via API
        const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
        const response = await fetch('/api/offers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description || null,
            event_type: formData.event_type,
            discount_type: formData.discount_type,
            discount_value: discountValue,
            start_date: formData.start_date,
            end_date: formData.end_date,
            banner_image: bannerUrl || null,
            theme_colors: formData.theme_colors,
            pakistani_flags: formData.pakistani_flags,
            confetti_enabled: formData.confetti_enabled,
            show_popup: formData.show_popup,
            popup_auto_close_seconds: formData.popup_auto_close_seconds,
            min_order_amount: formData.min_order_amount,
            max_discount_amount: formData.max_discount_amount || null,
            notify_via_push: formData.notify_via_push,
            auto_notify_on_start: formData.auto_notify_on_start,
            items: itemsData,
            deals: dealsData,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create offer');
        }
        
        offerId = data.offer_id;
      } else {
        // Update offer via API
        const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
        const response = await fetch(`/api/offers/${offerId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description || null,
            event_type: formData.event_type,
            discount_type: formData.discount_type,
            discount_value: discountValue,
            start_date: formData.start_date,
            end_date: formData.end_date,
            banner_image: bannerUrl || null,
            theme_colors: formData.theme_colors,
            pakistani_flags: formData.pakistani_flags,
            confetti_enabled: formData.confetti_enabled,
            show_popup: formData.show_popup,
            popup_auto_close_seconds: formData.popup_auto_close_seconds,
            min_order_amount: formData.min_order_amount,
            max_discount_amount: formData.max_discount_amount || null,
            notify_via_push: formData.notify_via_push,
            auto_notify_on_start: formData.auto_notify_on_start,
            items: itemsData,
            deals: dealsData,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update offer');
        }
      }
      
      toast.success(mode === 'create' ? 'Offer created successfully!' : 'Offer updated successfully!', { id: 'save-offer' });
      
      // Check if notifications should be sent
      if (formData.notify_via_push && offerId) {
        setSavedOfferId(offerId);
        setSendPushNow(formData.notify_via_push);
        setNotifForceResend(true); // save-triggered always forces
        setShowNotificationProgress(true);
        setIsSaving(false);
        return; // Don't redirect yet - wait for notification to complete
      }
      
      router.push('/portal/menu?tab=offers');
      router.refresh();
    } catch (error: any) {
      console.error('Error saving offer:', error);
      toast.error(error.message || 'Failed to save offer', { id: 'save-offer' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle notification completion - close modal and redirect
  const handleNotificationComplete = (results: { push: { sent: number; failed: number } }) => {
    setShowNotificationProgress(false);
    router.push('/portal/menu?tab=offers');
    router.refresh();
  };

  const handleNotificationClose = () => {
    setShowNotificationProgress(false);
    router.push('/portal/menu?tab=offers');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {mode === 'create' ? 'Create New Offer' : 'Edit Offer'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Set up special discounts for events and promotions
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Validation hints */}
            {(() => {
              const hasItems = selectedItems.length > 0 || selectedDeals.length > 0;
              const discountRequired = !hasItems;
              const missingName = !formData.name.trim();
              const missingDiscount = discountRequired && !parseFloat(formData.discount_value);
              return (missingName || missingDiscount) ? (
                <div className="text-sm text-amber-600 flex items-center gap-1">
                  <span>Missing:</span>
                  {missingName && <Badge variant="outline" className="text-amber-600 border-amber-300">Name</Badge>}
                  {missingDiscount && <Badge variant="outline" className="text-amber-600 border-amber-300">Discount</Badge>}
                </div>
              ) : null;
            })()}
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim() || (selectedItems.length === 0 && selectedDeals.length === 0 && !parseFloat(formData.discount_value))}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Create Offer' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="details" className="gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Items</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-red-500" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Offer Name */}
                  <div className="space-y-2">
                    <Label>Offer Name *</Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g., Eid Special 25% Off"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        list="offer-name-suggestions"
                        className="pr-10"
                      />
                      <Tag className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <datalist id="offer-name-suggestions">
                        {OFFER_NAME_SUGGESTIONS.map((suggestion) => (
                          <option key={suggestion} value={suggestion} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe your offer..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Event Type removed — offer name serves the same purpose */}

                </CardContent>
              </Card>

              {/* Discount Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-green-500" />
                    Discount Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Discount Type */}
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select 
                      value={formData.discount_type} 
                      onValueChange={(value: OfferDiscountType) => setFormData({ ...formData, discount_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage Off (%)</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount Off (Rs)</SelectItem>
                        <SelectItem value="buy_x_get_y">Buy X Get Y Free</SelectItem>
                        <SelectItem value="bundle_price">Bundle Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Discount Value */}
                  <div className="space-y-2">
                    <Label>
                      {formData.discount_type === 'percentage' ? 'Discount Percentage' : 
                       formData.discount_type === 'fixed_amount' ? 'Discount Amount (Rs)' : 
                       'Value'}
                      {formData.target_type === 'storewide' ? ' *' : ' (optional)'}
                    </Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={formData.discount_type === 'percentage' ? '20' : '100'}
                        value={formData.discount_value}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setFormData({ ...formData, discount_value: value });
                        }}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {formData.discount_type === 'percentage' ? '%' : 'Rs'}
                      </span>
                    </div>
                  </div>

                  {/* Min Order Amount */}
                  <div className="space-y-2">
                    <Label>Minimum Order Amount</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={formData.min_order_amount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({ ...formData, min_order_amount: value });
                        }}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                    </div>
                  </div>

                  {/* Max Discount (for percentage) */}
                  {formData.discount_type === 'percentage' && (
                    <div className="space-y-2">
                      <Label>Maximum Discount Cap</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="No limit"
                          value={formData.max_discount_amount || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({ ...formData, max_discount_amount: value || undefined });
                          }}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Date & Time */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-6">
            {/* Target Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-purple-500" />
                  Apply Offer To
                </CardTitle>
                <CardDescription>
                  Choose whether this offer applies to the entire store or specific items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'storewide' as OfferTargetType, label: 'Entire Store', icon: Sparkles, description: 'No item selection needed' },
                    { value: 'menu_items' as OfferTargetType, label: 'Menu Items Only', icon: Package, description: 'Select specific items' },
                    { value: 'deals' as OfferTargetType, label: 'Deals Only', icon: Gift, description: 'Select specific deals' },
                    { value: 'both' as OfferTargetType, label: 'Items & Deals', icon: ShoppingBag, description: 'Select both' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={formData.target_type === option.value ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, target_type: option.value })}
                      className={cn(
                        formData.target_type === option.value && 'bg-red-500 hover:bg-red-600'
                      )}
                    >
                      <option.icon className="h-4 w-4 mr-2" />
                      {option.label}
                    </Button>
                  ))}
                </div>
                
                {formData.target_type === 'storewide' && (
                  <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-600">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-medium">Storewide Offer</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      This offer will apply to all orders automatically. No item selection needed.
                    </p>
                  </div>
                )}
                
                {formData.discount_value && formData.target_type !== 'storewide' && (
                  <div className="mt-4 flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={applyGlobalDiscount}
                    >
                      <Percent className="h-4 w-4 mr-2" />
                      Apply {formData.discount_value}% to All
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Applies global discount to selected items/deals
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Menu Items Selection */}
            {(formData.target_type === 'menu_items' || formData.target_type === 'both') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-500" />
                    Menu Items
                    {selectedItems.length > 0 && (
                      <Badge variant="secondary">{selectedItems.length} selected</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search & Add */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search menu items to add..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Available Items */}
                  {availableItems.length > 0 && (
                    <ScrollArea className="h-48 rounded-md border">
                      <div className="p-2 space-y-1">
                        {availableItems.slice(0, 15).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addMenuItem(item)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                          >
                            {item.images?.[0] && (
                              <img 
                                src={item.images[0]} 
                                alt={item.name}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Rs {item.price}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-green-500" />
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  <Separator />
                  
                  {/* Selected Items */}
                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No items selected</p>
                      <p className="text-sm">Search and add menu items above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedItems.map((item) => {
                        const rowKey = `${item.menu_item_id}__${item.size_variant ?? ''}`;
                        return (
                        <div key={rowKey} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          {item.image && (
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.size_variant && (
                              <Badge variant="outline" className="mt-0.5 text-xs">{item.size_variant}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Original</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={item.original_price}
                                onChange={(e) => updateItemPrice(item.menu_item_id, 'original_price', e.target.value.replace(/[^0-9]/g, ''), item.size_variant)}
                                className="w-24 h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-green-600">Offer Price</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={item.offer_price}
                                onChange={(e) => updateItemPrice(item.menu_item_id, 'offer_price', e.target.value.replace(/[^0-9]/g, ''), item.size_variant)}
                                className="w-24 h-8 border-green-500"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMenuItem(item.menu_item_id, item.size_variant)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Deals Selection */}
            {(formData.target_type === 'deals' || formData.target_type === 'both') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-pink-500" />
                    Deals
                    {selectedDeals.length > 0 && (
                      <Badge variant="secondary">{selectedDeals.length} selected</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search & Add */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search deals to add..."
                      value={dealSearch}
                      onChange={(e) => setDealSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Available Deals */}
                  {availableDeals.length > 0 && (
                    <ScrollArea className="h-48 rounded-md border">
                      <div className="p-2 space-y-1">
                        {availableDeals.slice(0, 15).map((deal) => (
                          <button
                            key={deal.id}
                            onClick={() => addDeal(deal)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                          >
                            {deal.image_url && (
                              <img 
                                src={deal.image_url} 
                                alt={deal.name}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{deal.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Rs {deal.original_price || deal.discounted_price}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-green-500" />
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  {deals.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No active deals available</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  {/* Selected Deals */}
                  {selectedDeals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No deals selected</p>
                      <p className="text-sm">Search and add deals above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDeals.map((deal) => (
                        <div key={deal.deal_id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          {deal.image && (
                            <img 
                              src={deal.image} 
                              alt={deal.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{deal.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Original</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={deal.original_price}
                                onChange={(e) => updateDealPrice(deal.deal_id, 'original_price', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-24 h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-green-600">Offer Price</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={deal.offer_price}
                                onChange={(e) => updateDealPrice(deal.deal_id, 'offer_price', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-24 h-8 border-green-500"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDeal(deal.deal_id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Banner Image Upload - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-blue-500" />
                  Banner Image
                </CardTitle>
                <CardDescription>
                  Upload a banner image for the offer (converted to WebP on save)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(bannerPreview || formData.banner_image) ? (
                    <div className="relative group">
                      {pendingBannerFile && (
                        <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                          Will upload on save
                        </div>
                      )}
                      <img
                        src={bannerPreview || formData.banner_image}
                        alt="Banner preview"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBannerUpload}
                            className="hidden"
                            disabled={isUploadingBanner}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="pointer-events-none"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Replace
                          </Button>
                        </label>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteBannerImage}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerUpload}
                        className="hidden"
                        disabled={isUploadingBanner}
                      />
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors">
                        {isUploadingBanner ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Uploading & converting to WebP...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <ImagePlus className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Click to select banner image</p>
                            <p className="text-xs text-muted-foreground">
                              PNG, JPG up to 8MB — uploaded &amp; converted to WebP on save
                            </p>
                          </div>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Visual Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PartyPopper className="h-5 w-5 text-yellow-500" />
                    Visual Effects
                  </CardTitle>
                  <CardDescription>
                    Enhance your offer with animations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Theme Preview */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      {formData.pakistani_flags && <span className="text-2xl">🇵🇰</span>}
                      <span className="font-bold">Preview</span>
                      {formData.confetti_enabled && <Sparkles className="h-4 w-4 animate-pulse" />}
                    </div>
                    <p className="text-sm opacity-90">Zoiro Red Theme with animation</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Show Pakistani Flags 🇵🇰</Label>
                        <p className="text-sm text-muted-foreground">For national events</p>
                      </div>
                      <Switch
                        checked={formData.pakistani_flags}
                        onCheckedChange={(checked) => setFormData({ ...formData, pakistani_flags: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Confetti Animation 🎊</Label>
                        <p className="text-sm text-muted-foreground">Show celebration effect</p>
                      </div>
                      <Switch
                        checked={formData.confetti_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, confetti_enabled: checked })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Popup Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-cyan-500" />
                    Popup Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Popup on Landing</Label>
                      <p className="text-sm text-muted-foreground">Show offer when visitors arrive</p>
                    </div>
                    <Switch
                      checked={formData.show_popup}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_popup: checked })}
                    />
                  </div>

                  {formData.show_popup && (
                    <div className="space-y-2">
                      <Label>Auto-close after (seconds)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={formData.popup_auto_close_seconds}
                        onChange={(e) => setFormData({ ...formData, popup_auto_close_seconds: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-purple-500" />
                    Notifications
                  </CardTitle>
                  <CardDescription>
                    Notify customers about this offer (100% free)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Already-sent warning (edit mode) */}
                  {mode === 'edit' && initialOffer?.notification_sent_at && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Notifications already sent on{' '}
                          {new Date(initialOffer.notification_sent_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          Customers will receive another notification if you resend.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={forceResend}
                          onCheckedChange={setForceResend}
                        />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">Force Resend</span>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-orange-500" />
                        <div>
                          <Label>Push Notification</Label>
                          <p className="text-xs text-muted-foreground">Browser notifications</p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.notify_via_push}
                        onCheckedChange={(checked) => setFormData({ ...formData, notify_via_push: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-green-500" />
                        <div>
                          <Label>Auto-notify on Start</Label>
                          <p className="text-xs text-muted-foreground">When offer goes live</p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.auto_notify_on_start}
                        onCheckedChange={(checked) => setFormData({ ...formData, auto_notify_on_start: checked })}
                      />
                    </div>
                  </div>

                  {/* Send Now button (edit mode) */}
                  {mode === 'edit' && initialOffer?.id && formData.notify_via_push && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        variant="default"
                        disabled={!!initialOffer.notification_sent_at && !forceResend}
                        onClick={handleSendNotificationsNow}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {initialOffer.notification_sent_at ? (forceResend ? 'Force Resend Now' : 'Resend Blocked — Enable Force Resend') : 'Send Notifications Now'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Notification Progress Overlay */}
      <AnimatePresence>
        {showNotificationProgress && savedOfferId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <NotificationProgress
                offerId={savedOfferId}
                offerName={formData.name}
                sendPush={sendPushNow}
                forceResend={notifForceResend}
                onComplete={handleNotificationComplete}
                onCancel={handleNotificationClose}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
