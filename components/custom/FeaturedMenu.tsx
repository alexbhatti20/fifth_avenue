"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem, useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 60,
    scale: 0.9,
    rotateX: -15,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      type: "spring" as const,
      stiffness: 80,
      damping: 15,
    },
  },
};

// Placeholder data for featured items when database is unavailable
const placeholderItems: MenuItem[] = [
  {
    id: "1",
    name: "Classic Broasted Chicken",
    description: "Our signature crispy broasted chicken, marinated in special spices and cooked to perfection.",
    price: 450,
    originalPrice: 550,
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "2", 
    name: "Zinger Burger",
    description: "Crispy chicken fillet with fresh lettuce, mayo and our special sauce.",
    price: 350,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "3",
    name: "Chicken Wings",
    description: "Crispy golden wings with our signature spices and dipping sauce.",
    price: 380,
    originalPrice: 450,
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
  {
    id: "4",
    name: "Loaded Fries",
    description: "Crispy fries topped with cheese, jalapenos and special sauce.",
    price: 280,
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=600&fit=crop&q=80",
    isPopular: true,
  },
];

interface FeaturedMenuProps {
  menuItems?: MenuItem[];
}

export default function FeaturedMenu({ menuItems }: FeaturedMenuProps) {
  // Use provided menuItems or fallback to placeholder data
  const items = menuItems && menuItems.length > 0 ? menuItems : placeholderItems;
  const featuredItems = items.filter((item) => item.isPopular || item.is_featured).slice(0, 4);
  const { addToCart } = useCart();
  const { toast } = useToast();
  const ref = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax transforms for different layers
  const bgY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const cardsY = useTransform(scrollYProgress, [0, 1], [50, -50]);

  const handleAddToCart = (item: typeof featuredItems[0]) => {
    addToCart(item);
    toast({
      title: "Added to cart!",
      description: `${item.name} has been added to your cart.`,
    });
  };

  return (
    <section className="section-padding bg-secondary overflow-hidden relative" ref={containerRef}>
      {/* Parallax Background Elements */}
      <motion.div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ y: bgY }}
      >
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
      </motion.div>

      <div className="container-custom relative z-10" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-8 sm:mb-12 px-2"
        >
          <motion.span
            className="text-primary font-semibold uppercase tracking-wider text-xs sm:text-sm inline-block"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
          >
            Our Specialties
          </motion.span>
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl font-bebas mt-2 mb-3 sm:mb-4"
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Featured Menu
          </motion.h2>
          <motion.p
            className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
          >
            Explore our most loved dishes, crafted with premium ingredients and
            our signature spices that keep customers coming back for more.
          </motion.p>
        </motion.div>

        {/* Menu Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12 perspective-1000"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {featuredItems.map((item, index) => (
            <motion.div
              key={item.id}
              variants={cardVariants}
              className="group card-elevated overflow-hidden"
              whileHover={{ 
                y: -10, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {/* Image */}
              <div className="relative h-40 sm:h-48 bg-muted overflow-hidden">
                <motion.img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                />
                {item.isPopular && (
                  <motion.span
                    className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    🔥 Popular
                  </motion.span>
                )}
                {item.originalPrice && (
                  <motion.span
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-accent text-accent-foreground text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                  </motion.span>
                )}
              </div>

              {/* Content */}
              <div className="p-3 sm:p-5">
                <h3 className="text-lg sm:text-xl font-bebas mb-1 sm:mb-2 group-hover:text-primary transition-colors line-clamp-1">
                  {item.name}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-lg sm:text-xl font-bold text-primary">
                      Rs. {item.price}
                    </span>
                    {item.originalPrice && (
                      <span className="text-[10px] sm:text-sm text-muted-foreground line-through">
                        Rs. {item.originalPrice}
                      </span>
                    )}
                  </div>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="icon"
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                      onClick={() => handleAddToCart(item)}
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center px-4"
        >
          <Link href="/menu">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Button className="btn-zoiro group w-full sm:w-auto">
                View Full Menu
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
