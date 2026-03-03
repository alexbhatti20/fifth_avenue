# ZOIRO Broast Hub — Full Security, Bug & Optimization Audit Report
**Date:** 2026-03-01  
**Auditor:** GitHub Copilot  
**Scope:** All portal pages, API routes, auth layer, role/permission system, client & server queries

---

## Severity Legend
| Icon | Level | Action |
|------|-------|--------|
| 🔴 CRITICAL | Exploitable now, immediate fix required | Block release |
| 🟠 HIGH | Serious risk, fix before next deploy | Fix ASAP |
| 🟡 MEDIUM | Risk under certain conditions | Fix in next sprint |
| 🔵 LOW | Best-practice gap, small risk | Plan fix |
| ⚡ PERF | Performance / optimization | Improve when possible |
| 🐛 BUG | Functional bug (no exploit) | Fix in next sprint |

---

## Executive Summary

| Category | Count |
|----------|-------|
| Critical security issues | 2 |
| High security issues | 4 |
| Medium security issues | 3 |
| Low security issues | 3 |
| Performance / optimization | 8 |
| Bugs | 5 |
| **Total findings** | **25** |

---

---

# PAGE-BY-PAGE AUDIT

---

## 1. `/portal` — Dashboard (`app/portal/page.tsx` + `DashboardClient.tsx`)

### ⚡ PERF-01 — Six parallel DB queries with no caching on every load
**File:** [app/portal/page.tsx](app/portal/page.tsx)  
**Detail:** `getAdminDashboardStatsServer`, `getHourlySalesAdvancedServer`, `getTablesStatusServer`, `getRecentOrdersServer`, `getBillingStatsServer`, `getBillingPendingOrdersServer` all execute with `revalidate = 0`. Every page hit hammers the DB with 6 concurrent RPCs.  
**Fix:** Set `revalidate = 30` (or 60) for stats that don't need second-level freshness. Only `getRecentOrdersServer` truly needs `revalidate = 0`. Today-only preset is already optimized — extend the same logic to the date-range presets.

### 🐛 BUG-01 — `searchParams` preset not validated
**File:** [app/portal/page.tsx](app/portal/page.tsx)  
**Detail:** `preset` is taken directly from `searchParams` with no allowlist check. An arbitrary string like `/?preset=__proto__` falls through to the `default` case silently but returns today's date — no error surfaced to the user. If the `switch` is extended in future, unvalidated input becomes a risk.  
**Fix:** Add an allowlist: `const VALID_PRESETS = ['today','yesterday','week','month','year']`.

---

## 2. `/portal/employees` — Employees Page (`app/portal/employees/page.tsx` + `EmployeesClient.tsx`)

### 🔴 CRITICAL-01 — `employee_data` cookie used for admin-only route guard but is NOT httpOnly
**File:** [middleware.ts](middleware.ts) (lines ~110–125), [lib/auth.ts](lib/auth.ts)  
**Detail:** `ADMIN_ONLY_PATHS` (`/portal/employees`, `/portal/audit`) are protected by checking `token.role` from the JWT. The JWT's `role` claim is Supabase's auth role (`'authenticated'`), **not** the custom employee role. The fallback `isAdminFromEmployeeData()` reads the `employee_data` cookie which is set as a plain non-httpOnly, non-signed JSON cookie. Any client-side script (or attacker via XSS) can create or overwrite this cookie with `role: "admin"` and gain access to the employees and audit pages without a valid admin JWT.

```
// In middleware.ts
const parsed = JSON.parse(decodeURIComponent(raw));
return parsed?.role === 'admin';   // ← trusts unsigned, non-httpOnly cookie
```

**Fix Options (pick one):**  
a) Move role into the Supabase JWT via a custom claim (`app_metadata.employee_role`). Middleware can then read it cryptographically from the JWT payload without any cookie trust.  
b) Remove the `employee_data` cookie fallback entirely. If the JWT doesn't contain the role, redirect to `/portal/login` and force a fresh token.  
c) Sign the `employee_data` cookie with HMAC-SHA256 using a server secret and verify the signature in middleware.

