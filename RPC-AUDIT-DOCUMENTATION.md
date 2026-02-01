# RPC Functions Audit Documentation

## Overview
This document lists all RPC functions used across the Zoiro Broast Hub application, organized by category and indicating their security requirements.

---

## 🔴 SECURITY CLASSIFICATION

| Classification | Description | Required Permission |
|---------------|-------------|---------------------|
| 🔓 **PUBLIC** | Can be accessed without authentication (read-only public data) | `anon`, `authenticated` |
| 🔐 **CUSTOMER** | Requires authenticated customer (JWT token) | `authenticated` |
| 🔒 **PORTAL** | Requires authenticated portal employee | `authenticated` |
| 🛡️ **ADMIN** | Requires admin/manager role | `authenticated` + role check in function |

---

## 📁 RPC Functions by Category

### 1️⃣ Authentication & User Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_user_by_email` | `p_email: string` | `/api/auth/login`, `/api/auth/verify-login`, `/api/auth/check-user`, `/api/auth/forgot-password/send-otp` | 🔐 CUSTOMER/PORTAL |
| `check_employee_portal_access` | `emp_id: string` | `PortalProvider.tsx`, `/api/auth/login`, `/api/auth/check-user`, `portal-queries.ts` | 🔒 PORTAL |
| `get_employee_for_2fa` | `emp_id: string` | `/api/portal/security/2fa/verify`, `portal-queries.ts` | 🔒 PORTAL |
| `update_employee_2fa_login` | `emp_id: string, requires_2fa: boolean` | `/api/portal/security/2fa/verify` | 🔒 PORTAL |
| `get_employee_by_auth_user` | `p_auth_user_id: string` | `portal-queries.ts` | 🔒 PORTAL |
| `validate_employee_license` | `p_license_key: string, p_password: string` | `/api/auth/activate-employee` | 🔓 PUBLIC |
| `activate_employee_portal` | `p_employee_id: string, p_password: string, ...` | `/api/auth/activate-employee`, `portal-queries.ts` | 🔐 CUSTOMER/PORTAL |
| `update_customer_auth_user_id` | `p_customer_id: string, p_auth_user_id: string` | `/api/auth/login` | 🔐 CUSTOMER |
| `update_user_password` | `p_user_id: string, p_new_password: string` | `/api/auth/forgot-password/reset-password` | 🛡️ ADMIN (uses supabaseAdmin) |
| `log_password_reset_completion` | `p_user_id: string, p_user_type: string` | `/api/auth/forgot-password/reset-password` | 🔐 CUSTOMER/PORTAL |

---

### 2️⃣ Customer Favorites

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_favorite_ids` | `p_customer_id: uuid` | `/api/favorites` | 🔐 CUSTOMER |
| `toggle_favorite` | `p_customer_id: uuid, p_menu_item_id: uuid` | `/api/favorites` | 🔐 CUSTOMER |
| `get_customer_favorites` | `p_customer_id: uuid` | `/api/favorites/details` | 🔐 CUSTOMER |
| `clear_all_favorites` | `p_customer_id: uuid` | `/api/favorites/clear` | 🔐 CUSTOMER |

---

### 3️⃣ Customer Reviews

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_public_reviews` | `p_menu_item_id: uuid (optional), p_limit: int, p_offset: int` | `/api/customer/reviews`, `server-queries.ts` | 🔓 PUBLIC |
| `check_customer_review_limit` | `p_customer_id: uuid, p_menu_item_id: uuid` | `/api/customer/reviews` | 🔐 CUSTOMER |
| `submit_customer_review` | `p_customer_id: uuid, p_menu_item_id: uuid, p_rating: int, p_comment: text` | `/api/customer/reviews` | 🔐 CUSTOMER |
| `delete_customer_review` | `p_review_id: uuid, p_customer_id: uuid` | `/api/customer/reviews/[id]` | 🔐 CUSTOMER |
| `mark_review_helpful` | `p_review_id: uuid, p_customer_id: uuid, p_is_helpful: boolean` | `/api/customer/reviews/[id]/helpful` | 🔐 CUSTOMER |
| `get_customer_reviews` | `p_customer_id: uuid` | `/api/customer/reviews/my-reviews` | 🔐 CUSTOMER |

