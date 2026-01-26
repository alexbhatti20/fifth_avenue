'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  ImagePlus,
  Upload,
  Loader2,
  Check,
  Clock,
  Package,
  Sparkles,
  ChevronRight,
  Trash2,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { ImageUpload } from '@/components/ui/image-upload';
import { uploadDealImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  deal_type: 'combo' | 'discount' | 'bogo';
  items: DealItem[];
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  is_active: boolean;
  image_url: string;
  code: string;
}

const STEPS = [
  { id: 1, title: 'Deal Info', icon: Gift, description: 'Name & type' },
  { id: 2, title: 'Select Items', icon: Package, description: 'Choose menu items' },
  { id: 3, title: 'Set Pricing', icon: DollarSign, description: 'Configure prices' },
  { id: 4, title: 'Validity', icon: Calendar, description: 'Date & limits' },
  { id: 5, title: 'Review', icon: Sparkles, description: 'Confirm deal' },
];

const DEAL_TYPES = [
  {
    id: 'combo',
    title: 'Combo Deal',
    description: 'Bundle multiple items at a special price',
    icon: Package,
    color: 'bg-blue-500',
  },
  {
    id: 'discount',
    title: 'Percentage Discount',
    description: 'Apply % discount on selected items',
    icon: Percent,
    color: 'bg-green-500',
  },
  {
    id: 'bogo',
    title: 'Buy One Get One',
    description: 'Buy 1 item, get another free or discounted',
    icon: Gift,
    color: 'bg-purple-500',
  },
];

