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
  Flame,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalPrice,
    totalItems,
    appliedOffer,
    removeOffer,
    onlineOrderingEnabled,
    onlineOrderingMessage,
  } = useCart();
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

  useEffect(() => {
    const controller = new AbortController();
    const fetchPaymentMethods = async () => {
      setLoadingPaymentMethods(true);
      try {
        const response = await fetch('/api/customer/payment-methods', { signal: controller.signal });
        const data = await response.json();
        if (data.success && data.methods) setOnlinePaymentMethods(data.methods);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
      } finally {
        if (!controller.signal.aborted) setLoadingPaymentMethods(false);
      }
    };
    fetchPaymentMethods();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (user && !hasAutoFilledRef.current) {
      hasAutoFilledRef.current = true;
      setCustomerInfo((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        address: user.address || prev.address,
      }));
    }
  }, [user]);

  const deliveryFee = orderType === "delivery" ? 100 : 0;
  const promoDiscount = appliedPromo?.discount_amount || 0;
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
      const authToken = localStorage.getItem("auth_token");
      const response = await fetch("/api/customer/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken && { "Authorization": `Bearer ${authToken}` }) },
        body: JSON.stringify({ code: promoCode.trim(), order_amount: totalPrice }),
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
        toast({ title: "🎉 PROMO APPLIED!", description: data.message });
      } else {
        toast({ title: "INVALID CODE", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "ERROR", description: "Failed to validate promo.", variant: "destructive" });
    } finally { setPromoLoading(false); }
  };

  const handlePlaceOrder = async () => {
    if (!onlineOrderingEnabled) {
      toast({ title: "UNAVAILABLE", description: onlineOrderingMessage, variant: "destructive" });
      return;
    }
    if (!customerInfo.name || !customerInfo.phone || (orderType === "delivery" && !customerInfo.address)) {
      toast({ title: "MISSING INFO", description: "Fill all details.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "online" && (!selectedOnlineMethod || !transactionId.trim())) {
      toast({ title: "PAYMENT REQUIRED", description: "Select method and ID.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const authToken = localStorage.getItem("auth_token");
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken && { "Authorization": `Bearer ${authToken}` }) },
        body: JSON.stringify({
          items: items.map(i => ({ [i.id.startsWith('deal-') ? 'deal_id' : 'menu_item_id']: i.id.replace('deal-', ''), quantity: i.quantity })),
          order_type: orderType === "delivery" ? "online" : "walk-in",
          payment_method: paymentMethod === "card" ? "card" : paymentMethod === "online" ? "online" : "cash",
          delivery_address: orderType === "delivery" ? customerInfo.address : undefined,
          notes: customerInfo.notes || undefined,
          promo_code: appliedPromo?.code,
          online_payment_method_id: selectedOnlineMethod?.id,
          transaction_id: paymentMethod === "online" ? transactionId.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        clearCart();
        toast({ title: "ORDER PLACED!", description: `Order #${data.order_number} confirmed!` });
        router.push(`/orders/track?id=${data.order?.id || data.order_id}`);
      } else throw new Error(data.error);
    } catch (e: any) {
      toast({ title: "ORDER FAILED", description: e.message, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFD200] pt-32 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border-8 border-black p-12 max-w-2xl w-full text-center shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="inline-block bg-[#ED1C24] p-6 border-4 border-black mb-8 rotate-3">
            <ShoppingCart className="w-16 h-16 text-white" />
          </div>
          <h1 className="font-bebas text-7xl text-black mb-4">EMPTY STOMACH?</h1>
          <p className="font-source-sans text-xl font-bold text-black/60 mb-10 uppercase tracking-widest">Your cart is as empty as a street at 4 AM. Let's fix that.</p>
          <Link href="/menu">
            <Button className="h-20 px-12 rounded-none bg-black text-white font-bebas text-3xl tracking-widest hover:bg-[#008A45] shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all">
              GO TO MENU
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32">
      {/* Mini Hero - Urban Style */}
      <section className="bg-[#FFD200] border-b-8 border-black py-12 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[#008A45]" style={{ clipPath: "polygon(80% 0, 100% 0, 100% 100%, 60% 100%)" }} />
        <div className="container-custom relative z-10 px-6 mx-auto max-w-7xl flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
             <span className="font-caveat text-4xl text-[#ED1C24]">Ready for the heat?</span>
             <h1 className="font-bebas text-7xl md:text-9xl text-black leading-none mt-2">YOUR <span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">SQUAD</span> ORDER</h1>
          </div>
          <div className="flex flex-col items-end">
            <div className="bg-black text-white px-6 py-2 border-4 border-white font-bebas text-3xl shadow-[6px_6px_0px_0px_rgba(237,28,36,1)]">
              TOTAL ITEMS: {totalItems}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-custom mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Items List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b-4 border-black pb-4">
                <h2 className="font-bebas text-4xl text-black">THE LINEUP</h2>
                <Button variant="ghost" onClick={clearCart} className="font-bebas text-xl text-[#ED1C24] hover:bg-[#ED1C24]/10">
                  <Trash2 className="w-5 h-5 mr-2" /> DUMP ALL
                </Button>
              </div>

              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.cartItemId || item.id}
                    layout
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="bg-white border-4 border-black p-4 flex gap-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative group"
                  >
                    <div className="w-24 h-24 md:w-32 md:h-32 border-4 border-black flex-shrink-0 relative">
                      <Image src={item.image || ""} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bebas text-3xl text-black leading-none mb-1">{item.name}</h3>
                          {item.selectedSize && <span className="bg-[#FFD200] border-2 border-black px-2 py-0.5 font-bebas text-sm">SIZE: {item.selectedSize}</span>}
                        </div>
                        <span className="font-bebas text-3xl text-[#008A45]">RS. {item.price * item.quantity}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border-4 border-black">
                          <button onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)} className="w-10 h-10 flex items-center justify-center border-r-4 border-black hover:bg-gray-100">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bebas text-2xl px-4 min-w-[40px] text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)} className="w-10 h-10 flex items-center justify-center border-l-4 border-black hover:bg-gray-100">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.cartItemId || item.id)} className="text-[#ED1C24] hover:bg-[#ED1C24]/10">
                          <Trash2 className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Delivery Info - Urban Form */}
              <div className="mt-12 bg-gray-50 border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,138,69,1)]">
                <h2 className="font-bebas text-4xl mb-8 flex items-center gap-3">
                   <MapPin className="w-8 h-8 text-[#ED1C24]" /> DROP POINT
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bebas text-xl">NAME</Label>
                    <Input value={customerInfo.name} onChange={e => setCustomerInfo(p => ({...p, name: e.target.value}))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bebas text-xl">PHONE</Label>
                    <Input value={customerInfo.phone} onChange={e => setCustomerInfo(p => ({...p, phone: e.target.value}))} className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="font-bebas text-xl">FULL ADDRESS</Label>
                    <Textarea value={customerInfo.address} onChange={e => setCustomerInfo(p => ({...p, address: e.target.value}))} className="min-h-[100px] border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0" />
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-black text-white border-[8px] border-black shadow-[16px_16px_0px_0px_rgba(255,210,0,1)]">
                <div className="bg-[#FFD200] p-6 border-b-4 border-black">
                  <h2 className="font-bebas text-4xl text-black">CHECKOUT</h2>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between font-bebas text-2xl">
                      <span>SUBTOTAL</span>
                      <span>RS. {totalPrice}</span>
                    </div>
                    <div className="flex justify-between font-bebas text-2xl text-[#008A45]">
                      <span>DISCOUNT</span>
                      <span>- RS. {discount}</span>
                    </div>
                    <div className="flex justify-between font-bebas text-2xl">
                      <span>TAX (5%)</span>
                      <span>RS. {tax.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bebas text-2xl">
                      <span>DELIVERY</span>
                      <span>RS. {deliveryFee}</span>
                    </div>
                  </div>

                  <div className="border-t-4 border-white/20 pt-6 flex justify-between">
                    <span className="font-bebas text-5xl">TOTAL</span>
                    <span className="font-bebas text-5xl text-[#FFD200]">RS. {grandTotal.toFixed(0)}</span>
                  </div>

                  {/* Promo Input */}
                  <div className="pt-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="PROMO CODE"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        className="bg-white border-4 border-[#FFD200] text-black font-bebas text-xl h-12 rounded-none focus-visible:ring-0"
                      />
                      <Button onClick={handleApplyPromo} disabled={promoLoading} className="bg-[#FFD200] text-black font-bebas text-xl h-12 rounded-none hover:bg-white border-2 border-black">
                        {promoLoading ? "..." : "APPLY"}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting || !onlineOrderingEnabled}
                    className="w-full h-20 bg-[#ED1C24] hover:bg-[#008A45] text-white font-bebas text-4xl tracking-widest rounded-none border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,210,0,1)] transition-all mt-8"
                  >
                    {isSubmitting ? "PROCESSING..." : "SEND IT!"}
                  </Button>

                  {!onlineOrderingEnabled && (
                    <div className="bg-[#ED1C24]/20 border-2 border-[#ED1C24] p-3 text-center text-xs font-bold uppercase text-[#ED1C24]">
                      {onlineOrderingMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
