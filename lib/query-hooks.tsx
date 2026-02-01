'use client';

// =============================================
// REACT QUERY HOOKS
// Pre-configured hooks for common portal data with deduplication
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Helper to make authenticated fetch requests
async function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const authToken = getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}

// =============================================
// QUERY KEYS
// Centralized query keys for cache management
// =============================================
export const queryKeys = {
  // Portal
  employee: ['employee'] as const,
  employees: ['employees'] as const,
  orders: (status?: string) => ['orders', status] as const,
  tables: ['tables'] as const,
  customers: ['customers'] as const,
  menu: ['menu'] as const,
  inventory: ['inventory'] as const,
  notifications: ['notifications'] as const,
  
  // Dashboard stats
  dashboardStats: ['dashboard', 'stats'] as const,
  
  // Settings
  paymentMethods: ['payment-methods'] as const,
  websiteSettings: ['website-settings'] as const,
};

// =============================================
// EMPLOYEE HOOKS
// =============================================

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  [key: string]: any;
}

// Use current employee (with initial data from SSR)
export function useEmployee(initialData?: Employee | null) {
  return useQuery({
    queryKey: queryKeys.employee,
    queryFn: async () => {
      const response = await authFetch<{ success: boolean; employee: Employee }>('/api/admin/employees/me');
      return response.employee;
    },
    initialData: initialData ?? undefined,
    enabled: false, // Don't auto-fetch, use SSR data
  });
}

// =============================================
// ORDERS HOOKS
// =============================================

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  items: any[];
  [key: string]: any;
}

// Use orders with optional status filter
export function useOrders<T = Order[]>(initialData?: T, status?: string) {
  return useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const response = await authFetch<{ success: boolean; orders: T }>(`/api/admin/orders${params}`);
      return response.orders;
    },
    initialData,
    staleTime: 30 * 1000, // Orders should refresh more frequently
  });
}

// =============================================
// TABLES HOOKS
// =============================================

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  [key: string]: any;
}

export function useTables(initialData?: Table[]) {
  return useQuery({
    queryKey: queryKeys.tables,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');
      
      if (error) throw error;
      return data as Table[];
    },
    initialData,
    staleTime: 60 * 1000,
  });
}

// =============================================
// CUSTOMERS HOOKS
// =============================================

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  [key: string]: any;
}

export function useCustomers(initialData?: Customer[]) {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: async () => {
      const response = await authFetch<{ success: boolean; customers: Customer[] }>('/api/admin/customers');
      return response.customers;
    },
    initialData,
    staleTime: 2 * 60 * 1000, // Customers don't change as frequently
  });
}

// =============================================
// PAYMENT METHODS HOOKS
// =============================================

interface PaymentMethod {
  id: string;
  method_type: string;
  method_name: string;
  account_number: string;
  is_active: boolean;
  [key: string]: any;
}

export function usePaymentMethods(initialData?: PaymentMethod[]) {
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: async () => {
      const response = await authFetch<{ success: boolean; methods: PaymentMethod[] }>('/api/admin/payment-methods');
      return response.methods;
    },
    initialData,
  });
}

// Mutation for updating payment methods
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<PaymentMethod> & { id: string }) => {
      return authFetch('/api/admin/payment-methods', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch payment methods
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods });
    },
  });
}

// =============================================
// CACHE UTILITIES
// =============================================

// Prefetch data for a route (can be called before navigation)
export function usePrefetch() {
  const queryClient = useQueryClient();
  
  return {
    prefetchOrders: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.orders(),
        queryFn: async () => {
          const response = await authFetch<{ success: boolean; orders: Order[] }>('/api/admin/orders');
          return response.orders;
        },
      });
    },
    prefetchCustomers: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.customers,
        queryFn: async () => {
          const response = await authFetch<{ success: boolean; customers: Customer[] }>('/api/admin/customers');
          return response.customers;
        },
      });
    },
  };
}

// Invalidate all portal data (e.g., on logout)
export function useInvalidateAll() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.clear();
  };
}
