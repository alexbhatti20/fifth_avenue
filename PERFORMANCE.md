## 🚀 Performance Architecture - ISR, SSR, and Caching Strategy

### Overview
This implementation uses a **multi-layer caching strategy** to maximize performance while keeping data fresh where needed.

---

## 📊 Caching Layers

### Layer 1: Redis Cache (Upstash)
**Purpose:** Fast, shared cache across all server instances
**Duration:** 
- Menu Items: 1 hour
- Menu Categories: 2 hours
- Deals: 30 minutes
- Site Content: 1 hour

**Files:** `lib/cache.ts`

### Layer 2: Next.js ISR (Incremental Static Regeneration)
**Purpose:** Pre-rendered pages with automatic revalidation
**Pages:**
- Homepage: Revalidate every 30 minutes
- Menu pages: Revalidate every 1 hour
- Static content pages: Revalidate every 1 hour

**Files:** `app/(landing)/page.tsx`, `app/(landing)/menu/[slug]/page.tsx`

### Layer 3: React Query (Client-Side)
**Purpose:** Smart client-side caching for dynamic data
**Use Cases:**
- Orders (5 min stale time)
- Notifications (30 sec stale time)
- Tables (30 sec stale time)
- Analytics (no cache)

**Files:** `lib/react-query-config.ts`

---

## ⚡ Rendering Strategies

### Static Generation (SSG) with ISR
**Used For:**
- ✅ Landing page
- ✅ Menu pages
- ✅ About/Contact pages
- ✅ Terms/Privacy pages

**Benefits:**
- Instant page load (served from CDN)
- SEO optimized
- Auto-revalidates on schedule

**Example:**
```typescript
// app/(landing)/page.tsx
export const revalidate = 1800; // 30 minutes

export default async function Home() {
  const [content, deals] = await Promise.all([
    getSiteContent('hero'),
    getActiveDeals(),
  ]);
  return <div>...</div>;
}
```

### Server-Side Rendering (SSR)
**Used For:**
- ❌ NOT used - ISR is better for most cases
- Only for truly dynamic per-request data

### Client-Side Rendering (CSR)
**Used For:**
- ✅ User dashboards
- ✅ Order tracking
- ✅ Admin panels
- ✅ Real-time features

---

## 🔄 Realtime Strategy

### What Uses Realtime (Supabase Subscriptions):
1. **Order Status Updates** - Customer tracking page
2. **Kitchen Orders** - Kitchen dashboard
3. **Table Status** - Reception dashboard
4. **Notifications** - User notifications

### What DOESN'T Use Realtime:
1. ❌ Menu items - Use ISR
2. ❌ Deals - Use ISR
3. ❌ Site content - Use ISR
4. ❌ Reviews - Use ISR
5. ❌ Historical orders - Use React Query

**Files:** `lib/realtime.ts`

---

## 📝 Server Actions

### Purpose
Mutations that automatically revalidate cache and pages.

### Examples:

**Update Menu Item:**
```typescript
// lib/actions.ts
export async function updateMenuItem(id: string, formData: FormData) {
  // Update in DB
  await supabase.from('menu_items').update(data).eq('id', id);
  
  // Invalidate Redis cache
  await invalidateMenuCache();
  
  // Revalidate Next.js pages
  revalidatePath('/menu');
  revalidateTag('menu-items');
  
  return { success: true };
}
```

**Update Order Status:**
```typescript
export async function updateOrderStatus(orderId: string, status: string) {
  await supabase.rpc('update_order_status', { 
    p_order_id: orderId, 
    p_new_status: status 
  });
  
  // Only revalidate specific paths
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/admin/orders');
  
  // React Query handles client updates via optimistic UI
  return { success: true };
}
```

---

## 🎯 Data Fetching Patterns

### Pattern 1: Static Content (ISR)
```typescript
// Server Component with ISR
export const revalidate = 3600; // 1 hour

export default async function Page() {
  const data = await getMenuCategories(); // Redis + Next.js cache
  return <div>{/* Render */}</div>;
}
```

### Pattern 2: Dynamic User Data (React Query)
```typescript
// Client Component
'use client';

export default function OrderHistory() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.orders.customer(userId),
    queryFn: () => getCustomerOrders(userId),
    staleTime: staleTimeConfig.DYNAMIC, // 5 minutes
  });
  
  return <div>{/* Render */}</div>;
}
```

### Pattern 3: Realtime Data (Subscription)
```typescript
// Client Component
'use client';

export default function OrderTracking({ orderId }) {
  const [status, setStatus] = useState('pending');
  
  useEffect(() => {
    const unsubscribe = subscribeToOrderStatus(
      orderId,
      (newStatus) => setStatus(newStatus)
    );
    
    return unsubscribe;
  }, [orderId]);
  
  return <div>Status: {status}</div>;
}
```

---

## 🔧 Cache Invalidation Strategy

### Automatic Invalidation (Server Actions)
When data changes, server actions automatically:
1. Clear Redis cache
2. Revalidate Next.js pages
3. React Query refetches on next access

### Manual Invalidation (Admin Tools)
```typescript
// Clear all menu cache
await invalidateMenuCache();

// Clear specific category
await invalidateMenuCache(categoryId);

// Clear deals cache
await invalidateDealsCache();
```

---

## 📈 Performance Metrics

### Expected Improvements:
- **Homepage Load:** < 500ms (ISR)
- **Menu Page Load:** < 600ms (ISR)
- **Data Freshness:** 30 min - 1 hour (configurable)
- **Cache Hit Ratio:** > 90% for static content
- **Reduced DB Queries:** 80%+ reduction

### Monitoring:
```typescript
// Add to queries for monitoring
console.log('[CACHE]', 'Hit:', cacheKey);
console.log('[DB]', 'Miss:', cacheKey);
```

---

## ✅ Best Practices

### DO:
✅ Use ISR for static/semi-static content
✅ Use React Query for user-specific data
✅ Use Realtime only for critical updates
✅ Invalidate cache on mutations
✅ Set appropriate stale times

### DON'T:
❌ Use Realtime for static data
❌ Cache user-specific data in Redis
❌ Skip cache invalidation
❌ Set stale time too short (wastes requests)
❌ Set stale time too long (stale data)

---

## 🔍 Debugging

### Check Redis Cache:
```typescript
const cached = await getCached(CACHE_KEYS.menuItems());
console.log('Cached menu items:', cached);
```

### Force Revalidation:
```typescript
revalidatePath('/menu');
revalidateTag('menu-items');
```

### Clear All Cache:
```typescript
await deleteCachePattern('menu:*');
await deleteCachePattern('deals:*');
```

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `lib/cache.ts` | Redis caching utilities |
| `lib/queries.ts` | Data fetching with ISR |
| `lib/actions.ts` | Server Actions with cache invalidation |
| `lib/realtime.ts` | Supabase realtime subscriptions |
| `lib/react-query-config.ts` | React Query configuration |

---

**Status:** Performance architecture complete ✅  
**Next Phase:** Employee portal UI & RBAC implementation

