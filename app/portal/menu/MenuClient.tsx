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
} from 'lucide-react';
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
import { uploadMenuImage } from '@/lib/storage';
import { manageMenuCategory, toggleMenuItemAvailability, deleteMenuItemServer, toggleDealStatusServer, deleteDealServer } from '@/lib/actions';
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
}: {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (id: string, value: boolean) => void;
  onToggleFeatured: (id: string, value: boolean) => void;
}) {
  return (
    <div>
      <Card className={cn(
        'overflow-hidden transition-shadow duration-200 hover:shadow-md',
        !item.is_available && 'opacity-60'
      )}>
        <div className="aspect-video relative bg-zinc-100 dark:bg-zinc-800">
          {item.images && item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 flex flex-wrap gap-1">
            {item.is_featured && (
              <Badge className="bg-yellow-500 text-white text-[10px] sm:text-xs">
                <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" /> Featured
              </Badge>
            )}
            {item.is_spicy && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs">
                <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" /> Spicy
              </Badge>
            )}
            {item.is_vegetarian && (
              <Badge className="bg-green-500 text-white text-[10px] sm:text-xs">
                <Leaf className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" /> Veg
              </Badge>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 h-7 w-7 sm:h-8 sm:w-8"
              >
                <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-sm sm:text-base">{item.name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-0.5 sm:mt-1 tracking-wide">
                {item.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                <>
                  <span className="text-base sm:text-lg font-bold text-primary">
                    Rs. {Math.min(...item.size_variants.map(v => v.price)).toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    - Rs. {Math.max(...item.size_variants.map(v => v.price)).toLocaleString()}
                  </span>
                </>
              ) : item.sale_price ? (
                <>
                  <span className="text-base sm:text-lg font-bold text-primary">
                    Rs. {item.sale_price.toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground line-through">
                    Rs. {item.price.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-base sm:text-lg font-bold text-primary">
                  Rs. {item.price.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {item.has_variants && (
                <Badge variant="outline" className="text-[10px] sm:text-xs bg-primary/10 px-1.5 sm:px-2">
                  <Ruler className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  {item.size_variants?.length || 0}
                </Badge>
              )}
              {item.preparation_time && (
                <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5 sm:gap-1">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {item.preparation_time}m
                </span>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-3 sm:p-4 pt-0 flex items-center justify-between">
          <Badge variant={item.is_available ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
            {item.is_available ? 'Available' : 'Unavailable'}
          </Badge>
          <Switch
            checked={item.is_available}
            onCheckedChange={(value) => onToggleAvailability(item.id, value)}
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
            <div className="grid grid-cols-2 gap-4">
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
  onUpdate,
}: {
  categories: Category[];
  onUpdate: () => void;
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
      onUpdate();
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
      } else {
        throw new Error(result.error);
      }
      onUpdate();
    } catch (error: any) {
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
      onUpdate();
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
      setDeletingCategory(null);
      onUpdate();
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
                <>Adding...</>
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
              {isSaving ? 'Saving...' : 'Save Changes'}
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
              {isDeleting ? 'Deleting...' : 'Delete'}
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
      // Use Server Action (hidden from Network tab)
      const result = await deleteDealServer(deletingDeal.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Deal deleted');
      setDeletingDeal(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete deal');
    } finally {
      setIsDeleting(false);
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
      <div className="space-y-4">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} configured
          </p>
          <Button onClick={() => router.push('/portal/deals/add')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </div>

        {/* Deals Grid */}
        {deals.length === 0 ? (
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
            {deals.map((deal) => {
              const status = getDealStatus(deal);
              const discountPct = deal.discount_percentage || (deal.original_price && deal.discounted_price 
                ? Math.round((1 - deal.discounted_price / deal.original_price) * 100) 
                : 0);
              
              return (
                <Card key={deal.id} className={cn(
                  'relative overflow-hidden transition-shadow hover:shadow-md',
                  !deal.is_active && 'opacity-70'
                )}>
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>

                  <CardHeader className="pb-2">
                    <CardTitle className="text-base pr-16 line-clamp-1">{deal.name}</CardTitle>
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
                          onClick={() => {
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
                        disabled={togglingId === deal.id}
                        onCheckedChange={() => handleToggleStatus(deal)}
                      />
                      <span className="text-xs text-muted-foreground">{deal.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    
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
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDeal} onOpenChange={(open) => !open && setDeletingDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDeal?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
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

  // Fetch deals for refresh after mutations (not initial load - that's SSR)
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
    // Skip if we have SSR data on first load
    if (initialData && items.length > 0 && !isLoading) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Use RPC for data fetching (SSR already fetched, this is for refresh only)
      const { data, error } = await getAuthenticatedClient().rpc('get_menu_management_data');
      
      if (!error && data) {
        setItems(data.items || []);
        setCategories(data.categories || []);
      }
      // Note: No fallback to direct queries - RPC is required for security
    } catch (error) {
      toast.error('Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  }, [initialData, items.length, isLoading]);

  useEffect(() => {
    // Only fetch if no SSR data
    if (!initialData) {
      fetchData();
    }
  }, [fetchData, initialData]);

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

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;

    try {
      // Use RPC function to bypass RLS and get images
      const { data, error } = await getAuthenticatedClient().rpc('delete_menu_item', {
        p_item_id: deleteItemId
      });
      
      if (error) throw error;
      
      // Delete images from storage
      if (data?.images && Array.isArray(data.images)) {
        for (const imageUrl of data.images) {
          try {
            // Extract path from URL: https://...storage.../images/menu/filename.jpg
            const urlParts = imageUrl.split('/images/');
            if (urlParts.length === 2) {
              await supabase.storage.from('images').remove([urlParts[1]]);
            }
          } catch (imgError) {
            // Continue even if image deletion fails
          }
        }
      }
      
      toast.success('Item deleted successfully');
      await invalidateMenuCache();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    } finally {
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
        <TabsList className="w-full sm:w-auto h-auto flex-wrap">
          <TabsTrigger value="items" className="text-xs sm:text-sm flex-1 sm:flex-none">Menu Items</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm flex-1 sm:flex-none">Categories</TabsTrigger>
          <TabsTrigger value="deals" className="text-xs sm:text-sm flex-1 sm:flex-none">Deals & Combos</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
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
                  />
                ))}
              </AnimatePresence>
            </div>
          </DataTableWrapper>
        </TabsContent>

        <TabsContent value="categories">
          <div className="max-w-md">
            <CategoryManager categories={categories} onUpdate={fetchData} />
          </div>
        </TabsContent>

        <TabsContent value="deals">
          <DataTableWrapper isLoading={isDealsLoading} isEmpty={false} emptyMessage="">
            <DealsManager deals={deals} onUpdate={fetchDeals} />
          </DataTableWrapper>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from your menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
