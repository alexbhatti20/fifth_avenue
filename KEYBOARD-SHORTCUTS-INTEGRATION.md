# Keyboard Shortcuts Integration Guide

## 🎯 Overview

The Zoiro Broast Hub features a comprehensive keyboard shortcuts system with:
- **Universal shortcuts** for navigation across all pages (Ctrl+H, Ctrl+O, etc.)
- **Page-specific shortcuts** that only work on designated pages (Alt+N, Alt+F, etc.)
- **Chrome default prevention** to ensure shortcuts work without browser interference
- **Customizable bindings** stored in localStorage
- **Settings UI** for users to configure their preferred shortcuts

## ⚙️ System Architecture

### Files Structure
```
hooks/
  └── useKeyboardShortcuts.tsx    # Main hook with shortcut definitions
lib/
  └── keyboard-shortcuts.ts       # Utilities for shortcuts management
components/portal/
  └── KeyboardShortcutsSettings.tsx   # Settings UI
  └── PortalProvider.tsx          # Global integration point
```

### How It Works

1. **Global Registration**: `useKeyboardShortcuts()` is called in `PortalProvider.tsx`
2. **Event Listening**: The hook listens for `keydown` events
3. **Page Filtering**: Only shortcuts for the current page are active
4. **Chrome Prevention**: Browser defaults are blocked for configured shortcuts
5. **Custom Events**: Page-specific shortcuts dispatch custom events

## 📝 Shortcut Categories

### 1. Navigation Shortcuts (Global)
Always active across all portal pages:
- `Ctrl+H` - Dashboard
- `Ctrl+O` - Orders
- `Ctrl+M` - Menu
- `Ctrl+K` - Kitchen
- `Ctrl+D` - Delivery
- `Ctrl+T` - Tables
- `Ctrl+B` - Billing
- `Ctrl+I` - Inventory
- `Ctrl+E` - Employees
- `Ctrl+U` - Customers
- `Ctrl+,` - Settings
- `Ctrl+N` - Notifications
- And more...

### 2. General Shortcuts
- `Ctrl+/` - Show keyboard shortcuts help
- `Alt+ArrowLeft` - Go back to previous page
- `F5` - Refresh current page

### 3. Search Shortcuts
- `Ctrl+K` - Open global search
- `Ctrl+Shift+O`  - Focus order search (on orders page)

### 4. Page-Specific Shortcuts
Active only on their designated pages:

**Orders Page** (`/portal/orders`):
- `Alt+N` - Create new order
- `Alt+F` - Focus search/filter
- `Alt+R` - Refresh orders
- `Alt+1` - All orders tab
- `Alt+2` - Pending tab
- `Alt+3` - Preparing tab

**Menu Page** (`/portal/menu`):
- `Alt+N` - Add new menu item
- `Alt+F` - Focus search
- `Alt+R` - Refresh menu
- `Alt+1` - Menu items tab
- `Alt+2` - Categories tab

**Billing Page** (`/portal/billing`):
- `Alt+F` - Focus search
- `Alt+R` - Refresh billing data
- `Alt+E` - Export data

**Kitchen Page** (`/portal/kitchen`):
- `Alt+F` - Focus search
- `Alt+R` - Refresh kitchen orders
- `Alt+1` - Pending orders tab
- `Alt+2` - Preparing orders tab

**Inventory Page** (`/portal/inventory`):
- `Alt+N` - Add new inventory item
- `Alt+F` - Focus search
- `Alt+R` - Refresh inventory

**Tables Page** (`/portal/tables`):
- `Alt+N` - Add new table
- `Alt+F` - Focus search
- `Alt+R` - Refresh table status

**Employees Page** (`/portal/employees`):
- `Alt+N` - Add new employee
- `Alt+F` - Focus search
- `Alt+R` - Refresh employee list

**Customers Page** (`/portal/customers`):
- `Alt+N` - Add new customer
- `Alt+F` - Focus search
- `Alt+R` - Refresh customer list

**Delivery Page** (`/portal/delivery`):
- `Alt+F` - Focus search
- `Alt+R` - Refresh deliveries
- `Alt+1` - Active deliveries tab
- `Alt+2` - Completed deliveries tab

## 🔌 Integration in Components

### Method 1: Custom Event Listeners (Recommended)