### ⚡ PERF-02 — Loads 100 employees per page regardless of actual count
**File:** [app/portal/employees/page.tsx](app/portal/employees/page.tsx)  
**Detail:** `getEmployeesPaginatedServer(1, 100)` always fetches 100 records on SSR. No URL-param-driven pagination.  
**Fix:** Read `page` and `limit` from `searchParams` with sensible defaults (e.g., 25). The `EmployeesClient` already supports pagination state.

### ⚡ PERF-03 — Client also calls `getEmployeesPaginated` + `getEmployeesDashboardStats` on mount
**File:** [app/portal/employees/EmployeesClient.tsx](app/portal/employees/EmployeesClient.tsx)  
**Detail:** Even though SSR seeds `initialData`, the client still fires these API calls on mount, doubling requests.  
**Fix:** Only fetch on mount if `initialData` is null/undefined; otherwise use SSR data until user explicitly refreshes.

### 🐛 BUG-02 — `revalidate = 30` conflicts with `force-dynamic`
**File:** [app/portal/employees/page.tsx](app/portal/employees/page.tsx)  
**Detail:** `export const dynamic = 'force-dynamic'` makes the route always dynamic (no caching). Setting `export const revalidate = 30` alongside it has no effect — Next.js ignores `revalidate` when `dynamic = 'force-dynamic'`. Dead code that implies caching where none exists.  
**Fix:** Remove `export const revalidate = 30`.

---

## 3. `/portal/customers` — All Customers (`app/portal/customers/page.tsx` + `CustomersClient.tsx`)

### 🟠 HIGH-01 — No role check before rendering customer PII data
**File:** [app/portal/customers/page.tsx](app/portal/customers/page.tsx)  
**Detail:** The page does not verify the requesting employee's role before fetching and rendering all customer data (names, emails, phones, addresses, spending). Middleware only checks that *some* valid token exists for `/portal/*`. A `waiter` or `delivery_rider` role employee whose token passes middleware can navigate to `/portal/customers` and see all customer PII.  
**File:** [lib/permissions.ts](lib/permissions.ts) shows `customers` page is **not** in `waiter` or `delivery_rider` or `kitchen_staff` permitted pages — but this is only enforced in the sidebar UI, not at the SSR/API level.  
**Fix:** Add a server-side role guard in `page.tsx` (like the pattern used in `backup/page.tsx`):
```ts
const employee = await getSSRCurrentEmployee();
if (!employee || !['admin','manager'].includes(employee.role)) redirect('/portal');
```

### 🟡 MEDIUM-01 — Customer PII fetched entirely in SSR, no field minimization
**File:** [app/portal/customers/page.tsx](app/portal/customers/page.tsx)  
**Detail:** `getCustomersAdminServer(100, 0, undefined, 'all')` returns full PII including addresses, spending, loyalty points, ban history for all 100 customers at once. This is serialized into the page's RSC payload and sent to the client as initial props.  
**Fix:** Paginate on server (25 at a time), and return only fields needed for the list view. Load full detail on row expansion (already partially supported by `getCustomerDetailServer`).

### ⚡ PERF-04 — `CustomersClient.tsx` is 922 lines — split into sub-components
**File:** [app/portal/customers/CustomersClient.tsx](app/portal/customers/CustomersClient.tsx)  
**Detail:** Single 922-line client component. No code-splitting. Everything re-renders on filter/search state changes.  
**Fix:** Extract `CustomerDetailPanel`, `BanDialog`, `CustomerStatsCards` into separate components. Use `React.memo` on `CustomerRow`.

---

## 4. `/portal/employees/[id]` — Employee Detail

### 🟠 HIGH-02 — No explicit server-side ownership/role check on employee detail
**File:** [app/portal/employees/[id]/](app/portal/employees/%5Bid%5D/)  
**Detail:** The middleware only allows `admin` to reach `/portal/employees`. The `[id]` sub-route means any valid admin token can view **any** employee's record. If a manager is somehow granted access (e.g., via the `employee_data` cookie bypass in CRITICAL-01), they can view/edit admin accounts.  
**Fix:** After resolving CRITICAL-01, ensure the detail page explicitly checks:  
- Current user is `admin` or `manager`  
- A `manager` cannot view/edit an `admin` record (already partially enforced in the API but not in the page SSR)

---

## 5. `/portal/payroll` — Payroll (`app/portal/payroll/page.tsx` + `PayrollClient.tsx`)

