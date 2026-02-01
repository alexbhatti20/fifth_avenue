'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  RefreshCw,
  User,
  Mail,
  ShoppingCart,
  CreditCard,
  Banknote,
  CheckCircle,
  Award,
  Package,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MenuItemCard } from './MenuItemCard';
import { CartItemRow } from './CartItemRow';
import type { WaiterTable, MenuItem, CartItem, Customer, MenuData } from './types';

const supabase = createClient();

// ==========================================
// TAKE ORDER DIALOG COMPONENT
// Full-featured order creation for waiters
// ==========================================

interface TakeOrderDialogProps {
  table: WaiterTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderComplete: () => void;
}

export function TakeOrderDialog({
  table,
  open,
  onOpenChange,
  onOrderComplete,
}: TakeOrderDialogProps) {
  const [menuData, setMenuData] = useState<MenuData>({
    categories: [],
    items: [],
    deals: [],
  });
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerCount, setCustomerCount] = useState(1);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch menu data
  useEffect(() => {
    if (open) {
      fetchMenu();
    }
  }, [open]);

  const fetchMenu = async () => {
    setIsLoadingMenu(true);
    try {
      const { data, error } = await supabase.rpc('get_menu_for_ordering');
      if (error) throw error;
      if (data?.success) {
        setMenuData({
          categories: data.categories || [],
          items: data.items || [],
          deals: data.deals || [],
        });
      }
    } catch (error) {
      // Fallback to direct queries
      const { data: items } = await supabase
        .from('menu_items')
        .select('*, categories(name)')
        .eq('status', 'available');
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('status', 'active');
      setMenuData({
        categories: categories || [],
        items: (items || []).map((i: any) => ({
          ...i,
          category_name: i.categories?.name,
        })),
        deals: [],
      });
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Customer lookup
  const lookupCustomer = async () => {
    if (!customerPhone && !customerEmail) return;

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.rpc('lookup_customer', {
        p_phone: customerPhone || null,
        p_email: customerEmail || null,
        p_name: customerName || null,
      });

      if (error) throw error;

      if (data?.found) {
        setFoundCustomer(data.customer);
        setCustomerName(data.customer.name || customerName);
        setCustomerEmail(data.customer.email || customerEmail);
        setCustomerPhone(data.customer.phone || customerPhone);
        toast.success(`Found registered customer: ${data.customer.name}`, {
          description: `Loyalty Points: ${data.customer.loyalty_points || 0}`,
        });
      } else {
        setFoundCustomer(null);
        toast.info('Customer not found in system');
      }
    } catch (error) {
      } finally {
      setIsLookingUp(false);
    }
  };

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    toast.success(`Added ${item.name}`, { duration: 1500 });
  };

  // Update cart item quantity
  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  // Remove from cart
  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  // Filter items
  const filteredItems = menuData.items.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch =
      !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

      const { data, error } = await supabase.rpc('create_waiter_dine_in_order', {
        p_table_id: table.id,
        p_items: items,
        p_customer_count: customerCount,
        p_customer_id: foundCustomer?.id || null,
        p_customer_name: customerName || null,
        p_customer_phone: customerPhone || null,
        p_customer_email: customerEmail || null,
        p_notes: notes || null,
        p_payment_method: paymentMethod,
        p_send_email: sendEmail && !!customerEmail,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create order');
      }

      toast.success(`Order #${data.order_number} created!`, {
        description: `Table ${table.table_number} - Rs. ${total.toLocaleString()}`,
        duration: 5000,
      });

      // Reset form
      setCart([]);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerEmail('');
      setFoundCustomer(null);
      setNotes('');
      onOpenChange(false);
      onOrderComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] sm:h-[90vh] p-0 overflow-hidden sm:max-h-[90vh]">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 p-4 sm:p-6 text-white">
          <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg sm:text-xl shrink-0">
              {table.table_number}
            </div>
            <div className="min-w-0">
              <span className="block truncate">Take Order - Table {table.table_number}</span>
              <p className="text-xs sm:text-sm font-normal opacity-90 mt-0.5 sm:mt-1">
                {table.capacity} seats • {table.section || 'Main Hall'}
              </p>
            </div>
          </DialogTitle>
        </div>

        {/* Mobile: Stacked Layout, Desktop: Side-by-side */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Menu Section */}
          <div className="flex-1 flex flex-col border-b sm:border-b-0 sm:border-r overflow-hidden min-h-0">
            {/* Search & Categories */}
            <div className="p-3 sm:p-4 border-b space-y-2 sm:space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 sm:h-9 text-base sm:text-sm"
                />
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-1.5 sm:gap-2 pb-2">
                  <Button
                    size="sm"
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      'h-8 px-3 text-xs shrink-0',
                      selectedCategory === 'all'
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : ''
                    )}
                  >
                    All
                  </Button>
                  {menuData.categories.map((cat) => (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'h-8 px-3 text-xs shrink-0',
                        selectedCategory === cat.id
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : ''
                      )}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Menu Items Grid */}
            <ScrollArea className="flex-1 p-3 sm:p-4 min-h-[200px] sm:min-h-0">
              {isLoadingMenu ? (
                <div className="flex items-center justify-center h-32 sm:h-40">
                  <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {filteredItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} onAdd={addToCart} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Order Summary Section - Collapsible on Mobile */}
          <div className="w-full sm:w-96 flex flex-col bg-zinc-50 dark:bg-zinc-900 min-h-0 flex-1 sm:flex-none">
            {/* Customer Info */}
            <div className="p-3 sm:p-4 border-b space-y-2 sm:space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                Customer Info (Optional)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Guests</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={customerCount}
                    onChange={(e) => setCustomerCount(Number(e.target.value))}
                    className="h-9 sm:h-8 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <div className="relative">
                    <Input
                      placeholder="03XX..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onBlur={lookupCustomer}
                      className="h-9 sm:h-8 pr-8 text-base sm:text-sm"
                    />
                    {isLookingUp && (
                      <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin" />
                    )}
                  </div>
                </div>
              </div>
              <Input
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-9 sm:h-8 text-base sm:text-sm"
              />
              <Input
                placeholder="Email (for receipt)"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                onBlur={lookupCustomer}
                className="h-9 sm:h-8 text-base sm:text-sm"
              />

              {/* Found Customer Badge */}
              {foundCustomer && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      Registered Customer
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <Award className="h-3 w-3 text-amber-500" />
                      {foundCustomer.loyalty_points || 0} points
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {foundCustomer.total_orders || 0} orders
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Cart Items */}
            <ScrollArea className="flex-1 p-3 sm:p-4 min-h-[120px]">
              <h3 className="font-semibold flex items-center gap-2 mb-2 sm:mb-3 text-sm">
                <ShoppingCart className="h-4 w-4" />
                Order Items ({cart.length})
              </h3>
              {cart.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs sm:text-sm">Click menu items to add</p>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  <AnimatePresence>
                    {cart.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onIncrease={() => updateQuantity(item.id, 1)}
                        onDecrease={() => updateQuantity(item.id, -1)}
                        onRemove={() => removeFromCart(item.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Notes */}
              <div className="mt-3 sm:mt-4">
                <Label className="text-xs">Order Notes</Label>
                <Textarea
                  placeholder="Special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-14 sm:h-16 text-sm"
                />
              </div>
            </ScrollArea>

            {/* Payment & Total - Fixed at bottom */}
            <div className="p-3 sm:p-4 border-t bg-white dark:bg-zinc-800 space-y-2 sm:space-y-3 shrink-0">
              {/* Payment Method */}
              <div className="flex gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className={cn(
                    'flex-1 h-9 sm:h-10 text-xs sm:text-sm',
                    paymentMethod === 'cash' &&
                      'bg-gradient-to-r from-green-500 to-emerald-500'
                  )}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote className="h-4 w-4 mr-1.5 sm:mr-2" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className={cn(
                    'flex-1 h-9 sm:h-10 text-xs sm:text-sm',
                    paymentMethod === 'card' &&
                      'bg-gradient-to-r from-blue-500 to-indigo-500'
                  )}
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="h-4 w-4 mr-1.5 sm:mr-2" />
                  Card
                </Button>
              </div>

              {/* Send Email Toggle */}
              {customerEmail && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Send receipt email
                  </Label>
                  <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (5%)</span>
                  <span>Rs. {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base sm:text-lg font-bold pt-1.5 sm:pt-2 border-t">
                  <span>Total</span>
                  <span className="text-red-600">Rs. {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full h-11 sm:h-12 text-sm sm:text-lg bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-700 hover:via-orange-600 hover:to-amber-600 text-white shadow-lg"
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                    Confirm • Rs. {total.toLocaleString()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
