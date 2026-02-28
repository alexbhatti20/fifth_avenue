'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  ImagePlus,
  X,
  DollarSign,
  Clock,
  Tag,
  Flame,
  Leaf,
  Star,
  Upload,
  Check,
  Package,
  FileText,
  Sparkles,
  Trash2,
  Ruler,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { uploadMenuImage, deleteStorageFile } from '@/lib/storage';
import { createClient } from '@/lib/supabase';
import { updateMenuItemAdvanced, deleteMenuItemServer } from '@/lib/actions';
import { PortalLoader } from '@/components/portal/PortalLoader';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const supabase = createClient();

interface Category {
  id: string;
  name: string;
  slug: string;
}

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
  category_id: string;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  preparation_time?: number;
  nutrition_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

interface FormData {
  name: string;
  description: string;
  price: number;
  sale_price: number;
  category_id: string;
  images: string[];
  is_available: boolean;
  is_featured: boolean;
  is_spicy: boolean;
  is_vegetarian: boolean;
  preparation_time: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  has_variants: boolean;
  size_variants: SizeVariant[];
}

interface EditMenuClientProps {
  id: string;
  initialItem: MenuItem | null;
  categories: Category[];
}

const DEFAULT_SIZES = ['Small', 'Medium', 'Large', 'Extra Large'];

const STEPS = [
  { id: 1, title: 'Basic Info', icon: FileText, description: 'Name & description' },
  { id: 2, title: 'Pricing', icon: DollarSign, description: 'Set prices' },
  { id: 3, title: 'Size Variants', icon: Ruler, description: 'Size options' },
  { id: 4, title: 'Images', icon: ImagePlus, description: 'Upload photos' },
  { id: 5, title: 'Attributes', icon: Tag, description: 'Item properties' },
  { id: 6, title: 'Nutrition', icon: Sparkles, description: 'Nutrition info' },
];

