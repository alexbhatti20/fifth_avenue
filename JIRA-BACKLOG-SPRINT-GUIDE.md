# Jira Backlog & Sprint Setup Guide

## 📋 Current Status

Based on the epics we've created:
- ✅ **FFR-9**: Authentication & Security System
- ✅ **FFR-10**: OTP-based Registration (Story under FFR-9)
- ✅ **FFR-11**: Order Management & Tracking System
- ✅ **FFR-12**: Employee & Payroll Management
- ✅ **FFR-13**: Menu & Inventory Management (if created)
- ⏳ **Customer Portal & Loyalty System** (pending)

---

## 🎯 Proper Agile Workflow Setup

### Step 1: Access Your Backlog

1. Go to: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/board
2. Click on **"Backlog"** in the left sidebar
3. You'll see:
   - **Backlog** section (unassigned issues)
   - **Sprint** sections (active/future sprints)
   - **Epics** panel on the right

---

### Step 2: Create User Stories for Each Epic

For each epic, create the following user stories and tasks. You can do this by:
- Click **"+ Create issue"** in the backlog
- Select issue type (Story/Task)
- Link to Epic using the "Epic Link" field

#### Epic 1: Authentication & Security (FFR-9)

**Stories to Create:**

1. **Story: Enable 2FA with Google Authenticator**
   ```
   As a portal user, I want to enable 2FA using Google Authenticator, 
   so that my account has extra security.
   
   Acceptance Criteria:
   - Access 2FA settings in security tab
   - System generates QR code and manual entry key
   - User scans QR with Google Authenticator
   - Enter 6-digit verification code
   - System saves TOTP secret to database
   - 2FA required on subsequent logins
   
   Story Points: 5
   Priority: High
   ```

2. **Task: Implement JWT Token Authentication**
   ```
   Implement JWT token authentication with secure HTTP-only cookies.
   
   Technical Requirements:
   - Generate JWT tokens with user claims (id, email, role)
   - Store tokens in HTTP-only cookies
   - Token refresh mechanism
   - Validate tokens on protected routes
   - Handle token expiration
   - Clear tokens on logout
   - Use lib/jwt.ts and lib/cookies.ts
   
   Story Points: 8
   Priority: High
   ```

3. **Task: Setup Rate Limiting with Redis**
   ```
   Implement rate limiting for auth endpoints using Redis.
   
   Technical Requirements:
   - Use Upstash Redis for distributed rate limiting
   - Limit auth endpoints to 5 req/min per IP
   - Store counters in Redis with TTL
   - Return 429 status when exceeded
   - Implement in lib/rate-limit.ts
   
   Story Points: 3
   Priority: Medium
   ```

#### Epic 2: Order Management (FFR-11)

**Stories to Create:**

1. **Story: Place Order Online**
   ```
   As a customer, I want to place orders online by selecting menu items.
   
   Acceptance Criteria:
   - Browse menu items by category
   - Add items to cart with customizations
   - View cart with total price
   - Apply promo codes for discounts
   - Choose delivery or pickup
   - Receive order confirmation email
   
   Story Points: 13
   Priority: High
   ```

2. **Story: Track Order Status in Real-time**
   ```
   As a customer, I want to track my order status in real-time.
   
   Acceptance Criteria:
   - View order status (Pending, Preparing, Ready, Delivered)
   - Receive real-time updates via WebSocket
   - See estimated completion time
   - Get notifications on status changes
   - View order details and items
   
   Story Points: 8
   Priority: High
   ```

3. **Task: Implement Create Order RPC**
   ```
   Create the create-order-rpc stored procedure.
   
   Technical Requirements:
   - Validate menu items and availability
   - Calculate total with tax and discounts
   - Create order record with auto-generated ID
   - Insert order items with quantities
   - Apply promo code if provided
   - Return order ID and confirmation
   - File: supabase/create-order-rpc.sql
   
   Story Points: 5
   Priority: High
   ```

4. **Task: Setup Real-time Order Updates**
   ```
   Implement real-time order status updates using Supabase.
   
   Technical Requirements:
   - Subscribe to orders table changes
   - Filter by customer/employee ID
   - Update UI on status changes
   - Handle connection errors gracefully
   - Implement in lib/realtime-manager.ts
   - Deduplicate subscriptions
   
   Story Points: 5
   Priority: Medium
   ```

#### Epic 3: Employee & Payroll (FFR-12)

**Stories to Create:**

1. **Story: Employee Self-Service Portal**
   ```
   As an employee, I want a self-service portal to view my schedule and payroll.
   
   Acceptance Criteria:
   - View work schedule and shifts
   - Clock in/out for attendance
   - View attendance history
   - See payroll statements
   - Request time off
   - Update personal information
   
   Story Points: 13
   Priority: Medium
   ```

