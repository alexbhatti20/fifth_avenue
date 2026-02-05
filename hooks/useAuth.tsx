import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, Customer, setSupabaseSession } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { 
  setAuthToken, 
  getAuthToken, 
  clearAuthToken 
} from '@/lib/cookies';
import { deduplicateRequest, CACHE_KEYS as DEDUP_KEYS, clearRequestCache } from '@/lib/request-dedup';

// Use relative URLs for API calls - this always works for same-origin requests
// No need for NEXT_PUBLIC_APP_URL which can cause CORS issues in development
const getApiUrl = () => {
  // In browser, use relative URL (same origin)
  if (typeof window !== 'undefined') {
    return '';
  }
  // On server, use the full URL
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

// Global auth cache to prevent re-fetching across component mounts
let globalAuthCache: {
  user: Customer | null;
  authUser: User | null;
  isFetched: boolean;
  fetchPromise: Promise<void> | null;
} = {
  user: null,
  authUser: null,
  isFetched: false,
  fetchPromise: null,
};

// Custom event for auth state changes
const AUTH_STATE_CHANGE_EVENT = 'auth-state-change';

// Helper to dispatch auth state change
const dispatchAuthChange = (user: Customer | null) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT, { detail: user }));
  }
};

interface LoginResult {
  error: string | null;
  requiresOTP?: boolean;
  requires2FA?: boolean;
  employeeId?: string;
  directLogin?: boolean;
  userType?: 'customer' | 'employee' | 'admin';
}

interface VerifyOTPResult {
  error: string | null;
  userType?: 'customer' | 'employee' | 'admin';
}

