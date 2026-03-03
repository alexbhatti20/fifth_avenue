# ZOIRO BROAST HUB
## System Documentation
### Working Methodology & Functional Architecture

---

**Document Type:** Technical Documentation  
**Version:** 1.0  
**Date:** March 2026  
**Platform:** Web Application (Next.js)  
**Database:** Supabase (PostgreSQL)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Working Methodology](#2-working-methodology)
3. [System Actors (User Roles)](#3-system-actors-user-roles)
4. [Use Case Diagram](#4-use-case-diagram)
5. [Activity Diagram](#5-activity-diagram)
6. [Class Diagram](#6-class-diagram)
7. [Database Schema](#7-database-schema)
8. [System Features Summary](#8-system-features-summary)

---

## 1. Executive Summary

Zoiro Broast Hub is a comprehensive restaurant management system that enables online food ordering, kitchen operations, delivery management, and complete business administration. The system supports multiple user roles with role-based access control (RBAC) to ensure secure and efficient operations.

### Key Features

- Online food ordering with real-time tracking
- Multi-role employee portal
- Kitchen display system
- Delivery rider management
- Table reservation and dine-in service
- Loyalty program with tiered rewards
- Inventory and payroll management
- Comprehensive reporting and analytics

---

## 2. Working Methodology

### 2.1 Development Approach

The system follows an **Agile Development Methodology** with iterative sprints focusing on continuous delivery and user feedback integration.

### 2.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions, API Routes |
| Database | Supabase (PostgreSQL) |
| Authentication | JWT, OTP, Google OAuth |
| Caching | Redis (Upstash) |
| Email | Brevo (Sendinblue) |
| Hosting | Vercel |

### 2.3 Architecture Pattern

The system implements a **Multi-Layer Architecture**:

1. **Presentation Layer:** React components with server-side rendering
2. **Business Logic Layer:** Server actions and API routes
3. **Data Access Layer:** Supabase client with RPC functions
4. **Database Layer:** PostgreSQL with Row Level Security (RLS)

### 2.4 Data Flow Architecture

```
┌──────────────────────┐
│   Client Request     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Next.js Edge       │
│   (ISR Cache)        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Redis Cache        │
│   (Upstash)          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Supabase DB        │
│   (PostgreSQL)       │
└──────────────────────┘
```

### 2.5 Rendering Strategy

| Content Type | Strategy | Revalidation |
|--------------|----------|--------------|
| Landing Page | ISR | 30 minutes |
| Menu Pages | ISR | 1 hour |
| Portal Dashboard | SSR | Real-time |
| Order Tracking | Client-side | WebSocket |

---

## 3. System Actors (User Roles)

The system supports **7 distinct user roles**, each with specific permissions and responsibilities.

### 3.1 Role Hierarchy

| # | Role | Description |
|---|------|-------------|
| 1 | **Customer** | Online visitors who browse menu, place orders, track deliveries, and earn loyalty points |
| 2 | **Admin** | Restaurant owner with full system access including employee management, payroll, and system settings |
| 3 | **Manager** | Operations supervisor handling reports, inventory, menu, deals, and staff oversight |
| 4 | **Waiter** | Table service staff managing dine-in orders, table assignments, and earning tips |
| 5 | **Kitchen Staff** | Food preparation team viewing order queue, marking order status, and checking ingredients |
| 6 | **Billing Staff** | Payment processing team handling invoices, receipts, refunds, and cash management |
| 7 | **Delivery Rider** | Delivery personnel accepting orders, updating delivery status, and collecting payments |

### 3.2 Permission Matrix

| Feature | Customer | Admin | Manager | Waiter | Kitchen | Billing | Rider |
|---------|:--------:|:-----:|:-------:|:------:|:-------:|:-------:|:-----:|
| Browse Menu | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Place Order | ✓ | - | - | ✓ | - | - | - |
| Track Order | ✓ | - | - | - | - | - | - |
| View Dashboard | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage Menu | - | ✓ | ✓ | - | - | - | - |
| Kitchen Queue | - | ✓ | ✓ | - | ✓ | - | - |
| Process Payments | - | ✓ | - | - | - | ✓ | - |
| Manage Deliveries | - | ✓ | ✓ | - | - | - | ✓ |
| Employee CRUD | - | ✓ | - | - | - | - | - |
| View Reports | - | ✓ | ✓ | - | - | - | - |
| Manage Tables | - | ✓ | ✓ | ✓ | - | - | - |
| Inventory | - | ✓ | ✓ | - | ✓ | - | - |
| Payroll | - | ✓ | - | - | - | - | - |
| Audit Logs | - | ✓ | - | - | - | - | - |
| DB Backup | - | ✓ | ✓ | - | - | - | - |
| Attendance | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 4. Use Case Diagram

**Diagram File:** `use-case-diagram.puml`

### 4.1 Diagram Preview

![Use Case Diagram](use-case-diagram.png)

*Note: Render the PlantUML file to generate the image*

### 4.2 Use Case Categories

#### Customer Use Cases
- Browse Menu - View categories, items, prices
- Add to Cart - Select items, sizes, quantities
- Place Order - Checkout with delivery/pickup/dine-in
- Track Order - Real-time status updates
- Pay - Cash, card, or online payment
- Earn Points - Loyalty program participation
- Write Review - Rate food and service
- Favorites - Save preferred items

#### Account Use Cases
- Register - Email/phone signup with OTP
- Login/OTP - Secure login with verification
- Google Login - OAuth authentication
- 2FA - Two-factor authentication
- Reset Password - Secure password recovery

#### Table Service Use Cases (Waiter)
- View Tables - See assigned tables
- Take Order - Create dine-in orders
- Table Exchange - Request table swaps
- Attendance - Check in/out
- View Tips - See earnings

#### Kitchen Use Cases
- View Queue - Pending orders list
- Mark Preparing - Update order status
- Mark Ready - Food ready for service
- Check Stock - Ingredient availability

#### Billing Use Cases
- Generate Bill - Create invoices
- Process Payment - Accept cash/card
- Apply Discount - Manual discounts
- Refund - Process returns
- Print Receipt - Generate receipts

#### Delivery Use Cases (Rider)
- View Deliveries - Assigned orders
- Accept Delivery - Take delivery request
- Update Status - On the way/arrived
- Mark Delivered - Complete delivery

#### Management Use Cases
- Sales Reports - Revenue analytics
- Monitor Orders - Real-time dashboard
- Manage Menu - Add/edit items
- Manage Deals - Create promotions
- Inventory - Stock management
- Reviews - Customer feedback

#### Admin Use Cases
- Add Employee - Create staff accounts
- Manage Roles - Assign permissions
- Block/Unblock - Control access
- Payroll - Process salaries
- Audit Logs - View activity
- DB Backup - Data protection
- Loyalty Program - Configure rewards
- Customers - Manage database

---

## 5. Activity Diagram

**Diagram File:** `activity-diagram.puml`

### 5.1 Diagram Preview

![Activity Diagram](activity-diagram.png)

*Note: Render the PlantUML file to generate the image*

### 5.2 Process Phases

#### Phase 1: Customer Ordering
1. Customer visits website
2. Browses menu categories
3. Views item details
4. Adds items to cart
5. Applies promo code (optional)
6. Selects order type (Delivery/Walk-in/Dine-in)
7. Chooses payment method
8. Completes checkout

#### Phase 2: Order Processing
1. System generates order number
2. Email confirmation sent
3. Push notification sent
4. Kitchen staff alerted
5. Manager monitors dashboard

#### Phase 3: Kitchen Preparation
1. Kitchen receives order alert
2. Checks ingredient availability
3. Starts cooking (status: PREPARING)
4. Customer receives notification
5. Completes cooking
6. Quality check performed
7. Marks order as READY

#### Phase 4: Order Fulfillment

**A) Home Delivery:**
1. System assigns nearest rider
2. Rider accepts delivery
3. Picks up order from restaurant
4. Status updated: ON THE WAY
5. Customer tracks rider on map
6. Rider arrives and delivers
7. Collects cash if applicable
8. Marks as DELIVERED

**B) Walk-in Pickup:**
1. Billing staff announces order
2. Customer presents confirmation
3. Payment processed (if cash)
4. Receipt printed
5. Order handed over

**C) Dine-in Service:**
1. Waiter retrieves order from kitchen
2. Serves at customer's table
3. Customer enjoys meal
4. Bill requested
5. Billing staff calculates total
6. Payment processed
7. Receipt provided
8. Waiter clears table, records tips

#### Phase 5: Post-Order Activities
1. System calculates loyalty points
2. Points awarded to customer
3. Customer may write review
4. System updates analytics
5. Manager reviews reports
6. Inventory levels checked
7. Low stock alerts generated

#### Phase 6: Admin Activities
1. Admin views system activity
2. Checks audit logs
3. Manages employee accounts
4. Processes monthly payroll
5. Approves payments
6. Performs database backup

---

## 6. Class Diagram

**Diagram File:** `class-diagram.puml`

### 6.1 Diagram Preview

![Class Diagram](class-diagram.png)

*Note: Render the PlantUML file to generate the image*

### 6.2 Entity Groups

#### People Entities

**Customer**
- Attributes: Name, Email, Phone, Address
- Loyalty: Points, Tier (Bronze/Silver/Gold/Platinum)
- History: Orders, Favorites, Reviews

**Employee**
- Identification: Employee ID, Name, Email, Phone
- Work Info: Role, Status, Salary, Hire Date
- Security: 2FA, Permissions, Last Login
- Performance: Tips, Orders Taken

**Employee Roles**
- Admin - Full system access
- Manager - Operations management
- Waiter - Table service
- Kitchen Staff - Food preparation
- Billing Staff - Payment processing
- Delivery Rider - Order delivery
- Other - Custom permissions

#### Menu Entities

**Category**
- Attributes: Name, Description, Display Order, Image
- Examples: Broast Chicken, Burgers, Drinks, Desserts

**Menu Item**
- Basic: Name, Description, Price
- Details: Prep Time, Availability, Featured
- Ratings: Average Rating, Review Count
- Variants: Size Options, Size Prices

**Deal / Combo**
- Pricing: Original Price, Discounted Price, Savings
- Contents: Included Items List
- Validity: Available Until Date

#### Order Entities

**Order**
- Identification: Order Number, Date/Time
- Type: Delivery, Walk-in, Dine-in
- Pricing: Subtotal, Discount, Delivery Fee, Tax, Total
- Status: Pending → Confirmed → Preparing → Ready → Delivering → Delivered

**Order Item**
- Reference: Menu Item
- Details: Quantity, Size, Price, Instructions

**Invoice**
- Identification: Invoice Number
- Payment: Total, Method, Status, Date

**Payment Types**
- Cash, Card, Online, Wallet

#### Operations Entities

**Restaurant Table**
- Physical: Table Number, Capacity, Floor/Section
- Status: Available, Occupied, Reserved, Cleaning
- Assignment: Current Order, Assigned Waiter

**Inventory Item**
- Stock: Name, Quantity, Min Level, Unit
- Supplier: Name, Cost per Unit
- Alerts: Last Restocked, Low Stock Flag

**Attendance**
- Record: Employee, Date
- Time: Check-in, Check-out
- Calculation: Hours Worked, Overtime
- Status: Present, Absent, Late, On Leave

**Payroll**
- Period: Employee, Month/Year
- Earnings: Base Salary, Tips, Bonus
- Deductions: Various deductions
- Result: Net Amount, Paid Status

#### Marketing Entities

**Special Offer**
- Discount: Type, Value, Min Order, Max Discount
- Period: Valid From/Until
- Display: Show Banner, Send Push Notification

**Loyalty Tiers**
- Bronze: 0-500 points
- Silver: 501-1,500 points
- Gold: 1,501-3,000 points
- Platinum: 3,001+ points
- Benefits: Points per Rs.100, Birthday Bonus, Free Delivery

**Review**
- Content: Customer, Order, Rating (1-5), Comment
- Meta: Date, Visibility

**Notification**
- Target: Recipient
- Type: Order Update, Promo, Alert
- Content: Title, Message, Read Status

#### Security Entities

**Audit Log**
- Tracking: Timestamp, User, IP Address
- Action: Type (Create/Update/Delete/View)
- Data: Entity, Before/After Values

**Session**
- Authentication: User, Token
- Details: Device, Login Time, 2FA Verified

### 6.3 Entity Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| Customer → Order | 1 to Many | Customer places multiple orders |
| Customer → Review | 1 to Many | Customer writes reviews |
| Employee → Role | Many to 1 | Employees have assigned roles |
| Employee → Attendance | 1 to Many | Daily attendance records |
| Employee → Payroll | 1 to Many | Monthly payroll records |
| Category → Menu Item | 1 to Many | Category contains items |
| Menu Item → Deal | Many to Many | Items in multiple deals |
| Order → Order Item | 1 to Many | Order has line items |
| Order → Invoice | 1 to 1 | Order generates invoice |
| Order → Table | 1 to 1 | Dine-in order at table |
| Inventory → Menu Item | Many to Many | Ingredients used in items |
| Offer → Menu Item | Many to Many | Offers apply to items |

---

## 7. Database Schema

### 7.1 Tables Overview

| # | Table Name | Purpose |
|---|------------|---------|
| 1 | customers | Customer profiles and loyalty |
| 2 | employees | Staff accounts and permissions |
| 3 | categories | Menu categories |
| 4 | menu_items | Food products |
| 5 | deals | Combo offers |
| 6 | orders | Order transactions |
| 7 | order_items | Order line items |
| 8 | invoices | Payment records |
| 9 | restaurant_tables | Table management |
| 10 | inventory | Stock tracking |
| 11 | attendance | Time records |
| 12 | payroll | Salary processing |
| 13 | special_offers | Promotions |
| 14 | reviews | Customer feedback |
| 15 | notifications | Alerts and messages |
| 16 | audit_logs | Activity tracking |

### 7.2 Security Features

- **Row Level Security (RLS):** Database-level access control
- **JWT Authentication:** Secure token-based auth
- **OTP Verification:** Two-step login process
- **2FA Support:** Optional two-factor authentication
- **Rate Limiting:** API request throttling
- **Audit Logging:** Complete activity trail

---

## 8. System Features Summary

### 8.1 Customer Features
- Responsive menu browsing
- Real-time order tracking
- Multiple payment options
- Loyalty points system
- Push notifications
- Review and ratings
- Favorites management
- Order history

### 8.2 Employee Portal Features
- Role-based dashboard
- Kitchen display system
- Table management
- Delivery tracking
- Attendance recording
- Tips and earnings view

### 8.3 Management Features
- Sales analytics
- Inventory management
- Menu management
- Deal/offer creation
- Customer insights
- Staff scheduling

### 8.4 Admin Features
- Employee management
- Payroll processing
- System configuration
- Audit logs
- Database backup
- Loyalty program settings

---

## Appendix: Diagram Files

| File | Description |
|------|-------------|
| `use-case-diagram.puml` | Shows all actors and their interactions with system features |
| `activity-diagram.puml` | Complete order flow with all 7 roles in swimlanes |
| `class-diagram.puml` | Business entities and their relationships |

### Rendering Instructions

1. **VS Code:** Install PlantUML extension, press `Alt+D`
2. **Online:** Use plantuml.com/plantuml
3. **Command Line:** `java -jar plantuml.jar diagram.puml`

### Converting to Word

1. **Pandoc:** `pandoc methodology.md -o methodology.docx`
2. **VS Code:** Use "Markdown PDF" extension
3. **Online:** Use markdowntoword.com or similar

---

*© 2026 Zoiro Broast Hub - All Rights Reserved*
