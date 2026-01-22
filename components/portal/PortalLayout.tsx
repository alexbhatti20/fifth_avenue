'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  LayoutGrid,
  Receipt,
  Users,
  UserCog,
  Package,
  Clock,
  Wallet,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  Bell,
  User,
  ChevronDown,
  X,
  Truck,
  ChefHat,
  Gift,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { usePortalAuth, useNotifications } from '@/hooks/usePortal';
import { BlockedUserDialog } from './BlockedUserDialog';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { 
  buildUserPermissions, 
  getCachedPermissions, 
  cachePermissions,
  canAccessPage,
  type UserPermissions,
  type PageKey,
} from '@/lib/permissions';
import type { EmployeeRole } from '@/types/portal';

// Icon mapping
const iconMap: Record<string, any> = {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  LayoutGrid,
  Receipt,
  Users,
  UserCog,
  Package,
  Clock,
  Wallet,
  BarChart3,
  Settings,
  Truck,
  ChefHat,
  Gift,
  Star,
};

// Navigation items with role-based visibility
interface NavItem {
  label: string;
  path: string;
  icon: keyof typeof iconMap;
  pageKey?: PageKey; // Maps to permission system
  badge?: number;
}

const navItems: NavItem[] = [
  { 
    label: 'Dashboard', 
    path: '/portal', 
    icon: 'LayoutDashboard',
    pageKey: 'dashboard',
  },
  { 
    label: 'Menu Management', 
    path: '/portal/menu', 
    icon: 'UtensilsCrossed',
    pageKey: 'menu',
  },
  { 
    label: 'Orders', 
    path: '/portal/orders', 
    icon: 'ShoppingBag',
    pageKey: 'orders',
  },
  { 
    label: 'Kitchen', 
    path: '/portal/kitchen', 
    icon: 'ChefHat',
    pageKey: 'kitchen',
  },
  { 
    label: 'Delivery', 
    path: '/portal/delivery', 
    icon: 'Truck',
    pageKey: 'delivery',
  },
  { 
    label: 'Tables', 
    path: '/portal/tables', 
    icon: 'LayoutGrid',
    pageKey: 'tables',
  },
  { 
    label: 'Billing', 
    path: '/portal/billing', 
    icon: 'Receipt',
    pageKey: 'billing',
  },
  { 
    label: 'Employees', 
    path: '/portal/employees', 
    icon: 'Users',
    pageKey: 'employees',
  },
  { 
    label: 'Customers', 
    path: '/portal/customers', 
    icon: 'UserCog',
    pageKey: 'customers',
  },
  { 
    label: 'Inventory', 
    path: '/portal/inventory', 
    icon: 'Package',
    pageKey: 'inventory',
  },
  { 
    label: 'Attendance', 
    path: '/portal/attendance', 
    icon: 'Clock',
    pageKey: 'attendance',
  },
  { 
    label: 'Payroll', 
    path: '/portal/payroll', 
    icon: 'Wallet',
    pageKey: 'payroll',
  },
  { 
    label: 'Reports', 
    path: '/portal/reports', 
    icon: 'BarChart3',
    pageKey: 'reports',
  },
  { 
    label: 'Perks & Loyalty', 
    path: '/portal/perks', 
    icon: 'Gift',
    pageKey: 'perks',
  },
  { 
    label: 'Reviews', 
    path: '/portal/reviews', 
    icon: 'Star',
    pageKey: 'reviews',
  },
  { 
    label: 'Settings', 
    path: '/portal/settings', 
    icon: 'Settings',
    pageKey: 'profile',
  },
];

