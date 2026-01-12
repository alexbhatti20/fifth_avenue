'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PortalSidebar, PortalAppbar, MobileSidebar } from './PortalLayout';
import { usePortalAuth } from '@/hooks/usePortal';
import { BlockedUserDialog } from './BlockedUserDialog';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface PortalProviderProps {
  children: React.ReactNode;
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mb-4 mx-auto animate-pulse">
          <span className="text-3xl font-bebas text-white">Z</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading portal...</p>
      </div>
    </div>
  );
}

export function PortalProvider({ children }: PortalProviderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const { employee, isLoading, isAuthenticated, isBlocked, blockReason, fastLogout } = usePortalAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Check if current page is auth page (unified auth or old portal auth pages)
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/activate' || pathname === '/auth';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Play alert beep sound using Web Audio API
  const playAlertSound = () => {
    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Create alert sound pattern (3 beeps)
      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      
      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 200);
      
      // Third beep
      setTimeout(() => {
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.frequency.value = 880;
        osc3.type = 'sine';
        gain3.gain.setValueAtTime(0.3, ctx.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc3.start(ctx.currentTime);
        osc3.stop(ctx.currentTime + 0.5);
      }, 400);
    } catch (e) {
      console.log('[BlockedDialog] Audio not available');
    }
  };

  // Handle blocked account - show dialog and play alert sound
  useEffect(() => {
    if (isBlocked) {
      // Show the blocked dialog
      setBlockDialogOpen(true);
      
      // Play alert sound
      playAlertSound();
    } else {
      setBlockDialogOpen(false);
    }
  }, [isBlocked]);

  useEffect(() => {
    // Redirect logic - only redirect if fully loaded and mounted
    if (!isLoading && mounted) {
      // Check localStorage as additional auth source
      const userType = localStorage.getItem('user_type');
      const authToken = localStorage.getItem('auth_token');
      const hasLocalAuth = (userType === 'admin' || userType === 'employee') && authToken;
      
      if (!isAuthenticated && !hasLocalAuth && !isAuthPage) {
        router.push('/auth');
      } else if ((isAuthenticated || hasLocalAuth) && isAuthPage && pathname !== '/auth') {
        router.push('/portal');
      }
    }
  }, [isLoading, isAuthenticated, isAuthPage, pathname, router, mounted]);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('portal_sidebar_collapsed');
    if (savedState) {
      setSidebarCollapsed(savedState === 'true');
    }
  }, []);

  // Save sidebar state
  const handleSidebarCollapse = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem('portal_sidebar_collapsed', String(collapsed));
  };

  // Check localStorage auth as fallback
  const hasLocalAuth = typeof window !== 'undefined' && 
    (localStorage.getItem('user_type') === 'admin' || localStorage.getItem('user_type') === 'employee') &&
    localStorage.getItem('auth_token');

  // Don't render anything while loading
  if (!mounted || isLoading) {
    return <LoadingSpinner />;
  }

  // Render auth pages without layout
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Render full layout for authenticated users (either from hook or localStorage)
  if (!isAuthenticated && !hasLocalAuth) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Blocked Account Dialog - Triggered when admin blocks employee in real-time */}
      <BlockedUserDialog
        open={blockDialogOpen}
        reason={blockReason || 'Your portal access has been disabled by an administrator.'}
        onLogout={fastLogout}
        autoLogoutSeconds={5}
        employeeName={employee?.name || 'Employee'}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <PortalSidebar 
          collapsed={sidebarCollapsed} 
          onCollapse={handleSidebarCollapse} 
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar 
        open={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />

      {/* Appbar */}
      <PortalAppbar 
        sidebarCollapsed={sidebarCollapsed} 
        onMenuClick={() => setMobileMenuOpen(true)} 
      />

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-[280px]'
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-3 sm:p-4 md:p-6 pb-20 sm:pb-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// =============================================
// PAGE WRAPPER WITH ROLE CHECK
// =============================================

interface ProtectedPageProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: string;
}

export function ProtectedPage({ children, allowedRoles, permission }: ProtectedPageProps) {
  const { role, hasPermission, isLoading } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // Check role-based access
      if (allowedRoles && role && !allowedRoles.includes(role)) {
        router.push('/portal');
        return;
      }
      
      // Check permission-based access
      if (permission && !hasPermission(permission)) {
        router.push('/portal');
        return;
      }
    }
  }, [isLoading, role, allowedRoles, permission, hasPermission, router]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Check access
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return null;
  }

  if (permission && !hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}

// =============================================
// STATS CARD COMPONENT
// =============================================

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, changeType = 'neutral', icon, className }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white dark:bg-zinc-900 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm border border-zinc-200 dark:border-zinc-800',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs md:text-sm font-medium portal-heading-static truncate">{title}</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 sm:mt-1 portal-card-title truncate">{value}</p>
          {change && (
            <p
              className={cn(
                'text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate',
                changeType === 'positive' && 'text-green-500',
                changeType === 'negative' && 'text-red-500',
                changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="p-1.5 sm:p-2 md:p-3 rounded-lg bg-primary/10 text-primary flex-shrink-0">{icon}</div>
      </div>
    </motion.div>
  );
}

// =============================================
// SECTION HEADER COMPONENT
// =============================================

interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between mb-4 sm:mb-6">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-wide portal-heading truncate">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// =============================================
// DATA TABLE WRAPPER
// =============================================

interface DataTableWrapperProps {
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: React.ReactNode;
}

export function DataTableWrapper({ 
  children, 
  isLoading, 
  isEmpty, 
  emptyMessage = 'No data found' 
}: DataTableWrapperProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">📭</span>
        </div>
        <div className="text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
}
