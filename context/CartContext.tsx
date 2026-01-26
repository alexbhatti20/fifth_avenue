'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  selectedSize?: string;      // Selected size (e.g., "Small", "Large")
  selectedPrice?: number;     // Price for selected size
  cartItemId?: string;        // Unique ID for cart (id + size)
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'zoiro-cart';

// Generate unique cart item ID based on item ID and size
const generateCartItemId = (itemId: string, size?: string): string => {
  return size ? `${itemId}-${size.toLowerCase().replace(/\s+/g, '-')}` : itemId;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        // Validate cart items have valid prices
        const validCart = parsedCart.filter((item: CartItem) => 
          typeof item.price === 'number' && item.price > 0 && !isNaN(item.price)
        );
        setItems(validCart);
      }
    } catch {
      // Failed to load cart - start fresh
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

  const getCartItemId = (itemId: string, size?: string): string => {
    return generateCartItemId(itemId, size);
  };

  const addToCart = (item: MenuItem, size?: string, price?: number) => {
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
  };

  const removeFromCart = (cartItemId: string) => {
    setItems((prevItems) => prevItems.filter((i) => (i.cartItemId || i.id) !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((i) => ((i.cartItemId || i.id) === cartItemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    const price = item.selectedPrice || item.price;
    const validPrice = typeof price === 'number' && !isNaN(price) ? price : 0;
    return sum + validPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        getCartItemId,
      }}
    >
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
