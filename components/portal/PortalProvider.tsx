'use client';

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { PortalSidebar, PortalAppbar, MobileSidebar, MobileBottomNav } from './PortalLayout';
import { BlockedUserDialog } from './BlockedUserDialog';
import PageLoader from '@/components/custom/PageLoader';
import { ErrorBoundary, SectionErrorBoundary } from '@/components/ui/error-boundary';
import { QueryProvider } from '@/lib/query-provider';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured, restoreSupabaseSession, setSupabaseSession } from '@/lib/supabase';
import { realtimeManager, CHANNEL_NAMES } from '@/lib/realtime-manager';
import { getCurrentEmployee, getMyNotifications, markNotificationsRead, getAuthenticatedClient, clearRequestCache } from '@/lib/portal-queries';
import { clearPermissionsCache } from '@/lib/permissions';
import { clearAuthToken, getAuthToken } from '@/lib/cookies';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Label } from '@/components/custom/ui/label';
import type { Employee, EmployeeRole, Notification } from '@/types/portal';
import { hasPermission as checkPermission } from '@/types/portal';

// Helper to sanitize avatar URLs - prevents blob URLs from being used
function sanitizeAvatarUrl(url: string | null | undefined): string {
  if (!url || url.trim() === '') return '';
  // Reject blob URLs - they are temporary and not valid for storage/context
  if (url.startsWith('blob:')) return '';
  return url;
}

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
  // Notifications - shared to prevent duplicate API calls
  notifications: Notification[];
  unreadCount: number;
  markNotificationAsRead: (ids: string[]) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  // Content-area CRUD loader (overlays main only, not sidebar)
  setContentLoading: (v: boolean) => void;
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
      notifications: [],
      unreadCount: 0,
      markNotificationAsRead: async () => {},
      markAllNotificationsAsRead: async () => {},
      refreshNotifications: async () => {},      setContentLoading: () => {},    };
  }
  return context;
}

interface PortalProviderProps {
  children: React.ReactNode;
  initialEmployee?: Employee | null;
}

// Loading spinner — uses the branded Zoiro PageLoader
function LoadingSpinner() {
  return <PageLoader />;
}

