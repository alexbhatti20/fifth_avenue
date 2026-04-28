"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Clock, Star, Minus, Plus, Users, Package, ChevronLeft, ChevronRight, Tag, Flame, Sparkles, Info } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CartItem } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import type { Deal } from "@/lib/server-queries";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&h=1200&fit=crop&q=80";

interface MenuDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: any | null; // Use any to handle both item and deal or specific types
  selectedDeal: Deal | null;
  cartItems: CartItem[];
  addToCart: (item: any, size?: string, price?: number) => boolean;
  updateQuantity: (id: string, qty: number) => void;
  handleAddDealToCart: (deal: Deal) => void;
  toast: any;
}

export default function MenuDetailModal({
  open,
  onOpenChange,
  selectedItem,
  selectedDeal,
  cartItems,
  addToCart,
  updateQuantity,
  handleAddDealToCart,
  toast
}: MenuDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedSizePrice, setSelectedSizePrice] = useState<number | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [dialogImgError, setDialogImgError] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(1);

  const itemImages = useMemo(() => {
    const fromArray = Array.isArray(selectedItem?.images)
      ? selectedItem.images.filter((img: string) => Boolean(img))
      : [];

    if (fromArray.length > 0) return fromArray;
    if (selectedItem?.image) return [selectedItem.image];
    return [FALLBACK_IMAGE];
  }, [selectedItem]);

  const currentPrice = selectedSizePrice ?? selectedItem?.price ?? 0;

  const cartItemId = useMemo(() => {
    if (!selectedItem) return "";

    return selectedItem.has_variants && selectedSize
      ? `${selectedItem.id}-${selectedSize.toLowerCase().replace(/\s+/g, "-")}`
      : selectedItem.id;
  }, [selectedItem, selectedSize]);

  const qty = useMemo(() => {
    if (!cartItemId) return 0;
    return cartItems.find((item) => (item.cartItemId || item.id) === cartItemId)?.quantity || 0;
  }, [cartItems, cartItemId]);

  const dealCartItemId = useMemo(() => {
    if (!selectedDeal) return "";
    return `deal-${selectedDeal.id}`;
  }, [selectedDeal]);

  const dealQty = useMemo(() => {
    if (!dealCartItemId) return 0;
    return cartItems.find((item) => (item.cartItemId || item.id) === dealCartItemId)?.quantity || 0;
  }, [cartItems, dealCartItemId]);

  const requiresSizeSelection = Boolean(selectedItem?.has_variants && !selectedSize);

  // Reset state when modal closes or item changes
  useEffect(() => {
    if (!open) {
      setSelectedSize(null);
      setSelectedSizePrice(null);
      setActiveImageIndex(0);
      setDialogImgError(false);
      setLocalQuantity(1);
    }
  }, [open]);

  useEffect(() => {
    if (qty > 0) {
      setLocalQuantity(qty);
    }
  }, [qty]);

  useEffect(() => {
    if (!open) return;

    setActiveImageIndex(0);
    setDialogImgError(false);

    if (selectedItem?.has_variants && selectedItem?.size_variants?.length > 0) {
      const defaultVariant = selectedItem.size_variants.find((v: any) => v.is_available) || selectedItem.size_variants[0];
      if (defaultVariant) {
        setSelectedSize(defaultVariant.size);
        setSelectedSizePrice(defaultVariant.price);
      }
      return;
    }

    setSelectedSize(null);
    setSelectedSizePrice(null);
  }, [open, selectedItem]);

  const { user } = useAuth();

  const handleAddCurrentItem = () => {
    if (!selectedItem || requiresSizeSelection) return;

    if (!user) {
      toast({
        title: "STREET ACCESS ONLY",
        description: "JOIN THE SQUAD TO ADD FLAVOURS TO YOUR BASKET.",
        variant: "destructive",
      });
      return;
    }

    // Add multiple if localQuantity > 1
    // We call addToCart once, but we need to modify addToCart to accept quantity?
    // Looking at CartContext, addToCart only adds 1.
    // I'll call it in a loop but with a small delay or ensure state updates are handled.
    // Actually, I can just call it N times, state functional updates will handle it.
    for (let i = 0; i < localQuantity; i++) {
      addToCart(selectedItem, selectedSize || undefined, currentPrice);
    }
    
    toast({ 
      title: "ADDED TO SQUAD", 
      description: `${localQuantity}x ${selectedItem.name} SECURED.` 
    });

    onOpenChange(false);
  };

  const handleIncreaseQty = () => {
    if (!user) {
      toast({
        title: "STREET ACCESS ONLY",
        description: "JOIN THE SQUAD TO ADD FLAVOURS TO YOUR BASKET.",
        variant: "destructive",
      });
      return;
    }

    const nextQty = localQuantity + 1;
    setLocalQuantity(nextQty);
    
    // If already in cart, sync immediately
    if (qty > 0 && cartItemId) {
      updateQuantity(cartItemId, nextQty);
    }
  };

  const handleDecreaseQty = () => {
    if (localQuantity <= 1) return;
    
    const nextQty = localQuantity - 1;
    setLocalQuantity(nextQty);
    
    // If already in cart, sync immediately
    if (qty > 0 && cartItemId) {
      updateQuantity(cartItemId, nextQty);
    }
  };

  const handleIncreaseDealQty = () => {
    if (!selectedDeal || !dealCartItemId) return;

    if (!user) {
      toast({
        title: "STREET ACCESS ONLY",
        description: "JOIN THE SQUAD TO ADD FLAVOURS TO YOUR BASKET.",
        variant: "destructive",
      });
      return;
    }

    if (dealQty === 0) {
      handleAddDealToCart(selectedDeal);
      return;
    }

    updateQuantity(dealCartItemId, dealQty + 1);
  };

  const handleDecreaseDealQty = () => {
    if (!dealCartItemId || dealQty === 0) return;
    updateQuantity(dealCartItemId, Math.max(0, dealQty - 1));
  };

  const goToPreviousImage = () => {
    if (itemImages.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? itemImages.length - 1 : prev - 1));
    setDialogImgError(false);
  };

  const goToNextImage = () => {
    if (itemImages.length <= 1) return;
    setActiveImageIndex((prev) => (prev === itemImages.length - 1 ? 0 : prev + 1));
    setDialogImgError(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] sm:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl p-0 overflow-y-auto sm:overflow-hidden max-h-[90dvh] border-[8px] border-black rounded-none bg-white shadow-[24px_24px_0px_0px_rgba(0,0,0,1)]">
        {!selectedItem && !selectedDeal && (
          <div className="p-20 text-center flex flex-col items-center justify-center bg-[#FFF4CC] min-h-[400px]">
            <div className="w-24 h-24 bg-black text-[#FFD200] border-8 border-black flex items-center justify-center mb-8 animate-bounce shadow-[10px_10px_0_0_rgba(237,28,36,1)]">
              <Info className="w-12 h-12" />
            </div>
            <h2 className="font-bebas text-5xl text-black mb-4 tracking-tighter">SCANNING THE STREETS...</h2>
            <p className="font-source-sans font-black text-black/60 uppercase text-xl mb-8">The squad is gathering the flavours for you.</p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-4 border-black rounded-none font-bebas text-2xl h-16 px-10"
            >
              CANCEL RECKONING
            </Button>
          </div>
        )}
        <DialogTitle className="sr-only">
          {selectedItem?.name || selectedDeal?.name || "Item Details"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          View details, variants and add to cart.
        </DialogDescription>

        {selectedItem && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr]">
            <section className="bg-black text-white border-b-8 xl:border-b-0 xl:border-r-8 border-black">
              <div className="p-4 md:p-6 border-b-4 border-[#FFD200]">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="inline-block bg-[#FFD200] text-black px-4 py-1 font-bebas text-lg md:text-xl border-2 border-black rotate-[-2deg]">
                    FIFTH AVENUE SELECT
                  </div>
                  {selectedItem.is_featured && (
                    <div className="bg-[#ED1C24] text-white px-3 py-1 font-bebas text-sm border-2 border-black rotate-[2deg] flex items-center gap-1">
                      <Flame className="w-4 h-4 fill-white" /> POPULAR
                    </div>
                  )}
                  {selectedItem.is_new && (
                    <div className="bg-[#008A45] text-white px-3 py-1 font-bebas text-sm border-2 border-black rotate-[-1deg] flex items-center gap-1">
                      <Sparkles className="w-4 h-4 fill-white" /> NEW
                    </div>
                  )}
                </div>
                <h2 className="font-bebas text-3xl md:text-4xl leading-none uppercase">{selectedItem.name}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <p className="font-source-sans text-sm md:text-base text-white/80 font-bold">
                    {selectedItem.is_available === false ? "Currently unavailable" : "Freshly prepared and available now"}
                  </p>
                  {selectedItem.total_reviews > 0 && (
                    <div className="flex items-center gap-1 text-[#FFD200]">
                      <Star className="w-4 h-4 fill-[#FFD200]" />
                      <span className="font-bebas text-lg">{selectedItem.rating?.toFixed(1)}</span>
                      <span className="text-xs text-white/50 font-source-sans">({selectedItem.total_reviews} RECKONS)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-5">
                <div className="relative aspect-[5/4] border-4 border-[#FFD200] bg-black overflow-hidden">
                  <Image
                    src={dialogImgError ? FALLBACK_IMAGE : itemImages[activeImageIndex] || FALLBACK_IMAGE}
                    alt={`${selectedItem.name} image ${activeImageIndex + 1}`}
                    fill
                    priority
                    sizes="(max-width: 1280px) 100vw, 55vw"
                    className="object-cover"
                    onError={() => setDialogImgError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

                  {itemImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goToPreviousImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 border-2 border-black bg-[#FFD200] text-black flex items-center justify-center hover:bg-white transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        type="button"
                        onClick={goToNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 border-2 border-black bg-[#FFD200] text-black flex items-center justify-center hover:bg-white transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                  )}

                  <div className="absolute bottom-3 right-3 bg-black text-[#FFD200] border-2 border-[#FFD200] px-3 py-1 font-bebas text-sm tracking-widest">
                    {activeImageIndex + 1} / {itemImages.length}
                  </div>
                </div>

                {itemImages.length > 1 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {itemImages.map((img: string, index: number) => (
                      <button
                        key={`${img}-${index}`}
                        type="button"
                        onClick={() => {
                          setActiveImageIndex(index);
                          setDialogImgError(false);
                        }}
                        className={cn(
                          "relative aspect-square border-2 overflow-hidden transition-all",
                          index === activeImageIndex
                            ? "border-[#FFD200] shadow-[3px_3px_0_0_rgba(255,210,0,0.4)]"
                            : "border-white/40 hover:border-white"
                        )}
                        aria-label={`Go to image ${index + 1}`}
                      >
                        <Image
                          src={img}
                          alt={`${selectedItem.name} thumbnail ${index + 1}`}
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-[#FFF4CC] xl:max-h-[90dvh] xl:overflow-y-auto custom-scrollbar flex flex-col">

              <div className="p-4 md:p-6 border-b-4 border-black">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-caveat text-2xl md:text-3xl text-[#ED1C24] block mb-1">Complete item details</span>
                    <h3 className="font-bebas text-3xl md:text-5xl text-black leading-none uppercase">{selectedItem.name}</h3>
                  </div>
                  <div className="bg-black text-[#FFD200] border-4 border-black px-4 py-3 min-w-[200px]">
                    <p className="font-bebas text-xs tracking-widest">UNIT PRICE</p>
                    <p className="font-bebas text-3xl md:text-4xl leading-none">RS. {currentPrice}</p>
                  </div>
                </div>

                <p className="mt-5 font-source-sans text-lg font-bold text-black/80 leading-relaxed border-l-4 border-[#FFD200] pl-4">
                  {selectedItem.description || "No description available yet."}
                </p>
              </div>

              <div className="p-4 md:p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border-4 border-black p-4">
                    <div className="w-10 h-10 bg-black border-2 border-[#FFD200] flex items-center justify-center mb-3">
                      <Clock className="w-5 h-5 text-[#FFD200]" />
                    </div>
                    <p className="font-bebas text-xs text-black/50 tracking-widest">PREP TIME</p>
                    <p className="font-bebas text-2xl text-black leading-none">{selectedItem.preparation_time || 15} MIN</p>
                  </div>

                  <div className="bg-white border-4 border-black p-4">
                    <div className="w-10 h-10 bg-black border-2 border-[#FFD200] flex items-center justify-center mb-3">
                      <Star className="w-5 h-5 text-[#FFD200] fill-[#FFD200]" />
                    </div>
                    <p className="font-bebas text-xs text-black/50 tracking-widest">RATING</p>
                    <p className="font-bebas text-2xl text-black leading-none">{selectedItem.rating?.toFixed(1) || "NEW"}</p>
                  </div>
                </div>

                {selectedItem.includes && (
                  <div className="bg-white border-4 border-black p-4 md:p-5">
                    <p className="font-bebas text-xs text-black/50 tracking-widest mb-1">INCLUDES</p>
                    <p className="font-source-sans text-base font-bold text-black/85">{selectedItem.includes}</p>
                  </div>
                )}

                {selectedItem.has_variants && selectedItem.size_variants && selectedItem.size_variants.length > 0 && (
                  <div className="bg-white border-4 border-black p-4 md:p-5">
                    <h4 className="font-bebas text-2xl mb-4 text-black tracking-widest flex items-center gap-2">
                      <Package className="w-5 h-5" /> CHOOSE YOUR SIZE
                    </h4>
                    <div className="max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedItem.size_variants.map((variant: any) => (
                          <button
                            key={variant.size}
                            type="button"
                            onClick={() => {
                              if (variant.is_available) {
                                setSelectedSize(variant.size);
                                setSelectedSizePrice(variant.price);
                              }
                            }}
                            disabled={!variant.is_available}
                            className={cn(
                              "w-full flex items-center justify-between p-4 border-4 transition-all text-left relative overflow-hidden group",
                              selectedSize === variant.size
                                ? "border-black bg-[#FFD200] shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                                : "bg-gray-50 border-black/10 text-black hover:border-black",
                              !variant.is_available && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="font-bebas text-xl leading-none">{variant.size}</span>
                              {!variant.is_available && <span className="text-[10px] font-bold text-red-500 uppercase">SOLD OUT</span>}
                            </div>
                            <span className="font-bebas text-xl">RS. {variant.price}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Spacing for sticky footer on mobile */}
                <div className="h-24 sm:h-0" />

                <div className="sticky bottom-0 sm:static bg-[#FFF4CC] sm:bg-transparent border-t-4 sm:border-t-0 border-black p-4 md:p-5 -mx-4 md:-mx-6 mt-auto z-30">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-4 max-w-5xl mx-auto">
                    <div className="w-full lg:max-w-[260px]">
                      <span className="font-bebas text-sm text-black/50 tracking-widest block mb-2">QUANTITY</span>
                      <div className="flex items-center border-4 border-black bg-white h-16">
                        <button
                          type="button"
                          onClick={handleDecreaseQty}
                          disabled={localQuantity <= 1 && qty === 0}
                          className="flex-1 h-full flex items-center justify-center hover:bg-black/5 border-r-4 border-black disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="w-16 text-center font-bebas text-3xl">{localQuantity}</span>
                        <button
                          type="button"
                          onClick={handleIncreaseQty}
                          disabled={requiresSizeSelection}
                          className="flex-1 h-full flex items-center justify-center hover:bg-black/5 border-l-4 border-black disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <Button
                      disabled={requiresSizeSelection}
                      onClick={handleAddCurrentItem}
                      className={cn(
                        "w-full lg:flex-1 h-14 rounded-none font-bebas text-2xl tracking-widest border-4 border-black transition-all",
                        qty > 0
                          ? "bg-[#008A45] text-white hover:bg-black"
                          : "bg-[#ED1C24] text-white hover:bg-black shadow-[6px_6px_0_0_rgba(255,210,0,1)] hover:shadow-none"
                      )}
                    >
                      {qty > 0 ? "IN BASKET" : "ADD TO CART"}
                    </Button>
                  </div>

                  <p className="mt-4 text-center lg:text-left font-bebas text-xs text-black/50 tracking-widest uppercase">
                    Delivery time approx {selectedItem.preparation_time || 20} min
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {selectedDeal && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr]">
            <div className="relative min-h-[340px] border-b-8 xl:border-b-0 xl:border-r-8 border-black bg-black">
              <Image
                src={selectedDeal.image_url || FALLBACK_IMAGE}
                alt={selectedDeal.name}
                fill
                className="object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="bg-[#ED1C24] text-white px-4 py-1 font-bebas text-lg border-2 border-white shadow-[4px_4px_0_0_rgba(0,0,0,1)] inline-block">
                  LIMITED DEAL
                </span>
                <h2 className="font-bebas text-4xl md:text-5xl text-white leading-none mt-3 uppercase">{selectedDeal.name}</h2>
              </div>
            </div>

            <div className="bg-[#FFF4CC] p-5 md:p-6 space-y-5">
              <p className="font-source-sans text-lg font-bold text-black/75 border-l-4 border-[#FFD200] pl-4">
                {selectedDeal.description || "Limited-time combo deal."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border-4 border-black p-4">
                  <p className="font-bebas text-xs tracking-widest text-black/50">ORIGINAL</p>
                  <p className="font-bebas text-3xl text-black line-through">RS. {selectedDeal.original_price}</p>
                </div>
                <div className="bg-white border-4 border-black p-4">
                  <p className="font-bebas text-xs tracking-widest text-black/50">DEAL PRICE</p>
                  <p className="font-bebas text-3xl text-[#008A45]">RS. {selectedDeal.discounted_price}</p>
                </div>
                <div className="bg-white border-4 border-black p-4">
                  <p className="font-bebas text-xs tracking-widest text-black/50">YOU SAVE</p>
                  <p className="font-bebas text-3xl text-[#ED1C24]">{selectedDeal.discount_percentage}%</p>
                </div>
              </div>

              {selectedDeal.items?.length > 0 && (
                <div className="bg-white border-4 border-black p-4 md:p-5">
                  <p className="font-bebas text-2xl text-black mb-2">DEAL INCLUDES</p>
                  <ul className="space-y-1">
                    {selectedDeal.items.map((item) => (
                      <li key={item.id} className="font-source-sans font-bold text-black/80 text-base">
                        {item.quantity}x {item.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-white border-4 border-black p-4 md:p-5 space-y-4">
                <div className="flex items-center border-4 border-black bg-white h-16">
                  <button
                    type="button"
                    onClick={handleDecreaseDealQty}
                    disabled={dealQty === 0}
                    className="flex-1 h-full flex items-center justify-center hover:bg-black/5 border-r-4 border-black disabled:opacity-40"
                    aria-label="Decrease deal quantity"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="w-16 text-center font-bebas text-3xl">{dealQty}</span>
                  <button
                    type="button"
                    onClick={handleIncreaseDealQty}
                    className="flex-1 h-full flex items-center justify-center hover:bg-black/5 border-l-4 border-black"
                    aria-label="Increase deal quantity"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <Button
                  onClick={handleIncreaseDealQty}
                  className="w-full h-16 rounded-none bg-[#ED1C24] text-white font-bebas text-3xl tracking-widest hover:bg-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all"
                >
                  {dealQty > 0 ? "ADD MORE DEAL" : "GRAB DEAL"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
