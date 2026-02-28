# Jira Sprint Setup Guide

## ✅ Successfully Created Issues

### 🎯 Epics (5 total)

1. **[FFR-9: Authentication & Security System](https://forlaptop7172.atlassian.net/browse/FFR-9)**
   - OTP-based authentication, 2FA, JWT tokens, rate limiting

2. **[FFR-11: Order Management & Tracking System](https://forlaptop7172.atlassian.net/browse/FFR-11)**
   - Order placement, real-time tracking, kitchen workflow, billing

3. **[FFR-12: Employee & Payroll Management](https://forlaptop7172.atlassian.net/browse/FFR-12)**
   - Employee CRUD, attendance, payroll calculations, permissions

4. **[FFR-14: Menu & Inventory Management](https://forlaptop7172.atlassian.net/browse/FFR-14)**
   - Menu CRUD, image uploads, inventory tracking, stock alerts

5. **[FFR-15: Customer Portal & Loyalty System](https://forlaptop7172.atlassian.net/browse/FFR-15)**
   - Customer profiles, order history, loyalty points, reviews

### 📖 Stories (6 total)

1. **[FFR-10: OTP-based Registration](https://forlaptop7172.atlassian.net/browse/FFR-10)**
   - Parent Epic: FFR-9

2. **[FFR-13: Enable 2FA with Google Authenticator](https://forlaptop7172.atlassian.net/browse/FFR-13)**
   - Parent Epic: FFR-9

3. **[FFR-17: Place Order Online](https://forlaptop7172.atlassian.net/browse/FFR-17)**
   - Parent Epic: FFR-11

4. **[FFR-18: Employee Self-Service Portal](https://forlaptop7172.atlassian.net/browse/FFR-18)**
   - Parent Epic: FFR-12

5. **[FFR-16: Customer Profile Management](https://forlaptop7172.atlassian.net/browse/FFR-16)**
   - Parent Epic: FFR-15

6. **⏳ Missing: Manage Menu Items Story** (needs to be created)
   - Parent Epic: FFR-14

---

## 📋 Manual Steps to Complete Setup

### Step 1: Create Missing Story for Menu & Inventory

1. Go to https://forlaptop7172.atlassian.net/jira/software/projects/FFR/board
2. Click **"Create"** button
3. Fill in:
   - **Project**: Fast food restaurant (FFR)
   - **Issue Type**: Story
   - **Summary**: `User Story: Manage Menu Items with Images`
   - **Description**:
```
As an admin, I want to create, edit, and delete menu items with images, so that I can keep the menu updated.

Acceptance Criteria:
- Create new menu item with details
- Upload item image (JPEG/PNG/WebP, max 5MB)
- Edit existing item information
- Delete items with confirmation
- Organize items by category
- Set pricing and availability
```
4. Click **Create**

### Step 2: Link Stories to Their Parent Epics

For each story, add it to its parent epic:

#### Option A: Using Epic Link Field
1. Open each story (FFR-10, FFR-13, FFR-16, FFR-17, FFR-18, and the new Menu story)
2. Click on the **Epic Link** field
3. Select the appropriate parent epic:
   - FFR-10 → Epic: FFR-9 (Authentication)
   - FFR-13 → Epic: FFR-9 (Authentication)  
   - FFR-17 → Epic: FFR-11 (Order Management)
   - FFR-18 → Epic: FFR-12 (Employee & Payroll)
   - New Menu Story → Epic: FFR-14 (Menu & Inventory)
   - FFR-16 → Epic: FFR-15 (Customer Portal)

#### Option B: From Epic Panel
1. Open an Epic (e.g., FFR-11)
2. On the right panel, find "Child issues" section
3. Click **"Add child issue"** or **"Link issue"**
4. Select the relevant story

### Step 3: Create a Sprint

1. Go to **Backlog view**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/backlog
2. Click **"Create sprint"** button at the top of the backlog
3. Name it: `Sprint 1 - Core Features`
4. Set dates:
   - Start Date: Today (Feb 26, 2026)
   - End Date: 2 weeks from now (Mar 12, 2026)
5. Click **Create**

### Step 4: Add All Epics and Stories to Sprint

#### Add Epics to Sprint:
1. In the Backlog view, find each epic in the backlog list
2. Drag and drop these epics into "Sprint 1":
   - FFR-9: Authentication & Security System
   - FFR-11: Order Management & Tracking System
   - FFR-12: Employee & Payroll Management
   - FFR-14: Menu & Inventory Management
   - FFR-15: Customer Portal & Loyalty System

#### Add Stories to Sprint:
1. Drag and drop these stories into "Sprint 1":
   - FFR-10: OTP-based Registration
   - FFR-13: Enable 2FA
   - FFR-16: Customer Profile Management
   - FFR-17: Place Order Online
   - FFR-18: Employee Self-Service Portal
   - New Menu Story

### Step 5: Start the Sprint

1. Once all issues are added to the sprint, click **"Start sprint"**
2. Confirm the sprint details
3. Click **"Start"**

### Step 6: Set Story Points (Optional but Recommended)

Assign story points to each story for better tracking:

1. Open each story
2. Find the **"Story Points"** field
3. Assign points based on complexity:
   - **FFR-10** (OTP Registration): 5 points
   - **FFR-13** (Enable 2FA): 5 points
   - **FFR-17** (Place Order): 8 points
   - **FFR-18** (Employee Portal): 8 points
   - **FFR-16** (Customer Profile): 5 points
   - **Menu Story**: 5 points

**Total Sprint Points**: ~36 points

---

## 🎨 Organize Board Columns

Set up your board with proper workflow columns:

1. Go to **Board Settings**: Click ⚙️ icon on board
2. Click **Columns** in left menu
3. Create these columns:
   - **To Do** (unmapped)
   - **In Progress** (in progress)
   - **Code Review** (optional)
   - **Testing** (optional)
   - **Done** (done)

---

## 📊 Sprint Structure Overview

```
Sprint 1: Core Features (2 weeks)
├── Epic: FFR-9 - Authentication & Security
│   ├── FFR-10: OTP-based Registration
│   └── FFR-13: Enable 2FA with Google Authenticator
│
├── Epic: FFR-11 - Order Management & Tracking
│   └── FFR-17: Place Order Online
│
├── Epic: FFR-12 - Employee & Payroll Management
│   └── FFR-18: Employee Self-Service Portal
│
├── Epic: FFR-14 - Menu & Inventory Management
│   └── [New Story]: Manage Menu Items with Images
│
└── Epic: FFR-15 - Customer Portal & Loyalty
    └── FFR-16: Customer Profile Management
```

---

## 🔗 Quick Links

- **Project Board**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/board
- **Backlog**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/backlog
- **Roadmap**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/roadmap
- **Reports**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/reports

---

## 🎯 Next Actions for Development

1. ✅ Complete Sprint setup (follow steps above)
2. **Assign issues** to team members
3. **Start working** on highest priority stories:
   - Start with Authentication (FFR-9 epic)
   - Then Order Management (FFR-11 epic)
4. **Daily standups** to track progress
5. **Update story status** as you work (To Do → In Progress → Done)
6. **Sprint Review** at the end of 2 weeks

---

## 📈 Success Metrics

Track these during the sprint:

- **Velocity**: Story points completed per sprint
- **Burndown Chart**: Track remaining work daily
- **Cycle Time**: Time from "In Progress" to "Done"
- **Completion Rate**: % of stories finished vs planned

---

Generated: February 26, 2026
All 5 Epics Created ✅
6/7 Stories Created ✅
Ready for Sprint Organization 🚀
