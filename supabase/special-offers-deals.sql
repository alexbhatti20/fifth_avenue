-- =====================================================
-- SPECIAL OFFERS - DEALS SUPPORT MIGRATION
-- Adds ability to apply offers to deals (not just menu items)
-- =====================================================

-- Add target_type column to special_offers
ALTER TABLE special_offers 
ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) DEFAULT 'menu_items';

-- =====================================================
-- TABLE: special_offer_deals (Deals in Offer)
-- =====================================================

CREATE TABLE IF NOT EXISTS special_offer_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES special_offers(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Pricing Override
  original_price DECIMAL(10,2) NOT NULL,
  offer_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2),
  
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(offer_id, deal_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_special_offer_deals_offer ON special_offer_deals(offer_id);
CREATE INDEX IF NOT EXISTS idx_special_offer_deals_deal ON special_offer_deals(deal_id);

-- RLS
ALTER TABLE special_offer_deals ENABLE ROW LEVEL SECURITY;

-- Public can view offer deals
CREATE POLICY "Anyone can view offer deals"
  ON special_offer_deals FOR SELECT
  USING (true);

-- Authenticated employees can manage offer deals
CREATE POLICY "Employees can manage offer deals"
  ON special_offer_deals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RPC: ADD DEALS TO OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION add_offer_deals(
  p_offer_id UUID,
  p_deals JSONB  -- [{ "deal_id": "...", "original_price": 1500, "offer_price": 1199 }]
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
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_deals)
  LOOP
    v_discount_pct := ROUND(
      ((v_item->>'original_price')::DECIMAL - (v_item->>'offer_price')::DECIMAL) / 
      NULLIF((v_item->>'original_price')::DECIMAL, 0) * 100, 
      2
    );
    
    INSERT INTO special_offer_deals (
      offer_id, deal_id, original_price, offer_price, 
      discount_percentage, sort_order
    ) VALUES (
      p_offer_id,
      (v_item->>'deal_id')::UUID,
      (v_item->>'original_price')::DECIMAL,
      (v_item->>'offer_price')::DECIMAL,
      v_discount_pct,
      v_count
    )
    ON CONFLICT (offer_id, deal_id) 
    DO UPDATE SET
      original_price = EXCLUDED.original_price,
      offer_price = EXCLUDED.offer_price,
      discount_percentage = EXCLUDED.discount_percentage,
      sort_order = EXCLUDED.sort_order;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'message', format('%s deals added to offer', v_count)
  );
END;
$$;

-- =====================================================
-- RPC: REMOVE DEAL FROM OFFER
-- =====================================================

CREATE OR REPLACE FUNCTION remove_offer_deal(
  p_offer_id UUID,
  p_deal_id UUID
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
  
  DELETE FROM special_offer_deals 
  WHERE offer_id = p_offer_id AND deal_id = p_deal_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Deal removed from offer');
END;
$$;

-- =====================================================
-- UPDATE: Get Active Offers WITH Deals
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_offers_with_deals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offers JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(offer_data ORDER BY offer_data->>'priority' DESC), '[]'::jsonb)
  INTO v_offers
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'event_type', o.event_type,
      'banner_image', o.banner_image,
      'popup_image', o.popup_image,
      'theme_colors', o.theme_colors,
      'pakistani_flags', o.pakistani_flags,
      'confetti_enabled', o.confetti_enabled,
      'discount_type', o.discount_type::TEXT,
      'discount_value', o.discount_value,
      'start_date', o.start_date,
      'end_date', o.end_date,
      'show_popup', o.show_popup,
      'popup_auto_close_seconds', o.popup_auto_close_seconds,
      'target_type', COALESCE(o.target_type, 'menu_items'),
      'items', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'menu_item_id', oi.menu_item_id,
          'menu_item', jsonb_build_object(
            'name', mi.name,
            'slug', mi.slug,
            'images', mi.images,
            'description', mi.description
          ),
          'original_price', oi.original_price,
          'offer_price', oi.offer_price,
          'discount_percentage', oi.discount_percentage
        ) ORDER BY oi.sort_order)
        FROM special_offer_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.offer_id = o.id
        ), '[]'::jsonb
      ),
      'deals', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', od.id,
          'deal_id', od.deal_id,
          'deal', jsonb_build_object(
            'name', d.name,
            'slug', d.slug,
            'image', d.image_url,
            'original_price', d.original_price
          ),
          'original_price', od.original_price,
          'offer_price', od.offer_price,
          'discount_percentage', od.discount_percentage
        ) ORDER BY od.sort_order)
        FROM special_offer_deals od
        JOIN deals d ON d.id = od.deal_id
        WHERE od.offer_id = o.id
        ), '[]'::jsonb
      )
    ) as offer_data
    FROM special_offers o
    WHERE o.is_visible = true
      AND o.status = 'active'
      AND NOW() BETWEEN o.start_date AND o.end_date
  ) sub;
  
  RETURN v_offers;
END;
$$;

-- =====================================================
-- UPDATE: get_all_special_offers to include deals
-- =====================================================

DROP FUNCTION IF EXISTS get_all_special_offers();

