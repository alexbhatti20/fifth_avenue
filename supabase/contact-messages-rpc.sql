-- =============================================
-- CONTACT MESSAGES MANAGEMENT - OPTIMIZED SSR RPC FUNCTIONS
-- For admin and manager roles only
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_contact_messages_advanced(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_contact_message_stats();
DROP FUNCTION IF EXISTS get_contact_message_by_id(UUID);
DROP FUNCTION IF EXISTS create_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_contact_message_status(UUID, TEXT);
DROP FUNCTION IF EXISTS add_contact_message_reply(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS bulk_delete_contact_messages(UUID[]);
DROP FUNCTION IF EXISTS bulk_update_contact_status(UUID[], TEXT);

-- =============================================
-- CONTACT MESSAGES TABLE (if not exists)
-- =============================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    subject character varying(255),
    message text NOT NULL,
    status character varying(50) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
    priority character varying(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    ip_address inet,
    user_agent text,
    -- Reply fields
    reply_message text,
    replied_by uuid REFERENCES public.employees(id),
    replied_at timestamp with time zone,
    reply_sent_via character varying(20) DEFAULT 'email' CHECK (reply_sent_via IN ('email', 'phone', 'both')),
    -- Customer linking (optional)
    customer_id uuid REFERENCES public.customers(id),
    -- Timestamps
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_messages_pkey PRIMARY KEY (id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON public.contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_priority ON public.contact_messages(priority);

-- =============================================
-- RLS POLICIES FOR CONTACT MESSAGES
-- =============================================

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can do everything with contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Managers can view and respond to messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow insert for API" ON public.contact_messages;

-- Admin full access
CREATE POLICY "Admins can do everything with contact messages" ON public.contact_messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin')
    );

-- Manager access (view, update, respond - no delete)
CREATE POLICY "Managers can view and update contact messages" ON public.contact_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role IN ('admin', 'manager'))
    );

CREATE POLICY "Managers can update contact messages" ON public.contact_messages
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role IN ('admin', 'manager'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role IN ('admin', 'manager'))
    );

-- Allow API/anon to insert new messages
CREATE POLICY "Allow insert for API" ON public.contact_messages
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- =============================================
-- CREATE CONTACT MESSAGE (public facing)
-- =============================================