For actions that need to open dialogs, trigger state changes, or perform complex operations:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function OrdersClient() {
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const handleShortcut = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      switch (detail.action) {
        case 'orders:new':
          setIsNewOrderDialogOpen(true);
          break;
        
        case 'orders:refresh':
          // Your refresh logic
          refreshOrders();
          break;
        
        case 'orders:tab:all':
          setActiveTab('all');
          break;
        
        case 'orders:tab:pending':
          setActiveTab('pending');
          break;
        
        case 'orders:tab:preparing':
          setActiveTab('preparing');
          break;
      }
    };

    window.addEventListener('keyboard-shortcut', handleShortcut);
    
    return () => {
      window.removeEventListener('keyboard-shortcut', handleShortcut);
    };
  }, []);

  const refreshOrders = async () => {
    // Your refresh implementation
    toast.success('Orders refreshed');
  };

  return (
    <div>
      {/* Your component JSX */}
      <Dialog open={isNewOrderDialogOpen} onOpenChange={setIsNewOrderDialogOpen}>
        {/* New order dialog content */}
      </Dialog>
    </div>
  );
}
```

### Method 2: Automatic Focus (No Integration Needed)

Search/filter shortcuts automatically work if your component has:
```tsx
<Input 
  type="search" 
  placeholder="Search orders..." 
/>
```

The `Alt+F` shortcut will automatically focus any input with:
- `type="search"` attribute
- `placeholder` containing "search" or "filter" (case-insensitive)

### Method 3: Tab Switching

If you're using Radix UI Tabs:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function OrdersClient() {
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const handleShortcut = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      if (detail.action === 'orders:tab:all') setActiveTab('all');
      if (detail.action === 'orders:tab:pending') setActiveTab('pending');
      if (detail.action === 'orders:tab:preparing') setActiveTab('preparing');
    };

    window.addEventListener('keyboard-shortcut', handleShortcut);
    return () => window.removeEventListener('keyboard-shortcut', handleShortcut);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="preparing">Preparing</TabsTrigger>
      </TabsList>
      {/* Tab contents */}
    </Tabs>
  );
}
```

## 🚀 Adding New Shortcuts

### Step 1: Define the Shortcut

Edit `hooks/useKeyboardShortcuts.tsx`:

```tsx
{
  id: 'reports_export',
  name: 'Export Report',
  description: 'Export current report',
  defaultKey: 'Alt+E',
  category: 'page-specific',
  page: '/portal/reports',
  action: () => {
    window.dispatchEvent(new CustomEvent('keyboard-shortcut', { 
      detail: { action: 'reports:export' } 
    }));
  },
},
```

### Step 2: Handle the Event

In your component (`app/portal/reports/ReportsClient.tsx`):

```tsx
useEffect(() => {
  const handleShortcut = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    
    if (detail.action === 'reports:export') {
      exportReport();
    }
  };

  window.addEventListener('keyboard-shortcut', handleShortcut);
  return () => window.removeEventListener('keyboard-shortcut', handleShortcut);
}, []);
```

### Step 3: Update Settings UI (Optional)

The settings UI automatically displays all shortcuts based on their category. If you're adding to an existing page, no changes needed. For new pages, add to `pageNames` in `KeyboardShortcutsSettings.tsx`:

```tsx
const pageNames: Record<string, string> = {
  '/portal/orders': 'Orders',
  '/portal/reports': 'Reports', // Add your new page
  // ...
};
```

## 🎨 Best Practices

### 1. **Consistent Patterns**
- Use `Alt+N` for "New/Add" actions
- Use `Alt+F` for search/filter focus
- Use `Alt+R` for refresh operations
- Use `Alt+1`, `Alt+2`, etc. for tab switching
- Use `Alt+E` for export operations

### 2. **Avoid Conflicts**
Check existing shortcuts before adding new ones:
```tsx
// Search for existing shortcuts
grep -r "Alt+N" hooks/useKeyboardShortcuts.tsx
```

### 3. **User Feedback**
Show toast notifications when shortcuts are triggered:
```tsx
case 'orders:refresh':
  await refreshOrders();
  toast.success('Orders refreshed (Alt+R)');
  break;
```

### 4. **Accessibility**
- Always provide alternative ways to perform actions (buttons, menus)
- Show shortcuts in button tooltips or help text
- Document shortcuts in onboarding materials

### 5. **Testing**
Test shortcuts in different scenarios:
- [ ] Works on the correct page
- [ ] Doesn't work on other pages (for page-specific shortcuts)
- [ ] Doesn't trigger when typing in inputs (except Ctrl+/)
- [ ] Custom key bindings work after user changes them
- [ ] Chrome defaults are prevented

## 🔧 Troubleshooting

### Shortcut Not Working

**Check 1**: Are shortcuts enabled?
```tsx
// In browser console
localStorage.getItem('zoiro_keyboard_shortcuts_enabled')
// Should return: "true"
```

**Check 2**: Is the event listener registered?
```tsx
// Add console.log in your handler
const handleShortcut = (e: Event) => {
  console.log('Shortcut event:', (e as CustomEvent).detail);
  // ...
};
```

**Check 3**: Is the page path correct?
```tsx
// The page property must match the exact route
page: '/portal/orders'  // Correct
page: '/orders'         // Wrong
```

**Check 4**: Is there a conflict?
Check the console for any errors about conflicting shortcuts.

### Chrome Default Still Triggering

