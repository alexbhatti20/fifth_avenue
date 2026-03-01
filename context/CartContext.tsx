'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

// Size variant type
export interface SizeVariant {
  size: string;
  price: number;
  is_available: boolean;
}

// MenuItem type based on database schema and UI usage
export interface MenuItem {
  id: string;
  category_id?: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  originalPrice?: number;  // For displaying discounts
  image?: string;          // Single image URL
  images?: string[];       // Multiple images array
  is_available?: boolean;
  is_featured?: boolean;
  isPopular?: boolean;     // UI display flag
  isNew?: boolean;         // UI display flag
  preparation_time?: number;
  rating?: number;
  total_reviews?: number;
  tags?: string[];
  nutritional_info?: Record<string, unknown>;
  has_variants?: boolean;
  size_variants?: SizeVariant[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedSize?: string;
  selectedPrice?: number;
  cartItemId?: string;
}

export interface AppliedOffer {
  id: string;
  name: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  max_discount_amount?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: MenuItem, size?: string, price?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getCartItemId: (itemId: string, size?: string) => string;
  appliedOffer: AppliedOffer | null;
  applyOffer: (offer: AppliedOffer) => void;
  removeOffer: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'zoiro-cart';
const OFFER_STORAGE_KEY = 'zoiro-applied-offer';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Check if an ID is a valid UUID or a deal ID (deal-{uuid})
const isValidItemId = (id: string): boolean => {
  if (!id) return false;
  // Deal IDs are valid if they're in format "deal-{uuid}"
  if (id.startsWith('deal-')) {
    const dealId = id.replace('deal-', '');
    return UUID_REGEX.test(dealId);
  }
  // Regular item IDs must be UUIDs
  return UUID_REGEX.test(id);
};

// Generate unique cart item ID based on item ID and size
const generateCartItemId = (itemId: string, size?: string): string => {
  return size ? `${itemId}-${size.toLowerCase().replace(/\s+/g, '-')}` : itemId;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);

  // Load cart + applied offer from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        const validCart = parsedCart.filter((item: CartItem) => 
          typeof item.price === 'number' && 
          item.price > 0 && 
          !isNaN(item.price) &&
          isValidItemId(item.id)
        );
        if (validCart.length !== parsedCart.length) {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validCart));
        }
        setItems(validCart);
      }
      const savedOffer = localStorage.getItem(OFFER_STORAGE_KEY);
      if (savedOffer) setAppliedOffer(JSON.parse(savedOffer));
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(OFFER_STORAGE_KEY);
    }
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Failed to save cart - non-critical
      }
    }
  }, [items, isHydrated]);

  const getCartItemId = useCallback((itemId: string, size?: string): string => {
    return generateCartItemId(itemId, size);
  }, []);

  const addToCart = useCallback((item: MenuItem, size?: string, price?: number) => {
    const cartItemId = generateCartItemId(item.id, size);
    const itemPrice = price ?? item.price;
    
    // Validate price is a positive number
    if (typeof itemPrice !== 'number' || itemPrice <= 0 || isNaN(itemPrice)) {
      return; // Don't add items with invalid prices
    }

    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.cartItemId === cartItemId);
      if (existingItem) {
        return prevItems.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevItems, { 
        ...item, 
        quantity: 1, 
        selectedSize: size,
        selectedPrice: itemPrice,
        price: itemPrice,
        cartItemId 
      }];
    });
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setItems((prevItems) => prevItems.filter((i) => (i.cartItemId || i.id) !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prevItems) => prevItems.filter((i) => (i.cartItemId || i.id) !== cartItemId));
      return;
    }
    setItems((prevItems) =>
      prevItems.map((i) => ((i.cartItemId || i.id) === cartItemId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const applyOffer = useCallback((offer: AppliedOffer) => {
    setAppliedOffer(offer);
    try { localStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(offer)); } catch {}
  }, []);

  const removeOffer = useCallback(() => {
    setAppliedOffer(null);
    try { localStorage.removeItem(OFFER_STORAGE_KEY); } catch {}
  }, []);

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, item) => {
    const price = item.selectedPrice || item.price;
    const validPrice = typeof price === 'number' && !isNaN(price) ? price : 0;
    return sum + validPrice * item.quantity;
  }, 0), [items]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    getCartItemId,
    appliedOffer,
    applyOffer,
    removeOffer,
  }), [items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice, getCartItemId, appliedOffer, applyOffer, removeOffer]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
