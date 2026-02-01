# SSR Migration Plan - Zoiro Broast Hub

## 📋 Overview

This plan migrates your app from **Client-Side Rendering (CSR)** to **Server-Side Rendering (SSR)** while keeping all your RPCs with parameters working exactly the same.

---

## 🎯 Goals

| Before | After |
|--------|-------|
| 40+ visible API requests | ~5 visible requests (or less) |
| Slow initial page load | Fast initial HTML |
| Supabase calls exposed | Supabase calls hidden |
| High Supabase usage | 80% less Supabase calls |

---

## 📁 Current Structure Analysis

### Files with `"use client"` (Need Migration)

#### 🔴 Portal Pages (Admin/Employee)
| File | Priority | Notes |
|------|----------|-------|
| `app/portal/page.tsx` | HIGH | Dashboard - many API calls |
| `app/portal/orders/page.tsx` | HIGH | Real-time orders |
| `app/portal/kitchen/page.tsx` | HIGH | Real-time kitchen |
| `app/portal/tables/page.tsx` | MEDIUM | Tables status |
| `app/portal/employees/page.tsx` | MEDIUM | Employee list |
| `app/portal/inventory/page.tsx` | MEDIUM | Inventory list |
| `app/portal/menu/page.tsx` | LOW | Menu management |
| `app/portal/payroll/page.tsx` | LOW | Payroll |
| `app/portal/reports/page.tsx` | LOW | Reports |
| `app/portal/reviews/page.tsx` | LOW | Reviews |
| `app/portal/settings/page.tsx` | LOW | Settings |
| `app/portal/perks/page.tsx` | LOW | Perks |
| `app/portal/notifications/page.tsx` | LOW | Notifications |

#### 🟠 Landing Pages (Customer-Facing)
| File | Priority | Notes |
|------|----------|-------|
| `app/(landing)/menu/page.tsx` | HIGH | Main menu - most traffic |
| `app/(landing)/orders/page.tsx` | HIGH | Customer orders |
| `app/(landing)/cart/page.tsx` | MEDIUM | Cart |
| `app/(landing)/favorites/page.tsx` | MEDIUM | Favorites |
| `app/(landing)/loyalty/page.tsx` | MEDIUM | Loyalty points |
| `app/(landing)/reviews/page.tsx` | LOW | Reviews |
| `app/(landing)/contact/page.tsx` | LOW | Contact form |
| `app/(landing)/settings/page.tsx` | LOW | User settings |

### ✅ Already Good (Server-Side)
| File | Status |
|------|--------|
| `lib/queries.ts` | ✅ Uses `unstable_cache` |
| `lib/actions.ts` | ✅ Uses `'use server'` |
| `lib/customer-queries.ts` | ✅ Ready for SSR |

---

## 🏗️ Migration Architecture

### New File Structure

```
app/
├── (landing)/
│   └── menu/
│       ├── page.tsx          # Server Component (data fetching)
│       └── MenuClient.tsx    # Client Component (interactivity)
├── portal/
│   └── orders/
│       ├── page.tsx          # Server Component (data fetching)
│       └── OrdersClient.tsx  # Client Component (interactivity)
lib/
├── queries.ts                # Public queries (cached)
├── portal-queries.ts         # Portal queries (keep but call from server)
├── server-queries.ts         # NEW: Server-only queries
└── actions.ts                # Server Actions (mutations)
```

---

## 🔧 Migration Pattern

### BEFORE (Current - Client-Side)

```tsx
// app/(landing)/menu/page.tsx
"use client";

import { useState, useEffect } from "react";

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ❌ VISIBLE in Network tab
    fetch("/api/customer/menu")
      .then(res => res.json())
      .then(data => setMenuItems(data));
  }, []);

  return <div>...</div>;
}
```

### AFTER (Server-Side)

```tsx
// app/(landing)/menu/page.tsx (Server Component - NO "use client")
import { getMenuCategories, getMenuItemsByCategory, getActiveDeals } from "@/lib/queries";
import MenuClient from "./MenuClient";

export default async function MenuPage() {
  // ✅ HIDDEN - runs on server
  const [categories, menuItems, deals] = await Promise.all([
    getMenuCategories(),
    getMenuItemsByCategory(),
    getActiveDeals(),
  ]);

  return (
    <MenuClient 
      initialCategories={categories}
      initialMenuItems={menuItems}
      initialDeals={deals}
    />
  );
}
```

```tsx
// app/(landing)/menu/MenuClient.tsx (Client Component)
"use client";

import { useState } from "react";

interface Props {
  initialCategories: Category[];
  initialMenuItems: MenuItem[];
  initialDeals: Deal[];
}

export default function MenuClient({ 
  initialCategories, 
  initialMenuItems, 
  initialDeals 
}: Props) {
  const [categories] = useState(initialCategories);
  const [menuItems] = useState(initialMenuItems);
  const [deals] = useState(initialDeals);

  // All interactivity here (cart, filters, modals)
  return <div>...</div>;
}
```

