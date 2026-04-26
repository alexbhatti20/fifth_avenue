"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Heart,
  Trash2,
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { cn } from "@/lib/utils";

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

  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasCheckedAuth(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router, hasCheckedAuth]);

  useEffect(() => {
    if (user) {
      loadFavoriteDetails();
    }
  }, [user, loadFavoriteDetails]);

  const handleRemoveFavorite = async (itemId: string, itemType: "menu_item" | "deal", name: string) => {
    await toggleFavorite(itemId, itemType);
    toast({
      title: "REMOVED FROM SQUAD",
      description: `${name.toUpperCase()} HAS BEEN EJECTED FROM FAVORITES.`,
    });
  };

  const handleAddToCart = (item: any) => {
    if (!item.is_available) {
      toast({
        title: "OUT OF STOCK",
        description: "THIS ITEM IS CURRENTLY OFFLINE.",
        variant: "destructive",
      });
      return;
    }

    const added = addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url,
    });

    if (!added) return;

    toast({
      title: "STREET PACK ADDED!",
      description: `${item.name.toUpperCase()} IS IN YOUR CART.`,
    });
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cartItems.find((i) => i.id === itemId);
    return cartItem?.quantity || 0;
  };

  const handleClearAll = async () => {
    await clearAllFavorites();
    toast({
      title: "SQUAD WIPED",
      description: "ALL FAVORITES HAVE BEEN REMOVED.",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FFD200] flex items-center justify-center p-4">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="mb-4 inline-block"
          >
            <RefreshCw className="w-16 h-16 text-black" />
          </motion.div>
          <p className="font-bebas text-4xl text-black tracking-widest animate-pulse">RELOADING THE STREETS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 bg-[#FFD200]/5 relative overflow-hidden">
      {/* Background Text Decals */}
      <div className="absolute top-40 -left-20 opacity-[0.03] select-none pointer-events-none rotate-90">
         <span className="text-[15rem] font-bebas leading-none">FAVORITES</span>
      </div>
      <div className="absolute bottom-40 -right-20 opacity-[0.03] select-none pointer-events-none -rotate-90">
         <span className="text-[15rem] font-bebas leading-none">STREET</span>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Top Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-10"
        >
          <Button
            onClick={() => router.back()}
            className="group bg-black text-white rounded-none border-4 border-black font-bebas text-xl h-14 px-8 shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
          >
            <ArrowLeft className="mr-3 h-6 w-6 group-hover:-translate-x-1 transition-transform" />
            STREET BACK
          </Button>
        </motion.div>

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 bg-black border-4 border-black p-8 md:p-12 shadow-[10px_10px_0px_0px_rgba(237,28,36,1)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Heart className="h-48 w-48 text-white fill-white" />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="bg-[#ED1C24] text-white font-bebas text-2xl px-4 py-1 border-2 border-white">SQUAD SAVES</span>
                <span className="font-caveat text-3xl text-[#FFD200] italic">Your personal street menu</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-bebas text-white leading-none tracking-tighter uppercase">
                THE FAVORITE <span className="text-[#FFD200]">DROPS</span>
              </h1>
              <div className="flex items-center gap-3 mt-6">
                 <div className="h-1 w-20 bg-[#FFD200]" />
                 <p className="font-bebas text-2xl text-white/60 tracking-widest uppercase">
                   {favoritesCount} ITEMS REINFORCED
                 </p>
              </div>
            </div>
            
            {favoritesCount > 0 && (
              <Button
                onClick={handleClearAll}
                className="bg-[#ED1C24] text-white border-4 border-black rounded-none h-16 px-10 font-bebas text-2xl tracking-widest shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <Trash2 className="mr-3 h-6 w-6" />
                WIPE ALL SAVES
              </Button>
            )}
          </div>
        </motion.div>

        {/* Favorites Grid */}
        {favoritesDetails.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-24 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-4xl mx-auto"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="inline-block mb-8"
            >
              <Heart className="w-32 h-32 text-[#ED1C24] fill-[#ED1C24]" />
            </motion.div>
            <h3 className="text-5xl font-bebas mb-4 text-black uppercase tracking-tight">YOUR SQUAD IS EMPTY</h3>
            <p className="font-caveat text-3xl text-black/50 mb-10 italic px-4">
              "No flavors saved? The street is calling..."
            </p>
            <Button 
              onClick={() => router.push("/menu")} 
              className="bg-black text-[#FFD200] border-4 border-black rounded-none h-20 px-16 font-bebas text-3xl tracking-[0.2em] shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
            >
              <Sparkles className="mr-4 h-8 w-8" />
              HIT THE STREETS
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {favoritesDetails.map((item, index) => {
                const isDeal = item.type === "deal";
                const itemId = isDeal ? `deal-${item.id}` : item.id;
                const quantity = getCartQuantity(itemId);
                const discountPercent = item.original_price && item.original_price > item.price 
                  ? Math.round((1 - item.price / item.original_price) * 100) 
                  : 0;
                
                return (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative flex flex-col hover:-translate-y-2 transition-all duration-300"
                  >
                    {/* Visual Header */}
                    <div className="relative h-60 bg-black overflow-hidden border-b-4 border-black">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#ED1C24] flex items-center justify-center">
                          {isDeal ? <Gift className="w-20 h-20 text-white/30" /> : <Package className="w-20 h-20 text-white/30" />}
                        </div>
                      )}
                      
                      {/* Tags & Badges */}
                      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                        {isDeal && (
                          <div className="bg-[#FFD200] border-2 border-black px-3 py-1 font-bebas text-xl text-black flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                             <Tag className="h-4 w-4" /> STREET DEAL
                          </div>
                        )}
                        {discountPercent > 0 && (
                          <div className="bg-white border-2 border-black px-3 py-1 font-bebas text-xl text-[#ED1C24] flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                             <Percent className="h-4 w-4" /> {discountPercent}% DROP
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFavorite(item.id, item.type, item.name)}
                        className="absolute top-4 right-4 w-12 h-12 bg-white border-4 border-black text-[#ED1C24] flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all z-20"
                      >
                        <Heart className="h-6 w-6 fill-current" />
                      </button>

                      {/* Unavailable Overlay */}
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                          <div className="bg-[#ED1C24] border-4 border-white text-white font-bebas text-3xl px-6 py-2 rotate-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            OFF THE STREET
                          </div>
                        </div>
                      )}

                      {/* Bottom Visual Info */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                        <span className="bg-black text-white font-bebas text-lg px-3 border border-white/20">
                          {item.category?.toUpperCase() || "STREET FOOD"}
                        </span>
                        <div className="bg-[#FFD200] border-2 border-black px-2 py-0.5 flex items-center gap-1">
                          <Star className="h-4 w-4 fill-black" />
                          <span className="font-bebas text-xl text-black">{item.rating ? item.rating.toFixed(1) : 'NEW'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col bg-white">
                      <h3 className="font-bebas text-3xl text-black leading-none mb-2 group-hover:text-[#ED1C24] transition-colors">
                        {item.name.toUpperCase()}
                      </h3>
                      <p className="font-caveat text-xl text-black/50 mb-6 italic line-clamp-2 leading-tight">
                        {item.description || "The original street flavor you've been craving."}
                      </p>
                      
                      <div className="mt-auto pt-6 border-t-2 border-black/5 flex items-center justify-between">
                        <div className="flex flex-col">
                          {item.original_price && item.original_price > item.price && (
                            <span className="font-bebas text-lg text-black/30 line-through">Rs. {item.original_price}</span>
                          )}
                          <span className="font-bebas text-4xl text-black leading-none">Rs. {item.price}</span>
                        </div>
                        
                        {item.is_available && (
                          <div className="flex items-center gap-3">
                            {quantity > 0 ? (
                              <div className="flex items-center bg-black border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(255,210,0,1)]">
                                <button 
                                  onClick={() => updateQuantity(itemId, quantity - 1)}
                                  className="h-10 w-10 flex items-center justify-center text-[#FFD200] hover:bg-white/10"
                                >
                                  <Minus className="h-5 w-5" />
                                </button>
                                <span className="font-bebas text-2xl text-white px-3 min-w-[2rem] text-center">{quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(itemId, quantity + 1)}
                                  className="h-10 w-10 flex items-center justify-center text-[#FFD200] hover:bg-white/10 border-l border-white/20"
                                >
                                  <Plus className="h-5 w-5" />
                                </button>
                              </div>
                            ) : (
                              <Button 
                                onClick={() => handleAddToCart(item)}
                                className="bg-black text-[#FFD200] border-4 border-black rounded-none h-14 w-14 p-0 shadow-[4px_4px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                              >
                                <Plus className="h-8 w-8" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
