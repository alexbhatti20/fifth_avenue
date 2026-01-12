-- =====================================================
-- ZOIRO FAVORITES SYSTEM
-- Store favorites as JSONB array in customers table
-- This is faster than a separate table for small lists
-- =====================================================

-- Add favorites column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS favorites jsonb DEFAULT '[]'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customers_favorites 
ON public.customers USING GIN (favorites);

-- =====================================================
-- RPC: Toggle Favorite (Add/Remove in one call)
-- Returns: { action: 'added' | 'removed', favorites: string[] }
-- =====================================================
CREATE OR REPLACE FUNCTION toggle_favorite(
  p_customer_id uuid,
  p_item_id text,
  p_item_type text DEFAULT 'menu_item'  -- 'menu_item' or 'deal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_favorites jsonb;
  v_item jsonb;
  v_exists boolean;
  v_result jsonb;
BEGIN
  -- Build the item object
  v_item := jsonb_build_object(
    'id', p_item_id,
    'type', p_item_type,
    'added_at', NOW()
  );

  -- Get current favorites
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Check if item already exists
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_favorites) AS elem
    WHERE elem->>'id' = p_item_id AND elem->>'type' = p_item_type
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove from favorites
    v_favorites := (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(v_favorites) AS elem
      WHERE NOT (elem->>'id' = p_item_id AND elem->>'type' = p_item_type)
    );
    
    UPDATE customers SET favorites = v_favorites, updated_at = NOW()
    WHERE id = p_customer_id;
    
    v_result := jsonb_build_object(
      'action', 'removed',
      'item_id', p_item_id,
      'item_type', p_item_type,
      'favorites', v_favorites
    );
  ELSE
    -- Add to favorites (prepend to array for recent first)
    v_favorites := v_item || v_favorites;
    
    UPDATE customers SET favorites = v_favorites, updated_at = NOW()
    WHERE id = p_customer_id;
    
    v_result := jsonb_build_object(
      'action', 'added',
      'item_id', p_item_id,
      'item_type', p_item_type,
      'favorites', v_favorites
    );
  END IF;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: Get Customer Favorites with Item Details
-- Returns full item details for all favorites
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_favorites(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_favorites jsonb;
  v_result jsonb := '[]'::jsonb;
  v_item record;
  v_menu_item record;
  v_deal record;
BEGIN
  -- Get favorites array
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Loop through favorites and fetch details
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_favorites)
  LOOP
    IF v_item.value->>'type' = 'menu_item' THEN
      SELECT 
        id, name, description, price, images, 
        is_available, is_featured, rating, category_id,
        (SELECT name FROM menu_categories WHERE id = menu_items.category_id) as category_name
      INTO v_menu_item
      FROM menu_items
      WHERE id = (v_item.value->>'id')::uuid;

      IF FOUND THEN
        v_result := v_result || jsonb_build_object(
          'id', v_menu_item.id,
          'type', 'menu_item',
          'name', v_menu_item.name,
          'description', v_menu_item.description,
          'price', v_menu_item.price,
          'image_url', COALESCE(v_menu_item.images->>0, ''),
          'is_available', v_menu_item.is_available,
          'is_featured', COALESCE(v_menu_item.is_featured, false),
          'rating', v_menu_item.rating,
          'category', v_menu_item.category_name,
          'added_at', v_item.value->>'added_at'
        );
      END IF;

    ELSIF v_item.value->>'type' = 'deal' THEN
      SELECT 
        id, name, description, original_price, discounted_price, 
        image_url, images, is_active, rating
      INTO v_deal
      FROM deals
      WHERE id = (v_item.value->>'id')::uuid;

      IF FOUND THEN
        v_result := v_result || jsonb_build_object(
          'id', v_deal.id,
          'type', 'deal',
          'name', v_deal.name,
          'description', v_deal.description,
          'price', v_deal.discounted_price,
          'original_price', v_deal.original_price,
          'image_url', COALESCE(v_deal.image_url, v_deal.images->>0, ''),
          'is_available', v_deal.is_active,
          'rating', v_deal.rating,
          'category', 'Deals',
          'added_at', v_item.value->>'added_at'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: Check if item is favorited (fast lookup)
-- =====================================================
CREATE OR REPLACE FUNCTION is_favorite(
  p_customer_id uuid,
  p_item_id text,
  p_item_type text DEFAULT 'menu_item'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customers c,
    jsonb_array_elements(COALESCE(c.favorites, '[]'::jsonb)) AS elem
    WHERE c.id = p_customer_id
    AND elem->>'id' = p_item_id
    AND elem->>'type' = p_item_type
  );
END;
$$;

-- =====================================================
-- RPC: Get favorite IDs only (for initial page load)
-- Much faster than fetching full details
-- =====================================================
CREATE OR REPLACE FUNCTION get_favorite_ids(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_favorites jsonb;
BEGIN
  SELECT COALESCE(favorites, '[]'::jsonb) INTO v_favorites
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return array of {id, type} objects
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', elem->>'id', 'type', elem->>'type')), '[]'::jsonb)
    FROM jsonb_array_elements(v_favorites) AS elem
  );
END;
$$;

-- =====================================================
-- RPC: Clear all favorites
-- =====================================================
CREATE OR REPLACE FUNCTION clear_all_favorites(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers 
  SET favorites = '[]'::jsonb, updated_at = NOW()
  WHERE id = p_customer_id;
  
  RETURN FOUND;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION toggle_favorite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_favorites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_favorite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_favorite_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_all_favorites(uuid) TO authenticated;