---

### 4️⃣ Customer Loyalty & Promo Codes

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_loyalty_balance` | `p_customer_id: uuid` | `/api/customer/loyalty`, `/api/orders/create`, `server-queries.ts`, `customer-queries.ts` | 🔐 CUSTOMER |
| `get_customer_promo_codes` | `p_customer_id: uuid` | `/api/customer/loyalty`, `server-queries.ts` | 🔐 CUSTOMER |
| `check_promo_code_details` | `p_code: string, p_customer_id: uuid` | `/api/customer/loyalty` | 🔐 CUSTOMER |
| `validate_promo_code` | `p_code: string, p_customer_id: uuid` | `customer-queries.ts` | 🔐 CUSTOMER |
| `validate_promo_code_for_billing` | `p_code: string, p_order_total: decimal` | `/api/orders/create`, `/api/customer/promo/validate`, `actions.ts` | 🔐 CUSTOMER |
| `record_promo_usage` | `p_customer_id: uuid, p_promo_code_id: uuid` | `/api/orders/create` | 🔐 CUSTOMER |
| `deduct_loyalty_points` | `p_customer_id: uuid, p_points: int, p_order_id: uuid` | `/api/orders/create` | 🔐 CUSTOMER |

---

### 5️⃣ Customer Orders

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_customer_orders_paginated` | `p_customer_id: uuid, p_limit: int, p_offset: int` | `/api/customer/orders`, `server-queries.ts`, `customer-queries.ts` | 🔐 CUSTOMER |
| `get_order_details` | `p_order_id: uuid` | `server-queries.ts`, `customer-queries.ts` | 🔐 CUSTOMER |
| `create_customer_order` | `p_customer_id: uuid, p_items: jsonb, p_total: decimal, ...` | `/api/orders/create` | 🔐 CUSTOMER |
| `create_customer_notification` | `p_customer_id: uuid, p_title: string, p_message: string` | `/api/orders/create` | 🔐 CUSTOMER |

---

### 6️⃣ Customer Profile

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `update_customer_profile` | `p_customer_id: uuid, p_name: string, p_phone: string, p_addresses: jsonb` | `/api/customer/profile`, `customer-queries.ts` | 🔐 CUSTOMER |
| `toggle_2fa` | `p_customer_id: uuid, p_enabled: boolean` | `customer-queries.ts` | 🔐 CUSTOMER |

---

### 7️⃣ Payment Methods (Customer)

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_active_payment_methods` | (none) | `/api/customer/payment-methods` | 🔓 PUBLIC |

---

### 8️⃣ Portal Employee Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_employees` | (none) | `/api/admin/employees`, `portal-queries.ts` | 🔒 PORTAL |
| `create_employee` | `p_name: string, p_email: string, p_role: string, ...` | `/api/admin/employees` | 🛡️ ADMIN |
| `create_employee_complete` | `p_name: string, p_email: string, p_role: string, ...` | `/api/admin/employees/create` | 🛡️ ADMIN |
| `update_employee` | `p_id: uuid, p_name: string, p_email: string, ...` | `/api/admin/employees` | 🛡️ ADMIN |
| `update_employee_complete` | `p_id: uuid, ...` | `portal-queries.ts` | 🛡️ ADMIN |
| `delete_employee` | `p_id: uuid` | `/api/admin/employees` | 🛡️ ADMIN |
| `delete_employee_cascade` | `p_id: uuid` | `portal-queries.ts` | 🛡️ ADMIN |
| `get_employee_complete` | `p_id: uuid` | `/api/admin/employees/[id]`, `portal-queries.ts` | 🔒 PORTAL |
| `get_employee_profile_by_id` | `p_id: uuid` | `SettingsClient.tsx` | 🔒 PORTAL |
| `toggle_block_employee` | `p_id: uuid, p_blocked: boolean, p_reason: string` | `portal-queries.ts`, `BlockUnblockDialog.tsx` | 🛡️ ADMIN |
| `activate_employee` | `p_id: uuid` | `portal-queries.ts` | 🛡️ ADMIN |
| `get_employees_paginated` | `p_limit: int, p_offset: int, ...` | `server-queries.ts`, `portal-queries.ts` | 🔒 PORTAL |
| `get_employees_dashboard_stats` | (none) | `portal-queries.ts` | 🔒 PORTAL |
| `get_employee_payroll_v2` | `p_employee_id: uuid, p_month: string` | `portal-queries.ts` | 🔒 PORTAL |

