-- =============================================
-- CUSTOMER DEALS RPC FUNCTIONS
-- Run this in Supabase SQL Editor
-- =============================================

-- First, create the deal_items table if it doesn't exist
-- This table links deals to menu items
CREATE TABLE IF NOT EXISTS deal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(deal_id, menu_item_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deal_items_deal_id ON deal_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_items_menu_item_id ON deal_items(menu_item_id);

-- Enable RLS
ALTER TABLE deal_items ENABLE ROW LEVEL SECURITY;

-- Allow public to read deal_items (for customer-facing pages)
DROP POLICY IF EXISTS "Anyone can view deal items" ON deal_items;
CREATE POLICY "Anyone can view deal items" ON deal_items FOR SELECT USING (true);

-- Allow admins to manage deal_items
DROP POLICY IF EXISTS "Admins can manage deal items" ON deal_items;
CREATE POLICY "Admins can manage deal items" ON deal_items FOR ALL 
    USING (EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid()));

-- Grant permissions
GRANT SELECT ON deal_items TO anon;
GRANT SELECT ON deal_items TO authenticated;
GRANT ALL ON deal_items TO authenticated;

-- =============================================
-- Get active deals with enriched item details for customer-facing pages
-- This is optimized to reduce API calls by returning all deal info in one query
-- =============================================
CREATE OR REPLACE FUNCTION get_active_deals_with_items()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    deal_type TEXT,
    original_price DECIMAL,
    discounted_price DECIMAL,
    discount_percentage DECIMAL,
    image_url TEXT,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    code TEXT,
    is_active BOOLEAN,
    items JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH deal_items_enriched AS (
        SELECT 
            di.deal_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', mi.id,
                        'quantity', di.quantity,
                        'name', mi.name,
                        'price', mi.price,
                        'image', mi.images->0
                    )
                ),
                '[]'::jsonb
            ) AS enriched_items,
            COALESCE(SUM(mi.price * di.quantity), 0) AS total_original_price
        FROM deal_items di
        JOIN menu_items mi ON mi.id = di.menu_item_id
        GROUP BY di.deal_id
    ),
    deals_with_items AS (
        SELECT 
            d.id,
            d.name,
            d.slug,
            d.description,
            'combo'::TEXT AS deal_type,
            COALESCE(die.total_original_price, 0) AS original_price,
            CASE 
                WHEN d.discount_percentage > 0 THEN 
                    ROUND(COALESCE(die.total_original_price, 0) * (1 - d.discount_percentage / 100), 2)
                ELSE COALESCE(die.total_original_price, 0)
            END AS discounted_price,
            d.discount_percentage,
            d.images->0 AS image_url,
            d.valid_from,
            d.valid_until,
            NULL::TEXT AS code,
            d.is_active,
            COALESCE(die.enriched_items, '[]'::jsonb) AS items
        FROM deals d
        LEFT JOIN deal_items_enriched die ON die.deal_id = d.id
        WHERE d.is_active = TRUE
            AND (d.valid_from IS NULL OR d.valid_from <= NOW())
            AND (d.valid_until IS NULL OR d.valid_until >= NOW())
            AND (d.usage_limit IS NULL OR d.usage_count < d.usage_limit)
    )
    SELECT * FROM deals_with_items
    ORDER BY name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for customer-facing pages)
GRANT EXECUTE ON FUNCTION get_active_deals_with_items() TO anon;
GRANT EXECUTE ON FUNCTION get_active_deals_with_items() TO authenticated;

