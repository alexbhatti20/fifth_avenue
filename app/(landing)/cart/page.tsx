"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Banknote,
  MapPin,
  Clock,
  Tag,
  Sparkles,
  User,
  Phone,
  Edit2,
  Loader2,
  X,
  CheckCircle,
  ChevronDown,
  Smartphone,
  Building2,
  Copy,
  AlertCircle,
} from "lucide-react";

// Floating food items for the hero
const floatingFoods = [
  { src: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=400&fit=crop&q=80", className: "top-4 right-[5%] w-16 sm:w-20", delay: 0.2, rotate: 15 },
  { src: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop&q=80", className: "bottom-4 right-[15%] w-14 sm:w-18", delay: 0.4, rotate: -10 },
  { src: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop&q=80", className: "top-1/2 left-[3%] w-12 sm:w-16 -translate-y-1/2", delay: 0.6, rotate: 20 },
];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Payment method type from API
interface OnlinePaymentMethod {
  id: string;
  method_type: 'jazzcash' | 'easypaisa' | 'bank';
  method_name: string;
  account_number: string;
  account_holder_name: string;
  bank_name: string | null;
  display_order: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 25 }
  },
  exit: { opacity: 0, x: 20, transition: { duration: 0.3 } },
};

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, clearCart, totalPrice, totalItems, appliedOffer, removeOffer } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const hasAutoFilledRef = useRef(false);
  
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "online">("cash");
  const [showOnlineMethodsDropdown, setShowOnlineMethodsDropdown] = useState(false);
  const [selectedOnlineMethod, setSelectedOnlineMethod] = useState<OnlinePaymentMethod | null>(null);
  const [onlinePaymentMethods, setOnlinePaymentMethods] = useState<OnlinePaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    name: string;
    promo_type: string;
    value: number;
    discount_amount: number;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });

  // Fetch online payment methods on mount
  useEffect(() => {
    const controller = new AbortController();
    const fetchPaymentMethods = async () => {
      setLoadingPaymentMethods(true);
      try {
        const response = await fetch('/api/customer/payment-methods', { signal: controller.signal });
        const data = await response.json();
        if (data.success && data.methods) {
          setOnlinePaymentMethods(data.methods);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return; // ignore cleanup cancellation
      } finally {
        if (!controller.signal.aborted) setLoadingPaymentMethods(false);
      }
    };
    fetchPaymentMethods();
    return () => controller.abort();
  }, []);

  // Auto-fill customer info when user is logged in
  useEffect(() => {
    if (user && !hasAutoFilledRef.current) {
      hasAutoFilledRef.current = true;
      
      // Also check localStorage for most recent data
      const storedUser = localStorage.getItem('user_data');
      let userData = user;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          // Use localStorage data if it has address and user object doesn't
          if (parsed.address && !user.address) {
            userData = parsed;
          }
        } catch (e) {
          }
      }
      
      setCustomerInfo((prev) => ({
        ...prev,
        name: userData.name || prev.name,
        phone: userData.phone || prev.phone,
        address: userData.address || prev.address,
      }));
    }
  }, [user]);

  const deliveryFee = orderType === "delivery" ? 100 : 0;
  const promoDiscount = appliedPromo?.discount_amount || 0;

  // Storewide offer discount (applied when offer has no specific items)
  const offerDiscount = (() => {
    if (!appliedOffer) return 0;
    if (appliedOffer.discount_type === 'percentage') {
      const raw = totalPrice * (appliedOffer.discount_value / 100);
      return appliedOffer.max_discount_amount ? Math.min(raw, appliedOffer.max_discount_amount) : raw;
    }
    return Math.min(appliedOffer.discount_value, totalPrice);
  })();

  const discount = promoDiscount + offerDiscount;
  const tax = (totalPrice - discount) * 0.05;
  const grandTotal = totalPrice - discount + tax + deliveryFee;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    try {
      // Get auth token
      const authToken = localStorage.getItem("auth_token");
      
      // Call the preview_promo_code RPC via API
      const response = await fetch("/api/customer/promo/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { "Authorization": `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          order_amount: totalPrice,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setPromoApplied(true);
        setAppliedPromo({
          id: data.promo.id,
          code: data.promo.code,
          name: data.promo.name || data.promo.code,
          promo_type: data.promo.promo_type,
          value: data.promo.value,
          discount_amount: data.discount_amount,
          message: data.message,
        });
        toast({
          title: "🎉 Promo Applied!",
          description: data.message || `You saved Rs. ${data.discount_amount.toFixed(2)}!`,
        });
      } else {
        toast({
          title: "Invalid Code",
          description: data.error || "The promo code you entered is not valid.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate promo code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(false);
    setAppliedPromo(null);
    setPromoCode("");
  };

  // Copy account number to clipboard
  const handleCopyAccountNumber = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    toast({
      title: "Copied!",
      description: "Account number copied to clipboard",
    });
  };

  // Get icon for payment method type
  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'jazzcash':
        return <Smartphone className="w-5 h-5 text-red-500" />;
      case 'easypaisa':
        return <Smartphone className="w-5 h-5 text-green-500" />;
      case 'bank':
        return <Building2 className="w-5 h-5 text-blue-500" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const handlePlaceOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and phone number.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "delivery" && !customerInfo.address) {
      toast({
        title: "Missing Address",
        description: "Please provide your delivery address.",
        variant: "destructive",
      });
      return;
    }

    // Validate online payment requires transaction ID
    if (paymentMethod === "online") {
      if (!selectedOnlineMethod) {
        toast({
          title: "Select Payment Method",
          description: "Please select an online payment method.",
          variant: "destructive",
        });
        return;
      }
      if (!transactionId.trim()) {
        toast({
          title: "Transaction ID Required",
          description: "Please enter your transaction ID for verification.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem("auth_token");
      
      const headers: Record<string, string> = { 
        "Content-Type": "application/json" 
      };
      
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: items.map((item) => {
            // Check if item is a deal (ID starts with "deal-")
            if (item.id.startsWith('deal-')) {
              return {
                deal_id: item.id.replace('deal-', ''),
                quantity: item.quantity,
                special_instructions: "",
              };
            }
            // Regular menu item
            return {
              menu_item_id: item.id,
              quantity: item.quantity,
              special_instructions: "",
            };
          }),
          order_type: orderType === "delivery" ? "online" : "walk-in",
          payment_method: paymentMethod === "card" ? "card" : paymentMethod === "online" ? "online" : "cash",
          delivery_address: orderType === "delivery" ? customerInfo.address : undefined,
          notes: customerInfo.notes || undefined,
          // Include promo code if applied
          promo_code: appliedPromo?.code || undefined,
          // Include online payment details
          online_payment_method_id: selectedOnlineMethod?.id || undefined,
          online_payment_method_name: selectedOnlineMethod?.method_name || undefined,
          transaction_id: paymentMethod === "online" ? transactionId.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        clearCart();
        toast({
          title: "Order Placed!",
          description: `Your order #${data.order?.order_number || data.order_number} has been placed successfully.`,
        });
        // Redirect to track page with order ID
        router.push(`/orders/track?id=${data.order?.id || data.order_id}`);
      } else {
        throw new Error(data.error || "Failed to place order");
      }
    } catch (error) {
      toast({
        title: "Order Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-32">
          {/* Empty Cart Hero */}
          <section className="relative py-20 overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0">
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 6, repeat: Infinity }}
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.1, 0.15, 0.1]
                }}
                transition={{ duration: 8, repeat: Infinity }}
                className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl"
              />
            </div>

            <div className="container-custom relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-lg mx-auto"
              >
                {/* Animated cart icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="relative w-32 h-32 mx-auto mb-8"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-br from-primary/20 to-orange-500/20 rounded-full blur-xl"
                  />
                  <div className="relative w-full h-full bg-gradient-to-br from-secondary to-secondary/50 rounded-full flex items-center justify-center border border-border/50">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <ShoppingCart className="w-14 h-14 text-muted-foreground" />
                    </motion.div>
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl sm:text-5xl font-bebas mb-4 bg-gradient-to-r from-foreground via-primary to-orange-500 bg-clip-text text-transparent"
                >
                  Your Cart is Empty
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-muted-foreground mb-8 text-lg"
                >
                  Looks like you haven't added anything to your cart yet. 
                  Explore our delicious menu and start ordering!
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <Link href="/menu">
                    <Button className="bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white px-8 group">
                      Browse Menu 
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="border-primary/30 hover:border-primary">
                      Back to Home
                    </Button>
                  </Link>
                </motion.div>

                {/* Floating food decorations */}
                <div className="absolute inset-0 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 0.6, x: 0, y: [0, -15, 0] }}
                    transition={{ 
                      delay: 0.6,
                      y: { duration: 4, repeat: Infinity }
                    }}
                    className="absolute left-[10%] top-[20%] hidden lg:block"
                  >
                    <img src="https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=200&h=200&fit=crop&q=80" alt="" className="w-[60px] h-[60px] object-cover rounded-lg drop-shadow-xl" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 0.6, x: 0, y: [0, 15, 0] }}
                    transition={{ 
                      delay: 0.8,
                      y: { duration: 5, repeat: Infinity }
                    }}
                    className="absolute right-[10%] bottom-[20%] hidden lg:block"
                  >
                    <img src="https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&h=200&fit=crop&q=80" alt="" className="w-[70px] h-[70px] object-cover rounded-lg drop-shadow-xl" />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </section>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32">
        {/* Advanced Mini Hero */}
        <section className="relative py-12 overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1562967914-608f82629710?w=1920&h=600&fit=crop&q=80"
              alt="Cart Background"
              className="w-full h-full object-cover"
            />
            {/* Dark gradient on left for text readability, transparent on right to show food */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          </div>
          
          {/* Background animated shapes */}
          <div className="absolute inset-0 overflow-hidden z-[1]">
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute -bottom-20 -left-20 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl"
            />
          </div>

          {/* Floating food images */}
          {floatingFoods.map((food, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.5, rotate: food.rotate }}
              animate={{ 
                opacity: 0.9, 
                scale: 1, 
                y: [0, -10, 0],
                rotate: [food.rotate, food.rotate + 5, food.rotate]
              }}
              transition={{ 
                delay: food.delay,
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
              className={`absolute z-[2] ${food.className} pointer-events-none hidden sm:block`}
            >
              <Image
                src={food.src}
                alt="Floating food"
                width={80}
                height={80}
                className="object-contain drop-shadow-2xl"
              />
            </motion.div>
          ))}

          <div className="container-custom relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="text-center sm:text-left">
                {/* Sparkle badge */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary mb-3"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Almost there!</span>
                </motion.div>

                <h1 className="text-4xl sm:text-5xl font-bebas bg-gradient-to-r from-foreground via-primary to-orange-500 bg-clip-text text-transparent">
                  Your Cart
                </h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground flex items-center gap-2 justify-center sm:justify-start mt-1"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {totalItems} {totalItems === 1 ? 'item' : 'items'} ready for checkout
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="group border-destructive/30 hover:border-destructive hover:bg-destructive/5 text-destructive hover:text-destructive w-full sm:w-auto"
                  onClick={() => {
                    clearCart();
                    toast({
                      title: "Cart Cleared",
                      description: "All items have been removed from your cart",
                    });
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> 
                  Clear Cart
                </Button>
                <Link href="/menu" className="w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="group border-primary/30 hover:border-primary hover:bg-primary/5 w-full">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
                    Continue Shopping
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Mini stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center sm:justify-start gap-6 mt-6"
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">Rs. {totalPrice}</div>
                <div className="text-xs text-muted-foreground">Subtotal</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{items.length}</div>
                <div className="text-xs text-muted-foreground">Products</div>
              </div>
              <div className="w-px bg-border hidden sm:block" />
              <div className="text-center hidden sm:block">
                <div className="text-2xl font-bold text-green-500">Free</div>
                <div className="text-xs text-muted-foreground">Support</div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-8">
          <div className="container-custom">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <motion.div
                        key={item.cartItemId || item.id}
                        variants={itemVariants}
                        layout
                        exit="exit"
                        className="bg-card rounded-xl p-3 sm:p-4 shadow-sm"
                      >
                        {/* Mobile Layout */}
                        <div className="flex gap-3 sm:gap-4">
                          {/* Image */}
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={item.image || "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop&q=80"}
                              alt={item.name}
                              fill
                              sizes="(max-width: 640px) 80px, 96px"
                              className="object-cover"
                            />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-semibold text-base sm:text-lg line-clamp-2">{item.name}</h3>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 flex-shrink-0 -mt-1 -mr-1"
                                onClick={() => removeFromCart(item.cartItemId || item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-primary font-bold text-sm sm:text-base">Rs. {item.price}</p>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <p className="text-muted-foreground text-xs sm:text-sm line-through">Rs. {item.originalPrice}</p>
                              )}
                              {item.selectedSize && (
                                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.selectedSize}</span>
                              )}
                            </div>
                            
                            {/* Bottom row: Quantity Controls & Subtotal */}
                            <div className="flex items-center justify-between mt-auto pt-2">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
                                  onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)}
                                >
                                  <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <span className="font-semibold w-6 sm:w-8 text-center text-sm sm:text-base">{item.quantity}</span>
                                <Button
                                  size="icon"
                                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary hover:bg-primary/90"
                                  onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                              <p className="font-bold text-base sm:text-lg">Rs. {item.price * item.quantity}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Customer Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card rounded-xl p-4 sm:p-6 shadow-sm mt-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bebas">Delivery Information</h2>
                    {user && customerInfo.name && !isEditingInfo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingInfo(true)}
                        className="text-primary"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  
                  {/* Order Type */}
                  <div className="mb-4">
                    <Label className="mb-2 block">Order Type</Label>
                    <RadioGroup
                      value={orderType}
                      onValueChange={(v) => setOrderType(v as "delivery" | "pickup")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer">
                          <MapPin className="w-4 h-4" /> Delivery
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer">
                          <Clock className="w-4 h-4" /> Pickup
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Show prefilled info summary for logged-in users */}
                  {user && customerInfo.name && !isEditingInfo ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3 p-4 bg-secondary/50 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{customerInfo.name}</p>
                          <p className="text-sm text-muted-foreground">Logged in customer</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{customerInfo.phone || "No phone added"}</span>
                      </div>
                      {orderType === "delivery" && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <span>{customerInfo.address || "No address added - click Edit to add"}</span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-sm sm:text-base">Your Name *</Label>
                          <Input
                            id="name"
                            placeholder="Enter your name"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            className="h-12 sm:h-10 text-base sm:text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm sm:text-base">Phone Number *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+92 300 1234567"
                            value={customerInfo.phone}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            className="h-12 sm:h-10 text-base sm:text-sm"
                            required
                          />
                        </div>
                      </div>

                      {orderType === "delivery" && (
                        <div className="space-y-2 mt-4">
                          <Label htmlFor="address">Delivery Address *</Label>
                          <Textarea
                            id="address"
                            placeholder="Enter your complete address"
                            value={customerInfo.address}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                            rows={2}
                          />
                        </div>
                      )}

                      {isEditingInfo && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingInfo(false)}
                          >
                            Done Editing
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2 mt-4">
                    <Label htmlFor="notes">Special Instructions (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any special requests? (e.g., extra spicy, no onions)"
                      value={customerInfo.notes}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </motion.div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card rounded-xl p-4 sm:p-6 shadow-sm lg:sticky lg:top-24"
                >
                  <h2 className="text-xl font-bebas mb-4">Order Summary</h2>

                  {/* Applied Offer Discount */}
                  {appliedOffer && offerDiscount > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-orange-600" />
                          <span className="font-medium text-orange-700 dark:text-orange-300 text-sm">{appliedOffer.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOffer()}
                          className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        🔥 You save Rs. {offerDiscount.toFixed(2)}
                        {appliedOffer.discount_type === 'percentage' && ` (${appliedOffer.discount_value}% off)`}
                      </p>
                    </div>
                  )}

                  {/* Promo Code */}
                  {promoApplied && appliedPromo ? (
                    <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-400">{appliedPromo.code}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        {appliedPromo.message || `You save Rs. ${appliedPromo.discount_amount.toFixed(2)}`}
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Enter promo code"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          className="pl-10"
                          disabled={promoLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && promoCode.trim()) {
                              handleApplyPromo();
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleApplyPromo}
                        disabled={promoLoading || !promoCode.trim()}
                      >
                        {promoLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>Rs. {totalPrice.toFixed(2)}</span>
                    </div>
                    {appliedPromo && promoDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {appliedPromo.promo_type === 'percentage' 
                            ? `Promo (${appliedPromo.value}%)`
                            : `Promo (${appliedPromo.code})`
                          }
                        </span>
                        <span>- Rs. {promoDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {appliedOffer && offerDiscount > 0 && (
                      <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {`Offer (${appliedOffer.discount_type === 'percentage' ? `${appliedOffer.discount_value}%` : `Rs.${appliedOffer.discount_value}`} off)`}
                        </span>
                        <span>- Rs. {offerDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (5%)</span>
                      <span>Rs. {tax.toFixed(2)}</span>
                    </div>
                    {orderType === "delivery" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span>Rs. {deliveryFee}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-3">
                      <span>Total</span>
                      <span className="text-primary">Rs. {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="mt-6">
                    <Label className="mb-3 block text-sm sm:text-base">Payment Method</Label>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(v) => {
                        setPaymentMethod(v as "cash" | "card" | "online");
                        if (v !== "online") {
                          setSelectedOnlineMethod(null);
                          setTransactionId("");
                          setShowOnlineMethodsDropdown(false);
                        }
                      }}
                      className="space-y-2"
                    >
                      {/* Cash on Delivery */}
                      <div className="flex items-center space-x-3 p-3 sm:p-3 min-h-[52px] rounded-lg border hover:bg-secondary transition-colors cursor-pointer">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1 text-sm sm:text-base">
                          <Banknote className="w-5 h-5 text-green-600" />
                          Cash on Delivery
                        </Label>
                      </div>

                      {/* Card Payment - Coming Soon */}
                      <div 
                        className="flex items-center space-x-3 p-3 sm:p-3 min-h-[52px] rounded-lg border bg-secondary/50 cursor-not-allowed opacity-70"
                        onClick={() => {
                          toast({
                            title: "Coming Soon!",
                            description: "Card payment will be available soon.",
                          });
                        }}
                      >
                        <RadioGroupItem value="card" id="card" disabled />
                        <Label htmlFor="card" className="flex items-center gap-2 cursor-not-allowed flex-1 text-sm sm:text-base">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                          <span>Card Payment</span>
                          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Coming Soon
                          </span>
                        </Label>
                      </div>

                      {/* Online Payment Methods */}
                      <Collapsible 
                        open={paymentMethod === "online" || showOnlineMethodsDropdown}
                        onOpenChange={(open) => {
                          if (open && paymentMethod !== "online") {
                            setPaymentMethod("online");
                          }
                          setShowOnlineMethodsDropdown(open);
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <div className={`flex items-center space-x-3 p-3 sm:p-3 min-h-[52px] rounded-lg border hover:bg-secondary transition-colors cursor-pointer ${paymentMethod === "online" ? "border-primary bg-primary/5" : ""}`}>
                            <RadioGroupItem value="online" id="online" />
                            <Label htmlFor="online" className="flex items-center gap-2 cursor-pointer flex-1 text-sm sm:text-base">
                              <Smartphone className="w-5 h-5 text-purple-600" />
                              Other Methods
                              <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${paymentMethod === "online" ? "rotate-180" : ""}`} />
                            </Label>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 ml-6 space-y-3"
                          >
                            {loadingPaymentMethods ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : onlinePaymentMethods.length === 0 ? (
                              <div className="text-sm text-muted-foreground py-3 text-center">
                                No online payment methods available
                              </div>
                            ) : (
                              <>
                                {/* Payment Method Selection */}
                                <div className="space-y-2">
                                  {onlinePaymentMethods.map((method) => (
                                    <div
                                      key={method.id}
                                      onClick={() => setSelectedOnlineMethod(method)}
                                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                        selectedOnlineMethod?.id === method.id
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "hover:bg-secondary/50"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        {getMethodIcon(method.method_type)}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-sm">{method.method_name}</p>
                                          <p className="text-xs text-muted-foreground capitalize">
                                            {method.method_type === 'bank' && method.bank_name 
                                              ? method.bank_name 
                                              : method.method_type}
                                          </p>
                                        </div>
                                        {selectedOnlineMethod?.id === method.id && (
                                          <CheckCircle className="w-5 h-5 text-primary" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Selected Method Details */}
                                {selectedOnlineMethod && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="p-4 rounded-lg bg-secondary/50 border space-y-3"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Account Holder</span>
                                      <span className="font-medium text-sm">{selectedOnlineMethod.account_holder_name}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Account Number</span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-medium text-sm">{selectedOnlineMethod.account_number}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => handleCopyAccountNumber(selectedOnlineMethod.account_number)}
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    {selectedOnlineMethod.bank_name && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Bank</span>
                                        <span className="font-medium text-sm">{selectedOnlineMethod.bank_name}</span>
                                      </div>
                                    )}
                                    
                                    {/* Transaction ID Input */}
                                    <div className="pt-3 border-t space-y-2">
                                      <Label htmlFor="transactionId" className="text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-orange-500" />
                                        Transaction ID (Required)
                                      </Label>
                                      <Input
                                        id="transactionId"
                                        placeholder="Enter your transaction/reference ID"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        className="font-mono"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Enter the transaction ID from your payment for verification
                                      </p>
                                    </div>
                                  </motion.div>
                                )}
                              </>
                            )}
                          </motion.div>
                        </CollapsibleContent>
                      </Collapsible>
                    </RadioGroup>
                  </div>

                  {/* Place Order Button */}
                  <Button
                    className="w-full mt-6 h-12 bg-primary hover:bg-primary/90 font-semibold"
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting || (paymentMethod === "online" && (!selectedOnlineMethod || !transactionId.trim()))}
                  >
                    {isSubmitting ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full inline-block"
                      />
                    ) : (
                      <>
                        Place Order <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    By placing this order, you agree to our terms and conditions.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </div>
  );
}