---

### 9️⃣ Portal Dashboard & Stats

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_admin_dashboard_stats` | (none) | `DashboardClient.tsx`, `server-queries.ts`, `portal-queries.ts` | 🔒 PORTAL |
| `get_hourly_sales` | `p_date: date (optional)` | `DashboardClient.tsx` | 🔒 PORTAL |
| `get_hourly_sales_today` | (none) | `server-queries.ts` | 🔒 PORTAL |
| `get_waiter_dashboard_stats` | `p_employee_id: uuid` | `DashboardClient.tsx` | 🔒 PORTAL |
| `get_waiter_dashboard` | `p_employee_id: uuid (optional)` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_kitchen_orders` | (none) | `DashboardClient.tsx` | 🔒 PORTAL |
| `get_kitchen_orders_v2` | (none) | `portal-queries.ts`, `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_kitchen_stats` | (none) | `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_rider_dashboard_stats` | `p_employee_id: uuid` | `DashboardClient.tsx` | 🔒 PORTAL |
| `get_rider_delivery_history` | `p_rider_id: uuid, ...` | `DeliveryClient.tsx` | 🔒 PORTAL |

---

### 🔟 Portal Orders Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_orders` | `p_limit: int, p_offset: int` | `portal-queries.ts` | 🔒 PORTAL |
| `get_orders_advanced` | `p_status: string, p_type: string, ...` | `portal-queries.ts`, `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_orders_stats` | (none) | `portal-queries.ts`, `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `update_order_status` | `p_order_id: uuid, p_status: string` | `actions.ts` | 🔒 PORTAL |
| `update_order_status_quick` | `p_order_id: uuid, p_status: string` | `portal-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `update_kitchen_order_status` | `p_order_id: uuid, p_status: string` | `actions.ts` | 🔒 PORTAL |

---

### 1️⃣1️⃣ Portal Tables Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_tables_status` | (none) | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_tables_for_waiter` | (none) | `TablesClient.tsx`, `server-queries.ts` | 🔒 PORTAL |
| `claim_table_for_waiter` | `p_table_id: uuid, p_employee_id: uuid` | `TablesClient.tsx`, `portal-queries.ts` | 🔒 PORTAL |
| `assign_table_to_order` | `p_order_id: uuid, p_table_id: uuid` | `actions.ts` | 🔒 PORTAL |
| `release_table` | `p_table_id: uuid` | `actions.ts` | 🔒 PORTAL |
| `get_waiter_order_history` | `p_waiter_id: uuid, ...` | `WaiterHistory.tsx` | 🔒 PORTAL |
| `create_waiter_dine_in_order` | `p_table_id: uuid, p_items: jsonb, ...` | `TakeOrderDialog.tsx` | 🔒 PORTAL |
| `lookup_customer` | `p_phone: string` | `TakeOrderDialog.tsx` | 🔒 PORTAL |
| `get_menu_for_ordering` | (none) | `TakeOrderDialog.tsx` | 🔒 PORTAL |

---