2. **Story: Automated Payroll Calculation**
   ```
   As an admin, I want automated payroll calculation based on attendance.
   
   Acceptance Criteria:
   - Calculate hours worked from attendance
   - Apply hourly/salary rates
   - Include overtime calculations
   - Deduct taxes and benefits
   - Generate payroll reports
   - Export to PDF
   
   Story Points: 13
   Priority: Medium
   ```

3. **Task: Implement Attendance Clock System**
   ```
   Create attendance tracking with clock-in/out functionality.
   
   Technical Requirements:
   - Clock-in API endpoint with timestamp
   - Clock-out with automatic break calculation
   - Prevent duplicate clock-ins
   - Store GPS location (optional)
   - Calculate total hours worked
   - File: supabase/attendance-rpc.sql
   
   Story Points: 8
   Priority: Medium
   ```

4. **Task: Generate Payroll PDF Reports**
   ```
   Implement PDF generation for payroll statements.
   
   Technical Requirements:
   - Use lib/payroll-pdf.ts
   - Include employee details and period
   - Show hours worked and rate
   - Calculate gross and net pay
   - Add company branding
   - Email PDF to employee
   
   Story Points: 5
   Priority: Low
   ```

#### Epic 4: Menu & Inventory (FFR-13)

**Stories to Create:**

1. **Story: Manage Menu Items with Images**
   ```
   As an admin, I want to manage menu items with images.
   
   Acceptance Criteria:
   - Create new menu item with details
   - Upload item image (JPEG/PNG/WebP, max 5MB)
   - Edit existing item information
   - Delete items with confirmation
   - Organize items by category
   - Set pricing and availability
   
   Story Points: 8
   Priority: High
   ```

2. **Story: Track Inventory Levels**
   ```
   As a manager, I want to track inventory levels for ingredients.
   
   Acceptance Criteria:
   - View current inventory levels
   - Set low stock thresholds
   - Receive alerts when stock is low
   - Update quantities on deliveries
   - Track usage per order
   - Generate inventory reports
   
   Story Points: 8
   Priority: Medium
   ```

3. **Task: Implement Image Upload API**
   ```
   Create image upload system using Supabase Storage.
   
   Technical Requirements:
   - Accept JPEG, PNG, WebP formats
   - Validate file size (max 5MB)
   - Upload to Supabase Storage bucket
   - Generate public URL
   - Rate limit to 30 requests/min
   - Handle upload errors
   - File: /api/upload/image
   
   Story Points: 5
   Priority: High
   ```

4. **Task: Setup Cache Invalidation**
   ```
   Implement Redis cache invalidation when menu items updated.
   
   Technical Requirements:
   - Clear menu cache on CRUD operations
   - Invalidate category cache
   - Update ISR pages
   - Trigger revalidation for affected routes
   - Use lib/cache.ts helper functions
   
   Story Points: 3
   Priority: Medium
   ```

#### Epic 5: Customer Portal & Loyalty

**Stories to Create:**

1. **Story: Customer Profile Management**
   ```
   As a customer, I want to manage my profile and delivery addresses.
   
   Acceptance Criteria:
   - View and edit profile details
   - Add multiple delivery addresses
   - Save payment methods
   - View loyalty points balance
   - Set notification preferences
   - Change password or enable 2FA
   
   Story Points: 8
   Priority: Medium
   ```

2. **Story: Loyalty Points & Rewards**
   ```
   As a customer, I want to earn loyalty points and redeem rewards.
   
   Acceptance Criteria:
   - Earn points on every order (1 point per $1)
   - View points balance in profile
   - Browse available rewards
   - Redeem points for discounts
   - See points history
   - Get bonus points on special occasions
   
   Story Points: 13
   Priority: Low
   ```

3. **Task: Implement Promo Code System**
   ```
   Create promo code application and validation system.
   
   Technical Requirements:
   - Validate promo code on checkout
   - Check expiry date and usage limits
   - Apply percentage or fixed discounts
   - Limit to specific customers/items
   - Track promo code usage
   - File: supabase/apply-promo-code-rpc.sql
   
   Story Points: 5
   Priority: Medium
   ```

4. **Task: Build Customer Review System**
   ```
   Implement customer review and rating functionality.
   
   Technical Requirements:
   - Submit review with star rating
   - Add photos to reviews
   - Moderate reviews (admin approval)
   - Display average ratings
   - Filter reviews by rating
   - Implement in /api/admin/reviews
   
   Story Points: 8
   Priority: Low
   ```

---

### Step 3: Create Sprints

#### Creating a Sprint in Jira:

1. In the **Backlog** view, click **"Create sprint"** at the top
2. Name it appropriately (e.g., "Sprint 1: Authentication Foundation")
3. Set sprint duration (typically 2 weeks)
4. Set start and end dates

#### Recommended Sprint Plan:

