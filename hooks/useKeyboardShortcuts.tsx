'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  matchesKeyCombo, 
  getShortcutKey, 
  areShortcutsEnabled,
  isChromDefaultShortcut,
  shouldBlockBrowserDefault,
  dispatchShortcutEvent,
  focusAndSelectInput,
  findSearchInput,
  type KeyboardShortcut 
} from '@/lib/keyboard-shortcuts';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  const [enabled, setEnabled] = useState(true);
  const executingRef = useRef(false);
  const lastExecutionRef = useRef<{ [key: string]: number }>({});

  // CRITICAL: Install browser shortcut blocker FIRST - before any other effect
  // Uses preventDefault only (NOT stopImmediatePropagation) so that subsequent
  // handleKeyDown listeners can still execute the mapped app shortcut action.
  useEffect(() => {
    const emergencyBlocker = (e: KeyboardEvent) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      
      // Block Ctrl+N (new window) - allow handleKeyDown to fire nav_notifications
      if (e.ctrlKey && key === 'n' && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Block Ctrl+Shift+N (incognito)
      if (e.ctrlKey && e.shiftKey && key === 'n') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Block Ctrl+T (new tab) - allow handleKeyDown to fire nav_tables
      if (e.ctrlKey && key === 't' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Block Ctrl+W (close tab)
      if (e.ctrlKey && key === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };
    
    // Install at both document and window level with highest priority
    document.addEventListener('keydown', emergencyBlocker, { capture: true, passive: false });
    window.addEventListener('keydown', emergencyBlocker, { capture: true, passive: false });
    
    return () => {
      document.removeEventListener('keydown', emergencyBlocker, { capture: true } as any);
      window.removeEventListener('keydown', emergencyBlocker, { capture: true } as any);
    };
  }, []); // Empty deps - always active, installed first

  // Check enabled state from localStorage
  useEffect(() => {
    setEnabled(areShortcutsEnabled());

    // Listen for enabled state changes
    const handleEnabledChange = (e: CustomEvent) => {
      setEnabled(e.detail.enabled);
    };

    window.addEventListener('shortcuts-enabled-changed', handleEnabledChange as EventListener);
    return () => {
      window.removeEventListener('shortcuts-enabled-changed', handleEnabledChange as EventListener);
    };
  }, []);

  // Define all available shortcuts
  const getShortcuts = useCallback((): KeyboardShortcut[] => [
    // Navigation - Main Pages
    {
      id: 'nav_dashboard',
      name: 'Dashboard',
      description: 'Go to dashboard',
      defaultKey: 'Ctrl+H',
      category: 'navigation',
      action: () => router.push('/portal'),
    },
    {
      id: 'nav_orders',
      name: 'Orders',
      description: 'Go to orders page',
      defaultKey: 'Ctrl+O',
      category: 'navigation',
      action: () => router.push('/portal/orders'),
    },
    {
      id: 'nav_menu',
      name: 'Menu',
      description: 'Go to menu management',
      defaultKey: 'Ctrl+M',
      category: 'navigation',
      action: () => router.push('/portal/menu'),
    },
    {
      id: 'nav_kitchen',
      name: 'Kitchen',
      description: 'Go to kitchen',
      defaultKey: 'Ctrl+K',
      category: 'navigation',
      action: () => router.push('/portal/kitchen'),
    },
    {
      id: 'nav_delivery',
      name: 'Delivery',
      description: 'Go to delivery',
      defaultKey: 'Ctrl+D',
      category: 'navigation',
      action: () => router.push('/portal/delivery'),
    },
    {
      id: 'nav_tables',
      name: 'Tables',
      description: 'Go to table management',
      defaultKey: 'Ctrl+T',
      category: 'navigation',
      action: () => router.push('/portal/tables'),
    },
    {
      id: 'nav_billing',
      name: 'Billing',
      description: 'Go to billing',
      defaultKey: 'Ctrl+B',
      category: 'navigation',
      action: () => router.push('/portal/billing'),
    },
    {
      id: 'nav_inventory',
      name: 'Inventory',
      description: 'Go to inventory',
      defaultKey: 'Ctrl+I',
      category: 'navigation',
      action: () => router.push('/portal/inventory'),
    },
    {
      id: 'nav_employees',
      name: 'Employees',
      description: 'Go to employees',
      defaultKey: 'Ctrl+E',
      category: 'navigation',
      action: () => router.push('/portal/employees'),
    },
    {
      id: 'nav_attendance',
      name: 'Attendance',
      description: 'Go to attendance',
      defaultKey: 'Ctrl+Shift+A',
      category: 'navigation',
      action: () => router.push('/portal/attendance'),
    },
    {
      id: 'nav_payroll',
      name: 'Payroll',
      description: 'Go to payroll',
      defaultKey: 'Ctrl+P',
      category: 'navigation',
      action: () => router.push('/portal/payroll'),
    },
    {
      id: 'nav_reports',
      name: 'Reports',
      description: 'Go to reports',
      defaultKey: 'Ctrl+R',
      category: 'navigation',
      action: () => router.push('/portal/reports'),
    },
    {
      id: 'nav_perks',
      name: 'Perks',
      description: 'Go to perks/deals',
      defaultKey: 'Ctrl+Shift+P',
      category: 'navigation',
      action: () => router.push('/portal/perks'),
    },
    {
      id: 'nav_reviews',
      name: 'Reviews',
      description: 'Go to reviews',
      defaultKey: 'Ctrl+Shift+R',
      category: 'navigation',
      action: () => router.push('/portal/reviews'),
    },
    {
      id: 'nav_messages',
      name: 'Messages',
      description: 'Go to messages',
      defaultKey: 'Ctrl+Shift+M',
      category: 'navigation',
      action: () => router.push('/portal/messages'),
    },
    {
      id: 'nav_backup',
      name: 'Backup',
      description: 'Go to backup',
      defaultKey: 'Ctrl+Shift+B',
      category: 'navigation',
      action: () => router.push('/portal/backup'),
    },
    {
      id: 'nav_notifications',
      name: 'Notifications',
      description: 'Go to notifications',
      defaultKey: 'Ctrl+N',
      category: 'navigation',
      action: () => router.push('/portal/notifications'),
    },
    {
      id: 'nav_settings',
      name: 'Settings',
      description: 'Go to settings',
      defaultKey: 'Ctrl+,',
      category: 'navigation',
      action: () => router.push('/portal/settings'),
    },
    // Actions
    {
      id: 'action_refresh',
      name: 'Refresh Page',
      description: 'Refresh current page',
      defaultKey: 'F5',
      category: 'actions',
      action: () => window.location.reload(),
    },
    // Search
    {
      id: 'search_global',
      name: 'Global Search',
      description: 'Open global search',
      defaultKey: 'Ctrl+Shift+F',
      category: 'search',
      action: () => {
        // Trigger global search modal with custom event
        dispatchShortcutEvent('search:global');
        // Fallback: try to click search trigger
        const searchButton = document.querySelector('[data-search-trigger]') as HTMLElement;
        if (searchButton) searchButton.click();
      },
    },

    // General
    {
      id: 'general_help',
      name: 'Help',
      description: 'Show keyboard shortcuts',
      defaultKey: 'Ctrl+/',
      category: 'general',
      action: () => {
        // Show shortcuts modal
        const event = new CustomEvent('show-shortcuts-modal');
        window.dispatchEvent(event);
      },
    },
    {
      id: 'general_back',
      name: 'Go Back',
      description: 'Navigate to previous page',
      defaultKey: 'Alt+ArrowLeft',
      category: 'general',
      action: () => router.back(),
    },
    
    // ============================================
    // GLOBAL ACTION SHORTCUTS (Work from any page)
    // ============================================
    
    // Orders Actions - Global
    {
      id: 'orders_new',
      name: 'Create Order (Global)',
      description: 'Create new order from anywhere',
      defaultKey: 'Ctrl+Shift+N',
      category: 'actions',
      action: () => router.push('/portal/orders/create'),
    },
    {
      id: 'orders_refresh',
      name: 'Refresh/Go to Orders',
      description: 'Go to orders and refresh',
      defaultKey: 'Alt+O',
      category: 'actions',
      action: () => {
        if (pathname.includes('/orders')) {
          // Already on orders page, refresh
          const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
          if (refreshBtn && !refreshBtn.disabled) {
            refreshBtn.click();
          } else {
            window.location.reload();
          }
        } else {
          // Navigate to orders page
          router.push('/portal/orders');
        }
      },
    },
    {
      id: 'orders_filter',
      name: 'Search Orders',
      description: 'Go to orders and focus search',
      defaultKey: 'Ctrl+Shift+O',
      category: 'actions',
      action: () => {
        if (!pathname.includes('/orders')) {
          router.push('/portal/orders');
          // Focus search after navigation
          setTimeout(() => {
            const input = findSearchInput();
            if (input) {
              input.focus();
              input.select();
            }
          }, 300);
        } else {
          const input = findSearchInput();
          if (input) {
            input.focus();
            input.select();
          }
        }
      },
    },
    {
      id: 'orders_tab_all',
      name: 'All Orders Tab',
      description: 'Switch to all orders',
      defaultKey: 'Alt+1',
      category: 'page-specific',
      page: '/portal/orders',
      action: () => {
        if (!pathname.includes('/portal/orders')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'orders:tab:all' } }));
      },
    },
    {
      id: 'orders_tab_pending',
      name: 'Pending Tab',
      description: 'Switch to pending orders',
      defaultKey: 'Alt+2',
      category: 'page-specific',
      page: '/portal/orders',
      action: () => {
        if (!pathname.includes('/portal/orders')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'orders:tab:pending' } }));
      },
    },
    {
      id: 'orders_tab_preparing',
      name: 'Preparing Tab',
      description: 'Switch to preparing orders',
      defaultKey: 'Alt+3',
      category: 'page-specific',
      page: '/portal/orders',
      action: () => {
        if (!pathname.includes('/portal/orders')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'orders:tab:preparing' } }));
      },
    },
    
    // Billing Page Shortcuts
    {
      id: 'billing_search',
      name: 'Search Billing',
      description: 'Focus billing search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/billing',
      action: () => {
        if (!pathname.includes('/portal/billing')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'billing_refresh',
      name: 'Refresh Billing',
      description: 'Refresh billing data',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/billing',
      action: () => {
        if (!pathname.includes('/portal/billing')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        }
      },
    },
    {
      id: 'billing_export',
      name: 'Export Data',
      description: 'Export billing data',
      defaultKey: 'Alt+E',
      category: 'page-specific',
      page: '/portal/billing',
      action: () => {
        if (!pathname.includes('/portal/billing')) return;
        const exportBtn = document.querySelector('button:has(> svg.lucide-download)') as HTMLButtonElement;
        if (exportBtn) exportBtn.click();
      },
    },
    
    // Menu Page Shortcuts
    // Menu Actions - Global
    {
      id: 'menu_add_item',
      name: 'Add Menu Item (Global)',
      description: 'Add menu item from anywhere',
      defaultKey: 'Ctrl+Alt+M',
      category: 'actions',
      action: () => {
        if (!pathname.includes('/menu')) {
          router.push('/portal/menu');
          // Try to open add dialog after navigation
          setTimeout(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addButton = buttons.find(btn => btn.textContent?.includes('Add Item'));
            if (addButton) (addButton as HTMLButtonElement).click();
          }, 500);
        } else {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addButton = buttons.find(btn => btn.textContent?.includes('Add Item'));
          if (addButton) (addButton as HTMLButtonElement).click();
        }
      },
    },
    {
      id: 'menu_search',
      name: 'Search Menu',
      description: 'Focus menu search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/menu',
      action: () => {
        if (!pathname.includes('/portal/menu')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'menu_refresh',
      name: 'Refresh Menu',
      description: 'Refresh menu items',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/menu',
      action: () => {
        if (!pathname.includes('/portal/menu')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        }
      },
    },
    {
      id: 'menu_tab_items',
      name: 'Menu Items Tab',
      description: 'Switch to menu items',
      defaultKey: 'Alt+1',
      category: 'page-specific',
      page: '/portal/menu',
      action: () => {
        if (!pathname.includes('/portal/menu')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'menu:tab:items' } }));
      },
    },
    {
      id: 'menu_tab_categories',
      name: 'Categories Tab',
      description: 'Switch to categories',
      defaultKey: 'Alt+2',
      category: 'page-specific',
      page: '/portal/menu',
      action: () => {
        if (!pathname.includes('/portal/menu')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'menu:tab:categories' } }));
      },
    },
    
    // Kitchen Page Shortcuts
    {
      id: 'kitchen_search',
      name: 'Search Kitchen',
      description: 'Focus kitchen search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/kitchen',
      action: () => {
        if (!pathname.includes('/portal/kitchen')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'kitchen_refresh',
      name: 'Refresh Kitchen',
      description: 'Refresh kitchen orders',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/kitchen',
      action: () => {
        if (!pathname.includes('/portal/kitchen')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        }
      },
    },
    {
      id: 'kitchen_tab_pending',
      name: 'Pending Orders',
      description: 'View pending orders',
      defaultKey: 'Alt+1',
      category: 'page-specific',
      page: '/portal/kitchen',
      action: () => {
        if (!pathname.includes('/portal/kitchen')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'kitchen:tab:pending' } }));
      },
    },
    {
      id: 'kitchen_tab_preparing',
      name: 'Preparing Orders',
      description: 'View preparing orders',
      defaultKey: 'Alt+2',
      category: 'page-specific',
      page: '/portal/kitchen',
      action: () => {
        if (!pathname.includes('/portal/kitchen')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'kitchen:tab:preparing' } }));
      },
    },
    
    // Inventory Page Shortcuts
    // Inventory Actions - Global
    {
      id: 'inventory_add',
      name: 'Add Inventory Item (Global)',
      description: 'Add inventory item from anywhere',
      defaultKey: 'Ctrl+Shift+I',
      category: 'actions',
      action: () => {
        if (!pathname.includes('/inventory')) {
          router.push('/portal/inventory');
          setTimeout(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addButton = buttons.find(btn => btn.textContent?.includes('Add Item'));
            if (addButton) (addButton as HTMLButtonElement).click();
          }, 500);
        } else {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addButton = buttons.find(btn => btn.textContent?.includes('Add Item'));
          if (addButton) (addButton as HTMLButtonElement).click();
        }
      },
    },
    {
      id: 'inventory_search',
      name: 'Search Inventory',
      description: 'Focus inventory search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/inventory',
      action: () => {
        if (!pathname.includes('/portal/inventory')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'inventory_refresh',
      name: 'Refresh Inventory',
      description: 'Refresh inventory data',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/inventory',
      action: () => {
        if (!pathname.includes('/portal/inventory')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        }
      },
    },
    
    // Tables Page Shortcuts
    {
      id: 'tables_search',
      name: 'Search Tables',
      description: 'Focus table search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/tables',
      action: () => {
        if (!pathname.includes('/portal/tables')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'tables_refresh',
      name: 'Refresh Tables',
      description: 'Refresh table status',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/tables',
      action: () => {
        if (!pathname.includes('/portal/tables')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        }
      },
    },
    // Tables Actions - Global
    {
      id: 'tables_add',
      name: 'Add Table (Global)',
      description: 'Add table from anywhere',
      defaultKey: 'Ctrl+Shift+T',
      category: 'actions',
      action: () => {
        if (!pathname.includes('/tables')) {
          router.push('/portal/tables');
          setTimeout(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addButton = buttons.find(btn => btn.textContent?.includes('Add Table'));
            if (addButton) (addButton as HTMLButtonElement).click();
          }, 500);
        } else {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addButton = buttons.find(btn => btn.textContent?.includes('Add Table'));
          if (addButton) (addButton as HTMLButtonElement).click();
        }
      },
    },
    
    // Employees Page Shortcuts
    // Employees Actions - Global
    {
      id: 'employees_add',
      name: 'Add Employee (Global)',
      description: 'Add employee from anywhere',
      defaultKey: 'Ctrl+Shift+E',
      category: 'actions',
      action: () => router.push('/portal/employees/add'),
    },
    {
      id: 'employees_search',
      name: 'Search Employees',
      description: 'Focus employee search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/employees',
      action: () => {
        if (!pathname.includes('/portal/employees')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'employees_refresh',
      name: 'Refresh Employees',
      description: 'Refresh employee list',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/employees',
      action: () => {
        if (!pathname.includes('/portal/employees')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        } else {
          window.location.reload();
        }
      },
    },
    
    // Customers Page Shortcuts
    // Customers Actions - Global
    {
      id: 'customers_add',
      name: 'Customers',
      description: 'Go to customers / add new customer',
      defaultKey: 'Ctrl+U',
      category: 'actions',
      action: () => {
        if (!pathname.includes('/customers')) {
          router.push('/portal/customers');
          setTimeout(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addButton = buttons.find(btn => btn.textContent?.includes('Add Customer') || btn.textContent?.includes('New Customer'));
            if (addButton) (addButton as HTMLButtonElement).click();
          }, 500);
        } else {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addButton = buttons.find(btn => btn.textContent?.includes('Add Customer') || btn.textContent?.includes('New Customer'));
          if (addButton) (addButton as HTMLButtonElement).click();
        }
      },
    },
    {
      id: 'customers_search',
      name: 'Search Customers',
      description: 'Focus customer search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/customers',
      action: () => {
        if (!pathname.includes('/portal/customers')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'customers_refresh',
      name: 'Refresh Customers',
      description: 'Refresh customer list',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/customers',
      action: () => {
        if (!pathname.includes('/portal/customers')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        } else {
          window.location.reload();
        }
      },
    },
    
    // Delivery Page Shortcuts
    {
      id: 'delivery_search',
      name: 'Search Deliveries',
      description: 'Focus delivery search',
      defaultKey: 'Alt+F',
      category: 'page-specific',
      page: '/portal/delivery',
      action: () => {
        if (!pathname.includes('/portal/delivery')) return;
        const input = findSearchInput();
        if (input) {
          input.focus();
          input.select();
        }
      },
    },
    {
      id: 'delivery_refresh',
      name: 'Refresh Deliveries',
      description: 'Refresh delivery status',
      defaultKey: 'Alt+R',
      category: 'page-specific',
      page: '/portal/delivery',
      action: () => {
        if (!pathname.includes('/portal/delivery')) return;
        const refreshBtn = document.querySelector('button:has(> svg.lucide-refresh-cw)') as HTMLButtonElement;
        if (refreshBtn && !refreshBtn.disabled) {
          refreshBtn.click();
        } else {
          window.location.reload();
        }
      },
    },
    {
      id: 'delivery_tab_active',
      name: 'Active Deliveries',
      description: 'View active deliveries',
      defaultKey: 'Alt+1',
      category: 'page-specific',
      page: '/portal/delivery',
      action: () => {
        if (!pathname.includes('/portal/delivery')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'delivery:tab:active' } }));
      },
    },
    {
      id: 'delivery_tab_completed',
      name: 'Completed Deliveries',
      description: 'View completed deliveries',
      defaultKey: 'Alt+2',
      category: 'page-specific',
      page: '/portal/delivery',
      action: () => {
        if (!pathname.includes('/portal/delivery')) return;
        window.dispatchEvent(new CustomEvent('keyboard-shortcut', { detail: { action: 'delivery:tab:completed' } }));
      },
    },
  ], [router, pathname]);

  useEffect(() => {
    shortcutsRef.current = getShortcuts();

    const handleKeyDown = (event: KeyboardEvent) => {
      // Guard against synthetic/invalid events with no key
      if (!event.key) return;

      // AGGRESSIVE: Block browser default shortcuts immediately
      // This prevents browser shortcuts even when shortcuts are disabled
      if (shouldBlockBrowserDefault(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      
      // Check if shortcuts are enabled
      if (!enabled) return;
      
      // Prevent concurrent execution (but don't block input field key events)
      if (executingRef.current) {
        const target = event.target as HTMLElement;
        const isInputField =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable;
        if (!isInputField) {
          event.preventDefault();
        }
        return;
      }

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      
      if (isInputField) {
        // Allow Ctrl+/ for help even in input fields
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X for text editing
        const key = (event.key ?? '').toLowerCase();
        const isTextEditShortcut = event.ctrlKey && ['a', 'c', 'v', 'x', 'z', 'y'].includes(key);
        const isHelpShortcut = matchesKeyCombo(event, 'Ctrl+/');
        
        if (!isHelpShortcut && !isTextEditShortcut) {
          return;
        }
      }

      // ALL shortcuts are now global - work on any page
      const activeShortcuts = shortcutsRef.current;

      // Check each active shortcut
      let matched = false;
      for (const shortcut of activeShortcuts) {
        const configuredKey = getShortcutKey(shortcut.id, shortcut.defaultKey);
        
        if (matchesKeyCombo(event, configuredKey)) {
          // Throttle repeated executions (prevent holding key)
          const now = Date.now();
          const lastExec = lastExecutionRef.current[shortcut.id] || 0;
          if (now - lastExec < 300) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          
          // Prevent default browser behavior
          event.preventDefault();
          event.stopPropagation();
          
          matched = true;
          
          // Execute shortcut action with error handling
          executingRef.current = true;
          lastExecutionRef.current[shortcut.id] = now;
          
          try {
            // Use requestAnimationFrame for smoother execution
            requestAnimationFrame(() => {
              try {
                shortcut.action();
              } catch (error) {
                console.error(`Error executing shortcut ${shortcut.id}:`, error);
              } finally {
                // Reset after a short delay to allow action to complete
                setTimeout(() => {
                  executingRef.current = false;
                }, 50);
              }
            });
          } catch (error) {
            console.error(`Error scheduling shortcut ${shortcut.id}:`, error);
            executingRef.current = false;
          }
          break;
        }
      }
      
      // Prevent Chrome default shortcuts that might conflict
      if (!matched) {
        const allConfiguredKeys = activeShortcuts.map(s => 
          getShortcutKey(s.id, s.defaultKey)
        );
        
        for (const configuredKey of allConfiguredKeys) {
          if (matchesKeyCombo(event, configuredKey) && isChromDefaultShortcut(configuredKey)) {
            event.preventDefault();
            event.stopPropagation();
            break;
          }
        }
      }
    };

    // Use capture phase for priority handling
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
    };
  }, [getShortcuts, enabled, pathname]);

  // NOTE: Browser shortcut blocking is handled by:
  // 1. emergencyBlocker (above, deps=[]) - always-first critical blocks (Ctrl+N/T/W)
  // 2. handleKeyDown (above) - calls shouldBlockBrowserDefault() at its top and
  //    also prevents browser defaults for any configured shortcut key
  // The ultraBlocker that used to live here was removed because its deps=[]
  // caused it to be registered before handleKeyDown after every route change,
  // making stopImmediatePropagation() swallow events before shortcuts could fire.

  return {
    shortcuts: getShortcuts(),
    enabled,
  };
}