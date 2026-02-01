import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Use VITE_ prefix (primary) or NEXT_PUBLIC_ prefix (fallback)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Flag for missing credentials - don't log in production
const isSupabaseMisconfigured = !supabaseUrl || !supabaseKey;

// Helper to get auth token from cookies (client-side)
function getAuthTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(^| )sb-access-token=([^;]+)/);
    if (match) return decodeURIComponent(match[2]);
    // Fallback to auth_token cookie
    const match2 = document.cookie.match(/(^| )auth_token=([^;]+)/);
    return match2 ? decodeURIComponent(match2[2]) : null;
  } catch {
    return null;
  }
}

// Helper to get auth token from localStorage (fallback)
function getAuthTokenFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

// Create Supabase client with custom storage to read tokens from cookies
export const supabase: SupabaseClient = createSupabaseClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Custom storage to use cookies
      storage: {
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null;
          // For access token, try cookie first
          if (key.includes('access_token') || key.includes('auth-token')) {
            const cookieToken = getAuthTokenFromCookie();
            if (cookieToken) return cookieToken;
          }
          // Fallback to localStorage
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.setItem(key, value);
            // Also store access token for easy access
            if (key.includes('auth-token') && value) {
              const parsed = JSON.parse(value);
              if (parsed?.access_token) {
                localStorage.setItem('sb_access_token', parsed.access_token);
              }
            }
          } catch {}
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.removeItem(key);
            if (key.includes('auth-token')) {
              localStorage.removeItem('sb_access_token');
            }
          } catch {}
        },
      },
    },
  }
);

// Admin client - same as regular client (no service key needed)
export const supabaseAdmin: SupabaseClient = supabase;

// Create admin client - returns regular client since we use RPC with SECURITY DEFINER
// This provides admin capabilities through database functions, not service role
export const createAdminClient = () => supabase;

// Re-export createClient for components that need to create their own client
export const createClient = () => supabase;

// Create an authenticated server-side client using a verified token
// This allows server-side API routes to call RPCs as 'authenticated' role
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Helper to check if supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Helper to safely query supabase
export const safeSupabase = supabase;

// Helper to set session from tokens (call this after login)
export async function setSupabaseSession(accessToken: string, refreshToken?: string): Promise<boolean> {
  if (!accessToken || accessToken.length < 10) {
    // Token is missing or too short - this is expected in some cases (e.g., 2FA without persistent session)
    return false;
  }
  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    if (error) {
      // Only log unexpected errors (not "Auth session missing" which happens when token format is wrong)
      if (!error.message?.includes('session missing')) {
        console.error('Failed to set Supabase session:', error.message);
      }
      return false;
    }
    // Store in localStorage for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sb_access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('sb_refresh_token', refreshToken);
      }
    }
    return true;
  } catch (err) {
    console.error('Error setting session:', err);
    return false;
  }
}

// Helper to restore session from stored tokens (call on app init)
export async function restoreSupabaseSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // First check if there's already a session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    
    // Try to restore from cookies/localStorage
    const accessToken = getAuthTokenFromCookie() || getAuthTokenFromStorage();
    const refreshToken = localStorage.getItem('sb_refresh_token');
    
    if (accessToken) {
      return await setSupabaseSession(accessToken, refreshToken || undefined);
    }
    
    return false;
  } catch {
    return false;
  }
}

// Customer type definition
export interface Customer {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_2fa_enabled: boolean;
  two_fa_secret?: string;
  created_at: string;
  updated_at: string;
}
