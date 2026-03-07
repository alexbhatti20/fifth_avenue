'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ImagePlus,
  Tag,
  DollarSign,
  Clock,
  Star,
  Package,
  Flame,
  Leaf,
  Upload,
  X,
  GripVertical,
  Copy,
  Archive,
  Ruler,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Images,
  TrendingDown,
  Gift,
  Bell,
} from 'lucide-react';
import { PortalLoader } from '@/components/portal/PortalLoader';
import OffersTab from '@/components/portal/menu/OffersTab';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { SectionHeader, DataTableWrapper } from '@/components/portal/PortalProvider';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedClient } from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { uploadMenuImage, deleteStorageFile } from '@/lib/storage';
import { manageMenuCategory, toggleMenuItemAvailability, deleteMenuItemServer, deleteMenuItemsBatchServer, toggleDealStatusServer, deleteDealServer, deleteDealsBatchServer } from '@/lib/actions';
import type { MenuItemAdmin, CategoryAdmin, MenuManagementData, Deal } from '@/lib/server-queries';

// Helper to get auth token from various sources
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Try multiple sources for the auth token
  return localStorage.getItem('auth_token') || 
         localStorage.getItem('sb_access_token') ||
         document.cookie.match(/(^| )auth_token=([^;]+)/)?.[2] ||
         document.cookie.match(/(^| )sb-access-token=([^;]+)/)?.[2] ||
         null;
};

// Helper function to invalidate menu cache
const invalidateMenuCache = async () => {
  try {
    const token = getAuthToken();
    await fetch('/api/admin/invalidate-cache', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      credentials: 'include', // Include cookies for server-side auth
      body: JSON.stringify({ type: 'menu' }),
    });
  } catch (error) {
    // Silent fail - cache will eventually refresh
  }
};

// Helper function to invalidate deals cache (for customer-facing pages)
const invalidateDealsCache = async () => {
  try {
    const token = getAuthToken();
    await fetch('/api/admin/invalidate-cache', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      credentials: 'include', // Include cookies for server-side auth
      body: JSON.stringify({ type: 'deals' }),
    });
  } catch (error) {
    // Silent fail - cache will eventually refresh
  }
};

interface SizeVariant {
  size: string;
  price: number;
  is_available: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category: string;
  category_id?: string;
  images?: string[];
  is_available: boolean;
  is_featured: boolean;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  preparation_time?: number;
  nutrition_info?: Record<string, any>;
  created_at: string;
  slug?: string;
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  display_order: number;
  is_visible: boolean;
}

