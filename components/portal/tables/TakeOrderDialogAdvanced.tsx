'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, User, Mail, ShoppingCart, CreditCard, Banknote,
  CheckCircle, Award, Package, Send, Phone, Users, Tag, Sparkles,
  Percent, Clock, Star, Gift, Ticket, ChevronRight, X, Plus, Minus,
  Utensils, Flame, Loader2, BadgeCheck, Crown, Info, Zap, Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  getMenuForOrderingAction, 
  getCustomerFullDetailsAction,
  createWaiterDineInOrderAction,
  type CustomerFullDetails,
  type CustomerPromoCode,
  type MenuItemForOrder,
  type MenuCategoryForOrder,
  type DealForOrder,
  type MenuDataForOrder,
} from '@/lib/actions';
import type { WaiterTable, CartItem } from './types';

// ==========================================
// ADVANCED TAKE ORDER DIALOG
// Tabbed interface with full customer management
// Deals, promo codes, and enhanced UX
// ==========================================

interface TakeOrderDialogAdvancedProps {
  table: WaiterTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderComplete: () => void;
}

// Membership tier colors
const TIER_COLORS = {
  bronze: 'from-amber-600 to-orange-700',
  silver: 'from-slate-400 to-zinc-500',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-slate-300 to-zinc-400',
  diamond: 'from-cyan-300 to-blue-400',
};

const TIER_ICONS = {
  bronze: Award,
  silver: Award,
  gold: Crown,
  platinum: Crown,
  diamond: Sparkles,
};