export default function EditMenuClient({ id, initialItem, categories }: EditMenuClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Processing…');
  const [imagePreview, setImagePreview] = useState<string[]>(initialItem?.images || []);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Initialize form data from SSR data
  const [formData, setFormData] = useState<FormData>(() => {
    if (initialItem) {
      return {
        name: initialItem.name || '',
        description: initialItem.description || '',
        price: initialItem.price || 0,
        sale_price: initialItem.sale_price || 0,
        category_id: initialItem.category_id || '',
        images: initialItem.images || [],
        is_available: initialItem.is_available ?? true,
        is_featured: initialItem.is_featured ?? false,
        is_spicy: initialItem.is_spicy ?? false,
        is_vegetarian: initialItem.is_vegetarian ?? false,
        preparation_time: initialItem.preparation_time || 15,
        calories: initialItem.nutrition_info?.calories || 0,
        protein: initialItem.nutrition_info?.protein || 0,
        carbs: initialItem.nutrition_info?.carbs || 0,
        fat: initialItem.nutrition_info?.fat || 0,
        has_variants: initialItem.has_variants ?? false,
        size_variants: initialItem.size_variants || [],
      };
    }
    return {
      name: '',
      description: '',
      price: 0,
      sale_price: 0,
      category_id: categories[0]?.id || '',
      images: [],
      is_available: true,
      is_featured: false,
      is_spicy: false,
      is_vegetarian: false,
      preparation_time: 15,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      has_variants: false,
      size_variants: [],
    };
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploadingImage(true);
    
    for (const file of Array.from(files)) {
      try {
        // Upload with compression
        const result = await uploadMenuImage(file);
        if (result.success && result.url) {
          setImagePreview(prev => [...prev, result.url!]);
          setFormData(prev => ({ ...prev, images: [...prev.images, result.url!] }));
          toast.success('Image uploaded & compressed');
        } else {
          toast.error(result.error || 'Failed to upload image');
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to upload image');
      }
    }
    
    setIsUploadingImage(false);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const urlToRemove = imagePreview[index];
    setImagePreview(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    // If this URL was already saved in the DB, delete it from storage too
    if (urlToRemove && initialItem?.images?.includes(urlToRemove)) {
      deleteStorageFile(urlToRemove).catch(() => {});
    }
  };

  // Size variants helpers
  const addSizeVariant = () => {
    const usedSizes = formData.size_variants.map(v => v.size);
    const availableSize = DEFAULT_SIZES.find(s => !usedSizes.includes(s)) || `Size ${formData.size_variants.length + 1}`;
    setFormData(prev => ({
      ...prev,
      size_variants: [...prev.size_variants, { size: availableSize, price: prev.price || 0, is_available: true }]
    }));
  };

  const updateSizeVariant = (index: number, field: keyof SizeVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      size_variants: prev.size_variants.map((v, i) => 
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeSizeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      size_variants: prev.size_variants.filter((_, i) => i !== index)
    }));
  };

  const toggleHasVariants = (enabled: boolean) => {
    if (enabled && formData.size_variants.length === 0) {
      setFormData(prev => ({
        ...prev,
        has_variants: true,
        size_variants: DEFAULT_SIZES.map((size, i) => ({
          size,
          price: prev.price + (i * 50),
          is_available: true
        }))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        has_variants: enabled
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category_id || formData.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoadingLabel('Saving changes…');
    setIsLoading(true);
    try {
      // Use Server Action to update menu item (hidden from Network tab)
      const result = await updateMenuItemAdvanced({
        item_id: id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        category_id: formData.category_id,
        images: formData.images,
        is_available: formData.is_available,
        is_featured: formData.is_featured,
        preparation_time: formData.preparation_time,
        has_variants: formData.has_variants,
        size_variants: formData.has_variants && formData.size_variants.length > 0 
          ? formData.size_variants 
          : null,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Menu item updated successfully!');
      router.push('/portal/menu');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update menu item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoadingLabel('Deleting item…');
    setIsLoading(true);
    try {
      // Use Server Action to delete menu item (hidden from Network tab)
      const result = await deleteMenuItemServer(id);

      if (!result.success) throw new Error(result.error);

      // Delete images from storage
      if (formData.images && Array.isArray(formData.images)) {
        for (const imageUrl of formData.images) {
          deleteStorageFile(imageUrl).catch(() => {}); // non-blocking, silent fail
        }
      }

      toast.success('Menu item deleted successfully!');
      router.push('/portal/menu');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete menu item');
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.description && formData.category_id;
      case 2:
        return formData.price > 0;
      default:
        return true;
    }
  };

  // If no item found
  if (!initialItem) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Menu item not found</h2>
          <Button onClick={() => router.push('/portal/menu')}>Back to Menu</Button>
        </div>
      </div>
    );
  }

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
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Crispy Chicken Burger"
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the item, ingredients, taste..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
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
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price">Regular Price (Rs.) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="pl-10 text-lg"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price">Sale Price (Rs.)</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sale_price"
                    type="number"
                    value={formData.sale_price || ''}
                    onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0 (leave empty for no sale)"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time">Preparation Time (minutes)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="prep_time"
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) || 15 })}
                  className="pl-10"
                />
              </div>
            </div>

            {formData.sale_price > 0 && formData.price > 0 && (
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600">Customer Savings</span>
                    <span className="text-lg font-bold text-green-600">
                      Rs. {(formData.price - formData.sale_price).toFixed(0)} ({((1 - formData.sale_price / formData.price) * 100).toFixed(0)}% off)
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card
              className={cn(
                'cursor-pointer transition-all border-2',
                formData.has_variants
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:border-zinc-300'
              )}
              onClick={() => toggleHasVariants(!formData.has_variants)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  formData.has_variants ? 'bg-primary text-white' : 'bg-zinc-200 dark:bg-zinc-700'
                )}>
                  <Ruler className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Enable Size Variants</h4>
                  <p className="text-sm text-muted-foreground">
                    Offer this item in multiple sizes with different prices
                  </p>
                </div>
                {formData.has_variants && <Check className="h-5 w-5 text-primary" />}
              </CardContent>
            </Card>

            {formData.has_variants && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-base">Size Options</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSizeVariant}>
                    <Plus className="h-4 w-4 mr-1" /> Add Size
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.size_variants.map((variant, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Size Name</Label>
                              <Select
                                value={variant.size}
                                onValueChange={(value) => updateSizeVariant(index, 'size', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEFAULT_SIZES.map((size) => (
                                    <SelectItem key={size} value={size}>{size}</SelectItem>
                                  ))}
                                  <SelectItem value="custom">Custom...</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Price (Rs.)</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  value={variant.price || ''}
                                  onChange={(e) => updateSizeVariant(index, 'price', parseFloat(e.target.value) || 0)}
                                  className="pl-10"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Availability</Label>
                              <div className="flex items-center h-10">
                                <Button
                                  type="button"
                                  variant={variant.is_available ? "default" : "outline"}
                                  size="sm"
                                  className={cn("w-full", variant.is_available && "bg-green-500 hover:bg-green-600")}
                                  onClick={() => updateSizeVariant(index, 'is_available', !variant.is_available)}
                                >
                                  {variant.is_available ? (<><Check className="h-4 w-4 mr-1" /> Available</>) : 'Unavailable'}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                            onClick={() => removeSizeVariant(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {formData.size_variants.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <Ruler className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No sizes added yet</p>
                        <p className="text-sm">Click "Add Size" to create size variants</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
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
            <div className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
              isUploadingImage 
                ? "border-primary/50 bg-primary/5" 
                : "border-zinc-300 dark:border-zinc-700 hover:border-primary/50"
            )}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploadingImage}
              />
              <label htmlFor="image-upload" className={cn("cursor-pointer", isUploadingImage && "cursor-wait")}>
                {isUploadingImage ? (
                  <>
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full"
                      style={{
                        background: 'conic-gradient(from 0deg, transparent 0%, #d4163c 30%, #8b0e26 65%, #141414 85%, transparent 100%)',
                        animation: 'zoiroSpin 0.8s linear infinite',
                        WebkitMaskImage: 'radial-gradient(circle, transparent 48%, black 50%)',
                        maskImage: 'radial-gradient(circle, transparent 48%, black 50%)',
                      }}
                    />
                    <p className="text-lg font-medium">Compressing &amp; uploading…</p>
                    <p className="text-sm text-muted-foreground mt-1">Converting to WebP</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Drop images here or click to upload</p>
                    <p className="text-sm text-muted-foreground mt-1">Images are automatically compressed (WebP format)</p>
                  </>
                )}
              </label>
            </div>

            {imagePreview.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreview.map((img, index) => (
                  <div key={index} className="relative group aspect-square rounded-lg overflow-hidden">
                    <img src={img} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    {index === 0 && (
                      <Badge className="absolute bottom-2 left-2 bg-primary">Primary</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={cn(
                  'cursor-pointer transition-all border-2',
                  formData.is_available ? 'border-green-500 bg-green-500/10' : 'border-transparent hover:border-zinc-300'
                )}
                onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    formData.is_available ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
                  )}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-medium">Available</h4>
                    <p className="text-sm text-muted-foreground">Item is ready to order</p>
                  </div>
                  {formData.is_available && <Check className="h-5 w-5 text-green-500 ml-auto" />}
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all border-2',
                  formData.is_featured ? 'border-yellow-500 bg-yellow-500/10' : 'border-transparent hover:border-zinc-300'
                )}
                onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    formData.is_featured ? 'bg-yellow-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
                  )}>
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-medium">Featured</h4>
                    <p className="text-sm text-muted-foreground">Show on homepage</p>
                  </div>
                  {formData.is_featured && <Check className="h-5 w-5 text-yellow-500 ml-auto" />}
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all border-2',
                  formData.is_spicy ? 'border-red-500 bg-red-500/10' : 'border-transparent hover:border-zinc-300'
                )}
                onClick={() => setFormData({ ...formData, is_spicy: !formData.is_spicy })}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    formData.is_spicy ? 'bg-red-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
                  )}>
                    <Flame className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-medium">Spicy</h4>
                    <p className="text-sm text-muted-foreground">Contains hot spices</p>
                  </div>
                  {formData.is_spicy && <Check className="h-5 w-5 text-red-500 ml-auto" />}
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all border-2',
                  formData.is_vegetarian ? 'border-green-600 bg-green-600/10' : 'border-transparent hover:border-zinc-300'
                )}
                onClick={() => setFormData({ ...formData, is_vegetarian: !formData.is_vegetarian })}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    formData.is_vegetarian ? 'bg-green-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
                  )}>
                    <Leaf className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-medium">Vegetarian</h4>
                    <p className="text-sm text-muted-foreground">No meat content</p>
                  </div>
                  {formData.is_vegetarian && <Check className="h-5 w-5 text-green-600 ml-auto" />}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <p className="text-sm text-muted-foreground">
              Add nutritional information (optional). This helps health-conscious customers.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Calories (kcal)</Label>
                <Input
                  type="number"
                  value={formData.calories || ''}
                  onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Protein (g)</Label>
                <Input
                  type="number"
                  value={formData.protein || ''}
                  onChange={(e) => setFormData({ ...formData, protein: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Carbs (g)</Label>
                <Input
                  type="number"
                  value={formData.carbs || ''}
                  onChange={(e) => setFormData({ ...formData, carbs: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Fat (g)</Label>
                <Input
                  type="number"
                  value={formData.fat || ''}
                  onChange={(e) => setFormData({ ...formData, fat: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            <Separator />

            <Card className="bg-zinc-50 dark:bg-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-lg">Item Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{formData.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">
                    {categories.find(c => c.id === formData.category_id)?.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium">
                    {formData.has_variants && formData.size_variants.length > 0 ? (
                      <span className="text-sm">
                        Rs. {Math.min(...formData.size_variants.map(v => v.price))} - Rs. {Math.max(...formData.size_variants.map(v => v.price))}
                      </span>
                    ) : (
                      `Rs. ${formData.price}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Images:</span>
                  <span className="font-medium">{formData.images.length} uploaded</span>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {formData.is_available && <Badge variant="outline" className="bg-green-500/10">Available</Badge>}
                  {formData.is_featured && <Badge variant="outline" className="bg-yellow-500/10">Featured</Badge>}
                  {formData.is_spicy && <Badge variant="outline" className="bg-red-500/10">Spicy</Badge>}
                  {formData.is_vegetarian && <Badge variant="outline" className="bg-green-600/10">Vegetarian</Badge>}
                  {formData.has_variants && <Badge variant="outline" className="bg-primary/10">Has Sizes</Badge>}
                </div>
              </CardContent>
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
                <h1 className="text-xl font-bold">Edit Menu Item</h1>
                <p className="text-sm text-muted-foreground">Update item details</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isLoading}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || !formData.name || !formData.category_id || formData.price <= 0}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
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
                  {STEPS.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left',
                        currentStep === step.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        currentStep === step.id ? 'bg-white/20' : 'bg-zinc-200 dark:bg-zinc-700'
                      )}>
                        <step.icon className="h-4 w-4" />
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
              <div className="flex items-center gap-2">
                {currentStep < STEPS.length && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(prev => Math.min(STEPS.length, prev + 1))}
                  >
                    Next Step
                  </Button>
                )}
                <Button onClick={handleSubmit} disabled={isLoading || !formData.name || !formData.category_id || formData.price <= 0}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Universal gradient loader */}
      <PortalLoader visible={isLoading} label={loadingLabel} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !isLoading && setShowDeleteDialog(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formData.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
