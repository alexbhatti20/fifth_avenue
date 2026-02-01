// Types for Order Create Components

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  variants?: { name: string; price: number }[];
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  variant?: string;
  variantPrice?: number;
  notes?: string;
}

export interface RegisteredCustomer {
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

export interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';
}

export interface HeldOrder {
  id: string;
  timestamp: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  registeredCustomer: RegisteredCustomer | null;
  cart: CartItem[];
  orderType: 'walk-in' | 'dine-in';
  selectedTables: string[];
  orderNotes: string;
  cartTotal: number;
}

// Configs
export const TABLE_STATUS_CONFIG = {
  available: { 
    label: 'Available', 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50 border-emerald-200', 
    activeBg: 'bg-emerald-500',
    description: 'Ready for guests'
  },
  occupied: { 
    label: 'Occupied', 
    color: 'text-red-600', 
    bg: 'bg-red-50 border-red-200',
    activeBg: 'bg-red-500',
    description: 'Currently in use'
  },
  reserved: { 
    label: 'Reserved', 
    color: 'text-amber-600', 
    bg: 'bg-amber-50 border-amber-200',
    activeBg: 'bg-amber-500',
    description: 'Reserved for later'
  },
  cleaning: { 
    label: 'Cleaning', 
    color: 'text-blue-600', 
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-500',
    description: 'Being cleaned'
  },
  out_of_service: { 
    label: 'Out of Service', 
    color: 'text-gray-500', 
    bg: 'bg-gray-100 border-gray-300',
    activeBg: 'bg-gray-500',
    description: 'Not available'
  },
} as const;

export const LOYALTY_TIER_CONFIG = {
  bronze: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Bronze' },
  silver: { color: 'text-gray-600', bg: 'bg-gray-200', label: 'Silver' },
  gold: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Gold' },
  platinum: { color: 'text-purple-600', bg: 'bg-purple-100', label: 'Platinum' },
} as const;

export const ALLOWED_ROLES = ['admin', 'manager', 'waiter', 'reception', 'billing_staff'];
