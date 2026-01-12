-- =============================================
-- ADVANCED: Menu Categories Management RPCs
-- Comprehensive CRUD with validation and stats
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS manage_menu_category(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS get_menu_categories_advanced();
DROP FUNCTION IF EXISTS reorder_menu_categories(UUID[]);
DROP FUNCTION IF EXISTS get_menu_management_data();
DROP FUNCTION IF EXISTS create_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, TEXT[], BOOLEAN, BOOLEAN, INT);
DROP FUNCTION IF EXISTS update_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, UUID, TEXT[], BOOLEAN, BOOLEAN, INT);

-- =============================================
-- GET ALL CATEGORIES WITH STATS
-- =============================================
CREATE OR REPLACE FUNCTION get_menu_categories_advanced()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
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
                    'created_at', c.created_at,
                    'updated_at', c.updated_at,
                    'item_count', COALESCE(stats.item_count, 0),
                    'available_items', COALESCE(stats.available_items, 0),
                    'featured_items', COALESCE(stats.featured_items, 0),
                    'avg_price', COALESCE(stats.avg_price, 0),
                    'min_price', COALESCE(stats.min_price, 0),
                    'max_price', COALESCE(stats.max_price, 0)
                )
                ORDER BY c.display_order, c.name
            )
            FROM menu_categories c
            LEFT JOIN (
                SELECT 
                    category_id,
                    COUNT(*) as item_count,
                    COUNT(*) FILTER (WHERE is_available = true) as available_items,
                    COUNT(*) FILTER (WHERE is_featured = true) as featured_items,
                    ROUND(AVG(price)::NUMERIC, 2) as avg_price,
                    MIN(price) as min_price,
                    MAX(price) as max_price
                FROM menu_items
                GROUP BY category_id
            ) stats ON c.id = stats.category_id
        ), '[]'::json),
        'summary', json_build_object(
            'total_categories', (SELECT COUNT(*) FROM menu_categories),
            'visible_categories', (SELECT COUNT(*) FROM menu_categories WHERE is_visible = true),
            'hidden_categories', (SELECT COUNT(*) FROM menu_categories WHERE is_visible = false),
            'total_items', (SELECT COUNT(*) FROM menu_items),
            'uncategorized_items', (SELECT COUNT(*) FROM menu_items WHERE category_id IS NULL)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- UNIFIED CATEGORY MANAGEMENT (CREATE/UPDATE/DELETE)
-- =============================================
CREATE OR REPLACE FUNCTION manage_menu_category(
    p_action TEXT,                    -- 'create', 'update', 'delete', 'toggle'
    p_category_id UUID DEFAULT NULL,  -- Required for update/delete/toggle
    p_name TEXT DEFAULT NULL,
    p_slug TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_display_order INT DEFAULT NULL,
    p_is_visible BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_category RECORD;
    v_slug TEXT;
    v_order INT;
    v_item_count INT;
BEGIN
    -- Validate action
    IF p_action NOT IN ('create', 'update', 'delete', 'toggle') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid action. Use: create, update, delete, or toggle'
        );
    END IF;
    
    -- CREATE ACTION
    IF p_action = 'create' THEN
        -- Validate required fields
        IF p_name IS NULL OR trim(p_name) = '' THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category name is required'
            );
        END IF;
        
        -- Check for duplicate name
        IF EXISTS (SELECT 1 FROM menu_categories WHERE lower(name) = lower(trim(p_name))) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'A category with this name already exists'
            );
        END IF;
        
        -- Generate slug if not provided
        v_slug := COALESCE(p_slug, lower(regexp_replace(trim(p_name), '\s+', '-', 'g')));
        v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
        
        -- Ensure unique slug
        IF EXISTS (SELECT 1 FROM menu_categories WHERE slug = v_slug) THEN
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        END IF;
        
        -- Get next display order
        SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_order FROM menu_categories;
        
        -- Insert category
        INSERT INTO menu_categories (name, slug, description, image_url, display_order, is_visible)
        VALUES (
            trim(p_name), 
            v_slug, 
            p_description, 
            p_image_url, 
            COALESCE(p_display_order, v_order),
            COALESCE(p_is_visible, true)
        )
        RETURNING * INTO v_category;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Category created successfully',
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'slug', v_category.slug,
                'description', v_category.description,
                'image_url', v_category.image_url,
                'display_order', v_category.display_order,
                'is_visible', v_category.is_visible,
                'created_at', v_category.created_at
            )
        );
    END IF;
    
    -- UPDATE ACTION
    IF p_action = 'update' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for update'
            );
        END IF;
        
        -- Check category exists
        IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE id = p_category_id) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        -- Check for duplicate name (excluding current category)
        IF p_name IS NOT NULL AND EXISTS (
            SELECT 1 FROM menu_categories 
            WHERE lower(name) = lower(trim(p_name)) 
            AND id != p_category_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Another category with this name already exists'
            );
        END IF;
        
        -- Generate new slug if name changed
        IF p_name IS NOT NULL THEN
            v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
            v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
            IF EXISTS (SELECT 1 FROM menu_categories WHERE slug = v_slug AND id != p_category_id) THEN
                v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
            END IF;
        END IF;
        
        -- Update category
        UPDATE menu_categories
        SET 
            name = COALESCE(trim(p_name), name),
            slug = COALESCE(v_slug, slug),
            description = COALESCE(p_description, description),
            image_url = COALESCE(p_image_url, image_url),
            display_order = COALESCE(p_display_order, display_order),
            is_visible = COALESCE(p_is_visible, is_visible),
            updated_at = NOW()
        WHERE id = p_category_id
        RETURNING * INTO v_category;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Category updated successfully',
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'slug', v_category.slug,
                'description', v_category.description,
                'image_url', v_category.image_url,
                'display_order', v_category.display_order,
                'is_visible', v_category.is_visible,
                'updated_at', v_category.updated_at
            )
        );
    END IF;
    
    -- TOGGLE ACTION
    IF p_action = 'toggle' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for toggle'
            );
        END IF;
        
        UPDATE menu_categories
        SET 
            is_visible = NOT is_visible,
            updated_at = NOW()
        WHERE id = p_category_id
        RETURNING * INTO v_category;
        
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        RETURN json_build_object(
            'success', true,
            'message', CASE WHEN v_category.is_visible THEN 'Category visible' ELSE 'Category hidden' END,
            'category', json_build_object(
                'id', v_category.id,
                'name', v_category.name,
                'is_visible', v_category.is_visible
            )
        );
    END IF;
    
    -- DELETE ACTION
    IF p_action = 'delete' THEN
        IF p_category_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category ID is required for delete'
            );
        END IF;
        
        -- Check for items in this category
        SELECT COUNT(*) INTO v_item_count FROM menu_items WHERE category_id = p_category_id;
        
        IF v_item_count > 0 THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Cannot delete category with %s items. Move or delete items first.', v_item_count),
                'item_count', v_item_count
            );
        END IF;
        
        -- Get category info before deletion
        SELECT * INTO v_category FROM menu_categories WHERE id = p_category_id;
        
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Category not found'
            );
        END IF;
        
        -- Delete category
        DELETE FROM menu_categories WHERE id = p_category_id;
        
        -- Reorder remaining categories
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 as new_order
            FROM menu_categories
        )
        UPDATE menu_categories mc
        SET display_order = ordered.new_order
        FROM ordered
        WHERE mc.id = ordered.id;
        
        RETURN json_build_object(
            'success', true,
            'message', format('Category "%s" deleted successfully', v_category.name),
            'deleted_category', json_build_object(
                'id', v_category.id,
                'name', v_category.name
            )
        );
    END IF;
    
    RETURN json_build_object('success', false, 'error', 'Unknown error');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REORDER CATEGORIES
