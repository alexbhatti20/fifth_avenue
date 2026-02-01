"use client";

import { useEffect, useState, useCallback } from "react";
import { usePortalAuth } from "@/hooks/usePortal";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Gift, Star, Settings, Users, Ticket, TrendingUp, Award, 
  Plus, Edit, Trash2, RefreshCw, Search, Filter, Crown,
  Zap, Sparkles, Target, Percent, DollarSign, Clock, Check, X, Power
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PerksSettings {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
  updated_at: string;
}

interface CustomerLoyalty {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_points_earned: number;
  total_points_redeemed: number;
  current_balance: number;
  total_transactions: number;
  first_transaction: string | null;
  last_transaction: string | null;
  active_promos: number;
  total_points: number;
  tier: string;
  member_since: string | null;
}

interface CustomerPromo {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  code: string;
  promo_type: string;
  value: number;
  max_discount: number | null;
  awarded_reason: string;
  is_active: boolean;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

interface ThresholdConfig {
  points: number;
  promo_type: string;
  value: number;
  max_discount?: number;
}

interface BonusConfig {
  min_amount: number;
  max_amount: number;
  bonus_points: number;
}

// SSR Props interface
interface PerksClientProps {
  initialSettings?: any;
  initialCustomers?: CustomerLoyalty[];
  initialPromos?: CustomerPromo[];
}

// Cache for perks settings
let perksSettingsCache: Record<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function PerksClient({ initialSettings, initialCustomers, initialPromos }: PerksClientProps = {}) {
  const { employee, role } = usePortalAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState<PerksSettings[]>([]);
  // Initialize with SSR data if provided
  const [customers, setCustomers] = useState<CustomerLoyalty[]>(initialCustomers || []);
  const [promos, setPromos] = useState<CustomerPromo[]>(initialPromos || []);
  // Start loading false if we have SSR data
  const [loading, setLoading] = useState(!initialSettings && !initialCustomers && !initialPromos);
  const [searchQuery, setSearchQuery] = useState("");
  const [promoFilter, setPromoFilter] = useState<"all" | "active" | "used" | "expired">("all");
  const [selectedPromos, setSelectedPromos] = useState<Set<string>>(new Set());
  
  // Editing states
  const [editingThresholds, setEditingThresholds] = useState<ThresholdConfig[]>([]);
  const [editingBonuses, setEditingBonuses] = useState<BonusConfig[]>([]);
  const [basicSettings, setBasicSettings] = useState({
    points_per_100: 1,
    promo_expiry_days: 30,
    dine_in_bonus: 0,
    online_order_bonus: 5,
    first_order_bonus: 10,
  });

  // Check if user has access (admin/manager only)
  const hasAccess = role === "admin" || role === "manager";

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && perksSettingsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      // Use cached data
      parseSettingsFromCache(perksSettingsCache);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_all_perks_settings");
      if (error) {
        // If RPC doesn't exist, use default settings
        if (error.code === 'PGRST202' || error.message?.includes('not find')) {
          
          const defaultSettings = {
            loyalty_points_per_order: { enabled: true, min_order_amount: 500, points_per_100: 10, bonus_on_first_order: 50 },
            promo_expiry_days: { default: 30, reward_codes: 60 },
            dine_in_bonus: { enabled: true, bonus_points: 5, min_order_amount: 300 },
            online_order_bonus: { enabled: true, bonus_points: 10, min_order_amount: 500 },
            loyalty_thresholds: [],
            order_amount_bonuses: [],
          };
          parseSettingsFromCache(defaultSettings);
          return;
        }
        throw error;
      }
      
      if (data) {
        // The RPC returns a JSON object keyed by setting_key
        // Each value is {value: <actual_value>, description, is_active, updated_at}
        perksSettingsCache = data;
        cacheTimestamp = Date.now();
        parseSettingsFromCache(data);
      }
    } catch (error: any) {
      
      // Use defaults on error
      const defaultSettings = {
        loyalty_points_per_order: { enabled: true, min_order_amount: 500, points_per_100: 10, bonus_on_first_order: 50 },
        promo_expiry_days: { default: 30, reward_codes: 60 },
        dine_in_bonus: { enabled: true, bonus_points: 5, min_order_amount: 300 },
        online_order_bonus: { enabled: true, bonus_points: 10, min_order_amount: 500 },
        loyalty_thresholds: [],
        order_amount_bonuses: [],
      };
      parseSettingsFromCache(defaultSettings);
    }
  }, []);

  const parseSettingsFromCache = (settingsObj: Record<string, any>) => {
    // Handle both direct value format and nested {value: ...} format
    const getValue = (key: string, defaultVal: any = null) => {
      const setting = settingsObj[key];
      if (setting === undefined || setting === null) return defaultVal;
      // If it's an object with 'value' property (from get_all_perks_settings RPC)
      if (typeof setting === 'object' && 'value' in setting) {
        return setting.value;
      }
      return setting;
    };

    // Parse loyalty_points_per_order - can be a JSONB object or a simple value
    const loyaltyPointsSetting = getValue('loyalty_points_per_order', {});
    const promoExpirySetting = getValue('promo_expiry_days', {});
    const dineInSetting = getValue('dine_in_bonus', {});
    const onlineSetting = getValue('online_order_bonus', {});
    
    setBasicSettings({
      points_per_100: typeof loyaltyPointsSetting === 'object' 
        ? (loyaltyPointsSetting.points_per_100 || 10) 
        : parseInt(String(loyaltyPointsSetting) || "10"),
      promo_expiry_days: typeof promoExpirySetting === 'object'
        ? (promoExpirySetting.default || 30)
        : parseInt(String(promoExpirySetting) || "30"),
      dine_in_bonus: typeof dineInSetting === 'object'
        ? (dineInSetting.bonus_points || 0)
        : parseInt(String(dineInSetting) || "0"),
      online_order_bonus: typeof onlineSetting === 'object'
        ? (onlineSetting.bonus_points || 5)
        : parseInt(String(onlineSetting) || "5"),
      first_order_bonus: typeof loyaltyPointsSetting === 'object'
        ? (loyaltyPointsSetting.bonus_on_first_order || 10)
        : 10,
    });

    try {
      const thresholds = getValue('loyalty_thresholds', []);
      // Handle if it's a string or already an array
      const rawThresholds = typeof thresholds === 'string' 
        ? JSON.parse(thresholds || "[]") 
        : (Array.isArray(thresholds) ? thresholds : []);
      // Map promo_value back to value for the UI (database stores as promo_value)
      const parsedThresholds = rawThresholds.map((t: any) => ({
        points: t.points || 0,
        promo_type: t.promo_type || 'percentage',
        value: t.value ?? t.promo_value ?? 0, // Handle both formats
        max_discount: t.max_discount || null,
      }));
      setEditingThresholds(parsedThresholds);
    } catch {
      setEditingThresholds([]);
    }

    try {
      const bonuses = getValue('order_amount_bonuses', []);
      const rawBonuses = typeof bonuses === 'string'
        ? JSON.parse(bonuses || "[]")
        : (Array.isArray(bonuses) ? bonuses : []);
      // Map fields explicitly to ensure consistency
      const parsedBonuses = rawBonuses.map((b: any) => ({
        min_amount: b.min_amount || 0,
        max_amount: b.max_amount || 0,
        bonus_points: b.bonus_points || 0,
      }));
      setEditingBonuses(parsedBonuses);
    } catch {
      setEditingBonuses([]);
    }
  };

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_all_customers_loyalty", { p_limit: 100 });
      if (error) {
        // If RPC doesn't exist, fall back to simple customers query
        if (error.code === 'PGRST202' || error.message?.includes('not find')) {
          
          const { data: customersData, error: customersError } = await supabase
            .from("customers")
            .select("id, name, email, phone, created_at")
            .limit(100);
          
          if (!customersError && customersData) {
            setCustomers(customersData.map(c => ({
              customer_id: c.id,
              customer_name: c.name,
              customer_email: c.email,
              customer_phone: c.phone,
              total_points_earned: 0,
              total_points_redeemed: 0,
              current_balance: 0,
              total_transactions: 0,
              first_transaction: null,
              last_transaction: null,
              active_promos: 0,
              total_points: 0,
              tier: 'bronze',
              member_since: c.created_at,
            })));
          } else {
            setCustomers([]);
          }
          return;
        }
        throw error;
      }
      // Handle case where data might be an object with customers array
      const customersArray = Array.isArray(data) ? data : (data?.customers || []);
      // Map the data to ensure all fields are properly named
      const mappedCustomers = customersArray.map((c: any) => ({
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        customer_email: c.customer_email,
        customer_phone: c.customer_phone,
        total_points_earned: c.total_points_earned || 0,
        total_points_redeemed: c.total_points_redeemed || 0,
        current_balance: c.current_balance || 0,
        total_transactions: c.total_transactions || 0,
        first_transaction: c.first_transaction || c.member_since || null,
        last_transaction: c.last_transaction || null,
        active_promos: c.active_promos || 0,
        total_points: c.total_points || c.current_balance || 0,
        tier: c.tier || 'bronze',
        member_since: c.member_since || null,
      }));
      setCustomers(mappedCustomers);
    } catch (error: any) {
      
      setCustomers([]);
    }
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      // Use RPC with SECURITY DEFINER to bypass RLS
      const { data, error } = await supabase.rpc("get_all_customer_promo_codes_admin", {
        p_limit: 100,
        p_offset: 0,
        p_filter: "all",
        p_search: null,
      });
      
      if (error) {
        
        setPromos([]);
        return;
      }
      
      if (data?.success && data?.promos) {
        const formattedPromos = data.promos.map((p: any) => ({
          ...p,
          customer_name: p.customer_name || "Unknown",
          customer_email: p.customer_email || "",
          awarded_reason: p.name || "Loyalty Reward",
        }));
        setPromos(formattedPromos);
      } else {
        setPromos([]);
      }
    } catch (error: any) {
      
      setPromos([]);
    }
  }, []);

  // Parse initial SSR settings if provided
  useEffect(() => {
    if (initialSettings) {
      parseSettingsFromCache(initialSettings);
      perksSettingsCache = initialSettings;
      cacheTimestamp = Date.now();
    }
  }, [initialSettings]);

  useEffect(() => {
    // Skip initial fetch if we have SSR data
    if (initialSettings && initialCustomers && initialPromos) {
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      const promises = [];
      if (!initialSettings) promises.push(fetchSettings());
      if (!initialCustomers) promises.push(fetchCustomers());
      if (!initialPromos) promises.push(fetchPromos());
      await Promise.all(promises);
      setLoading(false);
    };
    loadData();
  }, [fetchSettings, fetchCustomers, fetchPromos, initialSettings, initialCustomers, initialPromos]);

  const updateSetting = async (key: string, value: string) => {
    try {
      // Parse value to ensure it's valid JSON for JSONB column
      let jsonValue: any;
      try {
        jsonValue = JSON.parse(value);
      } catch {
        // If not valid JSON, wrap as string value
        jsonValue = value;
      }
      
      const { data, error } = await supabase.rpc("update_perks_setting", {
        p_setting_key: key,
        p_setting_value: jsonValue,
      });
      
      if (error) throw error;
      
      if (data?.success) {
        // Invalidate cache
        perksSettingsCache = null;
        toast({ title: "Success", description: "Setting updated successfully" });
        await fetchSettings(true);
      } else {
        throw new Error(data?.error || "Failed to update");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const saveBasicSettings = async () => {
    // Save as proper JSONB objects matching the schema structure
    await updateSetting("loyalty_points_per_order", JSON.stringify({
      enabled: true,
      min_order_amount: 500,
      points_per_100: basicSettings.points_per_100,
      bonus_on_first_order: basicSettings.first_order_bonus
    }));
    await updateSetting("promo_expiry_days", JSON.stringify({
      default: basicSettings.promo_expiry_days,
      reward_codes: 60
    }));
    await updateSetting("dine_in_bonus", JSON.stringify({
      enabled: true,
      bonus_points: basicSettings.dine_in_bonus,
      min_order_amount: 300
    }));
    await updateSetting("online_order_bonus", JSON.stringify({
      enabled: true,
      bonus_points: basicSettings.online_order_bonus,
      min_order_amount: 500
    }));
  };

  const saveThresholds = async () => {
    // Ensure thresholds have proper structure for the SQL function
    const formattedThresholds = editingThresholds.map(t => ({
      points: t.points,
      promo_type: t.promo_type,
      promo_value: t.value,
      promo_name: `${t.points} Points Reward`,
      max_discount: t.max_discount || null
    }));
    await updateSetting("loyalty_thresholds", JSON.stringify(formattedThresholds));
  };

  const saveBonuses = async () => {
    await updateSetting("order_amount_bonuses", JSON.stringify(editingBonuses));
  };

  const addThreshold = () => {
    setEditingThresholds([...editingThresholds, { points: 100, promo_type: "percentage", value: 10 }]);
  };

  const removeThreshold = (index: number) => {
    setEditingThresholds(editingThresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (index: number, field: keyof ThresholdConfig, value: any) => {
    const updated = [...editingThresholds];
    updated[index] = { ...updated[index], [field]: value };
    setEditingThresholds(updated);
  };

  const addBonus = () => {
    setEditingBonuses([...editingBonuses, { min_amount: 1000, max_amount: 2000, bonus_points: 5 }]);
  };

  const removeBonus = (index: number) => {
    setEditingBonuses(editingBonuses.filter((_, i) => i !== index));
  };

  const updateBonus = (index: number, field: keyof BonusConfig, value: number) => {
    const updated = [...editingBonuses];
    updated[index] = { ...updated[index], [field]: value };
    setEditingBonuses(updated);
  };

  const deactivatePromo = async (promoId: string) => {
    try {
      // Use RPC with SECURITY DEFINER to bypass RLS
      const { data, error } = await supabase.rpc("deactivate_customer_promo_admin", {
        p_promo_id: promoId,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to deactivate");
      }
      
      toast({ title: "Success", description: "Promo code deactivated" });
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const activatePromo = async (promoId: string) => {
    try {
      const { data, error } = await supabase.rpc("activate_customer_promo_admin", {
        p_promo_id: promoId,
      });
      
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to activate");
      
      toast({ title: "Success", description: "Promo code activated" });
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deletePromo = async (promoId: string) => {
    try {
      const { data, error } = await supabase.rpc("delete_customer_promo_admin", {
        p_promo_id: promoId,
      });
      
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to delete");
      
      toast({ title: "Success", description: "Promo code deleted" });
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const bulkActivatePromos = async () => {
    if (selectedPromos.size === 0) {
      toast({ title: "No Selection", description: "Please select promo codes to activate", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("bulk_activate_promo_codes_admin", {
        p_promo_ids: Array.from(selectedPromos),
      });
      
      if (error) throw new Error(error.message);
      
      toast({ title: "Success", description: data?.message || `${selectedPromos.size} promo codes activated` });
      setSelectedPromos(new Set());
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const bulkDeactivatePromos = async () => {
    if (selectedPromos.size === 0) {
      toast({ title: "No Selection", description: "Please select promo codes to deactivate", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("bulk_deactivate_promo_codes_admin", {
        p_promo_ids: Array.from(selectedPromos),
      });
      
      if (error) throw new Error(error.message);
      
      toast({ title: "Success", description: data?.message || `${selectedPromos.size} promo codes deactivated` });
      setSelectedPromos(new Set());
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const bulkDeletePromos = async () => {
    if (selectedPromos.size === 0) {
      toast({ title: "No Selection", description: "Please select promo codes to delete", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("bulk_delete_promo_codes_admin", {
        p_promo_ids: Array.from(selectedPromos),
      });
      
      if (error) throw new Error(error.message);
      
      toast({ title: "Success", description: data?.message || `${selectedPromos.size} promo codes deleted` });
      setSelectedPromos(new Set());
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleSelectPromo = (promoId: string) => {
    const newSet = new Set(selectedPromos);
    if (newSet.has(promoId)) {
      newSet.delete(promoId);
    } else {
      newSet.add(promoId);
    }
    setSelectedPromos(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedPromos.size === filteredPromos.length) {
      setSelectedPromos(new Set());
    } else {
      setSelectedPromos(new Set(filteredPromos.map(p => p.id)));
    }
  };

  const cleanupExpiredPromos = async () => {
    try {
      // Use RPC to cleanup expired promos
      const { data, error } = await supabase.rpc("cleanup_expired_customer_promos");
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({ title: "Cleanup Complete", description: `Deactivated ${data?.deactivated_count || 0} expired promo codes` });
      fetchPromos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c => 
    c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_phone?.includes(searchQuery)
  );

  const safePromos = Array.isArray(promos) ? promos : [];
  const filteredPromos = safePromos.filter(p => {
    const matchesSearch = p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (promoFilter) {
      case "active": return p.is_active && !p.is_used && new Date(p.expires_at) > new Date();
      case "used": return p.is_used;
      case "expired": return !p.is_active || new Date(p.expires_at) <= new Date();
      default: return true;
    }
  });

  // Stats for overview
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const stats = {
    totalCustomers: safeCustomers.length,
    totalPointsIssued: safeCustomers.reduce((sum, c) => sum + (c.total_points_earned || 0), 0),
    totalPointsRedeemed: safeCustomers.reduce((sum, c) => sum + (c.total_points_redeemed || 0), 0),
    activePromos: safePromos.filter(p => p.is_active && !p.is_used).length,
    usedPromos: safePromos.filter(p => p.is_used).length,
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              Only administrators and managers can access the Perks management system.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            Perks & Loyalty Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure loyalty points, promo thresholds, and manage customer rewards
          </p>
        </div>
        <Button onClick={async () => {
          setLoading(true);
          await Promise.all([fetchSettings(true), fetchCustomers(), fetchPromos()]);
          setLoading(false);
          toast({ title: "Refreshed", description: "All data updated successfully" });
        }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Members</p>
                <p className="text-2xl font-bold">{stats.totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Issued</p>
                <p className="text-2xl font-bold">{stats.totalPointsIssued.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Redeemed</p>
                <p className="text-2xl font-bold">{stats.totalPointsRedeemed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Ticket className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Promos</p>
                <p className="text-2xl font-bold">{stats.activePromos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-full">
                <Award className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promos Used</p>
                <p className="text-2xl font-bold">{stats.usedPromos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Points
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="promos" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Promos
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Settings Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Current Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Points per Rs.100</p>
                    <p className="text-2xl font-bold text-primary">{basicSettings.points_per_100}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Promo Expiry</p>
                    <p className="text-2xl font-bold text-primary">{basicSettings.promo_expiry_days} days</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">First Order Bonus</p>
                    <p className="text-2xl font-bold text-green-600">+{basicSettings.first_order_bonus} pts</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Online Order Bonus</p>
                    <p className="text-2xl font-bold text-blue-600">+{basicSettings.online_order_bonus} pts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Active Promo Thresholds
                </CardTitle>
                <CardDescription>Auto-generate promos when customers reach these points</CardDescription>
              </CardHeader>
              <CardContent>
                {editingThresholds.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No thresholds configured</p>
                ) : (
                  <div className="space-y-3">
                    {editingThresholds.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {t.points} pts
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge className="bg-primary">
                            {t.promo_type === "percentage" ? `${t.value}% OFF` : `Rs.${t.value} OFF`}
                          </Badge>
                        </div>
                        {t.max_discount && (
                          <span className="text-sm text-muted-foreground">
                            Max: Rs.{t.max_discount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Loyal Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Top Loyal Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Current Balance</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Active Promos</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.slice(0, 5).map((c, i) => (
                    <TableRow key={c.customer_id}>
                      <TableCell>
                        <Badge variant={i === 0 ? "default" : "outline"} className={i === 0 ? "bg-yellow-500" : ""}>
                          #{i + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{c.customer_name}</p>
                            <p className="text-sm text-muted-foreground">{c.customer_email}</p>
                          </div>
                          {c.tier && c.tier !== 'bronze' && (
                            <Badge 
                              variant="outline" 
                              className={
                                c.tier === 'platinum' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                c.tier === 'gold' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                c.tier === 'silver' ? 'bg-gray-200 text-gray-700 border-gray-400' :
                                ''
                              }
                            >
                              {c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-green-600">+{c.total_points_earned || 0}</TableCell>
                      <TableCell className="font-mono font-bold">{c.current_balance || 0}</TableCell>
                      <TableCell>{c.total_transactions || 0}</TableCell>
                      <TableCell>
                        {(c.active_promos || 0) > 0 ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            {c.active_promos}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.last_transaction ? formatDistanceToNow(new Date(c.last_transaction), { addSuffix: true }) : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Settings Tab */}
        <TabsContent value="points" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Loyalty Points Configuration
              </CardTitle>
              <CardDescription>
                Configure how loyalty points are earned across different order types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Base Points per Rs.100
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={basicSettings.points_per_100}
                    onChange={(e) => setBasicSettings({ ...basicSettings, points_per_100: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground">Base points earned for every Rs.100 spent</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Promo Code Expiry (Days)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={basicSettings.promo_expiry_days}
                    onChange={(e) => setBasicSettings({ ...basicSettings, promo_expiry_days: parseInt(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground">Days until auto-generated promos expire</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    First Order Bonus Points
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={basicSettings.first_order_bonus}
                    onChange={(e) => setBasicSettings({ ...basicSettings, first_order_bonus: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Extra points for customer's first order</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Dine-In Bonus Points
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={basicSettings.dine_in_bonus}
                    onChange={(e) => setBasicSettings({ ...basicSettings, dine_in_bonus: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Extra points for dine-in orders</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Online Order Bonus Points
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={basicSettings.online_order_bonus}
                    onChange={(e) => setBasicSettings({ ...basicSettings, online_order_bonus: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Extra points for online orders (delivery/pickup)</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={saveBasicSettings} className="w-full md:w-auto">
                  <Star className="h-4 w-4 mr-2" />
                  Save Points Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Order Amount Bonuses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Order Amount Bonus Tiers
              </CardTitle>
              <CardDescription>
                Award extra points based on order total amount
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingBonuses.map((bonus, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Amount (Rs.)</Label>
                      <Input
                        type="number"
                        value={bonus.min_amount}
                        onChange={(e) => updateBonus(index, "min_amount", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Amount (Rs.)</Label>
                      <Input
                        type="number"
                        value={bonus.max_amount}
                        onChange={(e) => updateBonus(index, "max_amount", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bonus Points</Label>
                      <Input
                        type="number"
                        value={bonus.bonus_points}
                        onChange={(e) => updateBonus(index, "bonus_points", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeBonus(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-4">
                <Button variant="outline" onClick={addBonus}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bonus Tier
                </Button>
                <Button onClick={saveBonuses}>
                  Save Bonus Tiers
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Auto-Promo Generation Thresholds
              </CardTitle>
              <CardDescription>
                When customers reach these point levels, a unique promo code is automatically generated for them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingThresholds.map((threshold, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Points Required</Label>
                      <Input
                        type="number"
                        value={threshold.points || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateThreshold(index, "points", value === "" ? 0 : parseInt(value) || 0);
                        }}
                        onKeyDown={(e) => {
                          // Allow: backspace, delete, tab, escape, enter, decimal point
                          if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                            (e.keyCode === 65 && e.ctrlKey === true) ||
                            (e.keyCode === 67 && e.ctrlKey === true) ||
                            (e.keyCode === 86 && e.ctrlKey === true) ||
                            (e.keyCode === 88 && e.ctrlKey === true) ||
                            // Allow: home, end, left, right
                            (e.keyCode >= 35 && e.keyCode <= 39)) {
                            return;
                          }
                          // Ensure that it is a number and stop the keypress
                          if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="Enter points"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Type</Label>
                      <Select
                        value={threshold.promo_type}
                        onValueChange={(val) => updateThreshold(index, "promo_type", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <span className="flex items-center gap-2">
                              <Percent className="h-4 w-4" />
                              Percentage
                            </span>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <span className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Fixed Amount
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Value {threshold.promo_type === "percentage" ? "(%)" : "(Rs.)"}
                      </Label>
                      <Input
                        type="number"
                        value={threshold.value || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateThreshold(index, "value", value === "" ? 0 : parseInt(value) || 0);
                        }}
                        onKeyDown={(e) => {
                          // Allow: backspace, delete, tab, escape, enter, decimal point
                          if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                            (e.keyCode === 65 && e.ctrlKey === true) ||
                            (e.keyCode === 67 && e.ctrlKey === true) ||
                            (e.keyCode === 86 && e.ctrlKey === true) ||
                            (e.keyCode === 88 && e.ctrlKey === true) ||
                            // Allow: home, end, left, right
                            (e.keyCode >= 35 && e.keyCode <= 39)) {
                            return;
                          }
                          // Ensure that it is a number and stop the keypress
                          if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder={threshold.promo_type === "percentage" ? "Enter %" : "Enter amount"}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Discount (Rs.)</Label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={threshold.max_discount || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateThreshold(index, "max_discount", value ? parseInt(value) || undefined : undefined);
                        }}
                        onKeyDown={(e) => {
                          // Allow: backspace, delete, tab, escape, enter, decimal point
                          if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                            (e.keyCode === 65 && e.ctrlKey === true) ||
                            (e.keyCode === 67 && e.ctrlKey === true) ||
                            (e.keyCode === 86 && e.ctrlKey === true) ||
                            (e.keyCode === 88 && e.ctrlKey === true) ||
                            // Allow: home, end, left, right
                            (e.keyCode >= 35 && e.keyCode <= 39)) {
                            return;
                          }
                          // Ensure that it is a number and stop the keypress
                          if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeThreshold(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {editingThresholds.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No promo thresholds configured yet</p>
                  <p className="text-sm">Add thresholds to auto-reward loyal customers</p>
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t">
                <Button variant="outline" onClick={addThreshold}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Threshold
                </Button>
                <Button onClick={saveThresholds}>
                  <Target className="h-4 w-4 mr-2" />
                  Save Thresholds
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* How it Works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How Auto-Promo Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Customer accumulates loyalty points through orders</li>
                <li>When their total points reach a threshold level, a unique promo code is generated</li>
                <li>The code is stored with their customer profile (format: ZOIRO-XXXXXXXX)</li>
                <li>Customer can use the code on their next order for the configured discount</li>
                <li>Each code is single-use and auto-expires after the configured days</li>
                <li>Once used, the code is automatically deactivated and removed</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customer Loyalty Overview
                  </CardTitle>
                  <CardDescription>View all customers and their loyalty points</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Redeemed</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Active Promos</TableHead>
                    <TableHead>Member Since</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TableRow key={c.customer_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{c.customer_name}</p>
                              <p className="text-sm text-muted-foreground">{c.customer_email}</p>
                            </div>
                            {c.tier && c.tier !== 'bronze' && (
                              <Badge 
                                variant="outline" 
                                className={
                                  c.tier === 'platinum' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                  c.tier === 'gold' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                  c.tier === 'silver' ? 'bg-gray-200 text-gray-700 border-gray-400' :
                                  ''
                                }
                              >
                                {c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.customer_phone}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">+{c.total_points_earned || 0}</TableCell>
                        <TableCell className="text-right font-mono text-orange-600">-{c.total_points_redeemed || 0}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{c.current_balance || 0}</TableCell>
                        <TableCell className="text-right">{c.total_transactions || 0}</TableCell>
                        <TableCell className="text-right">
                          {(c.active_promos || 0) > 0 ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {c.active_promos}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.member_since ? format(new Date(c.member_since), "MMM d, yyyy") : 
                           c.first_transaction ? format(new Date(c.first_transaction), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.last_transaction ? formatDistanceToNow(new Date(c.last_transaction), { addSuffix: true }) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promos Tab */}
        <TabsContent value="promos" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Customer Promo Codes
                  </CardTitle>
                  <CardDescription>Auto-generated promo codes for loyal customers</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-48"
                    />
                  </div>
                  <Select value={promoFilter} onValueChange={(val: any) => setPromoFilter(val)}>
                    <SelectTrigger className="w-32">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={cleanupExpiredPromos}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cleanup Expired
                  </Button>
                </div>
              </div>
              {/* Bulk Action Buttons */}
              {selectedPromos.size > 0 && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{selectedPromos.size} selected</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant="outline" onClick={bulkActivatePromos}>
                      <Power className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                    <Button size="sm" variant="outline" onClick={bulkDeactivatePromos}>
                      <X className="h-4 w-4 mr-1" />
                      Deactivate
                    </Button>
                    <Button size="sm" variant="destructive" onClick={bulkDeletePromos}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedPromos(new Set())}>
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedPromos.size === filteredPromos.length && filteredPromos.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No promo codes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPromos.map((p) => (
                      <TableRow key={p.id} className={selectedPromos.has(p.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedPromos.has(p.id)}
                            onCheckedChange={() => toggleSelectPromo(p.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded font-mono text-sm font-bold">
                            {p.code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{p.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {p.promo_type === "percentage" ? `${p.value}% OFF` : `Rs.${p.value} OFF`}
                          </Badge>
                          {p.max_discount && (
                            <span className="text-xs text-muted-foreground ml-1">(max Rs.{p.max_discount})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{p.awarded_reason}</TableCell>
                        <TableCell>
                          {p.is_used ? (
                            <Badge variant="outline" className="bg-gray-100">
                              Used {p.used_at ? formatDistanceToNow(new Date(p.used_at), { addSuffix: true }) : ""}
                            </Badge>
                          ) : new Date(p.expires_at) <= new Date() ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : p.is_active ? (
                            <Badge className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(p.expires_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {p.is_active && !p.is_used ? (
                              <Button variant="ghost" size="sm" onClick={() => deactivatePromo(p.id)} title="Deactivate">
                                <X className="h-4 w-4" />
                              </Button>
                            ) : !p.is_active && !p.is_used ? (
                              <Button variant="ghost" size="sm" onClick={() => activatePromo(p.id)} title="Activate">
                                <Power className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : null}
                            <Button variant="ghost" size="sm" onClick={() => deletePromo(p.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