CREATE OR REPLACE FUNCTION create_contact_message(
    p_name TEXT,
    p_email TEXT,
    p_message TEXT,
    p_phone TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_message_id uuid;
    v_customer_id uuid;
BEGIN
    -- Validation
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN
        RETURN json_build_object('success', false, 'error', 'Name is required (min 2 characters)');
    END IF;
    
    IF p_email IS NULL OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object('success', false, 'error', 'Valid email is required');
    END IF;
    
    IF p_message IS NULL OR LENGTH(TRIM(p_message)) < 10 THEN
        RETURN json_build_object('success', false, 'error', 'Message is required (min 10 characters)');
    END IF;
    
    -- Try to link to existing customer
    SELECT id INTO v_customer_id FROM customers WHERE LOWER(email) = LOWER(TRIM(p_email)) LIMIT 1;
    
    -- Insert the message
    INSERT INTO contact_messages (
        name, email, phone, subject, message,
        ip_address, user_agent, customer_id, status
    ) VALUES (
        TRIM(p_name),
        LOWER(TRIM(p_email)),
        NULLIF(TRIM(p_phone), ''),
        NULLIF(TRIM(p_subject), ''),
        TRIM(p_message),
        p_ip_address::inet,
        p_user_agent,
        v_customer_id,
        'unread'
    ) RETURNING id INTO v_message_id;
    
    RETURN json_build_object(
        'success', true,
        'message_id', v_message_id,
        'message', 'Your message has been sent successfully. We will get back to you within 24 hours.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to send message: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon for public form submissions
GRANT EXECUTE ON FUNCTION create_contact_message TO anon;
GRANT EXECUTE ON FUNCTION create_contact_message TO authenticated;

-- =============================================
-- GET CONTACT MESSAGES (Admin/Manager)
-- Optimized single call with filters and pagination
-- =============================================

CREATE OR REPLACE FUNCTION get_contact_messages_advanced(
    p_status TEXT DEFAULT 'all',           -- 'unread', 'read', 'replied', 'archived', 'all'
    p_sort_by TEXT DEFAULT 'recent',       -- 'recent', 'oldest', 'priority'
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin and manager can access contact messages.'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'messages', COALESCE((
            SELECT json_agg(msg_data ORDER BY
                CASE WHEN p_sort_by = 'recent' THEN sub.created_at END DESC NULLS LAST,
                CASE WHEN p_sort_by = 'oldest' THEN sub.created_at END ASC NULLS LAST,
                CASE WHEN p_sort_by = 'priority' THEN 
                    CASE sub.priority 
                        WHEN 'urgent' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'normal' THEN 3 
                        ELSE 4 
                    END 
                END ASC NULLS LAST
            )
            FROM (
                SELECT json_build_object(
                    'id', cm.id,
                    'name', cm.name,
                    'email', cm.email,
                    'phone', cm.phone,
                    'subject', cm.subject,
                    'message', cm.message,
                    'status', cm.status,
                    'priority', cm.priority,
                    'reply_message', cm.reply_message,
                    'replied_at', cm.replied_at,
                    'reply_sent_via', cm.reply_sent_via,
                    'created_at', cm.created_at,
                    'updated_at', cm.updated_at,
                    -- Replied by employee info
                    'replied_by', CASE 
                        WHEN cm.replied_by IS NOT NULL THEN (
                            SELECT json_build_object(
                                'id', e.id,
                                'name', e.name,
                                'role', e.role
                            )
                            FROM employees e WHERE e.id = cm.replied_by
                        )
                        ELSE NULL
                    END,
                    -- Linked customer info
                    'customer', CASE 
                        WHEN cm.customer_id IS NOT NULL THEN (
                            SELECT json_build_object(
                                'id', c.id,
                                'name', c.name,
                                'email', c.email,
                                'phone', c.phone,
                                'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
                                'is_verified', COALESCE(c.is_verified, false)
                            )
                            FROM customers c WHERE c.id = cm.customer_id
                        )
                        ELSE NULL
                    END
                ) AS msg_data,
                cm.created_at,
                cm.priority
                FROM contact_messages cm
                WHERE 1=1
                -- Status filter
                AND (
                    p_status IS NULL 
                    OR p_status = 'all'
                    OR cm.status = p_status
                )
                -- Search filter
                AND (
                    p_search IS NULL 
                    OR p_search = ''
                    OR cm.name ILIKE '%' || p_search || '%'
                    OR cm.email ILIKE '%' || p_search || '%'
                    OR cm.phone ILIKE '%' || p_search || '%'
                    OR cm.subject ILIKE '%' || p_search || '%'
                    OR cm.message ILIKE '%' || p_search || '%'
                )
                ORDER BY cm.created_at DESC
                LIMIT p_limit
                OFFSET p_offset
            ) sub
        ), '[]'::json),
        'total_count', (
            SELECT COUNT(*)
            FROM contact_messages cm
            WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR cm.status = p_status)
            AND (
                p_search IS NULL 
                OR p_search = ''
                OR cm.name ILIKE '%' || p_search || '%'
                OR cm.email ILIKE '%' || p_search || '%'
                OR cm.message ILIKE '%' || p_search || '%'
            )
        ),
        'has_more', (
            SELECT COUNT(*) > (p_offset + p_limit)
            FROM contact_messages cm
            WHERE 1=1
            AND (p_status IS NULL OR p_status = 'all' OR cm.status = p_status)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET CONTACT MESSAGE STATS
-- =============================================

CREATE OR REPLACE FUNCTION get_contact_message_stats()
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
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM contact_messages),
            'unread', (SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'),
            'read', (SELECT COUNT(*) FROM contact_messages WHERE status = 'read'),
            'replied', (SELECT COUNT(*) FROM contact_messages WHERE status = 'replied'),
            'archived', (SELECT COUNT(*) FROM contact_messages WHERE status = 'archived'),
            'urgent', (SELECT COUNT(*) FROM contact_messages WHERE priority = 'urgent' AND status != 'archived'),
            'high_priority', (SELECT COUNT(*) FROM contact_messages WHERE priority = 'high' AND status != 'archived'),
            'today', (SELECT COUNT(*) FROM contact_messages WHERE created_at >= CURRENT_DATE),
            'this_week', (SELECT COUNT(*) FROM contact_messages WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
            'avg_response_time_hours', (
                SELECT ROUND(EXTRACT(EPOCH FROM AVG(replied_at - created_at)) / 3600, 1)
                FROM contact_messages WHERE replied_at IS NOT NULL
            )
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GET SINGLE MESSAGE BY ID
-- =============================================

CREATE OR REPLACE FUNCTION get_contact_message_by_id(p_message_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'message', (
            SELECT json_build_object(
                'id', cm.id,
                'name', cm.name,
                'email', cm.email,
                'phone', cm.phone,
                'subject', cm.subject,
                'message', cm.message,
                'status', cm.status,
                'priority', cm.priority,
                'ip_address', cm.ip_address,
                'user_agent', cm.user_agent,
                'reply_message', cm.reply_message,
                'replied_at', cm.replied_at,
                'reply_sent_via', cm.reply_sent_via,
                'created_at', cm.created_at,
                'updated_at', cm.updated_at,
                'replied_by', CASE 
                    WHEN cm.replied_by IS NOT NULL THEN (
                        SELECT json_build_object('id', e.id, 'name', e.name, 'role', e.role)
                        FROM employees e WHERE e.id = cm.replied_by
                    )
                    ELSE NULL
                END,
                'customer', CASE 
                    WHEN cm.customer_id IS NOT NULL THEN (
                        SELECT json_build_object(
                            'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone,
                            'total_orders', (SELECT COUNT(*) FROM orders WHERE customer_id = c.id)
                        )
                        FROM customers c WHERE c.id = cm.customer_id
                    )
                    ELSE NULL
                END
            )
            FROM contact_messages cm
            WHERE cm.id = p_message_id
        )
    ) INTO result;
    
    -- Mark as read if unread
    UPDATE contact_messages SET status = 'read', updated_at = NOW()
    WHERE id = p_message_id AND status = 'unread';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE MESSAGE STATUS
-- =============================================

CREATE OR REPLACE FUNCTION update_contact_message_status(
    p_message_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_status NOT IN ('unread', 'read', 'replied', 'archived') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    UPDATE contact_messages 
    SET status = p_status, updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN json_build_object('success', true, 'message', 'Status updated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE MESSAGE PRIORITY
-- =============================================

CREATE OR REPLACE FUNCTION update_contact_message_priority(
    p_message_id UUID,
    p_priority TEXT
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid priority');
    END IF;
    
    UPDATE contact_messages 
    SET priority = p_priority, updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN json_build_object('success', true, 'message', 'Priority updated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ADD REPLY TO MESSAGE
-- =============================================

CREATE OR REPLACE FUNCTION add_contact_message_reply(
    p_message_id UUID,
    p_reply_message TEXT,
    p_replied_by UUID,
    p_send_via TEXT DEFAULT 'email'
)
RETURNS JSON AS $$
DECLARE
    v_email TEXT;
    v_name TEXT;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_reply_message IS NULL OR LENGTH(TRIM(p_reply_message)) < 5 THEN
        RETURN json_build_object('success', false, 'error', 'Reply message is required');
    END IF;
    
    -- Get customer email for sending
    SELECT email, name INTO v_email, v_name
    FROM contact_messages WHERE id = p_message_id;
    
    IF v_email IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Message not found');
    END IF;
    
    -- Update the message with reply
    UPDATE contact_messages SET
        reply_message = TRIM(p_reply_message),
        replied_by = p_replied_by,
        replied_at = NOW(),
        reply_sent_via = p_send_via,
        status = 'replied',
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Return success with email info for client to send email
    RETURN json_build_object(
        'success', true,
        'message', 'Reply saved',
        'send_email', true,
        'recipient_email', v_email,
        'recipient_name', v_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BULK DELETE MESSAGES (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION bulk_delete_contact_messages(p_message_ids UUID[])
RETURNS JSON AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Admin only for delete
    IF NOT EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.auth_user_id = auth.uid() AND e.role = 'admin'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Only admins can delete messages');
    END IF;
    
    IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No messages selected');
    END IF;
    
    DELETE FROM contact_messages WHERE id = ANY(p_message_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', v_deleted_count || ' message(s) deleted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BULK UPDATE STATUS
-- =============================================

CREATE OR REPLACE FUNCTION bulk_update_contact_status(
    p_message_ids UUID[],
    p_status TEXT
)
RETURNS JSON AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_status NOT IN ('unread', 'read', 'replied', 'archived') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No messages selected');
    END IF;
    
    UPDATE contact_messages 
    SET status = p_status, updated_at = NOW()
    WHERE id = ANY(p_message_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'message', v_updated_count || ' message(s) updated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION get_contact_messages_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_message_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_message_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact_message_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact_message_priority TO authenticated;
GRANT EXECUTE ON FUNCTION add_contact_message_reply TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_delete_contact_messages TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_contact_status TO authenticated;
