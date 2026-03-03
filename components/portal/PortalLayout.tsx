'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
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
  Home,
  MoreHorizontal,
  MessageSquare,
  HardDriveDownload,
  CalendarDays,
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
import { usePortalAuth } from '@/hooks/usePortal';
import { useIsMobile, useDeviceType } from '@/hooks/use-mobile';
import { useReducedMotion, usePerformanceMode } from '@/hooks/useReducedMotion';
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
  MessageSquare,
  HardDriveDownload,
  CalendarDays,
};

// Navigation items with role-based visibility
interface NavItem {
  label: string;
  path: string;
  icon: keyof typeof iconMap;
  pageKey?: PageKey; // Maps to permission system
  badge?: number;
  external?: boolean; // Opens in new tab
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
    label: 'Bookings', 
    path: '/portal/bookings', 
    icon: 'CalendarDays',
    pageKey: 'bookings',
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
    label: 'Messages', 
    path: '/portal/messages', 
    icon: 'MessageSquare',
    pageKey: 'messages',
  },
  { 
    label: 'DB Backup', 
    path: '/portal/backup', 
    icon: 'HardDriveDownload',
    pageKey: 'backup',
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
  const { employee, role, logout, fastLogout, isBlocked, blockReason, unreadCount } = usePortalAuth();
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
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-zinc-900 text-white z-50 flex flex-col',
        'border-r border-zinc-800 transition-[width] duration-200',
        collapsed ? 'w-20' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md relative">
              <Image 
                src="/assets/zoiro-logo.png" 
                alt="ZOIRO" 
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="text-xl font-bebas text-primary">ZOIRO</span>
              <span className="text-[10px] block text-zinc-400 -mt-1">
                {role?.replace('_', ' ').toUpperCase() || 'PORTAL'}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md mx-auto relative">
            <Image 
              src="/assets/zoiro-logo.png" 
              alt="ZOIRO" 
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={() => onCollapse(!collapsed)}
        >
          <ChevronLeft
            className={cn(
              'h-5 w-5 transition-transform duration-200',
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
              <Link key={item.path} href={item.path} prefetch={false} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150',
                    'hover:bg-zinc-800/80',
                    isActive && 'bg-primary/20 text-primary'
                  )}
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                  {!collapsed && (
                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  )}
                  {item.badge && !collapsed && (
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

      {/* User Info & Logout */}
      <div className="border-t border-zinc-800 p-4">
        {!collapsed ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
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
          </div>
        )}
      </div>
    </aside>

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
// PORTAL APPBAR - Mobile Optimized with Memoization
// =============================================

interface PortalAppbarProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export const PortalAppbar = memo(function PortalAppbar({ sidebarCollapsed, onMenuClick }: PortalAppbarProps) {
  const pathname = usePathname(); // Move hook to component top level
  const { employee, role, logout, fastLogout, isBlocked, blockReason, notifications, unreadCount, markNotificationAsRead } = usePortalAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLogoutClick = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  // Memoize page title to prevent recalculation on every render
  const pageTitle = React.useMemo(() => {
    const item = navItems.find(
      (i) => i.path === pathname || (i.path !== '/portal' && pathname.startsWith(i.path))
    );
    return item?.label || 'Dashboard';
  }, [pathname]);

  // Format date only once per day
  const formattedDate = React.useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  return (
    <>
    <header
      className={cn(
        'fixed top-0 right-0 h-14 sm:h-16 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 z-40',
        'flex items-center justify-between px-3 sm:px-4 md:px-6 transition-[left] duration-200',
        sidebarCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-[280px]'
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden flex-shrink-0 h-9 w-9"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-wide truncate">
            {pageTitle}
          </h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Notifications */}
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs animate-pulse"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 max-w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span className="font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => markNotificationAsRead(notifications.filter(n => !n.is_read).map(n => n.id))}
                >
                  Mark all read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-72 sm:h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex flex-col items-start p-3 cursor-pointer rounded-lg mx-1 my-0.5',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => {
                      if (!notification.is_read) {
                        markNotificationAsRead([notification.id]);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu - Simplified for mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={employee?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-sm font-semibold">
                  {employee?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">
                {employee?.name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium truncate">{employee?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{employee?.email}</p>
                <Badge variant="outline" className="w-fit mt-1 capitalize text-xs">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-500 cursor-pointer focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
              onClick={handleLogoutClick}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
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
});

// =============================================
// MOBILE SIDEBAR - Enhanced Premium Design
// =============================================

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export const MobileSidebar = memo(function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { employee, role, fastLogout, isBlocked, blockReason } = usePortalAuth();
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { shouldReduce } = usePerformanceMode();
  
  // Use more aggressive reduction on mobile - combines system preference with device capability
  const disableAnimations = shouldReduceMotion || shouldReduce;

  const handleLogoutClick = useCallback(() => {
    onClose();
    setLogoutDialogOpen(true);
  }, [onClose]);

  // Enhanced navigation handler that ensures drawer closes
  const handleNavigate = useCallback((path: string, external?: boolean) => {
    if (external) {
      window.open(path, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    // Close drawer immediately
    onClose();
    // Navigate after brief delay to ensure smooth close animation
    setTimeout(() => {
      router.push(path);
    }, 150);
  }, [onClose, router]);

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
  const visibleNavItems = React.useMemo(() => navItems.filter((item) => {
    if (!item.pageKey) return true;
    if (!permissions) return false;
    return canAccessPage(permissions, item.pageKey);
  }), [permissions]);

  // Group nav items into categories for better mobile UX
  const mainNavItems = visibleNavItems.slice(0, 8);
  const secondaryNavItems = visibleNavItems.slice(8);

  return (
    <>
    <Sheet open={open} onOpenChange={onClose} modal={true}>
      <SheetContent 
        side="left" 
        className="w-[300px] sm:w-[320px] p-0 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 text-white border-zinc-800/50 overflow-hidden"
        showCloseButton
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        
        {/* Premium Header with Gradient */}
        <SheetHeader className="h-auto px-4 py-4 border-b border-zinc-800/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-2 ring-primary/20">
              <Image 
                src="/assets/zoiro-logo.png" 
                alt="ZOIRO" 
                fill
                sizes="48px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="text-2xl font-bebas text-primary tracking-wide">ZOIRO</span>
              <div className="flex items-center gap-2 -mt-1">
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-2 py-0 border-primary/30 text-primary bg-primary/5 capitalize"
                >
                  {role?.replace('_', ' ') || 'Staff'}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* User Profile Card - Compact Mobile Style */}
        <div className="px-4 py-3 border-b border-zinc-800/30">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-zinc-800/80 to-zinc-800/40 backdrop-blur-sm">
            <Avatar className="h-11 w-11 ring-2 ring-primary/20">
              <AvatarImage src={employee?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">
                {employee?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{employee?.name || 'User'}</p>
              <p className="text-xs text-zinc-400 truncate">{employee?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation with Smooth Scrolling */}
        <ScrollArea className="flex-1 h-[calc(100vh-15rem)] py-2">
          <nav className="px-3 space-y-1">
            {/* Main Navigation */}
            <div className="mb-3">
              <p className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Main Menu
              </p>
              {mainNavItems.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = pathname === item.path ||
                  (item.path !== '/portal' && pathname.startsWith(item.path));

                return (
                  <div
                    key={item.path}
                    onClick={() => handleNavigate(item.path, item.external)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate(item.path, item.external);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                        !disableAnimations && 'active:scale-[0.98]',
                        isActive 
                          ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary shadow-sm' 
                          : 'hover:bg-zinc-800/60 text-zinc-300 hover:text-white'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        isActive ? 'bg-primary/20' : 'bg-zinc-800/50'
                      )}>
                        <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                      </div>
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {item.badge && (
                        <Badge 
                          variant="destructive" 
                          className="text-[10px] h-5 min-w-5 flex items-center justify-center"
                        >
                          {item.badge}
                        </Badge>
                      )}
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Secondary Navigation */}
            {secondaryNavItems.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/30">
                <p className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  More Options
                </p>
                {secondaryNavItems.map((item) => {
                  const Icon = iconMap[item.icon];
                  const isActive = pathname === item.path ||
                    (item.path !== '/portal' && pathname.startsWith(item.path));

                  return (
                    <div
                      key={item.path}
                      onClick={() => handleNavigate(item.path, item.external)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNavigate(item.path, item.external);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                          !disableAnimations && 'active:scale-[0.98]',
                          isActive 
                            ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary' 
                            : 'hover:bg-zinc-800/60 text-zinc-400 hover:text-white'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge && (
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800/50 p-3 bg-gradient-to-t from-zinc-950 to-zinc-900/95 backdrop-blur-sm safe-area-bottom">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl py-3"
            onClick={handleLogoutClick}
          >
            <LogOut className="h-4 w-4 mr-3" />
            <span className="font-medium">Sign Out</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>

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
    </>
  );
});

// =============================================
// MOBILE BOTTOM NAVIGATION BAR
// =============================================

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

export const MobileBottomNav = memo(function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { unreadCount } = usePortalAuth();
  
  // Quick access items for bottom nav
  const quickItems = [
    { path: '/portal', icon: Home, label: 'Home' },
    { path: '/portal/orders', icon: ShoppingBag, label: 'Orders' },
    { path: '/portal/kitchen', icon: ChefHat, label: 'Kitchen' },
    { path: '/portal/billing', icon: Receipt, label: 'Billing' },
  ];

  return (
    <>
      {/* Mobile Bottom Nav Styles */}
      <style>{`
        @keyframes navGradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes navItemPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes navIconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .mobile-bottom-nav-container {
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.98) 0%,
            rgba(254,242,242,0.98) 25%,
            rgba(254,226,226,0.95) 50%,
            rgba(254,242,242,0.98) 75%,
            rgba(255,255,255,0.98) 100%
          );
          background-size: 400% 400%;
          animation: navGradientShift 8s ease infinite;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .dark .mobile-bottom-nav-container {
          background: linear-gradient(
            135deg,
            rgba(24,24,27,0.98) 0%,
            rgba(39,24,27,0.98) 25%,
            rgba(55,20,25,0.95) 50%,
            rgba(39,24,27,0.98) 75%,
            rgba(24,24,27,0.98) 100%
          );
        }
        .nav-item-active {
          animation: navItemPulse 2s ease-in-out infinite;
        }
        .nav-item-active .nav-icon {
          animation: navIconBounce 1s ease-in-out infinite;
        }
      `}</style>

      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom mobile-bottom-nav-container border-t border-red-100/50 dark:border-red-900/30 shadow-[0_-4px_20px_rgba(220,38,38,0.08)]">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
        
        <div className="flex items-center justify-around px-1 py-2">
          {quickItems.map((item) => {
            const isActive = pathname === item.path || 
              (item.path !== '/portal' && pathname.startsWith(item.path));
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className="flex-1"
                prefetch={false}
              >
                <div className={cn(
                  'relative flex flex-col items-center py-2.5 px-2 rounded-2xl transition-all duration-300',
                  isActive 
                    ? 'nav-item-active bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30' 
                    : 'text-zinc-500 dark:text-zinc-400 active:scale-95 active:bg-red-50 dark:active:bg-red-950/30'
                )}>
                  {/* Active glow effect */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-red-400/20 to-transparent" />
                  )}
                  <item.icon className={cn(
                    'nav-icon h-5 w-5 mb-1 relative z-10 transition-transform',
                    isActive ? 'text-white drop-shadow-sm' : 'group-hover:text-red-500'
                  )} />
                  <span className={cn(
                    'text-[10px] font-semibold relative z-10 tracking-wide',
                    isActive ? 'text-white' : ''
                  )}>
                    {item.label}
                  </span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full shadow-sm" />
                  )}
                </div>
              </Link>
            );
          })}
          
          {/* More Menu Button */}
          <button 
            onClick={onMenuClick}
            className="flex-1 flex flex-col items-center py-2.5 px-2 rounded-2xl text-zinc-500 dark:text-zinc-400 active:scale-95 active:bg-red-50 dark:active:bg-red-950/30 transition-all duration-200"
          >
            <div className="relative">
              <MoreHorizontal className="h-5 w-5 mb-1" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-gradient-to-br from-red-500 to-red-600 rounded-full text-[9px] text-white font-bold flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-wide">More</span>
          </button>
        </div>
      </div>
    </>
  );
});
