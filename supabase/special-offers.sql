-- =====================================================
-- SPECIAL OFFERS SYSTEM (Eid, Pakistan Day, etc.)
-- Complete system for event-based promotions
-- 100% Free - Uses existing Brevo + Push Notifications
-- =====================================================

-- Drop existing if re-running
DROP TABLE IF EXISTS special_offer_items CASCADE;
DROP TABLE IF EXISTS special_offers CASCADE;
DROP TYPE IF EXISTS offer_discount_type CASCADE;
DROP TYPE IF EXISTS offer_status CASCADE;

-- =====================================================
-- TYPES
-- =====================================================

CREATE TYPE offer_discount_type AS ENUM (
  'percentage',      -- e.g., 20% off
  'fixed_amount',    -- e.g., Rs 100 off
  'buy_x_get_y',     -- e.g., Buy 2 Get 1 Free
  'bundle_price'     -- Fixed price for bundle
);

CREATE TYPE offer_status AS ENUM (
  'draft',           -- Not published
  'scheduled',       -- Will go live at start_date
  'active',          -- Currently running
  'paused',          -- Temporarily paused
  'expired'          -- Past end_date
);

-- =====================================================
-- TABLE: special_offers (Main Offers)
-- =====================================================

CREATE TABLE special_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  event_type VARCHAR(100), -- 'eid', 'pakistan_day', 'independence_day', 'ramadan', 'new_year', 'custom'
  
  -- Visual Assets
  banner_image TEXT,                    -- Main banner
  popup_image TEXT,                     -- Popup image
  thumbnail_image TEXT,                 -- Card thumbnail
  background_color VARCHAR(20),         -- Gradient/solid color
  theme_colors JSONB DEFAULT '{}',      -- {"primary": "#...", "secondary": "#..."}
  pakistani_flags BOOLEAN DEFAULT false, -- Show 🇵🇰 decorations
  confetti_enabled BOOLEAN DEFAULT true,
  custom_css TEXT,                      -- Optional custom styling
  
  -- Discount Settings
  discount_type offer_discount_type NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0, -- 20 for 20%, 100 for Rs100
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),              -- Cap for percentage discounts
  
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  show_popup BOOLEAN DEFAULT true,
  popup_auto_close_seconds INT DEFAULT 5,
  
  -- Visibility
  status offer_status DEFAULT 'draft',
  is_visible BOOLEAN DEFAULT true,
  show_on_landing BOOLEAN DEFAULT true,
  show_in_menu BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,                         -- Higher = shown first
  
  -- Notification Settings
  notify_via_email BOOLEAN DEFAULT false,
  notify_via_push BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  notification_scheduled_at TIMESTAMP WITH TIME ZONE,
  auto_notify_on_start BOOLEAN DEFAULT false,
  
  -- Stats
  view_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: special_offer_items (Items in Offer)
-- =====================================================

