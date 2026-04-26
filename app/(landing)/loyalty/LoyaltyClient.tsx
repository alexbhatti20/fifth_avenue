"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
// Auth is enforced server-side in page.tsx — no client-side redirect needed
import {
  Award,
  Gift,
  Star,
  Ticket,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isMobile } from "@/lib/utils";
import type { LoyaltyDataServer, PromoCodeServer, PointsHistoryServer } from "@/lib/server-queries";

interface CheckedPromo {
  found: boolean;
  valid: boolean;
  error: string | null;
  source: "customer_reward" | "general" | null;
  promo: {
    id: string;
    code: string;
    name: string;
    description: string;
    promo_type: string;
    value: number;
    max_discount: number | null;
    is_used?: boolean;
    used_at?: string | null;
    expires_at?: string;
    valid_until?: string;
    usage_limit?: number;
    current_usage?: number;
    is_active: boolean;
  } | null;
}

const tierConfig = {
  bronze: { color: "from-red-700 via-rose-600 to-red-900", points: 0, icon: "🥉" },
  silver: { color: "from-red-500 via-rose-400 to-red-700", points: 500, icon: "🥈" },
  gold: { color: "from-red-600 via-orange-500 to-red-800", points: 1500, icon: "🥇" },
  platinum: { color: "from-red-800 via-rose-700 to-red-950", points: 3000, icon: "💎" },
};

interface LoyaltyClientProps {
  initialLoyalty: LoyaltyDataServer | null;
  initialPromoCodes: PromoCodeServer[];
  initialPointsHistory: PointsHistoryServer[];
}

