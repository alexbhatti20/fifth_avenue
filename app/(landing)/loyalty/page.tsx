"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
import { supabase } from "@/lib/supabase";
import { isMobile } from "@/lib/utils";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface LoyaltyData {
  total_points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  points_to_next_tier: number;
}

interface PromoCode {
  id: string;
  code: string;
  name: string;
  description: string;
  promo_type: "percentage" | "fixed_amount";
  value: number;
  max_discount: number | null;
  loyalty_points_required: number;
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
  is_active: boolean;
  is_expired?: boolean;
}

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

interface PointsHistory {
  id: string;
  points: number;
  type: "earned" | "redeemed";
  description: string;
  created_at: string;
}

const tierConfig = {
  bronze: { color: "from-amber-600 to-amber-800", points: 0, icon: "🥉" },
  silver: { color: "from-gray-400 to-gray-600", points: 500, icon: "🥈" },
  gold: { color: "from-yellow-400 to-yellow-600", points: 1500, icon: "🥇" },
  platinum: { color: "from-purple-400 to-purple-600", points: 3000, icon: "💎" },
};

export default function LoyaltyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [promoInput, setPromoInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPromo, setCheckedPromo] = useState<CheckedPromo | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
    setIsMobileDevice(isMobile());
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchLoyaltyData();
    }
  }, [user]);

  const fetchLoyaltyData = async () => {
    if (!user) return;

    try {
      // Use RPC for optimized loyalty balance fetch
      const { data: balance, error: balanceError } = await supabase.rpc(
        "get_loyalty_balance",
        { p_customer_id: user.id }
      );

      if (balanceError) console.error("Balance error:", balanceError);

      const balanceData = balance?.[0];
      const totalPoints = balanceData?.total_points || 0;
      
      // Calculate tier
      let tier: "bronze" | "silver" | "gold" | "platinum" = "bronze";
      let pointsToNext = 500 - totalPoints;

      if (totalPoints >= 3000) {
        tier = "platinum";
        pointsToNext = 0;
      } else if (totalPoints >= 1500) {
        tier = "gold";
        pointsToNext = 3000 - totalPoints;
      } else if (totalPoints >= 500) {
        tier = "silver";
        pointsToNext = 1500 - totalPoints;
      }

      setLoyaltyData({
        total_points: totalPoints,
        tier,
        points_to_next_tier: Math.max(0, pointsToNext),
      });

      // Fetch customer's awarded promo codes
      const { data: customerPromos, error: promosError } = await supabase.rpc(
        "get_customer_promo_codes",
        { p_customer_id: user.id }
      );

      if (promosError) {
        console.error("Promos error:", promosError);
        setPromoCodes([]);
      } else {
        setPromoCodes(customerPromos || []);
      }

      // Fetch points history
      const { data: history } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setPointsHistory(history || []);
    } catch (error) {
      console.error("Error fetching loyalty data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckPromo = async () => {
    if (!promoInput.trim()) return;

    setIsChecking(true);
    setCheckedPromo(null);
    
    try {
      // Use the check_promo_code_details RPC
      const { data, error } = await supabase.rpc(
        "check_promo_code_details",
        { 
          p_code: promoInput.toUpperCase(),
          p_customer_id: user?.id || null
        }
      );

      if (error) {
        throw new Error(error.message);
      }

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

  if (authLoading || isLoading) {
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
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-3xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Loyalty Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={!isMobileDevice ? { 
              scale: 1.05, 
              rotateY: 5,
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.3)"
            } : {}}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`relative overflow-hidden rounded-3xl p-6 md:p-8 mb-8 bg-gradient-to-br ${tierInfo.color} text-white shadow-2xl`}
            style={!isMobileDevice ? { transformStyle: "preserve-3d", perspective: 1000 } : {}}
          >
            {/* Animated shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={!isMobileDevice ? { x: ['-100%', '200%'] } : {}}
              transition={!isMobileDevice ? { duration: 3, repeat: Infinity, ease: "linear" } : {}}
            />
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-white/70 text-sm mb-1">Your Tier</p>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{tierInfo.icon}</span>
                    <h2 className="text-2xl md:text-3xl font-bold capitalize">
                      {tier}
                    </h2>
                  </div>
                </div>
                <Trophy className="w-12 h-12 opacity-50" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-white/70 text-sm mb-1">Total Points</p>
                  <p className="text-3xl md:text-4xl font-bold">
                    {loyaltyData?.total_points || 0}
                  </p>
                </div>
                {tier !== "platinum" && (
                  <div>
                    <p className="text-white/70 text-sm mb-1">Points to Next Tier</p>
                    <p className="text-3xl md:text-4xl font-bold">
                      {loyaltyData?.points_to_next_tier || 0}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {tier !== "platinum" && (
                <div className="mt-6">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          ((loyaltyData?.total_points || 0) /
                            (tierConfig[
                              tier === "bronze"
                                ? "silver"
                                : tier === "silver"
                                ? "gold"
                                : "platinum"
                            ].points)) *
                          100
                        }%`,
                      }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Earn Points Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={!isMobileDevice ? { scale: 1.02, boxShadow: "0 15px 40px rgba(0, 0, 0, 0.1)" } : {}}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-card via-card to-yellow-500/5 rounded-2xl border shadow-lg p-6 mb-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
            <h3 className="font-semibold mb-4 flex items-center gap-2 relative z-10">
              <Star className="h-5 w-5 text-yellow-500" />
              How to Earn Points
            </h3>
            <div className="grid gap-4 md:grid-cols-3 relative z-10">
              {[
                { icon: "🛒", title: "Order Food", desc: "1 point per Rs. 10 spent" },
                { icon: "⭐", title: "Leave Reviews", desc: "+50 points per review" },
                { icon: "👥", title: "Refer Friends", desc: "+100 points per referral" },
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl cursor-pointer"
                  whileHover={!isMobileDevice ? { 
                    scale: 1.05, 
                    backgroundColor: "rgba(var(--secondary), 0.8)",
                    transition: { duration: 0.2 }
                  } : {}}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Check Promo Code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, boxShadow: "0 15px 40px rgba(0, 0, 0, 0.1)" }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-6 mb-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <h3 className="font-semibold mb-4 flex items-center gap-2 relative z-10">
              <Ticket className="h-5 w-5 text-primary" />
              Check Promo Code
            </h3>
            <div className="flex gap-2 relative z-10">
              <Input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase());
                  setCheckedPromo(null);
                }}
                placeholder="Enter promo code to check"
                className="flex-1"
              />
              <Button
                onClick={handleCheckPromo}
                disabled={isChecking || !promoInput.trim()}
                className="rounded-xl"
              >
                {isChecking ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Check"
                )}
              </Button>
            </div>

            {/* Promo Code Check Result */}
            {checkedPromo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-xl border relative z-10 ${
                  checkedPromo.valid 
                    ? "bg-green-500/10 border-green-500/30" 
                    : checkedPromo.found 
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    checkedPromo.valid ? "bg-green-500/20" : checkedPromo.found ? "bg-yellow-500/20" : "bg-red-500/20"
                  }`}>
                    {checkedPromo.valid ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : checkedPromo.found ? (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold">{checkedPromo.promo?.code || promoInput}</p>
                      {checkedPromo.source === "customer_reward" && (
                        <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full">
                          Loyalty Reward
                        </span>
                      )}
                      {checkedPromo.valid && (
                        <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full">
                          Valid
                        </span>
                      )}
                      {checkedPromo.promo?.is_used && (
                        <span className="text-xs bg-gray-500/20 text-gray-600 px-2 py-0.5 rounded-full">
                          Already Used
                        </span>
                      )}
                    </div>
                    {checkedPromo.promo && (
                      <>
                        <p className="text-sm font-medium">{checkedPromo.promo.name}</p>
                        <p className="text-sm text-muted-foreground">{checkedPromo.promo.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {checkedPromo.promo.promo_type === "percentage" 
                              ? `${checkedPromo.promo.value}% off` 
                              : `Rs. ${checkedPromo.promo.value} off`}
                          </span>
                          {checkedPromo.promo.max_discount && (
                            <span>Max: Rs. {checkedPromo.promo.max_discount}</span>
                          )}
                          {(checkedPromo.promo.expires_at || checkedPromo.promo.valid_until) && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires: {new Date(checkedPromo.promo.expires_at || checkedPromo.promo.valid_until!).toLocaleDateString()}
                            </span>
                          )}
                          {checkedPromo.promo.used_at && (
                            <span>Used on: {new Date(checkedPromo.promo.used_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </>
                    )}
                    {checkedPromo.error && (
                      <p className="text-sm text-red-500 mt-1">{checkedPromo.error}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* My Promo Codes (Customer Awarded) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 15px 40px rgba(0, 0, 0, 0.1)" }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-card via-card to-green-500/5 rounded-2xl border shadow-lg p-6 mb-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/10 rounded-full blur-3xl" />
            <h3 className="font-semibold mb-4 flex items-center gap-2 relative z-10">
              <Gift className="h-5 w-5 text-green-500" />
              My Reward Codes
            </h3>
            <p className="text-xs text-muted-foreground mb-4 relative z-10">
              These promo codes were awarded to you based on your loyalty points. Use them on your orders!
            </p>

            {promoCodes.length === 0 ? (
              <div className="text-center py-8 relative z-10">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No reward codes yet. Keep earning points to unlock exclusive promos!
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative z-10">
                {promoCodes.map((promo, index) => {
                  const isExpired = promo.is_expired || new Date(promo.expires_at) < new Date();
                  const isUsable = !promo.is_used && !isExpired && promo.is_active;
                  
                  return (
                    <motion.div
                      key={promo.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ 
                        scale: isUsable ? 1.03 : 1, 
                        boxShadow: isUsable ? "0 10px 30px rgba(0, 0, 0, 0.15)" : "none"
                      }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        promo.is_used 
                          ? "bg-gray-500/10 opacity-60 border-gray-300" 
                          : isExpired
                          ? "bg-red-500/5 opacity-60 border-red-200"
                          : "bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          promo.is_used ? "bg-gray-500/10" : isExpired ? "bg-red-500/10" : "bg-green-500/10"
                        }`}>
                          {promo.is_used ? (
                            <CheckCircle className="h-6 w-6 text-gray-500" />
                          ) : isExpired ? (
                            <Clock className="h-6 w-6 text-red-500" />
                          ) : (
                            <Award className="h-6 w-6 text-green-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-lg">{promo.code}</p>
                            {promo.is_used && (
                              <span className="text-xs bg-gray-500/20 text-gray-600 px-2 py-0.5 rounded-full">
                                Used
                              </span>
                            )}
                            {isExpired && !promo.is_used && (
                              <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded-full">
                                Expired
                              </span>
                            )}
                            {isUsable && (
                              <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {promo.name || promo.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="font-medium text-primary">
                              {promo.promo_type === "percentage" 
                                ? `${promo.value}% off` 
                                : `Rs. ${promo.value} off`}
                              {promo.max_discount && ` (max Rs. ${promo.max_discount})`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Trophy className="h-3 w-3" />
                              {promo.loyalty_points_required} pts required
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {promo.expires_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {promo.is_used 
                                  ? `Used on ${new Date(promo.used_at!).toLocaleDateString()}`
                                  : `Expires: ${new Date(promo.expires_at).toLocaleDateString()}`
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isUsable && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyPromoCode(promo.code)}
                          className="rounded-full border-green-500/30 hover:bg-green-500/10"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Points History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 15px 40px rgba(0, 0, 0, 0.1)" }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-card via-card to-blue-500/5 rounded-2xl border shadow-lg p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
            <h3 className="font-semibold mb-4 flex items-center gap-2 relative z-10">
              <Clock className="h-5 w-5 text-blue-500" />
              Points History
            </h3>

            {pointsHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 relative z-10">
                No points history yet. Start earning by placing orders!
              </p>
            ) : (
              <div className="space-y-3 relative z-10">
                {pointsHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.type === "earned"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {item.type === "earned" ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-bold ${
                        item.type === "earned" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {item.type === "earned" ? "+" : "-"}
                      {item.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
