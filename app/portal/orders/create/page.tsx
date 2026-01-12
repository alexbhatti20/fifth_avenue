'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  ArrowLeft,
  Search,
  User,
  UserCircle,
  Phone,
  Crown,
  Star,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CheckCircle,
  Loader2,
  Utensils,
  X,
  ShoppingCart,
  Tag,
  MapPin,
  Mail,
  Gift,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePortalAuth } from '@/hooks/usePortal';

const supabase = createClient();

const ALLOWED_ROLES = ['admin', 'manager', 'waiter', 'reception', 'billing_staff'];

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  variants?: { name: string; price: number }[];
}

interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  variant?: string;
  variantPrice?: number;
  notes?: string;
}

interface RegisteredCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  loyalty_points: number;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  total_orders: number;
  total_spent: number;
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

const LOYALTY_TIER_CONFIG = {
  bronze: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Bronze' },
  silver: { color: 'text-gray-600', bg: 'bg-gray-200', label: 'Silver' },
  gold: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Gold' },
  platinum: { color: 'text-purple-600', bg: 'bg-purple-100', label: 'Platinum' },
};

export default function CreateOrderPage() {
  const router = useRouter();
  const { employee, isLoading: isAuthLoading } = usePortalAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Customer State
  const [customerType, setCustomerType] = useState<'walk-in' | 'registered'>('walk-in');
  const [walkInName, setWalkInName] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [registeredCustomer, setRegisteredCustomer] = useState<RegisteredCustomer | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<RegisteredCustomer[]>([]);
  
  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Order State
  const [orderType, setOrderType] = useState<'walk-in' | 'dine-in'>('walk-in');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tables, setTables] = useState<Table[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Success Dialog
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string>('');

  // Check authorization
  useEffect(() => {
    if (!isAuthLoading && employee) {
      const hasAccess = ALLOWED_ROLES.includes(employee.role || '');
      setIsAuthorized(hasAccess);
      if (!hasAccess) {
        toast.error('Access denied');
        router.push('/portal/orders');
      }
    }
  }, [employee, isAuthLoading, router]);

  // Fetch ALL data using optimized RPC (menu, tables, categories)
  useEffect(() => {
    const fetchOrderCreationData = async () => {
      setIsLoadingMenu(true);
      try {
        // Use optimized RPC that gets everything in one call
        const { data, error } = await supabase.rpc('get_order_creation_data');
        
        if (error) {
          console.error('RPC error:', error);
          toast.error('Failed to load menu data');
          return;
        }
        
        if (data?.success) {
          // Map items to component format
          const itemsWithCategory = (data.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category_name || 'Uncategorized',
            image_url: item.image_url,
            is_available: item.status === 'available',
            variants: item.variants,
          }));
          
          setMenuItems(itemsWithCategory);
          
          // Get categories from RPC response
          const categoryNames = (data.categories || []).map((cat: any) => cat.name);
          setCategories(categoryNames);
          
          // Set tables from same RPC call
          setTables((data.tables || []).map((t: any) => ({
            id: t.id,
            table_number: t.table_number,
            capacity: t.capacity,
            status: t.status,
          })));
          
          console.log('Loaded:', itemsWithCategory.length, 'items,', categoryNames.length, 'categories,', (data.tables || []).length, 'tables');
        } else {
          toast.error(data?.error || 'Failed to load menu data');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load menu data');
      } finally {
        setIsLoadingMenu(false);
      }
    };
    
    if (isAuthorized) {
      fetchOrderCreationData();
    }
  }, [isAuthorized]);

  // Search registered customer using optimized RPC
  const searchCustomer = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setCustomerSearchResults([]);
      return;
    }
    
    setIsSearchingCustomer(true);
    try {
      // Use optimized RPC for customer search
      const { data, error } = await supabase.rpc('search_customer_for_order', {
        p_search: searchTerm
      });
      
      if (error) {
        console.error('Customer search error:', error);
        setCustomerSearchResults([]);
        return;
      }
      
      if (data?.success) {
        const results = (data.customers || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          loyalty_points: c.loyalty_points || 0,
          loyalty_tier: c.loyalty_tier || 'bronze',
          total_orders: c.total_orders || 0,
          total_spent: 0,
        }));
        setCustomerSearchResults(results);
      } else {
        setCustomerSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      setCustomerSearchResults([]);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phoneSearch && customerType === 'registered') {
        searchCustomer(phoneSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [phoneSearch, customerType]);

  // Select registered customer
  const selectCustomer = (customer: RegisteredCustomer) => {
    setRegisteredCustomer(customer);
    setCustomerSearchResults([]);
    setPhoneSearch('');
  };

  // Filter menu items
  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = !menuSearch || 
        item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.description?.toLowerCase().includes(menuSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, menuSearch]);

  // Cart functions
  const addToCart = (item: MenuItem, variant?: string, variantPrice?: number) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(
        c => c.menuItem.id === item.id && c.variant === variant
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      
      return [...prev, {
        id: `${item.id}-${variant || 'default'}-${Date.now()}`,
        menuItem: item,
        quantity: 1,
        variant,
        variantPrice,
      }];
    });
  };

  const updateCartQuantity = (cartId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartId));
  };

  // Calculate totals
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.variantPrice || item.menuItem.price;
      return sum + (price * item.quantity);
    }, 0);
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Submit order using optimized RPC
  const handleSubmitOrder = async () => {
    // Validation
    if (cart.length === 0) {
      toast.error('Please add items to the cart');
      return;
    }
    
    if (customerType === 'walk-in' && !walkInName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (customerType === 'registered' && !registeredCustomer) {
      toast.error('Please select a registered customer');
      return;
    }
    
    if (orderType === 'dine-in' && !selectedTable) {
      toast.error('Please select a table');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare order items for RPC
      const orderItems = cart.map(item => ({
        menu_item_id: item.menuItem.id,
        name: item.menuItem.name,
        price: item.variantPrice || item.menuItem.price,
        quantity: item.quantity,
        variant: item.variant || null,
        notes: item.notes || null,
      }));

      // Prepare order data for RPC
      const orderData = {
        customer_type: customerType,
        customer_name: customerType === 'registered' ? registeredCustomer?.name : walkInName,
        customer_phone: customerType === 'registered' ? registeredCustomer?.phone : null,
        customer_email: customerType === 'registered' ? registeredCustomer?.email : null,
        customer_id: customerType === 'registered' ? registeredCustomer?.id : null,
        table_id: orderType === 'dine-in' ? selectedTable : null,
        order_type: orderType,
        items: orderItems,
        notes: orderNotes || null,
        employee_id: employee?.id || null,
      };

      // Use optimized RPC to create order
      const { data, error } = await supabase.rpc('create_portal_order', {
        p_order_data: orderData
      });

      if (error) throw error;

      if (data?.success) {
        setCreatedOrderId(data.order_id);
        setCreatedOrderNumber(data.order_number);
        setShowSuccess(true);
        toast.success(`Order ${data.order_number} created! Total: Rs. ${data.total}`);
        
        if (data.loyalty_points_earned > 0 && customerType === 'registered') {
          toast.info(`${data.loyalty_points_earned} loyalty points earned!`);
        }
      } else {
        toast.error(data?.error || 'Failed to create order');
      }
      
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/portal/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 flex-shrink-0" />
            <span className="truncate">Create Walk-in Order</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">Create a new order for walk-in or dine-in customers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Menu Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Type & Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Customer & Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Order Type</Label>
                  <Select value={orderType} onValueChange={(v: 'walk-in' | 'dine-in') => setOrderType(v)}>
                    <SelectTrigger className="h-9 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk-in">Walk-in (Takeaway)</SelectItem>
                      <SelectItem value="dine-in">Dine-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {orderType === 'dine-in' && (
                  <div>
                    <Label className="text-xs sm:text-sm">Select Table</Label>
                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                      <SelectTrigger className="h-9 sm:h-10">
                        <SelectValue placeholder="Choose table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map(table => (
                          <SelectItem key={table.id} value={table.id}>
                            Table {table.table_number} ({table.capacity} seats) - {table.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Customer Type Tabs */}
              <Tabs value={customerType} onValueChange={(v) => setCustomerType(v as 'walk-in' | 'registered')}>
                <TabsList className="grid w-full grid-cols-2 h-auto">
                  <TabsTrigger value="walk-in" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Walk-in</span> Customer
                  </TabsTrigger>
                  <TabsTrigger value="registered" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
                    <Crown className="h-3 w-3 sm:h-4 sm:w-4" />
                    Registered <span className="hidden xs:inline">Customer</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="walk-in" className="mt-4">
                  <div>
                    <Label htmlFor="walkInName">Customer Name *</Label>
                    <Input
                      id="walkInName"
                      placeholder="Enter customer name for records"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This name will be used on the invoice and for records only
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="registered" className="mt-4 space-y-4">
                  {!registeredCustomer ? (
                    <>
                      <div>
                        <Label htmlFor="phoneSearch">Search by Phone or Name</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phoneSearch"
                            placeholder="Enter phone number or name..."
                            className="pl-9"
                            value={phoneSearch}
                            onChange={(e) => setPhoneSearch(e.target.value)}
                          />
                          {isSearchingCustomer && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </div>
                      
                      {/* Search Results */}
                      {customerSearchResults.length > 0 && (
                        <div className="border rounded-lg divide-y">
                          {customerSearchResults.map(customer => {
                            const tierConfig = LOYALTY_TIER_CONFIG[customer.loyalty_tier] || LOYALTY_TIER_CONFIG.bronze;
                            return (
                              <div
                                key={customer.id}
                                className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => selectCustomer(customer)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{customer.name}</span>
                                      <Badge className={cn('text-xs', tierConfig.bg, tierConfig.color)}>
                                        {tierConfig.label}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                                  </div>
                                  <div className="text-right text-sm">
                                    <div className="flex items-center gap-1 text-amber-600">
                                      <Star className="h-3 w-3" />
                                      {customer.loyalty_points} pts
                                    </div>
                                    <p className="text-muted-foreground">{customer.total_orders} orders</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {phoneSearch && customerSearchResults.length === 0 && !isSearchingCustomer && (
                        <p className="text-center text-muted-foreground py-4">
                          No customers found. Try a different search.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <UserCircle className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{registeredCustomer.name}</span>
                              <Badge className={cn('text-xs', LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].bg, LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].color)}>
                                <Crown className="h-3 w-3 mr-1" />
                                {LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {registeredCustomer.phone}
                              </span>
                              {registeredCustomer.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {registeredCustomer.email}
                                </span>
                              )}
                            </div>
                            {registeredCustomer.address && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {registeredCustomer.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRegisteredCustomer(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-amber-600">
                            {registeredCustomer.loyalty_points}
                          </p>
                          <p className="text-xs text-muted-foreground">Loyalty Points</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{registeredCustomer.total_orders}</p>
                          <p className="text-xs text-muted-foreground">Total Orders</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            Rs. {registeredCustomer.total_spent.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Spent</p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Menu Selection */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Menu Selection
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu..."
                    className="pl-9 h-9 sm:h-10"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap mb-4 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>

              {/* Menu Grid */}
              {isLoadingMenu ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pr-4">
                    {filteredMenu.map(item => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className="cursor-pointer hover:border-red-500/50 transition-all"
                          onClick={() => addToCart(item)}
                        >
                          <CardContent className="p-3">
                            {item.image_url && (
                              <div className="w-full h-20 rounded-lg bg-muted mb-2 overflow-hidden">
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <h4 className="font-medium text-sm truncate">{item.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                            <p className="text-red-600 font-bold mt-1">
                              Rs. {item.price.toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cart */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Order Cart
                </span>
                <Badge variant="secondary">{cartItemsCount} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Cart is empty</p>
                  <p className="text-xs">Click on menu items to add</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3 pr-4">
                    <AnimatePresence>
                      {cart.map(item => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.menuItem.name}
                            </p>
                            {item.variant && (
                              <p className="text-xs text-muted-foreground">{item.variant}</p>
                            )}
                            <p className="text-xs text-red-600">
                              Rs. {(item.variantPrice || item.menuItem.price).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}

              <Separator className="my-4" />

              {/* Order Notes */}
              <div className="mb-4">
                <Label htmlFor="orderNotes">Order Notes (Optional)</Label>
                <Textarea
                  id="orderNotes"
                  placeholder="Special instructions..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>Rs. {cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (5%)</span>
                  <span>Rs. {Math.round(cartTotal * 0.05).toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-red-600">
                    Rs. {Math.round(cartTotal * 1.05).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Customer Info on Registered */}
              {customerType === 'registered' && registeredCustomer && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Gift className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Customer will earn {Math.floor(Math.round(cartTotal * 1.05) / 100)} loyalty points
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <motion.div className="mt-4" whileTap={{ scale: 0.98 }}>
                <Button
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg text-lg font-semibold"
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting || cart.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-5 w-5 mr-2" />
                      Create Order
                    </>
                  )}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Order Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Order #{createdOrderNumber} has been created and sent to the kitchen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold">#{createdOrderNumber}</p>
              <p className="text-muted-foreground">Order Number</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                // Reset form
                setCart([]);
                setWalkInName('');
                setRegisteredCustomer(null);
                setOrderNotes('');
                setSelectedTable('');
              }}
            >
              Create Another Order
            </Button>
            <Button
              className="bg-gradient-to-r from-red-500 to-red-600"
              onClick={() => {
                if (createdOrderId) {
                  window.location.href = `/portal/billing/${createdOrderId}`;
                }
              }}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Generate Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
