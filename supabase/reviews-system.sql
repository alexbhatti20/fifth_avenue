-- =============================================
-- REVIEWS SYSTEM - ENHANCED SCHEMA AND RPC
-- Run this to add missing columns and create customer review functions
-- =============================================

-- Add rating and total_reviews to menu_items table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'menu_items' 
                   AND column_name = 'rating') THEN
        ALTER TABLE public.menu_items ADD COLUMN rating NUMERIC(2,1) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'menu_items' 
                   AND column_name = 'total_reviews') THEN
        ALTER TABLE public.menu_items ADD COLUMN total_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add rating and total_reviews to meals/deals table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'meals' 
                   AND column_name = 'rating') THEN
        ALTER TABLE public.meals ADD COLUMN rating NUMERIC(2,1) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'meals' 
                   AND column_name = 'total_reviews') THEN
        ALTER TABLE public.meals ADD COLUMN total_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add missing columns to reviews table if they don't exist
DO $$
BEGIN
    -- Add admin_reply column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reviews' 
                   AND column_name = 'admin_reply') THEN
        ALTER TABLE public.reviews ADD COLUMN admin_reply TEXT;
    END IF;
    
    -- Add replied_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reviews' 
                   AND column_name = 'replied_at') THEN
        ALTER TABLE public.reviews ADD COLUMN replied_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add review_type column (overall, item, meal, service, delivery)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reviews' 
                   AND column_name = 'review_type') THEN
        ALTER TABLE public.reviews ADD COLUMN review_type VARCHAR(20) DEFAULT 'overall';
    END IF;
    
    -- Add helpful_count for upvotes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reviews' 
                   AND column_name = 'helpful_count') THEN
        ALTER TABLE public.reviews ADD COLUMN helpful_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON public.reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON public.reviews(is_visible);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_review_type ON public.reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_item_id ON public.reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_meal_id ON public.reviews(meal_id);

-- Create helpful_votes table to track who marked reviews as helpful
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (id)
);