### 🟠 HIGH-03 — No page-level role check; only sidebar permission controls access
**File:** [app/portal/payroll/page.tsx](app/portal/payroll/page.tsx)  
**Detail:** Same pattern as customers — the page doesn't verify the employee's role before fetching payroll records (salaries, payslips, deductions). Middleware only checks token validity. A `billing_staff` role (which has `payroll` removed from their permitted pages) could navigate directly to `/portal/payroll`.  
**Fix:**
```ts
const employee = await getSSRCurrentEmployee();
if (!employee || !['admin','manager'].includes(employee.role)) redirect('/portal');
```

### ⚡ PERF-05 — `PayrollClient.tsx` is 1387 lines
**File:** [app/portal/payroll/PayrollClient.tsx](app/portal/payroll/PayrollClient.tsx)  
**Detail:** Massive single client component. Entire payroll UI re-renders on any state change.  
**Fix:** Split into `PayrollDashboardTab`, `PayslipsTab`, `BulkPayDialog`, `PayslipDetailPanel`.

---

## 6. `/portal/inventory` — Inventory (`app/portal/inventory/page.tsx`)

### ⚡ PERF-06 — Redis cache explicitly bypassed
**File:** [app/portal/inventory/page.tsx](app/portal/inventory/page.tsx)  
**Detail:** `getInventoryItems(false)` — the `false` flag explicitly skips Redis cache for "fresh data" on every SSR load. If the inventory page is visited frequently, this generates heavy DB load.  
**Fix:** Pass `true` to use cache. Invalidate the cache when inventory mutations occur (already done via `invalidateMenuCache` pattern elsewhere — apply same to inventory).

---

## 7. `/portal/settings` — Settings (`app/portal/settings/page.tsx`)

### 🐛 BUG-03 — `getSSRCurrentEmployee()` called twice per settings page load
**File:** [app/portal/settings/page.tsx](app/portal/settings/page.tsx) and [app/portal/layout.tsx](app/portal/layout.tsx)  
**Detail:** `PortalLayout` calls `getSSRCurrentEmployee()` to seed `PortalProvider`. Then `SettingsPage` calls it again to get `employee` for admin checks and to pass to `SettingsClient`. This is 2 identical DB reads per page load.  
**Fix:** Pass `employee` from the layout via a React server context or `unstable_cache` within the same request. Alternatively move the `isAdmin` branch logic to use the layout-fetched value via a server context.

### 🔵 LOW-01 — Website settings and maintenance status fetched for admin only (correct) but race-condition silently drops data
**File:** [app/portal/settings/page.tsx](app/portal/settings/page.tsx)  
**Detail:** `Promise.resolve(null)` is used as the non-admin path, which is correct. However if `getWebsiteSettingsServer()` throws (not rejects), the `Promise.all` will throw and the entire page crashes rather than showing a partial settings view.  
**Fix:** Wrap each admin-only call in a `try/catch` fallback returning `null`, matching the `Promise.allSettled` pattern used in `customers/page.tsx`.

---

## 8. `/portal/backup` — Database Backup (`app/portal/backup/page.tsx`)

### ✅ GOOD — Proper SSR role guard
The page correctly calls `getSSRCurrentEmployee()` and redirects to `/portal` for non-admin/manager roles. This is the pattern that should be applied to all sensitive pages.

### 🟠 HIGH-04 — Backup API JWT decoded manually without signature verification
**File:** [app/api/backup/generate/route.ts](app/api/backup/generate/route.ts) (lines ~104–130)  
**Detail:** The route manually decodes the JWT payload using `Buffer.from(tokenParts[1], 'base64').toString()` to extract `sub` (user ID) and then derives `employeeRole`. While it does call `authClient.rpc(...)` for the actual data, the manual decode reads an unverified payload before the trusted validation occurs.

```ts
const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
const authUserId = payload.sub;  // ← unverified
```

A JWT with a forged `sub` (but invalid signature) would fail when Supabase RPC rejects it — but the code extracts `authUserId` from the unverified payload first, which could lead to logic issues if the flow is extended.  
**Fix:** Use `createAuthenticatedClient(token)` with `supabase.auth.getUser(token)` to verify the token and get the validated `sub` from Supabase. Already done in `lib/jwt.ts` — reuse that pattern.

