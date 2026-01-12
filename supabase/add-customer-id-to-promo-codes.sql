-- Add customer_id and loyalty_points_required columns to promo_codes table
-- This allows using ONE table for both general and loyalty reward promo codes
-- Run this in Supabase SQL Editor

-- Add customer_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promo_codes' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE promo_codes ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_promo_codes_customer_id ON promo_codes(customer_id);
        RAISE NOTICE 'Added customer_id column to promo_codes table';
    ELSE
        RAISE NOTICE 'customer_id column already exists in promo_codes table';
    END IF;
    
    -- Add loyalty_points_required column to track which threshold awarded this promo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promo_codes' AND column_name = 'loyalty_points_required'
    ) THEN
        ALTER TABLE promo_codes ADD COLUMN loyalty_points_required INT DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_promo_codes_loyalty_threshold ON promo_codes(customer_id, loyalty_points_required);
        RAISE NOTICE 'Added loyalty_points_required column to promo_codes table';
    ELSE
        RAISE NOTICE 'loyalty_points_required column already exists in promo_codes table';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'promo_codes' AND column_name IN ('customer_id', 'loyalty_points_required');
