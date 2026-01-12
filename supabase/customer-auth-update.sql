-- =============================================
-- CUSTOMER AUTH USER ID UPDATE FUNCTION
-- Used during login to sync auth_user_id with Supabase Auth
-- =============================================

DROP FUNCTION IF EXISTS update_customer_auth_user_id(TEXT, UUID);

-- Update customer's auth_user_id - bypasses RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_customer_auth_user_id(
    p_email TEXT,
    p_auth_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE customers
    SET 
        auth_user_id = p_auth_user_id,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(p_email);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION update_customer_auth_user_id(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_auth_user_id(TEXT, UUID) TO anon;
