'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Utensils,
  Flame,
  Loader2,
  ArrowLeft,
  ReceiptText,
  X,
  Trash2,
  ChefHat,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateOrderItemsAction } from '@/lib/actions';
import type { WaiterTable, CartItem } from '@/components/portal/tables/types';
import type { MenuDataForSSR, OrderForEdit } from '@/lib/server-queries';

// =============================================
// EDIT ORDER PAGE CLIENT
// Pre-populates cart with existing order items.
// Replacing item array via update_order_items RPC.
// Menu is SSR-rendered — no spinner on page load.
// =============================================

interface Props {
  table: WaiterTable;
  initialMenuData: MenuDataForSSR;
  existingOrder: OrderForEdit;
}

export function EditOrderClient({ table, initialMenuData, existingOrder }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Menu state ──────────────────────────────────────────────────
  const menuData = initialMenuData;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('menu');

  // ── Cart — pre-populated from existing order ─────────────────────
  const [cart, setCart] = useState<CartItem[]>(() =>
    (existingOrder.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      isDeal: item.isDeal ?? false,
      notes: item.notes,
    }))
  );

  // ── Submission state ─────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Calculations ─────────────────────────────────────────────────
  const calc = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
    return { subtotal, tax, total, itemCount };
  }, [cart]);

  // ── Menu filter ──────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return menuData.items.filter((item) => {
      const byCategory =
        selectedCategory === 'all' || item.category_id === selectedCategory;
      const bySearch =
        !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase());
      return byCategory && bySearch;
    });
  }, [menuData.items, selectedCategory, menuSearch]);

  const filteredDeals = useMemo(() => {
    if (!menuSearch) return menuData.deals;
    return menuData.deals.filter((d) =>
      d.name.toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [menuData.deals, menuSearch]);

  // ── Cart helpers ─────────────────────────────────────────────────
  const addToCart = useCallback(
    (item: { id: string; name: string; price: number }, isDeal = false) => {
      setCart((prev) => {
        const existing = prev.find(
          (i) => i.id === item.id && i.isDeal === isDeal
        );
        if (existing)
          return prev.map((i) =>
            i.id === item.id && i.isDeal === isDeal
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        return [
          ...prev,
          { id: item.id, name: item.name, price: item.price, quantity: 1, isDeal },
        ];
      });
      toast.success(`Added ${item.name}`, { duration: 900 });
    },
    []
  );

  const updateQty = useCallback(
    (id: string, delta: number, isDeal?: boolean) => {
      setCart((prev) =>
        prev
          .map((i) =>
            i.id === id && i.isDeal === isDeal
              ? { ...i, quantity: Math.max(0, i.quantity + delta) }
              : i
          )
          .filter((i) => i.quantity > 0)
      );
    },
    []
  );

  const removeFromCart = useCallback((id: string, isDeal?: boolean) => {
    setCart((prev) => prev.filter((i) => !(i.id === id && i.isDeal === isDeal)));
  }, []);

  // ── Submit: update the live order ─────────────────────────────────
  const handleUpdateOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty — add at least one item');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await updateOrderItemsAction(existingOrder.id, cart);
      if (!result.success) throw new Error(result.error || 'Failed to update order');

      setIsSuccess(true);
      toast.success(`Order #${existingOrder.order_number} updated!`, {
        description: `${result.items_count} item${(result.items_count ?? 0) !== 1 ? 's' : ''} · Rs. ${(result.total ?? calc.total).toLocaleString()} · Kitchen notified`,
        duration: 5000,
      });

      // Navigate back to tables after brief delay
      startTransition(() => {
        router.push('/portal/tables');
        router.refresh();
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order');
      setIsSubmitting(false);
    }
  };

  // ── Diff: show what changed vs original order ─────────────────────
  const originalItemIds = useMemo(
    () => new Set((existingOrder.items ?? []).map((i) => i.id)),
    [existingOrder.items]
  );
  const hasChanges = useMemo(() => {
    const origMap = new Map(
      (existingOrder.items ?? []).map((i) => [`${i.id}:${i.isDeal}`, i.quantity])
    );
    if (cart.length !== (existingOrder.items ?? []).length) return true;
    for (const item of cart) {
      const key = `${item.id}:${item.isDeal ?? false}`;
      if ((origMap.get(key) ?? 0) !== item.quantity) return true;
    }
    return false;
  }, [cart, existingOrder.items]);

  // ──────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col -mt-4 sm:-mt-6 -mx-4 sm:-mx-6 min-h-screen">
      {/* ── PAGE HEADER ── */}
      <header className="shrink-0 bg-gradient-to-r from-slate-900 via-red-900 to-red-800 text-white px-4 py-3 flex items-center justify-between shadow-xl sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-9 w-9 shrink-0"
            onClick={() => router.push('/portal/tables')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center text-xl text-white shrink-0 shadow-inner">
            {table.table_number}
          </div>
          <div className="min-w-0">
            <h1 className="text-white text-base leading-tight flex items-center gap-2">
              <Pencil className="h-4 w-4 opacity-75" />
              Edit Order
              <span className="text-[11px] text-white bg-white/20 border border-white/30 rounded-full px-2 py-0.5">
                #{existingOrder.order_number}
              </span>
            </h1>
            <p className="text-white text-xs opacity-80 truncate">
              Table {table.table_number} · {table.capacity} seats ·{' '}
              <span className="capitalize">{existingOrder.status}</span>
            </p>
          </div>
        </div>

        {/* Header cart pill */}
        <button
          onClick={() => setActiveTab('cart')}
          className="relative flex items-center gap-2 bg-white/15 hover:bg-white/25 active:bg-white/30 transition-all rounded-2xl px-3 py-2 border border-white/30 shadow-sm text-white"
        >
          <ShoppingCart className="h-4 w-4 shrink-0 text-white" />
          <div className="text-right leading-tight">
            <p className="text-[11px] text-white">{calc.itemCount} items</p>
            <p className="text-[10px] text-white/80">Rs.&nbsp;{calc.total.toLocaleString()}</p>
          </div>
          {calc.itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-white text-red-600 rounded-full text-[10px] font-medium flex items-center justify-center shadow-md ring-2 ring-red-500">
              {calc.itemCount}
            </span>
          )}
        </button>
      </header>

      {/* ── CHANGES INDICATOR BANNER ── */}
      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">You have unsaved changes — scroll down to update the order</span>
        </div>
      )}

      {/* ── FLOATING CART FAB ── */}
      <AnimatePresence>
        {cart.length > 0 && activeTab !== 'cart' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setActiveTab('cart')}
            className="fixed bottom-36 right-4 z-50 flex items-center gap-2 bg-gradient-to-br from-red-700 via-red-600 to-orange-500 text-white rounded-2xl px-4 py-3 shadow-2xl shadow-red-600/40 border border-red-400/30"
          >
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <div className="text-left leading-tight">
              <p className="text-[11px]">{calc.itemCount} items</p>
            <p className="text-[10px] opacity-85">Rs.&nbsp;{calc.total.toLocaleString()}</p>
            </div>
            <span className="absolute -top-2 -right-2 h-6 w-6 bg-white text-red-600 rounded-full text-xs font-medium flex items-center justify-center shadow-lg ring-2 ring-red-500">
              {calc.itemCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── TABS ── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <div className="max-w-5xl mx-auto w-full">
          <TabsList className="shrink-0 w-full rounded-none border-b bg-white dark:bg-slate-900 p-1 h-auto grid grid-cols-3 gap-1">
            <TabsTrigger
              value="menu"
              className="flex items-center justify-center gap-1.5 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 dark:data-[state=active]:bg-red-950/30 rounded-lg py-2.5 text-xs sm:text-sm"
            >
              <Utensils className="h-4 w-4 shrink-0" />
              Menu
            </TabsTrigger>
            <TabsTrigger
              value="deals"
              className="flex items-center justify-center gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 dark:data-[state=active]:bg-amber-950/30 rounded-lg py-2.5 text-xs sm:text-sm font-medium"
            >
              <Flame className="h-4 w-4 shrink-0" />
              Deals
              {menuData.deals.length > 0 && (
                <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-0">
                  {menuData.deals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="cart"
              className="flex items-center justify-center gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-950/30 rounded-lg py-2.5 text-xs sm:text-sm font-medium"
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              Cart
              {cart.length > 0 && (
                <Badge className="h-4 px-1 text-[9px] bg-emerald-100 text-emerald-700 border-0">
                  {calc.itemCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ MENU TAB ═══════════════════════════════════════════════ */}
        <TabsContent value="menu" className="flex flex-col mt-0 data-[state=inactive]:hidden">
          <div className="max-w-5xl mx-auto w-full">
            {/* Search + category filter */}
            <div className="shrink-0 px-3 pt-3 pb-2 space-y-2.5 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm sticky top-14 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items…"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="pl-9 h-9 bg-slate-50 dark:bg-slate-800"
                />
                {menuSearch && (
                  <button
                    onClick={() => setMenuSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-1">
                  {[{ id: 'all', name: 'All' }, ...menuData.categories].map((cat) => (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'h-7 px-3 text-xs shrink-0 rounded-full',
                        selectedCategory === cat.id &&
                          'bg-red-600 hover:bg-red-700 border-red-600 text-white'
                      )}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Items grid */}
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {filteredItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Utensils className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">No items found</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const inCart = cart.find((c) => c.id === item.id && !c.isDeal);
                  const isOriginal = originalItemIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      className="group"
                    >
                      <Card
                        className={cn(
                          'h-full border-2 cursor-pointer transition-all overflow-hidden relative select-none',
                          inCart
                            ? 'border-red-400 bg-red-50/60 dark:bg-red-950/20 shadow-md shadow-red-200/60 dark:shadow-red-900/30'
                            : 'border-transparent hover:border-red-200 hover:shadow-md bg-white dark:bg-slate-800'
                        )}
                        onClick={() => addToCart(item)}
                      >
                        <div className={cn(
                          'h-1 w-full bg-gradient-to-r from-red-500 to-orange-500 transition-opacity',
                          inCart ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                        )} />
                        {inCart && (
                          <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] rounded-full flex items-center justify-center shadow-lg">
                            {inCart.quantity}
                          </div>
                        )}
                        {/* "In original order" dot */}
                        {isOriginal && !inCart && (
                          <div className="absolute top-2 left-2 z-10 h-2 w-2 bg-amber-400 rounded-full shadow" title="Was in original order" />
                        )}
                        <CardContent className="p-2.5 sm:p-3 pt-2">
                          <h4 className="text-xs sm:text-sm line-clamp-2 mb-2 leading-tight bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span className="text-sm bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                              Rs.&nbsp;{item.price}
                            </span>
                            <div className={cn(
                              'h-7 w-7 rounded-full flex items-center justify-center shadow-md transition-all',
                              inCart
                                ? 'bg-gradient-to-br from-red-500 to-orange-500 scale-110'
                                : 'bg-gradient-to-br from-red-400 to-orange-400 group-hover:from-red-500 group-hover:to-orange-500'
                            )}>
                              <Plus className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ DEALS TAB ══════════════════════════════════════════════ */}
        <TabsContent value="deals" className="mt-0 data-[state=inactive]:hidden">
          <div className="p-3 max-w-5xl mx-auto w-full">
            {filteredDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Flame className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No active deals</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDeals.map((deal) => {
                  const inCart = cart.find((c) => c.id === deal.id && c.isDeal);
                  const savePct =
                    deal.original_price > deal.deal_price
                      ? Math.round(
                          ((deal.original_price - deal.deal_price) /
                            deal.original_price) *
                            100
                        )
                      : 0;
                  return (
                    <motion.div
                      key={deal.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      className="cursor-pointer"
                      onClick={() =>
                        addToCart(
                          { id: deal.id, name: deal.name, price: deal.deal_price },
                          true
                        )
                      }
                    >
                      <Card
                        className={cn(
                          'h-full border-0 transition-all overflow-hidden',
                          inCart
                            ? 'ring-2 ring-amber-400 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30'
                            : 'ring-1 ring-amber-200 dark:ring-amber-800 hover:ring-amber-400 hover:shadow-md',
                          'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'
                        )}
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px]">
                              <Flame className="h-3 w-3 mr-1" />
                              DEAL
                            </Badge>
                            {savePct > 0 && (
                              <Badge variant="destructive" className="text-[10px]">
                                {savePct}% OFF
                              </Badge>
                            )}
                            {inCart && (
                              <Badge className="bg-amber-500 border-0 text-white text-[10px]">
                                ×{inCart.quantity} in cart
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-sm mt-1 text-slate-800 dark:text-slate-100">
                            {deal.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0">
                          <div className="flex items-center justify-between">
                            <div>
                              {deal.original_price > deal.deal_price && (
                                <p className="text-xs text-muted-foreground line-through">
                                  Rs.&nbsp;{deal.original_price}
                                </p>
                              )}
                              <p className="text-base bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                                Rs.&nbsp;{deal.deal_price}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(
                                  { id: deal.id, name: deal.name, price: deal.deal_price },
                                  true
                                );
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ CART TAB ═══════════════════════════════════════════════ */}
        <TabsContent value="cart" className="flex flex-col mt-0 data-[state=inactive]:hidden">
          <div className="max-w-3xl mx-auto w-full">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground px-6 text-center">
                <ShoppingCart className="h-14 w-14 mb-4 opacity-15" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-1 opacity-70">
                  All original items were removed. Add items from the menu or go back.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveTab('menu')}
                >
                  <Utensils className="h-4 w-4 mr-2" />
                  Browse Menu
                </Button>
              </div>
            ) : (
              <div className="p-3 space-y-2 pb-48">
                {/* Cart header */}
                <div className="flex items-center justify-between px-1 pb-1">
                  <h3 className="text-sm bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                    {calc.itemCount} item{calc.itemCount !== 1 ? 's' : ''} in cart
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => {
                      setCart([]);
                      toast.info('Cart cleared');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear all
                  </Button>
                </div>

                {/* Cart items */}
                {cart.map((item) => {
                  const isNew = !originalItemIds.has(item.id);
                  const origItem = (existingOrder.items ?? []).find(
                    (o) => o.id === item.id && (o.isDeal ?? false) === (item.isDeal ?? false)
                  );
                  const qtyChanged = origItem && origItem.quantity !== item.quantity;

                  return (
                    <motion.div
                      key={`${item.id}:${item.isDeal}`}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Card className={cn(
                        'border overflow-hidden',
                        isNew
                          ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : qtyChanged
                          ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-700'
                      )}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm text-slate-800 dark:text-slate-100 leading-tight">
                                  {item.name}
                                </p>
                                {item.isDeal && (
                                  <Badge className="text-[9px] px-1 h-3.5 bg-amber-100 text-amber-700 border-0">
                                    DEAL
                                  </Badge>
                                )}
                                {isNew && (
                                  <Badge className="text-[9px] px-1 h-3.5 bg-emerald-100 text-emerald-700 border-0">
                                    NEW
                                  </Badge>
                                )}
                                {qtyChanged && !isNew && (
                                  <Badge className="text-[9px] px-1 h-3.5 bg-amber-100 text-amber-700 border-0">
                                    {origItem!.quantity} → {item.quantity}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-red-600 mt-0.5">
                                Rs.&nbsp;{(item.price * item.quantity).toLocaleString()}
                                <span className="text-muted-foreground font-normal ml-1">
                                  @{item.price} each
                                </span>
                              </p>
                            </div>

                            {/* Qty controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => updateQty(item.id, -1, item.isDeal)}
                                className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(item.id, 1, item.isDeal)}
                                className="h-7 w-7 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800/40 text-red-600 dark:text-red-300 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => removeFromCart(item.id, item.isDeal)}
                                className="h-7 w-7 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors ml-1"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}

                {/* Totals */}
                <Card className="border-red-200 dark:border-red-900 mt-3 bg-gradient-to-br from-slate-50 to-red-50 dark:from-slate-900 dark:to-red-950/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>Rs.&nbsp;{calc.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (5%)</span>
                      <span>Rs.&nbsp;{calc.tax.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="text-lg bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                        Rs.&nbsp;{calc.total.toLocaleString()}
                      </span>
                    </div>
                    {/* Original vs new comparison */}
                    {hasChanges && (
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 text-xs text-muted-foreground flex justify-between">
                        <span>Original total</span>
                        <span className="line-through">Rs.&nbsp;{existingOrder.total.toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Removed items notice */}
                {(existingOrder.items ?? []).some(
                  (o) => !cart.find((c) => c.id === o.id && (c.isDeal ?? false) === (o.isDeal ?? false))
                ) && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="">Items removed</p>
                      <p className="opacity-80 mt-0.5">
                        {(existingOrder.items ?? [])
                          .filter(
                            (o) =>
                              !cart.find(
                                (c) =>
                                  c.id === o.id &&
                                  (c.isDeal ?? false) === (o.isDeal ?? false)
                              )
                          )
                          .map((o) => o.name)
                          .join(', ')}{' '}
                        will be removed from the order.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ════ STICKY BOTTOM ACTION BAR ════ */}
      <div className="sticky bottom-0 z-20 border-t bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 sm:px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
        {/* Summary strip */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            {calc.itemCount} item{calc.itemCount !== 1 ? 's' : ''}
            {hasChanges && (
              <span className="ml-2 text-amber-600 font-medium">· modified</span>
            )}
          </span>
          <span className="text-lg bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
            Rs.&nbsp;{calc.total.toLocaleString()}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-none h-11 px-4 border-2 border-slate-300"
            onClick={() => router.push('/portal/tables')}
            disabled={isSubmitting || isSuccess}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>

          <Button
            className={cn(
              'flex-1 h-11 text-sm text-white shadow-lg border-0',
              isSuccess
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-red-700 via-red-600 to-orange-500 hover:from-red-800 hover:via-red-700 hover:to-orange-600 shadow-red-600/25'
            )}
            onClick={handleUpdateOrder}
            disabled={cart.length === 0 || isSubmitting || isSuccess || !hasChanges}
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Updated!
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating…
              </>
            ) : !hasChanges ? (
              <>
                <Package className="h-4 w-4 mr-2" />
                No changes
              </>
            ) : (
              <>
                <ChefHat className="h-4 w-4 mr-2" />
                Update Order · Rs.&nbsp;{calc.total.toLocaleString()}
              </>
            )}
          </Button>
        </div>

        {hasChanges && !isSuccess && (
          <p className="text-center text-[11px] text-muted-foreground">
            Kitchen will be notified of the updated order
          </p>
        )}
      </div>
    </div>
  );
}