### 1️⃣2️⃣ Portal Delivery Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_available_delivery_riders` | (none) | `portal-queries.ts` | 🔒 PORTAL |
| `assign_delivery_rider` | `p_order_id: uuid, p_rider_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `accept_delivery_order` | `p_order_id: uuid, p_rider_id: uuid` | `DeliveryClient.tsx` | 🔒 PORTAL |
| `complete_delivery_order` | `p_order_id: uuid, p_rider_id: uuid` | `DeliveryClient.tsx` | 🔒 PORTAL |
| `cancel_delivery_order` | `p_order_id: uuid, p_rider_id: uuid, p_reason: string` | `DeliveryClient.tsx` | 🔒 PORTAL |

---

### 1️⃣3️⃣ Portal Billing & Invoices

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_billing_dashboard_stats` | (none) | `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_billing_pending_orders` | `p_limit: int, p_offset: int` | `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_billable_orders` | `p_limit: int, p_offset: int` | `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_recent_invoices` | `p_limit: int` | `server-queries.ts`, `actions.ts` | 🔒 PORTAL |
| `get_order_for_billing` | `p_order_id: uuid` | `actions.ts` | 🔒 PORTAL |
| `generate_quick_bill` | `p_order_id: uuid, p_employee_id: uuid, ...` | `actions.ts` | 🔒 PORTAL |
| `generate_advanced_invoice` | `p_order_id: uuid, p_employee_id: uuid, ...` | `actions.ts` | 🔒 PORTAL |
| `get_invoice_details` | `p_invoice_id: uuid` | `actions.ts` | 🔒 PORTAL |
| `mark_invoice_printed` | `p_invoice_id: uuid` | `actions.ts` | 🔒 PORTAL |
| `void_invoice` | `p_invoice_id: uuid, p_reason: string` | `actions.ts` | 🔒 PORTAL |

---

### 1️⃣4️⃣ Portal Menu Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_menu_management_data` | (none) | `MenuClient.tsx`, `server-queries.ts` | 🔒 PORTAL |
| `create_menu_item_advanced` | `p_name: string, p_price: decimal, ...` | `MenuClient.tsx`, `actions.ts` | 🛡️ ADMIN |
| `update_menu_item_advanced` | `p_id: uuid, ...` | `MenuClient.tsx`, `actions.ts` | 🛡️ ADMIN |
| `delete_menu_item` | `p_id: uuid` | `MenuClient.tsx` | 🛡️ ADMIN |
| `update_menu_item` | `p_id: uuid, ...` | `MenuClient.tsx` | 🛡️ ADMIN |
| `manage_menu_category` | `p_action: string, p_id: uuid, p_name: string` | `actions.ts` | 🛡️ ADMIN |

---

### 1️⃣5️⃣ Portal Deals Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_deals_with_items` | (none) | `portal-queries.ts`, `server-queries.ts`, `actions.ts`, `MenuClient.tsx` | 🔒 PORTAL |
| `get_deal_with_items` | `deal_id: uuid` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `create_deal_with_items` | `p_name: string, p_items: jsonb, ...` | `portal-queries.ts`, `actions.ts` | 🛡️ ADMIN |
| `update_deal_with_items` | `p_id: uuid, ...` | `portal-queries.ts`, `actions.ts` | 🛡️ ADMIN |
| `toggle_deal_active` | `p_id: uuid` | `portal-queries.ts`, `actions.ts` | 🛡️ ADMIN |
| `delete_deal_cascade` | `p_id: uuid` | `portal-queries.ts`, `actions.ts` | 🛡️ ADMIN |

---

### 1️⃣6️⃣ Portal Reviews Management (Admin)

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_admin_reviews_by_employee` | `p_employee_id: uuid, ...` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_admin_reviews_advanced` | `p_status: string, ...` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_all_review_stats` | (none) | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `update_review_visibility` | `p_review_id: uuid, p_visible: boolean` | `portal-queries.ts` | 🛡️ ADMIN |
| `update_review_visibility_by_employee` | `p_review_id: uuid, p_visible: boolean, p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `bulk_update_review_visibility` | `p_review_ids: uuid[], p_visible: boolean` | `portal-queries.ts` | 🛡️ ADMIN |
| `bulk_update_review_visibility_by_employee` | `p_review_ids: uuid[], p_visible: boolean, p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `reply_to_review_advanced` | `p_review_id: uuid, p_reply: string` | `portal-queries.ts` | 🛡️ ADMIN |
| `reply_to_review_by_employee` | `p_review_id: uuid, p_reply: string, p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `delete_review_advanced` | `p_review_id: uuid` | `portal-queries.ts` | 🛡️ ADMIN |
| `delete_review_by_employee` | `p_review_id: uuid, p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `set_all_reviews_visibility` | `p_visible: boolean` | `portal-queries.ts` | 🛡️ ADMIN |

---

### 1️⃣7️⃣ Portal Payroll Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_payslips_v2` | `p_employee_id: uuid, p_month: string, ...` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_payroll_summary_v2` | `p_month: string` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `create_payslip_v2` | `p_employee_id: uuid, p_month: string, ...` | `portal-queries.ts` | 🛡️ ADMIN |
| `update_payslip_status_v2` | `p_payslip_id: uuid, p_status: string` | `portal-queries.ts` | 🛡️ ADMIN |
| `delete_payslip_v2` | `p_payslip_id: uuid` | `portal-queries.ts` | 🛡️ ADMIN |

---

### 1️⃣8️⃣ Portal Analytics & Reports

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_sales_analytics` | `p_start_date: date, p_end_date: date` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_category_sales_report_v2` | `p_start_date: date, p_end_date: date` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_employee_performance_report` | `p_start_date: date, p_end_date: date` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `get_inventory_report` | (none) | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |

---

### 1️⃣9️⃣ Portal Audit Logs

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_audit_logs` | `p_limit: int, p_offset: int, ...` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |

---

### 2️⃣0️⃣ Portal Notifications

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_my_notifications` | `p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `mark_notifications_read` | `p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `get_notifications` | `p_employee_id: uuid, p_limit: int` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |
| `mark_notification_read` | `p_notification_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `mark_all_notifications_read` | `p_employee_id: uuid` | `portal-queries.ts` | 🔒 PORTAL |
| `get_unread_notification_count` | `p_employee_id: uuid` | `portal-queries.ts`, `server-queries.ts` | 🔒 PORTAL |

---

### 2️⃣1️⃣ Portal Settings

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_website_settings_internal` | (none) | `SettingsClient.tsx` | 🔒 PORTAL |
| `upsert_website_settings_internal` | `p_settings: jsonb` | `SettingsClient.tsx` | 🛡️ ADMIN |

---

### 2️⃣2️⃣ Portal Perks & Promo Management (Admin)

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_perks_settings` | (none) | `server-queries.ts`, `PerksClient.tsx` | 🔒 PORTAL |
| `get_all_customers_loyalty` | `p_limit: int` | `server-queries.ts`, `PerksClient.tsx` | 🔒 PORTAL |
| `get_all_customer_promo_codes_admin` | `p_limit: int, p_offset: int` | `server-queries.ts`, `PerksClient.tsx` | 🔒 PORTAL |
| `update_perks_setting` | `p_key: string, p_value: jsonb` | `PerksClient.tsx` | 🛡️ ADMIN |
| `deactivate_customer_promo_admin` | `p_promo_id: uuid` | `PerksClient.tsx` | 🛡️ ADMIN |
| `activate_customer_promo_admin` | `p_promo_id: uuid` | `PerksClient.tsx` | 🛡️ ADMIN |
| `delete_customer_promo_admin` | `p_promo_id: uuid` | `PerksClient.tsx` | 🛡️ ADMIN |
| `bulk_activate_promo_codes_admin` | `p_promo_ids: uuid[]` | `PerksClient.tsx` | 🛡️ ADMIN |
| `bulk_deactivate_promo_codes_admin` | `p_promo_ids: uuid[]` | `PerksClient.tsx` | 🛡️ ADMIN |
| `bulk_delete_promo_codes_admin` | `p_promo_ids: uuid[]` | `PerksClient.tsx` | 🛡️ ADMIN |
| `cleanup_expired_customer_promos` | (none) | `PerksClient.tsx` | 🛡️ ADMIN |

---

### 2️⃣3️⃣ Portal Customers Management (Admin)

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_customers_admin` | `p_limit: int, p_offset: int, ...` | `server-queries.ts`, `CustomersClient.tsx` | 🔒 PORTAL |
| `get_customers_stats` | (none) | `server-queries.ts`, `CustomersClient.tsx` | 🔒 PORTAL |
| `get_customer_detail_admin` | `p_customer_id: uuid` | `CustomersClient.tsx` | 🔒 PORTAL |

---

