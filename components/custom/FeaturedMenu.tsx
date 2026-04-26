"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Plus, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem, useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";

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
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (item: MenuItem) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {featuredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              {/* Card Container */}
              <div className="bg-white border-[6px] border-black p-0 overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[6px] group-hover:translate-y-[6px] transition-all duration-500">
                {/* Image */}
                <div className="relative aspect-[4/5] w-full overflow-hidden border-b-[6px] border-black bg-gray-100">
                  <Image
                    src={item.image || ""}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {item.isPopular && (
                    <div className="absolute top-6 left-6 bg-[#FFD200] border-2 border-black px-4 py-1.5 font-bebas text-lg text-black flex items-center gap-2 rotate-[-2deg]">
                      <Flame className="w-5 h-5 fill-black" /> POPULAR
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-8 flex flex-col h-[220px]">
                  <h3 className="font-bebas text-4xl text-black mb-3 line-clamp-1 group-hover:text-[#ED1C24] transition-colors">
                    {item.name}
                  </h3>
                  <p className="font-source-sans text-lg text-black/50 line-clamp-2 leading-snug mb-6">
                    {item.description}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-bebas text-sm text-black/30 tracking-widest">PRICE</span>
                      <span className="font-bebas text-4xl text-[#008A45]">
                        RS. {item.price}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleAddToCart(item)}
                      className="rounded-none bg-black hover:bg-[#ED1C24] text-white h-14 w-14 p-0 transition-all shadow-[4px_4px_0_0_rgba(255,210,0,1)] hover:shadow-none"
                    >
                      <Plus className="w-8 h-8" strokeWidth={3} />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
