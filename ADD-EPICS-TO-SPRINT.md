# Add All 5 Epics to One Sprint - Quick Guide

## 🎯 Your 5 Epics to Add:

1. **FFR-9** - Authentication & Security System
2. **FFR-11** - Order Management & Tracking System  
3. **FFR-12** - Employee & Payroll Management
4. **FFR-14** - Menu & Inventory Management
5. **FFR-15** - Customer Portal & Loyalty System

Plus all their child stories:
- FFR-10, FFR-13, FFR-16, FFR-17, FFR-18

---

## 📋 Step-by-Step Instructions

### Step 1: Go to Your Backlog

**URL**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/backlog

This will show:
- All unassigned issues in the **Backlog** section at the bottom
- Option to create sprints at the top

---

### Step 2: Create Your Sprint

1. At the top of the page, click the **"Create sprint"** button
2. A new empty sprint will appear with default name "FFR Sprint X"
3. Click the sprint name to edit it
4. Rename to: **"Sprint 1 - All Core Features"**
5. (Optional) Set dates:
   - Start: Today (Feb 26, 2026)
   - End: 4 weeks from today (Mar 25, 2026) - longer sprint for 5 epics

---

### Step 3: Add All Epics to the Sprint

#### Method 1: Drag & Drop (Easiest)

1. In the **Backlog** section at the bottom, find your epics:
   - FFR-9 (Authentication)
   - FFR-11 (Order Management)
   - FFR-12 (Employee & Payroll)
   - FFR-14 (Menu & Inventory)
   - FFR-15 (Customer Portal)

2. **Drag each epic** from the Backlog section UP into "Sprint 1"
3. The epic will move into the sprint container

#### Method 2: Bulk Select (Faster for Multiple Issues)

1. In the Backlog, hold **Ctrl** (Windows) or **Cmd** (Mac)
2. Click each epic: FFR-9, FFR-11, FFR-12, FFR-14, FFR-15
3. Once all 5 are selected, right-click
4. Choose **"Move to sprint"** → **"Sprint 1"**

---

### Step 4: Add All Stories to the Sprint

Add these stories to Sprint 1 as well:
- FFR-10 - OTP-based Registration
- FFR-13 - Enable 2FA
- FFR-16 - Customer Profile Management
- FFR-17 - Place Order Online
- FFR-18 - Employee Self-Service Portal

Same methods:
- **Drag & drop** each story into Sprint 1, OR
- **Select all** (Ctrl/Cmd + click) → Right-click → "Move to sprint"

---

### Step 5: Verify Sprint Contents

Your Sprint 1 should now contain:

```
Sprint 1 - All Core Features
├── FFR-9: Authentication & Security System (Epic)
│   ├── FFR-10: OTP-based Registration (Story)
│   └── FFR-13: Enable 2FA (Story)
│
├── FFR-11: Order Management & Tracking System (Epic)
│   └── FFR-17: Place Order Online (Story)
│
├── FFR-12: Employee & Payroll Management (Epic)
│   └── FFR-18: Employee Self-Service Portal (Story)
│
├── FFR-14: Menu & Inventory Management (Epic)
│   └── (Story to be added)
│
└── FFR-15: Customer Portal & Loyalty System (Epic)
    └── FFR-16: Customer Profile Management (Story)
```

**Total Issues in Sprint**: 10 (5 epics + 5 stories)

---

### Step 6: Start the Sprint

1. Once all issues are in the sprint, click **"Start sprint"** button
2. A dialog will appear with options:
   - **Sprint name**: "Sprint 1 - All Core Features"
   - **Duration**: 4 weeks recommended
   - **Start date**: Today
   - **End date**: Auto-calculated
   - **Sprint goal**: (Optional) "Deliver core functionality across all 5 major feature areas"

3. Click **"Start"** button

4. You'll be taken to the **Active Sprint Board** where you can:
   - See all issues organized by status
   - Move cards from "To Do" → "In Progress" → "Done"
   - Track sprint progress

---

## 🎨 Alternative: Using Jira API (Advanced)

If you want to automate this, you can use the Jira REST API:

### Find Sprint ID

```bash
curl -X GET \
  'https://forlaptop7172.atlassian.net/rest/agile/1.0/board/{boardId}/sprint' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Create Sprint

```bash
curl -X POST \
  'https://forlaptop7172.atlassian.net/rest/agile/1.0/sprint' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Sprint 1 - All Core Features",
    "originBoardId": YOUR_BOARD_ID,
    "goal": "Deliver core functionality across all 5 major feature areas"
  }'
```

### Add Issues to Sprint

```bash
curl -X POST \
  'https://forlaptop7172.atlassian.net/rest/agile/1.0/sprint/{sprintId}/issue' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "issues": ["FFR-9", "FFR-10", "FFR-11", "FFR-12", "FFR-13", "FFR-14", "FFR-15", "FFR-16", "FFR-17", "FFR-18"]
  }'
```

---

## 📊 Sprint Organization Tips

### Epic Priority Order (Recommended Work Sequence):

1. **🔐 FFR-9: Authentication** (First - foundation for everything)
   - FFR-10: OTP Registration
   - FFR-13: 2FA Setup

2. **🍽️ FFR-14: Menu & Inventory** (Second - needed for orders)
   - Add menu items
   - Upload images

3. **🛒 FFR-11: Order Management** (Third - core business function)
   - FFR-17: Place orders
   - Real-time tracking

4. **👥 FFR-12: Employee & Payroll** (Fourth - internal tools)
   - FFR-18: Self-service portal
   - Attendance tracking

5. **⭐ FFR-15: Customer Portal** (Last - enhancement features)
   - FFR-16: Profile management
   - Loyalty points

### Set Story Points

Assign points to better track progress:
- Small stories (2-4 hours): **2 points**
- Medium stories (1 day): **5 points**
- Large stories (2-3 days): **8 points**
- Very large (1 week): **13 points**

Suggested points:
- FFR-10: 5 pts
- FFR-13: 5 pts
- FFR-16: 5 pts
- FFR-17: 13 pts (largest story)
- FFR-18: 8 pts

**Total Sprint Capacity**: ~36 story points

---

## ✅ Quick Checklist

- [ ] Go to Backlog view
- [ ] Click "Create sprint"
- [ ] Rename sprint to "Sprint 1 - All Core Features"
- [ ] Drag FFR-9, FFR-11, FFR-12, FFR-14, FFR-15 into sprint
- [ ] Drag FFR-10, FFR-13, FFR-16, FFR-17, FFR-18 into sprint
- [ ] Verify 10 issues are in the sprint
- [ ] Click "Start sprint"
- [ ] Set 4-week duration
- [ ] Add sprint goal (optional)
- [ ] Confirm and start

---

## 🔗 Direct Links

- **Backlog (Start Here)**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/backlog
- **Board View**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/board
- **Roadmap**: https://forlaptop7172.atlassian.net/jira/software/projects/FFR/roadmap

---

## 🚀 After Starting Sprint

Your sprint board will show:
- **To Do** column: All 10 issues initially
- **In Progress**: Drag issues here when working
- **Done**: Drag when completed

**Daily workflow:**
1. Pick highest priority item from "To Do"
2. Move to "In Progress" when starting
3. Work on it
4. Move to "Done" when finished
5. Repeat

---

Generated: February 26, 2026
Ready to organize your sprint! 🎯