If a browser default is still active:
1. Add the shortcut to `CHROME_DEFAULTS_TO_PREVENT` in `lib/keyboard-shortcuts.ts`
2. The system will automatically prevent it

### Custom Events Not Firing

Make sure you're listening on the `window` object, not a specific element:
```tsx
// ✅ Correct
window.addEventListener('keyboard-shortcut', handler);

// ❌ Wrong
document.addEventListener('keyboard-shortcut', handler);
```

## 📊 System Status

View all registered shortcuts in Settings → Keyboard Shortcuts or press `Ctrl+/` for the help dialog.

### Toggle Shortcuts
Users can enable/disable all shortcuts globally using the switch in Keyboard Shortcuts settings.

### Customize Bindings
Users can click any shortcut to record a new key combination. The system validates:
- ✅ At least one modifier key required
- ✅ No conflicts with existing shortcuts
- ✅ Real-time preview while recording

### Reset Options
- Reset individual shortcut to default
- Reset all shortcuts to defaults

## 🎓 Examples

### Complete Integration Example

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export default function MenuClient() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('items');
  const [searchValue, setSearchValue] = useState('');

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleShortcut = (e: Event) => {
      const { action } = (e as CustomEvent).detail;
      
      switch (action) {
        case 'menu:add-item':
          setIsAddDialogOpen(true);
          toast.info('Add Item dialog opened (Alt+N)');
          break;
        
        case 'menu:refresh':
          refreshMenu();
          break;
        
        case 'menu:tab:items':
          setActiveTab('items');
          break;
        
        case 'menu:tab:categories':
          setActiveTab('categories');
          break;
      }
    };

    window.addEventListener('keyboard-shortcut', handleShortcut);
    return () => window.removeEventListener('keyboard-shortcut', handleShortcut);
  }, []);

  const refreshMenu = useCallback(async () => {
    // Your refresh logic
    toast.success('Menu refreshed (Alt+R)');
  }, []);

  return (
    <div>
      {/* Search input - Alt+F automatically focuses */}
      <Input
        type="search"
        placeholder="Search menu items..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />

      {/* Tabs - Alt+1 and Alt+2 switch between them */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        {/* Tab contents */}
      </Tabs>

      {/* Add dialog - Alt+N opens */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        {/* Dialog content */}
      </Dialog>
    </div>
  );
}
```

## 📋 Event Action Reference

| Event Action | Page | Default Shortcut | Description |
|-------------|------|------------------|-------------|
| `orders:new` | Orders | Alt+N | Open new order dialog |
| `orders:refresh` | Orders | Alt+R | Refresh orders list |
| `orders:tab:all` | Orders | Alt+1 | Switch to all orders |
| `orders:tab:pending` | Orders | Alt+2 | Switch to pending |
| `orders:tab:preparing` | Orders | Alt+3 | Switch to preparing |
| `menu:add-item` | Menu | Alt+N | Open add item dialog |
| `menu:refresh` | Menu | Alt+R | Refresh menu data |
| `menu:tab:items` | Menu | Alt+1 | Switch to items tab |
| `menu:tab:categories` | Menu | Alt+2 | Switch to categories tab |
| `billing:refresh` | Billing | Alt+R | Refresh billing data |
| `billing:export` | Billing | Alt+E | Export billing data |
| `kitchen:refresh` | Kitchen | Alt+R | Refresh kitchen orders |
| `kitchen:tab:pending` | Kitchen | Alt+1 | Switch to pending |
| `kitchen:tab:preparing` | Kitchen | Alt+2 | Switch to preparing |
| `inventory:add` | Inventory | Alt+N | Open add item dialog |
| `inventory:refresh` | Inventory | Alt+R | Refresh inventory |
| `tables:add` | Tables | Alt+N | Open add table dialog |
| `tables:refresh` | Tables | Alt+R | Refresh table status |
| `employees:add` | Employees | Alt+N | Open add employee dialog |
| `employees:refresh` | Employees | Alt+R | Refresh employee list |
| `customers:add` | Customers | Alt+N | Open add customer dialog |
| `customers:refresh` | Customers | Alt+R | Refresh customer list |
| `delivery:refresh` | Delivery | Alt+R | Refresh deliveries |
| `delivery:tab:active` | Delivery | Alt+1 | Switch to active |
| `delivery:tab:completed` | Delivery | Alt+2 | Switch to completed |

---

## ✨ Summary

The keyboard shortcuts system is designed to be:
- **Easy to use**: Works out of the box for common patterns
- **Easy to extend**: Add new shortcuts with minimal code  
- **User-friendly**: Customizable bindings with settings UI
- **Reliable**: Chrome default prevention ensures shortcuts work
- **Accessible**: Always provide alternative interaction methods

For questions or issues, refer to this guide or check the implementation in `hooks/useKeyboardShortcuts.tsx`.
