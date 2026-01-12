"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Heart,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  Star,
  Sparkles,
  Package,
  Plus,
  Minus,
  Gift,
  Percent,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

export default function FavoritesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { addToCart, updateQuantity, items: cartItems } = useCart();
  const { 
    favoritesDetails, 
    isLoading, 
    loadFavoriteDetails, 
    toggleFavorite,
    clearAllFavorites,
    favoritesCount 
  } = useFavorites();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 60, scale: 0.9, rotateX: -15 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: { type: "spring" as const, stiffness: 80, damping: 15 }
    },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Load full details when page loads
  useEffect(() => {
    if (user) {
      loadFavoriteDetails();
    }
  }, [user, loadFavoriteDetails]);

  const handleRemoveFavorite = async (itemId: string, itemType: "menu_item" | "deal", name: string) => {
    await toggleFavorite(itemId, itemType);
    toast({
      title: "Removed from favorites",
      description: `${name} has been removed from your favorites`,
    });
  };

  const handleAddToCart = (item: any) => {
    if (!item.is_available) {
      toast({
        title: "Item Unavailable",
        description: "This item is currently not available",
        variant: "destructive",
      });
      return;
    }

    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url,
    });

    toast({
      title: "Added to Cart! 🛒",
      description: `${item.name} has been added to your cart`,
    });
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cartItems.find((i) => i.id === itemId);
    return cartItem?.quantity || 0;
  };

  const handleClearAll = async () => {
    await clearAllFavorites();
    toast({
      title: "Favorites Cleared",
      description: "All items have been removed from your favorites",
    });
  };

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-8 h-8 text-primary" />
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-500/10 via-pink-500/10 to-red-500/10 p-8 border"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bebas mb-2 flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Heart className="h-8 w-8 text-red-500 fill-red-500" />
                  </motion.div>
                  My Favorites
                  <span className="text-lg bg-red-500 text-white px-3 py-1 rounded-full">
                    {favoritesCount}
                  </span>
                </h1>
                <p className="text-muted-foreground">
                  Your saved items for quick ordering
                </p>
              </div>
              
              {favoritesCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </motion.div>

          {/* Favorites Grid */}
          {favoritesDetails.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Heart className="w-20 h-20 mx-auto text-muted-foreground/30 mb-6" />
              </motion.div>
              <h3 className="text-2xl font-bebas mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Start adding items to your favorites by tapping the heart icon on any menu item!
              </p>
              <Button 
                onClick={() => router.push("/menu")} 
                className="rounded-full h-12 px-8 bg-gradient-to-r from-red-500 to-red-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Browse Menu
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {favoritesDetails.map((item, index) => {
                  const isDeal = item.type === "deal";
                  const itemId = isDeal ? `deal-${item.id}` : item.id;
                  const quantity = getCartQuantity(itemId);
                  const discountPercent = item.original_price && item.original_price > item.price 
                    ? Math.round((1 - item.price / item.original_price) * 100) 
                    : 0;
                  const imageUrl = item.image_url;
                  
                  return (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      variants={cardVariants}
                      layout
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                      className="group bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                    >
                      <div className="relative h-48 bg-muted overflow-hidden">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                            {isDeal ? (
                              <Gift className="w-16 h-16 text-white/50" />
                            ) : (
                              <Package className="w-16 h-16 text-white/50" />
                            )}
                          </div>
                        )}
                        
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                        {/* Unavailable Overlay */}
                        {!item.is_available && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm z-20">
                            <span className="text-white font-bold px-4 py-2 bg-red-500 rounded-full text-sm">
                              Currently Unavailable
                            </span>
                          </div>
                        )}

                        {/* Top Left Badges */}
                        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                          {isDeal && discountPercent > 0 && (
                            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              {discountPercent}% OFF
                            </span>
                          )}
                          {isDeal && (
                            <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              Deal
                            </span>
                          )}
                          {!isDeal && item.is_featured && (
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                              Popular
                            </span>
                          )}
                        </div>

                        {/* Favorite Heart Button */}
                        <motion.button
                          onClick={() => handleRemoveFavorite(item.id, item.type, item.name)}
                          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg transition-all z-10 hover:bg-red-600"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Heart className="h-5 w-5 fill-current" />
                        </motion.button>

                        {/* Bottom Left - Category Badge */}
                        <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full z-10">
                          {item.category}
                        </span>

                        {/* Bottom Right - Rating Badge */}
                        <span className="absolute bottom-3 right-3 bg-background/90 text-foreground text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 z-10">
                          <Star className="w-3 h-3 text-accent fill-accent" />
                          {item.rating ? item.rating.toFixed(1) : 'New'}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-5">
                        <h3 className="text-lg font-bebas group-hover:text-primary transition-colors line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                          {item.description || "Delicious item from our menu"}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xl font-bold text-primary">Rs. {item.price}</span>
                            {item.original_price && item.original_price > item.price && (
                              <span className="text-sm text-muted-foreground line-through ml-2">
                                Rs. {item.original_price}
                              </span>
                            )}
                          </div>
                          
                          {item.is_available ? (
                            quantity > 0 ? (
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-8 w-8 rounded-full" 
                                  onClick={() => updateQuantity(itemId, quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold w-6 text-center">{quantity}</span>
                                <Button 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90" 
                                  onClick={() => updateQuantity(itemId, quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                                <Button 
                                  size="icon" 
                                  className="rounded-full bg-primary hover:bg-primary/90" 
                                  onClick={() => handleAddToCart(item)}
                                >
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </motion.div>
                            )
                          ) : (
                            <span className="text-xs text-red-500 font-medium">Unavailable</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
