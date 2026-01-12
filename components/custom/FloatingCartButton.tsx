"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FloatingCartButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems, totalPrice } = useCart();
  const { user, isLoading } = useAuth();
  const [showButton, setShowButton] = useState(false);
  const [animate, setAnimate] = useState(false);

  // Hide button on cart page and portal/admin pages
  const isCartPage = pathname === "/cart";
  const isPortalPage = pathname?.startsWith("/portal");
  const isAuthPage = pathname?.startsWith("/auth") || pathname?.startsWith("/forgot-password");

  // Show button only when user is logged in, there are items in cart, and on customer-facing pages
  useEffect(() => {
    const shouldShow = !!user && totalItems > 0 && !isCartPage && !isPortalPage && !isAuthPage;
    setShowButton(shouldShow);
    
    // Trigger animation when items are added
    if (shouldShow) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
  }, [totalItems, isCartPage, isPortalPage, isAuthPage, user]);

  const formatPrice = (price: number) => {
    return `Rs. ${price.toLocaleString()}`;
  };

  return (
    <AnimatePresence>
      {showButton && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            onClick={() => router.push("/cart")}
            className={`
              relative group
              h-14 px-6 rounded-full shadow-2xl
              bg-gradient-to-r from-orange-600 via-red-500 to-yellow-600
              hover:from-orange-700 hover:via-red-600 hover:to-yellow-700
              bg-[length:200%_auto]
              transition-all duration-300
              ${animate ? 'animate-bounce' : ''}
            `}
            style={{
              animation: animate ? 'gradient-shift 3s ease infinite, bounce 0.6s ease' : 'gradient-shift 3s ease infinite',
            }}
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-600 via-red-500 to-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-gradient bg-[length:200%_auto]" />
            
            {/* Content */}
            <div className="relative flex items-center gap-3">
              {/* Cart Icon with Badge */}
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-white" />
                <Badge 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-white text-orange-600 font-bold text-xs rounded-full border-2 border-orange-600"
                >
                  {totalItems}
                </Badge>
              </div>

              {/* Separator */}
              <div className="h-8 w-px bg-white/30" />

              {/* Price */}
              <div className="flex flex-col items-start">
                <span className="text-xs text-white/90 font-medium leading-none">Total</span>
                <span className="text-base font-bold text-white leading-tight">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {/* Pulse effect on item add */}
            {animate && (
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                className="absolute inset-0 rounded-full border-4 border-white"
              />
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