interface UseAuthReturn {
  user: Customer | null;
  authUser: User | null;
  isLoading: boolean;
  isBanned: boolean;
  banReason: string | null;
  sendLoginOTP: (email: string, password: string) => Promise<LoginResult>;
  verifyLoginOTP: (email: string, otp: string) => Promise<VerifyOTPResult>;
  sendRegisterOTP: (email: string, name: string, phone: string, password: string, address?: string) => Promise<{ error: string | null }>;
  verifyRegisterOTP: (email: string, otp: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fastSignOut: () => void;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

export function useAuth(): UseAuthReturn {
  // Initialize state from global cache OR localStorage for instant hydration
  const [user, setUser] = useState<Customer | null>(() => {
    // First check global cache
    if (globalAuthCache.user) return globalAuthCache.user;
    // Then try localStorage (for first mount)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user_data');
        if (stored) {
          const userData = JSON.parse(stored);
          globalAuthCache.user = userData;
          return userData;
        }
      } catch {}
    }
    return null;
  });
  const [authUser, setAuthUser] = useState<User | null>(() => globalAuthCache.authUser);
  const [isLoading, setIsLoading] = useState(() => {
    // If we have a user in cache or localStorage, we're not loading
    if (globalAuthCache.user) return false;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user_data');
        if (stored) return false;
      } catch {}
    }
    return !globalAuthCache.isFetched;
  });
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(globalAuthCache.isFetched);

  // Load user from localStorage on mount (for persistence)
  const loadUserFromStorage = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('user_data');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        // Only set user if it's different to prevent infinite loops
        setUser((prev) => {
          if (!prev || prev.id !== userData.id) {
            return userData;
          }
          return prev;
        });
        return true;
      }
    } catch {
      // Failed to load from storage - continue without stored user
    }
    return false;
  }, []);

  const fetchUser = useCallback(async () => {
    // Prevent duplicate calls using both ref and deduplication
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // First check localStorage for persisted user
      const hasStoredUser = loadUserFromStorage();
      
      // Skip customer fetch if user is an employee (determined during login)
      const userType = localStorage.getItem('user_type');
      if (userType === 'employee' || userType === 'admin') {
        // Employee user - don't fetch customer data, just validate session
        setIsLoading(false);
        isFetchingRef.current = false;
        hasFetchedRef.current = true;
        globalAuthCache.isFetched = true;
        return;
      }
      
      // Use deduplication for getUser call
      const authUser = await deduplicateRequest(DEDUP_KEYS.AUTH_USER, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
      }, { ttl: 5000 });

      if (authUser) {
        setAuthUser(authUser);
        // Use deduplication for RPC call to prevent duplicate customer fetches
        const customerData = await deduplicateRequest(DEDUP_KEYS.CURRENT_CUSTOMER, async () => {
          const { data, error } = await supabase.rpc('get_customer_by_auth_id', {
            p_auth_user_id: authUser.id
          });
          if (error || !data || data.length === 0) return null;
          return data[0];
        }, { ttl: 5000 });

        if (customerData) {
          setUser(customerData);
          globalAuthCache.user = customerData;
          // Persist user data
          localStorage.setItem('user_data', JSON.stringify(customerData));
        }
        
        // Store token in both localStorage AND cookie (for SSR)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setAuthToken(session.access_token);
        }
      } else if (!hasStoredUser) {
        // Only clear if we also don't have stored user
        setUser(null);
        setAuthUser(null);
        clearAuthToken();
        localStorage.removeItem('user_data');
      }
    } catch {
      // Don't clear user if we have stored data
      if (!loadUserFromStorage()) {
        setUser(null);
        setAuthUser(null);
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
      globalAuthCache.isFetched = true;
      globalAuthCache.fetchPromise = null;
    }
  }, [loadUserFromStorage]);

  useEffect(() => {
    // If already fetched globally, don't re-fetch (instant navigation)
    if (globalAuthCache.isFetched && globalAuthCache.user) {
      setUser(globalAuthCache.user);
      setAuthUser(globalAuthCache.authUser);
      setIsLoading(false);
      return;
    }

    // First load from storage immediately for instant UI
    const hasStoredUser = loadUserFromStorage();
    
    // If no stored user, keep loading true until fetch completes
    if (!hasStoredUser) {
      // fetchUser will set isLoading to false when done
    } else {
      setIsLoading(false);
    }
    
    // Then try to fetch fresh data (only once)
    if (!globalAuthCache.fetchPromise) {
      globalAuthCache.fetchPromise = fetchUser() as unknown as Promise<void>;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Sync refreshed tokens to storage
        const newAccessToken = session.access_token;
        const newRefreshToken = session.refresh_token;
        
        try {
          setAuthToken(newAccessToken);
          localStorage.setItem('sb_access_token', newAccessToken);
          localStorage.setItem('auth_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('sb_refresh_token', newRefreshToken);
          }
          
          // Also update cookies
          const maxAge = 60 * 60 * 24 * 7; // 7 days
          document.cookie = `sb-access-token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `auth_token=${encodeURIComponent(newAccessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          
        } catch (e) {
          console.error('Error syncing refreshed token:', e);
        }
      } else if (session && !hasFetchedRef.current) {
        // Only fetch if not already fetched
        fetchUser();
      } else if (!session) {
        // Check if we have a manual token before clearing
        const token = getAuthToken();
        if (!token) {
          setUser(null);
          setAuthUser(null);
          clearAuthToken();
          localStorage.removeItem('user_data');
          hasFetchedRef.current = false;
        }
      }
    });

    // Listen for auth state changes from other components
    const handleAuthChange = (event: CustomEvent<Customer | null>) => {
      setUser(event.detail);
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);
    };
  }, [fetchUser, loadUserFromStorage]);

  // Real-time ban detection subscription
  useEffect(() => {
    if (!user?.id) {
      setIsBanned(false);
      setBanReason(null);
      return;
    }

    // Immediately check ban status from existing user data
    if ((user as any)?.is_banned === true) {
      setIsBanned(true);
      setBanReason((user as any)?.ban_reason || 'Your account has been suspended.');
    }

    // Subscribe to real-time changes for ban status
    const channel = supabase
      .channel(`customer-ban-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as { is_banned?: boolean; ban_reason?: string };
          
          // Check if customer was banned or unbanned
          if (newData.is_banned === true) {
            setIsBanned(true);
            setBanReason(newData.ban_reason || 'Your account has been suspended.');
          } else {
            // Unbanned
            setIsBanned(false);
            setBanReason(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Step 1: Send login request - may return token directly or require OTP
  const sendLoginOTP = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to login', requiresOTP: false };
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        return {
          error: null,
          requires2FA: true,
          employeeId: data.employeeId,
          userType: data.userType,
        };
      }

      // Store userType if provided
      const userType = data.userType as 'customer' | 'employee' | 'admin' | undefined;
      if (userType) {
        localStorage.setItem('user_type', userType);
        // Also set cookie for SSR auth
        document.cookie = `user_type=${userType}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      // Check if direct login (no OTP required)
      if (data.requiresOTP === false && data.token) {
        // Store token in cookie and localStorage (for SSR)
        setAuthToken(data.token);
        
        // Store Supabase access token for RLS-enabled API calls
        if (data.supabaseAccessToken) {
          localStorage.setItem('sb_access_token', data.supabaseAccessToken);
          // CRITICAL: Set the session in Supabase client for RLS policies
          // This ensures auth.uid() works correctly in database queries
          await setSupabaseSession(data.supabaseAccessToken);
        }
        
        // Store user data directly from response
        if (data.user) {
          const userData = {
            id: data.user.id,
            auth_user_id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            phone: data.user.phone,
            address: data.user.address || '',
            is_verified: true,
            is_2fa_enabled: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Employee/Admin specific fields
            ...(userType !== 'customer' && {
              role: data.user.role,
              employee_id: data.user.employee_id,
              permissions: data.user.permissions,
            }),
          };
          setUser(userData as Customer);
          localStorage.setItem('user_data', JSON.stringify(userData));
          // Dispatch event for other components
          dispatchAuthChange(userData as Customer);
        }
        
        return { error: null, requiresOTP: false, directLogin: true, userType };
      }

      // OTP is required
      return { error: null, requiresOTP: true, directLogin: false, userType };
    } catch (error) {
      return { error: 'An unexpected error occurred', requiresOTP: false };
    }
  };

  // Step 2: Verify login OTP
  const verifyLoginOTP = async (email: string, otp: string): Promise<VerifyOTPResult> => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Invalid OTP' };
      }

      if (data.token) {
        setAuthToken(data.token);
        localStorage.setItem('sb_access_token', data.token);
        // CRITICAL: Set the session in Supabase client for RLS policies
        await setSupabaseSession(data.token);
      }

      // Store userType for redirect logic
      const userType = data.userType as 'customer' | 'employee' | 'admin';
      localStorage.setItem('user_type', userType);
      // Also set cookie for SSR auth
      document.cookie = `user_type=${userType}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      // Store user data directly from response
      if (data.user) {
        const userData = {
          id: data.user.id,
          auth_user_id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          address: data.user.address || '',
          is_verified: true,
          is_2fa_enabled: data.user.is2FAEnabled || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Employee/Admin specific fields
          ...(userType !== 'customer' && {
            role: data.user.role,
            employee_id: data.user.employee_id,
            permissions: data.user.permissions,
          }),
        };
        setUser(userData as Customer);
        localStorage.setItem('user_data', JSON.stringify(userData));
        // Dispatch event for other components
        dispatchAuthChange(userData as Customer);
      } else {
        await fetchUser();
      }
      
      return { error: null, userType };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Step 1: Send registration OTP
  const sendRegisterOTP = async (email: string, name: string, phone: string, password: string, address?: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, password, address }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to send OTP' };
      }

      // DEV MODE: Show OTP in alert if provided (for testing)
      if (data.devOtp) {
        // Only show in browser for development testing
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          alert(`DEV MODE - Your OTP is: ${data.devOtp}`);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Step 2: Verify registration OTP and create account
  const verifyRegisterOTP = async (
    email: string,
    otp: string
  ) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to verify OTP' };
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      // Store user data directly from response
      if (data.user) {
        const userData: Customer = {
          id: data.user.id,
          auth_user_id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          address: data.user.address || '',
          is_verified: true,
          is_2fa_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(userData);
        localStorage.setItem('user_data', JSON.stringify(userData));
        // Dispatch event for other components
        dispatchAuthChange(userData);
      } else {
        await fetchUser();
      }

      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${getApiUrl()}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      // Ignore logout API errors
    }
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
    // Reset global auth cache
    globalAuthCache.user = null;
    globalAuthCache.authUser = null;
    globalAuthCache.isFetched = false;
    globalAuthCache.fetchPromise = null;
    // Clear request deduplication cache
    clearRequestCache();
    clearAuthToken();
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('zoiro-cart');
    localStorage.removeItem('zoiro_guest_favorites');
    // Clear user_type cookie for SSR
    document.cookie = 'user_type=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    sessionStorage.clear();
    // Dispatch event for other components
    dispatchAuthChange(null);
    // Reset ban state
    setIsBanned(false);
    setBanReason(null);
  };

  // Fast sign out - for banned users, synchronous and immediate
  const fastSignOut = () => {
    // Immediately clear all local state
    setUser(null);
    setAuthUser(null);
    setIsBanned(false);
    setBanReason(null);
    
    // Reset global auth cache
    globalAuthCache.user = null;
    globalAuthCache.authUser = null;
    globalAuthCache.isFetched = false;
    globalAuthCache.fetchPromise = null;
    
    // Clear request deduplication cache
    clearRequestCache();
    
    // Clear all storage (localStorage AND cookies)
    clearAuthToken();
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('sb_access_token');
    localStorage.removeItem('zoiro-cart');
    localStorage.removeItem('zoiro_guest_favorites');
    // Clear user_type cookie for SSR
    document.cookie = 'user_type=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    sessionStorage.clear();
    
    // Dispatch event for other components
    dispatchAuthChange(null);
    
    // Sign out from Supabase in background
    supabase.auth.signOut().catch(() => {});
    
    // Redirect to home
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  return {
    user,
    authUser,
    isLoading,
    isBanned,
    banReason,
    sendLoginOTP,
    verifyLoginOTP,
    sendRegisterOTP,
    verifyRegisterOTP,
    signOut,
    fastSignOut,
    resetPassword,
  };
}
