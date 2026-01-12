-- =============================================
-- ADMIN REVIEWS MANAGEMENT - OPTIMIZED RPC FUNCTIONS
-- For admin and manager role only
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_admin_reviews_advanced(TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_all_review_stats();
DROP FUNCTION IF EXISTS bulk_update_review_visibility(UUID[], BOOLEAN);
DROP FUNCTION IF EXISTS get_review_by_id(UUID);

-- =============================================
-- OPTIMIZED ADMIN REVIEWS FETCH WITH ALL DETAILS
-- Single RPC call for all data needed on admin reviews page
-- =============================================

CREATE OR REPLACE FUNCTION get_admin_reviews_advanced(
    p_status TEXT DEFAULT NULL,           -- 'visible', 'hidden', 'pending_reply', 'replied', 'verified', 'all'
    p_min_rating INTEGER DEFAULT NULL,
    p_max_rating INTEGER DEFAULT NULL,
    p_has_reply BOOLEAN DEFAULT NULL,      -- true = has reply, false = no reply, null = all
    p_sort_by TEXT DEFAULT 'recent',       -- 'recent', 'oldest', 'rating_high', 'rating_low', 'helpful'
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check - only admin or manager
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin and manager can access reviews management.'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'reviews', COALESCE((
            SELECT json_agg(review_data ORDER BY 
                CASE WHEN p_sort_by = 'recent' THEN r.created_at END DESC NULLS LAST,
                CASE WHEN p_sort_by = 'oldest' THEN r.created_at END ASC NULLS LAST,
                CASE WHEN p_sort_by = 'rating_high' THEN r.rating END DESC NULLS LAST,
                CASE WHEN p_sort_by = 'rating_low' THEN r.rating END ASC NULLS LAST,
                CASE WHEN p_sort_by = 'helpful' THEN r.helpful_count END DESC NULLS LAST
            )
            FROM (
                SELECT 
                    json_build_object(
                        'id', r.id,
                        'rating', r.rating,
                        'comment', r.comment,
                        'review_type', COALESCE(r.review_type, 'overall'),
                        'images', COALESCE(r.images, '[]'::jsonb),
                        'is_verified', COALESCE(r.is_verified, false),
                        'is_visible', COALESCE(r.is_visible, true),
                        'helpful_count', COALESCE(r.helpful_count, 0),
                        'admin_reply', r.admin_reply,
                        'replied_at', r.replied_at,
                        'replied_by', r.replied_by,
                        'created_at', r.created_at,
                        'updated_at', r.updated_at,
                        'order_id', r.order_id,
                        -- Customer details (full info for admin)
                        'customer', CASE 
                            WHEN r.customer_id IS NOT NULL THEN (
                                SELECT json_build_object(
                                    'id', c.id,
                                    'name', COALESCE(c.name, 'Anonymous'),
                                    'email', c.email,
                                    'phone', c.phone,
                                    'address', c.address,
                                    'is_verified', COALESCE(c.is_verified, false),
                                    'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
                                    'member_since', c.created_at
                                )
                                FROM customers c WHERE c.id = r.customer_id
                            )
                            ELSE json_build_object(
                                'id', NULL,
                                'name', 'Anonymous',
                                'email', NULL,
                                'phone', NULL
                            )
                        END,
                        -- Item details (if item review)
                        'item', CASE 
                            WHEN r.item_id IS NOT NULL THEN (
                                SELECT json_build_object(
                                    'id', mi.id,
                                    'name', mi.name,
                                    'image', mi.images->0,
                                    'category_id', mi.category_id,
                                    'price', mi.price,
                                    'avg_rating', mi.rating,
                                    'total_reviews', mi.total_reviews
                                )
                                FROM menu_items mi WHERE mi.id = r.item_id
                            )
                            ELSE NULL
                        END,
                        -- Meal/Deal details (if meal review)
                        'meal', CASE 
                            WHEN r.meal_id IS NOT NULL THEN (
                                SELECT json_build_object(
                                    'id', m.id,
                                    'name', m.name,
                                    'image', m.images->0,
                                    'price', COALESCE(m.original_price, m.price),
                                    'avg_rating', m.rating,
                                    'total_reviews', m.total_reviews
                                )
                                FROM meals m WHERE m.id = r.meal_id
                            )
                            ELSE NULL
                        END,
                        -- Order details (if from an order)
                        'order', CASE
                            WHEN r.order_id IS NOT NULL THEN (
                                SELECT json_build_object(
                                    'id', o.id,
                                    'order_number', o.order_number,
                                    'total', o.total,
                                    'order_type', o.order_type,
                                    'created_at', o.created_at
                                )
                                FROM orders o WHERE o.id = r.order_id
                            )
                            ELSE NULL
                        END
                    ) AS review_data,
                    r.created_at,
                    r.rating,
                    r.helpful_count
                FROM reviews r
                WHERE 1=1
                -- Status filter
                AND (
                    p_status IS NULL 
                    OR p_status = 'all'
                    OR (p_status = 'visible' AND r.is_visible = true)
                    OR (p_status = 'hidden' AND r.is_visible = false)
                    OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
                    OR (p_status = 'replied' AND r.admin_reply IS NOT NULL)
                    OR (p_status = 'verified' AND r.is_verified = true)
                )
                -- Rating filters
                AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
                AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
                -- Has reply filter
                AND (p_has_reply IS NULL 
                     OR (p_has_reply = true AND r.admin_reply IS NOT NULL)
                     OR (p_has_reply = false AND r.admin_reply IS NULL))
                LIMIT p_limit OFFSET p_offset
            ) r
        ), '[]'::json),
        -- Stats for the current filter
        'total_count', (
            SELECT COUNT(*)
            FROM reviews r
            WHERE 1=1
            AND (
                p_status IS NULL 
                OR p_status = 'all'
                OR (p_status = 'visible' AND r.is_visible = true)
                OR (p_status = 'hidden' AND r.is_visible = false)
                OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
                OR (p_status = 'replied' AND r.admin_reply IS NOT NULL)
                OR (p_status = 'verified' AND r.is_verified = true)
            )
            AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
            AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
            AND (p_has_reply IS NULL 
                 OR (p_has_reply = true AND r.admin_reply IS NOT NULL)
                 OR (p_has_reply = false AND r.admin_reply IS NULL))
        ),
        'has_more', (
            SELECT COUNT(*) > (p_offset + p_limit)
            FROM reviews r
            WHERE 1=1
            AND (
                p_status IS NULL 
                OR p_status = 'all'
                OR (p_status = 'visible' AND r.is_visible = true)
                OR (p_status = 'hidden' AND r.is_visible = false)
                OR (p_status = 'pending_reply' AND r.admin_reply IS NULL)
                OR (p_status = 'replied' AND r.admin_reply IS NOT NULL)
                OR (p_status = 'verified' AND r.is_verified = true)
            )
            AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
            AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
            AND (p_has_reply IS NULL 
                 OR (p_has_reply = true AND r.admin_reply IS NOT NULL)
                 OR (p_has_reply = false AND r.admin_reply IS NULL))
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET ALL REVIEW STATS (Single call for dashboard stats)
-- =============================================

CREATE OR REPLACE FUNCTION get_all_review_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        -- Overall counts
        'total_reviews', (SELECT COUNT(*) FROM reviews),
        'visible_reviews', (SELECT COUNT(*) FROM reviews WHERE is_visible = true),
        'hidden_reviews', (SELECT COUNT(*) FROM reviews WHERE is_visible = false),
        'verified_reviews', (SELECT COUNT(*) FROM reviews WHERE is_verified = true),
        
        -- Rating stats
        'average_rating', COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews), 0),
        'five_star', (SELECT COUNT(*) FROM reviews WHERE rating = 5),
        'four_star', (SELECT COUNT(*) FROM reviews WHERE rating = 4),
        'three_star', (SELECT COUNT(*) FROM reviews WHERE rating = 3),
        'two_star', (SELECT COUNT(*) FROM reviews WHERE rating = 2),
        'one_star', (SELECT COUNT(*) FROM reviews WHERE rating = 1),
        
        -- Reply stats
        'pending_replies', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NULL),
        'total_replied', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NOT NULL),
        
        -- Time-based stats
        'this_week', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days'),
        'this_month', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '30 days'),
        'today', (SELECT COUNT(*) FROM reviews WHERE created_at >= CURRENT_DATE),
        
        -- Helpful stats
        'most_helpful', (SELECT MAX(helpful_count) FROM reviews),
        'avg_helpful', COALESCE((SELECT ROUND(AVG(helpful_count)::numeric, 1) FROM reviews WHERE helpful_count > 0), 0),
        
        -- Review type breakdown
        'by_type', (
            SELECT json_object_agg(
                COALESCE(review_type, 'overall'),
                type_count
            )
            FROM (
                SELECT review_type, COUNT(*) as type_count
                FROM reviews
                GROUP BY review_type
            ) t
        ),
        
        -- Rating trend (last 7 days avg vs previous 7 days)
        'recent_avg_rating', COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM reviews
            WHERE created_at >= NOW() - INTERVAL '7 days'
        ), 0),
        'previous_avg_rating', COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM reviews
            WHERE created_at >= NOW() - INTERVAL '14 days'
            AND created_at < NOW() - INTERVAL '7 days'
        ), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BULK UPDATE REVIEW VISIBILITY
