import { useState, useEffect, useCallback } from 'react';
import { supabase, Customer } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
  const [user, setUser] = useState<Customer | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

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
    } catch (e) {
      console.error('Error loading user from storage:', e);
    }
    return false;
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      // First check localStorage for persisted user
      const hasStoredUser = loadUserFromStorage();
      
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setAuthUser(authUser);
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('auth_user_id', authUser.id)
          .single();

        if (customer) {
          setUser(customer);
          // Persist user data
          localStorage.setItem('user_data', JSON.stringify(customer));
        }
        
        // Store token in localStorage
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          localStorage.setItem('auth_token', session.access_token);
        }
      } else if (!hasStoredUser) {
        // Only clear if we also don't have stored user
        setUser(null);
        setAuthUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      // Don't clear user if we have stored data
      if (!loadUserFromStorage()) {
        setUser(null);
        setAuthUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadUserFromStorage]);

  useEffect(() => {
    // First load from storage immediately
    loadUserFromStorage();
    setIsLoading(false);
    
    // Then try to fetch fresh data
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUser();
      } else {
        // Check if we have a manual token before clearing
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setUser(null);
          setAuthUser(null);
          localStorage.removeItem('user_data');
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

    // Subscribe to changes on the customer's record
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
          
          // Check if customer was banned
          if (newData.is_banned === true) {
            setIsBanned(true);
            setBanReason(newData.ban_reason || 'Your account has been suspended.');
          }
        }
      )
      .subscribe();

    // Check ban status from existing user data (already fetched)
    // The user object from fetchUser() includes is_banned and ban_reason
    if ((user as any)?.is_banned === true) {
      setIsBanned(true);
      setBanReason((user as any)?.ban_reason || 'Your account has been suspended.');
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Step 1: Send login request - may return token directly or require OTP
  const sendLoginOTP = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to login', requiresOTP: false };
      }

      // Store userType if provided
      const userType = data.userType as 'customer' | 'employee' | 'admin' | undefined;
      if (userType) {
        localStorage.setItem('user_type', userType);
      }

      // Check if direct login (no OTP required)
      if (data.requiresOTP === false && data.token) {
        // Store token
        localStorage.setItem('auth_token', data.token);
        
        // Store Supabase access token for RLS-enabled API calls
        if (data.supabaseAccessToken) {
          localStorage.setItem('sb_access_token', data.supabaseAccessToken);
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
      const response = await fetch(`${API_URL}/api/auth/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Invalid OTP' };
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      // Store userType for redirect logic
      const userType = data.userType as 'customer' | 'employee' | 'admin';
      localStorage.setItem('user_type', userType);

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
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, password, address }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to send OTP' };
      }

      // DEV MODE: Show OTP in console if provided
      if (data.devOtp) {
        console.log('🔐 DEV OTP:', data.devOtp);
        alert(`DEV MODE - Your OTP is: ${data.devOtp}`);
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
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to verify OTP' };
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
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
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' });
    } catch (e) {
      // Ignore logout API errors
    }
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('zoiro-cart');
    localStorage.removeItem('zoiro_guest_favorites');
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
    
    // Clear all storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_type');
    localStorage.removeItem('sb_access_token');
    localStorage.removeItem('zoiro-cart');
    localStorage.removeItem('zoiro_guest_favorites');
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