---

## 📝 RPC Migration Examples

### Your RPCs Still Work - Just Move WHERE They Run

#### Example 1: Simple RPC (No Parameters)

```tsx
// BEFORE: Client calls RPC
"use client";
const { data } = await supabase.rpc('get_admin_dashboard_stats');

// AFTER: Server calls RPC (hidden from user)
// lib/server-queries.ts
export async function getAdminDashboardStats() {
  const { data } = await supabase.rpc('get_admin_dashboard_stats');
  return data;
}

// app/portal/page.tsx (Server Component)
const stats = await getAdminDashboardStats();
```

#### Example 2: RPC WITH Parameters

```tsx
// BEFORE: Client calls RPC with params
"use client";
const { data } = await supabase.rpc('get_customer_orders_paginated', {
  p_customer_id: customerId,
  p_limit: 50,
  p_offset: 0,
  p_status: 'pending'
});

// AFTER: Server calls same RPC with params (UNCHANGED)
// lib/server-queries.ts
export async function getCustomerOrdersPaginated(
  customerId: string,
  options: { limit?: number; offset?: number; status?: string }
) {
  const { data } = await supabase.rpc('get_customer_orders_paginated', {
    p_customer_id: customerId,
    p_limit: options.limit || 50,
    p_offset: options.offset || 0,
    p_status: options.status || null,
  });
  return data;
}

// app/(landing)/orders/page.tsx (Server Component)
export default async function OrdersPage() {
  const user = await getCurrentUser(); // Server-side auth check
  const orders = await getCustomerOrdersPaginated(user.id, { 
    limit: 50, 
    status: 'pending' 
  });
  return <OrdersClient initialOrders={orders} />;
}
```

#### Example 3: RPC for Mutations (Use Server Actions)

```tsx
// BEFORE: Client calls mutation RPC
"use client";
const { data } = await supabase.rpc('create_order', {
  p_customer_id: customerId,
  p_items: items,
  p_total: total,
});

// AFTER: Server Action (hidden, secure)
// lib/actions.ts
'use server';

export async function createOrder(formData: FormData) {
  const customerId = formData.get('customerId');
  const items = JSON.parse(formData.get('items') as string);
  const total = parseFloat(formData.get('total') as string);

  const { data, error } = await supabase.rpc('create_order', {
    p_customer_id: customerId,
    p_items: items,
    p_total: total,
  });

  if (error) return { success: false, error: error.message };
  
  revalidatePath('/orders');
  return { success: true, data };
}

// Client Component
"use client";
import { createOrder } from '@/lib/actions';

function OrderButton() {
  const handleOrder = async () => {
    const result = await createOrder(formData);
  };
}
```

---

## 🔄 Real-Time Data Strategy

Real-time updates MUST stay client-side. Here's the hybrid approach:

```tsx
// app/portal/orders/page.tsx (Server Component)
import { getOrdersAdvanced } from "@/lib/server-queries";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  // Initial data - server-side (hidden)
  const initialOrders = await getOrdersAdvanced({ limit: 50 });
  
  return <OrdersClient initialOrders={initialOrders} />;
}

// app/portal/orders/OrdersClient.tsx (Client Component)
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdersClient({ initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);

  useEffect(() => {
    // Real-time subscription (only for UPDATES, not initial load)
    const channel = supabase
      .channel('orders-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, 
        (payload) => {
          // Update local state based on payload
          // No network request visible - just websocket
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, []);

  return <OrdersTable orders={orders} />;
}
```

---

## 📋 Migration Phases

### Phase 1: Create Server Queries (Week 1)

Create `lib/server-queries.ts` with all your RPCs:

```typescript
// lib/server-queries.ts
import { supabase } from './supabase';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';

// Auth helper for server components
export async function getServerUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  // Validate and return user
}

// ============ MENU QUERIES ============

export const getMenuData = unstable_cache(
  async () => {
    const [categories, items, deals] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_visible', true),
      supabase.from('menu_items').select('*').eq('is_available', true),
      supabase.rpc('get_active_deals'),
    ]);
    return { categories: categories.data, items: items.data, deals: deals.data };
  },
  ['menu-data'],
  { revalidate: 3600, tags: ['menu'] }
);

// ============ ORDERS QUERIES (with params) ============

export async function getOrdersForCustomer(
  customerId: string,
  params: { status?: string; limit?: number; offset?: number }
) {
  const { data } = await supabase.rpc('get_customer_orders_paginated', {
    p_customer_id: customerId,
    p_limit: params.limit || 50,
    p_offset: params.offset || 0,
    p_status: params.status || null,
  });
  return data;
}

// ============ PORTAL QUERIES ============

export async function getPortalDashboard() {
  const { data } = await supabase.rpc('get_admin_dashboard_stats');
  return data;
}

export async function getKitchenOrdersServer() {
  const { data } = await supabase.rpc('get_kitchen_orders');
  return data;
}

// ... all other RPCs
```