-- =============================================

CREATE OR REPLACE FUNCTION bulk_update_review_visibility(
    p_review_ids UUID[],
    p_is_visible BOOLEAN
)
RETURNS JSON AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = ANY(p_review_ids);
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'affected_count', affected_count,
        'message', affected_count || ' reviews updated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REPLY TO REVIEW WITH EMPLOYEE TRACKING
-- =============================================

-- Add replied_by column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reviews' 
                   AND column_name = 'replied_by') THEN
        ALTER TABLE public.reviews ADD COLUMN replied_by UUID REFERENCES public.employees(id);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION reply_to_review_advanced(
    p_review_id UUID,
    p_reply TEXT,
    p_employee_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_reply IS NULL OR TRIM(p_reply) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Reply cannot be empty');
    END IF;
    
    UPDATE reviews
    SET 
        admin_reply = TRIM(p_reply),
        replied_at = NOW(),
        replied_by = p_employee_id,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reply saved successfully',
        'replied_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DELETE REVIEW WITH RATING UPDATE
-- =============================================

CREATE OR REPLACE FUNCTION delete_review_advanced(p_review_id UUID)
RETURNS JSON AS $$
DECLARE
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Get item/meal ids before deletion to update their ratings
    SELECT item_id, meal_id INTO v_item_id, v_meal_id
    FROM reviews WHERE id = p_review_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found');
    END IF;
    
    -- Delete the review
    DELETE FROM reviews WHERE id = p_review_id;
    
    -- Update item rating if applicable
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items 
        SET 
            rating = COALESCE((
                SELECT ROUND(AVG(rating)::numeric, 1) 
                FROM reviews 
                WHERE item_id = v_item_id AND is_visible = true
            ), 0),
            total_reviews = (
                SELECT COUNT(*) 
                FROM reviews 
                WHERE item_id = v_item_id AND is_visible = true
            )
        WHERE id = v_item_id;
    END IF;
    
    -- Update meal rating if applicable
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals 
        SET 
            rating = COALESCE((
                SELECT ROUND(AVG(rating)::numeric, 1) 
                FROM reviews 
                WHERE meal_id = v_meal_id AND is_visible = true
            ), 0),
            total_reviews = (
                SELECT COUNT(*) 
                FROM reviews 
                WHERE meal_id = v_meal_id AND is_visible = true
            )
        WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Review deleted successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SHOW/HIDE ALL REVIEWS
-- =============================================

CREATE OR REPLACE FUNCTION set_all_reviews_visibility(p_is_visible BOOLEAN)
RETURNS JSON AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Authorization check - only admin
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    -- Update all menu items and meals ratings based on new visibility
    UPDATE menu_items mi
    SET 
        rating = COALESCE((
            SELECT ROUND(AVG(r.rating)::numeric, 1) 
            FROM reviews r 
            WHERE r.item_id = mi.id AND r.is_visible = true
        ), 0),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews r 
            WHERE r.item_id = mi.id AND r.is_visible = true
        );
    
    UPDATE meals m
    SET 
        rating = COALESCE((
            SELECT ROUND(AVG(r.rating)::numeric, 1) 
            FROM reviews r 
            WHERE r.meal_id = m.id AND r.is_visible = true
        ), 0),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews r 
            WHERE r.meal_id = m.id AND r.is_visible = true
        );
    
    RETURN json_build_object(
        'success', true,
        'affected_count', affected_count,
        'message', CASE WHEN p_is_visible THEN 'All reviews are now visible' ELSE 'All reviews are now hidden' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION get_admin_reviews_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_review_stats TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_review_visibility TO authenticated;
GRANT EXECUTE ON FUNCTION reply_to_review_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION delete_review_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION set_all_reviews_visibility TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible_rating ON public.reviews(is_visible, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_admin_reply ON public.reviews(admin_reply) WHERE admin_reply IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_created_at_desc ON public.reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_helpful_count ON public.reviews(helpful_count DESC) WHERE helpful_count > 0;
