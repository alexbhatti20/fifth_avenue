'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pause, Play, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { usePortalAuth } from '@/hooks/usePortal';
import type { OrderCreationDataServer } from '@/lib/server-queries';

// Components
import { CustomerSection } from './CustomerSection';
import { MenuSection } from './MenuSection';
import { CartSection } from './CartSection';
import { TableSelectorDialog } from './TableSelectorDialog';
import { HeldOrdersDialog } from './HeldOrdersDialog';
import { SuccessDialog } from './SuccessDialog';

// Types
import {
  MenuItem,
  CartItem,
  RegisteredCustomer,
  Table,
  HeldOrder,
  ALLOWED_ROLES,
  TABLE_STATUS_CONFIG,
} from './types';

const supabase = createClient();

interface OrderCreateClientProps {
  initialData?: OrderCreationDataServer | null;
}

export default function OrderCreateClient({ initialData }: OrderCreateClientProps) {
  const router = useRouter();
  const { employee, isLoading: isAuthLoading } = usePortalAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const hasFetchedRef = useRef(!!initialData);
  
  // Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [registeredCustomer, setRegisteredCustomer] = useState<RegisteredCustomer | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<RegisteredCustomer[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSearchTermRef = useRef<string>('');
  const searchCacheRef = useRef<Map<string, RegisteredCustomer[]>>(new Map());
  
  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (initialData?.items) {
      return initialData.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category_name || 'Uncategorized',
        image_url: item.image_url,
        is_available: item.is_available !== false,
        variants: item.variants,
      }));
    }
    return [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    if (initialData?.categories) {
      return initialData.categories.map((cat) => cat.name);
    }
    return [];
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [isLoadingMenu, setIsLoadingMenu] = useState(!initialData);
  
  // Tables State
  const [tables, setTables] = useState<Table[]>(() => {
    if (initialData?.tables) {
      return initialData.tables.map((t) => ({
        id: t.id,
        table_number: t.table_number,
        capacity: t.capacity,
        status: t.status as Table['status'],
      }));
    }
    return [];
  });
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [isRefreshingTables, setIsRefreshingTables] = useState(false);
  const [tableFilter, setTableFilter] = useState<'all' | 'available'>('all');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Order State
  const [orderType, setOrderType] = useState<'walk-in' | 'dine-in'>('walk-in');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dialogs State
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string>('');
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  
  // Track if draft has been loaded (prevents auto-save from overwriting on mount)
  const draftLoadedRef = useRef(false);

  // Load held orders and draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('zoiro_held_orders');
    if (saved) {
      try {
        setHeldOrders(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse held orders');
      }
    }
    
    // Load current draft order from localStorage (survives refresh)
    const draft = localStorage.getItem('zoiro_current_order_draft');
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        // Restore if there's any meaningful data (cart, customer info, or tables)
        const hasData = 
          (draftData.cart && draftData.cart.length > 0) ||
          draftData.customerName ||
          draftData.customerPhone ||
          (draftData.selectedTables && draftData.selectedTables.length > 0);
          
        if (hasData) {
          setCart(draftData.cart || []);
          setCustomerName(draftData.customerName || '');
          setCustomerPhone(draftData.customerPhone || '');
          setCustomerEmail(draftData.customerEmail || '');
          setCustomerAddress(draftData.customerAddress || '');
          setRegisteredCustomer(draftData.registeredCustomer || null);
          setOrderType(draftData.orderType || 'walk-in');
          setSelectedTables(draftData.selectedTables || []);
          setOrderNotes(draftData.orderNotes || '');
          toast.info('Draft order restored', { 
            description: `Customer: ${draftData.customerName || 'Walk-in'}, Items: ${draftData.cart?.length || 0}` 
          });
        }
      } catch (e) {
        console.error('Failed to parse draft order');
      }
    }
    
    // Mark draft as loaded - allow auto-save after a small delay
    setTimeout(() => {
      draftLoadedRef.current = true;
    }, 100);
  }, []);

  // Auto-save current order to localStorage (survives refresh)
  useEffect(() => {
    // Skip auto-save until draft has been loaded (prevents overwriting on mount)
    if (!draftLoadedRef.current) return;
    
    // Save if there's any meaningful data
    const hasData = cart.length > 0 || customerName || customerPhone || selectedTables.length > 0;
    
    if (hasData) {
      const draftData = {
        cart,
        customerName,
        customerPhone,
        customerEmail,
        customerAddress,
        registeredCustomer,
        orderType,
        selectedTables,
        orderNotes,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('zoiro_current_order_draft', JSON.stringify(draftData));
    } else {
      // Clear draft if all data is removed
      localStorage.removeItem('zoiro_current_order_draft');
    }
  }, [cart, customerName, customerPhone, customerEmail, customerAddress, registeredCustomer, orderType, selectedTables, orderNotes]);

  // Clear draft when order is submitted or cleared
  const clearDraft = () => {
    localStorage.removeItem('zoiro_current_order_draft');
  };

  // Save held orders to localStorage
  const saveHeldOrdersToStorage = (orders: HeldOrder[]) => {
    localStorage.setItem('zoiro_held_orders', JSON.stringify(orders));
    setHeldOrders(orders);
  };

  // Calculate cart total
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.variantPrice || item.menuItem.price;
    return sum + (price * item.quantity);
  }, 0);

  // Clear all fields
  const clearAllFields = () => {
    clearCustomer();
    setCart([]);
    setOrderType('walk-in');
    setSelectedTables([]);
    setOrderNotes('');
    setMenuSearch('');
    setSelectedCategory('all');
    clearDraft(); // Clear saved draft
  };

  // Clear customer
  const clearCustomer = () => {
    setRegisteredCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setIsNewCustomer(false);
    setCustomerSearchResults([]);
    setShowSearchResults(false);
  };

  // Hold current order
  const holdCurrentOrder = () => {
    if (cart.length === 0) {
      toast.error('Add items to cart before holding');
      return;
    }

    const heldOrder: HeldOrder = {
      id: `held-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      registeredCustomer,
      cart,
      orderType,
      selectedTables,
      orderNotes,
      cartTotal,
    };

    const updatedHeldOrders = [...heldOrders, heldOrder];
    saveHeldOrdersToStorage(updatedHeldOrders);
    toast.success('Order held successfully!', {
      description: `${cart.length} items saved. You can restore it anytime.`,
    });
    clearAllFields();
  };

  // Restore a held order
  const restoreHeldOrder = (heldOrder: HeldOrder) => {
    setCustomerName(heldOrder.customerName || '');
    setCustomerPhone(heldOrder.customerPhone || '');
    setCustomerEmail(heldOrder.customerEmail || '');
    setCustomerAddress(heldOrder.customerAddress || '');
    setRegisteredCustomer(heldOrder.registeredCustomer || null);
    setCart(heldOrder.cart || []);
    setOrderType(heldOrder.orderType || 'walk-in');
    setSelectedTables(heldOrder.selectedTables || []);
    setOrderNotes(heldOrder.orderNotes || '');

    const updatedHeldOrders = heldOrders.filter(o => o.id !== heldOrder.id);
    saveHeldOrdersToStorage(updatedHeldOrders);
    setShowHeldOrders(false);

    toast.success('Order restored!', {
      description: `${heldOrder.cart?.length || 0} items loaded.`,
    });
  };

  // Delete a held order
  const deleteHeldOrder = (orderId: string) => {
    const updatedHeldOrders = heldOrders.filter(o => o.id !== orderId);
    saveHeldOrdersToStorage(updatedHeldOrders);
    toast.info('Held order deleted');
  };

  // Handle clear all
  const handleClearAll = () => {
    if (cart.length === 0 && !customerName) {
      toast.info('Nothing to clear');
      return;
    }
    clearAllFields();
    toast.success('Order cleared');
  };

  // Refresh tables
  const refreshTables = async () => {
    setIsRefreshingTables(true);
    try {
      const { data, error } = await supabase.rpc('get_order_creation_data');
      if (error) throw error;
      
      if (data?.tables) {
        setTables(data.tables.map((t: any) => ({
          id: t.id,
          table_number: t.table_number,
          capacity: t.capacity,
          status: t.status as Table['status'],
        })));
      }
    } catch (error) {
      console.error('Failed to refresh tables:', error);
    } finally {
      setIsRefreshingTables(false);
    }
  };

  // Handle table selection
  const handleSelectTable = (table: Table) => {
    setSelectedTables(prev => {
      if (prev.includes(table.id)) {
        toast.info(`Table ${table.table_number} removed`);
        return prev.filter(id => id !== table.id);
      } else {
        toast.success(`Table ${table.table_number} added`);
        return [...prev, table.id];
      }
    });
  };

  // Remove single table
  const removeTable = (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    setSelectedTables(prev => prev.filter(id => id !== tableId));
    if (table) {
      toast.info(`Table ${table.table_number} removed`);
    }
  };

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

  // Fetch data if SSR data not provided
  useEffect(() => {
    if (hasFetchedRef.current || !isAuthorized) return;

    const fetchOrderCreationData = async () => {
      setIsLoadingMenu(true);
      try {
        const { data, error } = await supabase.rpc('get_order_creation_data');
        
        if (error) {
          toast.error('Failed to load menu data');
          return;
        }
        
        if (data?.success) {
          const itemsWithCategory = (data.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category_name || 'Uncategorized',
            image_url: item.image_url,
            is_available: item.is_available !== false,
            variants: item.variants,
          }));
          
          setMenuItems(itemsWithCategory);
          setCategories((data.categories || []).map((cat: any) => cat.name));
          setTables((data.tables || []).map((t: any) => ({
            id: t.id,
            table_number: t.table_number,
            capacity: t.capacity,
            status: t.status,
          })));
          
          hasFetchedRef.current = true;
        } else {
          toast.error(data?.error || 'Failed to load menu data');
        }
      } catch (error) {
        toast.error('Failed to load menu data');
      } finally {
        setIsLoadingMenu(false);
      }
    };
    
    fetchOrderCreationData();
  }, [isAuthorized]);

  // Customer search
  const searchCustomer = async (searchTerm: string) => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    
    if (trimmedSearch.length < 3) {
      setCustomerSearchResults([]);
      setShowSearchResults(false);
      setIsSearchingCustomer(false);
      return;
    }
    
    if (trimmedSearch === lastSearchTermRef.current) return;
    
    if (searchCacheRef.current.has(trimmedSearch)) {
      const cachedResults = searchCacheRef.current.get(trimmedSearch)!;
      setCustomerSearchResults(cachedResults);
      setShowSearchResults(true);
      setIsNewCustomer(cachedResults.length === 0);
      lastSearchTermRef.current = trimmedSearch;
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsSearchingCustomer(true);
    setShowSearchResults(true);
    
    try {
      const { data, error } = await supabase.rpc('search_customer_for_order', {
        p_search: trimmedSearch
      });
      
      if (abortControllerRef.current?.signal.aborted) return;
      
      if (error) {
        setCustomerSearchResults([]);
        setIsNewCustomer(true);
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
        
        if (searchCacheRef.current.size > 50) {
          const firstKey = searchCacheRef.current.keys().next().value;
          if (firstKey) searchCacheRef.current.delete(firstKey);
        }
        searchCacheRef.current.set(trimmedSearch, results);
        lastSearchTermRef.current = trimmedSearch;
        
        setCustomerSearchResults(results);
        setIsNewCustomer(results.length === 0);
      } else {
        setCustomerSearchResults([]);
        setIsNewCustomer(true);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setCustomerSearchResults([]);
        setIsNewCustomer(true);
      }
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Instant search on Enter
  const handleInstantSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    const searchValue = customerPhone || customerName || customerEmail;
    if (searchValue && searchValue.length >= 2) {
      searchCustomer(searchValue);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInstantSearch();
    }
  };

  // Debounced customer search
  const handleCustomerSearch = (value: string, field: 'name' | 'phone' | 'email') => {
    if (field === 'name') setCustomerName(value);
    if (field === 'phone') setCustomerPhone(value);
    if (field === 'email') setCustomerEmail(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    const allEmpty = field === 'name' ? !value && !customerPhone && !customerEmail :
                     field === 'phone' ? !customerName && !value && !customerEmail :
                     !customerName && !customerPhone && !value;
    
    if (allEmpty) {
      setRegisteredCustomer(null);
      setIsNewCustomer(false);
      setCustomerSearchResults([]);
      setShowSearchResults(false);
      lastSearchTermRef.current = '';
      return;
    }
    
    if (registeredCustomer) return;
    
    const searchValue = field === 'phone' ? value : 
                        field === 'name' ? value :
                        value || customerPhone || customerName;
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchValue && searchValue.length >= 3) {
        searchCustomer(searchValue);
      } else if (searchValue && searchValue.length < 3) {
        setCustomerSearchResults([]);
        setShowSearchResults(false);
        setIsNewCustomer(false);
      }
    }, 800);
  };

  // Select customer
  const selectCustomer = (customer: RegisteredCustomer) => {
    setRegisteredCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerEmail(customer.email || '');
    setCustomerAddress(customer.address || '');
    setCustomerSearchResults([]);
    setShowSearchResults(false);
    setIsNewCustomer(false);
  };

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = () => {
      if (showSearchResults) {
        setShowSearchResults(false);
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showSearchResults]);

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

  // Submit order
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to the cart');
      return;
    }
    
    if (!customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (orderType === 'dine-in' && selectedTables.length === 0) {
      toast.error('Please select at least one table for dine-in order');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderItems = cart.map(item => ({
        menu_item_id: item.menuItem.id,
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.variantPrice || item.menuItem.price,
        variant: item.variant || null,
        notes: item.notes || null,
        image_url: item.menuItem.image_url || null,
      }));

      const customerType = registeredCustomer ? 'registered' : 'walk-in';

      // Build order data as single JSON object for RPC
      // Includes all customer details for both registered and walk-in
      // Supports multi-table selection with table_ids array
      const orderData = {
        items: orderItems,
        customer_type: customerType,
        customer_id: registeredCustomer?.id || null,
        customer_name: registeredCustomer?.name || customerName.trim(),
        customer_phone: registeredCustomer?.phone || customerPhone.trim() || null,
        customer_email: registeredCustomer?.email || customerEmail.trim() || null,
        customer_address: registeredCustomer?.address || customerAddress.trim() || null,
        order_type: orderType,
        table_id: orderType === 'dine-in' && selectedTables.length > 0 ? selectedTables[0] : null,
        table_ids: orderType === 'dine-in' && selectedTables.length > 0 ? selectedTables : null,
        notes: orderNotes || null,
        employee_id: employee?.id || null,
      };

      const { data, error } = await supabase.rpc('create_portal_order', {
        p_order_data: orderData,
      });

      if (error) {
        console.error('Order creation error:', error);
        toast.error('Failed to create order: ' + (error.message || 'Unknown error'));
        return;
      }

      if (data?.success) {
        setCreatedOrderId(data.order_id);
        setCreatedOrderNumber(data.order_number);
        setShowSuccess(true);
        toast.success('Order created successfully!');
        clearDraft(); // Clear saved draft on success
        await refreshTables();
      } else {
        toast.error(data?.error || 'Failed to create order');
      }
    } catch (error) {
      toast.error('Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="pb-8">
      <SectionHeader
        title="Create Order"
        description="Create a new order for walk-in or registered customers"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {heldOrders.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowHeldOrders(true)}
                className="relative"
              >
                <Play className="h-4 w-4 mr-2" />
                Restore
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-white">
                  {heldOrders.length}
                </Badge>
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={holdCurrentOrder}
              disabled={cart.length === 0}
              className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
            >
              <Pause className="h-4 w-4 mr-2" />
              Hold
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            
            <Button variant="outline" onClick={() => router.push('/portal/orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left: Customer & Menu */}
        <div className="lg:col-span-2 space-y-6">
          <CustomerSection
            customerName={customerName}
            customerPhone={customerPhone}
            customerEmail={customerEmail}
            customerAddress={customerAddress}
            registeredCustomer={registeredCustomer}
            customerSearchResults={customerSearchResults}
            showSearchResults={showSearchResults}
            isSearchingCustomer={isSearchingCustomer}
            isNewCustomer={isNewCustomer}
            orderType={orderType}
            selectedTables={selectedTables}
            tables={tables}
            isRefreshingTables={isRefreshingTables}
            onCustomerSearch={handleCustomerSearch}
            onSearchKeyDown={handleSearchKeyDown}
            onSelectCustomer={selectCustomer}
            onClearCustomer={clearCustomer}
            onAddressChange={setCustomerAddress}
            onOrderTypeChange={setOrderType}
            onRemoveTable={removeTable}
            onClearTables={() => setSelectedTables([])}
            onRefreshTables={refreshTables}
            onOpenTableSelector={() => {
              refreshTables();
              setShowTableSelector(true);
            }}
          />

          <MenuSection
            menuItems={menuItems}
            categories={categories}
            selectedCategory={selectedCategory}
            menuSearch={menuSearch}
            isLoadingMenu={isLoadingMenu}
            onSearchChange={setMenuSearch}
            onCategoryChange={setSelectedCategory}
            onAddToCart={addToCart}
          />
        </div>

        {/* Right: Cart */}
        <div>
          <CartSection
            cart={cart}
            orderNotes={orderNotes}
            registeredCustomer={registeredCustomer}
            isSubmitting={isSubmitting}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeFromCart}
            onNotesChange={setOrderNotes}
            onSubmitOrder={handleSubmitOrder}
          />
        </div>
      </div>

      {/* Dialogs */}
      <SuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        orderNumber={createdOrderNumber}
        orderId={createdOrderId}
        orderType={orderType}
        onCreateAnother={() => {
          setShowSuccess(false);
          clearAllFields();
        }}
        onViewInKitchen={() => {
          router.push('/portal/kitchen');
        }}
        onViewOrders={() => {
          router.push('/portal/orders');
        }}
      />

      <HeldOrdersDialog
        open={showHeldOrders}
        onOpenChange={setShowHeldOrders}
        heldOrders={heldOrders}
        onRestore={restoreHeldOrder}
        onDelete={deleteHeldOrder}
      />

      <TableSelectorDialog
        open={showTableSelector}
        onOpenChange={setShowTableSelector}
        tables={tables}
        selectedTables={selectedTables}
        tableFilter={tableFilter}
        isRefreshingTables={isRefreshingTables}
        onSelectTable={handleSelectTable}
        onFilterChange={setTableFilter}
        onRefresh={refreshTables}
        onConfirm={() => setShowTableSelector(false)}
      />
    </div>
  );
}
