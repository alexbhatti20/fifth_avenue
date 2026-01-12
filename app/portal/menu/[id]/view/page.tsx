'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit,
  DollarSign,
  Clock,
  Tag,
  Flame,
  Leaf,
  Star,
  Eye,
  EyeOff,
  Sparkles,
  Package,
  Calendar,
  TrendingUp,
  MessageSquare,
  Heart,
  Share2,
  Trash2,
  Ruler,
  Check,
  X as XIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Image from 'next/image';

const supabase = createClient();

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
  slug: string;
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
  rating: number;
  total_reviews: number;
  tags: string[];
  nutrition_info: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  created_at: string;
  updated_at: string;
  category?: {
    name: string;
    slug: string;
  };
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

export default function ViewMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    fetchMenuItem();
  }, [id]);

  const fetchMenuItem = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories(name, slug)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (error) {
      console.error('Error fetching menu item:', error);
      toast.error('Failed to load menu item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Use RPC function to delete and get images
      const { data, error } = await supabase.rpc('delete_menu_item', {
        p_item_id: id,
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
          }
        }
      }

      toast.success('Menu item deleted successfully!');
      await invalidateMenuCache();
      router.push('/portal/menu');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete menu item');
    } finally {
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Item not found</h2>
          <Button onClick={() => router.push('/portal/menu')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  const images = item.images?.length > 0 ? item.images : ['/assets/placeholder.png'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/portal/menu')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
                <p className="text-sm text-gray-500">
                  {item.category?.name} • Created {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/portal/menu/${id}`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Images & Gallery */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Image */}
            <Card>
              <CardContent className="p-6">
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={images[selectedImage]}
                    alt={item.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {item.is_featured && (
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500">
                        <Star className="mr-1 h-3 w-3" fill="currentColor" />
                        Featured
                      </Badge>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    {!item.is_available && (
                      <Badge variant="destructive">
                        <EyeOff className="mr-1 h-3 w-3" />
                        Unavailable
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Thumbnail Gallery */}
                {images.length > 1 && (
                  <div className="grid grid-cols-6 gap-2 mt-4">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden transition-all",
                          selectedImage === idx
                            ? "ring-2 ring-primary scale-105"
                            : "opacity-60 hover:opacity-100"
                        )}
                      >
                        <Image
                          src={img}
                          alt={`${item.name} ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>

            {/* Nutrition Information */}
            {item.nutrition_info && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-green-600" />
                    Nutrition Information
                  </CardTitle>
                  <CardDescription>Per serving</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">
                        {item.nutrition_info.calories || item.calories || 0}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Calories</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {item.nutrition_info.protein || 0}g
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Protein</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                      <div className="text-3xl font-bold text-yellow-600">
                        {item.nutrition_info.carbs || 0}g
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Carbs</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                      <div className="text-3xl font-bold text-red-600">
                        {item.nutrition_info.fat || 0}g
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Fat</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details & Stats */}
          <div className="space-y-6">
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.has_variants && item.size_variants && item.size_variants.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Ruler className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Size Variants</span>
                    </div>
                    {item.size_variants.map((variant, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          variant.is_available 
                            ? "bg-green-50 border-green-200" 
                            : "bg-gray-50 border-gray-200 opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{variant.size}</span>
                          {variant.is_available ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <XIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          Rs. {variant.price}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3">
                    {item.sale_price > 0 && item.sale_price < item.price ? (
                      <>
                        <span className="text-3xl font-bold text-green-600">
                          Rs. {item.sale_price}
                        </span>
                        <span className="text-xl text-gray-400 line-through">
                          Rs. {item.price}
                        </span>
                        <Badge variant="destructive">
                          Save {Math.round(((item.price - item.sale_price) / item.price) * 100)}%
                        </Badge>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-gray-900">
                        Rs. {item.price}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attributes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-purple-600" />
                  Attributes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">Prep Time</span>
                  </div>
                  <span className="font-semibold">{item.preparation_time} min</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-gray-600">Spicy</span>
                  </div>
                  <Badge variant={item.is_spicy ? "destructive" : "secondary"}>
                    {item.is_spicy ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">Vegetarian</span>
                  </div>
                  <Badge variant={item.is_vegetarian ? "default" : "secondary"}>
                    {item.is_vegetarian ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Availability</span>
                  </div>
                  <Badge variant={item.is_available ? "default" : "destructive"}>
                    {item.is_available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Ratings & Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Ratings & Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-4xl font-bold">{item.rating || 0}</span>
                    <Star className="h-8 w-8 text-yellow-500" fill="currentColor" />
                  </div>
                  <p className="text-gray-600">
                    {item.total_reviews || 0} total reviews
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-600" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Item ID:</span>
                  <span className="font-mono text-xs">{item.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Slug:</span>
                  <span className="font-mono text-xs">{item.slug}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{item.name}" from the menu. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