export default function LoyaltyClient({ 
  initialLoyalty, 
  initialPromoCodes, 
  initialPointsHistory 
}: LoyaltyClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  // user is kept for optional fallback fetch (SSR always provides data now)
  const { user } = useAuth();
  const hasFetchedRef = useRef(true); // SSR always provides data, skip client fetch

  const [loyaltyData, setLoyaltyData] = useState<LoyaltyDataServer | null>(initialLoyalty);
  const [promoCodes, setPromoCodes] = useState<PromoCodeServer[]>(initialPromoCodes);
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryServer[]>(initialPointsHistory);
  const [isLoading, setIsLoading] = useState(false); // SSR always provides initial data
  const [promoInput, setPromoInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPromo, setCheckedPromo] = useState<CheckedPromo | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(isMobile());
  }, []);

  // Only fetch if no SSR data provided - uses API route
  useEffect(() => {
    // Skip if server already provided data or already fetched
    if (initialLoyalty || hasFetchedRef.current || !user) return;
    
    hasFetchedRef.current = true;
    
    const fetchLoyaltyData = async () => {
      try {
        const res = await fetch('/api/customer/loyalty');
        const { loyalty, promoCodes: promos, pointsHistory: history, error } = await res.json();
        
        if (error) throw new Error(error);
        
        if (loyalty) {
          setLoyaltyData(loyalty);
        }
        setPromoCodes(promos || []);
        if (history && history.length > 0) {
          setPointsHistory(history);
        }
        hasFetchedRef.current = true;
      } catch (error) {
        // Silently handle error - SSR data already provides initial state
        console.error('Error fetching loyalty data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLoyaltyData();
  }, [user, initialLoyalty]);

  const handleCheckPromo = async () => {
    if (!promoInput.trim()) return;

    setIsChecking(true);
    setCheckedPromo(null);
    
    try {
      const res = await fetch('/api/customer/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput }),
      });
      const { data, error } = await res.json();

      if (error) throw new Error(error);

      setCheckedPromo(data);

      if (data.valid) {
        toast({
          title: "Valid Promo Code!",
          description: `${data.promo?.name || data.promo?.code} - ${data.promo?.promo_type === 'percentage' ? data.promo?.value + '% off' : 'Rs. ' + data.promo?.value + ' off'}`,
        });
      } else if (data.found) {
        toast({
          title: "Promo Code Issue",
          description: data.error || "This promo code cannot be used",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Not Found",
          description: "This promo code does not exist",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `Promo code ${code} copied to clipboard`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  const tier = loyaltyData?.tier || "bronze";
  const tierInfo = tierConfig[tier];

  return (
    <div className="min-h-screen pt-32 pb-16 bg-[#F8F8F8] selection:bg-[#FFD200]">
      <div className="container-custom max-w-4xl px-4">
        {/* Back Button - Brutalist Style */}
        <Button 
          variant="outline" 
          onClick={() => router.back()} 
          className="mb-8 border-2 border-black rounded-none font-bebas text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          BACK TO STREETS
        </Button>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-12 border-l-8 border-black pl-6"
        >
          <h1 className="font-bebas text-6xl md:text-8xl text-black leading-[0.8] tracking-tighter uppercase">
            LOYALTY <br />
            <span className="text-[#ED1C24] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">SQUAD</span>
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <span className="font-caveat text-2xl text-black/60 italic">Level up your street cred.</span>
            <Sparkles className="w-5 h-5 text-[#FFD200] fill-[#FFD200]" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Loyalty Card & Progress */}
          <div className="lg:col-span-7 space-y-8">
            {/* Loyalty Card - Urban Engine Style */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative overflow-hidden border-[6px] border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${tier === "bronze" ? "bg-white" : "bg-[#FFD200]"}`}
            >
              {/* Branding Overlays */}
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <span className="font-bebas text-6xl rotate-90 inline-block origin-top-right">FIFTH AVE</span>
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-12">
                  <div>
                    <span className="font-bebas text-sm tracking-[0.2em] text-black/40 block mb-2">MEMBERSHIP CARD</span>
                    <div className="flex items-center gap-3">
                      <div className="bg-black text-white p-2 border-2 border-black shadow-[4px_4px_0_0_rgba(237,28,36,1)]">
                         <Trophy className="w-8 h-8 fill-[#FFD200]" />
                      </div>
                      <h2 className="font-bebas text-5xl text-black leading-none uppercase">{tier} LEVEL</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bebas text-6xl text-black opacity-20">{tierInfo.icon}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <span className="font-bebas text-sm tracking-widest text-black/60 block mb-1">TOTAL STREET POINTS</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bebas text-7xl text-black leading-none">{loyaltyData?.total_points || 0}</span>
                      <span className="font-bebas text-2xl text-[#ED1C24]">PTS</span>
                    </div>
                  </div>

                  {tier !== "platinum" && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                         <span className="font-bebas text-sm text-black/60">PROGRESS TO {tier === "bronze" ? "SILVER" : tier === "silver" ? "GOLD" : "PLATINUM"}</span>
                         <span className="font-bebas text-xl text-black">{loyaltyData?.points_to_next_tier || 0} PTS TO GO</span>
                      </div>
                      <div className="h-6 bg-black/10 border-2 border-black overflow-hidden">
                        <motion.div
                          className="h-full bg-black"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${((loyaltyData?.total_points || 0) / (tierConfig[tier === "bronze" ? "silver" : tier === "silver" ? "gold" : "platinum"].points)) * 100}%`,
                          }}
                          transition={{ duration: 1.5, ease: "circOut" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t-2 border-black/10 flex justify-between items-end">
                   <div className="font-bebas text-xl text-black tracking-widest">
                     EST. 2024 <br/>
                     <span className="text-[#ED1C24]">CITY STREETS</span>
                   </div>
                   <div className="bg-black text-white px-4 py-1 font-bebas text-lg tracking-widest">
                     FIFTH AVENUE
                   </div>
                </div>
              </div>
            </motion.div>

            {/* How to Earn - Blocky List */}
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(255,210,0,1)]">
              <h3 className="font-bebas text-3xl text-black mb-6 flex items-center gap-3">
                <Star className="w-6 h-6 fill-[#ED1C24] text-[#ED1C24]" />
                GRAB MORE POINTS
              </h3>
              <div className="grid gap-4">
                {[
                  { title: "ORDER THE CLASSICS", desc: "1 PTS PER RS. 10 SPENT", icon: "🍗" },
                  { title: "STREET REVIEWS", desc: "+50 PTS PER REVIEW", icon: "⭐" },
                  { title: "INVITE THE SQUAD", desc: "+100 PTS PER REFERRAL", icon: "👥" },
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    className="flex items-center gap-4 p-4 bg-black/[0.03] border-2 border-black hover:bg-[#FFD200]/10 transition-colors"
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <p className="font-bebas text-xl text-black leading-tight">{item.title}</p>
                      <p className="font-source-sans text-sm font-bold text-black/50">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Promo Codes & History */}
          <div className="lg:col-span-5 space-y-8">
            {/* Check Promo Code - Urban Tool Style */}
            <div className="bg-black text-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas text-2xl text-[#FFD200] mb-4 flex items-center gap-2">
                <Ticket className="w-6 h-6" />
                VERIFY CODE
              </h3>
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setCheckedPromo(null); }}
                  placeholder="ENTER CODE..."
                  className="bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-bebas text-lg rounded-none h-12 focus-visible:ring-[#FFD200]"
                />
                <Button 
                  onClick={handleCheckPromo} 
                  disabled={isChecking || !promoInput.trim()} 
                  className="bg-[#FFD200] text-black hover:bg-white rounded-none font-bebas text-lg h-12 px-6"
                >
                  {isChecking ? <RefreshCw className="h-5 w-5 animate-spin" /> : "SCAN"}
                </Button>
              </div>

              {checkedPromo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-4 border-2 border-dashed relative z-10 ${checkedPromo.valid ? "border-green-400 bg-green-400/10" : "border-red-400 bg-red-400/10"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {checkedPromo.valid ? <CheckCircle className="h-5 w-5 text-green-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
                    <span className="font-bebas text-xl uppercase">{checkedPromo.valid ? "VALID SQUAD CODE" : "INVALID CODE"}</span>
                  </div>
                  {checkedPromo.promo && (
                    <div className="font-source-sans text-sm font-bold opacity-80">
                      {checkedPromo.promo.name}: {checkedPromo.promo.promo_type === 'percentage' ? checkedPromo.promo.value + '% OFF' : 'RS. ' + checkedPromo.promo.value + ' OFF'}
                    </div>
                  )}
                  {checkedPromo.error && <p className="text-xs text-red-400 mt-1">{checkedPromo.error}</p>}
                </motion.div>
              )}
            </div>

            {/* My Promo Codes - Ticket Style */}
            <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(237,28,36,1)]">
              <h3 className="font-bebas text-3xl text-black mb-6 flex items-center gap-3">
                <Gift className="w-6 h-6 fill-[#ED1C24] text-[#ED1C24]" />
                MY REWARDS
              </h3>

              {promoCodes.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-black/10" />
                  <p className="font-caveat text-xl text-black/40 italic">No rewards in your pocket yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {promoCodes.map((promo, index) => {
                    const isExpired = promo.is_expired || new Date(promo.expires_at) < new Date();
                    const isUsable = !promo.is_used && !isExpired && promo.is_active;
                    
                    return (
                      <motion.div
                        key={promo.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative p-4 border-4 transition-all group ${promo.is_used ? "border-black/10 opacity-50 bg-black/5" : isExpired ? "border-red-100 bg-red-50/50" : "border-black bg-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`}
                      >
                        {/* Ticket Notch */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#F8F8F8] border-r-4 border-black rounded-r-full" />
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#F8F8F8] border-l-4 border-black rounded-l-full" />

                        <div className="flex justify-between items-start mb-2">
                           <span className="font-bebas text-2xl text-black">{promo.code}</span>
                           {isUsable && (
                             <button 
                               onClick={() => copyPromoCode(promo.code)}
                               className="text-black/40 hover:text-black transition-colors"
                             >
                               <Copy className="h-5 w-5" />
                             </button>
                           )}
                        </div>
                        <div className="font-bebas text-lg text-[#ED1C24]">
                          {promo.promo_type === "percentage" ? `${promo.value}% OFF` : `RS. ${promo.value} OFF`}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-black/10">
                           <span className="font-source-sans text-[10px] font-bold text-black/40 uppercase">MIN {promo.loyalty_points_required} PTS REQUIRED</span>
                           {promo.is_used ? (
                             <span className="font-bebas text-xs bg-black text-white px-2">USED</span>
                           ) : isExpired ? (
                             <span className="font-bebas text-xs bg-red-500 text-white px-2">EXPIRED</span>
                           ) : (
                             <span className="font-bebas text-xs bg-green-500 text-white px-2">READY</span>
                           )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Points History - Simple Brutalist List */}
            <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bebas text-3xl text-black mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-black" />
                HISTORY
              </h3>

              {pointsHistory.length === 0 ? (
                <p className="font-caveat text-xl text-black/40 italic py-4">The streets are quiet... no history here.</p>
              ) : (
                <div className="space-y-4">
                  {pointsHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between pb-4 border-b-2 border-black/10 last:border-0 last:pb-0">
                      <div>
                        <p className="font-bebas text-lg text-black leading-none mb-1">{item.description}</p>
                        <p className="font-source-sans text-[10px] font-bold text-black/40 uppercase">{format(new Date(item.created_at), 'dd MMM yyyy')}</p>
                      </div>
                      <div className={`font-bebas text-2xl ${item.type === "earned" ? "text-green-600" : "text-[#ED1C24]"}`}>
                        {item.type === "earned" ? "+" : "-"}{item.points}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