-- Create unique index to prevent duplicate votes (handles NULL customer_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_helpful_votes_customer 
    ON public.review_helpful_votes (review_id, customer_id) 
    WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_helpful_votes_ip 
    ON public.review_helpful_votes (review_id, ip_address) 
    WHERE customer_id IS NULL AND ip_address IS NOT NULL;

-- =============================================
-- PUBLIC REVIEW FUNCTIONS (No auth required for reading)
-- =============================================

-- Get public reviews with caching support
DROP FUNCTION IF EXISTS get_public_reviews(TEXT, UUID, UUID, INTEGER, INTEGER, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION get_public_reviews(
    p_review_type TEXT DEFAULT NULL,
    p_item_id UUID DEFAULT NULL,
    p_meal_id UUID DEFAULT NULL,
    p_min_rating INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_sort TEXT DEFAULT 'recent'
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reviews', COALESCE((
            SELECT json_agg(review_data ORDER BY 
                CASE WHEN p_sort = 'recent' THEN r.created_at END DESC,
                CASE WHEN p_sort = 'rating_high' THEN r.rating END DESC,
                CASE WHEN p_sort = 'rating_low' THEN r.rating END ASC,
                CASE WHEN p_sort = 'helpful' THEN r.helpful_count END DESC
            )
            FROM (
                SELECT 
                    json_build_object(
                        'id', r.id,
                        'customer', json_build_object(
                            'name', COALESCE(c.name, 'Anonymous'),
                            'initial', UPPER(LEFT(COALESCE(c.name, 'A'), 1))
                        ),
                        'rating', r.rating,
                        'comment', r.comment,
                        'review_type', r.review_type,
                        'images', COALESCE(r.images, '[]'::jsonb),
                        'is_verified', r.is_verified,
                        'helpful_count', COALESCE(r.helpful_count, 0),
                        'item', CASE 
                            WHEN r.item_id IS NOT NULL THEN (
                                SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images->0)
                                FROM menu_items mi WHERE mi.id = r.item_id
                            )
                            ELSE NULL
                        END,
                        'meal', CASE 
                            WHEN r.meal_id IS NOT NULL THEN (
                                SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images->0)
                                FROM meals m WHERE m.id = r.meal_id
                            )
                            ELSE NULL
                        END,
                        'admin_reply', r.admin_reply,
                        'replied_at', r.replied_at,
                        'created_at', r.created_at
                    ) AS review_data,
                    r.created_at,
                    r.rating,
                    r.helpful_count
                FROM reviews r
                LEFT JOIN customers c ON c.id = r.customer_id
                WHERE r.is_visible = true
                AND (p_review_type IS NULL OR r.review_type = p_review_type)
                AND (p_item_id IS NULL OR r.item_id = p_item_id)
                AND (p_meal_id IS NULL OR r.meal_id = p_meal_id)
                AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
                LIMIT p_limit OFFSET p_offset
            ) r
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total_reviews', COUNT(*),
                'average_rating', ROUND(COALESCE(AVG(rating), 0)::numeric, 1),
                'five_star', COUNT(*) FILTER (WHERE rating = 5),
                'four_star', COUNT(*) FILTER (WHERE rating = 4),
                'three_star', COUNT(*) FILTER (WHERE rating = 3),
                'two_star', COUNT(*) FILTER (WHERE rating = 2),
                'one_star', COUNT(*) FILTER (WHERE rating = 1)
            )
            FROM reviews
            WHERE is_visible = true
            AND (p_review_type IS NULL OR review_type = p_review_type)
            AND (p_item_id IS NULL OR item_id = p_item_id)
            AND (p_meal_id IS NULL OR meal_id = p_meal_id)
        ),
        'has_more', (
            SELECT COUNT(*) > (p_offset + p_limit)
            FROM reviews
            WHERE is_visible = true
            AND (p_review_type IS NULL OR review_type = p_review_type)
            AND (p_item_id IS NULL OR item_id = p_item_id)
            AND (p_meal_id IS NULL OR meal_id = p_meal_id)
            AND (p_min_rating IS NULL OR rating >= p_min_rating)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get item/meal specific reviews for menu pages
DROP FUNCTION IF EXISTS get_item_reviews(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_item_reviews(
    p_item_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
BEGIN
    RETURN get_public_reviews(NULL, p_item_id, NULL, NULL, p_limit, p_offset, 'helpful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get meal reviews
DROP FUNCTION IF EXISTS get_meal_reviews(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_meal_reviews(
    p_meal_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
BEGIN
    RETURN get_public_reviews(NULL, NULL, p_meal_id, NULL, p_limit, p_offset, 'helpful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CUSTOMER REVIEW FUNCTIONS (Auth required)
-- =============================================

-- Check if customer can submit a review (rate limit check - max 3 per day)
DROP FUNCTION IF EXISTS check_customer_review_limit(UUID);
CREATE OR REPLACE FUNCTION check_customer_review_limit(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
    review_count INTEGER;
    max_reviews INTEGER := 3;
BEGIN
    -- Count reviews submitted today
    SELECT COUNT(*) INTO review_count
    FROM reviews
    WHERE customer_id = p_customer_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
    
    RETURN json_build_object(
        'can_review', review_count < max_reviews,
        'reviews_today', review_count,
        'max_reviews', max_reviews,
        'remaining', GREATEST(0, max_reviews - review_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit a customer review
DROP FUNCTION IF EXISTS submit_customer_review(UUID, INTEGER, TEXT, TEXT, UUID, UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_customer_review(
    p_customer_id UUID,
    p_rating INTEGER,
    p_comment TEXT,
    p_review_type TEXT DEFAULT 'overall',
    p_item_id UUID DEFAULT NULL,
    p_meal_id UUID DEFAULT NULL,
    p_order_id UUID DEFAULT NULL,
    p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS JSON AS $$
DECLARE
    review_count INTEGER;
    max_reviews INTEGER := 3;
    new_review_id UUID;
    is_verified BOOLEAN := false;
    v_review_type TEXT;
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    -- Validate rating
    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('success', false, 'error', 'Rating must be between 1 and 5');
    END IF;
    
    -- Check daily limit
    SELECT COUNT(*) INTO review_count
    FROM reviews
    WHERE customer_id = p_customer_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
    
    IF review_count >= max_reviews THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Daily review limit reached. You can submit up to 3 reviews per day.',
            'reviews_today', review_count,
            'max_reviews', max_reviews
        );
    END IF;
    
    -- Check if customer exists
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- Check if order exists and belongs to customer (for verified reviews)
    -- Valid order_status values: pending, confirmed, preparing, ready, delivering, delivered, cancelled
    IF p_order_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM orders 
            WHERE id = p_order_id 
            AND customer_id = p_customer_id 
            AND status::text = 'delivered'
        ) THEN
            is_verified := true;
        END IF;
    END IF;
    
    -- Enforce check_review_target constraint logic:
    -- 'item' type requires item_id NOT NULL and meal_id NULL
    -- 'meal' type requires meal_id NOT NULL and item_id NULL
    -- 'overall'/'service'/'delivery' types require both item_id AND meal_id to be NULL
    v_review_type := COALESCE(p_review_type, 'overall');
    v_item_id := NULL;
    v_meal_id := NULL;
    
    IF p_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        v_review_type := 'item';
        v_item_id := p_item_id;
        v_meal_id := NULL;
    ELSIF p_meal_id IS NOT NULL AND EXISTS (SELECT 1 FROM meals WHERE id = p_meal_id) THEN
        v_review_type := 'meal';
        v_meal_id := p_meal_id;
        v_item_id := NULL;
    ELSE
        -- For overall/service/delivery reviews, both must be NULL
        v_item_id := NULL;
        v_meal_id := NULL;
        IF v_review_type NOT IN ('overall', 'service', 'delivery') THEN
            v_review_type := 'overall';
        END IF;
    END IF;
    
    -- Insert review
    INSERT INTO reviews (
        customer_id,
        order_id,
        item_id,
        meal_id,
        rating,
        comment,
        review_type,
        images,
        is_verified,
        is_visible
    ) VALUES (
        p_customer_id,
        p_order_id,
        v_item_id,
        v_meal_id,
        p_rating,
        p_comment,
        v_review_type,
        COALESCE(p_images, '[]'::jsonb),
        is_verified,
        true
    )
    RETURNING id INTO new_review_id;
    
    -- Update item/meal rating if applicable
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items 
        SET 
            rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true)
        WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals 
        SET 
            rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true)
        WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Review submitted successfully',
        'review_id', new_review_id,
        'is_verified', is_verified,
        'reviews_remaining', max_reviews - review_count - 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get customer's own reviews
DROP FUNCTION IF EXISTS get_customer_reviews(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_customer_reviews(
    p_customer_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reviews', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'rating', r.rating,
                    'comment', r.comment,
                    'review_type', r.review_type,
                    'images', COALESCE(r.images, '[]'::jsonb),
                    'is_verified', r.is_verified,
                    'is_visible', r.is_visible,
                    'helpful_count', COALESCE(r.helpful_count, 0),
                    'item', CASE 
                        WHEN r.item_id IS NOT NULL THEN (
                            SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images->0)
                            FROM menu_items mi WHERE mi.id = r.item_id
                        )
                        ELSE NULL
                    END,
                    'meal', CASE 
                        WHEN r.meal_id IS NOT NULL THEN (
                            SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images->0)
                            FROM meals m WHERE m.id = r.meal_id
                        )
                        ELSE NULL
                    END,
                    'admin_reply', r.admin_reply,
                    'replied_at', r.replied_at,
                    'created_at', r.created_at
                )
                ORDER BY r.created_at DESC
            )
            FROM reviews r
            WHERE r.customer_id = p_customer_id
            LIMIT p_limit OFFSET p_offset
        ), '[]'::json),
        'total', (SELECT COUNT(*) FROM reviews WHERE customer_id = p_customer_id),
        'limit_info', check_customer_review_limit(p_customer_id)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete customer's own review
DROP FUNCTION IF EXISTS delete_customer_review(UUID, UUID);
CREATE OR REPLACE FUNCTION delete_customer_review(
    p_customer_id UUID,
    p_review_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    -- Check if review belongs to customer
    SELECT item_id, meal_id INTO v_item_id, v_meal_id
    FROM reviews 
    WHERE id = p_review_id AND customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Review not found or unauthorized');
    END IF;
    
    -- Delete the review
    DELETE FROM reviews WHERE id = p_review_id AND customer_id = p_customer_id;
    
    -- Update item/meal ratings
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items 
        SET 
            rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true)
        WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals 
        SET 
            rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true), 0),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true)
        WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Review deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark review as helpful
DROP FUNCTION IF EXISTS mark_review_helpful(UUID, UUID, VARCHAR);
CREATE OR REPLACE FUNCTION mark_review_helpful(
    p_review_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    vote_exists BOOLEAN;
BEGIN
    -- Check if already voted
    SELECT EXISTS (
        SELECT 1 FROM review_helpful_votes
        WHERE review_id = p_review_id
        AND (
            (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
            OR (p_customer_id IS NULL AND ip_address = p_ip_address)
        )
    ) INTO vote_exists;
    
    IF vote_exists THEN
        RETURN json_build_object('success', false, 'error', 'Already marked as helpful');
    END IF;
    
    -- Insert vote
    INSERT INTO review_helpful_votes (review_id, customer_id, ip_address)
    VALUES (p_review_id, p_customer_id, p_ip_address);
    
    -- Update helpful count
    UPDATE reviews 
    SET helpful_count = COALESCE(helpful_count, 0) + 1
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true, 'message', 'Marked as helpful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS POLICIES FOR REVIEWS
-- =============================================

-- Enable RLS on reviews table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view visible reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can delete own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can do anything with reviews" ON public.reviews;

-- Create new policies
CREATE POLICY "Public can view visible reviews" ON public.reviews
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Customers can create reviews" ON public.reviews
    FOR INSERT WITH CHECK (customer_id IS NOT NULL);

CREATE POLICY "Customers can update own reviews" ON public.reviews
    FOR UPDATE USING (customer_id = auth.uid()::uuid);

CREATE POLICY "Customers can delete own reviews" ON public.reviews
    FOR DELETE USING (customer_id = auth.uid()::uuid);

-- Helpful votes policies
DROP POLICY IF EXISTS "Anyone can view helpful votes" ON public.review_helpful_votes;
DROP POLICY IF EXISTS "Anyone can insert helpful votes" ON public.review_helpful_votes;

CREATE POLICY "Anyone can view helpful votes" ON public.review_helpful_votes
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert helpful votes" ON public.review_helpful_votes
    FOR INSERT WITH CHECK (true);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_public_reviews TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_item_reviews TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_meal_reviews TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_customer_review_limit TO authenticated;
GRANT EXECUTE ON FUNCTION submit_customer_review TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION delete_customer_review TO authenticated;
GRANT EXECUTE ON FUNCTION mark_review_helpful TO anon, authenticated;