interface PortalSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export function PortalSidebar({ collapsed, onCollapse }: PortalSidebarProps) {
  const pathname = usePathname();
  const { employee, role, logout, fastLogout, isBlocked, blockReason } = usePortalAuth();
  const { unreadCount } = useNotifications();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Get user permissions (from cache or build new)
  const permissions: UserPermissions | null = React.useMemo(() => {
    if (!role) return null;
    
    // Try to get from cache first
    const cached = getCachedPermissions();
    if (cached && cached.role === role) {
      return cached;
    }
    
    // Build new permissions
    const customPerms = employee?.permissions 
      ? Object.keys(employee.permissions).filter(k => employee.permissions[k] === true)
      : [];
    const newPerms = buildUserPermissions(role, customPerms);
    
    // Cache for future use
    cachePermissions(newPerms);
    return newPerms;
  }, [role, employee?.permissions]);

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!item.pageKey) return true;
    if (!permissions) return false;
    return canAccessPage(permissions, item.pageKey);
  });

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  return (
    <>
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      className={cn(
        'fixed left-0 top-0 h-screen bg-zinc-900 text-white z-50 flex flex-col transition-all duration-300',
        'border-r border-zinc-800'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md">
                <img 
                  src="/assets/zoiro-logo.png" 
                  alt="ZOIRO" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-xl font-bebas text-primary">ZOIRO</span>
                <span className="text-[10px] block text-zinc-400 -mt-1">
                  {role?.replace('_', ' ').toUpperCase() || 'PORTAL'}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-10 h-10 rounded-lg overflow-hidden shadow-md mx-auto"
            >
              <img 
                src="/assets/zoiro-logo.png" 
                alt="ZOIRO" 
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={() => onCollapse(!collapsed)}
        >
          <ChevronLeft
            className={cn(
              'h-5 w-5 transition-transform duration-300',
              collapsed && 'rotate-180'
            )}
          />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = pathname === item.path || 
              (item.path !== '/portal' && pathname.startsWith(item.path));

            return (
              <Link key={item.path} href={item.path} prefetch={false}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'hover:bg-zinc-800/80',
                    isActive && 'bg-primary/20 text-primary'
                  )}
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {item.badge && !collapsed && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Info & Logout */}
      <div className="border-t border-zinc-800 p-4">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={employee?.avatar_url} />
                  <AvatarFallback className="bg-primary text-white">
                    {employee?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{employee?.name}</p>
                  <p className="text-xs text-zinc-400 truncate">{employee?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={handleLogoutClick}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={employee?.avatar_url} />
                <AvatarFallback className="bg-primary text-white">
                  {employee?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={handleLogoutClick}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>

    {/* Logout Confirmation Dialog */}
    <LogoutConfirmDialog
      open={logoutDialogOpen}
      onOpenChange={setLogoutDialogOpen}
      onConfirm={logout}
    />

    {/* Blocked User Warning Dialog */}
    <BlockedUserDialog
      open={isBlocked}
      reason={blockReason || ''}
      onLogout={fastLogout}
      autoLogoutSeconds={5}
    />
    </>
  );
}

// =============================================
// PORTAL APPBAR
// =============================================

interface PortalAppbarProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export function PortalAppbar({ sidebarCollapsed, onMenuClick }: PortalAppbarProps) {
  const { employee, role, logout, fastLogout, isBlocked, blockReason } = usePortalAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const getPageTitle = () => {
    const pathname = usePathname();
    const item = navItems.find(
      (i) => i.path === pathname || (i.path !== '/portal' && pathname.startsWith(i.path))
    );
    return item?.label || 'Dashboard';
  };

  return (
    <>
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-40 flex items-center justify-between px-4 md:px-6 transition-all duration-300',
        sidebarCollapsed ? 'left-20' : 'left-0 md:left-[280px]'
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-wide portal-heading">
            {getPageTitle()}
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1"
                  onClick={() => markAsRead(notifications.filter(n => !n.is_read).map(n => n.id))}
                >
                  Mark all as read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex flex-col items-start p-3 cursor-pointer',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead([notification.id]);
                      }
                    }}
                  >
                    <span className="font-medium text-sm">{notification.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleTimeString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={employee?.avatar_url} />
                <AvatarFallback className="bg-primary text-white text-sm">
                  {employee?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium">
                {employee?.name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{employee?.name}</p>
                <p className="text-xs text-muted-foreground">{employee?.email}</p>
                <Badge variant="outline" className="w-fit mt-1 capitalize">
                  {role?.replace('_', ' ')}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/portal/settings" className="cursor-pointer" prefetch={false}>
                <User className="h-4 w-4 mr-2" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/portal/settings/security" className="cursor-pointer" prefetch={false}>
                <Settings className="h-4 w-4 mr-2" />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-500 cursor-pointer"
              onClick={handleLogoutClick}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={async () => fastLogout()}
      />

      {/* Blocked User Warning Dialog */}
      <BlockedUserDialog
        open={isBlocked}
        reason={blockReason}
        onLogout={fastLogout}
      />
    </header>
    </>
  );
}

// =============================================
// MOBILE SIDEBAR
// =============================================

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { employee, role, fastLogout, isBlocked, blockReason } = usePortalAuth();
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);

  const handleLogoutClick = () => {
    onClose();
    setLogoutDialogOpen(true);
  };

  // Get user permissions (from cache or build new)
  const permissions: UserPermissions | null = React.useMemo(() => {
    if (!role) return null;
    
    // Try to get from cache first
    const cached = getCachedPermissions();
    if (cached && cached.role === role) {
      return cached;
    }
    
    // Build new permissions
    const customPerms = employee?.permissions 
      ? Object.keys(employee.permissions).filter(k => employee.permissions[k] === true)
      : [];
    return buildUserPermissions(role, customPerms);
  }, [role, employee?.permissions]);

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!item.pageKey) return true;
    if (!permissions) return false;
    return canAccessPage(permissions, item.pageKey);
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[280px] p-0 bg-zinc-900 text-white border-zinc-800">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetHeader className="h-16 flex flex-row items-center justify-between px-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xl font-bebas text-white">Z</span>
            </div>
            <div>
              <span className="text-xl font-bebas text-primary">ZOIRO</span>
              <span className="text-[10px] block text-zinc-400 -mt-1">
                {role?.replace('_', ' ').toUpperCase() || 'PORTAL'}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4 h-[calc(100vh-10rem)]">
          <nav className="px-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname === item.path ||
                (item.path !== '/portal' && pathname.startsWith(item.path));

              return (
                <Link key={item.path} href={item.path} onClick={onClose} prefetch={false}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      'hover:bg-zinc-800/80',
                      isActive && 'bg-primary/20 text-primary'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="ml-auto text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={employee?.avatar_url} />
              <AvatarFallback className="bg-primary text-white">
                {employee?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{employee?.name}</p>
              <p className="text-xs text-zinc-400 truncate">{employee?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleLogoutClick}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SheetContent>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={async () => fastLogout()}
      />

      {/* Blocked User Warning Dialog */}
      <BlockedUserDialog
        open={isBlocked}
        reason={blockReason}
        onLogout={fastLogout}
      />
    </Sheet>
  );
}
