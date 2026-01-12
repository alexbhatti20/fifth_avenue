import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Use NEXT_PUBLIC_ prefix for Next.js environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase credentials - database features will be disabled');
}

// Public client (subject to RLS) - always create to avoid null checks
export const supabase: SupabaseClient = createSupabaseClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// Admin client (bypasses RLS) - for server-side operations only
export const supabaseAdmin: SupabaseClient = supabaseServiceKey 
  ? createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase; // Fallback to regular client if no service key

// Re-export createClient for components that need to create their own client
export const createClient = () => supabase;

// Helper to check if supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Helper to safely query supabase
export const safeSupabase = supabase;

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
