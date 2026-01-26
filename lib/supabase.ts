import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Use VITE_ prefix (primary) or NEXT_PUBLIC_ prefix (fallback)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Flag for missing credentials - don't log in production
const isSupabaseMisconfigured = !supabaseUrl || !supabaseKey;

// Public client (subject to RLS) - always create to avoid null checks
export const supabase: SupabaseClient = createSupabaseClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// Admin client - same as regular client (no service key needed)
export const supabaseAdmin: SupabaseClient = supabase;

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