-- =============================================
-- CREATE DEAL WITH ITEMS
-- Creates a deal and inserts items into deal_items table
-- =============================================
DROP FUNCTION IF EXISTS create_deal_with_items(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, DATE, DATE, INTEGER, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS create_deal_with_items(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMP, TIMESTAMP, INTEGER, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS create_deal_with_items(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION create_deal_with_items(
    p_name TEXT,
    p_description TEXT,
    p_code TEXT,
    p_deal_type TEXT,
    p_original_price NUMERIC,
    p_discounted_price NUMERIC,
    p_image_url TEXT,
    p_valid_from TIMESTAMPTZ,
    p_valid_until TIMESTAMPTZ,
    p_usage_limit INTEGER,
    p_is_active BOOLEAN,
    p_items JSONB  -- Array of {id, quantity}
)
RETURNS TABLE(id UUID, code TEXT, slug TEXT) AS $$
DECLARE
    v_deal_id UUID;
    v_code TEXT;
    v_slug TEXT;
    v_discount_percentage DECIMAL;
    v_item JSONB;
    v_image_url TEXT;
BEGIN
    -- Generate code if not provided (or empty)
    v_code := COALESCE(NULLIF(TRIM(p_code), ''), 'DEAL' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)));
    
    -- Generate slug from name
    v_slug := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := REGEXP_REPLACE(v_slug, '^-|-$', '', 'g');
    v_slug := v_slug || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
    
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Process image URL - keep as-is if already full URL, otherwise it's already processed by frontend
    v_image_url := p_image_url;
    
    -- Insert the deal
    INSERT INTO deals (
        name, slug, description, code,
        original_price, discounted_price, discount_percentage,
        images, valid_from, valid_until, usage_limit, is_active
    ) VALUES (
        p_name, v_slug, p_description, v_code,
        p_original_price, p_discounted_price, v_discount_percentage,
        CASE WHEN v_image_url IS NOT NULL AND v_image_url != '' THEN jsonb_build_array(v_image_url) ELSE '[]'::jsonb END,
        p_valid_from, p_valid_until, p_usage_limit, p_is_active
    ) RETURNING deals.id INTO v_deal_id;
    
    -- Insert items into deal_items relational table
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                v_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            )
            ON CONFLICT (deal_id, menu_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT v_deal_id, v_code, v_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_deal_with_items(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB) TO authenticated;

-- =============================================
-- UPDATE DEAL WITH ITEMS
-- Updates a deal and replaces items in deal_items table
-- =============================================
DROP FUNCTION IF EXISTS update_deal_with_items(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION update_deal_with_items(
    p_deal_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_code TEXT,
    p_original_price NUMERIC,
    p_discounted_price NUMERIC,
    p_image_url TEXT,
    p_valid_from TIMESTAMPTZ,
    p_valid_until TIMESTAMPTZ,
    p_usage_limit INTEGER,
    p_is_active BOOLEAN,
    p_items JSONB
)
RETURNS JSON AS $$
DECLARE
    v_discount_percentage DECIMAL;
    v_item JSONB;
    v_image_url TEXT;
BEGIN
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Process image URL - keep as-is (already full URL from frontend)
    v_image_url := p_image_url;
    
    -- Update the deal
    UPDATE deals SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        code = COALESCE(NULLIF(TRIM(p_code), ''), code),
        original_price = COALESCE(p_original_price, original_price),
        discounted_price = COALESCE(p_discounted_price, discounted_price),
        discount_percentage = v_discount_percentage,
        images = CASE WHEN v_image_url IS NOT NULL AND v_image_url != '' THEN jsonb_build_array(v_image_url) ELSE images END,
        valid_from = COALESCE(p_valid_from, valid_from),
        valid_until = COALESCE(p_valid_until, valid_until),
        usage_limit = COALESCE(p_usage_limit, usage_limit),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_deal_id;
    
    -- Replace deal_items (delete old, insert new)
    IF p_items IS NOT NULL THEN
        DELETE FROM deal_items WHERE deal_id = p_deal_id;
        
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                p_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            );
        END LOOP;
    END IF;
    
    RETURN json_build_object('success', true, 'id', p_deal_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_deal_with_items(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB) TO authenticated;

-- =============================================
-- DELETE DEAL
-- Deletes a deal (deal_items cascade automatically)
-- =============================================
DROP FUNCTION IF EXISTS delete_deal_with_items(UUID);

CREATE OR REPLACE FUNCTION delete_deal_with_items(p_deal_id UUID)
RETURNS JSON AS $$
BEGIN
    DELETE FROM deals WHERE id = p_deal_id;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_deal_with_items(UUID) TO authenticated;