// Menu Item Card Component - Mobile Optimized
function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
  onToggleFeatured,
  onSendNotification,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (id: string, value: boolean) => void;
  onToggleFeatured: (id: string, value: boolean) => void;
  onSendNotification: (item: MenuItem) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = item.images && item.images.length > 0 ? item.images : [];
  const hasMultiple = imgs.length > 1;

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx(i => (i - 1 + imgs.length) % imgs.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx(i => (i + 1) % imgs.length);
  };

  const savePct = item.sale_price && item.price > 0
    ? Math.round(((item.price - item.sale_price) / item.price) * 100)
    : null;

  return (
    <div
      onClick={isSelectMode ? () => onToggleSelect?.(item.id) : undefined}
      className={cn(isSelectMode && 'cursor-pointer')}
    >
      <Card className={cn(
        'overflow-hidden transition-all duration-200 hover:shadow-lg group',
        !item.is_available && 'opacity-60',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}>
        {/* ── Image area ───────────────────────────────── */}
        <div className="relative bg-zinc-100 dark:bg-zinc-800" style={{ aspectRatio: '4/3' }}>
          {imgs.length > 0 ? (
            <>
              <img
                src={imgs[imgIdx]}
                alt={`${item.name} ${imgIdx + 1}`}
                className="w-full h-full object-cover transition-opacity duration-200"
              />
              {/* bottom gradient for badge legibility */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <Package className="h-10 w-10 text-muted-foreground/25" />
              <span className="text-[10px] text-muted-foreground/50">No image</span>
            </div>
          )}

          {/* Carousel arrows */}
          {hasMultiple && !isSelectMode && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/55 hover:bg-black/80 flex items-center justify-center text-white transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/55 hover:bg-black/80 flex items-center justify-center text-white transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {/* dot indicators */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                {imgs.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all',
                      i === imgIdx ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'
                    )}
                  />
                ))}
              </div>
            </>
          )}

          {/* Top-left: select checkbox OR badges */}
          {isSelectMode ? (
            <div className="absolute top-2 left-2">
              <div className={cn(
                'h-6 w-6 rounded-md flex items-center justify-center shadow',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/90 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-600'
              )}>
                {isSelected
                  ? <CheckSquare className="h-4 w-4" />
                  : <Square className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          ) : (
            <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
              {item.is_featured && (
                <Badge className="bg-amber-500 text-white text-[10px] h-5 px-1.5 shadow">
                  <Star className="h-2.5 w-2.5 mr-0.5 fill-white" /> Featured
                </Badge>
              )}
              {item.is_spicy && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5 shadow">
                  <Flame className="h-2.5 w-2.5 mr-0.5" /> Spicy
                </Badge>
              )}
              {item.is_vegetarian && (
                <Badge className="bg-green-600 text-white text-[10px] h-5 px-1.5 shadow">
                  <Leaf className="h-2.5 w-2.5 mr-0.5" /> Veg
                </Badge>
              )}
            </div>
          )}

          {/* Top-right: image count pill + actions menu */}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            {imgs.length > 1 && (
              <span className="flex items-center gap-0.5 bg-black/55 text-white text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none">
                <Images className="h-2.5 w-2.5" />{imgIdx + 1}/{imgs.length}
              </span>
            )}
            {!isSelectMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-black/55 hover:bg-black/80 border-0 text-white shadow"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/portal/menu/${item.id}/view`} className="flex items-center cursor-pointer">
                      <Package className="h-4 w-4 mr-2" /> View Details
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleFeatured(item.id, !item.is_featured)}>
                    <Star className="h-4 w-4 mr-2" />
                    {item.is_featured ? 'Remove Featured' : 'Mark Featured'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.id)}>
                    <Copy className="h-4 w-4 mr-2" /> Copy ID
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSendNotification(item)}>
                    <Bell className="h-4 w-4 mr-2" /> Send Notification
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── Card body ────────────────────────────────── */}
        <CardContent className="p-3 pt-2.5 space-y-2">
          {/* Category chip */}
          {item.category && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Tag className="h-2.5 w-2.5" />{item.category}
            </span>
          )}

          {/* Name */}
          <h3 className="font-semibold text-sm sm:text-[15px] leading-tight truncate">{item.name}</h3>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Price row */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-baseline gap-1.5">
              {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                <>
                  <span className="text-base font-bold text-primary">
                    Rs. {Math.min(...item.size_variants.map(v => v.price)).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">–{Math.max(...item.size_variants.map(v => v.price)).toLocaleString()}</span>
                </>
              ) : item.sale_price ? (
                <>
                  <span className="text-base font-bold text-primary">Rs. {item.sale_price.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground line-through">Rs. {item.price.toLocaleString()}</span>
                  {savePct && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded-full">
                      <TrendingDown className="h-2.5 w-2.5" />-{savePct}%
                    </span>
                  )}
                </>
              ) : (
                <span className="text-base font-bold text-primary">Rs. {item.price.toLocaleString()}</span>
              )}
            </div>

            {/* Meta chips */}
            <div className="flex items-center gap-1.5">
              {item.has_variants && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-primary/8">
                  <Ruler className="h-2.5 w-2.5 mr-0.5" />{item.size_variants?.length || 0} sizes
                </Badge>
              )}
              {item.preparation_time && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />{item.preparation_time}m
                </span>
              )}
            </div>
          </div>
        </CardContent>

        {/* ── Footer ──────────────────────────────────── */}
        <CardFooter className="px-3 py-2 border-t flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'h-2 w-2 rounded-full',
              item.is_available ? 'bg-green-500' : 'bg-zinc-400'
            )} />
            <span className="text-[11px] font-medium text-muted-foreground">
              {item.is_available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <Switch
            checked={item.is_available}
            disabled={isSelectMode}
            onCheckedChange={(value) => !isSelectMode && onToggleAvailability(item.id, value)}
          />
        </CardFooter>
      </Card>
    </div>
  );
}

