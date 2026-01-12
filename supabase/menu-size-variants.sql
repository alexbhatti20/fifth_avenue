-- =====================================================
-- MENU SIZE VARIANTS SYSTEM
-- Adds Small, Medium, Large, Extra Large size options
-- Only adds columns and updates EXISTING RPCs
-- =====================================================

-- Add size_variants column to menu_items table
-- Format: [{ "size": "Small", "price": 200, "is_available": true }, ...]
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS size_variants jsonb DEFAULT NULL;

-- Add has_variants column for quick filtering
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false;

-- Create index for faster queries on items with variants
CREATE INDEX IF NOT EXISTS idx_menu_items_has_variants 
ON public.menu_items (has_variants) WHERE has_variants = true;

-- =====================================================
-- UPDATE EXISTING: create_menu_item_advanced
-- Add size variants support to existing RPC
-- =====================================================
-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS create_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, TEXT[], BOOLEAN, BOOLEAN, INT);
DROP FUNCTION IF EXISTS create_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, TEXT[], BOOLEAN, BOOLEAN, INT, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION create_menu_item_advanced(
    p_category_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT 0,
    p_images TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_is_available BOOLEAN DEFAULT true,
    p_is_featured BOOLEAN DEFAULT false,
    p_preparation_time INT DEFAULT NULL,
    p_has_variants BOOLEAN DEFAULT false,
    p_size_variants JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    -- Validate required fields
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Item name is required');
    END IF;
    
    IF p_price IS NULL OR p_price < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid price is required');
    END IF;
    
    -- Generate slug from name
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    
    INSERT INTO menu_items (
        category_id, name, slug, description, price,
        images, is_available, is_featured, preparation_time,
        has_variants, size_variants
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price,
        to_jsonb(p_images), p_is_available, p_is_featured, p_preparation_time,
        COALESCE(p_has_variants, false),
        CASE WHEN p_has_variants THEN p_size_variants ELSE NULL END
    )
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item created successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'slug', v_result.slug,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'has_variants', v_result.has_variants,
            'size_variants', v_result.size_variants,
            'created_at', v_result.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE EXISTING: update_menu_item_advanced  
-- Add size variants support to existing RPC
-- =====================================================
-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS update_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, UUID, TEXT[], BOOLEAN, BOOLEAN, INT);
DROP FUNCTION IF EXISTS update_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, UUID, TEXT[], BOOLEAN, BOOLEAN, INT, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION update_menu_item_advanced(
    p_item_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_images TEXT[] DEFAULT NULL,
    p_is_available BOOLEAN DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT NULL,
    p_preparation_time INT DEFAULT NULL,
    p_has_variants BOOLEAN DEFAULT NULL,
    p_size_variants JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
    v_slug TEXT;
BEGIN
    IF p_item_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item ID is required');
    END IF;
    
    -- Check item exists
    IF NOT EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Menu item not found');
    END IF;
    
    -- Generate new slug if name changed
    IF p_name IS NOT NULL AND trim(p_name) != '' THEN
        v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        IF EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug AND id != p_item_id) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;
    
    UPDATE menu_items
    SET 
        name = COALESCE(trim(p_name), name),
        slug = COALESCE(v_slug, slug),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        category_id = COALESCE(p_category_id, category_id),
        images = CASE WHEN p_images IS NOT NULL THEN to_jsonb(p_images) ELSE images END,
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        preparation_time = CASE WHEN p_preparation_time IS NOT NULL THEN p_preparation_time ELSE preparation_time END,
        has_variants = COALESCE(p_has_variants, has_variants),
        size_variants = CASE 
            WHEN p_has_variants = true THEN COALESCE(p_size_variants, size_variants)
            WHEN p_has_variants = false THEN NULL
            ELSE size_variants
        END,
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Menu item updated successfully',
        'item', json_build_object(
            'id', v_result.id,
            'name', v_result.name,
            'price', v_result.price,
            'is_available', v_result.is_available,
            'has_variants', v_result.has_variants,
            'size_variants', v_result.size_variants,
            'updated_at', v_result.updated_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE EXISTING: get_menu_management_data
-- Include size variants in response
-- =====================================================
CREATE OR REPLACE FUNCTION get_menu_management_data()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'items', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', mi.id,
                    'name', mi.name,
                    'description', mi.description,
                    'price', mi.price,
                    'category_id', mi.category_id,
                    'category', mc.name,
                    'images', mi.images,
                    'is_available', mi.is_available,
                    'is_featured', mi.is_featured,
                    'preparation_time', mi.preparation_time,
                    'tags', mi.tags,
                    'rating', mi.rating,
                    'total_reviews', mi.total_reviews,
                    'slug', mi.slug,
                    'created_at', mi.created_at,
                    'has_variants', COALESCE(mi.has_variants, false),
                    'size_variants', mi.size_variants
                )
                ORDER BY mi.created_at DESC
            )
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        ), '[]'::json),
        'categories', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'description', c.description,
                    'image_url', c.image_url,
                    'display_order', c.display_order,
                    'is_visible', c.is_visible,
                    'item_count', (SELECT COUNT(*) FROM menu_items WHERE category_id = c.id)
                )
                ORDER BY c.display_order
            )
            FROM menu_categories c
        ), '[]'::json),
        'stats', json_build_object(
            'total_items', (SELECT COUNT(*) FROM menu_items),
            'available_items', (SELECT COUNT(*) FROM menu_items WHERE is_available = true),
            'featured_items', (SELECT COUNT(*) FROM menu_items WHERE is_featured = true),
            'total_categories', (SELECT COUNT(*) FROM menu_categories),
            'visible_categories', (SELECT COUNT(*) FROM menu_categories WHERE is_visible = true),
            'items_with_variants', (SELECT COUNT(*) FROM menu_items WHERE has_variants = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- UPDATE EXISTING: get_order_creation_data
-- Include size variants for portal orders
-- =====================================================
CREATE OR REPLACE FUNCTION get_order_creation_data()
RETURNS JSON AS $$
DECLARE
    v_categories JSON;
    v_items JSON;
    v_tables JSON;
    v_deals JSON;
BEGIN
    -- Get active categories from menu_categories
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'description', c.description,
            'display_order', c.display_order,
            'is_visible', c.is_visible
        ) ORDER BY c.display_order, c.name
    ), '[]'::json)
    INTO v_categories
    FROM menu_categories c
    WHERE c.is_visible = true;

    -- Get available menu items with category info AND size variants
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', m.id,
            'name', m.name,
            'slug', m.slug,
            'description', m.description,
            'price', m.price,
            'category_id', m.category_id,
            'category_name', c.name,
            'images', m.images,
            'is_available', m.is_available,
            'is_featured', m.is_featured,
            'preparation_time', m.preparation_time,
            'has_variants', COALESCE(m.has_variants, false),
            'size_variants', m.size_variants
        ) ORDER BY c.display_order, c.name, m.name
    ), '[]'::json)
    INTO v_items
    FROM menu_items m
    LEFT JOIN menu_categories c ON m.category_id = c.id
    WHERE m.is_available = true;

    -- Get tables with current status from restaurant_tables
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', t.id,
            'table_number', t.table_number,
            'capacity', t.capacity,
            'status', t.status,
            'current_order_id', t.current_order_id,
            'section', t.section
        ) ORDER BY t.table_number
    ), '[]'::json)
    INTO v_tables
    FROM restaurant_tables t
    WHERE t.status IN ('available', 'occupied', 'reserved');

    -- Get active deals
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', d.id,
            'name', d.name,
            'description', d.description,
            'discount_percentage', d.discount_percentage,
            'discount_amount', d.discount_amount,
            'minimum_order_amount', d.minimum_order_amount,
            'valid_from', d.valid_from,
            'valid_until', d.valid_until,
            'is_active', d.is_active,
            'discounted_price', d.discounted_price,
            'original_price', d.original_price
        )
    ), '[]'::json)
    INTO v_deals
    FROM deals d
    WHERE d.is_active = true 
    AND (d.valid_from IS NULL OR d.valid_from <= NOW())
    AND (d.valid_until IS NULL OR d.valid_until >= NOW());

    RETURN json_build_object(
        'success', true,
        'categories', v_categories,
        'items', v_items,
        'tables', v_tables,
        'deals', v_deals,
        'fetched_at', NOW()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (with full signatures)
GRANT EXECUTE ON FUNCTION create_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, TEXT[], BOOLEAN, BOOLEAN, INT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, UUID, TEXT[], BOOLEAN, BOOLEAN, INT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_management_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_creation_data() TO authenticated;