-- =============================================
CREATE OR REPLACE FUNCTION reorder_menu_categories(p_category_ids UUID[])
RETURNS JSON AS $$
DECLARE
    v_id UUID;
    v_index INT := 0;
BEGIN
    -- Validate all IDs exist
    IF NOT (
        SELECT COUNT(*) = array_length(p_category_ids, 1)
        FROM menu_categories
        WHERE id = ANY(p_category_ids)
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'One or more category IDs are invalid'
        );
    END IF;
    
    -- Update order for each category
    FOREACH v_id IN ARRAY p_category_ids
    LOOP
        UPDATE menu_categories
        SET display_order = v_index, updated_at = NOW()
        WHERE id = v_id;
        v_index := v_index + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', format('%s categories reordered successfully', array_length(p_category_ids, 1))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET MENU DATA FOR ADMIN (Items + Categories)
-- =============================================
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
                    'created_at', mi.created_at
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
            'visible_categories', (SELECT COUNT(*) FROM menu_categories WHERE is_visible = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_menu_categories_advanced() TO authenticated;
GRANT EXECUTE ON FUNCTION manage_menu_category(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_menu_categories(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_management_data() TO authenticated;

-- Comments
COMMENT ON FUNCTION get_menu_categories_advanced IS 'Returns all categories with item statistics';
COMMENT ON FUNCTION manage_menu_category IS 'Unified CRUD for categories: create, update, delete, toggle';
COMMENT ON FUNCTION reorder_menu_categories IS 'Reorder categories by providing array of IDs in desired order';
COMMENT ON FUNCTION get_menu_management_data IS 'Get all menu data for admin dashboard';

-- =============================================
-- ENHANCED: Create Menu Item (with all fields)
-- =============================================
CREATE OR REPLACE FUNCTION create_menu_item_advanced(
    p_category_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT 0,
    p_images TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_is_available BOOLEAN DEFAULT true,
    p_is_featured BOOLEAN DEFAULT false,
    p_preparation_time INT DEFAULT NULL
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
        images, is_available, is_featured, preparation_time
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price,
        to_jsonb(p_images), p_is_available, p_is_featured, p_preparation_time
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
            'created_at', v_result.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ENHANCED: Update Menu Item (with all fields)
-- =============================================
CREATE OR REPLACE FUNCTION update_menu_item_advanced(
    p_item_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_images TEXT[] DEFAULT NULL,
    p_is_available BOOLEAN DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT NULL,
    p_preparation_time INT DEFAULT NULL
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
            'updated_at', v_result.updated_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, TEXT[], BOOLEAN, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_menu_item_advanced(UUID, TEXT, TEXT, DECIMAL, UUID, TEXT[], BOOLEAN, BOOLEAN, INT) TO authenticated;
