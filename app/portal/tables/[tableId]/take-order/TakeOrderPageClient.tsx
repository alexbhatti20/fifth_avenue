'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  ShoppingCart,
  CheckCircle,
  Award,
  Package,
  Phone,
  Users,
  Tag,
  Sparkles,
  Clock,
  Gift,
  Ticket,
  X,
  Plus,
  Minus,
  Utensils,
  Flame,
  Loader2,
  BadgeCheck,
  Crown,
  Zap,
  ArrowLeft,
  Receipt,
  Mail,
  ChefHat,
  Info,
  CheckCircle2,
  Trash2,
  Bell,
  ArrowRight,
  UtensilsCrossed,
  ReceiptText,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getCustomerFullDetailsAction,
  createWaiterDineInOrderAction,
  getCustomerOrderHistoryAction,
  type CustomerFullDetails,
  type CustomerPromoCode,
  type CustomerOrderSummary,
} from '@/lib/actions';
import type { WaiterTable, CartItem } from '@/components/portal/tables/types';
import type { MenuDataForSSR } from '@/lib/server-queries';

// =============================================
// TAKE ORDER FULL PAGE CLIENT
// Full-page replacement for TakeOrderDialogAdvanced
// Menu pre-rendered via SSR — no initial spinner
// Customer auto-lookup + walk-in fallback
// Waiter-specific order stored in history
// =============================================

interface Props {
  table: WaiterTable;
  initialMenuData: MenuDataForSSR;
}

// Cart localStorage key is table-scoped so multiple tabs don't conflict
const getCartKey = (tableId: string) => `zoiro_cart_${tableId}`;

const TIER_COLORS = {
  bronze: 'from-amber-600 to-orange-700',
  silver: 'from-slate-400 to-zinc-500',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-slate-300 to-zinc-400',
  diamond: 'from-cyan-300 to-blue-400',
};

const TIER_ICONS: Record<string, React.ElementType> = {
  bronze: Award,
  silver: Award,
  gold: Crown,
  platinum: Crown,
  diamond: Sparkles,
};

const STATUS_PILL: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  occupied: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  reserved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  cleaning: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  out_of_service: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

// ─── Customer Order Card ─────────────────────────────────────────────────────
const ORDER_STATUS_STYLE: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  preparing:  'bg-blue-100 text-blue-700',
  ready:      'bg-teal-100 text-teal-700',
  delivered:  'bg-emerald-100 text-emerald-700',
  completed:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-red-100 text-red-600',
  billed:     'bg-purple-100 text-purple-700',
};

