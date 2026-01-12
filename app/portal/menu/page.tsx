'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Helper function to invalidate menu cache
const invalidateMenuCache = async () => {
  try {
    await fetch('/api/admin/invalidate-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'menu' }),
    });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
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

const supabase = createClient();

// Menu Item Card Component
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
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={cn(
        'overflow-hidden transition-all hover:shadow-md',
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
              <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {item.is_featured && (
              <Badge className="bg-yellow-500 text-white">
                <Star className="h-3 w-3 mr-1" /> Featured
              </Badge>
            )}
            {item.is_spicy && (
              <Badge variant="destructive">
                <Flame className="h-3 w-3 mr-1" /> Spicy
              </Badge>
            )}
            {item.is_vegetarian && (
              <Badge className="bg-green-500 text-white">
                <Leaf className="h-3 w-3 mr-1" /> Veg
              </Badge>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
              >
                <MoreVertical className="h-4 w-4" />
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

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate portal-card-title text-base">{item.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1 tracking-wide">
                {item.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-baseline gap-2">
              {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                <>
                  <span className="text-lg font-bold portal-heading-static">
                    Rs. {Math.min(...item.size_variants.map(v => v.price)).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    - Rs. {Math.max(...item.size_variants.map(v => v.price)).toLocaleString()}
                  </span>
                </>
              ) : item.sale_price ? (
                <>
                  <span className="text-lg font-bold portal-heading-static">
                    Rs. {item.sale_price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    Rs. {item.price.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold portal-heading-static">
                  Rs. {item.price.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.has_variants && (
                <Badge variant="outline" className="text-xs bg-primary/10">
                  <Ruler className="h-3 w-3 mr-1" />
                  {item.size_variants?.length || 0} sizes
                </Badge>
              )}
              {item.preparation_time && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {item.preparation_time} min
                </span>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          <Badge variant={item.is_available ? 'default' : 'secondary'}>
            {item.is_available ? 'Available' : 'Unavailable'}
          </Badge>
          <Switch
            checked={item.is_available}
            onCheckedChange={(value) => onToggleAvailability(item.id, value)}
          />
        </CardFooter>
      </Card>
    </motion.div>
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

      // Upload image if new file selected
      if (imageFile) {
        const fileName = `menu/${Date.now()}-${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);

        images = [publicUrl, ...images.filter(img => img !== publicUrl)];
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
      const { data, error } = await supabase.rpc('manage_menu_category', {
        p_action: 'create',
        p_category_id: null,
        p_name: newCategory.trim(),
        p_slug: null,
        p_description: newDescription.trim() || null,
        p_image_url: null,
        p_display_order: null,
        p_is_visible: true,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create category');
      
      toast.success(data.message || 'Category added');
      // Invalidate customer-facing menu cache
      await fetch('/api/admin/invalidate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'menu' }),
      });
      setNewCategory('');
      setNewDescription('');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  // Debounce cache invalidation to avoid repeated calls
  let cacheTimeout: NodeJS.Timeout | null = null;
  const debounceInvalidateCache = () => {
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      invalidateMenuCache();
    }, 500);
  };

  const [optimisticCategories, setOptimisticCategories] = useState<Category[]>(categories);
  useEffect(() => {
    setOptimisticCategories(categories);
  }, [categories]);

  const handleToggleCategory = async (id: string) => {
    // Optimistically update UI
    setOptimisticCategories(prev => prev.map(cat =>
      cat.id === id ? { ...cat, is_visible: !cat.is_visible } : cat
    ));
    debounceInvalidateCache();
    try {
      const category = categories.find(c => c.id === id);
      if (!category) {
        toast.error('Category not found');
        return;
      }
      // Try RPC first, fallback to direct update
      let success = false;
      try {
        const { data, error } = await supabase.rpc('manage_menu_category', {
          p_action: 'toggle',
          p_category_id: id,
          p_name: null,
          p_slug: null,
          p_description: null,
          p_image_url: null,
          p_display_order: null,
          p_is_visible: null,
        });
        if (!error && data?.success) {
          toast.success(data.message);
          success = true;
        }
      } catch (rpcError) {
        console.log('RPC fallback: Using direct update');
      }
      if (!success) {
        const { error } = await supabase
          .from('menu_categories')
          .update({ is_visible: !category.is_visible, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        toast.success(category.is_visible ? 'Category hidden' : 'Category visible');
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
      const { data, error } = await supabase.rpc('manage_menu_category', {
        p_action: 'update',
        p_category_id: editingCategory.id,
        p_name: editName.trim(),
        p_slug: null,
        p_description: editDescription.trim() || null,
        p_image_url: null,
        p_display_order: null,
        p_is_visible: null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update category');
      
      toast.success(data.message || 'Category updated');
      // Invalidate customer-facing menu cache
      await fetch('/api/admin/invalidate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'menu' }),
      });
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
      const { data, error } = await supabase.rpc('manage_menu_category', {
        p_action: 'delete',
        p_category_id: deletingCategory.id,
        p_name: null,
        p_slug: null,
        p_description: null,
        p_image_url: null,
        p_display_order: null,
        p_is_visible: null,
      });

      if (error) throw error;
      if (!data?.success) {
        if (data?.item_count) {
          toast.error(`Cannot delete: ${data.item_count} items in this category`);
        } else {
          throw new Error(data?.error || 'Failed to delete category');
        }
        return;
      }
      
      toast.success(data.message || 'Category deleted');
      // Invalidate customer-facing menu cache
      await fetch('/api/admin/invalidate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'menu' }),
      });
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

// Main Menu Management Page
export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use RPC for faster data fetching with proper security
      const { data, error } = await supabase.rpc('get_menu_management_data');
      
      if (error) {
        // Fallback to direct queries if RPC not available
        console.warn('RPC not available, using fallback queries');
        const [itemsRes, categoriesRes] = await Promise.all([
          supabase.from('menu_items').select('*').order('created_at', { ascending: false }),
          supabase.from('menu_categories').select('*').order('display_order'),
        ]);

        if (itemsRes.data) setItems(itemsRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
      } else if (data) {
        setItems(data.items || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        const { data: result, error } = await supabase.rpc('update_menu_item_advanced', {
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
        const { data: result, error } = await supabase.rpc('create_menu_item_advanced', {
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
      const { data, error } = await supabase.rpc('delete_menu_item', {
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
            console.error('Failed to delete image:', imgError);
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
      const { error } = await supabase.rpc('update_menu_item', {
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
      const { error } = await supabase.rpc('update_menu_item', {
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
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Deals & Combos</h3>
              <p className="text-muted-foreground mb-4">
                Create special deals and combo offers
              </p>
              <Button onClick={() => router.push('/portal/deals/add')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </CardContent>
          </Card>
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