### 2️⃣4️⃣ Portal Attendance

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_attendance_stats` | (none) | `server-queries.ts` | 🔒 PORTAL |
| `get_today_attendance` | (none) | `server-queries.ts` | 🔒 PORTAL |

---

### 2️⃣5️⃣ Portal Inventory Management

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_inventory_items` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `create_inventory_item` | `p_name: string, p_quantity: int, ...` | `inventory-queries.ts` | 🔒 PORTAL |
| `update_inventory_item` | `p_id: uuid, ...` | `inventory-queries.ts` | 🔒 PORTAL |
| `delete_inventory_item` | `p_id: uuid` | `inventory-queries.ts` | 🔒 PORTAL |
| `adjust_inventory_stock` | `p_item_id: uuid, p_quantity: int, p_reason: string` | `inventory-queries.ts` | 🔒 PORTAL |
| `bulk_update_stock` | `p_items: jsonb` | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_transactions` | `p_item_id: uuid, ...` | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_summary` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `get_low_stock_items` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_movement_report` | `p_start_date: date, p_end_date: date` | `inventory-queries.ts` | 🔒 PORTAL |
| `get_expiring_items` | `p_days: int` | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_value_by_category` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `generate_reorder_suggestions` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_suppliers` | (none) | `inventory-queries.ts` | 🔒 PORTAL |
| `create_inventory_supplier` | `p_name: string, ...` | `inventory-queries.ts` | 🔒 PORTAL |
| `get_inventory_alerts` | `p_unread_only: boolean` | `inventory-queries.ts` | 🔒 PORTAL |
| `mark_inventory_alert_read` | `p_alert_id: uuid` | `inventory-queries.ts` | 🔒 PORTAL |
| `resolve_inventory_alert` | `p_alert_id: uuid` | `inventory-queries.ts` | 🔒 PORTAL |

---

### 2️⃣6️⃣ Portal Payment Methods (Admin)

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_all_payment_methods_internal` | (none) | `/api/admin/payment-methods` | 🛡️ ADMIN |
| `create_payment_method_internal` | `p_name: string, p_type: string, ...` | `/api/admin/payment-methods` | 🛡️ ADMIN |
| `update_payment_method_internal` | `p_id: uuid, ...` | `/api/admin/payment-methods` | 🛡️ ADMIN |
| `delete_payment_method_internal` | `p_id: uuid` | `/api/admin/payment-methods` | 🛡️ ADMIN |
| `toggle_payment_method_status_internal` | `p_id: uuid` | `/api/admin/payment-methods` | 🛡️ ADMIN |

---

### 2️⃣7️⃣ Order Creation Data

| RPC Function | Parameters | Used In | Classification |
|-------------|-----------|---------|----------------|
| `get_order_creation_data` | (none) | `server-queries.ts` | 🔓 PUBLIC |

---

## 🚨 SECURITY RECOMMENDATIONS

### 1. Functions that MUST have `authenticated` permission ONLY:
All 🔐 CUSTOMER, 🔒 PORTAL, and 🛡️ ADMIN functions should ONLY grant execute permission to `authenticated` role.

### 2. Functions that can have `anon` permission:
Only 🔓 PUBLIC functions:
- `get_public_reviews`
- `get_active_payment_methods`
- `get_order_creation_data`
- `validate_employee_license` (for employee activation flow)

### 3. Additional Security Checks:
All 🛡️ ADMIN functions should verify the employee's role inside the function before executing.

---

## 📋 SQL Permission Template

```sql
-- Revoke all permissions first
REVOKE ALL ON FUNCTION function_name(params) FROM PUBLIC;
REVOKE ALL ON FUNCTION function_name(params) FROM anon;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION function_name(params) TO authenticated;
```

---

## 🔧 API Route Authentication Pattern

All customer API routes should:
1. Verify JWT token via `verifyToken()`
2. Create authenticated Supabase client via `createAuthenticatedClient(token)`
3. Use the authenticated client for all RPC calls

```typescript
const token = cookieStore.get('auth_token')?.value;
if (!token) return unauthorized();

const decoded = await verifyToken(token);
if (!decoded) return unauthorized();

const supabase = createAuthenticatedClient(token);
const { data, error } = await supabase.rpc('function_name', params);
```

---

## 📅 Audit Date
**Last Updated:** $(date +%Y-%m-%d)

## 📊 Total RPC Functions
**Count:** ~130+ unique RPC functions identified
