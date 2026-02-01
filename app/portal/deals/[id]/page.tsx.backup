'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Gift,
  Search,
  Plus,
  Minus,
  X,
  DollarSign,
  Calendar,
  Percent,
  Tag,
  Zap,
  Loader2,
  Check,
  Clock,
  Package,
  Sparkles,
  ChevronRight,
  Trash2,
  Copy,
  Eye,
  Edit,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Progress } from '@/components/ui/progress';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { createClient } from '@/lib/supabase';
import { updateDeal, deleteDeal, toggleDealStatus, getDealById, type Deal, type DealItem as DealItemType } from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Image from 'next/image';

const supabase = createClient();

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category_id: string;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface DealItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface FormData {
  name: string;
  description: string;
  code: string;
  deal_type: 'combo' | 'discount' | 'bogo';
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  is_active: boolean;
  items: DealItem[];
  image_url: string;
}

const DEAL_TYPES = [
  {
    id: 'combo',
    title: 'Combo Deal',
    description: 'Bundle multiple items at a special price',
    icon: Gift,
    color: 'bg-orange-500',
  },
  {
    id: 'discount',
    title: 'Discount',
    description: 'Apply % discount on items',
    icon: Percent,
    color: 'bg-green-500',
  },
  {
    id: 'bogo',
    title: 'Buy One Get One',
    description: 'Special promotional offer',
    icon: Gift,
    color: 'bg-purple-500',
  },
];