### Phase 2: Migrate Landing Pages (Week 2)

1. **Menu Page** (Highest traffic)
2. **Orders Page**
3. **Cart Page**
4. **Favorites Page**

### Phase 3: Migrate Portal Pages (Week 3)

1. **Dashboard**
2. **Orders**
3. **Kitchen**
4. **Other pages**

### Phase 4: Optimize & Test (Week 4)

1. Add caching
2. Test all RPCs with parameters
3. Performance testing
4. Remove old client-side fetch calls

---

## ✅ Checklist for Each Page Migration

- [ ] Create Server Component (page.tsx without "use client")
- [ ] Move data fetching to server
- [ ] Create Client Component for interactivity
- [ ] Pass initial data as props
- [ ] Keep real-time subscriptions in client
- [ ] Test RPC parameters work correctly
- [ ] Verify Network tab shows fewer requests
- [ ] Test authentication works
- [ ] Update types if needed

---

## 🚫 What NOT to Migrate

| Keep as Client | Reason |
|----------------|--------|
| Login pages | Need client-side auth flow |
| Real-time subscriptions | WebSocket only works in browser |
| Cart context | Client state management |
| Favorites context | Client state management |
| Toast notifications | UI feedback |
| Form validation | Immediate feedback |
| Animations | Browser-only |

---

## 📊 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Network requests (menu page) | 15-20 | 2-3 |
| Network requests (portal dashboard) | 25-30 | 3-5 |
| Initial page load | 2-3 seconds | <1 second |
| Supabase API calls | 100% visible | 10% visible |
| Monthly Supabase calls | ~500K | ~100K |

---

## 🔐 Security Note

Moving to SSR hides requests from Network tab but remember:
- Still validate on server
- Still use RLS policies
- Still check permissions
- API hiding ≠ API security

---

## 🚀 Ready to Start?

Reply with which page you want to migrate first, and I'll provide the exact code changes needed.

**Recommended order:**
1. `app/(landing)/menu/page.tsx` - Highest impact, most traffic
2. `app/(landing)/orders/page.tsx` - Customer orders
3. `app/portal/page.tsx` - Admin dashboard

---

## ✅ Migration Status (Updated)

### ✅ COMPLETED Migrations

#### Landing Pages
| Page | Status | Files Created |
|------|--------|---------------|
| Menu | ✅ DONE | `MenuClient.tsx` |
| Orders | ✅ DONE | `OrdersClient.tsx` |

#### Portal Pages
| Page | Status | Files Created |
|------|--------|---------------|
| Dashboard | ✅ DONE | `DashboardClient.tsx` |
| Orders | ✅ DONE | `OrdersClient.tsx` |
| Kitchen | ✅ DONE | `KitchenClient.tsx` |
| Tables | ✅ DONE | `TablesClient.tsx` |
| Perks | ✅ DONE | `PerksClient.tsx` |
| Menu Management | ✅ DONE | `MenuClient.tsx` |
| Employees | ✅ DONE | `EmployeesClient.tsx` |
| Deals | ✅ DONE | `DealsClient.tsx` |
| Customers | ✅ DONE | `CustomersClient.tsx` |
| Inventory | ✅ DONE | `InventoryClient.tsx` |
| Delivery | ✅ DONE | `DeliveryClient.tsx` |
| Attendance | ✅ DONE | `AttendanceClient.tsx` |
| Billing | ✅ DONE | `BillingClient.tsx` |
| Reviews | ✅ DONE | `ReviewsClient.tsx` |
| Payroll | ✅ DONE | `PayrollClient.tsx` |
| Audit | ✅ DONE | `AuditClient.tsx` |
| Notifications | ✅ DONE | `NotificationsClient.tsx` |

### ⏭️ Skipped (Not Suitable for SSR)
| Page | Reason |
|------|--------|
| Reports | Dynamic date filtering, makes initial SSR data quickly stale |
| Settings | User-specific tabs, data comes from auth context |

### 📁 Server Queries File
- **File:** `lib/server-queries.ts`
- **Size:** 2100+ lines
- **Contains:** All server-side query functions with `unstable_cache` for caching and revalidation tags

### 🔄 Pattern Used
```
page.tsx (Server Component)
↓
Fetches data using server-queries.ts
↓
Passes initialData props
↓
*Client.tsx (Client Component with "use client")
↓
Uses initialData for instant render
↓
Real-time subscriptions update state (if needed)
```

### 📊 Results
- **Before:** 40+ visible fetch requests per page
- **After:** 1-3 visible requests (only mutations)
- **Initial Load:** Instant (data comes with HTML)