**Sprint 1: Authentication Foundation (2 weeks)**
- Duration: 2 weeks
- Goal: "Complete core authentication system with OTP and JWT"
- Issues:
  - FFR-10: OTP-based Registration (5 pts)
  - Task: Implement JWT Token Authentication (8 pts)
  - Task: Setup Rate Limiting (3 pts)
  - **Total**: 16 story points

**Sprint 2: 2FA & Order Core (2 weeks)**
- Duration: 2 weeks
- Goal: "Add 2FA security and enable online ordering"
- Issues:
  - Story: Enable 2FA with Google Authenticator (5 pts)
  - Story: Place Order Online (13 pts)
  - **Total**: 18 story points

**Sprint 3: Real-time Order Tracking (2 weeks)**
- Duration: 2 weeks
- Goal: "Implement real-time order status tracking"
- Issues:
  - Story: Track Order Status (8 pts)
  - Task: Create Order RPC (5 pts)
  - Task: Real-time Updates (5 pts)
  - **Total**: 18 story points

**Sprint 4: Menu & Inventory (2 weeks)**
- Duration: 2 weeks
- Goal: "Complete menu management and inventory tracking"
- Issues:
  - Story: Manage Menu Items (8 pts)
  - Story: Track Inventory Levels (8 pts)
  - Task: Image Upload API (5 pts)
  - **Total**: 21 story points

**Sprint 5: Employee Management (2 weeks)**
- Duration: 2 weeks
- Goal: "Build employee portal and attendance system"
- Issues:
  - Story: Employee Self-Service Portal (13 pts)
  - Task: Attendance Clock System (8 pts)
  - **Total**: 21 story points

**Sprint 6: Payroll & Customer Features (2 weeks)**
- Duration: 2 weeks
- Goal: "Complete payroll automation and customer portal"
- Issues:
  - Story: Automated Payroll Calculation (13 pts)
  - Story: Customer Profile Management (8 pts)
  - **Total**: 21 story points

**Sprint 7: Loyalty & Polish (2 weeks)**
- Duration: 2 weeks
- Goal: "Implement loyalty system and final features"
- Issues:
  - Story: Loyalty Points & Rewards (13 pts)
  - Task: Promo Code System (5 pts)
  - Task: Customer Review System (8 pts)
  - **Total**: 26 story points

---

### Step 4: Drag Issues into Sprints

1. In the **Backlog** view, you'll see all created issues
2. Drag and drop issues from the **Backlog** section into the appropriate **Sprint**
3. Start with highest priority items first
4. Keep sprint velocity consistent (16-21 story points per 2-week sprint)

---

### Step 5: Start Your First Sprint

1. Click the **"Start sprint"** button on Sprint 1
2. Confirm sprint name and dates
3. Click **"Start"**
4. Your sprint board will now show:
   - **To Do** column (unstarted work)
   - **In Progress** column (currently working)
   - **Done** column (completed work)

---

### Step 6: Manage Sprint Board

#### Moving Issues Through Workflow:

1. **To Do → In Progress**: Drag issue when you start working on it
2. **In Progress → Done**: Drag issue when completed and tested
3. **Blocked**: Add a blocker comment if stuck

#### Best Practices:

- ✅ **Daily Standups**: Review board daily
- ✅ **Update Status**: Move cards as you work
- ✅ **Add Comments**: Document progress and blockers
- ✅ **Link PRs**: Link GitHub pull requests to issues
- ✅ **Log Time**: Track time spent (optional)

---

## 📊 Story Points Guide

Use Fibonacci sequence for estimation:
- **1-2 points**: Small tasks (1-4 hours)
- **3-5 points**: Medium tasks (4-8 hours)
- **8 points**: Large tasks (1-2 days)
- **13 points**: Very large stories (3-5 days)
- **21+ points**: Epic-sized, needs to be broken down

---

## 🎯 Quick Actions Checklist

- [ ] Create all user stories and tasks listed above
- [ ] Assign story points to each issue
- [ ] Set priority (High/Medium/Low) on each issue
- [ ] Link stories to their parent epics
- [ ] Create Sprint 1 and name it
- [ ] Drag Sprint 1 issues from backlog
- [ ] Start Sprint 1
- [ ] Begin development on highest priority item
- [ ] Move your first issue to "In Progress"

---

## 🔗 Useful Links

- **Board**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/board
- **Backlog**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/backlog
- **Reports**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/reports
- **Project Settings**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/settings

---

## 💡 Tips for Success

1. **Keep sprints focused**: Don't overload with too many story points
2. **Prioritize ruthlessly**: Always work on highest value first
3. **Review regularly**: Hold sprint retrospectives
4. **Update daily**: Keep the board current
5. **Communicate blockers**: Don't let issues sit in "Blocked" status

---

Generated: February 26, 2026
Project: FFR (Fast food restaurant)