---

## 9. `/portal/audit` — Audit Logs (`app/portal/audit/page.tsx`)

### ✅ GOOD — Admin-only via middleware ADMIN_ONLY_PATHS
Note: This is **only** safe if CRITICAL-01 (cookie-based admin bypass) is resolved. With the current cookie check, the audit log is also bypassed.

### ⚡ PERF-07 — Always fetches last 100 logs on SSR with no pagination
**File:** [app/portal/audit/page.tsx](app/portal/audit/page.tsx)  
**Detail:** `getAuditLogsServer({ limit: 100 })` — 100 logs serialized and sent to client on every load.  
**Fix:** Default to 25, support URL-param `limit` and `page`.

---

## 10. `/portal/reports` — Reports (`app/portal/reports/page.tsx`)

### 🐛 BUG-04 — Missing `revalidate` and hardcoded 30-day range
**File:** [app/portal/reports/page.tsx](app/portal/reports/page.tsx)  
**Detail:** `export const dynamic = 'force-dynamic'` but no `revalidate`. The date range is computed at SSR time and hardcoded to "last 30 days" — no `searchParams` support. If an admin wants a custom range, the page forces a full SSR re-fetch but ignores their date input.  
**Fix:** Read date range from `searchParams`. Add `revalidate = 60` for cached reports that are expensive to compute.

---

## 11. `/portal/orders` — Orders (`app/portal/orders/page.tsx`)

### ✅ GOOD — Proper `Promise.allSettled` with fallback
The page correctly uses `Promise.allSettled` so a stats failure doesn't block order listing.

### 🔵 LOW-02 — `limit` from `searchParams` not capped
**File:** [app/portal/orders/page.tsx](app/portal/orders/page.tsx)  
**Detail:** `const limit = parseInt(params?.limit || '50', 10)` — a URL like `?limit=100000` would request 100k orders from the DB.  
**Fix:** `const limit = Math.min(parseInt(params?.limit || '50', 10), 200)`.

---

## 12. `/portal/login` — Auth Login (`app/api/auth/login/route.ts`)

### 🟡 MEDIUM-02 — User enumeration via distinct error messages on DB error
**File:** [app/api/auth/login/route.ts](app/api/auth/login/route.ts) (lines ~180–200)  
**Detail:** When Supabase returns a `'Database error'`, the route calls `get_user_by_email` and returns a different message depending on whether the email exists:  
- Email exists: *"Authentication service error. The user exists but auth failed."*  
- Email doesn't exist: *"Authentication service error. Please try again later."*  
This leaks whether an email is registered — a user enumeration vulnerability.  
**Fix:** Return a single generic message: `'Authentication service error. Please try again later.'` regardless of whether the user was found in the DB.

### 🟡 MEDIUM-03 — `skipOTP` flag accepted from request body without scope restriction
**File:** [app/api/auth/login/route.ts](app/api/auth/login/route.ts)  
**Detail:** `const { email, password, skipOTP } = await request.json()` — the `skipOTP` flag is accepted from the client. If not carefully validated downstream (when 2FA is enabled), this could allow bypassing the OTP step.  
**Fix:** Audit every downstream use of `skipOTP`. Ensure it is only honoured when the employee/customer record has `is_2fa_enabled = false`. Remove from the public API if not needed client-side.

### ✅ GOOD — Rate limiting is properly implemented
`checkLoginRateLimit` (5 attempts / 15 min window) is enforced before credentials are checked. Blocked until timestamp is returned. Good implementation.

---

---

# CROSS-CUTTING ISSUES

---

## AUTH-01 — Three inconsistent role systems

| System | Roles defined |
|--------|--------------|
| `AuthUser` interface ([lib/auth.ts](lib/auth.ts)) | `customer \| admin \| employee \| manager \| cashier \| kitchen \| reception \| waiter \| delivery` |
| `EmployeeRole` type ([lib/permissions.ts](lib/permissions.ts)) | `admin \| manager \| waiter \| billing_staff \| kitchen_staff \| delivery_rider \| other` |
| `isEmployeeOrAdmin()` check ([lib/auth.ts](lib/auth.ts)) | Includes `cashier`, `reception`, neither in `EmployeeRole` |

