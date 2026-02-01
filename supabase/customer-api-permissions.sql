-- =====================================================
-- CUSTOMER API PERMISSIONS
-- All customer RPC functions require authenticated role
-- 
-- Server-side API routes must use createAuthenticatedClient()
-- from lib/supabase.ts to get an authenticated Supabase client
-- that runs queries as 'authenticated' role.
-- =====================================================

-- NOTE: All these functions should ONLY have authenticated permission
-- The API routes must authenticate the Supabase client with the user's token

-- Favorites functions (authenticated only)
GRANT EXECUTE ON FUNCTION toggle_favorite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_favorites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_favorite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_favorite_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_all_favorites(uuid) TO authenticated;

-- Review functions (authenticated only)
GRANT EXECUTE ON FUNCTION submit_customer_review TO authenticated;
GRANT EXECUTE ON FUNCTION check_customer_review_limit TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION delete_customer_review TO authenticated;

-- Loyalty functions (authenticated only)
GRANT EXECUTE ON FUNCTION get_loyalty_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_promo_codes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_loyalty_summary(uuid) TO authenticated;

-- Customer profile functions (authenticated only)
GRANT EXECUTE ON FUNCTION update_customer_profile(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_2fa(uuid, boolean, text) TO authenticated;

-- Promo validation functions (authenticated only)
GRANT EXECUTE ON FUNCTION validate_promo_code(text, uuid, decimal) TO authenticated;
GRANT EXECUTE ON FUNCTION use_customer_promo_code(text, uuid, uuid) TO authenticated;

-- Payment methods (public - no sensitive data)
GRANT EXECUTE ON FUNCTION get_active_payment_methods() TO anon, authenticated;

-- =====================================================
-- IMPORTANT: API routes must use createAuthenticatedClient(token)
-- to get a Supabase client authenticated as the user
-- =====================================================
