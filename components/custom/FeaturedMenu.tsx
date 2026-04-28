"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Plus, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem, useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MenuDetailModal from "./MenuDetailModal";
import { useState } from "react";

const placeholderItems: MenuItem[] = [
  {
    id: "p1",
    name: "Fifth Avenue Special Pizza",
    description: "Loaded with premium pepperoni, mozzarella, and our secret urban sauce.",
    price: 1200,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "p2", 
    name: "Urban Beef Burger",
    description: "Double beef patty, cheddar, pickles, and Fifth Avenue house sauce.",
    price: 750,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "p3",
    name: "Chasing Flavours Wings",
    description: "Spicy, honey-glazed wings that will keep you chasing the next bite.",
    price: 600,
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "p4",
    name: "Loaded Street Fries",
    description: "Crispy fries topped with jalapenos, cheese sauce, and pulled chicken.",
    price: 450,
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
];

export default function FeaturedMenu({ menuItems }: { menuItems?: MenuItem[] }) {
  const items = menuItems && menuItems.length > 0 ? menuItems : placeholderItems;
  const featuredItems = items.filter((item) => item.isPopular || item.is_featured).slice(0, 4);
  const { addToCart, items: cartItems, updateQuantity } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleOpenDetail = (item: MenuItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const checkAuth = () => {
    if (!user) {
      toast({
        title: "STREET ACCESS ONLY",
        description: "JOIN THE SQUAD TO ADD FLAVOURS TO YOUR BASKET.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleAddDealToCart = (deal: any) => {
    if (!checkAuth()) return;
    
    // Basic implementation for deal addition if needed
    const added = addToCart({
      id: `deal-${deal.id}`,
      name: deal.name,
      price: deal.discounted_price || deal.price,
      image: deal.image_url || deal.image || "",
    } as any);
    if (added) {
      toast({ title: "DEAL SECURED", description: `${deal.name} added to cart.` });
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!checkAuth()) return;
    
    const added = addToCart(item);
    if (added) {
      toast({
        title: "ADDED TO BASKET",
        description: `${item.name} is ready for you!`,
      });
    }
  };

  return (
    <section id="featured-menu" className="py-32 bg-white relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#008A45]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FFD200]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="container-custom">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-20 gap-8">
          <div className="flex flex-col">
            <span className="font-caveat text-4xl text-[#ED1C24] mb-4">Chasing the best...</span>
            <h2 className="font-bebas text-7xl md:text-9xl text-black leading-[0.8]">
              URBAN <br/>
              <span className="text-[#008A45]">FLAVOURS</span>
            </h2>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-6">
            <p className="max-w-md text-right font-source-sans text-xl font-bold text-black/40 hidden lg:block">
              CURATED SELECTION OF OUR MOST WANTED BITES. <br/>
              HAND-CRAFTED FOR THE SQUAD.
            </p>
            <Link href="/menu">
              <Button className="rounded-none bg-black text-white h-16 px-10 font-bebas text-2xl tracking-widest hover:bg-[#ED1C24] transition-all border-2 border-black shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none translate-x-[-2px] translate-y-[-2px]">
                EXPLORE FULL MENU
              </Button>
            </Link>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {featuredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative h-full cursor-pointer"
              onClick={() => handleOpenDetail(item)}
            >
              {/* Card Container */}
              <div className="flex flex-col h-full bg-white border-[6px] border-black p-0 overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[6px] group-hover:translate-y-[6px] transition-all duration-500 relative z-0">
                
                {/* Image Section */}
                <div className="relative aspect-[4/5] w-full overflow-hidden border-b-[6px] border-black bg-gray-100 flex-shrink-0">
                  <Image
                    src={item.image_url || item.image || "/assets/placeholder-food.png"}
                    alt={item.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px"
                    priority={index < 2}
                  />
                  {/* Scanline Effect on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FFD200]/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                  
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    {item.isPopular && (
                      <div className="bg-[#FFD200] border-2 border-black px-3 py-1 font-bebas text-sm text-black flex items-center gap-2 rotate-[-2deg] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <Flame className="w-4 h-4 fill-black" /> POPULAR
                      </div>
                    )}
                    {item.isNew && (
                      <div className="bg-[#ED1C24] border-2 border-black px-3 py-1 font-bebas text-sm text-white flex items-center gap-2 rotate-[2deg] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <Star className="w-4 h-4 fill-white" /> NEW
                      </div>
                    )}
                  </div>

                  {/* Quick Info Overlay (Bottom) */}
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {item.serves_count && (
                      <div className="bg-black/80 backdrop-blur-md text-white px-2 py-1 font-bebas text-xs border border-white/20">
                        SERVES {item.serves_count}
                      </div>
                    )}
                    {item.piece_count && (
                      <div className="bg-black/80 backdrop-blur-md text-white px-2 py-1 font-bebas text-xs border border-white/20">
                        {item.piece_count} PCS
                      </div>
                    )}
                    {item.preparation_time && (
                      <div className="bg-black/80 backdrop-blur-md text-white px-2 py-1 font-bebas text-xs border border-white/20">
                        {item.preparation_time} MINS
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-6 md:p-8 flex flex-col flex-grow bg-white">
                  <div className="flex-grow">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-bebas text-3xl md:text-4xl text-black leading-tight group-hover:text-[#ED1C24] transition-colors">
                        {item.name}
                      </h3>
                    </div>
                    
                    <p className="font-source-sans text-base md:text-lg text-black/60 leading-snug mb-6">
                      {item.description}
                    </p>

                    {item.includes && (
                      <p className="font-source-sans text-xs font-bold text-[#008A45] uppercase tracking-wider mb-2">
                        INCLUDES: {item.includes}
                      </p>
                    )}

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {item.tags.map((tag) => (
                          <span 
                            key={tag} 
                            className="text-[10px] font-black bg-black/5 text-black/40 px-2 py-0.5 rounded-full uppercase tracking-tighter"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Footer Actions */}
                  <div className="mt-auto pt-6 border-t-2 border-black/5 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-bebas text-xs text-black/30 tracking-widest">PRICE</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bebas text-3xl md:text-4xl text-[#008A45]">
                          RS. {item.price}
                        </span>
                        {item.originalPrice && (
                          <span className="font-bebas text-lg text-black/20 line-through">
                            RS. {item.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(item);
                      }}
                      className="rounded-none bg-black hover:bg-[#ED1C24] text-white h-12 w-12 md:h-14 md:w-14 p-0 transition-all shadow-[4px_4px_0_0_rgba(255,210,0,1)] hover:shadow-none active:scale-95 z-20"
                      aria-label={`Add ${item.name} to basket`}
                    >
                      <Plus className="w-6 h-6 md:w-8 md:h-8" strokeWidth={3} />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>

      <MenuDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        selectedItem={selectedItem}
        selectedDeal={null}
        cartItems={cartItems}
        addToCart={addToCart}
        updateQuantity={updateQuantity}
        handleAddDealToCart={handleAddDealToCart}
        toast={toast}
      />
    </section>
  );
}