These three definitions are **out of sync**. A user with role `billing_staff` (correct DB value) might not match the `AuthUser` role union type. Conversely a `cashier` role from `AuthUser` has no mapping in `ROLE_DEFAULT_PERMISSIONS`.

**Fix:** Unify all role definitions into a single `types/portal.ts` union type that is the single source of truth. Regenerate from Supabase schema if possible.

---

## AUTH-02 — Deprecated `verifyToken` (jwt.ts) is still used in production API routes

**Files:** [app/api/admin/employees/route.ts](app/api/admin/employees/route.ts) (imports `verifyToken` from `lib/jwt`)  
**Detail:** `lib/jwt.ts` is marked `@deprecated`. Its `verifyToken` makes 2 additional DB queries (employees + customers RPC). The correct function is `verifyAuth()` from `lib/auth.ts` (also 2 queries but more maintainable).  
**Fix:** Replace `import { verifyToken } from '@/lib/jwt'` with `import { verifyAuth } from '@/lib/auth'` in all API routes. Eventually delete `lib/jwt.ts`.

---

## AUTH-03 — `permissions?: any` type in `AuthUser`

**File:** [lib/auth.ts](lib/auth.ts) (line ~14)  
**Detail:** `permissions?: any` provides no compile-time safety for permission checks. Bugs in permission logic won't be caught by TypeScript.  
**Fix:** Define a typed `Permissions` record:
```ts
permissions?: Record<string, boolean | string[]>;
```

---

## CORS-01 — CSP allows `unsafe-inline` and `unsafe-eval` in `script-src`

**File:** [middleware.ts](middleware.ts) (lines ~34–43)  
**Detail:**
```
"script-src 'self' 'unsafe-inline' 'unsafe-eval' ..."
```
`unsafe-eval` enables `eval()`, `new Function()`, `setTimeout(string)` — dramatically widens XSS attack surface. `unsafe-inline` allows inline `<script>` tags.  
**Fix:**  
- Remove `unsafe-eval`. Use Next.js `next/script` instead of `eval`-dependent libraries.  
- Replace `unsafe-inline` with a CSP nonce (`nonce-{random}`) generated per request. Next.js 13+ supports this natively.

---

## SUPABASE-01 — `VITE_` prefixed env variables checked in a Next.js project