export function PortalProvider({ children, initialEmployee }: PortalProviderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Auth state - managed here, shared via context
  // Initialize from SSR data if provided
  const [employee, setEmployee] = useState<Employee | null>(initialEmployee || null);
  const [isLoading, setIsLoading] = useState(!initialEmployee); // Skip loading if SSR data provided
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  // Notifications state - shared to prevent duplicate API calls
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsLoadedRef = useRef(false);

  // Content-area CRUD loader
  const [contentLoading, setContentLoadingRaw] = useState(false);
  const [contentFading, setContentFading]       = useState(false);
  const contentFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setContentLoading = useCallback((v: boolean) => {
    if (v) {
      // Cancel any in-progress fade-out and show immediately
      if (contentFadeTimer.current) clearTimeout(contentFadeTimer.current);
      setContentFading(false);
      setContentLoadingRaw(true);
    } else {
      // Fade out over 250 ms, then unmount
      setContentFading(true);
      contentFadeTimer.current = setTimeout(() => {
        setContentLoadingRaw(false);
        setContentFading(false);
      }, 250);
    }
  }, []);
  
  const router = useRouter();
  const pathname = usePathname();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Clean up URL query params (like ?google_login=success) after portal loads
  useEffect(() => {
    if (mounted && !isLoading && employee) {
      // Clean up success query params from URL
      const url = new URL(window.location.href);
      if (url.searchParams.has('google_login') || url.searchParams.has('google_register')) {
        url.searchParams.delete('google_login');
        url.searchParams.delete('google_register');
        url.searchParams.delete('new_user');
        window.history.replaceState(null, '', url.pathname);
      }
    }
  }, [mounted, isLoading, employee]);

  // CRITICAL: Ensure body scroll is restored when mobile menu closes
  // This fixes Radix UI Dialog scroll lock not being properly cleaned up
  useEffect(() => {
    if (!mobileMenuOpen) {
      // Small delay to allow Radix to cleanup first
      const timer = setTimeout(() => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mobileMenuOpen]);

  // Check if current page is auth page (unified auth or old portal auth pages)
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/activate' || pathname === '/auth';

  // Load notifications - only once per session
  const loadNotifications = useCallback(async () => {
    if (!employee || notificationsLoadedRef.current) return;
    notificationsLoadedRef.current = true;
    
    try {
      const data = await getMyNotifications(50, false);
      setNotifications(data);
    } catch (err) {
      // Handle error silently
    }
  }, [employee]);

  // Mark notifications as read
  const markNotificationAsRead = useCallback(async (ids: string[]) => {
    await markNotificationsRead(ids);
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markNotificationAsRead(unreadIds);
    }
  }, [notifications, markNotificationAsRead]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    notificationsLoadedRef.current = false;
    await loadNotifications();
  }, [loadNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Load notifications when employee is available
  useEffect(() => {
    if (employee && !notificationsLoadedRef.current) {
      loadNotifications();
      
      // Subscribe to new notifications via shared NOTIFICATIONS channel
      const callback = (payload?: any) => {
        if (payload?.eventType !== 'INSERT') return;
        setNotifications((prev) => [payload.new as Notification, ...prev]);
        
        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new window.Notification((payload.new as Notification).title, {
            body: (payload.new as Notification).message,
            icon: '/assets/logo.png',
          });
        }
      };

      const unsubscribe = realtimeManager.subscribe(
        CHANNEL_NAMES.NOTIFICATIONS,
        'notifications',
        callback,
        { filter: `user_id=eq.${employee.id}` }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [employee, loadNotifications]);

  // Load employee data - only called once, skip if SSR data provided
  const loadEmployee = useCallback(async () => {
    // Always restore session for client-side operations (even with SSR data)
    const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('sb_refresh_token');
    if (accessToken) {
      await setSupabaseSession(accessToken, refreshToken || undefined);
    }
    
    // Skip if SSR already provided employee data
    if (initialEmployee) {
      if (initialEmployee.portal_enabled === false) {
        setIsBlocked(true);
        setBlockReason(initialEmployee.block_reason || 'Your portal access has been disabled.');
      }
      hasLoadedRef.current = true;
      isLoadingRef.current = false;
      setIsLoading(false);
      return;
    }
    
    if (isLoadingRef.current || hasLoadedRef.current) return;
    isLoadingRef.current = true;
    
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // Skip employee fetch if user is a customer (determined during login)
    const userType = localStorage.getItem('user_type');
    if (userType === 'customer') {
      // Customer user - redirect to customer portal
      setIsLoading(false);
      isLoadingRef.current = false;
      router.push('/');
      return;
    }

    try {
      // IMPORTANT: Restore Supabase session from cookies/localStorage first
      // This ensures auth.uid() works correctly in RLS policies
      const sessionRestored = await restoreSupabaseSession();
      
      if (!sessionRestored) {
        // Try to restore from localStorage tokens
        const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
        const refreshToken = localStorage.getItem('sb_refresh_token');
        if (accessToken) {
          await setSupabaseSession(accessToken, refreshToken || undefined);
        }
      }

      // getCurrentEmployee() handles auth.getUser() internally - no need to call it here
      const emp = await getCurrentEmployee();
      if (emp) {
        if (emp.portal_enabled === false) {
          setIsBlocked(true);
          setBlockReason(emp.block_reason || 'Your portal access has been disabled.');
        }
        setEmployee(emp);
        hasLoadedRef.current = true;
        
        // FIX #9: Update localStorage with minimal data only (no PII like address/emergency_contact)
        try {
          const existingData = localStorage.getItem('user_data');
          if (existingData) {
            const parsed = JSON.parse(existingData);
            // Only store essential non-sensitive data in localStorage
            // Sanitize avatar_url to prevent blob URLs
            const updatedData = {
              id: parsed.id,
              email: parsed.email,
              name: emp.name,
              role: emp.role,
              avatar_url: sanitizeAvatarUrl(emp.avatar_url),
              is_2fa_enabled: emp.is_2fa_enabled,
            };
            localStorage.setItem('user_data', JSON.stringify(updatedData));
          }
        } catch (e) {
          // Silent fail - not critical
        }
        
        return;
      }

      // Fallback: Check localStorage - only use as fallback if we have proper employee data
      const userData = localStorage.getItem('user_data');
      const userType = localStorage.getItem('user_type');
      
      // Only use localStorage if user_type is admin/employee AND we have valid employee_id
      if (userData && (userType === 'admin' || userType === 'employee')) {
        try {
          const parsed = JSON.parse(userData);
          
          // IMPORTANT: Only use localStorage fallback if we have BOTH a valid employee_id AND database ID
          // If we only have auth_user_id, that means the localStorage was set incorrectly
          if (!parsed.employee_id || !parsed.id || parsed.id === parsed.auth_user_id) {
            // Clear invalid data
            localStorage.removeItem('user_data');
            localStorage.removeItem('user_type');
            setEmployee(null);
            return;
          }
          
          let portalEnabled = true;
          let blockReasonText: string | null = null;

          const { data: accessData, error: rpcError } = await getAuthenticatedClient().rpc('check_employee_portal_access', {
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
            address: parsed.address || '',
            emergency_contact: parsed.emergency_contact || '',
            avatar_url: sanitizeAvatarUrl(parsed.avatar_url),
            hired_date: parsed.hired_date || '',
            role: parsed.role || userType,
            status: 'active',
            portal_enabled: portalEnabled,
            block_reason: blockReasonText,
            is_2fa_enabled: parsed.is_2fa_enabled || false,
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
          // Error parsing localStorage
          }
      }

      setEmployee(null);
    } catch (error) {
      setEmployee(null);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Refresh employee data - forces fresh fetch from database
  // Note: This doesn't set isLoading to avoid component remount/flicker
  const refreshEmployee = useCallback(async () => {
    // Fetch fresh data from database directly
    try {
      const emp = await getCurrentEmployee();
      
      if (emp) {
        // Create a new object to ensure React detects the change
        // Sanitize avatar_url to prevent blob URLs from being stored
        const freshEmployee = { 
          ...emp,
          avatar_url: sanitizeAvatarUrl(emp.avatar_url)
        };
        setEmployee(freshEmployee);
        
        // FIX #9: Update localStorage with minimal non-sensitive data only
        const userData = localStorage.getItem('user_data');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            const updatedData = {
              id: parsed.id,
              email: parsed.email,
              name: emp.name,
              role: emp.role,
              avatar_url: sanitizeAvatarUrl(emp.avatar_url),
              is_2fa_enabled: emp.is_2fa_enabled,
            };
            localStorage.setItem('user_data', JSON.stringify(updatedData));
          } catch (e) {
            // Silent fail - not critical
          }
        }
      }
    } catch (error) {
      // Silent fail - will retry on next refresh
    }
  }, []);

  // Shared nuke helper — wipes every token/session artifact
  const nukeAllAuth = useCallback(() => {
    clearRequestCache();
    clearAuthToken();
    [
      'user_data', 'user_type', 'auth_token', 'sb_access_token', 'sb_refresh_token',
      'portal_sidebar_collapsed', 'zoiro-cart', 'zoiro_guest_favorites',
    ].forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) localStorage.removeItem(key);
    });
    const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `auth_token=; path=/; ${expires}; SameSite=Lax`;
    document.cookie = `sb-access-token=; path=/; ${expires}; SameSite=Lax`;
    document.cookie = `sb-refresh-token=; path=/; ${expires}; SameSite=Lax`;
    document.cookie = `user_type=; path=/; ${expires}; SameSite=Lax`;
    document.cookie = `employee_data=; path=/; ${expires}; SameSite=Lax`;
    clearPermissionsCache();
    sessionStorage.clear();
    setEmployee(null);
    hasLoadedRef.current = false;
  }, []);

  // Fast logout
  const fastLogout = useCallback(() => {
    nukeAllAuth();
    supabase.auth.signOut().catch(() => {});
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.href = '/auth';
  }, [nukeAllAuth]);

  // Async logout
  const logout = useCallback(async () => {
    nukeAllAuth();
    try {
      await Promise.all([
        supabase.auth.signOut(),
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }),
      ]);
    } catch { /* silent fail */ }
    router.push('/auth');
  }, [nukeAllAuth, router]);

  // Has permission check
  const hasPermission = useCallback((permission: string): boolean => {
    if (!employee) return false;
    return checkPermission(employee.role, permission);
  }, [employee]);

  // Computed values
  const isAuthenticated = !!employee;
  const role = employee?.role || null;

  // Proactive token refresh - check every 2 minutes and refresh if expiring soon
  useEffect(() => {
    if (!employee) return;

    const refreshTokenIfNeeded = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if token expires in less than 5 minutes
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresAtMs = expiresAt * 1000;
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;

          if (expiresAtMs - now < fiveMinutes) {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('Token refresh failed:', error.message);
              // If refresh fails, force re-login
              if (error.message.includes('expired') || error.message.includes('invalid')) {
                fastLogout();
              }
            } else if (data.session) {
              // Sync new tokens to storage
              const newAccessToken = data.session.access_token;
              const newRefreshToken = data.session.refresh_token;
              
              // Update localStorage
              localStorage.setItem('sb_access_token', newAccessToken);
              localStorage.setItem('auth_token', newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem('sb_refresh_token', newRefreshToken);
              }
              
              // Update cookies
              const maxAge = 60 * 60 * 24 * 7; // 7 days
              document.cookie = `sb-access-token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
              document.cookie = `auth_token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
              if (newRefreshToken) {
                document.cookie = `sb-refresh-token=${encodeURIComponent(newRefreshToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
              }
              
            }
          }
        }
      } catch (err) {
        console.error('Error checking token expiry:', err);
      }
    };

    // Check immediately
    refreshTokenIfNeeded();

    // Then check every 2 minutes
    const interval = setInterval(refreshTokenIfNeeded, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [employee, fastLogout]);

  // Load employee on mount
  useEffect(() => {
    loadEmployee();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setEmployee(null);
          hasLoadedRef.current = false;
          router.push('/auth');
        } else if (event === 'SIGNED_IN' && !hasLoadedRef.current) {
          await loadEmployee();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Sync refreshed tokens to cookies
          const newAccessToken = session.access_token;
          const newRefreshToken = session.refresh_token;
          
          localStorage.setItem('sb_access_token', newAccessToken);
          localStorage.setItem('auth_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('sb_refresh_token', newRefreshToken);
          }
          
          const maxAge = 60 * 60 * 24 * 7;
          document.cookie = `sb-access-token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `auth_token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          
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
    // Notifications - shared to prevent duplicate API calls
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
    setContentLoading,
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
      // Check localStorage/cookie as additional auth source
      const userType = localStorage.getItem('user_type');
      const authToken = getAuthToken();
      const hasLocalAuth = (userType === 'admin' || userType === 'employee') && authToken;
      
      // If user is a customer (not employee/admin), redirect them away from portal
      if (userType === 'customer') {
        localStorage.removeItem('user_type'); // Clear to prevent loop
        router.push('/');
        return;
      }
      
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

  // Check localStorage/cookie auth as fallback
  const hasLocalAuth = typeof window !== 'undefined' && 
    (localStorage.getItem('user_type') === 'admin' || localStorage.getItem('user_type') === 'employee') &&
    getAuthToken();

  // Don't render anything while loading
  if (!mounted || isLoading) {
    return (
      <QueryProvider>
        <PortalAuthContext.Provider value={authContextValue}>
          <LoadingSpinner />
        </PortalAuthContext.Provider>
      </QueryProvider>
    );
  }

  // Render auth pages without layout
  if (isAuthPage) {
    return (
      <QueryProvider>
        <PortalAuthContext.Provider value={authContextValue}>
          {children}
        </PortalAuthContext.Provider>
      </QueryProvider>
    );
  }

  // Render full layout for authenticated users (either from hook or localStorage)
  if (!isAuthenticated && !hasLocalAuth) {
    return (
      <QueryProvider>
        <PortalAuthContext.Provider value={authContextValue}>
          <LoadingSpinner />
        </PortalAuthContext.Provider>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
    <PortalAuthContext.Provider value={authContextValue}>
    <div className="min-h-screen min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 portal-mobile-container overflow-y-auto">
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

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setMobileMenuOpen(true)} />

      {/* Main Content - Mobile optimized with Error Boundary */}
      <main
        className={cn(
          'relative pt-14 sm:pt-16 transition-all duration-300',
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-[280px]',
          // Add padding for mobile bottom nav - ensure content isn't cut off
          'pb-24 md:pb-6',
          // Ensure proper scrolling on mobile
          'min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]'
        )}
      >
        {/* CRUD action loader — absolute so it never covers sidebar */}
        {(contentLoading || contentFading) && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto overflow-hidden"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,235,235,0.95) 0%, rgba(255,229,229,0.9) 100%)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              opacity: contentFading ? 0 : 1,
              transition: 'opacity 250ms ease',
            }}
          >
            <style>{`
              @keyframes portalZoiroSpin {
                0%   { transform: rotateY(0deg) scale(1); }
                50%  { transform: rotateY(180deg) scale(1.05); }
                100% { transform: rotateY(360deg) scale(1); }
              }
              @keyframes portalCircleRotate {
                0%   { transform: rotate(-90deg); }
                100% { transform: rotate(270deg); }
              }
              @keyframes portalProgressDash {
                0%   { stroke-dasharray: 1, 400; stroke-dashoffset: 0; }
                50%  { stroke-dasharray: 300, 400; stroke-dashoffset: -100; }
                100% { stroke-dasharray: 300, 400; stroke-dashoffset: -400; }
              }
              @keyframes portalOuterPulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                50% { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
              }
              @keyframes portalLogoPulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.03); }
              }
              @keyframes portalGlowPulse {
                0%, 100% { filter: drop-shadow(0 0 8px rgba(220,38,38,0.4)); }
                50% { filter: drop-shadow(0 0 16px rgba(220,38,38,0.7)); }
              }
              @keyframes portalOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes portalFloat {
                0%, 100% { transform: translateY(0); opacity: 0.3; }
                50% { transform: translateY(-10px); opacity: 0.6; }
              }
              @keyframes portalGradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .portal-letter {
                display: inline-block;
                background: linear-gradient(
                  135deg,
                  #dc2626 0%,
                  #ff6b6b 30%,
                  #fca5a5 50%,
                  #ff6b6b 70%,
                  #dc2626 100%
                );
                background-size: 300% auto;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: portalZoiroSpin 2s ease-in-out infinite, portalGradientShift 3s ease infinite;
                transform-origin: center;
              }
              .portal-letter:nth-child(1) { animation-delay: 0s, 0s; }
              .portal-letter:nth-child(2) { animation-delay: 0.15s, 0.1s; }
              .portal-letter:nth-child(3) { animation-delay: 0.3s, 0.2s; }
              .portal-letter:nth-child(4) { animation-delay: 0.45s, 0.3s; }
              .portal-letter:nth-child(5) { animation-delay: 0.6s, 0.4s; }
              .portal-loading-circle { animation: portalCircleRotate 1.5s linear infinite, portalGlowPulse 2s ease-in-out infinite; }
              .portal-loading-circle circle.portal-progress { animation: portalProgressDash 1.5s ease-in-out infinite; }
              .portal-outer-ring { animation: portalOuterPulse 2s ease-in-out infinite; }
              .portal-logo-container { animation: portalLogoPulse 2s ease-in-out infinite; }
              .portal-orbit-container { animation: portalOrbit 3s linear infinite; }
              .portal-float-particle {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(220,38,38,0.6) 0%, rgba(220,38,38,0) 70%);
                pointer-events: none;
                animation: portalFloat 2s ease-in-out infinite;
              }
              @media (max-width: 480px) {
                .portal-letter { animation-duration: 1.8s, 2.5s; }
                .portal-loading-circle { animation-duration: 1.2s, 1.8s; }
              }
            `}</style>
            
            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="portal-float-particle"
                style={{
                  width: `${Math.random() * 6 + 4}px`,
                  height: `${Math.random() * 6 + 4}px`,
                  left: `${Math.random() * 80 + 10}%`,
                  top: `${Math.random() * 80 + 10}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${Math.random() * 1.5 + 1.5}s`,
                }}
              />
            ))}
            
            {/* Logo with circular progress around it */}
            <div style={{ 
              position: 'relative', 
              marginBottom: 'clamp(20px, 4vh, 32px)',
              width: 'clamp(100px, 30vw, 180px)',
              height: 'clamp(100px, 30vw, 180px)',
            }}>
              {/* Outer Glow Ring */}
              <div
                className="portal-outer-ring"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '115%',
                  height: '115%',
                  borderRadius: '50%',
                  border: '2px solid rgba(220,38,38,0.2)',
                  boxShadow: '0 0 30px rgba(220,38,38,0.15), inset 0 0 20px rgba(220,38,38,0.1)',
                }}
              />
              
              {/* Orbiting dot */}
              <div 
                className="portal-orbit-container"
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'clamp(6px, 1.5vw, 10px)',
                    height: 'clamp(6px, 1.5vw, 10px)',
                    borderRadius: '50%',
                    background: '#dc2626',
                    boxShadow: '0 0 10px rgba(220,38,38,0.8)',
                  }}
                />
              </div>
              
              {/* Circular Progress Bar */}
              <svg 
                className="portal-loading-circle" 
                viewBox="0 0 180 180"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '100%',
                  height: '100%',
                }}
              >
                {/* Background track */}
                <circle
                  cx="90"
                  cy="90"
                  r="85"
                  fill="none"
                  stroke="rgba(220,38,38,0.15)"
                  strokeWidth="4"
                />
                {/* Animated progress */}
                <circle
                  className="portal-progress"
                  cx="90"
                  cy="90"
                  r="85"
                  fill="none"
                  stroke="url(#portalProgressGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="portalProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="50%" stopColor="#ff6b6b" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Logo in center */}
              <div 
                className="portal-logo-container"
                style={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  zIndex: 1,
                  width: '78%',
                  height: '78%',
                }}
              >
                <Image
                  src="/assets/fifth_avenue_urban_logo_1777394607150.png"
                  alt="Fifth Avenue"
                  fill
                  sizes="(max-width: 480px) 80px, 140px"
                  style={{ 
                    borderRadius: '50%', 
                    boxShadow: '0 8px 32px rgba(220,38,38,0.5)',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>
            {/* Spinning Letters */}
            <div
              style={{
                fontFamily: 'var(--font-bebas, "Bebas Neue", sans-serif)',
                fontSize: 'clamp(1.5rem, 6vw, 3.5rem)',
                letterSpacing: 'clamp(0.1em, 1.5vw, 0.2em)',
                lineHeight: 1,
                display: 'flex',
                gap: 'clamp(2px, 0.6vw, 5px)',
              }}
            >
              {'FIFTH AVENUE'.split('').map((letter, index) => (
                <span key={index} className="portal-letter">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-2.5 xs:p-3 sm:p-4 md:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
    </PortalAuthContext.Provider>
    </QueryProvider>
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
// STATS CARD COMPONENT - Mobile Optimized
// =============================================

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, change, changeType = 'neutral', icon, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-none p-4 sm:p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
        'transition-all duration-200 hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bebas tracking-widest text-black/40 uppercase mb-1">{title}</p>
          <p className="text-3xl sm:text-4xl font-bebas text-black leading-none">{value}</p>
          {change && (
            <p
              className={cn(
                'text-xs font-black uppercase tracking-tighter mt-2',
                changeType === 'positive' && 'text-[#008A45]',
                changeType === 'negative' && 'text-[#ED1C24]',
                changeType === 'neutral' && 'text-zinc-400'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-black text-[#FFD200] shadow-[4px_4px_0px_0px_rgba(237,28,36,1)] flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

// =============================================
// SECTION HEADER COMPONENT - Mobile Optimized
// =============================================

export function SectionHeader({ title, description, action, icon }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 border-b-8 border-black pb-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          {icon && <span className="flex-shrink-0 text-[#ED1C24]">{icon}</span>}
          <h2 className="hidden md:block text-3xl sm:text-4xl md:text-6xl font-bebas text-black tracking-tight uppercase leading-none">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-black/60 font-source-sans font-black text-xs sm:text-sm mt-2 uppercase tracking-widest">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0 w-full sm:w-auto">{action}</div>}
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