function CustomerOrderCard({ order }: { order: CustomerOrderSummary }) {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isPaid = order.payment_status === 'paid' || order.payment_status === 'completed';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">#{order.order_number}</span>
          {order.table_number && (
            <span className="text-[10px] text-muted-foreground">· Table {order.table_number}</span>
          )}
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full capitalize font-medium',
            ORDER_STATUS_STYLE[order.status] ?? 'bg-slate-100 text-slate-600'
          )}>
            {order.status}
          </span>
          {isPaid && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Paid</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">{dateStr}</p>
          <p className="text-[10px] text-muted-foreground">{timeStr}</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-0.5">
        {(order.items as { name: string; price: number; quantity: number }[]).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200 mr-1">{item.quantity}×</span>
              {item.name}
            </span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">Rs.&nbsp;{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground space-x-2">
          {order.discount > 0 && <span className="text-emerald-600">-Rs.{order.discount.toLocaleString()} off</span>}
          <span>Tax Rs.{order.tax.toLocaleString()}</span>
          <span className="capitalize">{order.payment_method.replace(/_/g, ' ')}</span>
        </div>
        <span className="font-black text-sm bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
          Rs.&nbsp;{order.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function TakeOrderPageClient({
  table,
  initialMenuData,
}: Props) {
  const router = useRouter();

  // ── Menu state (pre-populated from SSR props, never null) ───────────
  const menuData = initialMenuData;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('menu');

  // ── Cart ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<CustomerPromoCode | null>(null);

  // ── Customer ────────────────────────────────────────────────────────
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCount, setCustomerCount] = useState(1);
  const [customer, setCustomer] = useState<CustomerFullDetails | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearched, setCustomerSearched] = useState(false);
  const [lookupInput, setLookupInput] = useState(''); // phone OR name typed by waiter

  // ── Order ───────────────────────────────────────────────────────────
  const [sendEmail, setSendEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // activeOrder: set after a successful "Send to Kitchen" — waiter can still add more items
  const [activeOrder, setActiveOrder] = useState<{ id: string; order_number: string } | null>(null);

  // ── Customer order history (loaded when a registered customer is detected) ──
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [isLoadingCustomerHistory, setIsLoadingCustomerHistory] = useState(false);

  // Fetch customer's past orders whenever a registered customer is detected
  useEffect(() => {
    if (!customer?.id) {
      setCustomerOrders([]);
      return;
    }
    let active = true;
    setIsLoadingCustomerHistory(true);
    getCustomerOrderHistoryAction(customer.id).then((res) => {
      if (active) {
        setCustomerOrders(res.success ? res.orders : []);
        setIsLoadingCustomerHistory(false);
        // Badge will show the count — do NOT auto-switch tab (payment decided at billing)
      }
    });
    return () => { active = false; };
  }, [customer?.id]);

  // ── LocalStorage: restore cart on mount, persist on change ──────────────────
  useEffect(() => {
    try {
      // Only restore a saved cart if this table is actively occupied by the
      // current waiter and has no completed order yet. If the table was released
      // or re-claimed by someone else, wipe the stale cart so the new session
      // starts clean.
      const tableIsActive = table.status === 'occupied' && table.is_my_table !== false;
      if (!tableIsActive) {
        localStorage.removeItem(getCartKey(table.id));
        return; // leave cart empty
      }
      const saved = localStorage.getItem(getCartKey(table.id));
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(getCartKey(table.id), JSON.stringify(cart));
      } else {
        localStorage.removeItem(getCartKey(table.id));
      }
    } catch {}
  }, [cart, table.id]);

  // Debounce ref for customer auto-lookup
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Customer auto-lookup ────────────────────────────────────────────
  // Phone (≥10 stripped digits): flexible format match against DB
  // Name (≥3 chars, no digits): ilike search for registered customer
  const searchCustomer = useCallback(async (
    query: string,
    mode: 'phone' | 'name'
  ) => {
    setIsSearchingCustomer(true);
    try {
      const params =
        mode === 'phone'
          ? { phone: query, email: null }
          : { name: query, email: null };
      const result = await getCustomerFullDetailsAction(params);
      if (result.success && result.found && result.customer) {
        setCustomer(result.customer);
        setCustomerName(result.customer.name || '');
        setCustomerEmail(result.customer.email || '');
        setCustomerPhone(result.customer.phone || query);
        setCustomerSearched(true);
        toast.success(`Found: ${result.customer.name}`, {
          description: `${result.customer.membership_tier ?? 'Member'} · ${result.customer.loyalty_points} pts · ${result.customer.promo_codes?.length || 0} promos`,
        });
      } else {
        setCustomer(null);
        if (mode === 'phone') setCustomerPhone(query);
        setCustomerSearched(true);
        toast.info('No registered member found — saving as walk-in');
      }
    } catch {
      setCustomer(null);
      setCustomerSearched(true);
    } finally {
      setIsSearchingCustomer(false);
    }
  }, []);

  const handleLookupChange = (value: string) => {
    setLookupInput(value);
    setCustomer(null);
    setCustomerSearched(false);

    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    const digitsOnly = value.replace(/[\s\-().+]/g, '');
    const looksLikePhone = digitsOnly.length >= 10 && /^\d+$/.test(digitsOnly);
    const looksLikeName = value.trim().length >= 3 && !/^\d/.test(value.trim());

    if (looksLikePhone) {
      // Debounce 700 ms — fire once user stops typing their number
      lookupTimer.current = setTimeout(
        () => searchCustomer(digitsOnly, 'phone'),
        700
      );
    } else if (looksLikeName) {
      // Debounce 900 ms for name — slightly longer to avoid mid-word queries
      setCustomerName(value);
      lookupTimer.current = setTimeout(
        () => searchCustomer(value.trim(), 'name'),
        900
      );
    } else {
      // Short partial input — just store as walk-in name, no server call
      setCustomerName(value);
    }
  };

  // ── Cart helpers ────────────────────────────────────────────────────
  const addToCart = useCallback(
    (item: { id: string; name: string; price: number }, isDeal = false) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.id === item.id && i.isDeal === isDeal);
        if (existing)
          return prev.map((i) =>
            i.id === item.id && i.isDeal === isDeal
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, isDeal }];
      });
      toast.success(`Added ${item.name}`, { duration: 900 });
    },
    []
  );

  const updateQty = useCallback((id: string, delta: number, isDeal?: boolean) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id && i.isDeal === isDeal
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((id: string, isDeal?: boolean) => {
    setCart((prev) => prev.filter((i) => !(i.id === id && i.isDeal === isDeal)));
  }, []);

  // ── Calculations ────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.promo_type === 'percentage') {
        discount = Math.round(subtotal * (appliedPromo.value / 100));
        if (appliedPromo.max_discount && discount > appliedPromo.max_discount)
          discount = appliedPromo.max_discount;
      } else {
        discount = Math.min(appliedPromo.value, subtotal);
      }
    }
    const afterDiscount = subtotal - discount;
    const tax = Math.round(afterDiscount * 0.05);
    const total = afterDiscount + tax;
    const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
    return { subtotal, discount, afterDiscount, tax, total, itemCount };
  }, [cart, appliedPromo]);

  // ── Menu filter ─────────────────────────────────────────────────────
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

  // ── Send to Kitchen: creates order, stays on page so waiter can add more ─
  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty — add items first');
      return;
    }
    setIsSubmitting(true);
    try {
      const guestName = customer?.name ?? (customerName.trim() || 'Walk-in Guest');
      const result = await createWaiterDineInOrderAction({
        table_id: table.id,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        customer_count: customerCount,
        customer_id: customer?.id ?? null,
        customer_name: guestName,
        customer_phone: customer?.phone ?? (customerPhone.trim() || null),
        customer_email: customer?.email ?? (customerEmail.trim() || null),
        notes: notes.trim() || null,
        payment_method: 'cash', // payment handled at billing
        send_email: sendEmail && !!(customer?.email || customerEmail.trim()),
      });

      if (!result.success) throw new Error(result.error || 'Failed to create order');

      setActiveOrder({ id: result.order_id ?? '', order_number: result.order_number ?? '' });
      setCart([]);
      setNotes('');
      setAppliedPromo(null);
      localStorage.removeItem(getCartKey(table.id));
      toast.success(`🍳 Order #${result.order_number} sent to kitchen!`, {
        description: `Table ${table.table_number} · Rs. ${calc.total.toLocaleString()} · ${guestName}`,
        duration: 5000,
      });
      setActiveTab('menu'); // jump back to menu so waiter can add more
    } catch (err: any) {
      toast.error(err.message || 'Failed to send to kitchen');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Send to Billing: navigate to tables page where billing is handled ─
  const handleSendToBilling = () => {
    router.push('/portal/tables');
    router.refresh();
  };

  const TierIcon = customer?.membership_tier
    ? TIER_ICONS[customer.membership_tier] ?? Award
    : Award;

  // ───────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col -mt-4 sm:-mt-6 -mx-4 sm:-mx-6 min-h-screen">
      {/* ── PAGE HEADER ── */}
      <header className="shrink-0 bg-gradient-to-r from-red-700 via-red-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between shadow-xl sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-9 w-9 shrink-0"
            onClick={() => router.push('/portal/tables')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-white/25 backdrop-blur flex items-center justify-center font-black text-xl shrink-0 shadow-inner border border-white/30">
            {table.table_number}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">
              Table {table.table_number}
              {activeOrder && (
                <span className="ml-2 text-[11px] font-semibold bg-white/25 rounded-full px-2 py-0.5">
                  #{activeOrder.order_number}
                </span>
              )}
            </h1>
            <p className="text-xs opacity-85 truncate">
              {table.capacity} seats · <span className="capitalize">{table.section || 'Main'}</span>
            </p>
          </div>
        </div>

        {/* Header cart pill */}
        <button
          onClick={() => setActiveTab('cart')}
          className="relative flex items-center gap-2 bg-white/20 hover:bg-white/35 active:bg-white/40 transition-all rounded-2xl px-3 py-2 border border-white/30 shadow-sm"
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          <div className="text-right leading-tight">
            <p className="text-[11px] font-bold">{calc.itemCount} items</p>
            <p className="text-[10px] opacity-85">Rs.&nbsp;{calc.total.toLocaleString()}</p>
          </div>
          {calc.itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-white text-red-600 rounded-full text-[10px] font-black flex items-center justify-center shadow-md ring-2 ring-red-500">
              {calc.itemCount}
            </span>
          )}
        </button>
      </header>

      {/* ── ACTIVE ORDER BANNER ── */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle className="h-4 w-4 shrink-0 fill-white/30" />
                <span className="text-sm font-semibold truncate">
                  Order #{activeOrder.order_number} sent to kitchen
                </span>
                <span className="text-xs opacity-75 shrink-0">· Add more items below</span>
              </div>
              <Button
                size="sm"
                onClick={handleSendToBilling}
                className="shrink-0 h-7 px-3 text-[11px] bg-white text-emerald-700 hover:bg-emerald-50 font-bold rounded-full shadow"
              >
                <ReceiptText className="h-3 w-3 mr-1" />
                Billing
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FLOATING CART FAB (visible when cart has items & not on cart tab) ── */}
      <AnimatePresence>
        {cart.length > 0 && activeTab !== 'cart' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setActiveTab('cart')}
            className="fixed bottom-36 right-4 z-50 flex items-center gap-2 bg-gradient-to-br from-red-600 via-red-500 to-orange-500 text-white rounded-2xl px-4 py-3 shadow-2xl shadow-red-500/40 border border-red-400/30"
          >
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <div className="text-left leading-tight">
              <p className="text-[11px] font-black">{calc.itemCount} items</p>
              <p className="text-[10px] opacity-85">Rs.&nbsp;{calc.total.toLocaleString()}</p>
            </div>
            <span className="absolute -top-2 -right-2 h-6 w-6 bg-white text-red-600 rounded-full text-xs font-black flex items-center justify-center shadow-lg ring-2 ring-red-500">
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
        <TabsList className={cn(
          'shrink-0 w-full rounded-none border-b bg-white dark:bg-slate-900 p-1 h-auto gap-1',
          customer ? 'grid grid-cols-5' : 'grid grid-cols-4'
        )}>
          <TabsTrigger
            value="menu"
            className="flex items-center justify-center gap-1.5 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 dark:data-[state=active]:bg-red-950/30 rounded-lg py-2.5 text-xs sm:text-sm font-medium"
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
          <TabsTrigger
            value="customer"
            className="flex items-center justify-center gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 dark:data-[state=active]:bg-blue-950/30 rounded-lg py-2.5 text-xs sm:text-sm font-medium"
          >
            <User className="h-4 w-4 shrink-0" />
            Guest
            {customer && (
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
            )}
          </TabsTrigger>
          {customer && (
          <TabsTrigger
            value="history"
            className="flex items-center justify-center gap-1.5 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-600 dark:data-[state=active]:bg-violet-950/30 rounded-lg py-2.5 text-xs sm:text-sm font-medium"
          >
            <Receipt className="h-4 w-4 shrink-0" />
            Orders
            {customerOrders.length > 0 && (
              <Badge className="h-4 px-1 text-[9px] bg-violet-100 text-violet-700 border-0">
                {customerOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          )}
        </TabsList>
        </div>{/* /max-w-5xl */}

        {/* ═══════════════════════════════════════╗
            MENU TAB                               ║
        ╚════════════════════════════════════════ */}
        <TabsContent
          value="menu"
          className="flex flex-col mt-0 data-[state=inactive]:hidden"
        >
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
                        'bg-red-500 hover:bg-red-600 border-red-500 text-white'
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
                        {/* Gradient top accent */}
                        <div className={cn(
                          'h-1 w-full bg-gradient-to-r from-red-500 to-orange-400 transition-opacity',
                          inCart ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                        )} />
                        {/* Cart qty overlay */}
                        {inCart && (
                          <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                            {inCart.quantity}
                          </div>
                        )}
                        <CardContent className="p-2.5 sm:p-3 pt-2">
                          <h4 className="font-medium text-xs sm:text-sm line-clamp-2 mb-2 leading-tight bg-gradient-to-r from-red-600 via-red-500 to-orange-400 bg-clip-text text-transparent">
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
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
          </div>{/* /max-w-5xl */}
          </TabsContent>

        {/* ═══════════════════════════════════════╗
            DEALS TAB                              ║
        ╚════════════════════════════════════════ */}
        <TabsContent
          value="deals"
          className="mt-0 data-[state=inactive]:hidden"
        >
          <div className="p-3">
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
                          <div className="flex items-center justify-between">
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px]">
                              <Flame className="h-3 w-3 mr-1" />
                              DEAL
                            </Badge>
                            {savePct > 0 && (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                {savePct}% OFF
                              </Badge>
                            )}
                            {inCart && (
                              <Badge className="bg-amber-500 border-0 text-white text-[10px]">
                                ×{inCart.quantity} in cart
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-sm mt-1 font-bold text-slate-800 dark:text-slate-100">{deal.name}</CardTitle>
                          {deal.description && (
                            <CardDescription className="text-xs line-clamp-2">
                              {deal.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0">
                          <div className="flex items-center justify-between">
                            <div>
                              {deal.original_price > deal.deal_price && (
                                <p className="text-xs text-muted-foreground line-through">
                                  Rs.&nbsp;{deal.original_price}
                                </p>
                              )}
                              <p className="text-base font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                                Rs.&nbsp;{deal.deal_price}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(
                                  {
                                    id: deal.id,
                                    name: deal.name,
                                    price: deal.deal_price,
                                  },
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

        {/* ═══════════════════════════════════════╗
            CART TAB                               ║
        ╚════════════════════════════════════════ */}
        <TabsContent
          value="cart"
          className="flex flex-col mt-0 data-[state=inactive]:hidden"
        >
          <div className="max-w-3xl mx-auto w-full">
          {/* Cart header with clear button */}
          {cart.length > 0 && (
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <h3 className="text-sm font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                {calc.itemCount} item{calc.itemCount !== 1 ? 's' : ''} in cart
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => {
                  setCart([]);
                  setAppliedPromo(null);
                  toast.info('Cart cleared');
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            </div>
          )}
          <div className="p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                <p className="font-medium">Cart is empty</p>
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
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      key={`${item.id}-${item.isDeal}`}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                    >
                      <Card
                        className={cn(
                          'overflow-hidden border-0 shadow-sm',
                          item.isDeal
                            ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 ring-1 ring-amber-200 dark:ring-amber-800'
                            : 'bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700'
                        )}
                      >
                        <CardContent className="p-2.5 flex items-center gap-2.5">
                          {/* Left gradient accent */}
                          <div className={cn(
                            'w-1 self-stretch rounded-full shrink-0',
                            item.isDeal
                              ? 'bg-gradient-to-b from-amber-400 to-orange-500'
                              : 'bg-gradient-to-b from-red-500 to-orange-400'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm truncate text-slate-800 dark:text-slate-100">
                                {item.name}
                              </p>
                              {item.isDeal && (
                                <Badge className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-400 text-white text-[9px] px-1.5 border-0">
                                  DEAL
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-400">
                              Rs.&nbsp;{item.price} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              className="h-7 w-7 rounded-full border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors"
                              onClick={() => updateQty(item.id, -1, item.isDeal)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center font-black text-sm text-slate-700 dark:text-slate-200">
                              {item.quantity}
                            </span>
                            <button
                              className="h-7 w-7 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
                              onClick={() => updateQty(item.id, 1, item.isDeal)}
                            >
                              <Plus className="h-3 w-3 text-white" />
                            </button>
                          </div>
                          <p className="font-black text-sm min-w-[60px] text-right bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                            Rs.&nbsp;{(item.price * item.quantity).toLocaleString()}
                          </p>
                          <button
                            className="h-7 w-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            onClick={() => removeFromCart(item.id, item.isDeal)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Notes */}
                <div className="pt-3">
                  <Label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Kitchen Notes</Label>
                  <Textarea
                    placeholder="Special instructions, allergies, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 h-20 resize-none bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
          </div>{/* /max-w-3xl */}

          {/* Cart summary footer */}
          {cart.length > 0 && (
            <div className="max-w-3xl mx-auto w-full shrink-0 border-t bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-3 sm:p-4 space-y-3">
              {appliedPromo && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 font-mono">{appliedPromo.code}</span>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      {appliedPromo.promo_type === 'percentage'
                        ? `${appliedPromo.value}% OFF`
                        : `Rs. ${appliedPromo.value} OFF`}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-emerald-600 hover:text-red-500"
                    onClick={() => { setAppliedPromo(null); toast.info('Promo removed'); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal ({calc.itemCount} items)</span>
                  <span>Rs.&nbsp;{calc.subtotal.toLocaleString()}</span>
                </div>
                {calc.discount > 0 && (
                  <div className="flex justify-between font-medium text-emerald-600">
                    <span>Promo discount</span>
                    <span>-Rs.&nbsp;{calc.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Tax (5%)</span>
                  <span>Rs.&nbsp;{calc.tax.toLocaleString()}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-black text-base">
                  <span>Total</span>
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
                    Rs.&nbsp;{calc.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════╗
            CUSTOMER / GUEST TAB                   ║
        ╚════════════════════════════════════════ */}
        <TabsContent
          value="customer"
          className="mt-0 data-[state=inactive]:hidden"
        >
          <div className="p-3 max-w-2xl mx-auto space-y-4">
            {/* ── Smart Lookup ── */}
            <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-700">
              <div className="h-1 w-full bg-gradient-to-r from-red-500 to-orange-400 rounded-t-xl" />
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-red-500" />
                  <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent font-bold">
                    Customer Lookup
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter phone number to auto-detect registered member. Type a name for walk-in. Leave blank for anonymous.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Phone number (auto-detect) or guest name…"
                    value={lookupInput}
                    onChange={(e) => handleLookupChange(e.target.value)}
                    className="pl-9 pr-10 bg-slate-50 dark:bg-slate-800 focus-visible:ring-red-400"
                  />
                  {isSearchingCustomer && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!isSearchingCustomer && lookupInput && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setLookupInput('');
                        setCustomer(null);
                        setCustomerName('');
                        setCustomerPhone('');
                        setCustomerSearched(false);
                      }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">Guest Count</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCustomerCount((c) => Math.max(1, c - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-bold">
                        {customerCount}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setCustomerCount((c) => Math.min(table.capacity, c + 1))
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        / {table.capacity} seats
                      </span>
                    </div>
                  </div>
                </div>

                {/* Walk-in state after search  */}
                {customerSearched && !customer && (
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Not a registered member</p>
                      <p className="text-xs text-muted-foreground">
                        Order will be saved as walk-in guest
                        {customerName.trim() ? ` — ${customerName}` : ''}.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Walk-in optional fields (only when no registered customer) */}
            {!customer && (
              <Card className="border-0 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Walk-in Details
                    <Badge variant="outline" className="text-[10px] ml-auto">Optional</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Optional — only needed for receipts / follow-up
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Customer name (optional)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input
                        placeholder="03XX-XXXXXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
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
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Registered Customer Card ── */}
            {customer && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-2 border-emerald-300 overflow-hidden">
                  <div
                    className={cn(
                      'p-4 text-white bg-gradient-to-r',
                      TIER_COLORS[
                        customer.membership_tier as keyof typeof TIER_COLORS
                      ] ?? TIER_COLORS.bronze
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <TierIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{customer.name}</h3>
                          <p className="text-sm opacity-90 capitalize">
                            {customer.membership_tier || 'Bronze'} Member
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-white/20 text-white border-0">
                        <BadgeCheck className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                        <Award className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
                        <p className="font-bold text-sm text-amber-700">
                          {customer.loyalty_points}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          Points
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <Package className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
                        <p className="font-bold text-sm text-blue-700">
                          {customer.total_orders}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          Orders
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                        <Zap className="h-4 w-4 mx-auto text-emerald-600 mb-0.5" />
                        <p className="font-bold text-sm text-emerald-700">
                          Rs.&nbsp;{Math.round(customer.avg_order_value || 0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          Avg
                        </p>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {customer.email}
                        </div>
                      )}
                    </div>

                    {/* Promo codes */}
                    {customer.promo_codes && customer.promo_codes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                          <Gift className="h-4 w-4 text-purple-500" />
                          Available Promos (
                          {customer.promo_codes.length})
                        </h4>
                        <div className="space-y-2">
                          {customer.promo_codes.map((promo) => (
                            <motion.div
                              key={promo.id}
                              whileHover={{ scale: 1.01 }}
                              onClick={() => {
                                if (appliedPromo?.id === promo.id) {
                                  setAppliedPromo(null);
                                  toast.info('Promo removed');
                                } else {
                                  setAppliedPromo(promo);
                                  toast.success(`Promo "${promo.code}" applied!`);
                                }
                              }}
                              className={cn(
                                'p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                                appliedPromo?.id === promo.id
                                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-purple-200 hover:border-purple-400 bg-purple-50/50 dark:bg-purple-950/20'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Ticket className="h-4 w-4 text-purple-500" />
                                  <span className="font-mono font-bold text-sm">
                                    {promo.code}
                                  </span>
                                </div>
                                <Badge
                                  variant={
                                    appliedPromo?.id === promo.id
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {promo.promo_type === 'percentage'
                                    ? `${promo.value}% OFF`
                                    : `Rs. ${promo.value} OFF`}
                                </Badge>
                              </div>
                              {promo.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {promo.name}
                                </p>
                              )}
                              {promo.expires_at && (
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires:{' '}
                                  {new Date(
                                    promo.expires_at
                                  ).toLocaleDateString()}
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
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════╗
            CUSTOMER ORDER HISTORY TAB              ║
            Only visible when a registered          ║
            customer is detected via lookup         ║
        ╚════════════════════════════════════════ */}
        {customer && (
        <TabsContent
          value="history"
          className="mt-0 data-[state=inactive]:hidden"
        >
          <div className="max-w-3xl mx-auto w-full p-3 space-y-3">
            {/* Customer recap */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shrink-0 shadow">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {customer.total_orders} orders · Rs.&nbsp;{Math.round(customer.total_spent ?? 0).toLocaleString()} lifetime · {customer.loyalty_points} pts
                </p>
              </div>
              <Badge className={cn(
                'shrink-0 capitalize border-0 text-white text-[10px]',
                TIER_COLORS[customer.membership_tier as keyof typeof TIER_COLORS]
                  ? 'bg-gradient-to-r ' + TIER_COLORS[customer.membership_tier as keyof typeof TIER_COLORS]
                  : 'bg-slate-500'
              )}>
                {customer.membership_tier}
              </Badge>
            </div>

            {/* Orders list */}
            {isLoadingCustomerHistory ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading order history…
              </div>
            ) : customerOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No previous orders</p>
                <p className="text-xs mt-1">This customer hasn't ordered before</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customerOrders.map((order) => (
                  <CustomerOrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* ════ STICKY BOTTOM ACTION BAR ════ */}
      <div className="sticky bottom-0 z-20 border-t bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 sm:px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
        {/* Customer + promo indicator */}
        <div className="flex items-center gap-2 text-xs min-w-0">
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium',
            customer
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          )}>
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[120px]">
              {customer
                ? customer.name
                : customerName.trim() || 'Walk-in Guest'}
            </span>
            {customerCount > 1 && <span className="opacity-70">· {customerCount}p</span>}
          </div>
          {appliedPromo && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[11px] font-medium">
              <Tag className="h-3 w-3" />
              {appliedPromo.code}
            </div>
          )}
          {(customer?.email || customerEmail.trim()) && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <Label className="text-[11px] text-muted-foreground cursor-pointer">
                <Mail className="h-3 w-3 inline mr-1" />
                Receipt
              </Label>
              <Switch
                checked={sendEmail}
                onCheckedChange={setSendEmail}
                className="scale-75"
              />
            </div>
          )}
        </div>

        {/* Total strip */}
        {cart.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">
              {calc.itemCount} item{calc.itemCount !== 1 ? 's' : ''}
              {calc.discount > 0 && <span className="ml-1 text-emerald-600">· -{calc.discount.toLocaleString()} saved</span>}
            </span>
            <span className="font-black text-lg bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
              Rs.&nbsp;{calc.total.toLocaleString()}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {activeOrder ? (
            <Button
              variant="outline"
              className="flex-1 h-11 font-semibold border-2 border-teal-400 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30"
              onClick={handleSendToBilling}
            >
              <ReceiptText className="h-4 w-4 mr-2" />
              Send to Billing
            </Button>
          ) : null}
          <Button
            className={cn(
              'h-11 text-sm font-bold bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-700 hover:via-red-600 hover:to-orange-600 shadow-lg shadow-red-500/25 border-0',
              activeOrder ? 'flex-1' : 'w-full'
            )}
            onClick={handleSendToKitchen}
            disabled={cart.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <ChefHat className="h-4 w-4 mr-2" />
                {activeOrder ? 'Add More to Kitchen' : 'Send to Kitchen'}
                {cart.length > 0 && !activeOrder && (
                  <span className="ml-2 opacity-80 text-xs font-normal">
                    · Rs.&nbsp;{calc.total.toLocaleString()}
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
        {activeOrder && (
          <p className="text-center text-[11px] text-muted-foreground">
            Order <span className="font-semibold text-emerald-600">#{activeOrder.order_number}</span> is active · you can add more items or send to billing
          </p>
        )}
      </div>
    </div>
  );
}