CREATE TABLE special_offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES special_offers(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  
  -- Pricing Override
  original_price DECIMAL(10,2) NOT NULL,          -- Price before offer
  offer_price DECIMAL(10,2) NOT NULL,             -- Price during offer
  discount_percentage DECIMAL(5,2),               -- Calculated % off
  
  -- Item-specific settings
  max_quantity_per_order INT,                     -- Limit per order
  total_available_quantity INT,                   -- Total stock for offer
  quantity_sold INT DEFAULT 0,
  
  -- Size variant support
  size_variant VARCHAR(50),                       -- 'small', 'medium', 'large', etc.
  
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(offer_id, menu_item_id, size_variant)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_special_offers_status ON special_offers(status);
CREATE INDEX idx_special_offers_dates ON special_offers(start_date, end_date);
CREATE INDEX idx_special_offers_visible ON special_offers(is_visible, status) WHERE is_visible = true;
CREATE INDEX idx_special_offers_popup ON special_offers(show_popup, status) WHERE show_popup = true;
CREATE INDEX idx_special_offer_items_offer ON special_offer_items(offer_id);
CREATE INDEX idx_special_offer_items_menu ON special_offer_items(menu_item_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_offer_items ENABLE ROW LEVEL SECURITY;

-- Public can view active offers
CREATE POLICY "Anyone can view active offers"
  ON special_offers FOR SELECT
  USING (is_visible = true AND status IN ('active', 'scheduled'));

-- Authenticated employees can manage offers
CREATE POLICY "Employees can manage offers"
  ON special_offers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public can view offer items
CREATE POLICY "Anyone can view offer items"
  ON special_offer_items FOR SELECT
  USING (true);

-- Authenticated employees can manage offer items
CREATE POLICY "Employees can manage offer items"
  ON special_offer_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- HELPER: Generate slug from name
-- =====================================================

CREATE OR REPLACE FUNCTION generate_offer_slug(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug TEXT;
  v_counter INT := 0;
  v_base_slug TEXT;
BEGIN
  v_base_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9-]', '', 'g');
  v_slug := v_base_slug;
  
  WHILE EXISTS (SELECT 1 FROM special_offers WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;
  
  RETURN v_slug;
END;
$$;

-- =====================================================
-- RPC: CREATE SPECIAL OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION create_special_offer(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_event_type VARCHAR DEFAULT 'custom',
  p_discount_type offer_discount_type DEFAULT 'percentage',
  p_discount_value DECIMAL DEFAULT 0,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_banner_image TEXT DEFAULT NULL,
  p_popup_image TEXT DEFAULT NULL,
  p_theme_colors JSONB DEFAULT '{}',
  p_pakistani_flags BOOLEAN DEFAULT false,
  p_confetti_enabled BOOLEAN DEFAULT true,
  p_show_popup BOOLEAN DEFAULT true,
  p_popup_auto_close_seconds INT DEFAULT 5,
  p_min_order_amount DECIMAL DEFAULT 0,
  p_max_discount_amount DECIMAL DEFAULT NULL,
  p_notify_via_email BOOLEAN DEFAULT false,
  p_notify_via_push BOOLEAN DEFAULT false,
  p_auto_notify_on_start BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_offer_id UUID;
  v_slug TEXT;
  v_status offer_status;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Validate
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer name is required');
  END IF;
  
  -- Generate slug
  v_slug := generate_offer_slug(p_name);
  
  -- Determine status based on dates
  IF p_end_date IS NULL THEN
    p_end_date := p_start_date + INTERVAL '7 days';
  END IF;
  
  IF p_start_date > NOW() THEN
    v_status := 'scheduled';
  ELSE
    v_status := 'active';
  END IF;
  
  INSERT INTO special_offers (
    name, slug, description, event_type,
    discount_type, discount_value, min_order_amount, max_discount_amount,
    start_date, end_date, status,
    banner_image, popup_image, theme_colors,
    pakistani_flags, confetti_enabled,
    show_popup, popup_auto_close_seconds,
    notify_via_email, notify_via_push, auto_notify_on_start,
    created_by
  ) VALUES (
    trim(p_name), v_slug, p_description, p_event_type,
    p_discount_type, p_discount_value, p_min_order_amount, p_max_discount_amount,
    p_start_date, p_end_date, v_status,
    p_banner_image, p_popup_image, p_theme_colors,
    p_pakistani_flags, p_confetti_enabled,
    p_show_popup, p_popup_auto_close_seconds,
    p_notify_via_email, p_notify_via_push, p_auto_notify_on_start,
    v_user_id
  )
  RETURNING id INTO v_offer_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'offer_id', v_offer_id,
    'slug', v_slug,
    'message', 'Special offer created successfully'
  );
END;
$$;

-- =====================================================
-- RPC: UPDATE SPECIAL OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION update_special_offer(
  p_offer_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_event_type VARCHAR DEFAULT NULL,
  p_discount_type offer_discount_type DEFAULT NULL,
  p_discount_value DECIMAL DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_banner_image TEXT DEFAULT NULL,
  p_popup_image TEXT DEFAULT NULL,
  p_theme_colors JSONB DEFAULT NULL,
  p_pakistani_flags BOOLEAN DEFAULT NULL,
  p_confetti_enabled BOOLEAN DEFAULT NULL,
  p_show_popup BOOLEAN DEFAULT NULL,
  p_popup_auto_close_seconds INT DEFAULT NULL,
  p_is_visible BOOLEAN DEFAULT NULL,
  p_status offer_status DEFAULT NULL,
  p_min_order_amount DECIMAL DEFAULT NULL,
  p_max_discount_amount DECIMAL DEFAULT NULL,
  p_notify_via_email BOOLEAN DEFAULT NULL,
  p_notify_via_push BOOLEAN DEFAULT NULL,
  p_auto_notify_on_start BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM special_offers WHERE id = p_offer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  UPDATE special_offers SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    event_type = COALESCE(p_event_type, event_type),
    discount_type = COALESCE(p_discount_type, discount_type),
    discount_value = COALESCE(p_discount_value, discount_value),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    banner_image = COALESCE(p_banner_image, banner_image),
    popup_image = COALESCE(p_popup_image, popup_image),
    theme_colors = COALESCE(p_theme_colors, theme_colors),
    pakistani_flags = COALESCE(p_pakistani_flags, pakistani_flags),
    confetti_enabled = COALESCE(p_confetti_enabled, confetti_enabled),
    show_popup = COALESCE(p_show_popup, show_popup),
    popup_auto_close_seconds = COALESCE(p_popup_auto_close_seconds, popup_auto_close_seconds),
    is_visible = COALESCE(p_is_visible, is_visible),
    status = COALESCE(p_status, status),
    min_order_amount = COALESCE(p_min_order_amount, min_order_amount),
    max_discount_amount = COALESCE(p_max_discount_amount, max_discount_amount),
    notify_via_email = COALESCE(p_notify_via_email, notify_via_email),
    notify_via_push = COALESCE(p_notify_via_push, notify_via_push),
    auto_notify_on_start = COALESCE(p_auto_notify_on_start, auto_notify_on_start),
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_offer_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Offer updated successfully');
END;
$$;

-- =====================================================
-- RPC: ADD ITEMS TO OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION add_offer_items(
  p_offer_id UUID,
  p_items JSONB  -- [{ "menu_item_id": "...", "original_price": 500, "offer_price": 350, "size_variant": null }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
  v_discount_pct DECIMAL;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM special_offers WHERE id = p_offer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_discount_pct := ROUND(
      ((v_item->>'original_price')::DECIMAL - (v_item->>'offer_price')::DECIMAL) / 
      (v_item->>'original_price')::DECIMAL * 100, 
      2
    );
    
    INSERT INTO special_offer_items (
      offer_id, menu_item_id, original_price, offer_price, 
      discount_percentage, size_variant, max_quantity_per_order,
      total_available_quantity, sort_order
    ) VALUES (
      p_offer_id,
      (v_item->>'menu_item_id')::UUID,
      (v_item->>'original_price')::DECIMAL,
      (v_item->>'offer_price')::DECIMAL,
      v_discount_pct,
      v_item->>'size_variant',
      (v_item->>'max_quantity_per_order')::INT,
      (v_item->>'total_available_quantity')::INT,
      COALESCE((v_item->>'sort_order')::INT, v_count)
    )
    ON CONFLICT (offer_id, menu_item_id, size_variant) 
    DO UPDATE SET
      original_price = EXCLUDED.original_price,
      offer_price = EXCLUDED.offer_price,
      discount_percentage = EXCLUDED.discount_percentage;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'items_added', v_count);
END;
$$;

-- =====================================================
-- RPC: REMOVE ITEM FROM OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION remove_offer_item(
  p_offer_id UUID,
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  DELETE FROM special_offer_items WHERE id = p_item_id AND offer_id = p_offer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Item removed from offer');
END;
$$;

-- =====================================================
-- RPC: GET ACTIVE OFFERS (for landing page)
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_offers(
  p_include_items BOOLEAN DEFAULT true,
  p_for_popup BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offers JSONB;
BEGIN
  SELECT jsonb_agg(offer_data ORDER BY priority DESC, created_at DESC)
  INTO v_offers
  FROM (
    SELECT jsonb_build_object(
      'id', so.id,
      'name', so.name,
      'slug', so.slug,
      'description', so.description,
      'event_type', so.event_type,
      'banner_image', so.banner_image,
      'popup_image', so.popup_image,
      'theme_colors', so.theme_colors,
      'pakistani_flags', so.pakistani_flags,
      'confetti_enabled', so.confetti_enabled,
      'discount_type', so.discount_type,
      'discount_value', so.discount_value,
      'min_order_amount', so.min_order_amount,
      'max_discount_amount', so.max_discount_amount,
      'start_date', so.start_date,
      'end_date', so.end_date,
      'show_popup', so.show_popup,
      'popup_auto_close_seconds', so.popup_auto_close_seconds,
      'items', CASE 
        WHEN p_include_items THEN (
          SELECT jsonb_agg(jsonb_build_object(
            'id', soi.id,
            'menu_item_id', soi.menu_item_id,
            'menu_item', jsonb_build_object(
              'name', mi.name,
              'slug', mi.slug,
              'images', mi.images,
              'description', mi.description
            ),
            'original_price', soi.original_price,
            'offer_price', soi.offer_price,
            'discount_percentage', soi.discount_percentage,
            'size_variant', soi.size_variant
          ) ORDER BY soi.sort_order)
          FROM special_offer_items soi
          JOIN menu_items mi ON mi.id = soi.menu_item_id
          WHERE soi.offer_id = so.id
        )
        ELSE NULL
      END
    ) AS offer_data
    FROM special_offers so
    WHERE so.status = 'active'
      AND so.is_visible = true
      AND so.start_date <= NOW()
      AND so.end_date > NOW()
      AND (NOT p_for_popup OR so.show_popup = true)
  ) sub;
  
  -- Increment view count
  UPDATE special_offers 
  SET view_count = view_count + 1
  WHERE status = 'active' 
    AND is_visible = true 
    AND start_date <= NOW() 
    AND end_date > NOW();
  
  RETURN COALESCE(v_offers, '[]'::jsonb);
END;
$$;

-- =====================================================
-- RPC: GET ALL OFFERS (for admin)
-- =====================================================

CREATE OR REPLACE FUNCTION get_all_special_offers(
  p_status offer_status DEFAULT NULL,
  p_include_items BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offers JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  SELECT jsonb_agg(offer_data ORDER BY created_at DESC)
  INTO v_offers
  FROM (
    SELECT jsonb_build_object(
      'id', so.id,
      'name', so.name,
      'slug', so.slug,
      'description', so.description,
      'event_type', so.event_type,
      'banner_image', so.banner_image,
      'popup_image', so.popup_image,
      'thumbnail_image', so.thumbnail_image,
      'theme_colors', so.theme_colors,
      'pakistani_flags', so.pakistani_flags,
      'confetti_enabled', so.confetti_enabled,
      'discount_type', so.discount_type,
      'discount_value', so.discount_value,
      'min_order_amount', so.min_order_amount,
      'max_discount_amount', so.max_discount_amount,
      'start_date', so.start_date,
      'end_date', so.end_date,
      'status', so.status,
      'is_visible', so.is_visible,
      'show_popup', so.show_popup,
      'popup_auto_close_seconds', so.popup_auto_close_seconds,
      'show_on_landing', so.show_on_landing,
      'show_in_menu', so.show_in_menu,
      'notify_via_email', so.notify_via_email,
      'notify_via_push', so.notify_via_push,
      'notification_sent_at', so.notification_sent_at,
      'auto_notify_on_start', so.auto_notify_on_start,
      'view_count', so.view_count,
      'click_count', so.click_count,
      'conversion_count', so.conversion_count,
      'created_at', so.created_at,
      'updated_at', so.updated_at,
      'items_count', (SELECT COUNT(*) FROM special_offer_items WHERE offer_id = so.id),
      'items', CASE 
        WHEN p_include_items THEN (
          SELECT jsonb_agg(jsonb_build_object(
            'id', soi.id,
            'menu_item_id', soi.menu_item_id,
            'menu_item', jsonb_build_object(
              'id', mi.id,
              'name', mi.name,
              'slug', mi.slug,
              'images', mi.images,
              'price', mi.price
            ),
            'original_price', soi.original_price,
            'offer_price', soi.offer_price,
            'discount_percentage', soi.discount_percentage,
            'size_variant', soi.size_variant,
            'quantity_sold', soi.quantity_sold
          ) ORDER BY soi.sort_order)
          FROM special_offer_items soi
          JOIN menu_items mi ON mi.id = soi.menu_item_id
          WHERE soi.offer_id = so.id
        )
        ELSE NULL
      END
    ) AS offer_data
    FROM special_offers so
    WHERE (p_status IS NULL OR so.status = p_status)
  ) sub;
  
  RETURN jsonb_build_object(
    'success', true,
    'offers', COALESCE(v_offers, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM special_offers),
      'active', (SELECT COUNT(*) FROM special_offers WHERE status = 'active'),
      'scheduled', (SELECT COUNT(*) FROM special_offers WHERE status = 'scheduled'),
      'expired', (SELECT COUNT(*) FROM special_offers WHERE status = 'expired'),
      'draft', (SELECT COUNT(*) FROM special_offers WHERE status = 'draft')
    )
  );
END;
$$;

-- =====================================================
-- RPC: DELETE OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION delete_special_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  DELETE FROM special_offers WHERE id = p_offer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Offer deleted successfully');
END;
$$;

-- =====================================================
-- RPC: TOGGLE OFFER STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_offer_status(
  p_offer_id UUID,
  p_status offer_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  UPDATE special_offers 
  SET status = p_status, updated_by = auth.uid(), updated_at = NOW()
  WHERE id = p_offer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- =====================================================
-- RPC: TRACK OFFER CLICK
-- =====================================================

CREATE OR REPLACE FUNCTION track_offer_click(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE special_offers SET click_count = click_count + 1 WHERE id = p_offer_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- AUTO-UPDATE STATUS (Run via cron or scheduled function)
-- =====================================================

CREATE OR REPLACE FUNCTION update_offer_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Activate scheduled offers
  UPDATE special_offers 
  SET status = 'active'
  WHERE status = 'scheduled' AND start_date <= NOW();
  
  -- Expire ended offers
  UPDATE special_offers 
  SET status = 'expired'
  WHERE status IN ('active', 'scheduled') AND end_date < NOW();
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT ALL ON special_offers TO authenticated;
GRANT ALL ON special_offer_items TO authenticated;
GRANT SELECT ON special_offers TO anon;
GRANT SELECT ON special_offer_items TO anon;

GRANT EXECUTE ON FUNCTION create_special_offer TO authenticated;
GRANT EXECUTE ON FUNCTION update_special_offer TO authenticated;
GRANT EXECUTE ON FUNCTION add_offer_items TO authenticated;
GRANT EXECUTE ON FUNCTION remove_offer_item TO authenticated;
GRANT EXECUTE ON FUNCTION delete_special_offer TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_offer_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_special_offers TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_offers TO anon;
GRANT EXECUTE ON FUNCTION get_active_offers TO authenticated;
GRANT EXECUTE ON FUNCTION track_offer_click TO anon;
GRANT EXECUTE ON FUNCTION track_offer_click TO authenticated;

-- =====================================================
-- 🎉 DONE! Special Offers System Ready
-- Run this SQL in Supabase Dashboard
-- =====================================================