export function TakeOrderDialogAdvanced({
  table,
  open,
  onOpenChange,
  onOrderComplete,
}: TakeOrderDialogAdvancedProps) {
  // Menu State
  const [menuData, setMenuData] = useState<MenuDataForOrder>({ categories: [], items: [], deals: [] });
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('menu');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedPromoCode, setAppliedPromoCode] = useState<CustomerPromoCode | null>(null);
  
  // Customer State
  const [customerCount, setCustomerCount] = useState(1);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customer, setCustomer] = useState<CustomerFullDetails | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearched, setCustomerSearched] = useState(false);
  
  // Order State
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetch menu data
  useEffect(() => {
    if (open) {
      fetchMenu();
      // Reset state on open
      setCart([]);
      setCustomer(null);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerSearched(false);
      setAppliedPromoCode(null);
      setActiveTab('menu');
    }
  }, [open]);

  const fetchMenu = async () => {
    setIsLoadingMenu(true);
    try {
      const result = await getMenuForOrderingAction();
      if (result.success && result.data) {
        setMenuData({
          categories: result.data.categories || [],
          items: result.data.items || [],
          deals: result.data.deals || [],
        });
      } else {
        toast.error(result.error || 'Failed to load menu');
      }
    } catch (error: any) {
      console.error('Menu fetch error:', error);
      toast.error('Failed to load menu');
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Auto-search customer when phone is entered (debounced)
  const searchCustomer = useCallback(async (phone?: string, email?: string) => {
    if ((!phone || phone.length < 10) && !email) return;
    
    setIsSearchingCustomer(true);
    try {
      const result = await getCustomerFullDetailsAction({
        phone: phone || null,
        email: email || null,
      });
      
      if (result.success && result.found && result.customer) {
        setCustomer(result.customer);
        setCustomerName(result.customer.name || customerName);
        setCustomerEmail(result.customer.email || customerEmail);
        setCustomerSearched(true);
        
        toast.success(`Welcome back, ${result.customer.name}!`, {
          description: `${result.customer.loyalty_points} points • ${result.customer.promo_codes?.length || 0} promos available`,
        });
      } else {
        setCustomer(null);
        setCustomerSearched(true);
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setIsSearchingCustomer(false);
    }
  }, [customerName, customerEmail]);

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let discount = 0;
    
    if (appliedPromoCode) {
      if (appliedPromoCode.promo_type === 'percentage') {
        discount = Math.round(subtotal * (appliedPromoCode.value / 100));
        if (appliedPromoCode.max_discount && discount > appliedPromoCode.max_discount) {
          discount = appliedPromoCode.max_discount;
        }
      } else if (appliedPromoCode.promo_type === 'fixed') {
        discount = Math.min(appliedPromoCode.value, subtotal);
      }
    }
    
    const afterDiscount = subtotal - discount;
    const tax = Math.round(afterDiscount * 0.05);
    const total = afterDiscount + tax;
    
    return { subtotal, discount, afterDiscount, tax, total, itemCount: cart.reduce((sum, i) => sum + i.quantity, 0) };
  }, [cart, appliedPromoCode]);

  // Filter items
  const filteredItems = useMemo(() => {
    return menuData.items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuData.items, selectedCategory, searchQuery]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (!searchQuery) return menuData.deals;
    return menuData.deals.filter(deal => 
      deal.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [menuData.deals, searchQuery]);

  // Cart functions
  const addToCart = useCallback((item: MenuItemForOrder | DealForOrder, isDeal = false) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.isDeal === isDeal);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && i.isDeal === isDeal 
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        );
      }
      const price = isDeal ? (item as DealForOrder).deal_price : (item as MenuItemForOrder).price;
      return [...prev, { 
        id: item.id, 
        name: item.name, 
        price, 
        quantity: 1, 
        isDeal 
      }];
    });
    toast.success(`Added ${item.name}`, { duration: 1000 });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number, isDeal?: boolean) => {
    setCart((prev) => {
      return prev
        .map((item) =>
          item.id === id && item.isDeal === isDeal
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((id: string, isDeal?: boolean) => {
    setCart((prev) => prev.filter((item) => !(item.id === id && item.isDeal === isDeal)));
  }, []);

  const applyPromoCode = useCallback((promo: CustomerPromoCode) => {
    setAppliedPromoCode(promo);
    toast.success(`Promo "${promo.code}" applied!`, {
      description: promo.promo_type === 'percentage' 
        ? `${promo.value}% off` 
        : `Rs. ${promo.value} off`,
    });
  }, []);

  const removePromoCode = useCallback(() => {
    setAppliedPromoCode(null);
    toast.info('Promo code removed');
  }, []);

  // Submit order
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to the order');
      return;
    }
    if (!table) return;

    setIsSubmitting(true);
    try {
      const items = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const result = await createWaiterDineInOrderAction({
        table_id: table.id,
        items,
        customer_count: customerCount,
        customer_id: customer?.id || null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        notes: notes || null,
        payment_method: paymentMethod,
        send_email: sendEmail && !!customerEmail,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      toast.success(`Order #${result.order_number} created!`, {
        description: `Table ${table.table_number} - Rs. ${calculations.total.toLocaleString()}`,
        duration: 5000,
      });

      onOpenChange(false);
      onOrderComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!table) return null;

  const TierIcon = customer?.membership_tier 
    ? TIER_ICONS[customer.membership_tier as keyof typeof TIER_ICONS] || Award 
    : Award;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] sm:h-[92vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogDescription className="sr-only">
          Take order for table {table.table_number}
        </DialogDescription>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 p-3 sm:p-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg sm:text-xl shrink-0 backdrop-blur">
                {table.table_number}
              </div>
              <div>
                <span>Table {table.table_number}</span>
                <p className="text-xs font-normal opacity-90">
                  {table.capacity} seats • {table.section || 'Main'}
                </p>
              </div>
            </DialogTitle>
            
            {/* Cart Badge */}
            <div className="flex items-center gap-2">
              <Badge 
                onClick={() => setActiveTab('cart')}
                className="cursor-pointer bg-white/20 hover:bg-white/30 text-white border-0 gap-1.5 px-3 py-1.5"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="font-bold">{calculations.itemCount}</span>
                <span className="hidden sm:inline">• Rs. {calculations.total.toLocaleString()}</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-4 rounded-none border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-1 h-auto gap-1">
            <TabsTrigger 
              value="menu" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md rounded-lg py-3 px-2 font-medium transition-all"
            >
              <Utensils className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Menu</span>
            </TabsTrigger>
            <TabsTrigger 
              value="deals"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md rounded-lg py-3 px-2 font-medium transition-all"
            >
              <Flame className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Deals</span>
              {menuData.deals.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700">
                  {menuData.deals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="cart"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md rounded-lg py-3 px-2 font-medium transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Cart</span>
              {cart.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700">
                  {calculations.itemCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="customer"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md rounded-lg py-3 px-2 font-medium transition-all"
            >
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Customer</span>
              {customer && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* MENU TAB */}
          <TabsContent value="menu" className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
            {/* Search & Categories */}
            <div className="p-3 sm:p-4 border-b space-y-2 sm:space-y-3 shrink-0 bg-slate-50 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-white dark:bg-slate-800"
                />
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-1">
                  <Button
                    size="sm"
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      'h-8 px-4 text-xs shrink-0 rounded-full',
                      selectedCategory === 'all' && 'bg-red-500 hover:bg-red-600'
                    )}
                  >
                    All Items
                  </Button>
                  {menuData.categories.map((cat) => (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'h-8 px-4 text-xs shrink-0 rounded-full',
                        selectedCategory === cat.id && 'bg-red-500 hover:bg-red-600'
                      )}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Menu Items Grid */}
            <ScrollArea className="flex-1 min-h-0 p-3 sm:p-4">
              {isLoadingMenu ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Utensils className="h-12 w-12 mb-3 opacity-30" />
                  <p>No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(item)}
                      className="group cursor-pointer"
                    >
                      <Card className="h-full border-2 hover:border-red-300 hover:shadow-md transition-all overflow-hidden">
                        {item.is_featured && (
                          <div className="absolute top-1 right-1 z-10">
                            <Badge className="bg-amber-500 text-[9px] px-1.5 py-0.5">
                              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                              Featured
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-2 sm:p-3">
                          <h4 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-1">
                            {item.name}
                          </h4>
                          {item.description && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-red-600 text-sm">
                              Rs. {item.price}
                            </span>
                            <Button 
                              size="sm" 
                              className="h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* DEALS TAB */}
          <TabsContent value="deals" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
            <div className="p-3 sm:p-4">
              {filteredDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Flame className="h-12 w-12 mb-3 opacity-30" />
                  <p>No active deals</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredDeals.map((deal) => (
                    <motion.div
                      key={deal.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(deal, true)}
                      className="cursor-pointer"
                    >
                      <Card className="h-full border-2 border-amber-200 hover:border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                              <Flame className="h-3 w-3 mr-1" />
                              DEAL
                            </Badge>
                            {deal.original_price > deal.deal_price && (
                              <Badge variant="destructive" className="text-xs">
                                {Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)}% OFF
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base sm:text-lg mt-2">{deal.name}</CardTitle>
                          {deal.description && (
                            <CardDescription className="text-xs line-clamp-2">
                              {deal.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-xs text-muted-foreground line-through">
                                Rs. {deal.original_price}
                              </span>
                              <p className="text-lg font-bold text-amber-600">
                                Rs. {deal.deal_price}
                              </p>
                            </div>
                            <Button 
                              size="sm" 
                              className="h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* CART TAB */}
          <TabsContent value="cart" className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 min-h-0 p-3 sm:p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">Cart is empty</p>
                  <p className="text-sm mt-1">Add items from the menu</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('menu')}
                  >
                    <Utensils className="h-4 w-4 mr-2" />
                    Browse Menu
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                      <motion.div
                        key={`${item.id}-${item.isDeal}`}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <Card className={cn(
                          "overflow-hidden",
                          item.isDeal && "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
                        )}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                                {item.isDeal && (
                                  <Badge className="shrink-0 bg-amber-500 text-[9px] px-1.5">DEAL</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Rs. {item.price} each
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, -1, item.isDeal)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-bold text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, 1, item.isDeal)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-right min-w-[70px]">
                              <p className="font-bold text-sm">
                                Rs. {(item.price * item.quantity).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeFromCart(item.id, item.isDeal)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Order Notes */}
                  <div className="pt-4">
                    <Label className="text-sm font-medium">Order Notes</Label>
                    <Textarea
                      placeholder="Special instructions, allergies, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1.5 h-20"
                    />
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Cart Summary Footer */}
            {cart.length > 0 && (
              <div className="p-3 sm:p-4 border-t bg-white dark:bg-slate-900 space-y-3 shrink-0">
                {/* Applied Promo */}
                {appliedPromoCode && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">{appliedPromoCode.code}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {appliedPromoCode.promo_type === 'percentage' 
                          ? `${appliedPromoCode.value}% OFF` 
                          : `Rs. ${appliedPromoCode.value} OFF`}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={removePromoCode}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({calculations.itemCount} items)</span>
                    <span>Rs. {calculations.subtotal.toLocaleString()}</span>
                  </div>
                  {calculations.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span>
                      <span>-Rs. {calculations.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (5%)</span>
                    <span>Rs. {calculations.tax.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-red-600">Rs. {calculations.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* CUSTOMER TAB */}
          <TabsContent value="customer" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
            <div className="p-3 sm:p-4">
              <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
                {/* Customer Search */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Find Customer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enter phone number to auto-detect registered customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Phone Number</Label>
                        <div className="relative mt-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="03XX-XXXXXXX"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Guest Count</Label>
                        <div className="relative mt-1">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={customerCount}
                            onChange={(e) => setCustomerCount(Number(e.target.value))}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      variant={customer ? "secondary" : "default"}
                      onClick={() => searchCustomer(customerPhone, customerEmail)}
                      disabled={isSearchingCustomer || customerPhone.length < 10}
                    >
                      {isSearchingCustomer ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : customer ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Customer
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search Customer
                        </>
                      )}
                    </Button>

                    {customerSearched && !customer && (
                      <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
                        <p className="text-sm text-muted-foreground">Customer not found in system</p>
                        <p className="text-xs mt-1">Order will be placed as walk-in guest</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Details (if found) */}
                {customer && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-2 border-emerald-300 overflow-hidden">
                      <div className={cn(
                        "p-4 text-white bg-gradient-to-r",
                        TIER_COLORS[customer.membership_tier as keyof typeof TIER_COLORS] || TIER_COLORS.bronze
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                              <TierIcon className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{customer.name}</h3>
                              <p className="text-sm opacity-90 capitalize">{customer.membership_tier || 'Bronze'} Member</p>
                            </div>
                          </div>
                          <Badge className="bg-white/20 text-white border-0">
                            <BadgeCheck className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
                            <Award className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                            <p className="text-lg font-bold text-amber-700">{customer.loyalty_points}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Points</p>
                          </div>
                          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
                            <Package className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                            <p className="text-lg font-bold text-blue-700">{customer.total_orders}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
                          </div>
                          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                            <Zap className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                            <p className="text-lg font-bold text-emerald-700">
                              Rs. {Math.round(customer.avg_order_value || 0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase">Avg Order</p>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.phone}</span>
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{customer.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Promo Codes */}
                        {customer.promo_codes && customer.promo_codes.length > 0 && (
                          <div className="pt-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                              <Gift className="h-4 w-4 text-purple-500" />
                              Available Promo Codes ({customer.promo_codes.length})
                            </h4>
                            <div className="space-y-2">
                              {customer.promo_codes.map((promo) => (
                                <motion.div
                                  key={promo.id}
                                  whileHover={{ scale: 1.01 }}
                                  className={cn(
                                    "p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                                    appliedPromoCode?.id === promo.id
                                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                      : "border-purple-200 hover:border-purple-400 bg-purple-50/50 dark:bg-purple-950/20"
                                  )}
                                  onClick={() => {
                                    if (appliedPromoCode?.id === promo.id) {
                                      removePromoCode();
                                    } else {
                                      applyPromoCode(promo);
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Ticket className="h-4 w-4 text-purple-500" />
                                      <span className="font-mono font-bold text-sm">{promo.code}</span>
                                    </div>
                                    <Badge variant={appliedPromoCode?.id === promo.id ? "default" : "secondary"}>
                                      {promo.promo_type === 'percentage' 
                                        ? `${promo.value}% OFF`
                                        : `Rs. ${promo.value} OFF`}
                                    </Badge>
                                  </div>
                                  {promo.name && (
                                    <p className="text-xs text-muted-foreground mt-1">{promo.name}</p>
                                  )}
                                  {promo.expires_at && (
                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Expires: {new Date(promo.expires_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Manual Entry (if no customer) */}
                {!customer && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Guest Information</CardTitle>
                      <CardDescription className="text-xs">Optional details for walk-in customers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="Customer name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email (for receipt)</Label>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Fixed Bottom Action Bar */}
        <div className="p-3 sm:p-4 border-t bg-white dark:bg-slate-900 shrink-0 space-y-3">
          {/* Payment Method */}
          <div className="flex gap-2">
            <Button
              variant={paymentMethod === 'cash' ? 'default' : 'outline'}
              className={cn(
                'flex-1 h-10',
                paymentMethod === 'cash' && 'bg-emerald-500 hover:bg-emerald-600'
              )}
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote className="h-4 w-4 mr-2" />
              Cash
            </Button>
            <Button
              variant={paymentMethod === 'card' ? 'default' : 'outline'}
              className={cn(
                'flex-1 h-10',
                paymentMethod === 'card' && 'bg-blue-500 hover:bg-blue-600'
              )}
              onClick={() => setPaymentMethod('card')}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Card
            </Button>
          </div>

          {/* Email Toggle */}
          {customerEmail && (
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Send email receipt
              </Label>
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
            </div>
          )}

          {/* Submit Button */}
          <Button
            className="w-full h-12 text-lg bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-700 hover:via-orange-600 hover:to-amber-600"
            onClick={handleSubmitOrder}
            disabled={cart.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Place Order • Rs. {calculations.total.toLocaleString()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