export default function EditDealPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  
  // Menu items for editing
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    code: '',
    deal_type: 'combo',
    original_price: 0,
    discounted_price: 0,
    discount_percentage: 0,
    valid_from: '',
    valid_until: '',
    usage_limit: null,
    is_active: true,
    items: [],
    image_url: '',
  });

  // Fetch deal data
  useEffect(() => {
    const fetchDeal = async () => {
      setIsLoading(true);
      try {
        // Use the new getDealById function that uses the deals table
        const data = await getDealById(dealId);

        if (data) {
          setDeal(data as Deal);
          
          setFormData({
            name: data.name || '',
            description: data.description || '',
            code: data.code || '',
            deal_type: data.deal_type || 'combo',
            original_price: data.original_price || 0,
            discounted_price: data.discounted_price || 0,
            discount_percentage: data.discount_percentage || 0,
            valid_from: data.valid_from ? new Date(data.valid_from).toISOString().split('T')[0] : '',
            valid_until: data.valid_until ? new Date(data.valid_until).toISOString().split('T')[0] : '',
            usage_limit: data.usage_limit || null,
            is_active: data.is_active ?? true,
            items: data.items || [],
            image_url: data.image_url || '',
          });
        } else {
          toast.error('Deal not found');
          router.push('/portal/deals');
        }
      } catch (error: any) {
        toast.error('Failed to load deal');
        router.push('/portal/deals');
      } finally {
        setIsLoading(false);
      }
    };

    if (dealId) {
      fetchDeal();
    }
  }, [dealId, router]);

  // Fetch menu items for editing
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const [catRes, itemsRes] = await Promise.all([
          supabase.from('menu_categories').select('id, name, slug').order('display_order'),
          supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
        ]);
        setCategories(catRes.data || []);
        setMenuItems(itemsRes.data || []);
      } catch (error) {
        }
    };

    fetchMenuData();
  }, []);

  // Recalculate original price when items change
  useEffect(() => {
    if (isEditMode) {
      const total = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setFormData(prev => ({
        ...prev,
        original_price: total,
      }));
    }
  }, [formData.items, isEditMode]);

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Item management functions
  const addItemToDeal = (item: MenuItem) => {
    const existing = formData.items.find(i => i.id === item.id);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          image: item.images?.[0],
        }],
      }));
    }
    toast.success(`Added ${item.name} to deal`);
  };

  const removeItemFromDeal = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
    }));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromDeal(itemId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.id === itemId ? { ...i, quantity } : i
      ),
    }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Please enter a deal name');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateDeal(dealId, {
        name: formData.name,
        description: formData.description,
        original_price: formData.original_price,
        discounted_price: formData.discounted_price,
        image_url: formData.image_url,
        valid_until: formData.valid_until,
        usage_limit: formData.usage_limit || undefined,
        is_active: formData.is_active,
        items: formData.items.map(item => ({ id: item.id, quantity: item.quantity })),
      });

      if (result.success) {
        toast.success('Deal updated successfully!');
        setIsEditMode(false);
        // Refresh deal data
        const refreshedDeal = await getDealById(dealId);
        if (refreshedDeal) setDeal(refreshedDeal);
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update deal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const result = await toggleDealStatus(dealId);
      if (result.success) {
        toast.success('Deal status updated');
        setFormData(prev => ({ ...prev, is_active: !prev.is_active }));
        if (deal) {
          setDeal({ ...deal, is_active: !deal.is_active });
        }
      } else {
        toast.error(result.error || 'Failed to toggle status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    try {
      const result = await deleteDeal(dealId);
      if (result.success) {
        toast.success('Deal deleted');
        router.push('/portal/deals');
      } else {
        toast.error(result.error || 'Failed to delete deal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete deal');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(formData.code);
    toast.success('Code copied to clipboard!');
  };

  // Status calculations
  const now = new Date();
  const startDate = formData.valid_from ? new Date(formData.valid_from) : new Date();
  const endDate = formData.valid_until ? new Date(formData.valid_until) : new Date();
  const isExpired = endDate < now;
  const isUpcoming = startDate > now;
  const usagePercentage = deal?.usage_limit ? ((deal?.usage_count || 0) / deal.usage_limit) * 100 : 0;

  const getStatus = () => {
    if (isExpired) return { label: 'Expired', color: 'bg-red-500 text-white' };
    if (!formData.is_active) return { label: 'Inactive', color: 'bg-zinc-500 text-white' };
    if (isUpcoming) return { label: 'Upcoming', color: 'bg-blue-500 text-white' };
    return { label: 'Active', color: 'bg-green-500 text-white' };
  };

  const status = getStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">Deal not found</p>
          <Button variant="outline" onClick={() => router.push('/portal/deals')} className="mt-4">
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/portal/deals')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{formData.name}</h1>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {isEditMode ? 'Edit deal details' : 'View deal details'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode ? (
            <>
              <Button variant="outline" onClick={handleToggleStatus}>
                {formData.is_active ? (
                  <>
                    <ToggleRight className="h-4 w-4 mr-2 text-green-500" />
                    Active
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-4 w-4 mr-2" />
                    Inactive
                  </>
                )}
              </Button>
              <Button onClick={() => setIsEditMode(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Deal
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditMode(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Deal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Deal Name</Label>
                {isEditMode ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Summer Special 20% Off"
                  />
                ) : (
                  <p className="text-lg font-medium">{formData.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                {isEditMode ? (
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this deal..."
                    rows={3}
                  />
                ) : (
                  <p className="text-muted-foreground">{formData.description || 'No description'}</p>
                )}
              </div>

              {/* Promo Code */}
              <div className="space-y-2">
                <Label>Promo Code</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-lg px-4 py-2">
                    {formData.code}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Pricing Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deal Type */}
              <div className="space-y-2">
                <Label>Deal Type</Label>
                {isEditMode ? (
                  <div className="grid grid-cols-3 gap-3">
                    {DEAL_TYPES.map((type) => (
                      <Card
                        key={type.id}
                        className={cn(
                          'cursor-pointer transition-all hover:border-primary',
                          formData.deal_type === type.id && 'border-primary ring-2 ring-primary/20'
                        )}
                        onClick={() => setFormData({ ...formData, deal_type: type.id as any })}
                      >
                        <CardContent className="p-3 text-center">
                          <div className={cn('mx-auto w-8 h-8 rounded-full flex items-center justify-center text-white mb-2', type.color)}>
                            <type.icon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium">{type.title}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {DEAL_TYPES.find(t => t.id === formData.deal_type) && (
                      <>
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white', DEAL_TYPES.find(t => t.id === formData.deal_type)!.color)}>
                          {(() => {
                            const Icon = DEAL_TYPES.find(t => t.id === formData.deal_type)!.icon;
                            return <Icon className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <p className="font-medium">{DEAL_TYPES.find(t => t.id === formData.deal_type)!.title}</p>
                          <p className="text-sm text-muted-foreground">{DEAL_TYPES.find(t => t.id === formData.deal_type)!.description}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Price Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="original_price">Original Price</Label>
                  {isEditMode ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
                      <Input
                        id="original_price"
                        type="number"
                        value={formData.original_price}
                        onChange={(e) => setFormData({ ...formData, original_price: parseFloat(e.target.value) || 0 })}
                        className="pl-10"
                      />
                    </div>
                  ) : (
                    <p className="text-lg line-through text-muted-foreground">Rs. {formData.original_price}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discounted_price">Deal Price</Label>
                  {isEditMode ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
                      <Input
                        id="discounted_price"
                        type="number"
                        value={formData.discounted_price}
                        onChange={(e) => setFormData({ ...formData, discounted_price: parseFloat(e.target.value) || 0 })}
                        className="pl-10"
                      />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-primary">Rs. {formData.discounted_price}</p>
                  )}
                </div>
              </div>

              {/* Discount Percentage Display */}
              {formData.discount_percentage > 0 && !isEditMode && (
                <div className="p-3 rounded-lg bg-green-500/10">
                  <p className="text-center text-green-600 font-bold text-lg">
                    {formData.discount_percentage}% OFF
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Validity Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Start Date</Label>
                  {isEditMode ? (
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{formData.valid_from ? new Date(formData.valid_from).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'Not set'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">End Date</Label>
                  {isEditMode ? (
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{formData.valid_until ? new Date(formData.valid_until).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'Not set'}</p>
                  )}
                </div>
              </div>

              {/* Usage Limit */}
              <div className="space-y-2">
                <Label htmlFor="usage_limit">Usage Limit (Optional)</Label>
                {isEditMode ? (
                  <Input
                    id="usage_limit"
                    type="number"
                    value={formData.usage_limit || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || null })}
                    placeholder="Unlimited"
                  />
                ) : (
                  <p className="font-medium">{formData.usage_limit ? `${formData.usage_limit} uses` : 'Unlimited'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deal Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Deal Items ({formData.items.length})
                </div>
                {isEditMode && (
                  <Button size="sm" variant="outline" onClick={() => setShowItemsDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Items
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No items in this deal</p>
                  {isEditMode && (
                    <Button variant="link" onClick={() => setShowItemsDialog(true)}>
                      Add menu items
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {formData.items.map((item, index) => (
                    <div key={item.id || index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      {item.image && (
                        <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Rs. {item.price} × {item.quantity}
                        </p>
                      </div>
                      {isEditMode ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500"
                            onClick={() => removeItemFromDeal(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <p className="font-semibold">Rs. {(item.price * item.quantity).toFixed(0)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>Total Value</span>
                    <span>Rs. {formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(0)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Deal Image */}
          {formData.image_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Deal Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                  <Image
                    src={formData.image_url}
                    alt={formData.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Times Used</span>
                <span className="font-bold text-lg">{deal?.usage_count || 0}</span>
              </div>
              
              {formData.usage_limit && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Usage Limit</span>
                    <span className="font-medium">{formData.usage_limit}</span>
                  </div>
                  <Progress value={usagePercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(usagePercentage)}% used
                  </p>
                </>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Days Left</span>
                <span className="font-bold text-lg">
                  {isExpired ? '0' : Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={copyCode}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Promo Code
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleToggleStatus}>
                {formData.is_active ? (
                  <>
                    <ToggleLeft className="h-4 w-4 mr-2" />
                    Deactivate Deal
                  </>
                ) : (
                  <>
                    <ToggleRight className="h-4 w-4 mr-2" />
                    Activate Deal
                  </>
                )}
              </Button>
              <Separator className="my-2" />
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Deal
              </Button>
            </CardContent>
          </Card>

          {/* Created Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{deal?.created_at ? new Date(deal.created_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deal ID</span>
                  <span className="font-mono text-xs">{dealId.slice(0, 8)}...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{formData.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Menu Items to Deal</DialogTitle>
            <DialogDescription>
              Select items to include in this deal
            </DialogDescription>
          </DialogHeader>
          
          {/* Search & Filter */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Menu Items Grid */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMenuItems.map((item) => {
                const isSelected = formData.items.some(i => i.id === item.id);
                const selectedItem = formData.items.find(i => i.id === item.id);
                return (
                  <Card
                    key={item.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      isSelected && 'ring-2 ring-primary'
                    )}
                    onClick={() => addItemToDeal(item)}
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        {item.images?.[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-14 h-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{item.name}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-primary">Rs. {item.price}</span>
                            {isSelected && (
                              <Badge variant="secondary" className="bg-primary/10">
                                ×{selectedItem?.quantity}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