// Menu Item Form Dialog
function MenuItemDialog({
  item,
  categories,
  open,
  onOpenChange,
  onSave,
}: {
  item: MenuItem | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<MenuItem>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    sale_price: undefined,
    category_id: '',
    images: [],
    is_available: true,
    is_featured: false,
    is_spicy: false,
    is_vegetarian: false,
    preparation_time: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData(item);
      setImagePreview(item.images && item.images.length > 0 ? item.images[0] : null);
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        category_id: categories[0]?.id || '',
        images: [],
        is_available: true,
        is_featured: false,
        is_spicy: false,
        is_vegetarian: false,
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [item, categories]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let images = formData.images || [];

      // Upload image if new file selected (with compression)
      if (imageFile) {
        const result = await uploadMenuImage(imageFile);
        if (!result.success || !result.url) {
          throw new Error(result.error || 'Failed to upload image');
        }
        images = [result.url, ...images.filter(img => img !== result.url)];
      }

      await onSave({ ...formData, images });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the menu item details' : 'Add a new item to your menu'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Item Image</Label>
              <div className="flex gap-4">
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 800x600px, max 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Crispy Chicken Burger"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the item..."
                  rows={3}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (Rs.) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price">Sale Price (Rs.)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  value={formData.sale_price || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    sale_price: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Category & Prep Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preparation_time">Prep Time (minutes)</Label>
                <Input
                  id="preparation_time"
                  type="number"
                  value={formData.preparation_time || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    preparation_time: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Available for Order</Label>
                  <p className="text-xs text-muted-foreground">
                    Show this item on the menu
                  </p>
                </div>
                <Switch
                  checked={formData.is_available}
                  onCheckedChange={(value) => setFormData({ ...formData, is_available: value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured Item</Label>
                  <p className="text-xs text-muted-foreground">
                    Highlight on homepage
                  </p>
                </div>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(value) => setFormData({ ...formData, is_featured: value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Spicy</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark as spicy item
                  </p>
                </div>
                <Switch
                  checked={formData.is_spicy}
                  onCheckedChange={(value) => setFormData({ ...formData, is_spicy: value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Vegetarian</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark as vegetarian
                  </p>
                </div>
                <Switch
                  checked={formData.is_vegetarian}
                  onCheckedChange={(value) => setFormData({ ...formData, is_vegetarian: value })}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.price}>
            {isSubmitting ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Category Management - Advanced
function CategoryManager({
  categories,
  onCategoryChange,
}: {
  categories: Category[];
  onCategoryChange: (action: 'add' | 'update' | 'delete' | 'toggle', category: Category | { id: string }) => void;
}) {
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    setIsAdding(true);
    try {
      // Use Server Action (hidden from Network tab)
      const result = await manageMenuCategory({
        action: 'create',
        category_id: null,
        name: newCategory.trim(),
        description: newDescription.trim() || null,
        image_url: null,
        display_order: null,
        is_visible: true,
      });

      if (!result.success) throw new Error(result.error);
      
      toast.success(result.data?.message || 'Category added');
      setNewCategory('');
      setNewDescription('');
      // Update state directly with the returned category
      if (result.data?.category) {
        onCategoryChange('add', result.data.category as Category);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  // FIX: Moved timeout to useRef to prevent memory leak and race conditions
  const cacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceInvalidateCache = useCallback(() => {
    if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    cacheTimeoutRef.current = setTimeout(() => {
      invalidateMenuCache();
    }, 500);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    };
  }, []);

  const [optimisticCategories, setOptimisticCategories] = useState<Category[]>(categories);
  useEffect(() => {
    setOptimisticCategories(categories);
  }, [categories]);

  const handleToggleCategory = async (id: string) => {
    // Optimistically update UI
    setOptimisticCategories(prev => prev.map(cat =>
      cat.id === id ? { ...cat, is_visible: !cat.is_visible } : cat
    ));
    try {
      const category = categories.find(c => c.id === id);
      if (!category) {
        toast.error('Category not found');
        return;
      }
      // Use Server Action (hidden from Network tab)
      const result = await manageMenuCategory({
        action: 'toggle',
        category_id: id,
        name: null,
        description: null,
        image_url: null,
        display_order: null,
        is_visible: null,
      });
      
      if (result.success) {
        toast.success(result.data?.message || (category.is_visible ? 'Category hidden' : 'Category visible'));
        // Update state directly with the toggled category
        if (result.data?.category) {
          onCategoryChange('toggle', result.data.category as Category);
        }
      } else {
        // Revert optimistic update on error
        setOptimisticCategories(categories);
        throw new Error(result.error);
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setOptimisticCategories(categories);
      toast.error(error.message);
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editName.trim()) return;

    setIsSaving(true);
    try {
      // Use Server Action (hidden from Network tab)
      const result = await manageMenuCategory({
        action: 'update',
        category_id: editingCategory.id,
        name: editName.trim(),
        description: editDescription.trim() || null,
        image_url: null,
        display_order: null,
        is_visible: null,
      });

      if (!result.success) throw new Error(result.error);
      
      toast.success(result.data?.message || 'Category updated');
      setEditingCategory(null);
      // Update state directly with the returned category
      if (result.data?.category) {
        onCategoryChange('update', result.data.category as Category);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;

    setIsDeleting(true);
    try {
      // Use Server Action (hidden from Network tab)
      const result = await manageMenuCategory({
        action: 'delete',
        category_id: deletingCategory.id,
        name: null,
        description: null,
        image_url: null,
        display_order: null,
        is_visible: null,
      });

      if (!result.success) {
        if (result.data?.item_count) {
          toast.error(`Cannot delete: ${result.data.item_count} items in this category`);
        } else {
          throw new Error(result.error || 'Failed to delete category');
        }
        return;
      }
      
      toast.success(result.data?.message || 'Category deleted');
      // Update state directly by removing the deleted category
      onCategoryChange('delete', { id: deletingCategory.id });
      setDeletingCategory(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditDescription(category.description || '');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Categories
          </CardTitle>
          <CardDescription>Manage menu categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Category */}
          <div className="space-y-2 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <Label className="text-sm font-medium">Add New Category</Label>
            <Input
              placeholder="Category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddCategory()}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button 
              onClick={handleAddCategory} 
              disabled={isAdding || !newCategory.trim()}
              className="w-full"
            >
              {isAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="zoiro-btn-spinner" />Adding…
                </span>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Categories List */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {categories.length} Categories
            </Label>
            
            {categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No categories yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {optimisticCategories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-all',
                      category.is_visible 
                        ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' 
                        : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-medium truncate',
                            !category.is_visible && 'text-muted-foreground'
                          )}>
                            {category.name}
                          </span>
                          {!category.is_visible && (
                            <Badge variant="secondary" className="text-xs">Hidden</Badge>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingCategory(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={category.is_visible}
                        onCheckedChange={() => handleToggleCategory(category.id)}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCategory} disabled={isSaving || !editName.trim()}>
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="zoiro-btn-spinner" />Saving…
                </span>
              ) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? 
              This action cannot be undone. Categories with menu items cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="zoiro-btn-spinner" />Deleting…
                </span>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =============================================
// DEALS MANAGER COMPONENT
// =============================================

interface DealsManagerProps {
  deals: Deal[];
  onUpdate: () => void;
}

function DealsManager({ deals, onUpdate }: DealsManagerProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingDeal, setDeletingDeal] = useState<Deal | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Multi-select state
  const [isDealSelectMode, setIsDealSelectMode] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [showBulkDealDeleteConfirm, setShowBulkDealDeleteConfirm] = useState(false);
  const [isBulkDeletingDeals, setIsBulkDeletingDeals] = useState(false);

  // Local optimistic copy — updated immediately so the grid empties right away
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);
  useEffect(() => { setLocalDeals(deals); }, [deals]);

  const toggleSelectDeal = (id: string) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllDeals = () => {
    if (selectedDeals.size === localDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(localDeals.map(d => d.id)));
    }
  };

  const exitDealSelectMode = () => {
    setIsDealSelectMode(false);
    setSelectedDeals(new Set());
  };

  const handleToggleStatus = async (deal: Deal) => {
    setTogglingId(deal.id);
    try {
      // Use Server Action (hidden from Network tab)
      const result = await toggleDealStatusServer(deal.id);
      if (!result.success) throw new Error(result.error);
      toast.success(`Deal ${result.is_active ? 'activated' : 'deactivated'}`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle deal');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDeal) return;
    setIsDeleting(true);
    try {
      const imageUrl = (deletingDeal as any).image_url as string | undefined;
      // Use Server Action (hidden from Network tab)
      const result = await deleteDealServer(deletingDeal.id);
      if (!result.success) throw new Error(result.error);
      // Delete associated image from storage if present
      if (imageUrl) {
        await deleteStorageFile(imageUrl).catch((e) =>
          console.warn('Could not delete deal image from storage:', e)
        );
      }
      toast.success('Deal deleted');
      setDeletingDeal(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete deal');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteDeals = async () => {
    const ids = Array.from(selectedDeals);
    if (ids.length === 0) return;
    setIsBulkDeletingDeals(true);
    // Optimistically remove from local state immediately
    setLocalDeals(prev => prev.filter(d => !ids.includes(d.id)));
    setShowBulkDealDeleteConfirm(false);
    exitDealSelectMode();
    try {
      // Single batch DB call — no N-requests loop
      const result = await deleteDealsBatchServer(ids);
      // Delete images from storage in parallel (fire-and-forget)
      const imageUrls = ids
        .map(id => deals.find(d => d.id === id))
        .map(deal => deal && (deal as any).image_url)
        .filter(Boolean) as string[];
      imageUrls.forEach(url =>
        deleteStorageFile(url).catch(e => console.warn('Could not delete deal image:', e))
      );
      if ((result as any).failed_count > 0) {
        toast.warning(`${(result as any).deleted_count} deleted, ${(result as any).failed_count} failed`);
      } else {
        toast.success(`${ids.length} deal${ids.length !== 1 ? 's' : ''} deleted`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete deals');
      onUpdate(); // Re-sync on error
    } finally {
      setIsBulkDeletingDeals(false);
      onUpdate();
    }
  };

  const getDealStatus = (deal: Deal) => {
    const now = new Date();
    const start = new Date(deal.valid_from || '');
    const end = new Date(deal.valid_until || '');
    
    if (!deal.is_active) return { label: 'Inactive', color: 'bg-zinc-100 text-zinc-600' };
    if (now < start) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' };
    if (now > end) return { label: 'Expired', color: 'bg-red-100 text-red-700' };
    return { label: 'Active', color: 'bg-green-100 text-green-700' };
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <>
      {/* Gradient loader for deal operations */}
      <PortalLoader visible={isDeleting} label="Deleting deal…" />
      <PortalLoader visible={isBulkDeletingDeals} label={`Deleting ${selectedDeals.size} deal${selectedDeals.size !== 1 ? 's' : ''}…`} />
      <div className="space-y-4">
        {/* Header with Select toolbar + Add button */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {localDeals.length > 0 && (
              !isDealSelectMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDealSelectMode(true)}
                  className="gap-1.5"
                >
                  <CheckSquare className="h-4 w-4" /> Select
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={exitDealSelectMode} className="gap-1">
                    <X className="h-4 w-4" /><span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAllDeals}
                    className="gap-1.5"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {selectedDeals.size === localDeals.length && localDeals.length > 0 ? 'Deselect All' : `Select All (${localDeals.length})`}
                    </span>
                    <span className="sm:hidden">
                      {selectedDeals.size === localDeals.length && localDeals.length > 0 ? 'None' : 'All'}
                    </span>
                  </Button>
                  {selectedDeals.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDealDeleteConfirm(true)}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                      {selectedDeals.size}
                      <span className="hidden sm:inline">Selected</span>
                    </Button>
                  )}
                </>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDealSelectMode && (
              <span className="text-xs text-muted-foreground">
                {selectedDeals.size}/{localDeals.length} selected
              </span>
            )}
            {!isDealSelectMode && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                {localDeals.length} deal{localDeals.length !== 1 ? 's' : ''} configured
              </p>
            )}
            <Button onClick={() => router.push('/portal/deals/add')} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </Button>
          </div>
        </div>

        {/* Deals Grid */}
        {localDeals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Deals Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create special deals and combo offers to boost sales
              </p>
              <Button onClick={() => router.push('/portal/deals/add')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Deal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {localDeals.map((deal) => {
              const status = getDealStatus(deal);
              const discountPct = deal.discount_percentage || (deal.original_price && deal.discounted_price 
                ? Math.round((1 - deal.discounted_price / deal.original_price) * 100) 
                : 0);
              const isSelected = selectedDeals.has(deal.id);
              
              return (
                <Card
                  key={deal.id}
                  className={cn(
                    'relative overflow-hidden transition-shadow hover:shadow-md',
                    !deal.is_active && 'opacity-70',
                    isDealSelectMode && isSelected && 'ring-2 ring-primary',
                    isDealSelectMode && 'cursor-pointer select-none'
                  )}
                  onClick={isDealSelectMode ? () => toggleSelectDeal(deal.id) : undefined}
                >
                  {/* Checkbox overlay (select mode) */}
                  {isDealSelectMode && (
                    <div className="absolute top-2 left-2 z-10">
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-primary drop-shadow" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground drop-shadow" />
                      )}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>

                  <CardHeader className="pb-2">
                    <CardTitle className={cn('text-base line-clamp-1', isDealSelectMode ? 'pr-16 pl-6' : 'pr-16')}>{deal.name}</CardTitle>
                    <CardDescription className="text-xs capitalize">
                      {deal.deal_type} Deal
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pb-3 space-y-2">
                    {/* Price Display */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-primary">
                        Rs. {deal.discounted_price}
                      </span>
                      {deal.original_price > deal.discounted_price && (
                        <>
                          <span className="text-sm text-muted-foreground line-through">
                            Rs. {deal.original_price}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {discountPct}% OFF
                          </Badge>
                        </>
                      )}
                    </div>

                    {/* Description */}
                    {deal.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {deal.description}
                      </p>
                    )}

                    {/* Deal Code */}
                    {deal.code && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {deal.code}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(deal.code);
                            toast.success('Code copied!');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(deal.valid_from)} - {formatDate(deal.valid_until)}
                    </div>

                    {/* Items count */}
                    {deal.items && deal.items.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {deal.items.length} item{deal.items.length !== 1 ? 's' : ''} included
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 flex justify-between border-t bg-muted/30 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={deal.is_active}
                        disabled={togglingId === deal.id || isDealSelectMode}
                        onCheckedChange={() => !isDealSelectMode && handleToggleStatus(deal)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">{deal.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    
                    {!isDealSelectMode && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/portal/deals/${deal.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingDeal(deal)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDeal} onOpenChange={(open) => !isDeleting && !open && setDeletingDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingDeal?.name}&quot;?
              This will also remove its image from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="zoiro-btn-spinner" />Deleting…
                </span>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={showBulkDealDeleteConfirm}
        onOpenChange={(o) => !isBulkDeletingDeals && setShowBulkDealDeleteConfirm(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''} and their images. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteDeals}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedDeals.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
// Props for SSR
interface MenuClientProps {
  initialData?: MenuManagementData;
}

// Main Menu Management Page
export default function MenuClient({ initialData }: MenuClientProps) {
  const [items, setItems] = useState<MenuItem[]>(initialData?.items || []);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories || []);
  const [deals, setDeals] = useState<Deal[]>(initialData?.deals || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isDealsLoading, setIsDealsLoading] = useState(false); // Changed: No separate deals loading
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  // Multi-select state — menu items
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllItems = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItems(new Set());
  };

  // Ref to prevent duplicate/concurrent menu data fetches
  const isMenuFetchingRef = useRef(false);

  const fetchDeals = useCallback(async () => {
    setIsDealsLoading(true);
    try {
      // Use RPC to get fresh deals after mutations
      const { data, error } = await getAuthenticatedClient().rpc('get_all_deals_with_items');
      if (!error && data) {
        const mappedDeals = (data || []).map((d: any) => ({
          ...d,
          discount_type: d.deal_type === 'combo' ? 'percentage' : d.deal_type,
          discount_value: d.discount_percentage,
          start_date: d.valid_from,
          end_date: d.valid_until,
          used_count: d.usage_count,
        }));
        setDeals(mappedDeals);
      }
    } catch (error) {
      // Silent fail - user can retry
    } finally {
      setIsDealsLoading(false);
    }
  }, []);

  // NO useEffect for deals on mount - we use SSR data

  const fetchData = useCallback(async () => {
    // Prevent concurrent/duplicate fetches
    if (isMenuFetchingRef.current) return;
    isMenuFetchingRef.current = true;
    setIsLoading(true);
    try {
      const { data, error } = await getAuthenticatedClient().rpc('get_menu_management_data');
      if (!error && data) {
        setItems(data.items || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      toast.error('Failed to load menu data');
    } finally {
      setIsLoading(false);
      isMenuFetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle category changes without making extra API calls
  const handleCategoryChange = useCallback((
    action: 'add' | 'update' | 'delete' | 'toggle',
    category: Category | { id: string }
  ) => {
    setCategories(prev => {
      switch (action) {
        case 'add':
          // Add new category to the end
          return [...prev, category as Category];
        case 'update':
        case 'toggle':
          // Update existing category
          return prev.map(c => c.id === category.id ? { ...c, ...category } as Category : c);
        case 'delete':
          // Remove the deleted category
          return prev.filter(c => c.id !== category.id);
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    // Only fetch if no SSR data was provided
    if (!initialData) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSaveItem = async (data: Partial<MenuItem>) => {
    try {
      if (editingItem) {
        // Update using advanced RPC
        const { data: result, error } = await getAuthenticatedClient().rpc('update_menu_item_advanced', {
          p_item_id: editingItem.id,
          p_name: data.name || null,
          p_description: data.description || null,
          p_price: data.price || null,
          p_sale_price: data.sale_price || null,
          p_category_id: data.category_id || null,
          p_images: data.images || null,
          p_is_available: data.is_available ?? null,
          p_is_featured: data.is_featured ?? null,
          p_is_spicy: data.is_spicy ?? null,
          p_is_vegetarian: data.is_vegetarian ?? null,
          p_preparation_time: data.preparation_time || null,
        });

        if (error) throw error;
        if (result && !result.success) throw new Error(result.error || 'Failed to update');
        toast.success('Item updated successfully');
      } else {
        // Create using advanced RPC
        const { data: result, error } = await getAuthenticatedClient().rpc('create_menu_item_advanced', {
          p_category_id: data.category_id || null,
          p_name: data.name || '',
          p_description: data.description || null,
          p_price: data.price || 0,
          p_sale_price: data.sale_price || null,
          p_images: data.images || [],
          p_is_available: data.is_available ?? true,
          p_is_featured: data.is_featured ?? false,
          p_is_spicy: data.is_spicy ?? false,
          p_is_vegetarian: data.is_vegetarian ?? false,
          p_preparation_time: data.preparation_time || null,
        });

        if (error) throw error;
        if (result && !result.success) throw new Error(result.error || 'Failed to create');
        toast.success('Item added successfully');
      }
      await invalidateMenuCache();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item');
      throw error;
    }
  };

  const handleSendNotification = async (item: MenuItem) => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          userType: 'customer',
          title: `🍽️ ${item.name} is available!`,
          body: item.description
            ? `${item.description.slice(0, 100)}${item.description.length > 100 ? '…' : ''}`
            : `Order ${item.name} now at Zoiro Broast!`,
          notificationType: 'menu_item',
          referenceId: item.id,
          image: item.images?.[0] || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Notification sent to ${result.sent ?? 0} customer${result.sent !== 1 ? 's' : ''}`);
      } else {
        toast.error(result.message || 'Failed to send notification');
      }
    } catch {
      toast.error('Failed to send push notification');
    }
  };

  const handleBulkDeleteItems = async () => {
    const ids = Array.from(selectedItems);
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    // Show indeterminate progress while single batch call runs
    setBulkDeleteProgress({ done: 0, total: ids.length });

    try {
      // Single server-action call — one DB request for all items
      const result = await deleteMenuItemsBatchServer(ids);

      // Immediately mark full progress
      setBulkDeleteProgress({ done: ids.length, total: ids.length });

      // Clean up storage images (non-blocking, fire-and-forget per image)
      if (result.images && result.images.length > 0) {
        for (const imageUrl of result.images) deleteStorageFile(imageUrl).catch(() => {});
      }

      if (!result.success) throw new Error(result.error);

      if ((result.failed_count ?? 0) === 0) {
        toast.success(`${result.deleted_count} item${result.deleted_count !== 1 ? 's' : ''} deleted`);
      } else {
        toast.warning(`${result.deleted_count} deleted, ${result.failed_count} failed`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete items');
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteProgress(null);
      setShowBulkDeleteConfirm(false);
      setSelectedItems(new Set());
      setIsSelectMode(false);
    }
    fetchData();
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    setIsDeletingSingle(true);
    try {
      // Server action — no client-side RPC, runs server-side
      const result = await deleteMenuItemServer(deleteItemId);
      if (!result.success) throw new Error(result.error);
      // Clean up storage images
      for (const imageUrl of result.images) deleteStorageFile(imageUrl).catch(() => {});
      toast.success('Item deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    } finally {
      setIsDeletingSingle(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleAvailability = async (id: string, value: boolean) => {
    try {
      // Use RPC function to bypass RLS restrictions
      const { error } = await getAuthenticatedClient().rpc('update_menu_item', {
        p_item_id: id,
        p_is_available: value
      });

      if (error) throw error;
      setItems((prev) => prev.map((item) => 
        item.id === id ? { ...item, is_available: value } : item
      ));
      await invalidateMenuCache();
      toast.success(value ? 'Item is now available' : 'Item marked unavailable');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleFeatured = async (id: string, value: boolean) => {
    try {
      // Use RPC function to bypass RLS restrictions
      const { error } = await getAuthenticatedClient().rpc('update_menu_item', {
        p_item_id: id,
        p_is_featured: value
      });

      if (error) throw error;
      setItems((prev) => prev.map((item) => 
        item.id === id ? { ...item, is_featured: value } : item
      ));
      await invalidateMenuCache();
      toast.success(value ? 'Item is now featured' : 'Item removed from featured');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const router = useRouter();

  return (
    <>
      {/* Universal gradient loader for item delete operations */}
      <PortalLoader visible={isDeletingSingle} label="Deleting item…" />
      <PortalLoader visible={isBulkDeleting} label={`Deleting ${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''}…`} />
      <SectionHeader
        title="Menu Management"
        description="Manage your restaurant menu items and categories"
        action={
          <Button onClick={() => router.push('/portal/menu/add')} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Item</span>
          </Button>
        }
      />

      <Tabs defaultValue="items" className="space-y-4 sm:space-y-6">
        {/* Horizontally scrollable tabs on mobile */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max sm:w-auto h-auto gap-1 sm:gap-0 bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl">
            <TabsTrigger value="items" className="text-xs sm:text-sm whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-700">Menu Items</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-700">Categories</TabsTrigger>
            <TabsTrigger value="deals" className="text-xs sm:text-sm whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-700">Deals & Combos</TabsTrigger>
            <TabsTrigger value="offers" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-700">
              <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Offers
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="items" className="space-y-4">
          {/* Select Mode Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isSelectMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectMode(true)}
                  className="gap-1.5"
                >
                  <CheckSquare className="h-4 w-4" /> Select
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={exitSelectMode} className="gap-1">
                    <X className="h-4 w-4" /><span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAllItems}
                    className="gap-1.5"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {selectedItems.size === filteredItems.length && filteredItems.length > 0
                        ? 'Deselect All'
                        : `Select All (${filteredItems.length})`}
                    </span>
                    <span className="sm:hidden">
                      {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? 'None' : 'All'}
                    </span>
                  </Button>
                  {selectedItems.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                      {selectedItems.size}
                      <span className="hidden sm:inline">Selected</span>
                    </Button>
                  )}
                </>
              )}
            </div>
            {isSelectMode && (
              <span className="text-xs text-muted-foreground">
                {selectedItems.size}/{filteredItems.length} selected
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter(c => c.is_visible).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items Grid */}
          <DataTableWrapper isLoading={isLoading} isEmpty={filteredItems.length === 0} emptyMessage="No menu items found">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={(item) => router.push(`/portal/menu/${item.id}`)}
                    onDelete={setDeleteItemId}
                    onToggleAvailability={handleToggleAvailability}
                    onToggleFeatured={handleToggleFeatured}
                    onSendNotification={handleSendNotification}
                    isSelectMode={isSelectMode}
                    isSelected={selectedItems.has(item.id)}
                    onToggleSelect={toggleSelectItem}
                  />
                ))}
              </AnimatePresence>
            </div>
          </DataTableWrapper>
        </TabsContent>

        <TabsContent value="categories">
          <div className="max-w-md">
            <CategoryManager categories={categories} onCategoryChange={handleCategoryChange} />
          </div>
        </TabsContent>

        <TabsContent value="deals">
          <DataTableWrapper isLoading={isDealsLoading} isEmpty={false} emptyMessage="">
            <DealsManager deals={deals} onUpdate={fetchDeals} />
          </DataTableWrapper>
        </TabsContent>

        <TabsContent value="offers">
          <OffersTab 
            menuItems={items} 
            initialOffers={initialData?.offers?.offers || []}
            initialStats={initialData?.offers?.stats}
          />
        </TabsContent>
      </Tabs>

      {/* Item Dialog */}
      <MenuItemDialog
        item={editingItem}
        categories={categories.filter(c => c.is_visible)}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveItem}
      />

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(o) => !isDeletingSingle && !o && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item and its image will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSingle}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isDeletingSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSingle ? (
                <span className="flex items-center gap-2">
                  <span className="zoiro-btn-spinner" />Deleting…
                </span>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={(o) => !isBulkDeleting && setShowBulkDeleteConfirm(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedItems.size} menu item{selectedItems.size !== 1 ? 's' : ''} and their images. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isBulkDeleting && bulkDeleteProgress && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Deleting {bulkDeleteProgress.done} of {bulkDeleteProgress.total}…</span>
                <span>{Math.round((bulkDeleteProgress.done / bulkDeleteProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-destructive h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkDeleteProgress.done / bulkDeleteProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteItems}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="zoiro-btn-spinner" />Deleting…
                </span>
              ) : `Delete ${selectedItems.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
