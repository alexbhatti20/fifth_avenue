-- =============================================
-- ADVANCED ORDER CREATION RPC
-- Fast, optimized functions for portal order creation
-- Handles: Menu, Tables, Customers, Orders
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_order_creation_data();
DROP FUNCTION IF EXISTS search_customer_for_order(TEXT);
DROP FUNCTION IF EXISTS create_portal_order(JSON);

-- =============================================
-- 1. GET ALL DATA NEEDED FOR ORDER CREATION
-- Single optimized query for menu + tables + categories
-- =============================================

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

    -- Get available menu items with category info
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
            'preparation_time', m.preparation_time
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

-- =============================================
-- 2. SEARCH CUSTOMER FOR ORDER
-- Fast, optimized partial and exact match search
-- =============================================

CREATE OR REPLACE FUNCTION search_customer_for_order(
    p_search TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Use CTE for optimized search with pre-calculated loyalty
    WITH customer_search AS (
        SELECT 
            c.id,
            c.name,
            c.phone,
            c.email,
            c.address,
            c.is_verified,
            c.created_at,
            CASE WHEN c.phone = p_search THEN true ELSE false END as is_exact
        FROM customers c
        WHERE c.phone ILIKE '%' || p_search || '%'
           OR c.name ILIKE '%' || p_search || '%'
        ORDER BY 
            CASE WHEN c.phone = p_search THEN 0 ELSE 1 END
        LIMIT 10
    ),
    customer_stats AS (
        SELECT 
            cs.id,
            cs.name,
            cs.phone,
            cs.email,
            cs.address,
            cs.is_verified,
            cs.created_at,
            cs.is_exact,
            COALESCE(lp.total_points, 0) as loyalty_points,
            COALESCE(o.order_count, 0) as total_orders
        FROM customer_search cs
        LEFT JOIN LATERAL (
            SELECT SUM(
                CASE WHEN type IN ('earned', 'bonus') THEN points ELSE -points END
            ) as total_points
            FROM loyalty_points 
            WHERE customer_id = cs.id
        ) lp ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::INT as order_count
            FROM orders 
            WHERE customer_id = cs.id
        ) o ON true
    )
    SELECT json_build_object(
        'success', true,
        'exact_match', COALESCE((SELECT bool_or(is_exact) FROM customer_stats), false),
        'customers', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'phone', phone,
                    'email', email,
                    'address', address,
                    'loyalty_points', loyalty_points,
                    'total_orders', total_orders,
                    'loyalty_tier', CASE 
                        WHEN loyalty_points >= 5000 THEN 'platinum'
                        WHEN loyalty_points >= 2000 THEN 'gold'
                        WHEN loyalty_points >= 500 THEN 'silver'
                        ELSE 'bronze'
                    END,
                    'is_verified', is_verified,
                    'created_at', created_at
                )
            )
            FROM customer_stats
        ), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. CREATE PORTAL ORDER
-- Handles walk-in and registered customers
-- Creates order, updates table status
-- =============================================

CREATE OR REPLACE FUNCTION create_portal_order(
    p_order_data JSON
)
RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_customer_id UUID;
    v_customer_type TEXT;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_customer_email TEXT;
    v_customer_address TEXT;
    v_table_id UUID;
    v_table_number INT;
    v_order_type TEXT;
    v_items JSON;
    v_item RECORD;
    v_subtotal NUMERIC := 0;
    v_tax NUMERIC := 0;
    v_total NUMERIC := 0;
    v_notes TEXT;
    v_employee_id UUID;
    v_loyalty_points_earned INT := 0;
BEGIN
    -- Extract order data
    v_customer_type := p_order_data->>'customer_type';
    v_customer_name := p_order_data->>'customer_name';
    v_customer_phone := COALESCE(p_order_data->>'customer_phone', '0000000000');
    v_customer_email := p_order_data->>'customer_email';
    v_customer_address := p_order_data->>'customer_address';
    v_customer_id := NULLIF(p_order_data->>'customer_id', '')::UUID;
    v_table_id := NULLIF(p_order_data->>'table_id', '')::UUID;
    v_order_type := COALESCE(p_order_data->>'order_type', 'walk-in');
    v_items := p_order_data->'items';
    v_notes := p_order_data->>'notes';
    v_employee_id := NULLIF(p_order_data->>'employee_id', '')::UUID;

    -- Get table number if table_id provided
    IF v_table_id IS NOT NULL THEN
        SELECT table_number INTO v_table_number 
        FROM restaurant_tables 
        WHERE id = v_table_id;
    END IF;

    -- Generate order number
    SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(
               (SELECT COUNT(*)::INT + 1 
                FROM orders 
                WHERE DATE(created_at) = CURRENT_DATE), 
               1
           )::TEXT, 4, '0')
    INTO v_order_number;

    -- Calculate totals from items
    FOR v_item IN SELECT * FROM json_array_elements(v_items)
    LOOP
        v_subtotal := v_subtotal + (
            COALESCE((v_item.value->>'price')::NUMERIC, 0) * 
            COALESCE((v_item.value->>'quantity')::INT, 1)
        );
    END LOOP;

    -- Calculate tax (16% GST)
    v_tax := ROUND(v_subtotal * 0.16, 2);
    v_total := v_subtotal + v_tax;

    -- Calculate loyalty points (1 point per 100 spent)
    v_loyalty_points_earned := FLOOR(v_total / 100);

    -- Create the order
    INSERT INTO orders (
        id,
        order_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        order_type,
        table_number,
        status,
        payment_status,
        payment_method,
        items,
        subtotal,
        tax,
        total,
        notes,
        waiter_id,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_order_number,
        v_customer_id,
        v_customer_name,
        v_customer_phone,
        v_customer_email,
        v_customer_address,
        v_order_type::order_type,
        v_table_number,
        'pending'::order_status,
        'pending',
        'cash'::payment_method,
        v_items,
        v_subtotal,
        v_tax,
        v_total,
        v_notes,
        v_employee_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- Update table status if dine-in
    IF v_table_id IS NOT NULL THEN
        UPDATE restaurant_tables 
        SET status = 'occupied',
            current_order_id = v_order_id,
            updated_at = NOW()
        WHERE id = v_table_id;
    END IF;

    -- Add loyalty points if registered customer
    IF v_customer_id IS NOT NULL AND v_loyalty_points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, order_id, points, type, description, created_at)
        VALUES (v_customer_id, v_order_id, v_loyalty_points_earned, 'earned', 'Points earned from order ' || v_order_number, NOW());
    END IF;

    RETURN json_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'tax', v_tax,
        'total', v_total,
        'loyalty_points_earned', v_loyalty_points_earned,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_order_creation_data() TO authenticated;
GRANT EXECUTE ON FUNCTION search_customer_for_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_portal_order(JSON) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_order_creation_data IS 'Gets all data needed for order creation: menu, categories, tables, deals';
COMMENT ON FUNCTION search_customer_for_order IS 'Search customers by phone/name/email with partial matching';
COMMENT ON FUNCTION create_portal_order IS 'Create a new order from portal with customer handling';
