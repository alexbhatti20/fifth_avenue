'use client';

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PortalSidebar, PortalAppbar, MobileSidebar } from './PortalLayout';
import { BlockedUserDialog } from './BlockedUserDialog';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentEmployee } from '@/lib/portal-queries';
import { clearPermissionsCache } from '@/lib/permissions';
import type { Employee, EmployeeRole } from '@/types/portal';
import { hasPermission as checkPermission } from '@/types/portal';

// =============================================
// PORTAL AUTH CONTEXT - Single source of truth
// =============================================

interface PortalAuthContextType {
  employee: Employee | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: EmployeeRole | null;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
  fastLogout: () => void;
  refreshEmployee: () => Promise<void>;
  isBlocked: boolean;
  blockReason: string | null;
}

const PortalAuthContext = createContext<PortalAuthContextType | null>(null);

// Hook to use the shared auth context
export function usePortalAuthContext(): PortalAuthContextType {
  const context = useContext(PortalAuthContext);
  if (!context) {
    // Return a default state if context is not available (for SSR or outside provider)
    return {
      employee: null,
      isLoading: true,
      isAuthenticated: false,
      role: null,
      hasPermission: () => false,
      logout: async () => {},
      fastLogout: () => {},
      refreshEmployee: async () => {},
      isBlocked: false,
      blockReason: null,
    };
  }
  return context;
}

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
  
  // Auth state - managed here, shared via context
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  const router = useRouter();
  const pathname = usePathname();

  // Check if current page is auth page (unified auth or old portal auth pages)
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/activate' || pathname === '/auth';

  // Load employee data - only called once
  const loadEmployee = useCallback(async () => {
    if (isLoadingRef.current || hasLoadedRef.current) return;
    isLoadingRef.current = true;
    
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    try {
      const emp = await getCurrentEmployee();
      if (emp) {
        if (emp.portal_enabled === false) {
          setIsBlocked(true);
          setBlockReason(emp.block_reason || 'Your portal access has been disabled.');
        }
        setEmployee(emp);
        hasLoadedRef.current = true;
        return;
      }

      // Fallback: Check localStorage
      const userData = localStorage.getItem('user_data');
      const userType = localStorage.getItem('user_type');
      
      if (userData && (userType === 'admin' || userType === 'employee')) {
        try {
          const parsed = JSON.parse(userData);
          
          let portalEnabled = true;
          let blockReasonText: string | null = null;

          const { data: accessData, error: rpcError } = await supabase.rpc('check_employee_portal_access', {
            p_email: parsed.email
          });
          
          if (!rpcError && accessData && accessData.found) {
            portalEnabled = accessData.portal_enabled;
            blockReasonText = accessData.block_reason;
          }
          
          const minimalEmployee = {
            id: parsed.id,
            auth_user_id: parsed.id,
            employee_id: parsed.employee_id || `EMP-${parsed.id?.slice(0, 8)}`,
            name: parsed.name || 'Employee',
            email: parsed.email,
            phone: parsed.phone || '',
            role: parsed.role || userType,
            status: 'active',
            portal_enabled: portalEnabled,
            block_reason: blockReasonText,
            is_2fa_enabled: false,
            permissions: parsed.permissions || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Employee;
          
          if (!portalEnabled) {
            setIsBlocked(true);
            setBlockReason(blockReasonText || 'Your portal access has been disabled.');
          }
          
          setEmployee(minimalEmployee);
          hasLoadedRef.current = true;
          return;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      setEmployee(null);
    } catch (error) {
      console.error('Error loading employee:', error);
      setEmployee(null);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Refresh employee data
  const refreshEmployee = useCallback(async () => {
    hasLoadedRef.current = false;
    isLoadingRef.current = false;
    await loadEmployee();
  }, [loadEmployee]);

  // Fast logout
  const fastLogout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('portal_sidebar_collapsed');
    clearPermissionsCache();
    sessionStorage.clear();
    setEmployee(null);
    hasLoadedRef.current = false;
    supabase.auth.signOut().catch(() => {});
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/auth';
  }, []);

  // Async logout
  const logout = useCallback(async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('portal_sidebar_collapsed');
    clearPermissionsCache();
    sessionStorage.clear();
    setEmployee(null);
    hasLoadedRef.current = false;
    router.push('/auth');
    try {
      await Promise.all([
        supabase.auth.signOut(),
        fetch('/api/auth/logout', { method: 'POST' })
      ]);
    } catch (e) {
      console.error('Logout error:', e);
    }
  }, [router]);

  // Has permission check
  const hasPermission = useCallback((permission: string): boolean => {
    if (!employee) return false;
    return checkPermission(employee.role, permission);
  }, [employee]);

  // Computed values
  const isAuthenticated = !!employee;
  const role = employee?.role || null;

  // Load employee on mount
  useEffect(() => {
    loadEmployee();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setEmployee(null);
          hasLoadedRef.current = false;
          router.push('/auth');
        } else if (event === 'SIGNED_IN' && !hasLoadedRef.current) {
          await loadEmployee();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadEmployee, router]);

  // Real-time block detection
  useEffect(() => {
    if (!employee?.id || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`employee-block-${employee.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employees',
          filter: `id=eq.${employee.id}`,
        },
        (payload) => {
          const newData = payload.new as { portal_enabled?: boolean; block_reason?: string };
          if (newData.portal_enabled === false) {
            setIsBlocked(true);
            setBlockReason(newData.block_reason || 'Your portal access has been disabled.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee?.id]);

  // Context value
  const authContextValue: PortalAuthContextType = {
    employee,
    isLoading,
    isAuthenticated,
    role,
    hasPermission,
    logout,
    fastLogout,
    refreshEmployee,
    isBlocked,
    blockReason,
  };

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
    return (
      <PortalAuthContext.Provider value={authContextValue}>
        <LoadingSpinner />
      </PortalAuthContext.Provider>
    );
  }

  // Render auth pages without layout
  if (isAuthPage) {
    return (
      <PortalAuthContext.Provider value={authContextValue}>
        {children}
      </PortalAuthContext.Provider>
    );
  }

  // Render full layout for authenticated users (either from hook or localStorage)
  if (!isAuthenticated && !hasLocalAuth) {
    return (
      <PortalAuthContext.Provider value={authContextValue}>
        <LoadingSpinner />
      </PortalAuthContext.Provider>
    );
  }

  return (
    <PortalAuthContext.Provider value={authContextValue}>
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
    </PortalAuthContext.Provider>
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
  const { role, hasPermission, isLoading } = usePortalAuthContext();
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
  icon?: React.ReactNode;
}

export function SectionHeader({ title, description, action, icon }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between mb-4 sm:mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-wide portal-heading truncate">{title}</h2>
        </div>
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