export default function AddDealPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    deal_type: 'combo',
    items: [],
    original_price: 0,
    discounted_price: 0,
    discount_percentage: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_uses: 0,
    is_active: true,
    image_url: '',
    code: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate prices whenever items change
  useEffect(() => {
    const total = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setFormData(prev => ({
      ...prev,
      original_price: total,
      discounted_price: prev.discounted_price || total,
    }));
  }, [formData.items]);

  const fetchData = async () => {
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

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchQuery, selectedCategory]);

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

  const calculateDiscount = () => {
    if (formData.original_price <= 0 || formData.discounted_price < 0) return 0;
    if (formData.discounted_price > formData.original_price) return 0;
    const discount = Math.round((1 - formData.discounted_price / formData.original_price) * 100);
    return Math.min(100, Math.max(0, discount)); // Clamp between 0-100
  };

  const calculateSavings = () => {
    if (formData.original_price <= 0 || formData.discounted_price < 0) return 0;
    if (formData.discounted_price > formData.original_price) return 0;
    return Math.max(0, formData.original_price - formData.discounted_price);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.items.length === 0) {
      toast.error('Please fill in all required fields and add at least one item');
      return;
    }

    setIsLoading(true);
    try {
      // Prepare items array with just id and quantity for the deals table
      const dealItems = formData.items.map(item => ({
        id: item.id,
        quantity: item.quantity
      }));
      
      // Use RPC function to create deal with items
      const { data, error } = await supabase.rpc('create_deal_with_items', {
        p_name: formData.name,
        p_description: formData.description || `Includes: ${formData.items.map(i => i.name).join(', ')}`,
        p_code: formData.code || null,
        p_deal_type: formData.deal_type,
        p_original_price: formData.original_price,
        p_discounted_price: formData.discounted_price,
        p_image_url: formData.image_url || null, // URL from storage bucket
        p_valid_from: formData.valid_from,
        p_valid_until: formData.valid_until,
        p_usage_limit: formData.max_uses > 0 ? formData.max_uses : null,
        p_is_active: formData.is_active,
        p_items: dealItems,
      });

      if (error) throw error;

      toast.success(`Deal created successfully!${data?.code ? ` Code: ${data.code}` : ''}`);
      router.push('/portal/deals');
    } catch (error: any) {
      
      toast.error(error.message || 'Failed to create deal');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.deal_type;
      case 2:
        return formData.items.length > 0;
      case 3:
        return formData.discounted_price > 0;
      case 4:
        return formData.valid_from && formData.valid_until;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Deal Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Family Feast Combo"
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's included in this deal..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Deal Type *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DEAL_TYPES.map((type) => (
                  <Card
                    key={type.id}
                    className={cn(
                      'cursor-pointer transition-all border-2',
                      formData.deal_type === type.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-zinc-300'
                    )}
                    onClick={() => setFormData({ ...formData, deal_type: type.id as any })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg text-white', type.color)}>
                          <type.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{type.title}</h4>
                            {formData.deal_type === type.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Selected Items */}
            {formData.items.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Selected Items ({formData.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {formData.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Rs. {item.price} × {item.quantity}
                            </p>
                          </div>
                        </div>
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
                      </div>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between font-medium">
                    <span>Original Total:</span>
                    <span>Rs. {formData.original_price.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search & Filter */}
            <div className="flex gap-4">
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
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => {
                  const isSelected = formData.items.some(i => i.id === item.id);
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
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{item.name}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {item.description}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-bold text-primary">Rs. {item.price}</span>
                              {isSelected && (
                                <Badge variant="secondary" className="bg-primary/10">
                                  Added
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
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Price Summary */}
            <Card className="bg-zinc-50 dark:bg-zinc-800/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground">Original Total</Label>
                    <p className="text-2xl font-bold mt-1">
                      Rs. {formData.original_price.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formData.items.length} items × quantities
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Your Discount</Label>
                    <p className="text-2xl font-bold mt-1 text-green-500">
                      {calculateDiscount()}% OFF
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Save Rs. {calculateSavings().toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Discounted Price Input */}
            <div className="space-y-4">
              <Label htmlFor="discounted_price" className="text-lg">Set Deal Price *</Label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                <Input
                  id="discounted_price"
                  type="number"
                  min="0"
                  max={formData.original_price || undefined}
                  value={formData.discounted_price || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    // Clamp value between 0 and original price
                    const clampedValue = Math.min(Math.max(0, value), formData.original_price || value);
                    setFormData({ ...formData, discounted_price: clampedValue, discount_percentage: 0 });
                  }}
                  className="pl-12 text-3xl h-16 font-bold"
                  placeholder="0"
                />
              </div>
              {formData.discounted_price > formData.original_price && (
                <p className="text-sm text-red-500">
                  Deal price cannot exceed original price (Rs. {formData.original_price.toLocaleString()})
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                This is the final price customers will pay for the deal
              </p>
            </div>

            {/* Quick Discount Buttons */}
            <div className="space-y-2">
              <Label>Quick Discount</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({ ...formData, discounted_price: formData.original_price, discount_percentage: 0 });
                  }}
                  className={cn(
                    formData.discount_percentage === 0 && formData.discounted_price === formData.original_price && 'bg-zinc-500 text-white'
                  )}
                >
                  No Discount
                </Button>
                {[10, 15, 20, 25, 30, 40, 50].map((percent) => (
                  <Button
                    key={percent}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPrice = Math.round(formData.original_price * (1 - percent / 100));
                      setFormData({ ...formData, discounted_price: newPrice, discount_percentage: percent });
                    }}
                    className={cn(
                      formData.discount_percentage === percent && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {percent}% OFF
                  </Button>
                ))}
              </div>
            </div>

            {/* Visual Comparison */}
            {formData.discounted_price > 0 && (
              <Card className="bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Was</p>
                      <p className="text-2xl line-through text-muted-foreground">
                        Rs. {formData.original_price.toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="h-8 w-8 text-green-500" />
                    <div className="text-center">
                      <p className="text-sm text-green-500 font-medium">Now Only</p>
                      <p className="text-4xl font-bold text-green-500">
                        Rs. {formData.discounted_price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="valid_from">Start Date *</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">End Date *</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_uses">Usage Limit</Label>
              <Input
                id="max_uses"
                type="number"
                value={formData.max_uses || ''}
                onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 0 })}
                placeholder="0 = Unlimited"
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of times this deal can be used (0 for unlimited)
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div>
                <Label className="text-base">Active Status</Label>
                <p className="text-sm text-muted-foreground">Enable this deal immediately after creation</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Deal Image (Optional)</Label>
              <ImageUpload
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                uploadFn={uploadDealImage}
                aspectRatio="video"
                placeholder="Upload deal banner image"
                maxSize={5}
              />
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Deal Preview Card */}
            <Card className="overflow-hidden">
              {formData.image_url && (
                <div className="h-48 bg-zinc-100 relative">
                  <img
                    src={formData.image_url}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className="mb-2 bg-primary/10 text-primary">
                      {DEAL_TYPES.find(t => t.id === formData.deal_type)?.title}
                    </Badge>
                    <CardTitle className="text-2xl">{formData.name}</CardTitle>
                    <CardDescription>{formData.description}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm line-through text-muted-foreground">
                      Rs. {formData.original_price.toLocaleString()}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      Rs. {formData.discounted_price.toLocaleString()}
                    </p>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      {calculateDiscount()}% OFF
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-medium mb-3">Includes:</h4>
                <div className="space-y-2">
                  {formData.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.quantity}× {item.name}</span>
                      <span className="text-muted-foreground">Rs. {item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valid From:</span>
                    <p className="font-medium">{new Date(formData.valid_from).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valid Until:</span>
                    <p className="font-medium">{new Date(formData.valid_until).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2 w-full">
                  <Badge variant={formData.is_active ? 'default' : 'secondary'}>
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {formData.max_uses > 0 && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      Limited to {formData.max_uses} uses
                    </span>
                  )}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Create New Deal</h1>
                <p className="text-sm text-muted-foreground">Build a promotional deal with menu items</p>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={isLoading || !canProceed()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Create Deal
            </Button>
          </div>
        </div>
      </div>

      <div className="container-custom mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {STEPS.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left',
                        currentStep === step.id
                          ? 'bg-primary text-primary-foreground'
                          : currentStep > step.id
                          ? 'bg-green-500/10 text-green-600'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        currentStep === step.id
                          ? 'bg-white/20'
                          : currentStep > step.id
                          ? 'bg-green-500 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700'
                      )}>
                        {currentStep > step.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <step.icon className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className={cn(
                          'text-xs',
                          currentStep === step.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderStep()}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              {currentStep < STEPS.length ? (
                <Button
                  onClick={() => setCurrentStep(prev => Math.min(STEPS.length, prev + 1))}
                  disabled={!canProceed()}
                >
                  Next Step
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Create Deal
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