CREATE OR REPLACE FUNCTION get_all_special_offers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offers JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required', 'offers', '[]'::jsonb);
  END IF;
  
  SELECT COALESCE(jsonb_agg(offer_data ORDER BY offer_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_offers
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'event_type', o.event_type,
      'banner_image', o.banner_image,
      'popup_image', o.popup_image,
      'theme_colors', o.theme_colors,
      'pakistani_flags', o.pakistani_flags,
      'confetti_enabled', o.confetti_enabled,
      'discount_type', o.discount_type::TEXT,
      'discount_value', o.discount_value,
      'min_order_amount', o.min_order_amount,
      'max_discount_amount', o.max_discount_amount,
      'start_date', o.start_date,
      'end_date', o.end_date,
      'show_popup', o.show_popup,
      'popup_auto_close_seconds', o.popup_auto_close_seconds,
      'status', o.status::TEXT,
      'is_visible', o.is_visible,
      'show_on_landing', o.show_on_landing,
      'show_in_menu', o.show_in_menu,
      'priority', o.priority,
      'notify_via_email', o.notify_via_email,
      'notify_via_push', o.notify_via_push,
      'notification_sent_at', o.notification_sent_at,
      'auto_notify_on_start', o.auto_notify_on_start,
      'view_count', o.view_count,
      'click_count', o.click_count,
      'conversion_count', o.conversion_count,
      'target_type', COALESCE(o.target_type, 'menu_items'),
      'items_count', (
        SELECT COUNT(*) FROM special_offer_items WHERE offer_id = o.id
      ),
      'deals_count', (
        SELECT COUNT(*) FROM special_offer_deals WHERE offer_id = o.id
      ),
      'created_at', o.created_at,
      'updated_at', o.updated_at
    ) as offer_data
    FROM special_offers o
  ) sub;
  
  RETURN jsonb_build_object('success', true, 'offers', v_offers);
END;
$$;

-- =====================================================
-- RPC: GET OFFER WITH ITEMS AND DEALS
-- =====================================================

CREATE OR REPLACE FUNCTION get_offer_details(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'description', o.description,
    'event_type', o.event_type,
    'banner_image', o.banner_image,
    'popup_image', o.popup_image,
    'theme_colors', o.theme_colors,
    'pakistani_flags', o.pakistani_flags,
    'confetti_enabled', o.confetti_enabled,
    'discount_type', o.discount_type::TEXT,
    'discount_value', o.discount_value,
    'min_order_amount', o.min_order_amount,
    'max_discount_amount', o.max_discount_amount,
    'start_date', o.start_date,
    'end_date', o.end_date,
    'show_popup', o.show_popup,
    'popup_auto_close_seconds', o.popup_auto_close_seconds,
    'status', o.status::TEXT,
    'is_visible', o.is_visible,
    'notify_via_email', o.notify_via_email,
    'notify_via_push', o.notify_via_push,
    'auto_notify_on_start', o.auto_notify_on_start,
    'target_type', COALESCE(o.target_type, 'menu_items'),
    'items', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'menu_item_id', oi.menu_item_id,
        'menu_item', jsonb_build_object(
          'id', mi.id,
          'name', mi.name,
          'slug', mi.slug,
          'images', mi.images,
          'description', mi.description,
          'price', mi.price
        ),
        'original_price', oi.original_price,
        'offer_price', oi.offer_price,
        'discount_percentage', oi.discount_percentage,
        'size_variant', oi.size_variant,
        'max_quantity_per_order', oi.max_quantity_per_order,
        'sort_order', oi.sort_order
      ) ORDER BY oi.sort_order)
      FROM special_offer_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.offer_id = o.id
      ), '[]'::jsonb
    ),
    'deals', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', od.id,
        'deal_id', od.deal_id,
        'deal', jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'slug', d.slug,
          'image', d.image_url,
          'original_price', d.original_price,
          'discounted_price', d.discounted_price
        ),
        'original_price', od.original_price,
        'offer_price', od.offer_price,
        'discount_percentage', od.discount_percentage,
        'sort_order', od.sort_order
      ) ORDER BY od.sort_order)
      FROM special_offer_deals od
      JOIN deals d ON d.id = od.deal_id
      WHERE od.offer_id = o.id
      ), '[]'::jsonb
    ),
    'created_at', o.created_at,
    'updated_at', o.updated_at
  )
  INTO v_offer
  FROM special_offers o
  WHERE o.id = p_offer_id;
  
  IF v_offer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'offer', v_offer);
END;
$$;

-- =====================================================
-- RPC: Get All Deals (for selection dropdown)
-- =====================================================

CREATE OR REPLACE FUNCTION get_deals_for_offers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'deals', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'slug', d.slug,
        'image_url', d.image_url,
        'original_price', d.original_price,
        'discounted_price', d.discounted_price,
        'is_active', d.is_active
      ) ORDER BY d.name), '[]'::jsonb)
      FROM deals d
      WHERE d.is_active = true
    )
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_offer_deals TO authenticated;
GRANT EXECUTE ON FUNCTION remove_offer_deal TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_offers_with_deals TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_special_offers TO authenticated;
GRANT EXECUTE ON FUNCTION get_offer_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_deals_for_offers TO authenticated;