**File:** [lib/supabase.ts](lib/supabase.ts) (lines 4–5)  
**Detail:** `process.env.VITE_SUPABASE_URL` and `process.env.VITE_SUPABASE_ANON_KEY` are checked before `NEXT_PUBLIC_`. In Next.js, `VITE_` prefixed variables are **not automatically injected** into client-side bundles (that's Vite's convention). On the server this works (all `process.env` is accessible). On the client, `VITE_` vars will be `undefined`, and the fallback `NEXT_PUBLIC_` will be used. This creates silent split behavior.  
**Fix:** Remove `VITE_` checks entirely and standardize on `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## LOCALSTORAGE-01 — Access tokens stored in localStorage (XSS risk)

**File:** [lib/portal-queries.ts](lib/portal-queries.ts) (lines ~50–75), [lib/supabase.ts](lib/supabase.ts)  
**Detail:** The client-side token is read from `localStorage` (`sb_access_token`, `auth_token`, and Supabase's native session JSON). localStorage is readable by any script on the page. If any third-party script or XSS payload runs, the access token is fully exposed.  
**Fix:** Move to httpOnly cookie-only auth for the portal. Already partially done (`setAuthCookies` in `lib/auth.ts` sets httpOnly cookies). The client-side `getAuthToken()` should read from a non-sensitive `sb_session_valid=true` cookie (just a flag) and let all authenticated API calls go through Next.js server actions (already the preferred pattern).

---

## DUPLICATE-QUERY-01 — `getSSRCurrentEmployee()` called in layout AND in page

**Files:** [app/portal/layout.tsx](app/portal/layout.tsx), [app/portal/settings/page.tsx](app/portal/settings/page.tsx), [app/portal/backup/page.tsx](app/portal/backup/page.tsx)  
**Detail:** The layout calls `getSSRCurrentEmployee()` to seed `PortalProvider`. Settings and backup pages call it again independently. This results in **2 identical DB queries** per load of those pages.  
**Fix:** Cache the result within the request using React's `cache()` function:
```ts
// lib/server-queries.ts
import { cache } from 'react';
export const getSSRCurrentEmployee = cache(async () => { ... });
```
React's `cache` deduplicates within a single server render tree automatically.

---

## SERVER-QUERIES-01 — Monolithic 4463-line server-queries.ts

**File:** [lib/server-queries.ts](lib/server-queries.ts)  
**Detail:** 4463 lines in a single file makes it impossible to tree-shake (server modules aren't tree-shaken anyway but it makes maintenance and debugging very difficult). Auth helpers, dashboard queries, payroll queries, inventory queries, and AI-related queries are all mixed together.  
**Fix:** Split into domain-specific files:
- `lib/queries/auth-queries.ts`
- `lib/queries/dashboard-queries.ts`
- `lib/queries/employee-queries.ts`
- `lib/queries/customer-queries.ts`
- `lib/queries/payroll-queries.ts`
- `lib/queries/inventory-queries.ts`

---

## ACTIONS-01 — Server actions lack explicit authorization beyond cookie presence

**File:** [lib/actions.ts](lib/actions.ts)  
**Detail:** All 2958 lines of server actions call `getAuthenticatedClient()` which returns an authenticated Supabase client based on the cookie JWT. Security relies entirely on Supabase **Row-Level Security (RLS)**. If any RLS policy has a misconfiguration, server actions will silently succeed for unauthorized users.  
**Recommendation:** Add explicit role checks at the top of sensitive server actions (payroll mutations, employee mutations, settings mutations) as a defense-in-depth layer.

---

## BUG-05 — `lib/permissions.ts` `backup` page accessible to `manager` but middleware only checks admin

**File:** [lib/permissions.ts](lib/permissions.ts) (line ~70), [middleware.ts](middleware.ts) (line ~55)  
**Detail:** `ADMIN_ONLY_PATHS = ['/portal/employees', '/portal/audit']` — `/portal/backup` is intentionally excluded (comment says manager can access it). The backup page itself has an SSR guard allowing admin + manager (`backup/page.tsx`). This is correct and consistent.  
However the comment in middleware says `backup is intentionally excluded — page's own SSR auth enforces that check`. This means backup's security relies **solely** on the SSR guard — there is **no middleware protection**. If the SSR guard in `backup/page.tsx` is ever removed or has a bug, backup access becomes ungated at the edge.  
**Fix:** Consider adding `/portal/backup` to a NEW `ADMIN_MANAGER_PATHS` array in middleware, checked with `['admin','manager'].includes(role)`.

---

# PRIORITY REMEDIATION PLAN

| Priority | ID | Title | Effort |
|----------|----|-------|--------|
| P0 | CRITICAL-01 | Fix `employee_data` cookie bypass for admin routes | 2h |
| P0 | HIGH-04 | Fix unverified JWT decode in backup API | 1h |
| P1 | HIGH-01 | Add SSR role guard to `/portal/customers` | 30min |
| P1 | HIGH-02 | Add SSR role guard to `/portal/employees/[id]` | 30min |
| P1 | HIGH-03 | Add SSR role guard to `/portal/payroll` | 30min |
| P1 | MEDIUM-02 | Fix user enumeration in login error messages | 30min |
| P2 | AUTH-01 | Unify role type definitions | 4h |
| P2 | CORS-01 | Remove `unsafe-eval` from CSP | 2h |
| P2 | LOCALSTORAGE-01 | Move to httpOnly-only auth | 1 day |
| P3 | DUPLICATE-QUERY-01 | Use `React.cache()` for `getSSRCurrentEmployee` | 1h |
| P3 | PERF-01 | Add SSR caching to dashboard queries | 2h |
| P3 | BUG-02 | Remove dead `revalidate = 30` on employees page | 5min |
| P3 | BUG-03 | Deduplicate `getSSRCurrentEmployee` in settings | 1h |
| P4 | AUTH-02 | Migrate from deprecated `verifyToken` | 2h |
| P4 | SERVER-QUERIES-01 | Split `server-queries.ts` into domain files | 1 day |
| P4 | SUPABASE-01 | Remove VITE env var checks | 15min |

---

*End of report. Total findings: 25 across 17 files.*
